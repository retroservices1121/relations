"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/series/series.module.css";

type DraftCharacter = { name: string; description: string; referenceUrl: string };

export default function SeriesBuilder() {
  const router = useRouter();
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [format,setFormat]=useState<"silent"|"dialogue">("silent");
  const [visualStyle,setVisualStyle]=useState("");
  const [screenplayRules,setScreenplayRules]=useState("");
  const [characters,setCharacters]=useState<DraftCharacter[]>([{name:"",description:"",referenceUrl:""}]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  function updateCharacter(index:number,patch:Partial<DraftCharacter>){setCharacters((current)=>current.map((character,position)=>position===index?{...character,...patch}:character));}
  async function submit(){setBusy(true);setError("");try{const response=await fetch("/api/series",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,format,visualStyle,screenplayRules,characters})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not create series.");router.push(`/series/${data.series.id}`);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Could not create series.");setBusy(false);}}
  return <div className={styles.builder}>
    <label>Series title<input value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Name your series"/></label>
    <label>Series premise<textarea value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="What is the series about, who is it for, and what makes it recognizable?"/></label>
    <label>Episode format<select value={format} onChange={(event)=>setFormat(event.target.value as "silent"|"dialogue")}><option value="silent">Silent / captions</option><option value="dialogue">Dialogue-driven</option></select></label>
    <label>Visual style<textarea value={visualStyle} onChange={(event)=>setVisualStyle(event.target.value)} placeholder="Example: Flat 2D editorial animation, bold outlines, limited palette, vertical 9:16."/></label>
    <label>Series bible and screenplay rules<textarea value={screenplayRules} onChange={(event)=>setScreenplayRules(event.target.value)} placeholder="Tone, recurring locations, episode structure, continuity rules, forbidden elements and anything the writer must always preserve."/></label>
    <div className={styles.castHeader}><div><span>Recurring cast</span><small>Add the characters the screenplay AI is allowed to use.</small></div><button type="button" onClick={()=>setCharacters((current)=>[...current,{name:"",description:"",referenceUrl:""}])}>+ Add character</button></div>
    <div className={styles.castList}>{characters.map((character,index)=><div className={styles.characterCard} key={index}><label>Character name<input value={character.name} onChange={(event)=>updateCharacter(index,{name:event.target.value})}/></label><label>Identity and appearance<textarea value={character.description} onChange={(event)=>updateCharacter(index,{description:event.target.value})} placeholder="Age, appearance, personality, wardrobe and role in the series."/></label><label>Reference image URL (optional)<input value={character.referenceUrl} onChange={(event)=>updateCharacter(index,{referenceUrl:event.target.value})} placeholder="You can also upload the reference inside an episode."/></label>{characters.length>1&&<button type="button" className={styles.remove} onClick={()=>setCharacters((current)=>current.filter((_,position)=>position!==index))}>Remove character</button>}</div>)}</div>
    <button className={styles.primary} disabled={busy||!title.trim()||!description.trim()||!visualStyle.trim()||!screenplayRules.trim()} onClick={()=>void submit()}>{busy?"Creating Series…":"Create Series"}</button>{error&&<p className={styles.error}>{error}</p>}
  </div>;
}
