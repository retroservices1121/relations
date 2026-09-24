"use client";

import { useEffect, useMemo, useState } from "react";

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
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
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
      <h2>Replace only the faces</h2>
      <p>Your bodies, clothes, room, timing and original recorded audio stay intact. Relations asks the editor to track the selected people and apply the locked Joe/Danda cartoon heads.</p>

      <div className="overlayEditor">
        <label>
          1. Upload your recorded clip
          <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void uploadVideo(event.target.files?.[0])} disabled={status === "uploading" || status === "generating"} />
        </label>
        <small>For the first version, use a 3–10 second MP4/MOV clip, 720p or higher, with faces visible.</small>

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
