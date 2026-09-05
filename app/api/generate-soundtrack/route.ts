import { NextResponse } from "next/server";
import { dbConfigured, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";
import { generateSoundtrackedVideo } from "@/lib/soundtrack";

export const runtime = "nodejs";
export const maxDuration = 300;

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    if (!r2Configured()) return NextResponse.json({ error: "Cloudflare R2 is required to save generated soundtracks." }, { status: 503 });

    const body = await request.json();
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl : "";
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const sceneIndex = Math.max(0, Number(body.sceneIndex) || 0);
    const duration = Math.max(1, Math.min(30, Number(body.duration) || 5));
    const requestId = typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
    if (!videoUrl.startsWith("http")) return NextResponse.json({ error: "A saved scene video URL is required." }, { status: 400 });

    const soundtrack = await generateSoundtrackedVideo(videoUrl, duration);
    const response = await fetch(soundtrack.videoUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not download MMAudio result (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const key = `relations/${cleanPart(episodeId)}/soundtracks/scene-${sceneIndex + 1}-${Date.now()}.mp4`;
    const stored = await putR2Object(key, bytes, "video/mp4");

    if (dbConfigured()) {
      await saveSceneVideo({ episodeId, sceneIndex, videoUrl: stored.url, requestId });
    }

    return NextResponse.json({ url: stored.url, key: stored.key, requestId: soundtrack.requestId, persisted: dbConfigured() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate the scene soundtrack." }, { status: 500 });
  }
}
