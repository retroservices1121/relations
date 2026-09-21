import { NextResponse } from "next/server";
import { dbConfigured, listSeries, saveSeries, getSeries, pool } from "@/lib/db";
import { cleanSeriesKey, type SeriesCharacter, type SeriesConfig } from "@/lib/series";

export const dynamic = "force-dynamic";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const series = await getSeries(text(body.id));
    if (!series) return NextResponse.json({error:"Series not found."},{status:404});
    if (series.locked) return NextResponse.json({error:"This series has protected production settings."},{status:403});
    if (!["9:16","16:9"].includes(body.aspectRatio) || !["silent","dialogue","narrated"].includes(body.format)) return NextResponse.json({error:"Choose a valid shape and format."},{status:400});
    const saved=await saveSeries({...series,aspectRatio:body.aspectRatio,format:body.format});
    if ((series.aspectRatio||"9:16")!==body.aspectRatio || series.format!==body.format) {
      await pool().query(`UPDATE relations_projects SET final_url=NULL,updated_at=NOW() WHERE episode_id IN (SELECT episode_id FROM relations_custom_episodes WHERE series_id=$1)`,[series.id]);
    }
    return NextResponse.json({series:saved});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Could not save settings."},{status:500}); }
}

export async function GET() {
  try {
    if (!dbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    return NextResponse.json({ series: await listSeries() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load series." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!dbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    const body = await request.json();
    const title = text(body.title);
    if (title.length < 2) return NextResponse.json({ error: "Give the series a title." }, { status: 400 });
    const description = text(body.description);
    const visualStyle = text(body.visualStyle);
    const screenplayRules = text(body.screenplayRules);
    if (description.length < 10) return NextResponse.json({ error: "Describe what the series is about." }, { status: 400 });
    if (visualStyle.length < 10) return NextResponse.json({ error: "Describe the series visual style." }, { status: 400 });
    if (screenplayRules.length < 10) return NextResponse.json({ error: "Add the screenplay and continuity rules for this series." }, { status: 400 });
    const rawCharacters = Array.isArray(body.characters) ? body.characters.slice(0, 12) : [];
    const usedKeys = new Set<string>();
    const characters: SeriesCharacter[] = rawCharacters.map((raw: unknown, index: number) => {
      const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const name = text(item.name);
      const baseKey = cleanSeriesKey(text(item.key) || name, `character-${index + 1}`);
      let key = baseKey;
      let suffix = 2;
      while (usedKeys.has(key)) key = `${baseKey}-${suffix++}`;
      usedKeys.add(key);
      return { key, name, description: text(item.description), referenceUrl: text(item.referenceUrl) || undefined };
    }).filter((character: SeriesCharacter) => character.name && character.description);
    if (!characters.length) return NextResponse.json({ error: "Add at least one character with a name and description." }, { status: 400 });
    const baseId = cleanSeriesKey(title, "series");
    const series: SeriesConfig = {
      id: `${baseId}-${Date.now().toString(36)}`,
      title,
      description,
      visualStyle,
      screenplayRules,
      aspectRatio: body.aspectRatio === "16:9" ? "16:9" : "9:16",
      format: body.format === "narrated" ? "narrated" : body.format === "dialogue" ? "dialogue" : "silent",
      musicMode: "none",
      locked: false,
      characters,
    };
    const saved = await saveSeries(series);
    return NextResponse.json({ series: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create series." }, { status: 500 });
  }
}
