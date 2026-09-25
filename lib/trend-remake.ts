export const TREND_ENDPOINT = "bytedance/seedance-2.5/us/reference-to-video";

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

export function trendPrompt() {
  return `FULL CARTOON CHARACTER REPLACEMENT. @Image1 is Joe and @Image2 is Danda. @Video1 is the motion, timing, staging and camera reference.
Replace the complete person on the LEFT in @Video1 with the exact full-body 2D cartoon Joe from @Image1. Replace the complete person on the RIGHT in @Video1 with the exact full-body 2D cartoon Danda from @Image2. The replacements include head, hair, face, neck, torso, arms, hands, legs, feet and clothing. Never leave any live-action human body part visible.
Preserve the exact choreography, gestures, body positions, gaze direction, hand timing, footwork, spacing, camera cuts, framing, pacing and duration from @Video1. Preserve the orange studio background and hanging microphone exactly. Keep Joe on the left and Danda on the right without swapping identities.
Joe must retain his locked average build, black T-shirt, blue jeans, white sneakers, dark tousled hair and full beard. He must not become muscular. Danda must retain her locked softly curvy build, coral-red shirt, black ankle pants, white sneakers, very long highlighted dark-brown hair and gold hoop earrings.
Render the entire scene in the same clean Household Nonsense hand-drawn 2D cartoon style as the character references, with thick smooth outlines and solid colors. Keep both characters stable frame to frame. Do not add people, duplicate characters, change the set, invent props, add text, captions, logos or watermarks. Generate no dialogue, music or sound effects; final audio is restored separately.`;
}
