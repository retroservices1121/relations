import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

function endpointFor(model: string) {
  return model === "seedance-standard"
    ? "bytedance/seedance-2.0/reference-to-video"
    : "bytedance/seedance-2.0/fast/reference-to-video";
}

function readableError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const maybe = error as { message?: string; body?: unknown; response?: { data?: unknown } };
    const details = maybe.body ?? maybe.response?.data;
    if (details) {
      try {
        return `${maybe.message || fallback}: ${JSON.stringify(details)}`;
      } catch {
        return maybe.message || fallback;
      }
    }
    if (maybe.message) return maybe.message;
  }
  return fallback;
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }

    const body = await request.json();
    const { prompt, imageUrls = [], duration = 5, model = "seedance-fast" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "A scene prompt is required." }, { status: 400 });
    }

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "At least one Joe or Danda reference image URL is required." }, { status: 400 });
    }

    const endpoint = endpointFor(model);
    const safeDuration = Math.max(4, Math.min(15, Number(duration) || 5));

    const submission = await fal.queue.submit(endpoint, {
      input: {
        prompt,
        image_urls: imageUrls.slice(0, 9),
        resolution: "720p",
        duration: String(safeDuration),
        aspect_ratio: "9:16",
        generate_audio: true,
        bitrate_mode: "standard",
      },
    });

    return NextResponse.json({ requestId: submission.request_id, model, status: "queued" });
  } catch (error) {
    return NextResponse.json({ error: readableError(error, "Video generation failed.") }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const model = searchParams.get("model") || "seedance-fast";

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    const endpoint = endpointFor(model);
    const status = await fal.queue.status(endpoint, { requestId, logs: true });

    if (status.status !== "COMPLETED") {
      return NextResponse.json({ requestId, status: status.status, logs: "logs" in status ? status.logs : undefined });
    }

    const result = await fal.queue.result(endpoint, { requestId });
    const data = result.data as { video?: { url?: string }; seed?: number };

    if (!data.video?.url) {
      return NextResponse.json({ error: "Generation completed but no video URL was returned." }, { status: 502 });
    }

    return NextResponse.json({ requestId, status: "COMPLETED", videoUrl: data.video.url, seed: data.seed });
  } catch (error) {
    return NextResponse.json({ error: readableError(error, "Could not check video generation status.") }, { status: 500 });
  }
}
