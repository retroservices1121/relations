"use client";

import { useMemo, useState } from "react";
import styles from "./CartoonFaceWorkspace.module.css";

type UploadTarget = "base" | "layer";
type HorizontalPosition = "left" | "center" | "right";
type VerticalPosition = "top" | "middle" | "bottom";

export default function LayeredSocialPanel() {
  const [baseUrl, setBaseUrl] = useState("");
  const [layerUrl, setLayerUrl] = useState("");
  const [caption, setCaption] = useState("My brain anytime he starts\ntalking about finances");
  const [duration, setDuration] = useState(8);
  const [opacity, setOpacity] = useState(42);
  const [scale, setScale] = useState(72);
  const [horizontal, setHorizontal] = useState<HorizontalPosition>("center");
  const [vertical, setVertical] = useState<VerticalPosition>("middle");
  const [busy, setBusy] = useState<UploadTarget | "render" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [finalUrl, setFinalUrl] = useState("");

  const planningEstimate = useMemo(() => 0.15 + duration * 0.03, [duration]);

  async function upload(target: UploadTarget, file?: File) {
    if (!file) return;
    setBusy(target); setError(""); setFinalUrl("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload-video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw Error(data.error || "Video upload failed.");
      if (target === "base") setBaseUrl(data.url); else setLayerUrl(data.url);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Video upload failed.");
    } finally { setBusy(null); }
  }

  async function render() {
    if (!baseUrl || !layerUrl) { setError("Add both the base scene and the green-screen character layer."); return; }
    setBusy("render"); setError(""); setFinalUrl(""); setStatus("Compositing the silent social video…");
    try {
      const response = await fetch("/api/render-daydream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, dancerUrl: layerUrl, caption, duration, opacity: opacity / 100, scale: scale / 100, horizontal, vertical }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw Error(data.error || "The layered video could not be built.");
      setFinalUrl(data.url); setStatus("Silent social video ready.");
    } catch (value) {
      setStatus(""); setError(value instanceof Error ? value.message : "The layered video could not be built.");
    } finally { setBusy(null); }
  }

  return <section className={styles.layeredPanel}>
    <div className={styles.trendHeading}>
      <div><span className={styles.kicker}>Recommended · lowest-cost workflow</span><h2>Layered Social Video</h2><p>Build memes, daydreams, reaction scenes, ghosts and imaginary duplicates from separate controlled clips. Relations combines them without another generative pass and always exports this mode silent for Instagram audio.</p></div>
      <span className={`${styles.stateBadge} ${finalUrl ? styles.stateReady : ""}`}>{finalUrl ? "Export ready" : busy ? "Working" : "No assembly credits"}</span>
    </div>

    <div className={styles.layeredSummary}>
      <div><span>Assembly cost</span><strong>$0</strong><small>Compositing, caption and silent export</small></div>
      <div><span>{duration}-second benchmark</span><strong>${planningEstimate.toFixed(2)}</strong><small>Planning example: one anchor + two short H3 layers</small></div>
      <div><span>Audio behavior</span><strong>Silent</strong><small>Add a licensed or trending song on Instagram</small></div>
    </div>

    <div className={styles.layeredSteps}>
      <section className={styles.setupCard}>
        <div className={styles.stepTop}><span>01</span><b>Add the stable scene</b></div>
        <p>Upload the finished clip where the main characters and environment stay consistent.</p>
        <label className={styles.fileButton}>{busy === "base" ? "Uploading…" : baseUrl ? "Replace base scene" : "Choose base scene"}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy !== null} onChange={(event) => { void upload("base", event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        {baseUrl && <small className={styles.uploadReady}>✓ Base scene ready</small>}
      </section>
      <section className={styles.setupCard}>
        <div className={styles.stepTop}><span>02</span><b>Add the character layer</b></div>
        <p>Upload the separate performance on a bright green background. Relations removes the green and makes the character translucent.</p>
        <label className={styles.fileButton}>{busy === "layer" ? "Uploading…" : layerUrl ? "Replace character layer" : "Choose green-screen layer"}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy !== null} onChange={(event) => { void upload("layer", event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        {layerUrl && <small className={styles.uploadReady}>✓ Character layer ready</small>}
      </section>
      <section className={styles.setupCard}>
        <div className={styles.stepTop}><span>03</span><b>Direct the effect</b></div>
        <div className={styles.effectControls}>
          <label><span>Length</span><input type="number" min="2" max="15" step="1" value={duration} disabled={busy !== null} onChange={(event) => setDuration(Math.min(15, Math.max(2, Number(event.target.value) || 2)))} /><small>sec</small></label>
          <label><span>Opacity</span><input type="range" min="20" max="80" value={opacity} disabled={busy !== null} onChange={(event) => setOpacity(Number(event.target.value))} /><small>{opacity}%</small></label>
          <label><span>Size</span><input type="range" min="35" max="90" value={scale} disabled={busy !== null} onChange={(event) => setScale(Number(event.target.value))} /><small>{scale}%</small></label>
          <label><span>Horizontal</span><select value={horizontal} disabled={busy !== null} onChange={(event) => setHorizontal(event.target.value as HorizontalPosition)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          <label><span>Vertical</span><select value={vertical} disabled={busy !== null} onChange={(event) => setVertical(event.target.value as VerticalPosition)}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
        </div>
      </section>
    </div>

    <div className={styles.captionComposer}>
      <label><span>On-screen caption</span><textarea value={caption} maxLength={120} disabled={busy !== null} onChange={(event) => setCaption(event.target.value)} placeholder="Optional caption" /></label>
      <div><b>Generation spending stops before this step.</b><p>Relations only removes the green background, positions the effect, adds the caption and writes the silent MP4.</p><button className={styles.primaryButton} type="button" disabled={busy !== null || !baseUrl || !layerUrl} onClick={() => void render()}>{busy === "render" ? "Building Silent Video…" : finalUrl ? "Build Another Version" : "Build Silent Social Video"}</button></div>
    </div>

    {status && <p className={styles.notice} role="status">{status}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {(baseUrl || layerUrl || finalUrl) && <div className={styles.layeredPreviewGrid}>
      {baseUrl && <article className={styles.previewCard}><div className={styles.previewHead}><div><span>Base</span><h3>Stable scene</h3></div><small>Full opacity</small></div><video src={baseUrl} controls playsInline muted /></article>}
      {layerUrl && <article className={styles.previewCard}><div className={styles.previewHead}><div><span>Effect</span><h3>Green-screen layer</h3></div><small>{opacity}% opacity</small></div><video src={layerUrl} controls playsInline muted /></article>}
      {finalUrl && <article className={`${styles.previewCard} ${styles.processedCard}`}><div className={styles.previewHead}><div><span>Finished</span><h3>Silent social export</h3></div><small>Instagram ready</small></div><video src={finalUrl} controls playsInline muted /><div className={styles.resultLinks}><a href={finalUrl} target="_blank" rel="noreferrer">Open finished MP4 ↗</a><a href={`/api/download-video?url=${encodeURIComponent(finalUrl)}&filename=relations-layered-social.mp4`}>Download MP4</a></div></article>}
    </div>}
  </section>;
}

