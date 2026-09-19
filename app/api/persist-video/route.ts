import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { associateGenerationRequest, dbConfigured, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const MUSICAL_EPISODE_IDS = new Set(["danda-spider-hero"]);

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

    // Musical episodes are persisted completely silent. Seedance audio is disabled for new generations,
    // and this strip is a second safety layer so an older clip can never carry gibberish speech into the musical workflow.
    if (MUSICAL_EPISODE_IDS.has(episodeId)) {
      const silentPath = path.join(workDir, "silent.mp4");
      await execFileAsync(ffmpegPath, ["-y", "-i", sourcePath, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", silentPath]);
      const silentBytes = await fs.readFile(silentPath);
      const silentKey = `relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
      const stored = await putR2Object(silentKey, silentBytes, "video/mp4");
      await saveSceneVideo({ episodeId, sceneIndex, videoUrl: stored.url, sourceVideoUrl: sourceStored.url, requestId });
      await associateGenerationRequest({ requestId, episodeId, sceneIndex }).catch(() => undefined);
      return NextResponse.json({ url: stored.url, key: stored.key, persisted: true, lockedTheme: false, musicalSilent: true, sourceUrl: sourceStored.url });
    }

    // Store scene audio without the theme. The locked music bed is mixed once, continuously,
    // after every scene has been joined into the final episode.
    const key = `relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
    const stored = await putR2Object(key, sourceBytes, "video/mp4");
    await saveSceneVideo({ episodeId, sceneIndex, videoUrl: stored.url, sourceVideoUrl: sourceStored.url, requestId, themeBaked: false });
    await associateGenerationRequest({ requestId, episodeId, sceneIndex }).catch(() => undefined);
    return NextResponse.json({ url: stored.url, key: stored.key, persisted: true, seedanceSfx: true, lockedTheme: false, themeMixedAtFinal: true, sourceUrl: sourceStored.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save generated video." }, { status: 500 });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
