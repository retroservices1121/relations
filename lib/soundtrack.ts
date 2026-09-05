import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const CARTOON_AUDIO_PROMPT = `Create a lively finished soundtrack for a short hand-drawn 2D relationship-comedy cartoon. Include light playful INSTRUMENTAL background music, subtle room or environmental ambience, and synchronized cartoon sound effects that match the visible actions: footsteps, clothing movement, doors, objects, phone taps, clock ticks, whooshes, pops, swishes, comedic stings and reaction accents when visually appropriate. ABSOLUTELY NO HUMAN VOICES. NO SPEECH. NO DIALOGUE. NO WORDS. NO WHISPERS. NO MUMBLING. NO VOCALS. NO SINGING. NO CHANTING. NO NARRATION. NO BACKGROUND CONVERSATION. NO GIBBERISH. NO SPOKEN OR VOCAL REACTIONS. Instrumental music and non-vocal sound effects only.`;

export const CARTOON_AUDIO_NEGATIVE_PROMPT = "human voice, speech, dialogue, talking, words, whispering, mumbling, vocals, singing, chanting, narration, background conversation, gibberish, spoken reactions, vocal reactions, laughter voices";

export async function generateSoundtrackedVideo(videoUrl: string, duration: number) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured on the server.");
  const safeDuration = Math.max(1, Math.min(30, Number(duration) || 5));

  const result = await fal.subscribe("fal-ai/mmaudio-v2", {
    input: {
      video_url: videoUrl,
      prompt: CARTOON_AUDIO_PROMPT,
      negative_prompt: CARTOON_AUDIO_NEGATIVE_PROMPT,
      duration: safeDuration,
      num_steps: 25,
      cfg_strength: 6,
    },
    logs: false,
  });

  const data = result.data as { video?: { url?: string } };
  if (!data.video?.url) throw new Error("MMAudio completed without returning a video.");
  return { videoUrl: data.video.url, requestId: result.requestId };
}
