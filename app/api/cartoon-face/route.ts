import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });
export const runtime = "nodejs";

const ENDPOINT = "fal-ai/kling-video/o1/standard/video-to-video/edit";
type CastKey = "joe" | "danda";

function personDescription(key: CastKey) {
  return key === "joe" ? "the adult man in the source video" : "the adult woman in the source video";
}
function buildPrompt(cast: CastKey[]) {
  const assignments=cast.map((key,index)=>`Replace the COMPLETE visible human head of ${personDescription(key)} with the exact locked Household Nonsense cartoon head from @Element${index+1}.`).join(" ");
  return `HOUSEHOLD NONSENSE LOCKED CARTOON HEAD EDIT. ${assignments}
CHARACTER IDENTITY IS ABSOLUTE. The supplied cartoon head is the character. Preserve its exact face shape, hairstyle, hair color, facial hair, eyes, nose, mouth design, proportions and illustration style. Never inherit or recreate the live actor's real hairstyle, facial features, facial hair, head shape or head appearance.
Replace the complete visible human head, not merely facial features. Keep the actor's real body, neck below the natural attachment point, clothing, hands, body shape, movement, props, environment, lighting, camera framing, timing and performance unchanged.
Track each assigned person consistently for the entire clip. Never swap Joe and Danda. Preserve the source head position, turns, nods, tilts, scale and occlusion while keeping the locked cartoon head design stable frame to frame.
Match expression and mouth movement to the source performance when possible without redesigning the character. Preserve the original audio exactly.
Do not cartoonize the body or environment. Do not add captions, logos, extra people, extra heads, duplicate faces, masks or accessories. Do not alter duration or pacing.`;
}
export async function POST(request:Request){try{
 if(!process.env.FAL_KEY)return NextResponse.json({error:"FAL_KEY is not configured on the server."},{status:500});
 const body=await request.json();const videoUrl=typeof body.videoUrl==="string"?body.videoUrl.trim():"";const cast=Array.isArray(body.cast)?body.cast.filter((v:unknown):v is CastKey=>v==="joe"||v==="danda"):[];const referenceUrls=body.referenceUrls&&typeof body.referenceUrls==="object"?body.referenceUrls as Record<string,string>:{};
 if(!videoUrl)return NextResponse.json({error:"Upload a recorded video first."},{status:400});if(!cast.length||cast.length>2)return NextResponse.json({error:"Choose Joe, Danda, or both."},{status:400});
 const elements=cast.map(key=>{const url=(referenceUrls[key]||"").trim();if(!url)throw Error(`The locked ${key==="joe"?"Joe":"Danda"} reference is missing.`);return{frontal_image_url:url,reference_image_urls:[url]};});
 const submission=await fal.queue.submit(ENDPOINT,{input:{prompt:buildPrompt(cast),video_url:videoUrl,keep_audio:true,elements}});
 return NextResponse.json({requestId:submission.request_id,endpoint:ENDPOINT});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Cartoon head generation failed."},{status:500});}}
export async function GET(request:Request){try{
 if(!process.env.FAL_KEY)return NextResponse.json({error:"FAL_KEY is not configured on the server."},{status:500});const requestId=new URL(request.url).searchParams.get("requestId")||"";if(!requestId)return NextResponse.json({error:"requestId is required."},{status:400});
 const status=await fal.queue.status(ENDPOINT,{requestId,logs:true});if(status.status!=="COMPLETED"){if(String(status.status)==="FAILED")return NextResponse.json({status:"FAILED",error:"The video edit failed at the provider."},{status:500});return NextResponse.json({status:status.status});}
 const result=await fal.queue.result(ENDPOINT,{requestId});const data=result.data as{video?:{url?:string}};if(!data.video?.url)throw Error("The provider completed without returning a video.");return NextResponse.json({status:"COMPLETED",videoUrl:data.video.url});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not check cartoon head generation."},{status:500});}}
