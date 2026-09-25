import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { putR2Object, r2Configured } from "@/lib/r2";
import { balancedTrendSegments, TREND_ENDPOINT, trendPrompt, type TrendJob, type TrendSegment } from "@/lib/trend-remake";

fal.config({ credentials: process.env.FAL_KEY });
export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

function clean(value: string) { return value.replace(/[^a-zA-Z0-9-_]/g, "-"); }
function validUrl(value: unknown): value is string { return typeof value === "string" && /^https:\/\//.test(value); }
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
  const value = data as { video?: { url?: unknown }; videos?: Array<{ url?: unknown }>; video_url?: unknown };
  if (typeof value.video?.url === "string") return value.video.url;
  if (typeof value.videos?.[0]?.url === "string") return value.videos[0].url;
  return typeof value.video_url === "string" ? value.video_url : "";
}

async function start(body: Record<string, unknown>) {
  if (!r2Configured()) throw new Error("Trend remake requires Cloudflare R2 storage.");
  const videoUrl = validUrl(body.videoUrl) ? body.videoUrl : "";
  const refs = body.referenceUrls && typeof body.referenceUrls === "object" ? body.referenceUrls as Record<string, unknown> : {};
  const joe = validUrl(refs.joe) ? refs.joe : "";
  const danda = validUrl(refs.danda) ? refs.danda : "";
  if (!videoUrl) throw new Error("Upload the trend video first.");
  if (!joe || !danda) throw new Error("Upload the full-body Joe and Danda references first.");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-trend-start-"));
  try {
    const source = path.join(dir, "source.mp4");
    await download(videoUrl, source);
    const info = await probe(source);
    if (info.duration > 60.1) throw new Error("Keep trend remakes at 60 seconds or less.");
    const plan = balancedTrendSegments(info.duration);
    const jobKey = `${Date.now()}-${crypto.randomUUID()}`;
    const jobs: TrendJob[] = [];
    for (const part of plan) {
      const clip = path.join(dir, `segment-${part.index}.mp4`);
      await execFileAsync(ffmpeg, ["-y", "-ss", part.start.toFixed(3), "-i", source, "-t", part.duration.toFixed(3), "-map", "0:v:0", "-an", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", clip]);
      const stored = await putR2Object(`relations/trends/${clean(jobKey)}/source-${part.index}.mp4`, await fs.readFile(clip), "video/mp4");
      const submission = await fal.queue.submit(TREND_ENDPOINT, { input: {
        prompt: trendPrompt(), task: "editing", video_urls: [stored.url], image_urls: [joe, danda],
        duration: "auto", aspect_ratio: "auto", resolution: "720p", codec: "H264",
        bitrate_mode: "high", generate_audio: false,
      }});
      jobs.push({ requestId: submission.request_id, index: part.index, duration: part.duration });
    }
    return { jobs, sourceUrl: videoUrl, totalDuration: info.duration, width: info.width, height: info.height };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function status(request: Request) {
  const raw = new URL(request.url).searchParams.get("requestIds") || "";
  const requestIds = raw.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 8);
  if (!requestIds.length) throw new Error("No trend-remake jobs were supplied.");
  const segments: Array<{ requestId: string; status: string; url?: string }> = [];
  for (const requestId of requestIds) {
    const state = await fal.queue.status(TREND_ENDPOINT, { requestId, logs: true });
    if (String(state.status) === "FAILED") { segments.push({ requestId, status: "FAILED" }); continue; }
    if (state.status !== "COMPLETED") { segments.push({ requestId, status: String(state.status) }); continue; }
    const result = await fal.queue.result(TREND_ENDPOINT, { requestId });
    const url = resultUrl(result.data);
    segments.push(url ? { requestId, status: "COMPLETED", url } : { requestId, status: "FAILED" });
  }
  return { segments };
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
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "finalize" ? "finalize" : "start";
    return NextResponse.json(action === "start" ? await start(body) : await finalize(body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trend remake failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    return NextResponse.json(await status(request));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check the trend remake." }, { status: 500 });
  }
}
