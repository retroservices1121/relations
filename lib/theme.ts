import { fal } from "@fal-ai/client";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadProject } from "@/lib/db";
import { putR2Object } from "@/lib/r2";

fal.config({ credentials: process.env.FAL_KEY });

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const THEME_KEY = "relations/audio/household-nonsense-theme.wav";

export function householdNonsenseThemeUrl() {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL is not configured.");
  return `${base}/${THEME_KEY}`;
}

async function exists(url: string) {
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureHouseholdNonsenseTheme() {
  const lockedUrl = householdNonsenseThemeUrl();
  if (await exists(lockedUrl)) return lockedUrl;
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured, so the locked Household Nonsense theme cannot be created.");

  const episodeOne = await loadProject("getting-ready");
  if (!episodeOne.finalUrl) {
    throw new Error("Episode 1 must have a saved final export before the Household Nonsense theme can be created.");
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-theme-"));
  try {
    const episodePath = path.join(workDir, "episode-1.mp4");
    const referencePath = path.join(workDir, "episode-1-reference.wav");

    const episodeResponse = await fetch(episodeOne.finalUrl, { cache: "no-store" });
    if (!episodeResponse.ok) throw new Error(`Could not download Episode 1 (${episodeResponse.status}).`);
    await fs.writeFile(episodePath, Buffer.from(await episodeResponse.arrayBuffer()));

    await execFileAsync(ffmpegPath, [
      "-y", "-i", episodePath, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", referencePath,
    ]);

    const referenceBytes = await fs.readFile(referencePath);
    const referenceFile = new File([referenceBytes], "household-nonsense-reference.wav", { type: "audio/wav" });
    const referenceUrl = await fal.storage.upload(referenceFile);

    const result = await fal.subscribe("fal-ai/stable-audio-25/audio-to-audio", {
      input: {
        prompt: "Instrumental lighthearted family relationship comedy theme for a simple hand-drawn 2D social-media cartoon. Playful, warm, bouncy, mischievous, clean and catchy. Small percussion, light plucked instruments and cheerful rhythmic accents. Keep the same overall musical personality and pacing as the reference, but REMOVE all reaction noises and sound effects. MUSIC ONLY. No voices, no speech, no laughter, no gasps, no human sounds, no footsteps, no impacts, no whooshes, no cartoon SFX. Smooth continuous 30-second instrumental bed that can sit under comedy scenes and loop naturally without a dramatic ending.",
        audio_url: referenceUrl,
        strength: 0.58,
        num_inference_steps: 16,
        total_seconds: 30,
        guidance_scale: 1.5,
      },
      logs: false,
    });

    const data = result.data as { audio?: { url?: string } | string };
    const generatedUrl = typeof data.audio === "string" ? data.audio : data.audio?.url;
    if (!generatedUrl) throw new Error("Theme generation completed without returning an audio file.");

    const generated = await fetch(generatedUrl, { cache: "no-store" });
    if (!generated.ok) throw new Error(`Could not download generated theme (${generated.status}).`);
    const bytes = Buffer.from(await generated.arrayBuffer());
    const stored = await putR2Object(THEME_KEY, bytes, "audio/wav");
    return stored.url;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
