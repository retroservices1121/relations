"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/studio/studio.module.css";
import SpeechInputButton from "./SpeechInputButton";

type Mode = "idea" | "script";

export default function NewEpisodeComposer({seriesId,seriesTitle}:{seriesId:string;seriesTitle:string}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idea");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createEpisode() {
    if (!prompt.trim()) {
      setError("Describe the episode or paste a script first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, title, prompt, seriesId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create episode plan.");
      router.push(`/episodes/${data.episode.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create episode plan.",
      );
      setBusy(false);
    }
  }

  return (
    <section className={styles.composer}>
      <div className={styles.composerIntro}>
        <span className={styles.kicker}>New {seriesTitle} episode</span>
        <h2>What happens in this episode?</h2>
        <p>
          The screenplay AI develops your idea into a structured episode with a
          setup, escalation, payoff, continuity locks, and editable production
          scenes before any video credits are spent.
        </p>
      </div>
      <div className={styles.modeTabs}>
        <button
          className={mode === "idea" ? styles.activeTab : ""}
          onClick={() => setMode("idea")}
        >
          Idea
        </button>
        <button
          className={mode === "script" ? styles.activeTab : ""}
          onClick={() => setMode("script")}
        >
          Script / detailed story
        </button>
      </div>
      <input
        className={styles.composerTitle}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Episode title (optional)"
      />
      <div className={styles.composerPromptTools}>
        <span>Type your idea or speak it aloud.</span>
        <SpeechInputButton
          value={prompt}
          onChange={setPrompt}
          label={mode === "idea" ? "Speak episode idea" : "Dictate script"}
        />
      </div>
      <textarea
        className={styles.composerInput}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          mode === "idea"
            ? "Describe the episode idea, the characters involved, and the turn you want the story to take."
            : "Paste your script or detailed story here. Include the beats you want preserved and we'll turn them into editable scenes."
        }
      />
      <div className={styles.composerFoot}>
        <span>AI screenplay first · review every scene · generate later</span>
        <button disabled={busy || !prompt.trim()} onClick={createEpisode}>
          {busy ? "Writing screenplay…" : "Write episode screenplay →"}
        </button>
      </div>
      {error && <p className={styles.composerError}>{error}</p>}
    </section>
  );
}
