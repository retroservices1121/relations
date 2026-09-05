import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dbConfigured, saveSceneVideo } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";
import { generateSoundtrackedVideo } from "@/lib/soundtrack";

export const runtime = "nodejs";
export const maxDuration = 300;
const execFileAsync = promisify(execFile);
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
function cleanPart(value: string) { return value.replace(/[^a-zA-Z0-9-_]/g, "-"); }
async function probeDuration(url: string) {
  const { stdout } = await execFileAsync(ffprobePath,["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",url]);
  const duration=Number(String(stdout).trim()); if(!Number.isFinite(duration)||duration<=0) throw new Error("Could not determine scene duration for soundtrack generation."); return Math.min(30,duration);
}
export async function POST(request: Request) {
  try {
    if(!r2Configured()) return NextResponse.json({error:"Permanent video storage is not configured. Add the R2 environment variables to Railway.",code:"R2_NOT_CONFIGURED"},{status:503});
    if(!dbConfigured()) return NextResponse.json({error:"Railway Postgres is not configured. Add a Postgres service so DATABASE_URL is available.",code:"DB_NOT_CONFIGURED"},{status:503});
    const body=await request.json(); const sourceUrl=typeof body.sourceUrl==="string"?body.sourceUrl:""; const episodeId=typeof body.episodeId==="string"?body.episodeId:"episode"; const requestId=typeof body.requestId==="string"?body.requestId:crypto.randomUUID(); const sceneIndex=Number(body.sceneIndex);
    if(!sourceUrl.startsWith("http")) return NextResponse.json({error:"A valid source video URL is required."},{status:400});
    if(!Number.isInteger(sceneIndex)||sceneIndex<0) return NextResponse.json({error:"A valid scene index is required."},{status:400});
    const source=await fetch(sourceUrl,{cache:"no-store"}); if(!source.ok) return NextResponse.json({error:`Could not download generated video (${source.status}).`},{status:502});
    const bytes=new Uint8Array(await source.arrayBuffer()); const sourceKey=`relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex+1}-${cleanPart(requestId)}.mp4`; const sourceStored=await putR2Object(sourceKey,bytes,"video/mp4");
    try {
      const duration=await probeDuration(sourceStored.url); const soundtrack=await generateSoundtrackedVideo(sourceStored.url,duration); const processed=await fetch(soundtrack.videoUrl,{cache:"no-store"}); if(!processed.ok) throw new Error(`Could not download MMAudio result (${processed.status}).`);
      const processedBytes=new Uint8Array(await processed.arrayBuffer()); const key=`relations/${cleanPart(episodeId)}/soundtracks/scene-${sceneIndex+1}-${cleanPart(requestId)}.mp4`; const stored=await putR2Object(key,processedBytes,"video/mp4");
      await saveSceneVideo({episodeId,sceneIndex,videoUrl:stored.url,sourceVideoUrl:sourceStored.url,requestId});
      return NextResponse.json({url:stored.url,key:stored.key,persisted:true,soundtrack:true,sourceUrl:sourceStored.url,soundtrackRequestId:soundtrack.requestId});
    } catch(error) {
      await saveSceneVideo({episodeId,sceneIndex,videoUrl:sourceStored.url,sourceVideoUrl:sourceStored.url,requestId});
      return NextResponse.json({url:sourceStored.url,key:sourceStored.key,persisted:true,soundtrack:false,soundtrackPending:true,sourceUrl:sourceStored.url,soundtrackError:error instanceof Error?error.message:"SFX generation will retry during final rendering."});
    }
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Could not save generated video."},{status:500}); }
}
