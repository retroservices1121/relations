"use client";

import { useMemo, useState } from "react";

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
  const [prompt, setPrompt] = useState(PRESETS["Saturday Chill"]);
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

  return <section style={{display:"grid",gap:18}}>
    <div style={{padding:20,border:"1px solid #272832",borderRadius:16,background:"#15161c"}}>
      <span className="eyebrow">SOCIAL AUDIO</span>
      <h2 style={{margin:"6px 0 8px"}}>Music Studio</h2>
      <p style={{margin:"0 0 18px",color:"#9d9aa5"}}>Generate original instrumental background music for image posts, reels, promos, or anything outside the normal Household Nonsense episode workflow.</p>

      <label style={{display:"grid",gap:7,marginBottom:14}}>
        <b>Track name</b>
        <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Saturday Be Like" style={{padding:12,borderRadius:10,border:"1px solid #343640",background:"#101116",color:"white"}} />
      </label>

      <div style={{display:"grid",gap:8,marginBottom:14}}>
        <b>Quick moods</b>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{(Object.keys(PRESETS) as PresetName[]).map((name)=><button key={name} type="button" onClick={()=>applyPreset(name)}>{name}</button>)}</div>
      </div>

      <label style={{display:"grid",gap:7,marginBottom:14}}>
        <b>Describe the soundtrack</b>
        <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} rows={6} style={{padding:12,borderRadius:10,border:"1px solid #343640",background:"#101116",color:"white",resize:"vertical"}} />
      </label>

      <label style={{display:"grid",gap:7,maxWidth:240,marginBottom:16}}>
        <b>Length: {duration} sec</b>
        <input type="range" min="5" max="60" step="1" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} />
      </label>

      <button type="button" onClick={generate} disabled={generating || !prompt.trim()}>{generating ? "Generating soundtrack…" : audioUrl ? "Regenerate Soundtrack" : "Generate Soundtrack"}</button>
      {error && <p className="errorText" style={{marginTop:12}}><b>{error}</b></p>}
    </div>

    {audioUrl && <div style={{padding:20,border:"1px solid #272832",borderRadius:16,background:"#15161c"}}>
      <span className="eyebrow">READY</span>
      <h3 style={{margin:"6px 0 12px"}}>{title || "Generated soundtrack"}</h3>
      <audio src={audioUrl} controls style={{width:"100%"}} />
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
        <a href={downloadUrl}><button type="button">Download MP3</button></a>
        <a href={audioUrl} target="_blank" rel="noreferrer"><button type="button">Open R2 Copy</button></a>
      </div>
      <p style={{margin:"12px 0 0",color:"#9d9aa5",fontSize:13}}>Instrumental only · saved permanently to R2{seed !== null ? ` · seed ${seed}` : ""}</p>
    </div>}
  </section>;
}
