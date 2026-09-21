"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeriesConfig } from "@/lib/series";
export default function SeriesProductionSettings({series}:{series:SeriesConfig}) {
  const router=useRouter();
  const [shape,setShape]=useState(series.aspectRatio||"9:16");
  const [format,setFormat]=useState(series.format);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function save(){setBusy(true);setMessage("");try{const r=await fetch("/api/series",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:series.id,aspectRatio:shape,format})});const d=await r.json();if(!r.ok)throw Error(d.error);setMessage("Settings saved. Reopen existing episodes to use them. Existing clips are unchanged.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Could not save.");}finally{setBusy(false);}}
  return <section className="finalBuilder"><h2>Production settings</h2><div className="overlayEditor"><label>Video shape<select disabled={series.locked||busy} value={shape} onChange={e=>setShape(e.target.value as "9:16"|"16:9")}><option value="9:16">Portrait 9:16</option><option value="16:9">Landscape 16:9</option></select></label><label>Audio format<select disabled={series.locked||busy} value={format} onChange={e=>setFormat(e.target.value as SeriesConfig["format"])}><option value="silent">Silent / captions</option><option value="narrated">Narrated / voiceover</option><option value="dialogue">Dialogue planning</option></select></label></div><p>Changing shape affects new generations and exports. Existing clips keep their framing; exports fit them inside the selected shape. Narration is offscreen voiceover, not character lip sync.</p>{series.locked?<p>Protected Household Nonsense settings.</p>:<button disabled={busy} onClick={()=>void save()}>{busy?"Saving…":"Save production settings"}</button>}<p role="status">{message}</p></section>;
}
