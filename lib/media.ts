import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
export async function mediaDuration(file: string) {
  const result = await exec(ffmpeg,["-hide_banner","-i",file],{encoding:"utf8"}).catch((e:{stderr?:string})=>({stderr:e.stderr||""}));
  const match=result.stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if(!match) throw Error("Could not measure media duration.");
  return Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
}
export async function attachNarration(video: string, audio: string | null, output: string, sceneNumber: number) {
  const duration=await mediaDuration(video);
  if(audio && await mediaDuration(audio)>duration+0.05) throw Error(`Scene ${sceneNumber}: narration is longer than the video. Shorten the line and regenerate narration, or use a longer clip.`);
  const input=audio?["-i",audio]:["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"];
  await exec(ffmpeg,["-y","-i",video,...input,"-map","0:v:0","-map","1:a:0","-c:v","copy","-af","apad","-c:a","aac","-ar","48000","-ac","2","-t",String(duration),"-movflags","+faststart",output]);
}
