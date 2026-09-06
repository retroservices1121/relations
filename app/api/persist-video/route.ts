import { NextResponse } from "next/server";
import { dbConfigured, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

function cleanPart(value: string) { return value.replace(/[^a-zA-Z0-9-_]/g, "-"); }

export async function POST(request: Request) {
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

    const source = await fetch(sourceUrl, { cache: "no-store" });
    if (!source.ok) return NextResponse.json({ error: `Could not download generated video (${source.status}).` }, { status: 502 });
    const bytes = new Uint8Array(await source.arrayBuffer());
    const key = `relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
    const stored = await putR2Object(key, bytes, "video/mp4");
    await saveSceneVideo({ episodeId, sceneIndex, videoUrl: stored.url, sourceVideoUrl: stored.url, requestId });
    return NextResponse.json({ url: stored.url, key: stored.key, persisted: true, nativeAudio: true, sourceUrl: stored.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save generated video." }, { status: 500 });
  }
}
