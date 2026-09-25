import { NextResponse } from "next/server";
import { dbConfigured, getEpisodeAsset } from "@/lib/db";

export const runtime = "nodejs";

const contentTypes: Record<string,string> = {
  mp4:"video/mp4", mp3:"audio/mpeg", wav:"audio/wav",
  png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp",
};

export async function GET(request:Request) {
  try {
    if (!dbConfigured()) return NextResponse.json({error:"Production storage is unavailable."},{status:503});
    const params=new URL(request.url).searchParams;
    const episodeId=params.get("episodeId")||"";
    const assetId=Number(params.get("assetId"));
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(episodeId) || !Number.isSafeInteger(assetId) || assetId<1) return NextResponse.json({error:"Select a saved asset."},{status:400});
    const asset=await getEpisodeAsset(episodeId,assetId);
    if (!asset) return NextResponse.json({error:"Asset not found."},{status:404});
    const base=process.env.R2_PUBLIC_URL?.replace(/\/$/,"");
    if (!base || !asset.url.startsWith(`${base}/relations/`)) return NextResponse.json({error:"This asset cannot be downloaded from production storage."},{status:400});
    const extension=new URL(asset.url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()||"";
    if (!contentTypes[extension]) return NextResponse.json({error:"Unsupported asset format."},{status:400});
    const response=await fetch(asset.url,{cache:"no-store"});
    if (!response.ok || !response.body) return NextResponse.json({error:"Saved asset is unavailable."},{status:502});
    const filename=`${episodeId}-${asset.kind}-${asset.scene_index===null?"episode":`scene-${asset.scene_index+1}`}-${asset.id}.${extension}`;
    return new Response(response.body,{headers:{"Content-Type":contentTypes[extension],"Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, max-age=60"}});
  } catch (error) {return NextResponse.json({error:error instanceof Error?error.message:"Could not download asset."},{status:500});}
}
