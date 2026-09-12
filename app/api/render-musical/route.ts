import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { saveFinalVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

async function downloadFile(url: string, outputPath: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download media (${response.status}).`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDir = "";

  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: "Cloudflare R2 is required." }, { status: 503 });
    }

    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl : "";
    const musicUrl = typeof body.musicUrl === "string" ? body.musicUrl : "";

    if (!videoUrl.startsWith("http") || !musicUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "A built episode and generated song are required." },
        { status: 400 },
      );
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-musical-"));
    const videoPath = path.join(workDir, "episode.mp4");
    const musicPath = path.join(workDir, "song.wav");
    const finalPath = path.join(workDir, "musical.mp4");

    await Promise.all([
      downloadFile(videoUrl, videoPath),
      downloadFile(musicUrl, musicPath),
    ]);

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", videoPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-shortest",
      "-movflags", "+faststart",
      finalPath,
    ]);

    const bytes = await fs.readFile(finalPath);
    const key = `relations/${cleanPart(episodeId)}/final/musical-${Date.now()}.mp4`;
    const stored = await putR2Object(key, bytes, "video/mp4");
    await saveFinalVideo(episodeId, stored.url);

    return NextResponse.json({ url: stored.url, key: stored.key, musical: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build musical episode." },
      { status: 500 },
    );
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
