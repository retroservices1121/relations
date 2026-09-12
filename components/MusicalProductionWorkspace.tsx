"use client";

import { useMemo, useState } from "react";
import EpisodeWorkspace from "./EpisodeWorkspace";
import MusicalEpisodePanel from "./MusicalEpisodePanel";
import type { MusicalEpisode } from "../data/musicalEpisodes";
import type { SceneTiming } from "../lib/musicalTiming";

export default function MusicalProductionWorkspace({ episode }: { episode: MusicalEpisode }) {
  const [timings, setTimings] = useState<SceneTiming[] | null>(null);

  const timedEpisode = useMemo(() => {
    if (!timings || timings.length !== episode.scenes.length) return null;
    return {
      ...episode,
      scenes: episode.scenes.map((scene, index) => {
        const exact = Math.max(0.25, timings[index].end - timings[index].start);
        const generationDuration = Math.max(4, Math.min(15, Math.ceil(exact)));
        const scale = generationDuration / Math.max(0.25, scene.duration);
        const timingDirection = exact > 15
          ? `MUSICAL TIMING TARGET: this visual beat covers ${exact.toFixed(2)} seconds of the final song, from ${timings[index].start.toFixed(2)}s to ${timings[index].end.toFixed(2)}s. Seedance can generate only ${generationDuration} seconds for this source clip, so complete the main action within the first ${Math.max(8, generationDuration - 3)} seconds and then settle into a strong readable final reaction pose that can be held by Studio for the remaining musical time. Do NOT try to stretch or repeat the action.`
          : `MUSICAL TIMING TARGET: this shot will occupy exactly ${exact.toFixed(2)} seconds in the final song-driven edit, from song timestamp ${timings[index].start.toFixed(2)}s to ${timings[index].end.toFixed(2)}s. Make the main visual action happen early enough to read clearly within that interval, then hold the final reaction pose through the end so Studio can trim the clip precisely to the music.`;
        return {
          ...scene,
          duration: generationDuration,
          captionStart: scene.captionStart === undefined ? undefined : Number(Math.min(generationDuration, scene.captionStart * scale).toFixed(2)),
          captionEnd: scene.captionEnd === undefined ? undefined : Number(Math.min(generationDuration, scene.captionEnd * scale).toFixed(2)),
          prompt: `${scene.prompt} ${timingDirection}`,
        };
      }),
    };
  }, [episode, timings]);

  return <>
    <MusicalEpisodePanel episode={episode} onTimingChange={setTimings} />
    {timedEpisode ? <>
      <div style={{margin:"0 0 16px",padding:"12px 16px",border:"1px solid #999",borderRadius:12,background:"#f7f7f7",color:"#111"}}>
        <b>STEP 2 — Generate scenes to the locked song timeline</b>
        <p style={{margin:"6px 0 0"}}>The scene lengths below are derived from the song timestamps. Seedance generates up to 15 seconds per source clip; if a musical beat is longer, Studio holds the final reaction pose to cover the remaining song time.</p>
      </div>
      <EpisodeWorkspace episode={timedEpisode} />
    </> : <div style={{margin:"0 0 24px",padding:18,border:"2px dashed #999",borderRadius:14}}><b>Scenes are locked until the song is generated.</b><p style={{margin:"6px 0 0"}}>Generate the song first. Studio will timestamp it and then unlock the six scene generators using that timing.</p></div>}
  </>;
}
