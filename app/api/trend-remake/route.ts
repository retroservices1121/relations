import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { putR2Object, r2Configured } from "@/lib/r2";
import {
  balancedTrendSegments,
  GENJUTSU_ENDPOINT,
  TREND_ENDPOINT,
  trendPrompt,
  type TrendJob,
  type TrendProvider,
  type TrendSegment,
} from "@/lib/trend-remake";

fal.config({ credentials: process.env.FAL_KEY });
export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const HIGGSFIELD_BASE_URL = "https://api.higgsfield.ai";

function clean(value: string) { return value.replace(/[^a-zA-Z0-9-_]/g, "-"); }
function validUrl(value: unknown): value is string { return typeof value === "string" && /^https:\/\//.test(value); }
function providerFrom(value: unknown): TrendProvider {
  return value === "fal-minimax" ? "fal-minimax" : "higgsfield-genjutsu";
}
type CaptionRegion = "none" | "top" | "middle" | "bottom";
function captionRegionFrom(value: unknown): CaptionRegion {
  return value === "top" || value === "middle" || value === "bottom" ? value : "none";
}
function sourceVideoFilter(region: CaptionRegion) {
  if (region === "none") return "fps=30,format=yuv420p";
  const band = region === "top"
    ? { start: 0.02, height: 0.28 }
    : region === "middle"
      ? { start: 0.28, height: 0.44 }
      : { start: 0.58, height: 0.38 };
  const height = `trunc(ih*${band.height}/2)*2`;
  return `split=2[base][blur];[blur]crop=iw:${height}:0:ih*${band.start},boxblur=12:2[patch];[base][patch]overlay=0:main_h*${band.start},fps=30,format=yuv420p`;
}
function higgsfieldCredentials() {
  const singleKey = process.env.HF_API_KEY?.trim() || process.env.HF_CREDENTIALS?.trim();
  if (singleKey) return singleKey;
  const keyId = process.env.HF_API_KEY_ID?.trim();
  const keySecret = process.env.HF_API_KEY_SECRET?.trim();
  return keyId && keySecret ? `${keyId}:${keySecret}` : "";
}
async function parseHiggsfieldError(response: Response) {
  const data = await response.json().catch(() => null) as { detail?: unknown; error?: unknown; message?: unknown } | null;
  const detail = data?.detail ?? data?.error ?? data?.message;
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail ?? data ?? { status: response.status }); }
  catch { return `Higgsfield request failed with HTTP ${response.status}.`; }
}
function errorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const value = error as { message?: unknown; body?: { detail?: unknown }; requestId?: unknown };
  const detail = value.body?.detail;
  let message = typeof value.message === "string" ? value.message : fallback;
  if (typeof detail === "string") message = detail;
  else if (Array.isArray(detail)) {
    const fields = detail.map((item) => {
      if (!item || typeof item !== "object") return "";
      const issue = item as { loc?: unknown; msg?: unknown };
      const location = Array.isArray(issue.loc) ? issue.loc.filter((part) => part !== "body").join(" → ") : "";
      const reason = typeof issue.msg === "string" ? issue.msg : "";
      return [location, reason].filter(Boolean).join(": ");
    }).filter(Boolean);
    if (fields.length) message = fields.join("; ");
  }
  const requestId = typeof value.requestId === "string" && value.requestId ? ` (fal request ${value.requestId})` : "";
  return `${message}${requestId}`;
}
async function download(url: string, output: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Could not download trend media (${response.status}).`);
  await fs.writeFile(output, Buffer.from(await response.arrayBuffer()));
}
async function probe(file: string) {
  const result = await execFileAsync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" }).catch((error: { stderr?: string }) => ({ stderr: error.stderr || "" }));
  const text = result.stderr || "";
  const durationMatch = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const videoMatch = text.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  if (!durationMatch || !videoMatch) throw new Error("Could not read the trend video's duration or frame size.");
  return {
    duration: Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]),
    width: Number(videoMatch[1]),
    height: Number(videoMatch[2]),
    hasAudio: /Audio:/.test(text),
  };
}
function resultUrl(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const value = data as {
    video?: { url?: unknown };
    videos?: Array<{ url?: unknown }>;
    video_url?: unknown;
    output?: { video?: { url?: unknown }; video_url?: unknown; url?: unknown };
  };
  if (typeof value.video?.url === "string") return value.video.url;
  if (typeof value.videos?.[0]?.url === "string") return value.videos[0].url;
  if (typeof value.video_url === "string") return value.video_url;
  if (typeof value.output?.video?.url === "string") return value.output.video.url;
  if (typeof value.output?.video_url === "string") return value.output.video_url;
  return typeof value.output?.url === "string" ? value.output.url : "";
}

async function start(body: Record<string, unknown>) {
  if (!r2Configured()) throw new Error("Trend remake requires Cloudflare R2 storage.");
  const provider = providerFrom(body.provider);
  if (provider === "higgsfield-genjutsu" && !higgsfieldCredentials()) throw new Error("HF_API_KEY is not configured on the server.");
  if (provider === "fal-minimax" && !process.env.FAL_KEY) throw new Error("FAL_KEY is not configured on the server.");
  const videoUrl = validUrl(body.videoUrl) ? body.videoUrl : "";
  const refs = body.referenceUrls && typeof body.referenceUrls === "object" ? body.referenceUrls as Record<string, unknown> : {};
  const headRefs = body.headReferenceUrls && typeof body.headReferenceUrls === "object" ? body.headReferenceUrls as Record<string, unknown> : {};
  const joe = validUrl(refs.joe) ? refs.joe : "";
  const danda = validUrl(refs.danda) ? refs.danda : "";
  const joeHead = validUrl(headRefs.joe) ? headRefs.joe : "";
  const dandaHead = validUrl(headRefs.danda) ? headRefs.danda : "";
  const captionRegion = captionRegionFrom(body.captionRegion);
  if (!videoUrl) throw new Error("Upload the trend video first.");
  if (!joe || !danda) throw new Error("Upload the full-body Joe and Danda references first.");
  if (provider === "higgsfield-genjutsu" && (!joeHead || !dandaHead)) throw new Error("Genjutsu needs the locked close-up Joe and Danda head references to preserve their exact cartoon identity.");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-trend-start-"));
  try {
    const source = path.join(dir, "source.mp4");
    await download(videoUrl, source);
    const info = await probe(source);
    if (info.duration > 60.1) throw new Error("Keep trend remakes at 60 seconds or less.");
    const plan = balancedTrendSegments(info.duration, provider === "higgsfield-genjutsu" ? 30 : 15);
    const jobKey = `${Date.now()}-${crypto.randomUUID()}`;
    const jobs: TrendJob[] = [];
    for (const part of plan) {
      const clip = path.join(dir, `segment-${part.index}.mp4`);
      await execFileAsync(ffmpeg, ["-y", "-ss", part.start.toFixed(3), "-i", source, "-t", part.duration.toFixed(3), "-map", "0:v:0", "-an", "-vf", sourceVideoFilter(captionRegion), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", clip]);
      const stored = await putR2Object(`relations/trends/${clean(jobKey)}/source-${part.index}.mp4`, await fs.readFile(clip), "video/mp4");
      if (provider === "higgsfield-genjutsu") {
        const response = await fetch(`${HIGGSFIELD_BASE_URL}/${GENJUTSU_ENDPOINT}`, {
          method: "POST",
          headers: {
            Authorization: `Key ${higgsfieldCredentials()}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            prompt: trendPrompt(true),
            video_url: stored.url,
            image_urls: [joeHead, joe, dandaHead, danda],
            resolution: "720p",
          }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Higgsfield: ${await parseHiggsfieldError(response)}`);
        const submission = await response.json() as { request_id?: string };
        if (!submission.request_id) throw new Error("Higgsfield accepted Genjutsu but returned no request_id.");
        jobs.push({ requestId: `hf:${submission.request_id}`, index: part.index, duration: part.duration });
      } else {
        const submission = await fal.queue.submit(TREND_ENDPOINT, { input: {
          prompt: trendPrompt(),
          reference_video_urls: [stored.url],
          reference_image_urls: [joe, danda],
          duration: Math.max(5, Math.min(15, Math.round(part.duration))),
          aspect_ratio: "adaptive",
          resolution: "768P",
          prompt_expansion_mode: "disabled",
          enable_safety_checker: true,
          sync_mode: false,
        }});
        jobs.push({ requestId: submission.request_id, index: part.index, duration: part.duration });
      }
    }
    return { jobs, provider, sourceUrl: videoUrl, totalDuration: info.duration, width: info.width, height: info.height };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function status(request: Request) {
  const provider = providerFrom(new URL(request.url).searchParams.get("provider"));
  const raw = new URL(request.url).searchParams.get("requestIds") || "";
  const requestIds = raw.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 8);
  if (!requestIds.length) throw new Error("No trend-remake jobs were supplied.");
  const segments: Array<{ requestId: string; status: string; url?: string; error?: string }> = [];
  for (const requestId of requestIds) {
    if (provider === "higgsfield-genjutsu" || requestId.startsWith("hf:")) {
      const credentials = higgsfieldCredentials();
      if (!credentials) throw new Error("HF_API_KEY is not configured on the server.");
      const id = requestId.replace(/^hf:/, "");
      const response = await fetch(`${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(id)}/status`, {
        headers: { Authorization: `Key ${credentials}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Higgsfield: ${await parseHiggsfieldError(response)}`);
      const data = await response.json() as { status?: string; error?: { message?: string } | string };
      const state = String(data.status || "queued").toLowerCase();
      if (["failed", "nsfw", "canceled", "cancelled"].includes(state)) {
        const detail = typeof data.error === "string" ? data.error : data.error?.message;
        segments.push({ requestId, status: "FAILED", ...(detail ? { error: detail } : {}) });
        continue;
      }
      if (state !== "completed") {
        segments.push({ requestId, status: state === "in_progress" ? "IN_PROGRESS" : "IN_QUEUE" });
        continue;
      }
      const url = resultUrl(data);
      segments.push(url ? { requestId, status: "COMPLETED", url } : { requestId, status: "FAILED" });
    } else {
      const state = await fal.queue.status(TREND_ENDPOINT, { requestId, logs: true });
      if (String(state.status) === "FAILED") { segments.push({ requestId, status: "FAILED" }); continue; }
      if (state.status !== "COMPLETED") { segments.push({ requestId, status: String(state.status) }); continue; }
      const result = await fal.queue.result(TREND_ENDPOINT, { requestId });
      const url = resultUrl(result.data);
      segments.push(url ? { requestId, status: "COMPLETED", url } : { requestId, status: "FAILED" });
    }
  }
  return { provider, segments };
}

async function finalize(body: Record<string, unknown>) {
  if (!r2Configured()) throw new Error("Trend remake requires Cloudflare R2 storage.");
  const sourceUrl = validUrl(body.sourceUrl) ? body.sourceUrl : "";
  const width = Math.max(2, Math.floor(Number(body.width) || 720) / 2 * 2);
  const height = Math.max(2, Math.floor(Number(body.height) || 1280) / 2 * 2);
  const raw = Array.isArray(body.segments) ? body.segments : [];
  const segments = raw.filter((item: unknown): item is TrendSegment => {
    if (!item || typeof item !== "object") return false;
    const part = item as TrendSegment;
    return validUrl(part.url) && Number.isInteger(part.index) && Number(part.duration) > 0;
  }).sort((a, b) => a.index - b.index);
  if (!sourceUrl || !segments.length) throw new Error("Completed trend-remake sections are required.");
  const totalDuration = segments.reduce((sum, part) => sum + part.duration, 0);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-trend-final-"));
  try {
    const parts: string[] = [];
    for (const part of segments) {
      const input = path.join(dir, `generated-${part.index}.mp4`);
      const output = path.join(dir, `normalized-${part.index}.mp4`);
      await download(part.url, input);
      await execFileAsync(ffmpeg, ["-y", "-i", input, "-vf", `tpad=stop_mode=clone:stop_duration=30,trim=duration=${part.duration.toFixed(3)},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", output]);
      parts.push(output);
    }
    const concat = path.join(dir, "concat.txt");
    await fs.writeFile(concat, parts.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    const silent = path.join(dir, "silent.mp4");
    await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", silent]);
    const original = path.join(dir, "original.mp4");
    await download(sourceUrl, original);
    const info = await probe(original);
    const withAudio = path.join(dir, "with-audio.mp4");
    if (info.hasAudio) {
      await execFileAsync(ffmpeg, ["-y", "-i", silent, "-i", original, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", totalDuration.toFixed(3), "-shortest", "-movflags", "+faststart", withAudio]);
    } else await fs.copyFile(silent, withAudio);
    const key = `${Date.now()}-${crypto.randomUUID()}`;
    const silentStored = await putR2Object(`relations/trends/final/${key}-silent.mp4`, await fs.readFile(silent), "video/mp4");
    const audioStored = await putR2Object(`relations/trends/final/${key}-original-audio.mp4`, await fs.readFile(withAudio), "video/mp4");
    return { url: audioStored.url, withAudioUrl: audioStored.url, silentUrl: silentStored.url, duration: totalDuration };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "finalize" ? "finalize" : "start";
    return NextResponse.json(action === "start" ? await start(body) : await finalize(body));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trend remake failed.") }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return NextResponse.json(await status(request));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Could not check the trend remake.") }, { status: 500 });
  }
}
