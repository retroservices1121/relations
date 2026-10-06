"use client";

import { useState } from "react";

const baseUrl = "https://v3b.fal.media/files/b/0aad3a6c/Epj_kOqZlo_ebUZ97NRIg_minimax-h3.mp4";
const dancerUrl = "https://v3b.fal.media/files/b/0aad3a6f/VVFPO3cJn7aCRuR5Y7_Ed_minimax-h3.mp4";

export default function DaydreamPrototypePage() {
  const [status, setStatus] = useState("Ready to assemble the silent prototype.");
  const [videoUrl, setVideoUrl] = useState("");

  async function render() {
    setStatus("Building the silent composite…");
    setVideoUrl("");

    try {
      const response = await fetch("/api/render-daydream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, dancerUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The composite could not be built.");
      setVideoUrl(data.url);
      setStatus("Silent prototype ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The composite could not be built.");
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <p style={{ letterSpacing: 2, fontSize: 12, fontWeight: 700 }}>HOUSEHOLD NONSENSE PROTOTYPE</p>
      <h1>Finance daydream</h1>
      <p>Joe has speaking mouth movement without audio. Danda stays quiet while her translucent daydream dances. The export contains no dialogue or music.</p>
      <button type="button" onClick={render} style={{ padding: "12px 18px", fontWeight: 700 }}>
        Build silent video
      </button>
      <p role="status">{status}</p>
      {videoUrl ? (
        <section>
          <video src={videoUrl} controls playsInline muted style={{ width: "100%", maxHeight: "70vh", background: "#111" }} />
          <p><a href={videoUrl} target="_blank" rel="noreferrer">Open finished MP4</a></p>
        </section>
      ) : null}
    </main>
  );
}

