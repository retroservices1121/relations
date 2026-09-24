import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";

const ENDPOINT = "fal-ai/kling-video/o1/standard/video-to-video/edit";

type CastKey = "joe" | "danda";

function personDescription(key: CastKey) {
  return key === "joe"
    ? "the adult man in the source video"
    : "the adult woman in the source video";
}

function buildPrompt(cast: CastKey[]) {
  const assignments = cast.map((key, index) => {
    const element = `@Element${index + 1}`;
    return `Replace ONLY the visible head and face of ${personDescription(key)} with the exact cartoon head/face from ${element}.`;
  }).join(" ");

  return `HOUSEHOLD NONSENSE CARTOON FACE EDIT. ${assignments}
Keep the original live-action video composition, camera movement, timing, body motion, hand gestures, clothing, body shape, skin visible below the neck, props, room, lighting, and background unchanged.
The replacement must affect the head/face only. Do not replace, redraw, restyle, or cartoonize the body, clothing, hands, environment, furniture, or camera framing.
Track each assigned person consistently for the entire clip. Never swap identities between people. Preserve head position, head turns, nods, tilts, scale, occlusion, and natural neck attachment from the source performance.
Use the supplied Household Nonsense cartoon reference as the exact character identity and visual design for each replaced head. Keep the cartoon face recognizable and stable from frame to frame.
Match facial expression and mouth movement to the source performance as closely as possible while retaining the cartoon design. Preserve the original audio exactly.
Do not add captions, graphics, logos, extra people, extra heads, duplicate faces, masks, hats, or accessories unless already present in the source video. Do not alter the duration or pacing.`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }
    const body = await request.json();
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const cast = Array.isArray(body.cast)
      ? body.cast.filter((value: unknown): value is CastKey => value === "joe" || value === "danda")
      : [];
    const referenceUrls = body.referenceUrls && typeof body.referenceUrls === "object"
      ? body.referenceUrls as Record<string, string>
      : {};

    if (!videoUrl) return NextResponse.json({ error: "Upload a recorded video first." }, { status: 400 });
    if (!cast.length || cast.length > 2) return NextResponse.json({ error: "Choose Joe, Danda, or both." }, { status: 400 });

    const elements = cast.map((key) => {
      const url = (referenceUrls[key] || "").trim();
      if (!url) throw new Error(`The locked ${key === "joe" ? "Joe" : "Danda"} reference is missing.`);
      return { frontal_image_url: url, reference_image_urls: [url] };
    });

    const submission = await fal.queue.submit(ENDPOINT, {
      input: {
        prompt: buildPrompt(cast),
        video_url: videoUrl,
        keep_audio: true,
        elements,
      },
    });

    return NextResponse.json({ requestId: submission.request_id, endpoint: ENDPOINT });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cartoon face generation failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }
    const requestId = new URL(request.url).searchParams.get("requestId") || "";
    if (!requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });

    const status = await fal.queue.status(ENDPOINT, { requestId, logs: true });
    if (status.status !== "COMPLETED") {
      if (status.status === "FAILED") {
        return NextResponse.json({ status: "FAILED", error: "The video edit failed at the provider." }, { status: 500 });
      }
      return NextResponse.json({ status: status.status });
    }

    const result = await fal.queue.result(ENDPOINT, { requestId });
    const data = result.data as { video?: { url?: string } };
    if (!data.video?.url) throw new Error("The provider completed without returning a video.");
    return NextResponse.json({ status: "COMPLETED", videoUrl: data.video.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not check cartoon face generation." },
      { status: 500 },
    );
  }
}
