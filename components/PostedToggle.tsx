"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PostedToggle({ episodeId, initialPosted }: { episodeId: string; initialPosted: boolean }) {
  const [posted, setPosted] = useState(initialPosted);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    const next = !posted;
    setSaving(true);
    try {
      const response = await fetch("/api/posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, posted: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update posted status.");
      setPosted(next);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update posted status.");
    } finally {
      setSaving(false);
    }
  }

  return <button type="button" className={`postedToggle ${posted ? "isPosted" : ""}`} aria-pressed={posted} disabled={saving} onClick={toggle}>
    <span className="postedDot" aria-hidden="true">{posted ? "✓" : ""}</span>
    <span>{saving ? "Saving…" : posted ? "Posted to social" : "Mark posted"}</span>
  </button>;
}
