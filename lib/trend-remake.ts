export const TREND_ENDPOINT = "minimax/h3-max/reference-to-video";
export const GENJUTSU_ENDPOINT = "higgsfiled/genjutsu/motion-transfer/v1.0";
export const KLING_O3_ENDPOINT = "fal-ai/kling-video/o3/standard/video-to-video/edit";

export type TrendProvider = "higgsfield-genjutsu" | "fal-kling-o3" | "fal-minimax";

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

export function compactTrendSegments(duration: number, maximum = 15, minimum = 3) {
  if (!Number.isFinite(duration) || duration < 4) {
    throw new Error("Trend video must be at least 4 seconds long.");
  }
  const count = Math.ceil(duration / maximum);
  let start = 0;
  let remaining = duration;
  return Array.from({ length: count }, (_, index) => {
    const remainingParts = count - index - 1;
    const partDuration = remainingParts === 0
      ? remaining
      : Math.min(maximum, remaining - minimum * remainingParts);
    const part = { index, start, duration: partDuration };
    start += partDuration;
    remaining -= partDuration;
    return part;
  });
}

export function shotAwareTrendSegments(duration: number, sceneCuts: number[], maximum = 15, maxSegments = 12) {
  if (!Number.isFinite(duration) || duration < 4) {
    throw new Error("Trend video must be at least 4 seconds long.");
  }
  const cuts: number[] = [];
  for (const value of sceneCuts.filter(Number.isFinite).sort((a, b) => a - b)) {
    if (value < 0.75 || value > duration - 0.75) continue;
    if (cuts.length && value - cuts[cuts.length - 1] < 0.75) continue;
    cuts.push(value);
  }
  const boundaries = [0, ...cuts, duration];
  let parts: Array<{ start: number; duration: number }> = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const shotDuration = boundaries[index + 1] - start;
    const count = Math.ceil(shotDuration / maximum);
    const size = shotDuration / count;
    for (let part = 0; part < count; part += 1) {
      parts.push({ start: start + part * size, duration: part === count - 1 ? shotDuration - part * size : size });
    }
  }
  while (parts.length > maxSegments) {
    let mergeIndex = -1;
    let smallest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const combined = parts[index].duration + parts[index + 1].duration;
      if (combined <= maximum && combined < smallest) { mergeIndex = index; smallest = combined; }
    }
    if (mergeIndex < 0) break;
    parts.splice(mergeIndex, 2, { start: parts[mergeIndex].start, duration: smallest });
  }
  if (parts.length > maxSegments) return compactTrendSegments(duration, maximum, 3);
  return parts.map((part, index) => ({ index, ...part }));
}

export function klingO3TrendPrompt() {
  return `PRECISE VIDEO EDIT. Preserve @Video1's environment, furniture, rocking chairs, props, background, lighting, camera angle, framing, cuts, subject positions, posture, timing and motion exactly. The only visual edit is replacing the two complete performers.
FACIAL STATE: @Image1 defines Joe's exact resting closed-lip face. @Image2 defines Danda's exact resting closed-lip face. Keep those expressions unchanged throughout the clip. Each character's lips remain one stable closed line and each jaw remains in the same resting position in every frame. Preserve eye and head movement while holding this exact facial state.
Replace every adult male performer in @Video1 with Joe from @Element1, including any shot or close-up where he appears alone. Replace every adult female performer in @Video1 with Danda from @Element2, including any shot or close-up where she appears alone. When both appear, Joe is normally on the left and Danda is normally on the right. Replace their entire visible bodies: head, hair, face, neck, torso, arms, hands, legs, feet and clothing.
@Element1 is the authoritative Joe design: exact locked cartoon face, dark tousled hair, full beard, average build, black T-shirt, blue jeans and white sneakers. @Element2 is the authoritative Danda design: exact locked cartoon face, softly curvy build, coral-red shirt, black ankle pants, white sneakers, gold hoop earrings and very long highlighted dark-brown hair extending toward mid-back.
Keep Joe on the left and Danda on the right. Render only these two replacements in the clean Household Nonsense hand-drawn 2D cartoon style, stable across every frame. Keep all non-character pixels visually consistent with @Video1 from beginning to end. Output clean imagery without added people, props, text, captions, logos, watermarks or letter-like shapes.`;
}
