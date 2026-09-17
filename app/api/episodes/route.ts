import { NextRequest, NextResponse } from "next/server";
import { createCustomEpisode, listCustomEpisodes } from "../../../lib/db";

export const dynamic = "force-dynamic";

function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function sentenceTitle(text: string) {
  const words = text.replace(/[^a-zA-Z0-9' ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 7);
  return words.length ? words.join(" ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Untitled Episode";
}
function splitStory(text: string) {
  const normalized = text.replace(/\r/g, "\n").replace(/\n{2,}/g, "\n").trim();
  const explicit = normalized.split(/\n|(?<=\.)\s+(?=(?:then|next|finally|after|meanwhile)\b)/i).map((s) => s.trim()).filter((s) => s.length > 18);
  if (explicit.length >= 3) return explicit.slice(0, 8);
  const sentences = normalized.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter((s) => s.length > 12) || [];
  if (sentences.length >= 3) return sentences.slice(0, 8);
  const beats = [
    `Establish the setup clearly: ${normalized}`,
    `Develop the situation from the setup with a clear visual escalation. Preserve the people, objects, location and intent from the creator's story: ${normalized}`,
    `Escalate the central situation further with one readable visual comedy or story beat. Do not introduce unrelated characters or events.`,
    `Deliver the main payoff implied by the creator's story. Make the action visually obvious and preserve continuity from the previous scene.`,
    `End on a clean final reaction or button that completes this story: ${normalized}`,
  ];
  return beats;
}

export async function GET() {
  try { return NextResponse.json({ episodes: await listCustomEpisodes() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load episodes." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = clean(body.prompt);
    const mode = body.mode === "script" ? "script" : "idea";
    if (prompt.length < 10) return NextResponse.json({ error: "Give the episode a little more detail first." }, { status: 400 });
    const title = clean(body.title) || sentenceTitle(prompt);
    const beats = splitStory(prompt);
    const scenes = beats.map((beat, index) => ({ duration: index === 0 || index === beats.length - 1 ? 5 : 6, prompt: beat, caption: "" }));
    const episode = await createCustomEpisode({ title, hook: mode === "idea" ? prompt.slice(0, 140) : "Creator-provided script", sourcePrompt: prompt, inputMode: mode, scenes });
    return NextResponse.json({ episode });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create episode plan." }, { status: 500 }); }
}
