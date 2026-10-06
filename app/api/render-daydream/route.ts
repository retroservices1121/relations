import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

type HorizontalPosition = "left" | "center" | "right";
type VerticalPosition = "top" | "middle" | "bottom";

function allowedSource(value: string) {
  try {
    const url = new URL(value);
    const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
    return url.protocol === "https:" && (
      url.hostname === "v3b.fal.media" ||
      Boolean(publicBase && value.startsWith(`${publicBase}/relations/`))
    );
  } catch {
    return false;
  }
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function filterPath(value: string) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function download(url: string, output: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load layered media (${response.status}).`);
  await fs.writeFile(output, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDir = "";

  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: "Cloudflare R2 is required to save the finished video." }, { status: 503 });
    }

    const body = await request.json();
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";
    const dancerUrl = typeof body.dancerUrl === "string" ? body.dancerUrl : "";
    if (!allowedSource(baseUrl) || !allowedSource(dancerUrl)) {
      return NextResponse.json({ error: "Upload both videos through Relations before building the layered export." }, { status: 400 });
    }

    const duration = clamp(body.duration, 2, 15, 8);
    const opacity = clamp(body.opacity, 0.2, 0.8, 0.42);
    const scale = clamp(body.scale, 0.35, 0.9, 0.72);
    const horizontal: HorizontalPosition = ["left", "center", "right"].includes(body.horizontal) ? body.horizontal : "center";
    const vertical: VerticalPosition = ["top", "middle", "bottom"].includes(body.vertical) ? body.vertical : "middle";
    const caption = typeof body.caption === "string"
      ? body.caption.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 120).trim()
      : "";

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-layered-"));
    const basePath = path.join(workDir, "base.mp4");
    const layerPath = path.join(workDir, "layer.mp4");
    const captionPath = path.join(workDir, "caption.txt");
    const outputPath = path.join(workDir, "relations-layered-social.mp4");

    await Promise.all([download(baseUrl, basePath), download(dancerUrl, layerPath)]);
    if (caption) await fs.writeFile(captionPath, caption, "utf8");

    const layerWidth = Math.round((720 * scale) / 2) * 2;
    const x = horizontal === "left" ? "42" : horizontal === "right" ? "W-w-42" : "(W-w)/2";
    const y = vertical === "top" ? "180" : vertical === "bottom" ? "H-h-55" : "(H-h)/2+70";
    const finalFilters = [`[base][ghost]overlay=x=${x}:y=${y}:shortest=1`];
    if (caption) {
      finalFilters.push(`drawtext=textfile='${filterPath(captionPath)}':fontcolor=white:fontsize=44:line_spacing=8:borderw=5:bordercolor=black:x=(w-text_w)/2:y=64`);
    }

    const filter = [
      "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30[base]",
      `[1:v]scale=${layerWidth}:-2,fps=30,colorkey=0x00FF00:0.30:0.10,format=rgba,colorchannelmixer=aa=${opacity.toFixed(2)}[ghost]`,
      `${finalFilters.join(",")}[v]`,
    ].join(";");

    await execFileAsync(ffmpegPath, [
      "-y", "-i", basePath, "-i", layerPath,
      "-filter_complex", filter,
      "-map", "[v]", "-t", String(duration), "-an",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
    ]);

    const stored = await putR2Object(
      `relations/layered-social/final-${Date.now()}.mp4`,
      await fs.readFile(outputPath),
      "video/mp4",
    );

    return NextResponse.json({ url: stored.url, muted: true, duration, opacity, scale, horizontal, vertical });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not render the layered social video." },
      { status: 500 },
    );
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

