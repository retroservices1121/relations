import { NextResponse } from "next/server";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { dbConfigured, saveFinalVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

type OverlayPosition = "top" | "middle" | "bottom";
type TimedOverlay = { text: string; start: number; end: number; position: OverlayPosition };
type RenderScene = {
  videoUrl: string;
  text?: string;
  position?: OverlayPosition;
  start?: number;
  end?: number;
};

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[char] || char));
}

function wrapText(text: string, maxChars = 26) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function parseTimedOverlays(scene: RenderScene): TimedOverlay[] {
  const text = (scene.text || "").trim();
  if (!text) return [];
  const position = scene.position || "bottom";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: TimedOverlay[] = [];
  const timedPattern = /^\[(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(timedPattern);
    if (!match) {
      const start = Math.max(0, Number(scene.start) || 0);
      const endValue = Number(scene.end);
      const end = Number.isFinite(endValue) && endValue > start ? endValue : 999;
      return [{ text, position, start, end }];
    }
    const start = Math.max(0, Number(match[1]));
    const end = Number(match[2]);
    if (!Number.isFinite(end) || end <= start) continue;
    parsed.push({ text: match[3].trim(), position, start, end });
  }
  return parsed;
}

async function makeOverlayPng(text: string, position: OverlayPosition, outputPath: string) {
  const lines = wrapText(text);
  const lineHeight = 68;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const centerY = position === "top" ? 190 : position === "middle" ? 640 : 1080;
  const startY = centerY - totalHeight / 2 + 48;
  const tspans = lines
    .map((line, index) => `<tspan x="360" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `
    <svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
      <rect width="720" height="1280" fill="transparent"/>
      <text x="360" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="800" fill="white" stroke="black" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${tspans}</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function downloadFile(url: string, outputPath: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download scene video (${response.status}).`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

function isRenderScene(scene: unknown): scene is RenderScene {
  if (!scene || typeof scene !== "object") return false;
  const candidate = scene as { videoUrl?: unknown };
  return typeof candidate.videoUrl === "string" && candidate.videoUrl.startsWith("http");
}

export async function POST(request: Request) {
  let workDir = "";
  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: "Final export requires Cloudflare R2. Add the R2 environment variables to Railway." }, { status: 503 });
    }
    if (!dbConfigured()) {
      return NextResponse.json({ error: "Final export requires Railway Postgres. DATABASE_URL is not configured." }, { status: 503 });
    }

    const body: unknown = await request.json();
    const payload = body && typeof body === "object" ? (body as { episodeId?: unknown; scenes?: unknown }) : {};
    const episodeId = typeof payload.episodeId === "string" ? payload.episodeId : "episode";
    const rawScenes: unknown[] = Array.isArray(payload.scenes) ? payload.scenes : [];
    const scenes: RenderScene[] = rawScenes.filter(isRenderScene);

    if (!scenes.length) {
      return NextResponse.json({ error: "At least one saved scene is required." }, { status: 400 });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-render-"));
    const renderedParts: string[] = [];

    for (let index = 0; index < scenes.length; index += 1) {
      const scene = scenes[index];
      const inputPath = path.join(workDir, `input-${index}.mp4`);
      const outputPath = path.join(workDir, `part-${index}.mp4`);
      await downloadFile(scene.videoUrl, inputPath);

      const timedOverlays = parseTimedOverlays(scene);
      if (timedOverlays.length) {
        const overlayPaths: string[] = [];
        for (let overlayIndex = 0; overlayIndex < timedOverlays.length; overlayIndex += 1) {
          const overlayPath = path.join(workDir, `overlay-${index}-${overlayIndex}.png`);
          await makeOverlayPng(timedOverlays[overlayIndex].text, timedOverlays[overlayIndex].position, overlayPath);
          overlayPaths.push(overlayPath);
        }

        const args = ["-y", "-i", inputPath];
        for (const overlayPath of overlayPaths) args.push("-loop", "1", "-i", overlayPath);

        const filters = ["[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[v0]"];
        timedOverlays.forEach((overlay, overlayIndex) => {
          const inputLabel = overlayIndex === 0 ? "[v0]" : `[v${overlayIndex}]`;
          const outputLabel = overlayIndex === timedOverlays.length - 1 ? "[v]" : `[v${overlayIndex + 1}]`;
          filters.push(`${inputLabel}[${overlayIndex + 1}:v]overlay=0:0:enable='between(t,${overlay.start},${overlay.end})'${outputLabel}`);
        });

        args.push(
          "-filter_complex", filters.join(";"),
          "-map", "[v]", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-shortest", "-movflags", "+faststart", outputPath,
        );
        await execFileAsync(ffmpegPath, args);
      } else {
        await execFileAsync(ffmpegPath, [
          "-y", "-i", inputPath,
          "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
          "-map", "0:v:0", "-map", "0:a?",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-movflags", "+faststart", outputPath,
        ]);
      }

      renderedParts.push(outputPath);
    }

    const concatFile = path.join(workDir, "concat.txt");
    await fs.writeFile(concatFile, renderedParts.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    const finalPath = path.join(workDir, "final.mp4");

    await execFileAsync(ffmpegPath, [
      "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
      "-c", "copy", "-movflags", "+faststart", finalPath,
    ]);

    const finalBytes = await fs.readFile(finalPath);
    const key = `relations/${cleanPart(episodeId)}/final/final-${Date.now()}.mp4`;
    const stored = await putR2Object(key, finalBytes, "video/mp4");
    await saveFinalVideo(episodeId, stored.url);

    return NextResponse.json({ url: stored.url, key: stored.key, rendered: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not render final episode.";
    const friendly = message.includes("ENOENT") && message.includes("ffmpeg")
      ? "FFmpeg is not installed in the Railway deploy image. Add RAILPACK_DEPLOY_APT_PACKAGES=ffmpeg to the Relations service variables and redeploy."
      : message;
    return NextResponse.json({ error: friendly }, { status: 500 });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
