"use client";

import { useMemo, useState } from "react";
import type { TimelineItem } from "@/lib/hybrid-timeline";
import styles from "./EpisodeEditor.module.css";

export type EditorText = { id:string; text:string; start:number; end:number; position:"top"|"middle"|"bottom" };
export type EditorAudio = { id:string; url:string; label:string; start:number; volume:number; kind:"music"|"sfx" };

export default function EpisodeEditor({items,onItemsChange,onExport,exporting}:{items:TimelineItem[];onItemsChange:(items:TimelineItem[])=>void;onExport:(payload:{items:TimelineItem[];texts:EditorText[];audio:EditorAudio[]})=>void;exporting:boolean}) {
 const [texts,setTexts]=useState<EditorText[]>([]);
 const [audio,setAudio]=useState<EditorAudio[]>([]);
 const [textDraft,setTextDraft]=useState("");
 const total=useMemo(()=>items.reduce((n,x)=>n+x.duration,0),[items]);
 function move(index:number,delta:number){const next=[...items],to=index+delta;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];onItemsChange(next);}
 function addText(){if(!textDraft.trim())return;setTexts(v=>[...v,{id:crypto.randomUUID(),text:textDraft.trim(),start:0,end:Math.max(1,total),position:"bottom"}]);setTextDraft("");}
 async function addAudio(file:File|undefined,kind:"music"|"sfx"){if(!file)return;const form=new FormData();form.append("file",file);form.append("kind",kind);const r=await fetch("/api/upload-editor-audio",{method:"POST",body:form});const d=await r.json();if(!r.ok)return;setAudio(v=>[...v,{id:crypto.randomUUID(),url:d.url,label:file.name,start:0,volume:kind==="music"?.35:1,kind}]);}
 return <section className={styles.editor}>
  <header><div><span>EPISODE EDITOR</span><h2>Finish the episode in Relations</h2><p>Reorder media, set timing, layer multiple text elements, music and sound effects, then export one finished video.</p></div><b>{total.toFixed(1)} sec</b></header>
  <div className={styles.toolbar}><button type="button" onClick={()=>{const t=items.reduce((n,x)=>n+x.duration,0);setTexts(v=>v.length?v:[{id:crypto.randomUUID(),text:"",start:0,end:t,position:"bottom"}].filter(x=>x.text));}}>✨ Auto Edit</button><label>+ Music<input type="file" accept="audio/*" onChange={e=>{void addAudio(e.target.files?.[0],"music");e.currentTarget.value="";}}/></label><label>+ Sound<input type="file" accept="audio/*" onChange={e=>{void addAudio(e.target.files?.[0],"sfx");e.currentTarget.value="";}}/></label></div>
  <div className={styles.track}><strong>VIDEO</strong><div className={styles.clips}>{items.map((item,i)=><article key={item.id}><span>{item.type==="video"?"VIDEO":"STILL"}</span><b>{item.label.replace(/ —.*/,"")}</b><div><button onClick={()=>move(i,-1)}>←</button><input type="number" min=".5" step=".5" value={item.duration} onChange={e=>onItemsChange(items.map(x=>x.id===item.id?{...x,duration:Math.max(.5,Number(e.target.value)||.5)}:x))}/><button onClick={()=>move(i,1)}>→</button></div></article>)}</div></div>
  <div className={styles.track}><strong>TEXT</strong><div className={styles.addRow}><input placeholder="Add caption or text…" value={textDraft} onChange={e=>setTextDraft(e.target.value)}/><button onClick={addText}>Add text</button></div>{texts.map(t=><div className={styles.layer} key={t.id}><input value={t.text} onChange={e=>setTexts(v=>v.map(x=>x.id===t.id?{...x,text:e.target.value}:x))}/><label>Start <input type="number" step=".1" value={t.start} onChange={e=>setTexts(v=>v.map(x=>x.id===t.id?{...x,start:Number(e.target.value)}:x))}/></label><label>End <input type="number" step=".1" value={t.end} onChange={e=>setTexts(v=>v.map(x=>x.id===t.id?{...x,end:Number(e.target.value)}:x))}/></label><select value={t.position} onChange={e=>setTexts(v=>v.map(x=>x.id===t.id?{...x,position:e.target.value as EditorText["position"]}:x))}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select><button onClick={()=>setTexts(v=>v.filter(x=>x.id!==t.id))}>Remove</button></div>)}</div>
  <div className={styles.track}><strong>AUDIO</strong>{audio.length?audio.map(a=><div className={styles.layer} key={a.id}><b>{a.kind==="music"?"♫":"SFX"} {a.label}</b><label>Start <input type="number" step=".1" value={a.start} onChange={e=>setAudio(v=>v.map(x=>x.id===a.id?{...x,start:Number(e.target.value)}:x))}/></label><label>Volume <input type="number" min="0" max="1" step=".05" value={a.volume} onChange={e=>setAudio(v=>v.map(x=>x.id===a.id?{...x,volume:Number(e.target.value)}:x))}/></label><button onClick={()=>setAudio(v=>v.filter(x=>x.id!==a.id))}>Remove</button></div>):<p>No added music or sound effects.</p>}</div>
  <footer><span>{items.length} media clips · {texts.length} text layers · {audio.length} audio layers</span><button disabled={!items.length||exporting} onClick={()=>onExport({items,texts,audio})}>{exporting?"Rendering episode…":"Export Edited Episode"}</button></footer>
 </section>;
}
