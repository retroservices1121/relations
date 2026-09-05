import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

function cleanPart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error: "Permanent video storage is not configured. Connect a Vercel Blob store to this project so BLOB_READ_WRITE_TOKEN is available.",
          code: "BLOB_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "episode";
    const requestId = typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
    const sceneIndex = Number(body.sceneIndex);

    if (!sourceUrl.startsWith("http")) {
      return NextResponse.json({ error: "A valid source video URL is required." }, { status: 400 });
    }

    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
      return NextResponse.json({ error: "A valid scene index is required." }, { status: 400 });
    }

    const source = await fetch(sourceUrl, { cache: "no-store" });
    if (!source.ok) {
      return NextResponse.json({ error: `Could not download generated video (${source.status}).` }, { status: 502 });
    }

    const bytes = await source.arrayBuffer();
    const pathname = `relations/${cleanPart(episodeId)}/scenes/scene-${sceneIndex + 1}-${cleanPart(requestId)}.mp4`;
    const blob = await put(pathname, bytes, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save generated video." },
      { status: 500 },
    );
  }
}
