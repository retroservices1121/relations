import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const LOCKED_VISUAL_DIRECTION = `FINAL VISUAL DIRECTION OVERRIDES ANY CONFLICTING STYLE LANGUAGE BELOW.

CHARACTER IDENTITY IS THE HIGHEST PRIORITY. @Image1 is Joe and @Image2 is Danda. Treat these as exact recurring character model references, not loose inspiration. Preserve the SAME recognizable face shape, eye shape, eyebrows, nose, mouth, hairstyle, beard shape, skin tone, body proportions and clothing identity from the approved references. Do not redesign, beautify, age-shift, de-age, stylize into a new person, change ethnicity, change facial proportions or substitute a generic cartoon man or woman. Joe and Danda must remain immediately recognizable from their approved reference images in every frame.

Joe is an early-40s man with short dark hair, a full neatly trimmed dark beard, and an average slightly stocky everyday-dad build. Joe must never become muscular, athletic, broad-chested or physically defined. Danda is an early-40s woman with long dark brown hair with warm highlights and normal adult proportions. Danda is only moderately shorter than Joe; standing together, the top of her head is approximately around Joe's eye or eyebrow level. Never make her tiny, miniature, child-sized or disproportionately small.

VISUAL STYLE IS STRICTLY LOCKED: simple hand-drawn 2D internet cartoon comedy. Thick clean black outlines around characters and important props. Flat solid color fills. Minimal simple cel shading only when necessary. Slightly oversized cartoon heads, large expressive eyes, simple rounded facial features, simplified hands and feet, intentionally basic anatomy, readable silhouettes and a playful drawn-cartoon appearance. Keep the same simple character construction from the approved references in every frame.

BACKGROUND STYLE IS LOCKED: simple functional 2D backgrounds with large flat color areas and only the furniture, objects and environmental details needed for the joke. Backgrounds must not become detailed, realistic, painterly or cinematic.

ANIMATION STYLE IS LOCKED: limited-animation 2D social-media cartoon. Snappy pose changes, held poses when useful, exaggerated facial reactions, squash-and-stretch, quick physical gags and clear readable acting. Favor simple front-facing, side and three-quarter compositions. Camera movement should be minimal and functional, not cinematic.

ABSOLUTELY AVOID: 3D or CGI appearance, Pixar-like rendering, polished animated-feature look, glossy digital illustration, realistic skin, pores, realistic hair strands, realistic fabric, complex textures, realistic lighting, dramatic shadows, rim lighting, volumetric lighting, depth of field, bokeh, lens effects, cinematic color grading, painterly rendering, anime rendering, photorealism, hyper-detailed environments, elaborate camera moves, generic replacement faces, face drift, beard removal, hairstyle changes or body-type changes.

THIS VIDEO IS GENERATED SILENT FOR POST-PRODUCTION SOUND DESIGN. Do not perform dialogue. Do not act as though speaking. Joe and Danda communicate only through eyes, eyebrows, head movement, hands, gestures, posture and physical comedy.

MOUTH ANIMATION IS LOCKED: Joe and Danda are SILENT characters. Their mouths must NEVER flap, articulate syllables, lip-sync, silently mouth words, or perform speech-like jaw movement. Keep mouths closed or in a single held non-speaking expression for each reaction. Mouth shape may change only as a quick visual facial expression such as a smile, frown, gasp or laugh reaction, never as continuous talking animation.

Do not generate captions, subtitles, speech bubbles, signs, labels, written dialogue or other on-screen text. All text overlays and all audio are added later in Studio.`;

function endpointFor(model: string) {
  return model === "seedance-standard"
    ? "bytedance/seedance-2.0/reference-to-video"
    : "bytedance/seedance-2.0/fast/reference-to-video";
}

function errorPayload(error: unknown, fallback: string) {
  let raw = fallback;
  if (error && typeof error === "object") {
    const maybe = error as { message?: string; body?: unknown; response?: { data?: unknown } };
    const details = maybe.body ?? maybe.response?.data;
    if (details) {
      try { raw = `${maybe.message || fallback}: ${JSON.stringify(details)}`; } catch { raw = maybe.message || fallback; }
    } else if (maybe.message) raw = maybe.message;
  }
  const normalized = raw.toLowerCase();
  const realPersonBlocked = normalized.includes("likenesses of real people") || normalized.includes("likeness of real people") || normalized.includes("private information") || normalized.includes("real people");
  if (realPersonBlocked) return { error: "Seedance blocked this reference because it appears to contain a real person. Use the approved cartoon Joe and Danda character images instead of source photos.", code: "REAL_PERSON_REFERENCE_BLOCKED", status: 422 };
  return { error: raw, code: "GENERATION_ERROR", status: 500 };
}

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    const body = await request.json();
    const { prompt, imageUrls = [], duration = 5, model = "seedance-fast" } = body;
    if (!prompt || typeof prompt !== "string") return NextResponse.json({ error: "A scene prompt is required." }, { status: 400 });
    if (!Array.isArray(imageUrls) || imageUrls.length < 2) return NextResponse.json({ error: "Upload both approved cartoon character references for Joe and Danda before generating a scene." }, { status: 400 });

    const endpoint = endpointFor(model);
    const safeDuration = Math.max(4, Math.min(15, Number(duration) || 5));
    const lockedPrompt = `${LOCKED_VISUAL_DIRECTION}\n\nSCENE INSTRUCTIONS:\n${prompt}`;
    const submission = await fal.queue.submit(endpoint, {
      input: { prompt: lockedPrompt, image_urls: imageUrls.slice(0, 2), resolution: "720p", duration: String(safeDuration), aspect_ratio: "9:16", generate_audio: false, bitrate_mode: "standard" },
    });
    return NextResponse.json({ requestId: submission.request_id, model, status: "queued" });
  } catch (error) {
    const payload = errorPayload(error, "Video generation failed.");
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const model = searchParams.get("model") || "seedance-fast";
    if (!requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    const endpoint = endpointFor(model);
    const status = await fal.queue.status(endpoint, { requestId, logs: true });
    if (status.status !== "COMPLETED") return NextResponse.json({ requestId, status: status.status, logs: "logs" in status ? status.logs : undefined });
    const result = await fal.queue.result(endpoint, { requestId });
    const data = result.data as { video?: { url?: string }; seed?: number };
    if (!data.video?.url) return NextResponse.json({ error: "Generation completed but no video URL was returned." }, { status: 502 });
    return NextResponse.json({ requestId, status: "COMPLETED", videoUrl: data.video.url, seed: data.seed });
  } catch (error) {
    const payload = errorPayload(error, "Could not check video generation status.");
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
