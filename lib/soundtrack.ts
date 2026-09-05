import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const CARTOON_AUDIO_PROMPT = `HOUSEHOLD NONSENSE AUDIO STYLE IS LOCKED. Create a finished soundtrack for a short hand-drawn 2D relationship-comedy cartoon using the same general musical feel across episodes: light, playful, upbeat instrumental comedy music with a simple cheerful rhythm and a warm everyday-family tone. Keep the music supportive and consistent rather than dramatic, cinematic, electronic, epic, tense, or genre-shifting. The background music should feel like a recurring series theme and remain underneath the action while synchronized non-vocal cartoon sound effects provide the scene-specific comedy.

Add only non-vocal ambience and sound effects that clearly match visible actions, such as footsteps, clothing movement, doors, objects, phone taps, clock ticks, whooshes, pops, swishes, light impacts, comedic percussion accents, and short instrumental punchline stings when appropriate.

THIS SOUNDTRACK MUST CONTAIN ZERO HUMAN OR HUMAN-LIKE VOCAL SOUND. Do not generate speech, dialogue, words, narration, whispers, mumbling, gibberish, singing, chanting, humming, laughter, chuckles, giggles, gasps, sighs, grunts, groans, yells, screams, cries, breaths, mouth noises, crowd voices, background conversation, or any other vocal reaction. Do not imitate characters speaking even when their gestures could suggest dialogue. Treat every character as completely silent. Instrumental music, environmental ambience, and non-vocal sound effects only.`;

export const CARTOON_AUDIO_NEGATIVE_PROMPT = "human voice, human-like voice, speech, dialogue, talking, spoken words, narration, whisper, whispering, mumbling, gibberish, vocals, vocalization, vocal reactions, singing, chanting, humming, laughter, laughing, chuckle, chuckling, giggle, giggling, gasp, gasping, sigh, sighing, grunt, grunting, groan, groaning, yell, yelling, scream, screaming, cry, crying, breathing, breath sounds, mouth sounds, mouth noises, crowd voices, background conversation, character voices, voice acting, lip synced voice, dramatic score, cinematic music, epic music, electronic dance music, genre changes";

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
