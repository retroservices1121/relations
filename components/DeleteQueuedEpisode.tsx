"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteQueuedEpisode({episodeId,title}:{episodeId:string;title:string}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function remove() {
    if (!window.confirm(`Delete "${title}" from the queue? This cannot be undone.`)) return;
    setBusy(true);setError("");
    try {
      const response=await fetch(`/api/episodes?episodeId=${encodeURIComponent(episodeId)}`,{method:"DELETE"});
      const result=await response.json();
      if (!response.ok) throw new Error(result.error||"Could not delete the episode.");
      router.refresh();
    } catch (reason) {setError(reason instanceof Error?reason.message:"Could not delete the episode.");setBusy(false);}
  }
  return <><button className="deleteQueuedEpisode" type="button" disabled={busy} onClick={()=>void remove()}>{busy?"Deleting…":"Delete episode"}</button>{error&&<span className="deleteQueuedEpisodeError" role="alert">{error}</span>}</>;
}
