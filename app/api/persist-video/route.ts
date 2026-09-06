import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { dbConfigured, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";
import { ensureHouseholdNonsenseTheme } from "@/lib/theme";

export const runtime = "nodejs";
export const maxDuration = 300;
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

function cleanPart(value: string) { return value.replace(/[^a-zA-Z0-9-_]/g, "-"); }
async function downloadFile(url: string, outputPath: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download media (${response.status}).`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let workDir = "";
  try {
    if (!r2Configured()) return NextResponse.json({ error: "Permanent video storage is not configured. Add the R2 environment variables to Railway.", code: "R2_NOT_CONFIGURED" }, { status: 503 });
    if (!dbConfigured()) return NextResponse.json({ error: "Railway Postgres is not configured. Add a Postgres service so DATABASE_URL is available.", code: "DB_NOT_CONFIGURED" }, { status: 503 });
    const body = await request.json();
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const requestId = typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
    const sceneIndex = Number(body.sceneIndex);
    if (!sourceUrl.startsWith("http")) return NextResponse.json({ error: "A valid source video URL is required." }, { status: 400 });
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) return NextResponse.json({ error: "A valid scene index is required." }, { status: 400 });

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-persist-"));
    const sourcePath = path.join(workDir, "source.mp4");
    await downloadFile(sourceUrl, sourcePath);

    const sourceBytes = await fs.readFile(sourcePath);
    const sourceKey = `relations/${cleanPart(episodeId)}/sources/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
    const sourceStored = await putR2Object(sourceKey, sourceBytes, "video/mp4");

    const themeUrl = await ensureHouseholdNonsenseTheme();
    const themePath = path.join(workDir, "theme.wav");
    const mixedPath = path.join(workDir, "mixed.mp4");
    await downloadFile(themeUrl, themePath);

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", sourcePath,
      "-stream_loop", "-1",
      "-i", themePath,
      "-filter_complex", "[0:a]volume=1.0[sfx];[1:a]volume=0.28[music];[sfx][music]amix=inputs=2:duration=first:dropout_transition=0[a]",
      "-map", "0:v:0",
      "-map", "[a]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-shortest",
      "-movflags", "+faststart",
      mixedPath,
    ]);

    const mixedBytes = await fs.readFile(mixedPath);
    const key = `relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
    const stored = await putR2Object(key, mixedBytes, "video/mp4");
    await saveSceneVideo({ episodeId, sceneIndex, videoUrl: stored.url, sourceVideoUrl: sourceStored.url, requestId });
    return NextResponse.json({ url: stored.url, key: stored.key, persisted: true, seedanceSfx: true, lockedTheme: true, sourceUrl: sourceStored.url, themeUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save generated video." }, { status: 500 });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
