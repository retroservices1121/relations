"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/studio/studio.module.css";

type Mode = "idea" | "script";

export default function NewEpisodeComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idea");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createEpisode() {
    if (!prompt.trim()) { setError("Describe the episode or paste a script first."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, title, prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create episode plan.");
      router.push(`/episodes/${data.episode.id}`);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create episode plan."); setBusy(false); }
  }

  return <section className={styles.composer}>
    <div className={styles.composerIntro}>
      <span className={styles.kicker}>New episode</span>
      <h2>What happens in this episode?</h2>
      <p>Start with one sentence or paste the full story. The scene plan is created first, so you can review it before spending video-generation credits.</p>
    </div>
    <div className={styles.modeTabs}>
      <button className={mode === "idea" ? styles.activeTab : ""} onClick={() => setMode("idea")}>Idea</button>
      <button className={mode === "script" ? styles.activeTab : ""} onClick={() => setMode("script")}>Script / detailed story</button>
    </div>
    <input className={styles.composerTitle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title (optional)" />
    <textarea className={styles.composerInput} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={mode === "idea" ? "Example: Danda says she's only ordering one thing. Packages keep arriving until Joe is buried in boxes, and the last package contains one tiny hair clip." : "Paste your script or detailed story here. Include the beats you want preserved and we'll turn them into editable scenes."} />
    <div className={styles.composerFoot}><span>Plan first · generate later</span><button disabled={busy || !prompt.trim()} onClick={createEpisode}>{busy ? "Creating scene plan…" : "Create episode plan →"}</button></div>
    {error && <p className={styles.composerError}>{error}</p>}
  </section>;
}
