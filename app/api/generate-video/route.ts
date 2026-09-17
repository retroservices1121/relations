import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { saveGenerationRequest } from "@/lib/db";

fal.config({ credentials: process.env.FAL_KEY });

const HIGGSFIELD_MODEL = "higgsfield-seedance-2.5";
const HIGGSFIELD_ENDPOINT = "bytedance/seedance-2.5/reference-to-video";
const HIGGSFIELD_BASE_URL = "https://api.higgsfield.ai";

const LOCKED_VISUAL_DIRECTION = `FINAL VISUAL DIRECTION OVERRIDES ANY CONFLICTING STYLE LANGUAGE BELOW.

CHARACTER IDENTITY IS THE HIGHEST PRIORITY. @Image1 is Joe and @Image2 is Danda. Treat these as exact recurring character model references, not loose inspiration. Preserve the SAME recognizable face shape, eye shape, eyebrows, nose, mouth, hairstyle, beard shape, skin tone, body proportions and clothing identity from the approved references. Do not redesign, beautify, age-shift, de-age, stylize into a new person, change ethnicity, change facial proportions or substitute a generic cartoon man or woman. Joe and Danda must remain immediately recognizable from their approved reference images in every frame.

Joe is an early-40s man with short dark hair, a full neatly trimmed dark beard, and an average slightly stocky everyday-dad build. Joe must never become muscular, athletic, broad-chested or physically defined. Danda is an early-40s woman with long dark brown hair with warm highlights and normal adult proportions. Danda is only moderately shorter than Joe; standing together, the top of her head is approximately around Joe's eye or eyebrow level. Never make her tiny, miniature, child-sized or disproportionately small.

VISUAL STYLE IS STRICTLY LOCKED: simple hand-drawn 2D internet cartoon comedy. Thick clean black outlines around characters and important props. Flat solid color fills. Minimal simple cel shading only when necessary. Slightly oversized cartoon heads, large expressive eyes, simple rounded facial features, simplified hands and feet, intentionally basic anatomy, readable silhouettes and a playful drawn-cartoon appearance. Keep the same simple character construction from the approved references in every frame.

BACKGROUND STYLE IS LOCKED: simple functional 2D backgrounds with large flat color areas and only the furniture, objects and environmental details needed for the joke. Backgrounds must not become detailed, realistic, painterly or cinematic.

ANIMATION STYLE IS LOCKED: limited-animation 2D social-media cartoon. Snappy pose changes, held poses when useful, exaggerated reactions, squash-and-stretch, quick physical gags and clear readable acting. Favor simple front-facing, side and three-quarter compositions. Camera movement should be minimal and functional, not cinematic.

ABSOLUTELY AVOID: 3D or CGI appearance, Pixar-like rendering, polished animated-feature look, glossy digital illustration, realistic skin, pores, realistic hair strands, realistic fabric, complex textures, realistic lighting, dramatic shadows, rim lighting, volumetric lighting, depth of field, bokeh, lens effects, cinematic color grading, painterly rendering, anime rendering, photorealism, hyper-detailed environments, elaborate camera moves, generic replacement faces, face drift, beard removal, hairstyle changes or body-type changes.

ABSOLUTE SILENCE / MOUTH LOCK — THIS OVERRIDES EVERY SCENE INSTRUCTION: THIS VIDEO CONTAINS ZERO SPEECH. Joe, Danda, background characters, relatives, crowds and every other human character are completely nonverbal. Do not generate recognizable speech OR unrecognizable/gibberish speech. Do not generate fake words, pseudo-language, muttering, mumbling, babbling, whispering, chatter, conversation, narration, singing, humming, laughter, sighs, gasps, grunts, exclamations, vocal reactions, mouth noises or any human vocal sound whatsoever. No character may appear to speak even silently. ALL HUMAN MOUTHS MUST REMAIN CLOSED AND VISUALLY STILL AT ALL TIMES, including Joe, Danda and background people. Zero lip movement. Zero jaw movement. Zero mouth opening. Zero speech-like facial articulation. Zero conversational mouth animation. Closed-mouth smiles and closed-mouth frowns are allowed only as held expressions. Communicate only through eyes, eyebrows, head angle, posture, props and simple physical actions. Avoid conversational hand timing or back-and-forth acting that could cause the model to infer dialogue. If a scene instruction implies talking, conversation, greeting, goodbye, calling, reacting vocally or saying anything, render that action as SILENT PHYSICAL PANTOMIME ONLY with closed mouths.

AUDIO RULES ARE ABSOLUTE: THE AUDIO TRACK MUST CONTAIN ZERO HUMAN VOICES. Generate only sparse, literal environmental and object-based sound effects directly justified by visible physical actions, such as a remote click, footsteps, a door movement, an object landing, a phone tap, cloth movement, water, dishes or a simple impact. DO NOT GENERATE SPEECH, including unintelligible, unrecognizable, garbled, gibberish or pseudo-language speech. DO NOT GENERATE dialogue, narration, crowd chatter, background conversations, singing, humming, whispering, mumbling, babbling, grunts, gasps, sighs, laughs, vocal reactions or speech-like sounds. DO NOT GENERATE MUSIC, melodies, songs, background scores, jingles or musical stings. Sound effects must come only from objects and the environment, never from characters' mouths. Silence between sound effects is preferred. Studio adds the locked original background theme later.

Do not generate captions, subtitles, speech bubbles, signs, labels, written dialogue or other on-screen text. All text overlays are added later in Studio.`;

