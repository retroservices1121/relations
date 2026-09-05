import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, imageUrls = [], duration = 5, model = "seedance-fast" } = body;

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "A scene prompt is required." }, { status: 400 });
    }

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "At least one Joe or Danda reference image URL is required." }, { status: 400 });
    }

    const endpoint = model === "seedance-standard"
      ? "bytedance/seedance-2.0/reference-to-video"
      : "bytedance/seedance-2.0/fast/reference-to-video";

    const safeDuration = Math.max(4, Math.min(15, Number(duration) || 5));

    const result = await fal.subscribe(endpoint, {
      input: {
        prompt,
        image_urls: imageUrls.slice(0, 9),
        resolution: "720p",
        duration: String(safeDuration),
        aspect_ratio: "9:16",
        generate_audio: true,
        bitrate_mode: "standard",
      },
      logs: true,
    });

    return NextResponse.json({
      requestId: result.requestId,
      videoUrl: result.data.video.url,
      seed: result.data.seed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
