import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const ENDPOINT = "fal-ai/nano-banana-pro/edit";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not build the stable scene frame.";
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY)
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });

    const body = await request.json();
    const imageUrls: string[] = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((value: unknown): value is string => typeof value === "string" && /^https?:\/\//.test(value))
      : [];
    const characterNames: string[] = Array.isArray(body.characterNames)
      ? body.characterNames.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const aspectRatio = body.aspectRatio === "16:9" ? "16:9" : "9:16";
    if (!prompt || imageUrls.length < 1)
      return NextResponse.json({ error: "A scene instruction and locked character references are required." }, { status: 400 });

    const map = imageUrls.map((_, index) => `Image ${index + 1} is the exact approved design for ${characterNames[index] || `character ${index + 1}`}.`).join(" ");
    const submission = await fal.queue.submit(ENDPOINT, {
      input: {
        image_urls: imageUrls,
        prompt: `Create one production storyboard frame for an animated episode. ${map}

Preserve every supplied character exactly: same face, hair, body proportions, clothing identity, line work, and color palette. Place only those characters in one coherent scene. Do not show a reference sheet, collage, split screen, duplicated character, captions, text, logo, watermark, or interface. This image will be the exact first frame of a video, so use a clear stable composition and show the starting pose described below.

SERIES VISUAL STYLE: ${typeof body.visualStyle === "string" ? body.visualStyle : "Match the approved references exactly."}

SCENE DIRECTION:
${prompt}`,
        aspect_ratio: aspectRatio,
        resolution: "1K",
        output_format: "png",
        num_images: 1,
        limit_generations: true,
        enable_web_search: false,
      },
    });
    return NextResponse.json({ requestId: submission.request_id, status: "queued" });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY)
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    const requestId = new URL(request.url).searchParams.get("requestId");
    if (!requestId)
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    const status = await fal.queue.status(ENDPOINT, { requestId, logs: true });
    if (status.status !== "COMPLETED")
      return NextResponse.json({ requestId, status: status.status });
    const result = await fal.queue.result(ENDPOINT, { requestId });
    const data = result.data as { images?: Array<{ url?: string }> };
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl)
      return NextResponse.json({ error: "The stable frame completed without an image." }, { status: 502 });
    return NextResponse.json({ requestId, status: "COMPLETED", imageUrl });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

