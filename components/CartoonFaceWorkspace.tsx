"use client";

import { useEffect, useMemo, useState } from "react";

type CastKey = "joe" | "danda";
type Status = "idle" | "uploading" | "ready" | "generating" | "done" | "error";
type TimelineItem = { id: string; type: "video" | "image"; url: string; duration: number; label: string };

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

  function toggleCast(key: CastKey) {
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
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload-video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setSourceUrl(data.url);
      setTimeline((current) => current.length ? current : [{ id: crypto.randomUUID(), type: "video", url: data.url, duration: 4, label: "Opening video" }]);
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
      setTimeline(current=>[...current,{id:crypto.randomUUID(),type:"image",url:d.url,duration:1.5,label:`Costume still ${current.filter(x=>x.type==="image").length+1}`}]);
    } catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}
  }
  function updateDuration(id:string,value:number){setTimeline(current=>current.map(item=>item.id===id?{...item,duration:Math.max(.5,Math.min(60,value||.5))}:item));}
  function removeItem(id:string){setTimeline(current=>current.filter(item=>item.id!==id));}
  async function buildHybrid(){
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
        if (pollData.status === "COMPLETED" && pollData.videoUrl) {
          setResultUrl(pollData.videoUrl);
          setStatus("done");
          return;
        }
      }
      throw new Error("The edit is still running. Try again shortly.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed.");
    }
  }

  return (
    <section className="finalBuilder">
      <span className="eyebrow">LIVE ACTION → HOUSEHOLD NONSENSE</span>
      <h2>Locked cartoon heads + hybrid timeline</h2>
      <p>Joe and Danda always use their exact locked cartoon heads, including the cartoon hairstyle and facial design. Your real hairstyle is never recreated. Build the moving opening, then add costume stills to the same timeline.</p>

      <div className="overlayEditor">
        <label>
          1. Upload your recorded clip
          <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void uploadVideo(event.target.files?.[0])} disabled={status === "uploading" || status === "generating"} />
        </label>
        <small>Upload the moving portion of the performance. You can add generated costume stills below instead of paying to animate every beat.</small>

        <div>
          <span className="eyebrow">2. WHO IS IN THE VIDEO?</span>
          <div className="sceneActions">
            <button type="button" onClick={() => toggleCast("joe")} aria-pressed={cast.includes("joe")}>
              {cast.includes("joe") ? "✓ " : ""}Joe
            </button>
            <button type="button" onClick={() => toggleCast("danda")} aria-pressed={cast.includes("danda")}>
              {cast.includes("danda") ? "✓ " : ""}Danda
            </button>
          </div>
          <p className="statusText">Joe maps to the adult man. Danda maps to the adult woman. Keep both selected when you are both on camera.</p>
        </div>

        <div>
          <span className="eyebrow">3. LOCKED REFERENCES</span>
          <p>Joe: {references.joe ? "✓ Ready" : "Missing"} · Danda: {references.danda ? "✓ Ready" : "Missing"}</p>
        </div>
      </div>

      {sourceUrl && (
        <div className="finalResult">
          <h3>Original recording</h3>
          <video className="finalVideo" src={sourceUrl} controls playsInline />
        </div>
      )}

      <div className="overlayEditor">
        <span className="eyebrow">HYBRID TIMELINE</span>
        <h3>Video + costume stills</h3>
        <p>Add the generated costume images in the exact order they should appear. Hard cuts are intentional for the comedy.</p>
        <label className="uploadButton">+ Add costume still<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{void addStill(e.target.files?.[0]);e.currentTarget.value="";}} /></label>
        {timeline.map((item,index)=><div key={item.id} className="sceneActions"><strong>{index+1}. {item.label}</strong><span>{item.type==="video"?"Video":"Still"}</span><label>Seconds <input style={{width:72}} type="number" min=".5" max="60" step=".5" value={item.duration} onChange={e=>updateDuration(item.id,Number(e.target.value))}/></label><button type="button" onClick={()=>removeItem(item.id)}>Remove</button></div>)}
        <button type="button" disabled={!timeline.length||hybridBusy} onClick={()=>void buildHybrid()}>{hybridBusy?"Building hybrid video…":"Build Hybrid Video"}</button>
        {hybridUrl&&<div className="finalResult"><h3>Hybrid video</h3><video className="finalVideo" src={hybridUrl} controls playsInline/><a className="downloadLink" href={hybridUrl} target="_blank" rel="noreferrer">Open finished hybrid video</a></div>}
      </div>

      <button type="button" onClick={() => void createCartoonVersion()} disabled={!sourceUrl || status === "uploading" || status === "generating"}>
        {status === "generating" ? "Tracking faces and creating cartoon version…" : "Create Cartoon Face Video"}
      </button>

      {status === "uploading" && <p className="statusText">Uploading recorded video…</p>}
      {error && <p className="errorText">{error}</p>}

      {resultUrl && (
        <div className="finalResult">
          <h3>Cartoon face version</h3>
          <video className="finalVideo" src={resultUrl} controls playsInline />
          <a className="downloadLink" href={resultUrl} target="_blank" rel="noreferrer">Open finished video</a>
          <p className="statusText">Original audio is preserved. Review face tracking before posting.</p>
        </div>
      )}
    </section>
  );
}
