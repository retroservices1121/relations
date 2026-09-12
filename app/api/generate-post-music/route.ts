import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

const ENDPOINT = "fal-ai/stable-audio-3/small/music/text-to-audio";

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }
    if (!r2Configured()) {
      return NextResponse.json({ error: "Cloudflare R2 is required to permanently save generated music." }, { status: 503 });
    }

    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "social-post";
    const duration = Math.max(5, Math.min(120, Number(body.duration) || 15));

    if (!prompt) {
      return NextResponse.json({ error: "Describe the music you want to generate." }, { status: 400 });
    }

    const instrumentalPrompt = `${prompt}\n\nIMPORTANT: Instrumental background music only. No singing, no spoken words, no narration, no chants, no vocal chops, no human voice. Make it clean, catchy, social-media friendly, and suitable underneath a short image or video post.`;

    const result = await fal.subscribe(ENDPOINT, {
      input: {
        prompt: instrumentalPrompt,
        negative_prompt: "vocals, singing, lyrics, spoken words, speech, narration, chanting, choir, vocal chops, human voice",
        duration,
        num_inference_steps: 8,
        guidance_scale: 1,
        enable_prompt_expansion: true,
        enable_safety_checker: true,
        output_format: "mp3",
        bitrate: "192k",
      },
      logs: false,
    });

    const data = result.data as { audio?: { url?: string }; seed?: number; prompt?: string };
    if (!data.audio?.url) throw new Error("Stable Audio completed without returning an audio file.");

    const audioResponse = await fetch(data.audio.url, { cache: "no-store" });
    if (!audioResponse.ok) throw new Error(`Could not download generated audio (${audioResponse.status}).`);
    const bytes = Buffer.from(await audioResponse.arrayBuffer());

    const key = `relations/social-music/${Date.now()}-${cleanPart(title || "social-post")}.mp3`;
    const stored = await putR2Object(key, bytes, "audio/mpeg");

    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      duration,
      seed: data.seed,
      requestId: result.requestId,
      model: ENDPOINT,
      instrumental: true,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate background music." }, { status: 500 });
  }
}
