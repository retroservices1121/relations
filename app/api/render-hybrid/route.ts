import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { putR2Object, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

type EditorText = { text:string; start:number; end:number; position:"top"|"middle"|"bottom" };
type EditorAudio = { url:string; start:number; volume:number; kind:"music"|"sfx" };

type Item = {
  type: "video" | "image";
  url: string;
  duration: number;
};

async function download(url: string, out: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not download timeline media (${response.status}).`);
  }
  await fs.writeFile(out, Buffer.from(await response.arrayBuffer()));
}

export async function POST(request: Request) {
  let dir = "";

  try {
    if (!r2Configured()) {
      return NextResponse.json(
        { error: "Hybrid export requires Cloudflare R2." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const texts:EditorText[] = Array.isArray(body.texts) ? body.texts.filter((x:unknown)=>x&&typeof x==="object"&&typeof (x as EditorText).text==="string") : [];
    const audio:EditorAudio[] = Array.isArray(body.audio) ? body.audio.filter((x:unknown)=>x&&typeof x==="object"&&typeof (x as EditorAudio).url==="string") : [];
    const items = (Array.isArray(body.items) ? body.items : []).filter(
      (value: unknown): value is Item => {
        if (!value || typeof value !== "object") return false;
        const item = value as Item;
        return (
          (item.type === "video" || item.type === "image") &&
          typeof item.url === "string" &&
          item.url.startsWith("http") &&
          Number(item.duration) > 0
        );
      },
    );

    if (!items.length) {
      return NextResponse.json(
        { error: "Add at least one video or still image." },
        { status: 400 },
      );
    }

    dir = await fs.mkdtemp(path.join(os.tmpdir(), "relations-hybrid-"));
    const parts: string[] = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const input = path.join(
        dir,
        `input-${i}.${item.type === "image" ? "jpg" : "mp4"}`,
      );
      const out = path.join(dir, `part-${i}.mp4`);

      await download(item.url, input);

      if (item.type === "image") {
        await execFileAsync(ffmpegPath, [
          "-y",
          "-loop",
          "1",
          "-i",
          input,
          "-t",
          String(item.duration),
          "-vf",
          "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-movflags",
          "+faststart",
          out,
        ]);
      } else {
        await execFileAsync(ffmpegPath, [
          "-y",
          "-i",
          input,
          "-t",
          String(item.duration),
          "-vf",
          "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p",
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          out,
        ]);
      }

      parts.push(out);
    }

    const concat = path.join(dir, "concat.txt");
    await fs.writeFile(
      concat,
      parts
        .map((part) => `file '${part.replace(/'/g, "'\\''")}'`)
        .join("\n"),
    );

    const joined = path.join(dir, "joined.mp4");
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concat,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      joined,
    ]);

    let finalPath=joined;
    if(texts.length){
      const draw=texts.filter(t=>t.text.trim()).map(t=>{const y=t.position==="top"?"120":t.position==="middle"?"(h-text_h)/2":"h-text_h-140";const safe=t.text.replace(/\\/g,"\\\\").replace(/:/g,"\\:").replace(/'/g,"\\'");return `drawtext=text='${safe}':fontcolor=white:fontsize=46:borderw=4:bordercolor=black:x=(w-text_w)/2:y=${y}:enable='between(t,${Math.max(0,t.start)},${Math.max(t.start+.1,t.end)})'`;}).join(",");
      if(draw){const out=path.join(dir,"texted.mp4");await execFileAsync(ffmpegPath,["-y","-i",finalPath,"-vf",draw,"-c:v","libx264","-preset","veryfast","-crf","20","-c:a","copy",out]);finalPath=out;}
    }
    for(let i=0;i<audio.length;i++){const layer=audio[i];const input=path.join(dir,`audio-${i}`);await download(layer.url,input);const out=path.join(dir,`mixed-${i}.mp4`);const delay=Math.max(0,Math.round(layer.start*1000));const volume=Math.max(0,Math.min(1,Number(layer.volume)||0));await execFileAsync(ffmpegPath,["-y","-i",finalPath,"-i",input,"-filter_complex",`[1:a]volume=${volume},adelay=${delay}|${delay}[add];[0:a][add]amix=inputs=2:duration=first:dropout_transition=0[a]`,"-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-ar","48000","-ac","2",out]);finalPath=out;}
    const bytes = await fs.readFile(finalPath);
    const stored = await putR2Object(
      `relations/hybrid/final-${Date.now()}.mp4`,
      bytes,
      "video/mp4",
    );

    return NextResponse.json({ url: stored.url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build hybrid video.",
      },
      { status: 500 },
    );
  } finally {
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
