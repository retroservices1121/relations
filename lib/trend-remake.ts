export const TREND_ENDPOINT = "minimax/h3-max/reference-to-video";
export const GENJUTSU_ENDPOINT = "higgsfiled/genjutsu/motion-transfer/v1.0";

export type TrendProvider = "higgsfield-genjutsu" | "fal-minimax";

export type TrendJob = { requestId: string; index: number; duration: number };
export type TrendSegment = { url: string; index: number; duration: number };

export function balancedTrendSegments(duration: number, maximum = 15) {
  if (!Number.isFinite(duration) || duration < 4) {
    throw new Error("Trend video must be at least 4 seconds long.");
  }
  const count = Math.ceil(duration / maximum);
  const size = duration / count;
  return Array.from({ length: count }, (_, index) => ({
    index,
    start: index * size,
    duration: index === count - 1 ? duration - index * size : size,
  }));
}

export function trendPrompt(detailedReferences = false) {
  const referenceMap = detailedReferences
    ? `Image 1 is the LOCKED CLOSE-UP HEAD of Joe. Image 2 is Joe's full-body design. Image 3 is the LOCKED CLOSE-UP HEAD of Danda. Image 4 is Danda's full-body design. The close-up head references have absolute priority for face, head shape, hairstyle, hair length and facial-hair identity; the full-body references control body shape and clothing.`
    : "Image 1 is Joe and Image 2 is Danda.";
  const roleMap = detailedReferences
    ? "Replace the complete person on the LEFT in Video 1 with Joe using Image 1 for his exact cartoon head and Image 2 for his full-body design. Replace the complete person on the RIGHT in Video 1 with Danda using Image 3 for her exact cartoon head and Image 4 for her full-body design."
    : "Replace the complete person on the LEFT in Video 1 with the exact full-body 2D cartoon Joe from Image 1. Replace the complete person on the RIGHT in Video 1 with the exact full-body 2D cartoon Danda from Image 2.";
  const base = `FULL CARTOON CHARACTER REPLACEMENT. ${referenceMap} Video 1 is the motion, timing, staging and camera reference only.
${roleMap} The replacements include head, hair, face, neck, torso, arms, hands, legs, feet and clothing. Never leave any live-action human body part visible.
Preserve the exact choreography, gestures, body positions, gaze direction, hand timing, footwork, spacing, camera cuts, framing, pacing and duration from Video 1. Preserve the orange studio background and hanging microphone exactly. Keep Joe on the left and Danda on the right without swapping identities.
Joe must retain his locked cartoon head, average build, black T-shirt, blue jeans, white sneakers, dark tousled hair and full beard. He must not become muscular. Danda must retain her locked cartoon head, softly curvy build, coral-red shirt, black ankle pants, white sneakers, gold hoop earrings and VERY LONG highlighted dark-brown hair extending well below her shoulders toward mid-back. Danda's long-hair silhouette is identity-critical. Never copy the source performer's haircut onto Danda. Never shorten Danda's hair into a bob, pixie cut, chin-length cut, shoulder-length cut or tied-up style. The live-action performers supply movement only and supply zero identity, face, hair, wardrobe or body-design information.
Render the entire scene in the same clean Household Nonsense hand-drawn 2D cartoon style as the character references, with thick smooth outlines and solid colors. Keep both characters stable frame to frame. Do not add people, duplicate characters, change the set, invent props, add text, captions, logos or watermarks. Generate no dialogue, music or sound effects; final audio is restored separately.`;

  return `${base}

SOURCE TEXT REMOVAL IS MANDATORY. Any words, captions, subtitles, handles, usernames, logos, interface marks or letter-like shapes from Video 1 are contamination, not scene content. Reconstruct clean background pixels where they appeared. Do not preserve, trace, imitate, translate, respell or replace any source text. Output zero readable or pseudo-readable text anywhere in the frame.`;
}