const BED_SLEEP_LOCK = `BED/SLEEP REALISM LOCK — WHEN THIS SCENE TAKES PLACE IN BED OR ON A MATTRESS: Joe and Danda are BAREFOOT for the entire scene. ABSOLUTELY NO SHOES, SNEAKERS, SLIPPERS, BOOTS, SANDALS OR OTHER FOOTWEAR may be worn on the bed or under the bedding. If feet are visible, render normal bare feet only. If feet are covered by the blanket, do not invent footwear underneath or reveal shoes later. Sleep clothing is a simple T-shirt with pajama shorts or pajama pants. This footwear rule overrides the approved daytime character-reference clothing whenever the characters are sleeping, lying in bed, getting into bed, or already on the mattress.`;

function isHiggsfieldModel(model: string) {
  return model === HIGGSFIELD_MODEL;
}

function falEndpointFor(model: string) {
  return model === "seedance-standard"
    ? "bytedance/seedance-2.0/reference-to-video"
    : "bytedance/seedance-2.0/fast/reference-to-video";
}

function higgsfieldCredentials() {
  const keyId = process.env.HF_API_KEY_ID?.trim();
  const keySecret = process.env.HF_API_KEY_SECRET?.trim();
  return keyId && keySecret ? `${keyId}:${keySecret}` : "";
}

function errorPayload(error: unknown, fallback: string) {
  let raw = fallback;
  if (error && typeof error === "object") {
    const maybe = error as { message?: string; body?: unknown; response?: { data?: unknown } };
    const details = maybe.body ?? maybe.response?.data;
    if (details) { try { raw = `${maybe.message || fallback}: ${JSON.stringify(details)}`; } catch { raw = maybe.message || fallback; } }
    else if (maybe.message) raw = maybe.message;
  }
  const normalized = raw.toLowerCase();
  const realPersonBlocked = normalized.includes("likenesses of real people") || normalized.includes("likeness of real people") || normalized.includes("private information") || normalized.includes("real people");
  if (realPersonBlocked) return { error: "The video provider blocked this reference because it appears to contain a real person. Use the approved cartoon Joe and Danda character images instead of source photos.", code: "REAL_PERSON_REFERENCE_BLOCKED", status: 422 };
  return { error: raw, code: "GENERATION_ERROR", status: 500 };
}

