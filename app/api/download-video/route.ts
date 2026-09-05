import { NextResponse } from "next/server";

export const runtime = "nodejs";

function allowedVideoUrl(url: string) {
  const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  return Boolean(publicBase && url.startsWith(`${publicBase}/relations/`));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url") || "";
    const filename = (searchParams.get("filename") || "relations-episode.mp4")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/\.mp4$/i, "") + ".mp4";

    if (!url || !allowedVideoUrl(url)) {
      return NextResponse.json({ error: "A valid Relations R2 video URL is required." }, { status: 400 });
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Could not load the final video from R2." }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not download final video." },
      { status: 500 },
    );
  }
}
