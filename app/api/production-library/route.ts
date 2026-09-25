import { NextResponse } from "next/server";
import { dbConfigured, listEpisodeAssets, loadProject, restoreSceneTake } from "@/lib/db";

export const dynamic = "force-dynamic";

function validId(value:unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(value); }

export async function GET(request:Request) {
  try {
    if(!dbConfigured()) return NextResponse.json({error:"Production storage is unavailable."},{status:503});
    const episodeId=new URL(request.url).searchParams.get("episodeId");
    if(!validId(episodeId)) return NextResponse.json({error:"Select an episode."},{status:400});
    const [assets,project]=await Promise.all([listEpisodeAssets(episodeId),loadProject(episodeId)]);
    return NextResponse.json({assets,currentScenes:project.scenes.map((scene:{scene_index:number;video_url:string})=>({sceneIndex:scene.scene_index,url:scene.video_url})),finalUrl:project.finalUrl});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:"Could not load the production library."},{status:500});}
}

export async function POST(request:Request) {
  try {
    if(!dbConfigured()) return NextResponse.json({error:"Production storage is unavailable."},{status:503});
    const body=await request.json();
    if(!validId(body.episodeId)||body.action!=="restore-scene"||!Number.isSafeInteger(body.assetId)||body.assetId<1)
      return NextResponse.json({error:"Select a saved scene take."},{status:400});
    const restored=await restoreSceneTake(body.episodeId,body.assetId);
    if(!restored)
      return NextResponse.json({error:"That take is no longer available for this episode."},{status:404});
    return NextResponse.json({restored});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:"Could not restore that take."},{status:500});}
}
