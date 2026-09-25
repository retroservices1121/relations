"use client";

import { useEffect, useState } from "react";
import styles from "./ProductionLibrary.module.css";

type Asset = {
  id:number; kind:"scene"|"final"|"narration"|"reference"|"soundtrack";
  scene_index:number|null; url:string; label:string; created_at:string;
};
type ResponseData = {assets:Asset[];currentScenes:Array<{sceneIndex:number;url:string}>;finalUrl:string};

export default function ProductionLibrary({episodeId}:{episodeId:string}) {
  const [data,setData]=useState<ResponseData|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState<number|null>(null);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    fetch(`/api/production-library?episodeId=${encodeURIComponent(episodeId)}`,{cache:"no-store"})
      .then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error||"Library unavailable.");return value as ResponseData;})
      .then(value=>{if(active){setData(value);setError("");}})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"Library unavailable.");});
    return()=>{active=false;};
  },[episodeId,refresh]);

  async function restore(asset:Asset) {
    if(!window.confirm(`Use this saved take for Scene ${(asset.scene_index??0)+1}? The current take stays in the library, and the episode will need a new final export.`))return;
    setBusy(asset.id);setError("");
    try {
      const response=await fetch("/api/production-library",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({episodeId,assetId:asset.id,action:"restore-scene"})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||"Could not restore that take.");
      window.localStorage.removeItem(`relations:project:${episodeId}`);
      window.location.reload();
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not restore that take.");setBusy(null);}
  }

  const groups:[Asset["kind"],string][]=[["scene","Scene takes"],["final","Episode exports"],["narration","Voice takes"],["reference","Character references"],["soundtrack","Soundtracks"]];
  return <section id="production-library" className={styles.library}>
    <div className={styles.heading}><div><span>PRODUCTION LIBRARY</span><h2>Every take, one place</h2><p>Review saved versions, download individual assets, and put an earlier scene take back into the episode.</p></div><button type="button" onClick={()=>setRefresh(count=>count+1)}>Refresh library</button></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {!data&&!error&&<p>Loading saved work…</p>}
    {data&&data.assets.length===0&&<p>Generated scenes and exports will appear here after they are saved.</p>}
    {data&&groups.map(([kind,title])=>{
      const items=data.assets.filter(asset=>asset.kind===kind);
      if(!items.length)return null;
      return <div key={kind} className={styles.group}><h3>{title} <small>{items.length}</small></h3><div className={styles.grid}>{items.map(asset=>{
        const current=kind==="scene"&&data.currentScenes.some(scene=>scene.sceneIndex===asset.scene_index&&scene.url===asset.url);
        const activeFinal=kind==="final"&&data.finalUrl===asset.url;
        const media=kind==="reference"?"image":/\.(mp3|wav)(?:\?|$)/i.test(asset.url)?"audio":"video";
        return <article className={styles.card} key={asset.id}>
          {media==="video"?<video src={asset.url} controls preload="none" playsInline/>:media==="audio"?<audio src={asset.url} controls preload="none"/>:<img src={asset.url} alt={asset.label||"Saved character reference"} loading="lazy"/>}
          <div className={styles.meta}><strong>{asset.label||title}</strong><span>{new Date(asset.created_at).toLocaleString()}</span>{(current||activeFinal)&&<b>Current</b>}</div>
          <div className={styles.actions}><a href={`/api/download-asset?episodeId=${encodeURIComponent(episodeId)}&assetId=${asset.id}`}>Download</a>{kind==="scene"&&!current&&<button type="button" disabled={busy!==null} onClick={()=>void restore(asset)}>{busy===asset.id?"Restoring…":"Use this take"}</button>}</div>
        </article>;
      })}</div></div>;
    })}
  </section>;
}
