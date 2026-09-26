import { NextResponse } from "next/server";
import { dbConfigured, recordAsset } from "@/lib/db";
import { putR2Object, r2Configured } from "@/lib/r2";


export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    if (!r2Configured()) return NextResponse.json({ error: "Reference image storage is unavailable." }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Seedance reference images must be JPEG, PNG, or WebP. iPhone HEIC/HEIF images are not supported yet. Please choose or export the image as JPG/PNG/WebP." },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 400 });
    }

    const episodeId = formData.get("episodeId");
    const characterKey = formData.get("characterKey");
    if (episodeId !== null && (typeof episodeId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(episodeId) || typeof characterKey !== "string" || !/^[a-zA-Z0-9_-]{1,50}$/.test(characterKey))) {
      return NextResponse.json({ error: "Invalid episode reference." }, { status: 400 });
    }
    let url: string;
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    if (typeof episodeId === "string") {
      if (!dbConfigured()) return NextResponse.json({ error: "Production storage is required to save references." }, { status: 503 });
      const stored = await putR2Object(`relations/${episodeId}/references/${characterKey}-${crypto.randomUUID()}.${extension}`, Buffer.from(await file.arrayBuffer()), file.type);
      url = stored.url;
      await recordAsset({ episodeId, kind: "reference", url, label: `${characterKey} reference` });
    } else {
      const stored = await putR2Object(`relations/series-references/${crypto.randomUUID()}.${extension}`, Buffer.from(await file.arrayBuffer()), file.type);
      url = stored.url;
    }
    return NextResponse.json({ url, contentType: file.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
