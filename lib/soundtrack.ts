import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const CARTOON_AUDIO_PROMPT = `HOUSEHOLD NONSENSE SFX PASS. Generate ONLY synchronized non-vocal environmental ambience and cartoon sound effects for the visible physical actions in this short hand-drawn 2D cartoon.

Use sparse, clean effects only when visually justified: footsteps, clothing rustle, phone taps, clock ticks, doors, object handling, light impacts, swishes, whooshes, pops, simple cartoon percussion hits, and other clearly non-vocal physical sounds. Silence is preferred whenever no physical sound is needed.

DO NOT COMPOSE OR ADD BACKGROUND MUSIC. The permanent Household Nonsense theme music is mixed separately in Studio. DO NOT CREATE CHARACTER AUDIO. Treat every person on screen as a completely silent mime. Gestures, facial expressions, head movements, pointing, shrugs, thinking poses, frustration, surprise, laughter-like facial expressions, and mouth movement are VISUAL ONLY and must never receive a vocal sound.

ZERO HUMAN OR HUMAN-LIKE VOCAL SOUND: no speech, words, dialogue, narration, whispers, mumbling, gibberish, singing, humming, laughter, chuckles, giggles, gasps, sighs, grunts, groans, yells, screams, cries, breathing, mouth noises, crowd voices, or background conversation. Environmental ambience and non-vocal physical/cartoon SFX only.`;

export const CARTOON_AUDIO_NEGATIVE_PROMPT = "music, background music, soundtrack music, melody, song, score, instrumental music, human voice, human-like voice, speech, dialogue, talking, spoken words, narration, whisper, whispering, mumbling, gibberish, vocals, vocalization, vocal reactions, singing, chanting, humming, laughter, laughing, chuckle, chuckling, giggle, giggling, gasp, gasping, sigh, sighing, grunt, grunting, groan, groaning, yell, yelling, scream, screaming, cry, crying, breathing, breath sounds, mouth sounds, mouth noises, crowd voices, background conversation, character voices, voice acting, lip synced voice";

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
