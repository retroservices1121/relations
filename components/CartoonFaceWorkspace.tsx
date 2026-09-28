"use client";

import { useEffect, useMemo, useState } from "react";
import { hybridVideoBlockReason, type TimelineItem } from "@/lib/hybrid-timeline";
import styles from "./CartoonFaceWorkspace.module.css";
import EpisodeEditor, { type EditorAudio, type EditorText } from "./EpisodeEditor";

type CastKey = "joe" | "danda";
type Status = "idle" | "uploading" | "ready" | "generating" | "done" | "error";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const refKey = (character: CastKey) => `relations:series:household-nonsense:character:${character}`;

export default function CartoonFaceWorkspace() {
  const [status, setStatus] = useState<Status>("idle");
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [cast, setCast] = useState<CastKey[]>(["joe", "danda"]);
  const [references, setReferences] = useState<Record<CastKey, string>>({ joe: "", danda: "" });
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [hybridUrl, setHybridUrl] = useState("");
  const [hybridBusy, setHybridBusy] = useState(false);
  const [uploadingReference, setUploadingReference] = useState<CastKey | null>(null);

  useEffect(() => {
    setReferences({
      joe: localStorage.getItem(refKey("joe")) || "",
      danda: localStorage.getItem(refKey("danda")) || "",
    });
  }, []);

  const missing = useMemo(() => cast.filter((key) => !references[key]), [cast, references]);
  const hybridBlockReason = hybridVideoBlockReason(timeline, processingIds.length);

  function toggleCast(key: CastKey) {
    if (cast.length === 1 && cast.includes(key)) return;
    setHybridUrl("");
    setError("");
    setCast((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key].slice(0, 2),
    );
  }

  async function uploadVideos(files?: FileList | null) {
    if (!files?.length) return;
    setStatus("uploading"); setError(""); setHybridUrl("");
    try {
      const uploaded: TimelineItem[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/upload-video", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Upload failed for ${file.name}.`);
        uploaded.push({ id: crypto.randomUUID(), type: "video", url: data.url, sourceUrl: data.url, duration: 4, label: file.name, processed: false });
      }
      setTimeline((current) => [...current, ...uploaded]);
      setSourceUrl(uploaded[0]?.url || "");
      setStatus("ready");
    } catch (err) { setStatus("error"); setError(err instanceof Error ? err.message : "Upload failed."); }
  }

  async function processOne(item: TimelineItem) {
    const source = item.sourceUrl || item.url;
    setProcessingIds((current) => [...current, item.id]);
    setTimeline((current) => current.map((x) => x.id === item.id ? { ...x, label: `${item.label.replace(/ —.*/, "")} — applying locked heads…` } : x));
    try {
      const response = await fetch("/api/cartoon-face", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoUrl: source, cast, referenceUrls: references }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not start locked-head edit.");
      for (let attempt=0; attempt<180; attempt+=1) {
        await sleep(3000);
        const poll=await fetch(`/api/cartoon-face?requestId=${encodeURIComponent(data.requestId)}`,{cache:"no-store"}); const p=await poll.json();
        if(!poll.ok||p.status==="FAILED") throw new Error(p.error||"Locked-head processing failed.");
        if(p.status==="COMPLETED"){
          if(typeof p.videoUrl!=="string"||!p.videoUrl.trim()||p.videoUrl===source) throw new Error("Provider did not return a processed video.");
          const names=cast.map(k=>k==="joe"?"Joe":"Danda").join(" and ");
          setTimeline(current=>current.map(x=>x.id===item.id?{...x,url:p.videoUrl,sourceUrl:source,processed:true,label:`${item.label.replace(/ —.*/, "")} — locked ${names} applied`}:x));
          setResultUrl(p.videoUrl); return;
        }
      }
      throw new Error("The edit is still running. Try again shortly.");
    } finally { setProcessingIds(current=>current.filter(id=>id!==item.id)); }
  }

  async function processAllVideos() {
    const videos=timeline.filter(item=>item.type==="video"&&!item.processed);
    if(!videos.length) return;
    if(missing.length){setError(`Upload the locked ${missing.map(k=>k==="joe"?"Joe":"Danda").join(" and ")} reference first.`);return;}
    setStatus("generating");setError("");setHybridUrl("");
    try { for(const item of videos) await processOne(item); setStatus("done"); }
    catch(err){setStatus("error");setError(err instanceof Error?err.message:"Locked-head processing failed.");}
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
  async function uploadCharacterReference(character: CastKey, file?: File) {
    if (!file) return;
    setUploadingReference(character);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload-reference", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reference upload failed.");
      if (typeof data.url !== "string" || !data.url) throw new Error("Reference upload completed without an image URL.");
      localStorage.setItem(refKey(character), data.url);
      setReferences((current) => ({ ...current, [character]: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reference upload failed.");
    } finally {
      setUploadingReference(null);
    }
  }
  function updateDuration(id:string,value:number){setHybridUrl("");setTimeline(current=>current.map(item=>item.id===id?{...item,duration:Math.max(.5,Math.min(60,value||.5))}:item));}
  function removeItem(id:string){setHybridUrl("");setTimeline(current=>current.filter(item=>item.id!==id));}
  async function buildEdited(payload:{items:TimelineItem[];texts:EditorText[];audio:EditorAudio[]}){
    const blocked=hybridVideoBlockReason(payload.items,processingIds.length);if(blocked){setError(blocked);return;}setHybridBusy(true);setError("");setHybridUrl("");
    try{const r=await fetch("/api/render-hybrid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||"Episode export failed.");setHybridUrl(d.url);}catch(e){setError(e instanceof Error?e.message:"Episode export failed.");}finally{setHybridBusy(false);}
  }
  async function buildHybrid(){
    const blocked = hybridVideoBlockReason(timeline, processingIds.length);
    if (blocked) { setError(blocked); return; }
    if(!timeline.length)return;setHybridBusy(true);setError("");setHybridUrl("");
    try{const r=await fetch("/api/render-hybrid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:timeline})});const d=await r.json();if(!r.ok)throw Error(d.error||"Hybrid export failed.");setHybridUrl(d.url);}
    catch(e){setError(e instanceof Error?e.message:"Hybrid export failed.");}finally{setHybridBusy(false);}
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
          <p>Choose one or several recorded clips at once. MP4 and MOV are supported.</p>
          <label className={styles.fileButton}>
            Choose videos
            <input type="file" multiple accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => { void uploadVideos(event.target.files); event.currentTarget.value=""; }} disabled={hybridBusy || status === "uploading" || status === "generating"} />
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
            {(["joe", "danda"] as CastKey[]).map((character) => {
              const name = character === "joe" ? "Joe" : "Danda";
              const ready = Boolean(references[character]);
              return <div className={styles.referenceRow} key={character}>
                {ready ? <img src={references[character]} alt={`${name} locked cartoon reference`} /> : <span className={styles.referencePlaceholder}>{name.slice(0, 1)}</span>}
                <span className={styles.referenceName}><i className={ready ? styles.readyDot : styles.missingDot} />{name} reference <b>{ready ? "Ready" : "Missing"}</b></span>
                <label className={styles.referenceButton}>
                  {uploadingReference === character ? "Uploading…" : ready ? "Replace" : "Upload"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingReference !== null || status === "generating" || hybridBusy} onChange={(event) => { void uploadCharacterReference(character, event.target.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
              </div>;
            })}
          </div>
        </section>
      </div>

      {timeline.some(item=>item.type==="video") && (
        <div className={styles.previewGrid}>
          {timeline.filter(item=>item.type==="video").map((item,index)=><article className={`${styles.previewCard} ${item.processed?styles.processedCard:""}`} key={item.id}><div className={styles.previewHead}><div><span>Video {index+1}</span><h3>{item.label.replace(/ —.*/, "")}</h3></div><small>{item.processed?"Locked head ready":processingIds.includes(item.id)?"Processing":"Needs locked head"}</small></div><video src={item.url} controls playsInline />{item.processed&&<a href={item.url} target="_blank" rel="noreferrer">Open processed video ↗</a>}</article>)}
        </div>
      )}

      <div className={styles.processRow}>
        <div><b>Apply the locked character heads</b><p>Batch-process every unprocessed video with the selected locked character head before editing or export.</p></div>
        <button className={styles.primaryButton} type="button" onClick={() => void processAllVideos()} disabled={hybridBusy || !timeline.some(item=>item.type==="video"&&!item.processed) || status === "uploading" || status === "generating"}>
          {status === "generating" ? `Processing ${processingIds.length || 1} video…` : "Apply Locked Heads to All Videos"}
        </button>
      </div>

      {status === "uploading" && <p className={styles.notice}>Uploading recorded video…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <EpisodeEditor items={timeline} onItemsChange={(items)=>{setTimeline(items);setHybridUrl("");}} onExport={(payload)=>void buildEdited(payload)} exporting={hybridBusy} />

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
              <div className={styles.itemTitle}><strong>{item.label}</strong><small>{item.type === "video" ? item.processed ? "Processed locked-head video" : "Video — locked-head processing required" : "Costume still"}</small></div>
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
