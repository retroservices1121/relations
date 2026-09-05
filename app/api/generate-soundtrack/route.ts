import { NextResponse } from "next/server";
import { dbConfigured, loadProject, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";
import { generateSoundtrackedVideo } from "@/lib/soundtrack";
export const runtime="nodejs"; export const maxDuration=300;
function cleanPart(value:string){return value.replace(/[^a-zA-Z0-9-_]/g,"-");}
function derivedSourceUrl(episodeId:string,sceneIndex:number,requestId:string){const base=process.env.R2_PUBLIC_URL?.replace(/\/$/,""); if(!base||!requestId) return ""; return `${base}/relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex+1}-${cleanPart(requestId)}.mp4`;}
export async function POST(request:Request){
 try{
  if(!process.env.FAL_KEY) return NextResponse.json({error:"FAL_KEY is not configured on the server."},{status:500});
  if(!r2Configured()) return NextResponse.json({error:"Cloudflare R2 is required to save generated SFX."},{status:503});
  const body=await request.json(); const episodeId=typeof body.episodeId==="string"?body.episodeId:"episode"; const sceneIndex=Math.max(0,Number(body.sceneIndex)||0); const duration=Math.max(1,Math.min(30,Number(body.duration)||5)); let requestId=typeof body.requestId==="string"?body.requestId:"";
  let sourceVideoUrl=typeof body.sourceVideoUrl==="string"?body.sourceVideoUrl:"";
  if(dbConfigured()){
    const project=await loadProject(episodeId); const row=project.scenes.find((item:{scene_index:number})=>Number(item.scene_index)===sceneIndex);
    if(!requestId) requestId=row?.request_id||"";
    if(!sourceVideoUrl) sourceVideoUrl=row?.source_video_url||"";
    if(!sourceVideoUrl&&row?.video_url?.includes("/scenes/")) sourceVideoUrl=row.video_url;
    if(!sourceVideoUrl&&requestId) sourceVideoUrl=derivedSourceUrl(episodeId,sceneIndex,requestId);
  }
  if(!requestId) requestId=crypto.randomUUID();
  if(!sourceVideoUrl.startsWith("http")||sourceVideoUrl.includes("/soundtracks/")) return NextResponse.json({error:"The original silent scene source could not be located. Regenerate this scene once, then retry SFX regeneration."},{status:409});
  const sourceCheck=await fetch(sourceVideoUrl,{method:"GET",cache:"no-store"}); if(!sourceCheck.ok) return NextResponse.json({error:"The original silent scene source is no longer available in R2. Regenerate this scene once, then retry SFX regeneration."},{status:409});
  const soundtrack=await generateSoundtrackedVideo(sourceVideoUrl,duration); const response=await fetch(soundtrack.videoUrl,{cache:"no-store"}); if(!response.ok) throw new Error(`Could not download MMAudio result (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer()); const key=`relations/${cleanPart(episodeId)}/soundtracks/scene-${sceneIndex+1}-${Date.now()}.mp4`; const stored=await putR2Object(key,bytes,"video/mp4");
  if(dbConfigured()) await saveSceneVideo({episodeId,sceneIndex,videoUrl:stored.url,sourceVideoUrl,requestId});
  return NextResponse.json({url:stored.url,key:stored.key,sourceUrl:sourceVideoUrl,requestId:soundtrack.requestId,persisted:dbConfigured()});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not generate the scene SFX."},{status:500});}
}
