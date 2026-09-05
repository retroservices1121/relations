"use client";

import { useEffect, useState } from "react";
import type { Episode } from "../data/episodes";

type SceneState = {
  status: "idle" | "queued" | "generating" | "done" | "error";
  videoUrl?: string;
  error?: string;
  requestId?: string;
};

type CharacterKey = "joe" | "danda";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const JOE_STORAGE_KEY = "relations:character:joe";
const DANDA_STORAGE_KEY = "relations:character:danda";

export default function EpisodeWorkspace({ episode }: { episode: Episode }) {
  const [joeUrl, setJoeUrl] = useState("");
  const [dandaUrl, setDandaUrl] = useState("");
  const [model, setModel] = useState("seedance-fast");
  const [sceneStates, setSceneStates] = useState<Record<number, SceneState>>({});
  const [uploading, setUploading] = useState<CharacterKey | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");

  async function loadBalance() {
    try {
      const response = await fetch("/api/fal-balance", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load balance");
      setBalance(typeof data.balance === "number" ? data.balance : null);
      setBalanceError("");
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : "Balance unavailable");
    }
  }

  useEffect(() => {
    setJoeUrl(localStorage.getItem(JOE_STORAGE_KEY) || "");
    setDandaUrl(localStorage.getItem(DANDA_STORAGE_KEY) || "");
    void loadBalance();
  }, []);

  function persistReference(character: CharacterKey, url: string) {
    if (character === "joe") {
      setJoeUrl(url);
      if (url) localStorage.setItem(JOE_STORAGE_KEY, url);
      else localStorage.removeItem(JOE_STORAGE_KEY);
    } else {
      setDandaUrl(url);
      if (url) localStorage.setItem(DANDA_STORAGE_KEY, url);
      else localStorage.removeItem(DANDA_STORAGE_KEY);
    }
  }

  async function uploadReference(character: CharacterKey, file?: File) {
    if (!file) return;
    setUploading(character);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload-reference", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      if (!data.url) throw new Error("Upload completed without a file URL");
      persistReference(character, data.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function pollForResult(index: number, requestId: string, selectedModel: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(3000);
      const response = await fetch(`/api/generate-video?requestId=${encodeURIComponent(requestId)}&model=${encodeURIComponent(selectedModel)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check generation status");

      if (data.status === "COMPLETED" && data.videoUrl) {
        setSceneStates((prev) => ({ ...prev, [index]: { status: "done", videoUrl: data.videoUrl, requestId } }));
        void loadBalance();
        return;
      }

      setSceneStates((prev) => ({ ...prev, [index]: { ...prev[index], status: "generating", requestId } }));
    }

    throw new Error("Generation is still running. Try Generate Scene again in a moment to start a new job.");
  }

  async function generateScene(index: number) {
    const scene = episode.scenes[index];
    const imageUrls = [joeUrl, dandaUrl].map((v) => v.trim()).filter(Boolean);
    const selectedModel = model;

    if (imageUrls.length < 2) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: { status: "error", error: "Upload both approved cartoon references for Joe and Danda before generating this scene." },
      }));
      return;
    }

    setSceneStates((prev) => ({ ...prev, [index]: { status: "queued" } }));

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          duration: scene.duration,
          imageUrls,
          prompt: `Use the approved recurring cartoon character assets exactly as shown in the references. @Image1 is Joe. @Image2 is Danda. Preserve their faces, hairstyles, clothing identity and overall 2D cartoon design. CHARACTER PROPORTIONS ARE LOCKED: Joe has an average, slightly stocky everyday-dad build. He is not muscular, athletic, bodybuilder-like, broad-chested or physically defined; keep his arms, shoulders and chest naturally proportioned and soft. Danda is visibly shorter than Joe whenever they appear together. Maintain a clear, consistent height difference in every shared shot, with the top of Danda's head below Joe's. Do not make them the same height. Preserve these body types and relative heights consistently throughout the video. Do not reinterpret them as photorealistic people. Vertical 9:16 relationship-comedy short. Scene action: ${scene.prompt}${scene.caption ? ` On-screen caption: ${scene.caption}` : ""}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      if (!data.requestId) throw new Error("fal did not return a request ID");

      setSceneStates((prev) => ({ ...prev, [index]: { status: "generating", requestId: data.requestId } }));
      await pollForResult(index, data.requestId, selectedModel);
    } catch (error) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: { status: "error", error: error instanceof Error ? error.message : "Generation failed" },
      }));
      void loadBalance();
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
          <div className="creditBalance" onClick={() => void loadBalance()} title="Tap to refresh fal balance">
            <span>fal credits</span>
            <b>{balance === null ? (balanceError ? "Unavailable" : "Loading…") : `$${balance.toFixed(2)}`}</b>
          </div>
          <label>Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="seedance-fast">Seedance 2 Fast</option>
              <option value="seedance-standard">Seedance 2 Standard</option>
            </select>
          </label>
        </div>
      </div>

      <section className="referencePanel">
        <div>
          <span className="eyebrow">LOCKED CHARACTER LIBRARY</span>
          <h2>Joe + Danda references</h2>
          <p>Use the final cartoon character images here. Once uploaded, they are remembered and reused automatically across every episode on this device.</p>
          <p className="statusText">Do not upload real-person source photos here. Seedance can reject them. Upload only the approved cartoon Joe and Danda assets.</p>
          {uploadError && <p className="errorText">{uploadError}</p>}
        </div>
        <div className="referenceInputs">
          <div className="characterRef">
            <label>Joe cartoon reference {joeUrl && "✓ Locked"}</label>
            {joeUrl && <img className="referenceThumb" src={joeUrl} alt="Joe cartoon reference" />}
            <label className="uploadButton">
              {uploading === "joe" ? "Uploading Joe…" : joeUrl ? "Replace Joe Cartoon" : "Upload Joe Cartoon"}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(e) => uploadReference("joe", e.target.files?.[0])} />
            </label>
            <input value={joeUrl} onChange={(e) => persistReference("joe", e.target.value)} placeholder="Or paste the approved Joe cartoon URL" />
          </div>

          <div className="characterRef">
            <label>Danda cartoon reference {dandaUrl && "✓ Locked"}</label>
            {dandaUrl && <img className="referenceThumb" src={dandaUrl} alt="Danda cartoon reference" />}
            <label className="uploadButton">
              {uploading === "danda" ? "Uploading Danda…" : dandaUrl ? "Replace Danda Cartoon" : "Upload Danda Cartoon"}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(e) => uploadReference("danda", e.target.files?.[0])} />
            </label>
            <input value={dandaUrl} onChange={(e) => persistReference("danda", e.target.value)} placeholder="Or paste the approved Danda cartoon URL" />
          </div>
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
              {state.status === "queued" && <p className="statusText">Submitting to fal queue…</p>}
              {state.status === "generating" && <p className="statusText">Generating on fal… this page will update automatically.</p>}
              {state.error && <p className="errorText">{state.error}</p>}
              <button disabled={state.status === "queued" || state.status === "generating"} onClick={() => generateScene(index)}>
                {state.status === "queued" ? "Submitting…" : state.status === "generating" ? "Generating…" : state.status === "done" ? "Regenerate Scene" : "Generate Scene"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
