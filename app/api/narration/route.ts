import { NextResponse } from "next/server";
import { getCustomEpisode, getSeries, clearFinalVideo, recordAsset } from "@/lib/db";
import { loadNarration, saveNarration } from "@/lib/narration";
import { narrationVoices } from "@/lib/production";
import { putR2Object, r2Configured } from "@/lib/r2";
import { mediaDuration } from "@/lib/media";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
export const runtime="nodejs";
export const maxDuration=120;
async function narratedEpisode(id:string){
  const episode=await getCustomEpisode(id);
  if(!episode) throw Error("Episode not found.");
  const series=await getSeries(episode.seriesId||"household-nonsense");
  if(!series || (series.format!=="narrated" && series.id!=="household-nonsense")) throw Error("Enable narration in this series' production settings first.");
  return episode;
}
export async function GET(request:Request){try{const id=new URL(request.url).searchParams.get("episodeId")||"";await narratedEpisode(id);return NextResponse.json({scenes:await loadNarration(id)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not load narration."},{status:400});}}
export async function POST(request:Request){let dir="";try{
  const body=await request.json();
  const id=typeof body.episodeId==="string"?body.episodeId:"";
  const episode=await narratedEpisode(id);
  const index=body.sceneIndex;
  if(!Number.isInteger(index)||index<0||index>=episode.scenes.length) throw Error("Invalid scene.");
  const text=typeof body.text==="string"?body.text.trim():"";
  if(text.length>1000) throw Error("Keep each narration line under 1,000 characters.");
  if(!narrationVoices.includes(body.voice)) throw Error("Choose a supported narrator voice.");
  if(!["save","generate"].includes(body.action)) throw Error("Invalid narration action.");
  const current=(await loadNarration(id))[index];
  let item=current?.text===text&&current?.voice===body.voice?current:{text,voice:body.voice,url:"",duration:0};
  if(body.action==="generate"){
    if(!text) throw Error("Enter narration first.");
    if(!process.env.OPENAI_API_KEY) throw Error("OPENAI_API_KEY is not configured.");
    if(!r2Configured()) throw Error("Narration requires Cloudflare R2 storage.");
    const response=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"tts-1",voice:body.voice,input:text,response_format:"mp3"}),signal:AbortSignal.timeout(90000)});
    if(!response.ok){const error=await response.json().catch(()=>null);throw Error(error?.error?.message||`Speech generation failed (${response.status}).`);}
    const bytes=Buffer.from(await response.arrayBuffer());
    dir=await fs.mkdtemp(path.join(os.tmpdir(),"relations-narration-"));
    const file=path.join(dir,"voice.mp3");await fs.writeFile(file,bytes);
    const duration=await mediaDuration(file);
    const stored=await putR2Object(`relations/${id.replace(/[^a-zA-Z0-9-_]/g,"-")}/narration/${index}-${crypto.randomUUID()}.mp3`,bytes,"audio/mpeg");
    item={text,voice:body.voice,url:stored.url,duration};
  }
  await saveNarration(id,index,item);if(body.action==="generate") await recordAsset({episodeId:id,kind:"narration",sceneIndex:index,url:item.url,label:`Scene ${index+1} voice`});await clearFinalVideo(id);
  return NextResponse.json({narration:item});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Narration failed."},{status:400});}finally{if(dir)await fs.rm(dir,{recursive:true,force:true});}}
