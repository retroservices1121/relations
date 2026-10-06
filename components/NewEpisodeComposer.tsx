"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/studio/studio.module.css";
import SpeechInputButton from "./SpeechInputButton";

type Mode = "story" | "script" | "marketing";

const modes: Array<{ id: Mode; label: string; eyebrow: string; description: string }> = [
  { id: "story", label: "Story episode", eyebrow: "Narrative", description: "Turn an idea into a setup, escalation, payoff, and final visual button." },
  { id: "script", label: "Script", eyebrow: "Adaptation", description: "Preserve an existing script or detailed beat list as editable production scenes." },
  { id: "marketing", label: "Series promo", eyebrow: "Marketing", description: "Build a short campaign video with a hook, proof or context, and a clear call to action." },
];

export default function NewEpisodeComposer({
  seriesId,
  seriesTitle,
}: { seriesId: string; seriesTitle: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("story");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [objective, setObjective] = useState("episode-promo");
  const [channel, setChannel] = useState("vertical-social");
  const [audience, setAudience] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedMode = modes.find((item) => item.id === mode) || modes[0];

  async function createEpisode() {
    if (!prompt.trim()) {
      setError(mode === "marketing" ? "Describe what this promo should feature first." : "Describe the episode or paste a script first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, title, prompt, seriesId,
          campaign: mode === "marketing" ? { objective, channel, audience, callToAction } : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create production plan.");
      router.push(`/episodes/${data.episode.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create production plan.");
      setBusy(false);
    }
  }

  return (
    <section className={styles.composer}>
      <div className={styles.composerIntro}>
        <span className={styles.kicker}>New {seriesTitle} production</span>
        <h2>What do you want to make?</h2>
        <p>Plan a story episode, adapt a finished script, or create a promotional video. The default Efficient Episode workflow builds one stable frame per scene, animates only that shot, then assembles the full episode with your captions and audio.</p>
      </div>

      <div className={styles.modeCards} role="tablist" aria-label="Production type">
        {modes.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? styles.activeModeCard : ""} onClick={() => { setMode(item.id); setError(""); }}>
            <span>{item.eyebrow}</span><strong>{item.label}</strong><small>{item.description}</small>
          </button>
        ))}
      </div>

      <div className={styles.modeSummary}><span>{selectedMode.eyebrow} workflow</span><p>{selectedMode.description}</p></div>

      {mode === "marketing" && (
        <div className={styles.campaignFields}>
          <label>Campaign objective<select value={objective} onChange={(event) => setObjective(event.target.value)}><option value="episode-promo">Promote an episode</option><option value="series-awareness">Build series awareness</option><option value="audience-growth">Grow followers</option><option value="launch">Launch or announcement</option><option value="retention">Bring viewers back</option></select></label>
          <label>Primary channel<select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="vertical-social">TikTok / Reels / Shorts</option><option value="youtube">YouTube video</option><option value="paid-social">Paid social ad</option><option value="landing-page">Landing page hero</option></select></label>
          <label>Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Example: couples who share the same everyday arguments" /></label>
          <label>Call to action<input value={callToAction} onChange={(event) => setCallToAction(event.target.value)} placeholder="Example: Follow for the next episode" /></label>
        </div>
      )}

      <input className={styles.composerTitle} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === "marketing" ? "Campaign or promo title (optional)" : "Episode title (optional)"} />
      <div className={styles.composerPromptTools}>
        <span>{mode === "marketing" ? "Describe the episode, joke, moment, or series promise to feature." : "Type your idea or speak it aloud."}</span>
        <SpeechInputButton value={prompt} onChange={setPrompt} label={mode === "script" ? "Dictate script" : mode === "marketing" ? "Speak promo brief" : "Speak story idea"} />
      </div>
      <textarea className={styles.composerInput} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "story" ? "Example: Danda says she's only ordering one thing. Packages keep arriving until Joe is buried in boxes, and the last package contains one tiny hair clip." : mode === "script" ? "Paste your script or detailed story here. Include the beats you want preserved and we'll turn them into editable scenes." : "Example: Tease the blanket-stealing episode. Open on Joe confidently getting into bed, reveal Danda taking the whole blanket, and end on Joe's defeated stare with a follow prompt."} />
      <div className={styles.composerFoot}>
        <span>Stable scene frames · short motion passes · one finished episode</span>
        <button disabled={busy || !prompt.trim()} onClick={createEpisode}>{busy ? "Building production plan…" : mode === "marketing" ? "Plan series promo →" : "Write story screenplay →"}</button>
      </div>
      {error && <p className={styles.composerError}>{error}</p>}
    </section>
  );
}

