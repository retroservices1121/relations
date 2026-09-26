"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/series/series.module.css";

type DraftCharacter = { name: string; description: string; referenceUrl: string };

export default function SeriesBuilder() {
  const router = useRouter();
  const [aspectRatio,setAspectRatio]=useState("9:16");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [format,setFormat]=useState<"silent"|"dialogue"|"narrated">("silent");
  const [visualStyle,setVisualStyle]=useState("");
  const [screenplayRules,setScreenplayRules]=useState("");
  const [characters,setCharacters]=useState<DraftCharacter[]>([{name:"",description:"",referenceUrl:""}]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [uploading,setUploading]=useState<number[]>([]);
  function updateCharacter(index:number,patch:Partial<DraftCharacter>){setCharacters((current)=>current.map((character,position)=>position===index?{...character,...patch}:character));}
  async function uploadReference(index:number,file?:File){
    if(!file)return;
    setError("");setUploading(current=>[...current,index]);
    try{
      const form=new FormData();form.append("file",file);
      const response=await fetch("/api/upload-reference",{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok||!result.url)throw new Error(result.error||"Could not upload reference image.");
      updateCharacter(index,{referenceUrl:result.url});
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not upload reference image.");}
    finally{setUploading(current=>current.filter(value=>value!==index));}
  }
  async function submit(){setBusy(true);setError("");try{const response=await fetch("/api/series",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,format,aspectRatio,visualStyle,screenplayRules,characters})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not create series.");router.push(`/series/${data.series.id}`);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Could not create series.");setBusy(false);}}
  return <div className={styles.builder}>
    <label>Series title<input value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Name your series"/></label>
    <label>Series premise<textarea value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="What is the series about, who is it for, and what makes it recognizable?"/></label>
    <label>Episode format<select value={format} onChange={(event)=>setFormat(event.target.value as "silent"|"dialogue"|"narrated")}><option value="silent">Silent / captions</option><option value="narrated">Narrated / voiceover</option><option value="dialogue">Dialogue-driven</option></select></label>
    <label>Video shape<select value={aspectRatio} onChange={e=>setAspectRatio(e.target.value)}><option value="9:16">Portrait 9:16</option><option value="16:9">Landscape 16:9</option></select></label>
    <label>Visual style<textarea value={visualStyle} onChange={(event)=>setVisualStyle(event.target.value)} placeholder="Example: Flat 2D editorial animation, bold outlines, limited palette, vertical 9:16."/></label>
    <label>Series bible and screenplay rules<textarea value={screenplayRules} onChange={(event)=>setScreenplayRules(event.target.value)} placeholder="Tone, recurring locations, episode structure, continuity rules, forbidden elements and anything the writer must always preserve."/></label>
    <div className={styles.castHeader}><div><span>Recurring cast</span><small>Add the characters the screenplay AI is allowed to use.</small></div><button type="button" onClick={()=>setCharacters((current)=>[...current,{name:"",description:"",referenceUrl:""}])}>+ Add character</button></div>
    <div className={styles.castList}>{characters.map((character,index)=><div className={styles.characterCard} key={index}><label>Character name<input value={character.name} onChange={(event)=>updateCharacter(index,{name:event.target.value})}/></label><label>Identity and appearance<textarea value={character.description} onChange={(event)=>updateCharacter(index,{description:event.target.value})} placeholder="Age, appearance, personality, wardrobe and role in the series."/></label><label>Reference image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||uploading.includes(index)} onChange={event=>void uploadReference(index,event.target.files?.[0])}/></label>{uploading.includes(index)&&<p role="status">Uploading image…</p>}{character.referenceUrl&&<div className={styles.referencePreview}><img src={character.referenceUrl} alt={`${character.name||"Character"} reference`}/><button type="button" onClick={()=>updateCharacter(index,{referenceUrl:""})}>Remove image</button></div>}<details><summary>Use an image URL instead</summary><label>Reference image URL<input value={character.referenceUrl} onChange={event=>updateCharacter(index,{referenceUrl:event.target.value})} placeholder="https://…"/></label></details>{characters.length>1&&<button type="button" className={styles.remove} onClick={()=>setCharacters((current)=>current.filter((_,position)=>position!==index))}>Remove character</button>}</div>)}</div>
    <button className={styles.primary} disabled={busy||uploading.length>0||!title.trim()||!description.trim()||!visualStyle.trim()||!screenplayRules.trim()} onClick={()=>void submit()}>{busy?"Creating Series…":"Create Series"}</button>{error&&<p className={styles.error} role="alert">{error}</p>}
  </div>;
}
