"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Episode } from "../data/episodes";

type SceneState = {
  status: "idle" | "queued" | "generating" | "saving" | "done" | "error";
  videoUrl?: string;
  error?: string;
  requestId?: string;
  persisted?: boolean;
};

type OverlayPosition = "top" | "middle" | "bottom";
type OverlayConfig = {
  text: string;
  position: OverlayPosition;
  start: number;
  end: number;
};

type CharacterKey = "joe" | "danda";

type DatabaseScene = {
  scene_index: number;
  video_url?: string | null;
  request_id?: string | null;
  persisted?: boolean;
  overlay_text?: string | null;
  overlay_position?: string | null;
  overlay_start?: number | null;
  overlay_end?: number | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const JOE_STORAGE_KEY = "relations:character:joe";
const DANDA_STORAGE_KEY = "relations:character:danda";

export default function EpisodeWorkspace({ episode }: { episode: Episode }) {
  const [joeUrl, setJoeUrl] = useState("");
  const [dandaUrl, setDandaUrl] = useState("");
  const [model, setModel] = useState("seedance-fast");
  const [sceneStates, setSceneStates] = useState<Record<number, SceneState>>({});
  const [overlays, setOverlays] = useState<Record<number, OverlayConfig>>({});
  const [uploading, setUploading] = useState<CharacterKey | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [renderingFinal, setRenderingFinal] = useState(false);
  const [finalUrl, setFinalUrl] = useState("");
  const [finalError, setFinalError] = useState("");
  const overlayTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const projectStorageKey = `relations:project:${episode.id}`;

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
    let cancelled = false;
    setJoeUrl(localStorage.getItem(JOE_STORAGE_KEY) || "");
    setDandaUrl(localStorage.getItem(DANDA_STORAGE_KEY) || "");

    const defaultOverlays = Object.fromEntries(
      episode.scenes.map((scene, index) => [
        index,
        { text: scene.caption || "", position: "bottom" as OverlayPosition, start: 0, end: scene.duration },
      ]),
    );

    let localStates: Record<number, SceneState> = {};
    let localOverlays: Record<number, OverlayConfig> = defaultOverlays;
    let localFinalUrl = "";
    try {
      const saved = localStorage.getItem(projectStorageKey);
      if (saved) {
        const project = JSON.parse(saved) as {
          sceneStates?: Record<number, SceneState>;
          overlays?: Record<number, OverlayConfig>;
          finalUrl?: string;
        };
        localStates = project.sceneStates || {};
        localOverlays = { ...defaultOverlays, ...(project.overlays || {}) };
        localFinalUrl = project.finalUrl || "";
      }
    } catch {
      // Local cache is optional; Railway Postgres is the primary project store.
    }

    setSceneStates(localStates);
    setOverlays(localOverlays);
    setFinalUrl(localFinalUrl);

    void (async () => {
      try {
        const response = await fetch(`/api/project?episodeId=${encodeURIComponent(episode.id)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load Railway project data");
        if (cancelled) return;

        const dbStates: Record<number, SceneState> = {};
        const dbOverlays: Record<number, OverlayConfig> = { ...defaultOverlays };
        for (const row of (data.scenes || []) as DatabaseScene[]) {
          const index = Number(row.scene_index);
          if (!Number.isInteger(index) || index < 0 || index >= episode.scenes.length) continue;
          if (row.video_url) {
            dbStates[index] = {
              status: "done",
              videoUrl: row.video_url,
              requestId: row.request_id || undefined,
              persisted: Boolean(row.persisted),
            };
          }
          dbOverlays[index] = {
            text: row.overlay_text ?? defaultOverlays[index].text,
            position: ["top", "middle", "bottom"].includes(row.overlay_position || "")
              ? (row.overlay_position as OverlayPosition)
              : defaultOverlays[index].position,
            start: Number(row.overlay_start ?? defaultOverlays[index].start),
            end: Number(row.overlay_end || defaultOverlays[index].end),
          };
        }
        setSceneStates((prev) => ({ ...prev, ...dbStates }));
        setOverlays((prev) => ({ ...prev, ...dbOverlays }));
        setFinalUrl(data.finalUrl || "");
        setStorageError("");
      } catch (error) {
        if (!cancelled) {
          setStorageError(`${error instanceof Error ? error.message : "Railway project storage unavailable"} Local device cache is being used until Postgres is connected.`);
        }
      } finally {
        if (!cancelled) setProjectLoaded(true);
      }
    })();

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [episode.id, episode.scenes, projectStorageKey]);

  useEffect(() => {
    if (!projectLoaded) return;
    localStorage.setItem(projectStorageKey, JSON.stringify({ sceneStates, overlays, finalUrl }));
  }, [sceneStates, overlays, finalUrl, projectLoaded, projectStorageKey]);

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

  async function saveGeneratedVideo(index: number, requestId: string, sourceUrl: string) {
    setSceneStates((prev) => ({ ...prev, [index]: { ...prev[index], status: "saving", requestId, videoUrl: sourceUrl } }));
    const response = await fetch("/api/persist-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl, episodeId: episode.id, sceneIndex: index, requestId }),
    });
    const data = await response.json();

    if (!response.ok) {
      setStorageError(data.error || "Permanent storage is not configured.");
      setSceneStates((prev) => ({ ...prev, [index]: { status: "done", videoUrl: sourceUrl, requestId, persisted: false } }));
      return;
    }

    setStorageError("");
    setSceneStates((prev) => ({ ...prev, [index]: { status: "done", videoUrl: data.url, requestId, persisted: true } }));
  }

  async function pollForResult(index: number, requestId: string, selectedModel: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(3000);
      const response = await fetch(`/api/generate-video?requestId=${encodeURIComponent(requestId)}&model=${encodeURIComponent(selectedModel)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check generation status");

      if (data.status === "COMPLETED" && data.videoUrl) {
        await saveGeneratedVideo(index, requestId, data.videoUrl);
        void loadBalance();
        return;
      }
      setSceneStates((prev) => ({ ...prev, [index]: { ...prev[index], status: "generating", requestId } }));
    }
    throw new Error("Generation is still running. Try Generate Scene again in a moment to start a new job.");
  }

  function clearSavedFinal() {
    setFinalUrl("");
    setFinalError("");
    void fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-final", episodeId: episode.id }),
    }).catch(() => undefined);
  }

  async function generateScene(index: number) {
    const scene = episode.scenes[index];
    const imageUrls = [joeUrl, dandaUrl].map((v) => v.trim()).filter(Boolean);
    const selectedModel = model;

    if (imageUrls.length < 2) {
      setSceneStates((prev) => ({ ...prev, [index]: { status: "error", error: "Upload both approved cartoon references for Joe and Danda before generating this scene." } }));
      return;
    }

    clearSavedFinal();
    setSceneStates((prev) => ({ ...prev, [index]: { status: "queued" } }));

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          duration: scene.duration,
          imageUrls,
          prompt: `Use the approved recurring cartoon character assets exactly as shown in the references. @Image1 is Joe. @Image2 is Danda. Preserve their faces, hairstyles, clothing identity and overall 2D cartoon design. CHARACTER PROPORTIONS ARE LOCKED: Joe has an average, slightly stocky everyday-dad build. He is not muscular, athletic, bodybuilder-like, broad-chested or physically defined; keep his arms, shoulders and chest naturally proportioned and soft. Danda is only moderately shorter than Joe, like a normal adult couple with a modest height difference. When standing side by side, the top of Danda's head should reach approximately Joe's eye or eyebrow level. Do NOT make Danda tiny, child-sized, miniature, dramatically shorter, or disproportionately small. Both are normally proportioned adults. Preserve this subtle relative height difference consistently throughout the video. STYLE AND AUDIO ARE LOCKED: simple flat 2D cartoon comedy with clean bold outlines, exaggerated facial expressions, exaggerated physical reactions, playful visual timing and readable uncluttered backgrounds. NO SPOKEN DIALOGUE. NO TALKING. NO LIP-SYNCED SPEECH. Characters communicate only through facial expressions, gestures, body language and physical comedy. Generate natural environmental audio and playful cartoon sound effects appropriate to the visible action, such as whooshes, pops, footsteps, clothing movement, clock ticks and comedic stings when appropriate. Do NOT generate captions, subtitles, speech bubbles, signs, labels, written dialogue or other on-screen text. All dialogue and text overlays will be added later in post-production. Do not reinterpret them as photorealistic people. Vertical 9:16 relationship-comedy short. Scene action: ${scene.prompt}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      if (!data.requestId) throw new Error("fal did not return a request ID");
      setSceneStates((prev) => ({ ...prev, [index]: { status: "generating", requestId: data.requestId } }));
      await pollForResult(index, data.requestId, selectedModel);
    } catch (error) {
      setSceneStates((prev) => ({ ...prev, [index]: { status: "error", error: error instanceof Error ? error.message : "Generation failed" } }));
      void loadBalance();
    }
  }

  function updateOverlay(index: number, patch: Partial<OverlayConfig>) {
    const current = overlays[index] || { text: "", position: "bottom" as OverlayPosition, start: 0, end: episode.scenes[index].duration };
    const next = { ...current, ...patch };
    setOverlays((prev) => ({ ...prev, [index]: next }));
    clearSavedFinal();

    if (overlayTimers.current[index]) clearTimeout(overlayTimers.current[index]);
    overlayTimers.current[index] = setTimeout(() => {
      void fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, sceneIndex: index, ...next }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Could not save overlay to Railway Postgres");
        }
        setStorageError("");
      }).catch((error) => {
        setStorageError(error instanceof Error ? error.message : "Could not save overlay to Railway Postgres");
      });
    }, 500);
  }

  const allScenesReady = useMemo(
    () => episode.scenes.every((_, index) => sceneStates[index]?.status === "done" && Boolean(sceneStates[index]?.videoUrl) && sceneStates[index]?.persisted === true),
    [episode.scenes, sceneStates],
  );

  async function buildFinalVideo() {
    if (!allScenesReady) {
      setFinalError("Generate and permanently save every scene before building the final episode.");
      return;
    }

    setRenderingFinal(true);
    setFinalError("");
    try {
      const scenes = episode.scenes.map((scene, index) => ({
        videoUrl: sceneStates[index].videoUrl,
        text: overlays[index]?.text || "",
        position: overlays[index]?.position || "bottom",
        start: overlays[index]?.start ?? 0,
        end: overlays[index]?.end ?? scene.duration,
      }));
      const response = await fetch("/api/render-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, scenes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Final render failed");
      setFinalUrl(data.url);
    } catch (error) {
      setFinalError(error instanceof Error ? error.message : "Final render failed");
    } finally {
      setRenderingFinal(false);
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
          <p className="statusText">Silent-cartoon format is locked: no AI dialogue or generated text. Studio overlays are added after the scenes are approved.</p>
          <p className="statusText">Production storage: Railway Postgres saves the project data and Cloudflare R2 saves the actual video files.</p>
          <p className="statusText">Do not upload real-person source photos here. Seedance can reject them. Upload only the approved cartoon Joe and Danda assets.</p>
          {uploadError && <p className="errorText">{uploadError}</p>}
          {storageError && <p className="errorText">{storageError}</p>}
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
          const overlay = overlays[index] || { text: scene.caption || "", position: "bottom", start: 0, end: scene.duration };
          return (
            <article className="sceneCard" key={index}>
              <div className="sceneMeta"><span>SCENE {index + 1}</span><b>{scene.duration}s</b></div>
              <h3>{scene.prompt}</h3>

              {state.videoUrl && (
                <div className="videoPreviewWrap">
                  <video className="sceneVideo" src={state.videoUrl} controls playsInline />
                  {overlay.text && <div className={`overlayPreview overlay-${overlay.position}`}>{overlay.text}</div>}
                </div>
              )}

              {state.status === "queued" && <p className="statusText">Submitting to fal queue…</p>}
              {state.status === "generating" && <p className="statusText">Generating on fal… this page will update automatically.</p>}
              {state.status === "saving" && <p className="statusText">Generation complete. Saving scene to Cloudflare R2 + Railway Postgres…</p>}
              {state.status === "done" && <p className={state.persisted ? "savedText" : "errorText"}>{state.persisted ? "✓ Saved permanently to R2" : "⚠ Showing fal copy; R2/Postgres storage is not ready"}</p>}
              {state.error && <p className="errorText">{state.error}</p>}

              <div className="overlayEditor">
                <span className="eyebrow">TEXT OVERLAY — ADDED AFTER GENERATION</span>
                <label>Overlay text
                  <textarea value={overlay.text} onChange={(e) => updateOverlay(index, { text: e.target.value })} placeholder="Optional caption or dialogue added in post" />
                </label>
                <div className="overlayGrid">
                  <label>Position
                    <select value={overlay.position} onChange={(e) => updateOverlay(index, { position: e.target.value as OverlayPosition })}>
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                  <label>Start (sec)
                    <input type="number" min="0" max={scene.duration} step="0.1" value={overlay.start} onChange={(e) => updateOverlay(index, { start: Number(e.target.value) })} />
                  </label>
                  <label>End (sec)
                    <input type="number" min="0" max={scene.duration} step="0.1" value={overlay.end} onChange={(e) => updateOverlay(index, { end: Number(e.target.value) })} />
                  </label>
                </div>
              </div>

              <button disabled={["queued", "generating", "saving"].includes(state.status)} onClick={() => generateScene(index)}>
                {state.status === "queued" ? "Submitting…" : state.status === "generating" ? "Generating…" : state.status === "saving" ? "Saving…" : state.status === "done" ? "Regenerate Scene" : "Generate Scene"}
              </button>
            </article>
          );
        })}
      </div>

      <section className="finalBuilder">
        <span className="eyebrow">FINAL EPISODE</span>
        <h2>Build the finished short</h2>
        <p>Once every scene is approved and saved to R2, Studio stitches them in order, burns in your timed text overlays, keeps the scene audio and sound effects, and saves one final vertical MP4 back to R2.</p>
        <button disabled={!allScenesReady || renderingFinal} onClick={() => void buildFinalVideo()}>
          {renderingFinal ? "Rendering Final Video…" : "Build Final Video"}
        </button>
        {!allScenesReady && <p className="statusText">Generate and permanently save all {episode.scenes.length} scenes to unlock final rendering.</p>}
        {finalError && <p className="errorText">{finalError}</p>}
        {finalUrl && (
          <div className="finalResult">
            <p className="savedText">✓ Final episode saved permanently to R2 + Railway Postgres</p>
            <video className="finalVideo" src={finalUrl} controls playsInline />
            <a className="downloadLink" href={finalUrl} target="_blank" rel="noreferrer">Open final MP4</a>
          </div>
        )}
      </section>
    </div>
  );
}
