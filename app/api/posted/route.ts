import { NextResponse } from "next/server";
import { dbConfigured, setEpisodePosted } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!dbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId.trim() : "";
    const posted = body.posted === true;
    if (!episodeId) return NextResponse.json({ error: "episodeId is required." }, { status: 400 });
    await setEpisodePosted(episodeId, posted);
    return NextResponse.json({ episodeId, posted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update posted status." }, { status: 500 });
  }
}
