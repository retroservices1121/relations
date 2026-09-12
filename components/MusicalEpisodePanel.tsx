"use client";

import { useEffect, useState } from "react";
import type { MusicalEpisode } from "../data/musicalEpisodes";
import { deriveSceneTimings, type SceneTiming, type SongChunk } from "../lib/musicalTiming";

type StoredSong = { musicUrl: string; duration: number; timings: SceneTiming[]; transcript?: string; };
type Props = { episode: MusicalEpisode; onTimingChange?: (timings: SceneTiming[] | null) => void; };

export default function MusicalEpisodePanel({ episode, onTimingChange }: Props) {
  const storageKey = `relations:music:${episode.id}`;
  const [musicUrl, setMusicUrl] = useState("");
  const [songDuration, setSongDuration] = useState(0);
  const [timings, setTimings] = useState<SceneTiming[]>([]);
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [musicalUrl, setMusicalUrl] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) { onTimingChange?.(null); return; }
    try {
      const saved = JSON.parse(raw) as StoredSong;
      if (saved.musicUrl) setMusicUrl(saved.musicUrl);
      if (Number(saved.duration) > 0) setSongDuration(Number(saved.duration));
      if (Array.isArray(saved.timings) && saved.timings.length === episode.scenes.length) { setTimings(saved.timings); onTimingChange?.(saved.timings); }
      if (saved.transcript) setTranscript(saved.transcript);
    } catch { if (raw.startsWith("http")) setMusicUrl(raw); onTimingChange?.(null); }
  }, [episode.id, episode.scenes.length, onTimingChange, storageKey]);

  function saveSong(nextUrl: string, nextDuration: number, nextTimings: SceneTiming[], nextTranscript = transcript) {
    setMusicUrl(nextUrl); setSongDuration(nextDuration); setTimings(nextTimings); setTranscript(nextTranscript);
    localStorage.setItem(storageKey, JSON.stringify({ musicUrl: nextUrl, duration: nextDuration, timings: nextTimings, transcript: nextTranscript } satisfies StoredSong));
    onTimingChange?.(nextTimings);
  }

  async function generate() {
    setGenerating(true); setError(""); setMusicalUrl("");
    try {
      const response = await fetch("/api/generate-episode-song", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episodeId: episode.id, ...episode.musical }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Song generation failed");
      const actualDuration = Math.max(1, Number(data.duration) || episode.musical.duration);
      const chunks = Array.isArray(data.chunks) ? data.chunks as SongChunk[] : [];
      const mapped = deriveSceneTimings(episode.id, chunks, actualDuration, episode.scenes.map((scene) => scene.duration));
      saveSong(data.url, actualDuration, mapped, typeof data.transcript === "string" ? data.transcript : "");
    } catch (e) { setError(e instanceof Error ? e.message : "Song generation failed"); } finally { setGenerating(false); }
  }

  function updateBoundary(index: number, value: number) {
    if (index < 0 || index >= timings.length - 1) return;
    const previousStart = timings[index].start; const nextEnd = timings[index + 1].end;
    const boundary = Math.max(previousStart + 0.25, Math.min(nextEnd - 0.25, Number(value) || previousStart + 0.25));
    const next = timings.map((timing) => ({ ...timing }));
    next[index].end = Number(boundary.toFixed(2)); next[index].duration = Number((next[index].end - next[index].start).toFixed(2));
    next[index + 1].start = Number(boundary.toFixed(2)); next[index + 1].duration = Number((next[index + 1].end - next[index + 1].start).toFixed(2));
    saveSong(musicUrl, songDuration, next);
  }

  async function build() {
    setBuilding(true); setError("");
    try {
      if (!musicUrl || timings.length !== episode.scenes.length) throw new Error("Generate and lock the song timing first.");
      const projectResponse = await fetch(`/api/project?episodeId=${encodeURIComponent(episode.id)}`, { cache: "no-store" });
      const project = await projectResponse.json();
      if (!projectResponse.ok) throw new Error(project.error || "Could not load episode scenes");
      const rows = Array.isArray(project.scenes) ? [...project.scenes].sort((a, b) => Number(a.scene_index) - Number(b.scene_index)) : [];
      // Musical finals always prefer the original Seedance source so the normal Household Nonsense theme can never leak into the song mix.
      const scenes = rows.slice(0, episode.scenes.length).map((row) => ({ videoUrl: row.source_video_url || row.video_url })).filter((scene) => typeof scene.videoUrl === "string" && scene.videoUrl.startsWith("http"));
      if (scenes.length !== episode.scenes.length) throw new Error("Generate and save every timed scene before building the musical final.");
      const response = await fetch("/api/render-musical", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episodeId: episode.id, musicUrl, songDuration, timings, scenes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Musical build failed");
      setMusicalUrl(data.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Musical build failed"); } finally { setBuilding(false); }
  }

  return <section className="musicalPanel">
    <span className="eyebrow">STEP 1 — SONG FIRST</span><h2>Generate & Lock the Spider Song</h2>
    <p>The song is the master timeline. MiniMax creates the song first, then Whisper timestamps the sung words and Studio maps the six visual scenes to those actual musical beats.</p>
    <details><summary><b>Song lyrics</b></summary><pre>{episode.musical.lyrics}</pre></details>
    <div className="musicalActions"><button onClick={generate} disabled={generating}>{generating?"Generating + timestamping song…":musicUrl?"Regenerate Song":"Generate Episode Song"}</button><button onClick={build} disabled={building||!musicUrl||timings.length!==episode.scenes.length}>{building?"Building musical final…":"Build Musical Final"}</button></div>
    {musicUrl&&<div className="musicalSong"><audio src={musicUrl} controls /><p><b>Locked song length:</b> {songDuration.toFixed(2)} sec</p><p>Listen once and check the suggested scene boundaries below. Change an end timestamp if a visual beat should cut earlier or later. The next scene automatically starts at that exact timestamp.</p>
      <div className="musicalTimings">{timings.map((timing,index)=><div key={index} className="musicalTimingRow"><b>S{index+1}</b><span>{timing.anchor}</span><span>{timing.start.toFixed(2)}s</span>{index<timings.length-1?<input aria-label={`Scene ${index+1} end time`} type="number" step="0.1" min={timing.start+0.25} max={timings[index+1].end-0.25} value={timing.end} onChange={(event)=>updateBoundary(index,Number(event.target.value))}/>:<span>{timing.end.toFixed(2)}s</span>}<b>{timing.duration.toFixed(2)}s</b></div>)}</div>
      <small>Scene generation uses the next whole second (minimum 4 sec), then the final renderer trims each clip back to these exact song timestamps.</small>{transcript&&<details><summary>Whisper song transcript</summary><p>{transcript}</p></details>}</div>}
    {musicalUrl&&<div className="musicalResult"><b>✓ Musical final ready</b><video src={musicalUrl} controls playsInline /><div className="musicalActions"><a href={`/api/download-video?url=${encodeURIComponent(musicalUrl)}&filename=${encodeURIComponent(`${episode.id}-musical-final.mp4`)}`}>Download MP4</a><a href={musicalUrl} target="_blank" rel="noreferrer">Open R2 Copy</a></div></div>}{error&&<p className="errorText"><b>{error}</b></p>}
  </section>;
}
