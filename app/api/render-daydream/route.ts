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

function allowedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "v3b.fal.media";
  } catch {
    return false;
  }
}

async function download(url: string, output: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load generated media (${response.status}).`);
  await fs.writeFile(output, Buffer.from(await response.arrayBuffer()));
}

export async function GET(request: Request) {
  let workDir = "";

  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: "Cloudflare R2 is required to save the finished video." }, { status: 503 });
    }

    const params = new URL(request.url).searchParams;
    const baseUrl = params.get("base") || "";
    const dancerUrl = params.get("dancer") || "";

    if (!allowedSource(baseUrl) || !allowedSource(dancerUrl)) {
      return NextResponse.json({ error: "Valid fal video URLs are required." }, { status: 400 });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-daydream-"));
    const basePath = path.join(workDir, "base.mp4");
    const dancerPath = path.join(workDir, "dancer.mp4");
    const outputPath = path.join(workDir, "household-nonsense-finance-daydream.mp4");

    await Promise.all([
      download(baseUrl, basePath),
      download(dancerUrl, dancerPath),
    ]);

    const filter = [
      "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30[base]",
      "[1:v]scale=520:-2,fps=30,colorkey=0x00FF00:0.30:0.10,format=rgba,colorchannelmixer=aa=0.42[ghost]",
      [
        "[base][ghost]overlay=x=(W-w)/2:y=(H-h)/2+80:shortest=1",
        "drawtext=text='My brain anytime he starts':fontcolor=white:fontsize=44:borderw=5:bordercolor=black:x=(w-text_w)/2:y=70",
        "drawtext=text='talking about finances':fontcolor=white:fontsize=44:borderw=5:bordercolor=black:x=(w-text_w)/2:y=125[v]",
      ].join(","),
    ].join(";");

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      basePath,
      "-i",
      dancerPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-t",
      "8",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const stored = await putR2Object(
      `relations/prototypes/finance-daydream-${Date.now()}.mp4`,
      await fs.readFile(outputPath),
      "video/mp4",
    );

    if (params.get("open") === "1") return NextResponse.redirect(stored.url);
    return NextResponse.json({ url: stored.url, muted: true, duration: 8 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not render the daydream video." },
      { status: 500 },
    );
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = new URL(request.url);
  url.searchParams.set("base", typeof body.baseUrl === "string" ? body.baseUrl : "");
  url.searchParams.set("dancer", typeof body.dancerUrl === "string" ? body.dancerUrl : "");
  return GET(new Request(url));
}

