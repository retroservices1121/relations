"use client";

import { useEffect, useMemo, useState } from "react";
import { hybridVideoBlockReason, replaceTimelineVideo, type TimelineItem } from "@/lib/hybrid-timeline";
import styles from "./CartoonFaceWorkspace.module.css";

type CastKey = "joe" | "danda";
type Status = "idle" | "uploading" | "ready" | "generating" | "done" | "error";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const refKey = (character: CastKey) => `relations:series:household-nonsense:character:${character}`;

export default function CartoonFaceWorkspace() {
  const [status, setStatus] = useState<Status>("idle");
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [cast, setCast] = useState<CastKey[]>(["joe", "danda"]);
  const [references, setReferences] = useState<Record<CastKey, string>>({ joe: "", danda: "" });
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [hybridUrl, setHybridUrl] = useState("");
  const [hybridBusy, setHybridBusy] = useState(false);

  useEffect(() => {
    setReferences({
      joe: localStorage.getItem(refKey("joe")) || "",
      danda: localStorage.getItem(refKey("danda")) || "",
    });
  }, []);

  const missing = useMemo(() => cast.filter((key) => !references[key]), [cast, references]);
  const hybridBlockReason = hybridVideoBlockReason(timeline, status, resultUrl);

  function toggleCast(key: CastKey) {
    if (cast.length === 1 && cast.includes(key)) return;
    setResultUrl("");
    setHybridUrl("");
    setError("");
    if (sourceUrl) {
      setStatus("ready");
      setTimeline((current) => replaceTimelineVideo(current, sourceUrl, "Opening video — locked heads required"));
    }
    setCast((current) =>
      current.includes(key)
        ? current.length === 1 ? current : current.filter((value) => value !== key)
        : [...current, key].slice(0, 2),
    );
  }

  async function uploadVideo(file?: File) {
    if (!file) return;
    setStatus("uploading");
    setError("");
    setResultUrl("");
    setSourceUrl("");
    setHybridUrl("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload-video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setSourceUrl(data.url);
      setTimeline((current) => current.some((item) => item.type === "video")
        ? replaceTimelineVideo(current, data.url, "Opening video — locked heads required")
        : [{ id: crypto.randomUUID(), type: "video", url: data.url, duration: 4, label: "Opening video — locked heads required" }, ...current]);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function addStill(file?: File) {
    if (!file) return;
    setError("");
    const form=new FormData();form.append("file",file);
    try { const r=await fetch("/api/upload-reference",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw Error(d.error||"Image upload failed.");
      setHybridUrl("");
      setTimeline(current=>[...current,{id:crypto.randomUUID(),type:"image",url:d.url,duration:1.5,label:`Costume still ${current.filter(x=>x.type==="image").length+1}`}]);
    } catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}
  }
  function updateDuration(id:string,value:number){setHybridUrl("");setTimeline(current=>current.map(item=>item.id===id?{...item,duration:Math.max(.5,Math.min(60,value||.5))}:item));}
  function removeItem(id:string){setHybridUrl("");setTimeline(current=>current.filter(item=>item.id!==id));}
  async function buildHybrid(){
    const blocked = hybridVideoBlockReason(timeline, status, resultUrl);
    if (blocked) { setError(blocked); return; }
    if(!timeline.length)return;setHybridBusy(true);setError("");setHybridUrl("");
    try{const r=await fetch("/api/render-hybrid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:timeline})});const d=await r.json();if(!r.ok)throw Error(d.error||"Hybrid export failed.");setHybridUrl(d.url);}
    catch(e){setError(e instanceof Error?e.message:"Hybrid export failed.");}finally{setHybridBusy(false);}
  }

  async function createCartoonVersion() {
    if (!sourceUrl) return;
    if (missing.length) {
      setError(`Open a Household Nonsense episode first and lock the ${missing.map((key) => key === "joe" ? "Joe" : "Danda").join(" and ")} character reference.`);
      return;
    }
    setStatus("generating");
    setError("");
    setResultUrl("");
    setHybridUrl("");
    setTimeline((current) => replaceTimelineVideo(current, sourceUrl, "Opening video — applying locked cartoon heads…"));
    try {
      const response = await fetch("/api/cartoon-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: sourceUrl, cast, referenceUrls: references }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the edit.");
      const requestId = data.requestId;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(3000);
        const poll = await fetch(`/api/cartoon-face?requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
        const pollData = await poll.json();
        if (!poll.ok) throw new Error(pollData.error || "Generation failed.");
        if (pollData.status === "FAILED") throw new Error(pollData.error || "Locked-head processing failed. Please try again.");
        if (pollData.status === "COMPLETED") {
          if (typeof pollData.videoUrl !== "string" || !pollData.videoUrl.trim() || pollData.videoUrl === sourceUrl) {
            throw new Error("Locked-head processing did not return a processed video. Please try again before building the hybrid video.");
          }
          setResultUrl(pollData.videoUrl);
          const names = cast.map((key) => key === "joe" ? "Joe" : "Danda").join(" and ");
          setTimeline((current) => replaceTimelineVideo(current, pollData.videoUrl, `Opening video — locked ${names} cartoon ${cast.length === 1 ? "head" : "heads"} applied`));
          setStatus("done");
          return;
        }
      }
      throw new Error("The edit is still running. Try again shortly.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed.");
      setTimeline((current) => replaceTimelineVideo(current, sourceUrl, "Opening video — locked-head processing failed"));
    }
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.workspaceHead}>
        <div>
          <span className={styles.kicker}>Character replacement</span>
          <h2>Build the locked-head opening</h2>
          <p>Joe and Danda keep their exact illustrated face, hair, and proportions while your performance, body, setting, and original audio stay intact.</p>
        </div>
        <span className={`${styles.stateBadge} ${status === "done" ? styles.stateReady : ""}`}>
          {status === "done" ? "Locked heads ready" : status === "generating" ? "Processing video" : "Setup required"}
        </span>
      </div>

      <div className={styles.setupGrid}>
        <section className={styles.setupCard}>
          <div className={styles.stepTop}><span>01</span><b>Upload opening</b></div>
          <p>Choose the moving part of your performance. MP4 and MOV are supported.</p>
          <label className={styles.fileButton}>
            {sourceUrl ? "Replace recording" : "Choose recording"}
            <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void uploadVideo(event.target.files?.[0])} disabled={hybridBusy || status === "uploading" || status === "generating"} />
          </label>
        </section>

        <section className={styles.setupCard}>
          <div className={styles.stepTop}><span>02</span><b>Choose the cast</b></div>
          <p>Match each locked character to the adults visible in the clip.</p>
          <div className={styles.castButtons}>
            <button type="button" disabled={hybridBusy || status === "uploading" || status === "generating"} onClick={() => toggleCast("joe")} aria-pressed={cast.includes("joe")}>
              <span className={styles.castAvatar}>J</span><span><b>Joe</b><small>Adult man</small></span><i>{cast.includes("joe") ? "✓" : "+"}</i>
            </button>
            <button type="button" disabled={hybridBusy || status === "uploading" || status === "generating"} onClick={() => toggleCast("danda")} aria-pressed={cast.includes("danda")}>
              <span className={`${styles.castAvatar} ${styles.dandaAvatar}`}>D</span><span><b>Danda</b><small>Adult woman</small></span><i>{cast.includes("danda") ? "✓" : "+"}</i>
            </button>
          </div>
        </section>

        <section className={styles.setupCard}>
          <div className={styles.stepTop}><span>03</span><b>Check references</b></div>
          <p>The episode’s locked character art is used for every frame.</p>
          <div className={styles.referenceList}>
            <span><i className={references.joe ? styles.readyDot : styles.missingDot} />Joe reference <b>{references.joe ? "Ready" : "Missing"}</b></span>
            <span><i className={references.danda ? styles.readyDot : styles.missingDot} />Danda reference <b>{references.danda ? "Ready" : "Missing"}</b></span>
          </div>
        </section>
      </div>

      {(sourceUrl || resultUrl) && (
        <div className={styles.previewGrid}>
          {sourceUrl && <article className={styles.previewCard}><div className={styles.previewHead}><div><span>Source</span><h3>Original recording</h3></div><small>Live action</small></div><video src={sourceUrl} controls playsInline /></article>}
          {resultUrl && <article className={`${styles.previewCard} ${styles.processedCard}`}><div className={styles.previewHead}><div><span>Processed</span><h3>Locked cartoon heads</h3></div><small>Ready for timeline</small></div><video src={resultUrl} controls playsInline /><a href={resultUrl} target="_blank" rel="noreferrer">Open finished video ↗</a></article>}
        </div>
      )}

      <div className={styles.processRow}>
        <div><b>Apply the locked character heads</b><p>This must finish successfully before a timeline containing video can be exported.</p></div>
        <button className={styles.primaryButton} type="button" onClick={() => void createCartoonVersion()} disabled={hybridBusy || !sourceUrl || status === "uploading" || status === "generating"}>
          {status === "generating" ? "Tracking faces and applying heads…" : resultUrl ? "Reapply Locked Heads" : "Apply Locked Cartoon Heads"}
        </button>
      </div>

      {status === "uploading" && <p className={styles.notice}>Uploading recorded video…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.timelinePanel}>
        <div className={styles.timelineHead}>
          <div><span className={styles.kicker}>Hybrid timeline</span><h2>Opening + costume stills</h2><p>Add stills in the order they should appear. Hard cuts keep the comedy moving.</p></div>
          <label className={styles.secondaryButton}>+ Add costume still<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addStill(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        </div>

        <div className={styles.timelineList}>
          {timeline.length ? timeline.map((item, index) => (
            <div key={item.id} className={styles.timelineItem}>
              <span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span className={`${styles.mediaIcon} ${item.type === "image" ? styles.imageIcon : ""}`}>{item.type === "video" ? "▶" : "▧"}</span>
              <div className={styles.itemTitle}><strong>{item.label}</strong><small>{item.type === "video" ? item.url === resultUrl && status === "done" ? "Processed locked-head video" : "Opening video — processing required" : "Costume still"}</small></div>
              <label className={styles.durationField}>Duration<input type="number" min=".5" max="60" step=".5" value={item.duration} onChange={(event) => updateDuration(item.id, Number(event.target.value))} /><span>sec</span></label>
              <button className={styles.removeButton} type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.label}`}>Remove</button>
            </div>
          )) : <div className={styles.emptyTimeline}><span>+</span><b>Your timeline is empty</b><p>Upload an opening video or add a costume still to begin.</p></div>}
        </div>

        <div className={styles.exportRow}>
          <div>{hybridBlockReason ? <p id="hybrid-video-block" className={styles.notice} role="status">{hybridBlockReason}</p> : timeline.length ? <p className={styles.readyMessage}>✓ Timeline is ready to export</p> : <p className={styles.notice}>Add an opening video or costume still to begin.</p>}</div>
          <button className={styles.exportButton} type="button" disabled={!timeline.length || hybridBusy || !!hybridBlockReason} aria-describedby={hybridBlockReason ? "hybrid-video-block" : undefined} onClick={() => void buildHybrid()}>{hybridBusy ? "Building hybrid video…" : "Build Hybrid Video"}</button>
        </div>

        {hybridUrl && <article className={`${styles.previewCard} ${styles.hybridResult}`}><div className={styles.previewHead}><div><span>Final export</span><h3>Hybrid video</h3></div><small>Ready</small></div><video src={hybridUrl} controls playsInline /><a href={hybridUrl} target="_blank" rel="noreferrer">Open finished hybrid video ↗</a></article>}
      </section>
    </section>
  );
}
