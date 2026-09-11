"use client";

import { useEffect, useState } from "react";

type SceneCost = { sceneIndex: number; cost: number; exactCost: number; estimatedCost: number; attempts: number };
type CostData = {
  balance: number | null;
  currency: string;
  ytdSpend: number;
  ytdLabel: string;
  episodeCost: number;
  sceneCosts: SceneCost[];
  note?: string;
};

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function FalCostDashboard({ episodeId }: { episodeId: string }) {
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/fal-costs?episodeId=${encodeURIComponent(episodeId)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load Fal costs.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Fal costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [episodeId]);

  return (
    <section style={{maxWidth:1180,margin:"0 auto 56px",padding:"0 28px"}}>
      <div style={{background:"#15161c",border:"1px solid #272832",borderRadius:18,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <span style={{fontSize:12,letterSpacing:".16em",color:"#807b8a"}}>FAL COST TRACKER</span>
            <h2 style={{margin:"6px 0"}}>Episode generation cost</h2>
          </div>
          <button onClick={() => void load()} disabled={loading} style={{background:"#fff",color:"#111",border:0,borderRadius:12,padding:"11px 14px",fontWeight:700,cursor:"pointer"}}>{loading ? "Refreshing…" : "Refresh costs"}</button>
        </div>
        {error ? <p style={{color:"#ff9e9e"}}>{error}</p> : null}
        {data ? <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,margin:"18px 0"}}>
            <div style={{background:"#0f1015",border:"1px solid #2f3039",borderRadius:14,padding:16}}><small style={{color:"#8e8998"}}>Episode total</small><strong style={{display:"block",fontSize:24,marginTop:5}}>{money(data.episodeCost)}</strong></div>
            <div style={{background:"#0f1015",border:"1px solid #2f3039",borderRadius:14,padding:16}}><small style={{color:"#8e8998"}}>{data.ytdLabel}</small><strong style={{display:"block",fontSize:24,marginTop:5}}>{money(data.ytdSpend)}</strong></div>
            <div style={{background:"#0f1015",border:"1px solid #2f3039",borderRadius:14,padding:16}}><small style={{color:"#8e8998"}}>Fal credit balance</small><strong style={{display:"block",fontSize:24,marginTop:5}}>{money(data.balance)}</strong></div>
          </div>
          <div style={{display:"grid",gap:8}}>
            {data.sceneCosts.length ? data.sceneCosts.map((scene) => (
              <div key={scene.sceneIndex} style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",background:"#0f1015",border:"1px solid #282a33",borderRadius:12,padding:"12px 14px"}}>
                <div><strong>Scene {scene.sceneIndex + 1}</strong><span style={{marginLeft:8,color:"#8e8998",fontSize:12}}>{scene.attempts} tracked generation{scene.attempts === 1 ? "" : "s"}</span></div>
                <div style={{textAlign:"right"}}><strong>{money(scene.cost)}</strong>{scene.estimatedCost > 0 ? <div style={{fontSize:11,color:"#d9b36c"}}>includes {money(scene.estimatedCost)} estimated</div> : <div style={{fontSize:11,color:"#91e8b3"}}>Fal billing event</div>}</div>
              </div>
            )) : <p style={{color:"#9d9aa5"}}>No attributable scene costs yet. Generate or save a scene, then refresh.</p>}
          </div>
          {data.note ? <p style={{fontSize:12,color:"#8e8998",marginBottom:0,marginTop:16}}>{data.note}</p> : null}
        </> : null}
      </div>
    </section>
  );
}
