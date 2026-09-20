import { NextResponse } from "next/server";
import { rewriteSceneWithAi, screenplayConfigured } from "@/lib/screenplay";
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
    const currentPrompt = text(body.currentPrompt);
    const revisionNote = text(body.revisionNote);
    if (currentPrompt.length < 10)
      return NextResponse.json(
        { error: "The current scene instruction is required." },
        { status: 400 },
      );
    if (revisionNote.length < 3)
      return NextResponse.json(
        { error: "Tell the screenplay AI what needs to change in this scene." },
        { status: 400 },
      );
    const sceneIndex = Math.max(0, Number(body.sceneIndex) || 0);
    const totalScenes = Math.max(sceneIndex + 1, Number(body.totalScenes) || 1);
    const seriesId = text(body.seriesId) || householdNonsenseSeries.id;
    const series = (await getSeries(seriesId)) || householdNonsenseSeries;
    const prompt = await rewriteSceneWithAi({
      episodeTitle: text(body.episodeTitle) || "Untitled Episode",
      sceneIndex,
      totalScenes,
      currentPrompt,
      previousPrompt: text(body.previousPrompt),
      nextPrompt: text(body.nextPrompt),
      revisionNote,
      series,
    });
    return NextResponse.json({ prompt });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The screenplay AI could not revise this scene.",
      },
      { status: 500 },
    );
  }
}
