import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const CARTOON_AUDIO_PROMPT = `HOUSEHOLD NONSENSE SFX PASS. Generate ONLY sparse synchronized non-vocal physical sound effects for actions that would make a real audible sound in this short hand-drawn 2D cartoon.

Use restraint. Prefer silence over adding a sound. Only add effects for direct physical events such as a door closing, phone tap, object pickup or set-down, footsteps when clearly visible, a clock tick when featured, clothing movement when physically obvious, or a light impact that actually occurs on screen.

DO NOT score reactions. Facial expressions, eye movements, head turns, shrugs, thinking poses, frustration, surprise, disappointment, defeat poses, pointing, hand gestures, crossed arms, smiles, frowns, and comedic reaction beats are SILENT. Do not add whooshes, pops, boings, percussion hits, stingers, risers, swells, or reaction accents to those moments.

IMPORTANT MOUTH RULE: ANY visible mouth movement is animation only and MUST BE COMPLETELY SILENT. Never interpret an opening mouth, changing expression, jaw movement, smile, grimace, or facial motion as a bodily or vocal sound. Do not generate burps, belches, hiccups, coughs, sneezes, swallowing, chewing, lip smacks, tongue clicks, throat sounds, stomach sounds, breaths, grunts, or any other mouth/body noise under any circumstance.

DO NOT COMPOSE OR ADD BACKGROUND MUSIC. The permanent Household Nonsense theme music is mixed separately in Studio. DO NOT CREATE CHARACTER AUDIO. Treat every person on screen as a completely silent mime.

ZERO HUMAN OR HUMAN-LIKE VOCAL OR BODY SOUND: no speech, words, dialogue, narration, whispers, mumbling, gibberish, singing, humming, laughter, chuckles, giggles, gasps, sighs, grunts, groans, yells, screams, cries, breathing, burping, belching, hiccups, coughing, sneezing, swallowing, chewing, lip smacks, tongue clicks, throat clearing, stomach noises, mouth noises, crowd voices, or background conversation. Environmental physical SFX only.`;

export const CARTOON_AUDIO_NEGATIVE_PROMPT = "music, background music, soundtrack music, melody, song, score, instrumental music, reaction sound, reaction hit, comedy sting, stinger, whoosh on gesture, whoosh on reaction, pop on reaction, boing, riser, swell, percussion hit on reaction, human voice, human-like voice, speech, dialogue, talking, spoken words, narration, whisper, whispering, mumbling, gibberish, vocals, vocalization, vocal reactions, singing, chanting, humming, laughter, laughing, chuckle, chuckling, giggle, giggling, gasp, gasping, sigh, sighing, grunt, grunting, groan, groaning, yell, yelling, scream, screaming, cry, crying, breathing, breath sounds, burp, burping, belch, belching, hiccup, hiccups, cough, coughing, sneeze, sneezing, swallow, swallowing, chewing, chew sounds, lip smack, lip smacking, tongue click, throat clearing, throat sound, stomach sound, digestive sound, body noise, mouth sounds, mouth noises, crowd voices, background conversation, character voices, voice acting, lip synced voice";

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
