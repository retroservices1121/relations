"use client";

import { useEffect, useState } from "react";
import styles from "./CartoonFaceWorkspace.module.css";

type Character = "joe" | "danda";
type Job = { requestId: string; index: number; duration: number };
type Stage = "idle" | "uploading" | "ready" | "processing" | "assembling" | "done" | "error";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const referenceKey = (character: Character) => `relations:trend-remake:full-body:${character}`;

export default function TrendRemakePanel() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [references, setReferences] = useState<Record<Character, string>>({ joe: "", danda: "" });
  const [uploadingReference, setUploadingReference] = useState<Character | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState("");
  const [withAudioUrl, setWithAudioUrl] = useState("");
  const [silentUrl, setSilentUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setReferences({
      joe: localStorage.getItem(referenceKey("joe")) || `${window.location.origin}/characters/joe-full-body.png`,
      danda: localStorage.getItem(referenceKey("danda")) || `${window.location.origin}/characters/danda-full-body.png`,
    });
  }, []);

  async function uploadVideo(file?: File) {
    if (!file) return;
    setStage("uploading"); setError(""); setWithAudioUrl(""); setSilentUrl("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload-video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Trend upload failed.");
      setSourceUrl(data.url); setStage("ready");
    } catch (value) { setStage("error"); setError(value instanceof Error ? value.message : "Trend upload failed."); }
  }

  async function uploadReference(character: Character, file?: File) {
    if (!file) return;
    setUploadingReference(character); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload-reference", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw Error(data.error || "Reference upload failed.");
      localStorage.setItem(referenceKey(character), data.url);
      setReferences((current) => ({ ...current, [character]: data.url }));
    } catch (value) { setError(value instanceof Error ? value.message : "Reference upload failed."); }
    finally { setUploadingReference(null); }
  }

  async function createTrendRemake() {
    if (!sourceUrl) { setError("Upload the trend video first."); return; }
    if (!references.joe || !references.danda) { setError("Upload the full-body Joe and Danda images first."); return; }
    setStage("processing"); setProgress("Preparing the source video…"); setError(""); setWithAudioUrl(""); setSilentUrl("");
    try {
      const started = await fetch("/api/trend-remake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", videoUrl: sourceUrl, referenceUrls: references }) });
      const startData = await started.json();
      if (!started.ok) throw Error(startData.error || "Could not start the trend remake.");
      const jobs = startData.jobs as Job[];
      if (!Array.isArray(jobs) || !jobs.length) throw Error("No trend-remake jobs were created.");
      let finished: Array<{ requestId: string; status: string; url?: string }> = [];
      for (let attempt = 0; attempt < 240; attempt += 1) {
        await sleep(5000);
        const response = await fetch(`/api/trend-remake?requestIds=${encodeURIComponent(jobs.map((job) => job.requestId).join(","))}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not check the trend remake.");
        finished = Array.isArray(data.segments) ? data.segments : [];
        if (finished.some((item) => item.status === "FAILED")) throw Error("One section could not be transformed. Please try the remake again.");
        const completed = finished.filter((item) => item.status === "COMPLETED" && item.url).length;
        setProgress(`Transforming Joe and Danda: ${completed} of ${jobs.length} sections ready…`);
        if (completed === jobs.length) break;
      }
      if (finished.filter((item) => item.status === "COMPLETED" && item.url).length !== jobs.length) throw Error("The trend remake is still processing. Please try again shortly.");
      const byRequest = new Map(finished.map((item) => [item.requestId, item]));
      const segments = jobs.map((job) => ({ index: job.index, duration: job.duration, url: byRequest.get(job.requestId)?.url || "" }));
      setStage("assembling"); setProgress("Reconnecting the video and restoring the original audio…");
      const finalResponse = await fetch("/api/trend-remake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", sourceUrl, segments, width: startData.width, height: startData.height }) });
      const finalData = await finalResponse.json();
      if (!finalResponse.ok) throw Error(finalData.error || "Could not assemble the trend remake.");
      setWithAudioUrl(finalData.withAudioUrl); setSilentUrl(finalData.silentUrl); setProgress(""); setStage("done");
    } catch (value) { setStage("error"); setProgress(""); setError(value instanceof Error ? value.message : "Trend remake failed."); }
  }

  const busy = stage === "uploading" || stage === "processing" || stage === "assembling";
  return <section className={styles.trendPanel}>
    <div className={styles.trendHeading}>
      <div><span className={styles.kicker}>One-time trend remake</span><h2>Full Cartoon Trend Remake</h2><p>Turn both performers into full-body Joe and Danda while preserving the reference choreography, set, microphone, cuts and timing.</p></div>
      <span className={`${styles.stateBadge} ${stage === "done" ? styles.stateReady : ""}`}>{stage === "done" ? "Remake ready" : busy ? "Processing" : "Setup required"}</span>
    </div>
    <div className={styles.trendSteps}>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>01</span><b>Upload trend video</b></div><p>Use the original MP4 or MOV. Videos from 4 to 60 seconds are supported.</p><label className={styles.fileButton}>{sourceUrl ? "Replace trend video" : "Choose trend video"}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy} onChange={(event) => { void uploadVideo(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{sourceUrl && <small className={styles.uploadReady}>✓ Trend video ready</small>}</section>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>02</span><b>Upload full-body characters</b></div><p>Joe replaces the left performer. Danda replaces the right performer.</p><div className={styles.referenceList}>{(["joe", "danda"] as Character[]).map((character) => { const ready = Boolean(references[character]); const name = character === "joe" ? "Joe" : "Danda"; return <div className={styles.referenceRow} key={character}>{ready ? <img src={references[character]} alt={`${name} full-body reference`} /> : <span className={styles.referencePlaceholder}>{name[0]}</span>}<span className={styles.referenceName}><i className={ready ? styles.readyDot : styles.missingDot} />{name} full body <b>{ready ? "Ready" : "Missing"}</b></span><label className={styles.referenceButton}>{uploadingReference === character ? "Uploading…" : ready ? "Replace" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploadingReference !== null} onChange={(event) => { void uploadReference(character, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>; })}</div></section>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>03</span><b>Create both exports</b></div><p>Relations processes long clips in balanced sections, reconnects them, and restores the source audio. Character transformation uses your fal.ai credits.</p><button className={styles.primaryButton} type="button" disabled={busy || !sourceUrl || !references.joe || !references.danda} onClick={() => void createTrendRemake()}>{stage === "processing" ? "Transforming Characters…" : stage === "assembling" ? "Building Final Videos…" : stage === "done" ? "Regenerate Trend Remake" : "Create Joe + Danda Remake"}</button></section>
    </div>
    {progress && <p className={styles.notice} role="status">{progress}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {(sourceUrl || withAudioUrl) && <div className={styles.previewGrid}>{sourceUrl && <article className={styles.previewCard}><div className={styles.previewHead}><div><span>Reference</span><h3>Original trend</h3></div><small>Motion source</small></div><video src={sourceUrl} controls playsInline /></article>}{withAudioUrl && <article className={`${styles.previewCard} ${styles.processedCard}`}><div className={styles.previewHead}><div><span>Finished</span><h3>Joe + Danda trend</h3></div><small>Original audio</small></div><video src={withAudioUrl} controls playsInline /><div className={styles.resultLinks}><a href={withAudioUrl} target="_blank" rel="noreferrer">Open with original audio ↗</a>{silentUrl && <a href={silentUrl} target="_blank" rel="noreferrer">Open silent Instagram version ↗</a>}</div></article>}</div>}
  </section>;
}
