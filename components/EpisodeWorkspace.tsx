"use client";

import { useState } from "react";
import type { Episode } from "../data/episodes";

type SceneState = {
  status: "idle" | "generating" | "done" | "error";
  videoUrl?: string;
  error?: string;
};

export default function EpisodeWorkspace({ episode }: { episode: Episode }) {
  const [joeUrl, setJoeUrl] = useState("");
  const [dandaUrl, setDandaUrl] = useState("");
  const [model, setModel] = useState("seedance-fast");
  const [sceneStates, setSceneStates] = useState<Record<number, SceneState>>({});

  async function generateScene(index: number) {
    const scene = episode.scenes[index];
    const imageUrls = [joeUrl, dandaUrl].map((v) => v.trim()).filter(Boolean);
    setSceneStates((prev) => ({ ...prev, [index]: { status: "generating" } }));

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          duration: scene.duration,
          imageUrls,
          prompt: `Use the recurring cartoon couple exactly as shown in the references. @Image1 is Joe when supplied first. @Image2 is Danda when supplied second. Preserve their faces, hairstyles, body proportions and overall 2D cartoon design. Vertical 9:16 relationship-comedy short. Scene action: ${scene.prompt}${scene.caption ? ` On-screen caption: ${scene.caption}` : ""}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setSceneStates((prev) => ({ ...prev, [index]: { status: "done", videoUrl: data.videoUrl } }));
    } catch (error) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: { status: "error", error: error instanceof Error ? error.message : "Generation failed" },
      }));
    }
  }

  return (
    <div className="workspace">
      <div className="workspaceTop">
        <div>
          <a className="backLink" href="/">← Episode Library</a>
          <span className="eyebrow">JOE + DANDA</span>
          <h1>{episode.title}</h1>
          <p>{episode.hook}</p>
        </div>
        <div className="workspaceControls">
          <label>Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="seedance-fast">Seedance 2 Fast</option>
              <option value="seedance-standard">Seedance 2 Standard</option>
            </select>
          </label>
        </div>
      </div>

      <section className="referencePanel">
        <div><h2>Character references</h2><p>Use public image URLs for the locked Joe and Danda character sheets.</p></div>
        <div className="referenceInputs">
          <label>Joe reference URL<input value={joeUrl} onChange={(e) => setJoeUrl(e.target.value)} placeholder="https://.../joe.png" /></label>
          <label>Danda reference URL<input value={dandaUrl} onChange={(e) => setDandaUrl(e.target.value)} placeholder="https://.../danda.png" /></label>
        </div>
      </section>

      <div className="sceneList">
        {episode.scenes.map((scene, index) => {
          const state = sceneStates[index] || { status: "idle" };
          return (
            <article className="sceneCard" key={index}>
              <div className="sceneMeta"><span>SCENE {index + 1}</span><b>{scene.duration}s</b></div>
              <h3>{scene.prompt}</h3>
              {scene.caption && <p className="captionPreview">“{scene.caption}”</p>}
              {state.videoUrl && <video className="sceneVideo" src={state.videoUrl} controls playsInline />}
              {state.error && <p className="errorText">{state.error}</p>}
              <button disabled={state.status === "generating"} onClick={() => generateScene(index)}>
                {state.status === "generating" ? "Generating…" : state.status === "done" ? "Regenerate Scene" : "Generate Scene"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
