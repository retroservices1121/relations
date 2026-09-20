import { NextResponse } from "next/server";
import {
  rewriteEpisodeWithAi,
  screenplayConfigured,
} from "@/lib/screenplay";
import { getSeries } from "@/lib/db";
import { householdNonsenseSeries } from "@/lib/series";

export const runtime = "nodejs";
export const maxDuration = 120;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    if (!screenplayConfigured())
      return NextResponse.json(
        {
          error:
            "The screenplay AI is not configured. Add OPENAI_API_KEY to Railway first.",
        },
        { status: 503 },
      );
    const body = await request.json();
    const revisionNote = text(body.revisionNote);
    const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
    const scenes = rawScenes.map((scene: unknown) => {
      const item = scene && typeof scene === "object" ? scene as Record<string, unknown> : {};
      return { prompt: text(item.prompt), caption: text(item.caption) };
    });
    if (revisionNote.length < 3)
      return NextResponse.json(
        { error: "Tell the screenplay AI what needs to change in the episode." },
        { status: 400 },
      );
    if (scenes.length < 2 || scenes.length > 6 || scenes.some((scene: { prompt: string }) => scene.prompt.length < 10))
      return NextResponse.json(
        { error: "The complete current screenplay is required." },
        { status: 400 },
      );
    const seriesId = text(body.seriesId) || householdNonsenseSeries.id;
    const series = (await getSeries(seriesId)) || householdNonsenseSeries;
    const revisedScenes = await rewriteEpisodeWithAi({
      episodeTitle: text(body.episodeTitle) || "Untitled Episode",
      revisionNote,
      scenes,
      series,
    });
    return NextResponse.json({ scenes: revisedScenes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The screenplay AI could not revise this episode.",
      },
      { status: 500 },
    );
  }
}
