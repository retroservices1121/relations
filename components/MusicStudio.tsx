"use client";

import { useMemo, useState } from "react";
import styles from "./MusicStudio.module.css";

const PRESETS = {
  "Saturday Chill": "Playful upbeat Saturday chill instrumental, sunny relaxed weekend energy, light funky bass, cheerful guitar, soft drums, catchy social-media background music, easygoing and fun.",
  Funny: "Playful quirky instrumental comedy cue, bouncy bass, light percussion, plucked strings and mallets, upbeat social-media energy, clean and catchy without becoming chaotic.",
  Chill: "Warm laid-back instrumental, mellow drums, soft electric piano, gentle guitar, relaxed bass groove, cozy modern weekend atmosphere.",
  Romantic: "Warm sweet instrumental background music, soft guitar, gentle keys, subtle drums, affectionate modern relationship vibe, sincere but not overly sentimental.",
  Dramatic: "Short dramatic instrumental social-media cue, pulsing low percussion, tense synth textures, clear build and satisfying ending, cinematic but concise.",
  Upbeat: "Bright upbeat instrumental pop cue, punchy drums, handclaps, lively bass, cheerful guitar and synth accents, energetic and catchy social-media background music.",
} as const;

type PresetName = keyof typeof PRESETS;

export default function MusicStudio() {
  const [title, setTitle] = useState("Saturday Be Like");
  const [prompt, setPrompt] = useState<string>(PRESETS["Saturday Chill"]);
  const [duration, setDuration] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [seed, setSeed] = useState<number | null>(null);

  const downloadUrl = useMemo(() => {
    if (!audioUrl) return "";
    return `/api/download-video?url=${encodeURIComponent(audioUrl)}&filename=${encodeURIComponent(`${title || "relations-music"}.mp3`)}`;
  }, [audioUrl, title]);

  function applyPreset(name: PresetName) {
    setPrompt(PRESETS[name]);
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setAudioUrl("");
    setSeed(null);
    try {
      const response = await fetch("/api/generate-post-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, prompt, duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Music generation failed");
      if (!data.url) throw new Error("Music generation completed without a saved audio URL.");
      setAudioUrl(data.url);
      setSeed(typeof data.seed === "number" ? data.seed : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Music generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return <section className={styles.workspace}>
    <div className={styles.card}>
      <span className={styles.kicker}>SOCIAL AUDIO</span>
      <h2>Build a soundtrack</h2>
      <p className={styles.intro}>Generate original instrumental background music for image posts, reels, promos, or anything outside the normal Household Nonsense episode workflow.</p>

      <label className={styles.field}>
        <b>Track name</b>
        <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Saturday Be Like" />
      </label>

      <div className={styles.moods}>
        <b>Quick moods</b>
        <div>{(Object.keys(PRESETS) as PresetName[]).map((name)=><button key={name} type="button" onClick={()=>applyPreset(name)}>{name}</button>)}</div>
      </div>

      <label className={styles.field}>
        <b>Describe the soundtrack</b>
        <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} rows={6} />
      </label>

      <label className={`${styles.field} ${styles.duration}`}>
        <b>Length: {duration} sec</b>
        <input type="range" min="5" max="60" step="1" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} />
      </label>

      <button className={styles.generate} type="button" onClick={generate} disabled={generating || !prompt.trim()}>{generating ? "Generating soundtrack…" : audioUrl ? "Regenerate Soundtrack" : "Generate Soundtrack"}</button>
      {error && <p className="errorText" style={{marginTop:12}}><b>{error}</b></p>}
    </div>

    {audioUrl && <div className={styles.result}>
      <span className={styles.kicker}>READY</span>
      <h3>{title || "Generated soundtrack"}</h3>
      <audio src={audioUrl} controls style={{width:"100%"}} />
      <div className={styles.resultActions}>
        <a href={downloadUrl}><button type="button">Download MP3</button></a>
        <a href={audioUrl} target="_blank" rel="noreferrer"><button type="button">Open R2 Copy</button></a>
      </div>
      <p className={styles.resultNote}>Instrumental only · saved permanently to R2{seed !== null ? ` · seed ${seed}` : ""}</p>
    </div>}
  </section>;
}
