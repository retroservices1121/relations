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

type SceneInput = { videoUrl?: unknown };
type TimingInput = { start?: unknown; end?: unknown };

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
    if (!r2Configured()) return NextResponse.json({ error: "Cloudflare R2 is required." }, { status: 503 });

    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const musicUrl = typeof body.musicUrl === "string" ? body.musicUrl : "";
    const songDuration = Number(body.songDuration);
    const scenes = Array.isArray(body.scenes) ? body.scenes as SceneInput[] : [];
    const timings = Array.isArray(body.timings) ? body.timings as TimingInput[] : [];

    if (!musicUrl.startsWith("http")) return NextResponse.json({ error: "A generated episode song is required." }, { status: 400 });
    if (!Number.isFinite(songDuration) || songDuration <= 0) return NextResponse.json({ error: "A valid song duration is required." }, { status: 400 });
    if (!scenes.length || scenes.length !== timings.length) return NextResponse.json({ error: "Every musical scene needs a matching timestamp range." }, { status: 400 });

    const sceneUrls = scenes.map((scene) => typeof scene.videoUrl === "string" ? scene.videoUrl : "");
    if (sceneUrls.some((url) => !url.startsWith("http"))) return NextResponse.json({ error: "Every musical scene must be permanently saved before rendering." }, { status: 400 });

    const durations = timings.map((timing) => Number(timing.end) - Number(timing.start));
    if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0 || duration > 15)) {
      return NextResponse.json({ error: "Each musical scene timestamp must be greater than 0 and no longer than 15 seconds." }, { status: 400 });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-musical-"));
    const musicPath = path.join(workDir, "song.wav");
    await downloadFile(musicUrl, musicPath);

    const renderedParts: string[] = [];
    for (let index = 0; index < sceneUrls.length; index += 1) {
      const inputPath = path.join(workDir, `scene-${index}.mp4`);
      const outputPath = path.join(workDir, `part-${index}.mp4`);
      await downloadFile(sceneUrls[index], inputPath);
      const exactDuration = durations[index].toFixed(3);
      await execFileAsync(ffmpegPath, [
        "-y",
        "-i", inputPath,
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=3",
        "-t", exactDuration,
        "-an",
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.0",
        "-preset", "veryfast",
        "-crf", "20",
        "-r", "30",
        "-movflags", "+faststart",
        outputPath,
      ]);
      renderedParts.push(outputPath);
    }

    const concatFile = path.join(workDir, "concat.txt");
    await fs.writeFile(concatFile, renderedParts.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    const joinedPath = path.join(workDir, "joined.mp4");
    await execFileAsync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", joinedPath]);

    const finalPath = path.join(workDir, "musical.mp4");
    await execFileAsync(ffmpegPath, [
      "-y",
      "-fflags", "+genpts",
      "-i", joinedPath,
      "-i", musicPath,
      "-t", songDuration.toFixed(3),
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "libx264",
      "-profile:v", "high",
      "-level", "4.0",
      "-preset", "medium",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-vsync", "cfr",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-avoid_negative_ts", "make_zero",
      "-movflags", "+faststart",
      finalPath,
    ]);

    const bytes = await fs.readFile(finalPath);
    const key = `relations/${cleanPart(episodeId)}/final/musical-${Date.now()}.mp4`;
    const stored = await putR2Object(key, bytes, "video/mp4");
    await saveFinalVideo(episodeId, stored.url);
    return NextResponse.json({ url: stored.url, key: stored.key, musical: true, songFirst: true, songDuration });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build musical episode." }, { status: 500 });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
