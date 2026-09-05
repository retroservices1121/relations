import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

const AUDIO_PROMPT = `Create a lively finished soundtrack for a short hand-drawn 2D relationship-comedy cartoon. Include light playful INSTRUMENTAL background music, subtle room/environment ambience, and synchronized cartoon sound effects that match every visible action: footsteps, clothing movement, doors, objects, phone taps, clock ticks, whooshes, pops, swishes, comedic stings and reaction accents when visually appropriate. ABSOLUTELY NO HUMAN VOICES, NO SPEECH, NO DIALOGUE, NO WORDS, NO WHISPERS, NO MUMBLING, NO VOCALS, NO SINGING, NO CHANTING, NO LAUGHTER VOICES, NO BACKGROUND CONVERSATION, NO NARRATION, NO GIBBERISH. Instrumental music and non-vocal sound effects only.`;
const NEGATIVE_PROMPT = "human voice, speech, dialogue, talking, words, whispering, mumbling, vocals, singing, chanting, narration, background conversation, gibberish, spoken reactions";

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
    if (!videoUrl.startsWith("http")) return NextResponse.json({ error: "A saved scene video URL is required." }, { status: 400 });

    const result = await fal.subscribe("fal-ai/mmaudio-v2", {
      input: { video_url: videoUrl, prompt: AUDIO_PROMPT, negative_prompt: NEGATIVE_PROMPT, duration, num_steps: 25, cfg_strength: 6 },
      logs: false,
    });
    const data = result.data as { video?: { url?: string } };
    if (!data.video?.url) return NextResponse.json({ error: "MMAudio completed without returning a video." }, { status: 502 });

    const response = await fetch(data.video.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not download MMAudio result (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const key = `relations/${cleanPart(episodeId)}/soundtracks/scene-${sceneIndex + 1}-${Date.now()}.mp4`;
    const stored = await putR2Object(key, bytes, "video/mp4");
    return NextResponse.json({ url: stored.url, key: stored.key, requestId: result.requestId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate the scene soundtrack." }, { status: 500 });
  }
}
