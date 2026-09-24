import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime="nodejs";export const maxDuration=300;
const execFileAsync=promisify(execFile);const ffmpegPath=process.env.FFMPEG_PATH||"ffmpeg";
type Item={type:"video"|"image";url:string;duration:number};
async function download(url:string,out:string){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error(`Could not download timeline media (${r.status}).`);await fs.writeFile(out,Buffer.from(await r.arrayBuffer()));}
export async function POST(request:Request){let dir="";try{
 if(!r2Configured())return NextResponse.json({error:"Hybrid export requires Cloudflare R2."},{status:503});
 const body=await request.json();const items=(Array.isArray(body.items)?body.items:[]).filter((x:unknown):x is Item=>{if(!x||typeof x!=="object")return false;const i=x as Item;return(i.type==="video"||i.type==="image")&&typeof i.url==="string"&&i.url.startsWith("http")&&Number(i.duration)>0;});
 if(!items.length)return NextResponse.json({error:"Add at least one video or still image."},{status:400});
 dir=await fs.mkdtemp(path.join(os.tmpdir(),"relations-hybrid-"));const parts:string[]=[];
 for(let i=0;i<items.length;i++){const item=items[i];const input=path.join(dir,`input-${i}.${item.type==="image"?"jpg":"mp4"}`);const out=path.join(dir,`part-${i}.mp4`);await download(item.url,input);
  if(item.type==="image")await execFileAsync(ffmpegPath,["-y","-loop","1","-i",input,"-t",String(item.duration),"-vf","scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p","-an","-c:v","libx264","-preset","veryfast","-crf","20","-movflags","+faststart",out]);
  else await execFileAsync(ffmpegPath,["-y","-i",input,"-t",String(item.duration),"-vf","scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p","-map","0:v:0","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf","20","-c:a","aac","-ar","48000","-ac","2","-movflags","+faststart",out]);
  parts.push(out);
 }
 const concat=path.join(dir,"concat.txt");await fs.writeFile(concat,parts.map(p=>`file '${p.replace(/'/g,"'\\''")}'`).join("\n"));const joined=path.join(dir,"joined.mp4");await execFileAsync(ffmpegPath,["-y","-f","concat","-safe","0","-i",concat,"-c:v","libx264","-preset","veryfast","-crf","20","-c:a","aac","-ar","48000","-ac","2","-movflags","+faststart",joined]);
 const bytes=await fs.readFile(joined);const stored=await putR2Object(`relations/hybrid/final-${Date.now()}.mp4`,bytes,"video/mp4");return NextResponse.json({url:stored.url});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not build hybrid video."},{status:500});}finally{if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>undefined);}}
}
