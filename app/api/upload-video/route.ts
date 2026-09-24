import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime"]);

export async function POST(request: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured on the server." }, { status: 500 });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A recorded video is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use an MP4 or MOV video." }, { status: 400 });
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "Video must be 200 MB or smaller." }, { status: 400 });
    }
    const url = await fal.storage.upload(file);
    return NextResponse.json({ url, contentType: file.type, size: file.size });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video upload failed." },
      { status: 500 },
    );
  }
}
