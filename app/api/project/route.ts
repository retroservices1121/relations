import { NextResponse } from "next/server";
import { dbConfigured, loadProject, saveOverlay, clearFinalVideo } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!dbConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get("episodeId") || "";
    if (!episodeId) return NextResponse.json({ error: "episodeId is required." }, { status: 400 });

    const project = await loadProject(episodeId);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load project." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!dbConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "";
    if (!episodeId) return NextResponse.json({ error: "episodeId is required." }, { status: 400 });

    if (body.action === "clear-final") {
      await clearFinalVideo(episodeId);
      return NextResponse.json({ ok: true });
    }

    const sceneIndex = Number(body.sceneIndex);
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
      return NextResponse.json({ error: "A valid scene index is required." }, { status: 400 });
    }

    const position = ["top", "middle", "bottom"].includes(body.position) ? body.position : "bottom";
    await saveOverlay({
      episodeId,
      sceneIndex,
      text: typeof body.text === "string" ? body.text : "",
      position,
      start: Number.isFinite(Number(body.start)) ? Number(body.start) : 0,
      end: Number.isFinite(Number(body.end)) ? Number(body.end) : 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save project." },
      { status: 500 },
    );
  }
}