async function parseHiggsfieldError(response: Response) {
  const data = await response.json().catch(() => null) as { detail?: unknown; error?: unknown; message?: string } | null;
  if (!data) return `Higgsfield request failed with HTTP ${response.status}.`;
  const detail = data.detail ?? data.error ?? data.message;
  if (typeof detail === "string") return detail;
  try { return JSON.stringify(detail ?? data); } catch { return `Higgsfield request failed with HTTP ${response.status}.`; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, imageUrls = [], duration = 5, model = "seedance-fast" } = body;
    if (!prompt || typeof prompt !== "string") return NextResponse.json({ error: "A scene prompt is required." }, { status: 400 });
    if (!Array.isArray(imageUrls) || imageUrls.length < 2) return NextResponse.json({ error: "Upload both approved cartoon character references for Joe and Danda before generating a scene." }, { status: 400 });

    const usingHiggsfield = isHiggsfieldModel(model);
    if (usingHiggsfield && !higgsfieldCredentials()) return NextResponse.json({ error: "HF_API_KEY_ID and HF_API_KEY_SECRET are not configured on the server." }, { status: 500 });
    if (!usingHiggsfield && !process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });

    const maxDuration = usingHiggsfield ? 30 : 15;
    const safeDuration = Math.max(4, Math.min(maxDuration, Number(duration) || 5));
    const isBedSleepScene = /\b(bed|bedroom|mattress|bedding|sleep|asleep|sleeping)\b/i.test(prompt);
    const bedSleepPrompt = isBedSleepScene ? `\n\n${BED_SLEEP_LOCK}` : "";
    const lockedPrompt = `${LOCKED_VISUAL_DIRECTION}${bedSleepPrompt}\n\nSCENE INSTRUCTIONS:\n${prompt}`;
    const isMusicalScene = prompt.includes("MUSICAL TIMING TARGET:");

    if (usingHiggsfield) {
      const response = await fetch(`${HIGGSFIELD_BASE_URL}/${HIGGSFIELD_ENDPOINT}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${higgsfieldCredentials()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: lockedPrompt,
          image_urls: imageUrls.slice(0, 2),
          duration: safeDuration,
          resolution: "720p",
          aspect_ratio: "9:16",
          output_format: "mp4",
          generate_audio: !isMusicalScene,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Higgsfield: ${await parseHiggsfieldError(response)}`);
      const submission = await response.json() as { request_id?: string; status?: string; status_url?: string };
      if (!submission.request_id) throw new Error("Higgsfield accepted the request but did not return a request_id.");
      await saveGenerationRequest({ requestId: submission.request_id, model, endpointId: HIGGSFIELD_ENDPOINT, duration: safeDuration }).catch(() => undefined);
      return NextResponse.json({ requestId: `hf:${submission.request_id}`, model, provider: "higgsfield", status: submission.status || "queued", musicalAudioDisabled: isMusicalScene });
    }

    const endpoint = falEndpointFor(model);
    const submission = await fal.queue.submit(endpoint, { input: { prompt: lockedPrompt, image_urls: imageUrls.slice(0, 2), resolution: "720p", duration: String(safeDuration), aspect_ratio: "9:16", generate_audio: !isMusicalScene, bitrate_mode: "standard" } });
    await saveGenerationRequest({ requestId: submission.request_id, model, endpointId: endpoint, duration: safeDuration }).catch(() => undefined);
    return NextResponse.json({ requestId: submission.request_id, model, provider: "fal", status: "queued", musicalAudioDisabled: isMusicalScene });
  } catch (error) {
    const payload = errorPayload(error, "Video generation failed.");
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedRequestId = searchParams.get("requestId");
    const model = searchParams.get("model") || "seedance-fast";
    if (!encodedRequestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });

    const higgsfieldRequest = encodedRequestId.startsWith("hf:") || isHiggsfieldModel(model);
    if (higgsfieldRequest) {
      const credentials = higgsfieldCredentials();
      if (!credentials) return NextResponse.json({ error: "HF_API_KEY_ID and HF_API_KEY_SECRET are not configured on the server." }, { status: 500 });
      const requestId = encodedRequestId.replace(/^hf:/, "");
      const response = await fetch(`${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(requestId)}/status`, {
        headers: { Authorization: `Key ${credentials}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Higgsfield: ${await parseHiggsfieldError(response)}`);
      const data = await response.json() as { status?: string; video?: { url?: string }; error?: { message?: string } | string };
      const status = (data.status || "queued").toLowerCase();
      if (status === "completed") {
        if (!data.video?.url) return NextResponse.json({ error: "Higgsfield completed generation but returned no video URL." }, { status: 502 });
        return NextResponse.json({ requestId: encodedRequestId, provider: "higgsfield", status: "COMPLETED", videoUrl: data.video.url });
      }
      if (["failed", "nsfw", "canceled", "cancelled"].includes(status)) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        return NextResponse.json({ error: message || `Higgsfield generation ended with status ${status}.`, code: `HIGGSFIELD_${status.toUpperCase()}` }, { status: 502 });
      }
      return NextResponse.json({ requestId: encodedRequestId, provider: "higgsfield", status: status === "in_progress" ? "IN_PROGRESS" : "IN_QUEUE" });
    }

    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    const endpoint = falEndpointFor(model);
    const status = await fal.queue.status(endpoint, { requestId: encodedRequestId, logs: true });
    if (status.status !== "COMPLETED") return NextResponse.json({ requestId: encodedRequestId, provider: "fal", status: status.status, logs: "logs" in status ? status.logs : undefined });
    const result = await fal.queue.result(endpoint, { requestId: encodedRequestId });
    const data = result.data as { video?: { url?: string }; seed?: number };
    if (!data.video?.url) return NextResponse.json({ error: "Generation completed but no video URL was returned." }, { status: 502 });
    return NextResponse.json({ requestId: encodedRequestId, provider: "fal", status: "COMPLETED", videoUrl: data.video.url, seed: data.seed });
  } catch (error) {
    const payload = errorPayload(error, "Could not check video generation status.");
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
