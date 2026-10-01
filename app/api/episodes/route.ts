import { NextRequest, NextResponse } from "next/server";
import { createCustomEpisode, getSeries, listCustomEpisodes } from "../../../lib/db";
import {
  screenplayConfigured,
  writeEpisodeScreenplay,
} from "../../../lib/screenplay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function campaignBrief(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const campaign = value as Record<string, unknown>;
  const objectiveLabels: Record<string, string> = {
    "episode-promo": "promote a specific episode",
    "series-awareness": "build awareness of the recurring series",
    "audience-growth": "earn follows from new viewers",
    launch: "announce a launch or new release",
    retention: "bring existing viewers back for another episode",
  };
  const channelLabels: Record<string, string> = {
    "vertical-social": "TikTok, Instagram Reels, or YouTube Shorts",
    youtube: "YouTube, using the series' configured aspect ratio",
    "paid-social": "a paid social placement",
    "landing-page": "a landing-page hero video",
  };
  const objective = clean(campaign.objective);
  const channel = clean(campaign.channel);
  const audience = clean(campaign.audience);
  const callToAction = clean(campaign.callToAction);
  return [
    `Campaign objective: ${objectiveLabels[objective] || "promote the series"}.`,
    `Primary channel: ${channelLabels[channel] || "vertical social video"}.`,
    audience
      ? `Audience: ${audience}.`
      : "Audience: viewers likely to recognize the series' relationship comedy.",
    callToAction
      ? `Approved call to action: ${callToAction}.`
      : "Call to action: invite the viewer to watch or follow without inventing an offer.",
  ].join("\n");
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
    const requestedMode = clean(body.mode);
    const mode = requestedMode === "script"
      ? "script"
      : requestedMode === "marketing"
        ? "marketing"
        : "story";
    const seriesId = clean(body.seriesId) || "household-nonsense";
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
    const screenplay = await writeEpisodeScreenplay({
      premise:
        mode === "marketing"
          ? `${campaignBrief(body.campaign)}\n\nCreative brief:\n${prompt}`
          : prompt,
      mode,
      series,
    });
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
