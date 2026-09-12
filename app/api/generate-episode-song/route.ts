import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 500 });
    if (!r2Configured()) return NextResponse.json({ error: "Cloudflare R2 is required to save episode songs." }, { status: 503 });

    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim() : "";
    // MiniMax Music 3 treats duration as an upper bound and can stop naturally earlier.
    // Give it the model's full 5-minute ceiling so short comedy songs are never cut off
    // by an artificial Studio duration such as 32s or 45s.
    const duration = 300;
    if (!prompt || !lyrics) return NextResponse.json({ error: "Song prompt and lyrics are required." }, { status: 400 });

    const result = await fal.subscribe("minimax/music-3", {
      input: { prompt, lyrics, duration, num_inference_steps: 30, guidance_scale: 1.7 },
      logs: true,
    });
    const data = result.data as { audio?: { url?: string }; duration?: number; seed?: number };
    if (!data.audio?.url) return NextResponse.json({ error: "MiniMax completed without an audio URL." }, { status: 502 });

    const audioResponse = await fetch(data.audio.url, { cache: "no-store" });
    if (!audioResponse.ok) throw new Error(`Could not download generated song (${audioResponse.status}).`);
    const bytes = Buffer.from(await audioResponse.arrayBuffer());
    const key = `relations/${cleanPart(episodeId)}/music/song-${Date.now()}.wav`;
    const stored = await putR2Object(key, bytes, "audio/wav");

    let transcript = "";
    let chunks: unknown[] = [];
    try {
      const transcription = await fal.subscribe("fal-ai/whisper", {
        input: {
          audio_url: stored.url,
          task: "transcribe",
          language: "en",
          chunk_level: "word",
          prompt: lyrics.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim(),
        },
        logs: false,
      });
      const transcriptData = transcription.data as { text?: string; chunks?: unknown[] | null };
      transcript = transcriptData.text || "";
      chunks = Array.isArray(transcriptData.chunks) ? transcriptData.chunks : [];
    } catch {
      // Song generation should still succeed if timestamp transcription is unavailable.
    }

    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      requestId: result.requestId,
      duration: data.duration || duration,
      seed: data.seed,
      model: "minimax/music-3",
      transcript,
      chunks,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate episode song." }, { status: 500 });
  }
}
