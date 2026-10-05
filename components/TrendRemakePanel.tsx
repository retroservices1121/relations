"use client";

import { useEffect, useState } from "react";
import styles from "./CartoonFaceWorkspace.module.css";

type Character = "joe" | "danda";
type TrendProvider = "higgsfield-genjutsu" | "fal-kling-o3" | "fal-minimax";
type ReferenceKind = "head" | "body";
type CaptionRegion = "none" | "top" | "middle" | "bottom";
type Job = { requestId: string; index: number; duration: number };
type Segment = { index: number; duration: number; url: string };
type Stage = "idle" | "uploading" | "ready" | "processing" | "assembling" | "done" | "error";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const referenceKey = (character: Character) => `relations:trend-remake:full-body:${character}`;
const headReferenceKey = (character: Character) => `relations:series:household-nonsense:character:${character}`;

export default function TrendRemakePanel() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [references, setReferences] = useState<Record<Character, string>>({ joe: "", danda: "" });
  const [headReferences, setHeadReferences] = useState<Record<Character, string>>({ joe: "", danda: "" });
  const [captionRegion, setCaptionRegion] = useState<CaptionRegion>("middle");
  const [provider, setProvider] = useState<TrendProvider>("fal-kling-o3");
  const [uploadingReference, setUploadingReference] = useState<`${Character}-${ReferenceKind}` | null>(null);
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
    setHeadReferences({
      joe: localStorage.getItem(headReferenceKey("joe")) || "",
      danda: localStorage.getItem(headReferenceKey("danda")) || "",
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

  async function uploadReference(character: Character, kind: ReferenceKind, file?: File) {
    if (!file) return;
    const uploadKey = `${character}-${kind}` as const;
    setUploadingReference(uploadKey); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/upload-reference", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw Error(data.error || "Reference upload failed.");
      const storageKey = kind === "head" ? headReferenceKey(character) : referenceKey(character);
      localStorage.setItem(storageKey, data.url);
      if (kind === "head") setHeadReferences((current) => ({ ...current, [character]: data.url }));
      else setReferences((current) => ({ ...current, [character]: data.url }));
    } catch (value) { setError(value instanceof Error ? value.message : "Reference upload failed."); }
    finally { setUploadingReference(null); }
  }

  async function lockDandaIdentity(segments: Segment[]) {
    const correctionJobs = await Promise.all(segments.map(async (segment) => {
      const response = await fetch("/api/cartoon-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: segment.url,
          cast: ["danda"],
          referenceUrls: { danda: headReferences.danda },
          targetDescriptions: {
            danda: "Danda, the female cartoon character corresponding to the source woman (normally on the viewer's right), currently rendered with an incorrect shorter hairstyle",
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.requestId !== "string") throw Error(data.error || "Could not start Danda's locked-head correction.");
      return { ...segment, requestId: data.requestId };
    }));

    for (let attempt = 0; attempt < 240; attempt += 1) {
      await sleep(5000);
      const states = await Promise.all(correctionJobs.map(async (job) => {
        const response = await fetch(`/api/cartoon-face?requestId=${encodeURIComponent(job.requestId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not check Danda's locked-head correction.");
        return { ...job, status: data.status as string, correctedUrl: typeof data.videoUrl === "string" ? data.videoUrl : "" };
      }));
      const completed = states.filter((item) => item.status === "COMPLETED" && item.correctedUrl).length;
      setProgress(`Applying Danda's exact locked cartoon head: ${completed} of ${segments.length} sections ready…`);
      if (completed === segments.length) return states.map(({ index, duration, correctedUrl }) => ({ index, duration, url: correctedUrl }));
    }
    throw Error("Danda's locked-head correction is still processing. Please try again shortly.");
  }

  async function createTrendRemake() {
    if (!sourceUrl) { setError("Upload the trend video first."); return; }
    if (!references.joe || !references.danda) { setError("Upload the full-body Joe and Danda images first."); return; }
    if (provider !== "fal-minimax" && (!headReferences.joe || !headReferences.danda)) { setError(`Upload or lock the close-up Joe and Danda cartoon heads before testing ${provider === "fal-kling-o3" ? "Kling O3" : "Genjutsu"}.`); return; }
    setStage("processing"); setProgress(captionRegion === "none" ? "Preparing the source video…" : "Preparing the source video and removing its caption band…"); setError(""); setWithAudioUrl(""); setSilentUrl("");
    try {
      const started = await fetch("/api/trend-remake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", provider, videoUrl: sourceUrl, referenceUrls: references, headReferenceUrls: headReferences, captionRegion }) });
      const startData = await started.json();
      if (!started.ok) throw Error(startData.error || "Could not start the trend remake.");
      const jobs = startData.jobs as Job[];
      if (!Array.isArray(jobs) || !jobs.length) throw Error("No trend-remake jobs were created.");
      let finished: Array<{ requestId: string; status: string; url?: string; error?: string }> = [];
      for (let attempt = 0; attempt < 240; attempt += 1) {
        await sleep(5000);
        const response = await fetch(`/api/trend-remake?provider=${encodeURIComponent(provider)}&requestIds=${encodeURIComponent(jobs.map((job) => job.requestId).join(","))}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not check the trend remake.");
        finished = Array.isArray(data.segments) ? data.segments : [];
        if (finished.some((item) => item.status === "FAILED")) throw Error(finished.find((item) => item.status === "FAILED")?.error || "One section could not be transformed. Please try the remake again.");
        const completed = finished.filter((item) => item.status === "COMPLETED" && item.url).length;
        setProgress(`Transforming Joe and Danda: ${completed} of ${jobs.length} sections ready…`);
        if (completed === jobs.length) break;
      }
      if (finished.filter((item) => item.status === "COMPLETED" && item.url).length !== jobs.length) throw Error("The trend remake is still processing. Please try again shortly.");
      const byRequest = new Map(finished.map((item) => [item.requestId, item]));
      let segments = jobs.map((job) => ({ index: job.index, duration: job.duration, url: byRequest.get(job.requestId)?.url || "" }));
      if (provider === "higgsfield-genjutsu") {
        setProgress("Genjutsu motion is ready. Starting Danda's dedicated locked-head pass…");
        segments = await lockDandaIdentity(segments);
      }
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
      <div><span className={styles.kicker}>Performance recasting</span><h2>Full Cartoon Trend Remake</h2><p>Turn both performers into full-body Joe and Danda while preserving the reference choreography, set, cuts and timing. Compare Kling O3, Higgsfield Genjutsu and MiniMax.</p></div>
      <span className={`${styles.stateBadge} ${stage === "done" ? styles.stateReady : ""}`}>{stage === "done" ? "Remake ready" : busy ? "Processing" : "Setup required"}</span>
    </div>
    <div className={styles.providerPicker} role="radiogroup" aria-label="Trend remake provider">
      <button type="button" role="radio" aria-checked={provider === "fal-kling-o3"} className={provider === "fal-kling-o3" ? styles.activeProvider : ""} disabled={busy} onClick={() => { setProvider("fal-kling-o3"); setWithAudioUrl(""); setSilentUrl(""); setStage(sourceUrl ? "ready" : "idle"); }}><span>Recommended · lower cost</span><strong>fal · Kling O3 Standard</strong><small>Single-pass full character replacement · $0.126/sec</small></button>
      <button type="button" role="radio" aria-checked={provider === "higgsfield-genjutsu"} className={provider === "higgsfield-genjutsu" ? styles.activeProvider : ""} disabled={busy} onClick={() => { setProvider("higgsfield-genjutsu"); setWithAudioUrl(""); setSilentUrl(""); setStage(sourceUrl ? "ready" : "idle"); }}><span>Premium comparison</span><strong>Higgsfield Genjutsu</strong><small>Motion Transfer + dedicated Danda locked-head pass</small></button>
      <button type="button" role="radio" aria-checked={provider === "fal-minimax"} className={provider === "fal-minimax" ? styles.activeProvider : ""} disabled={busy} onClick={() => { setProvider("fal-minimax"); setWithAudioUrl(""); setSilentUrl(""); setStage(sourceUrl ? "ready" : "idle"); }}><span>Comparison route</span><strong>fal · MiniMax H3 Max</strong><small>Reference-to-video · 768p · existing workflow</small></button>
    </div>
    <div className={styles.trendSteps}>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>01</span><b>Upload and clean source</b></div><p>Use the original MP4 or MOV. Videos from 4 to 60 seconds are supported.</p><label className={styles.fileButton}>{sourceUrl ? "Replace trend video" : "Choose trend video"}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy} onChange={(event) => { void uploadVideo(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{sourceUrl && <small className={styles.uploadReady}>✓ Trend video ready</small>}<label className={styles.captionControl}><span>Original caption location</span><select value={captionRegion} disabled={busy} onChange={(event) => setCaptionRegion(event.target.value as CaptionRegion)}><option value="middle">Middle — recommended for this test</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="none">No source captions</option></select><small>Relations blurs this source band before generation so the model cannot respell baked-in text.</small></label></section>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>02</span><b>Lock heads and bodies</b></div><p>Close-up heads control identity and hair. Full-body images control clothing and proportions.</p><div className={styles.referenceList}>{(["joe", "danda"] as Character[]).map((character) => { const name = character === "joe" ? "Joe" : "Danda"; return <div className={styles.referenceGroup} key={character}>{(["head", "body"] as ReferenceKind[]).map((kind) => { const url = kind === "head" ? headReferences[character] : references[character]; const ready = Boolean(url); const uploadKey = `${character}-${kind}` as const; return <div className={styles.referenceRow} key={kind}>{ready ? <img src={url} alt={`${name} ${kind} reference`} /> : <span className={styles.referencePlaceholder}>{name[0]}</span>}<span className={styles.referenceName}><i className={ready ? styles.readyDot : styles.missingDot} />{name} {kind === "head" ? "locked head" : "full body"} <b>{ready ? "Ready" : "Missing"}</b></span><label className={styles.referenceButton}>{uploadingReference === uploadKey ? "Uploading…" : ready ? "Replace" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploadingReference !== null} onChange={(event) => { void uploadReference(character, kind, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>; })}</div>; })}</div></section>
      <section className={styles.setupCard}><div className={styles.stepTop}><span>03</span><b>Create both exports</b></div><p>Relations processes long clips in balanced sections, reconnects them, and creates one export with the untouched source audio plus one silent export. {provider === "higgsfield-genjutsu" ? "Genjutsu also runs the paid Danda identity pass and uses both balances." : provider === "fal-kling-o3" ? "Kling O3 replaces both complete performers in one fal.ai pass." : "MiniMax uses your fal.ai credits."}</p><button className={styles.primaryButton} type="button" disabled={busy || !sourceUrl || !references.joe || !references.danda || (provider !== "fal-minimax" && (!headReferences.joe || !headReferences.danda))} onClick={() => void createTrendRemake()}>{stage === "processing" ? "Transforming Characters…" : stage === "assembling" ? "Building Final Videos…" : stage === "done" ? "Regenerate Trend Remake" : provider === "higgsfield-genjutsu" ? "Create with Danda Identity Lock" : provider === "fal-kling-o3" ? "Test Kling O3 Single Pass" : "Create Joe + Danda Remake"}</button></section>
    </div>
    {progress && <p className={styles.notice} role="status">{progress}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {(sourceUrl || withAudioUrl) && <div className={styles.previewGrid}>{sourceUrl && <article className={styles.previewCard}><div className={styles.previewHead}><div><span>Reference</span><h3>Original trend</h3></div><small>Motion source</small></div><video src={sourceUrl} controls playsInline /></article>}{withAudioUrl && <article className={`${styles.previewCard} ${styles.processedCard}`}><div className={styles.previewHead}><div><span>Finished</span><h3>Joe + Danda trend</h3></div><small>Original audio</small></div><video src={withAudioUrl} controls playsInline /><div className={styles.resultLinks}><a href={withAudioUrl} target="_blank" rel="noreferrer">Open with original audio ↗</a>{silentUrl && <a href={silentUrl} target="_blank" rel="noreferrer">Open silent Instagram version ↗</a>}</div></article>}</div>}
  </section>;
}
