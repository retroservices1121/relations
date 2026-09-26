import { NextRequest, NextResponse } from "next/server";
import { createCustomEpisode, deleteUnproducedEpisode, getSeries, listCustomEpisodes } from "../../../lib/db";
import {
  screenplayConfigured,
  writeEpisodeScreenplay,
} from "../../../lib/screenplay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    return NextResponse.json({
      episodes: await listCustomEpisodes(),
      screenplayAiConfigured: screenplayConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load episodes.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = clean(body.prompt);
    const mode = body.mode === "script" ? "script" : "idea";
    const seriesId = clean(body.seriesId);
    if (!seriesId) return NextResponse.json({ error: "Select a series before creating an episode." }, { status: 400 });
    if (prompt.length < 10)
      return NextResponse.json(
        { error: "Give the screenplay AI a little more detail first." },
        { status: 400 },
      );
    if (!screenplayConfigured()) {
      return NextResponse.json(
        {
          error:
            "The screenplay AI is not configured. Add OPENAI_API_KEY to Railway before creating an episode.",
        },
        { status: 503 },
      );
    }
    const series = await getSeries(seriesId);
    if (!series) return NextResponse.json({ error: "The selected series could not be found." }, { status: 404 });
    if (!series.characters.length) return NextResponse.json({ error: "Add at least one character to the series before writing an episode." }, { status: 409 });
    const screenplay = await writeEpisodeScreenplay({ premise: prompt, mode, series });
    const requestedTitle = clean(body.title);
    const episode = await createCustomEpisode({
      title: requestedTitle || screenplay.title,
      hook: screenplay.hook,
      sourcePrompt: prompt,
      inputMode: mode,
      scenes: screenplay.scenes,
      seriesId,
    });
    return NextResponse.json({ episode, plannedBy: "screenplay-ai" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The screenplay AI could not create this episode.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const episodeId = new URL(request.url).searchParams.get("episodeId") || "";
    if (!/^custom-[a-zA-Z0-9_-]{1,110}$/.test(episodeId)) return NextResponse.json({ error: "Select a queued episode you created." }, { status: 400 });
    const result = await deleteUnproducedEpisode(episodeId);
    if (result === "missing") return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    if (result === "produced") return NextResponse.json({ error: "This episode already has production work. It cannot be deleted from the queue." }, { status: 409 });
    return NextResponse.json({ deleted: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete episode." }, { status: 500 }); }
}
