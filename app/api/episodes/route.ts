import { NextRequest, NextResponse } from "next/server";
import { createCustomEpisode, listCustomEpisodes } from "../../../lib/db";
import type { Scene } from "../../../data/episodes";

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
  return [
    `Establish the setup clearly: ${normalized}`,
    `Develop the situation from the setup with a clear visual escalation. Preserve the people, objects, location and intent from the creator's story: ${normalized}`,
    "Escalate the central situation further with one readable visual comedy or story beat. Do not introduce unrelated characters or events.",
    "Deliver the main payoff implied by the creator's story. Make the action visually obvious and preserve continuity from the previous scene.",
    `End on a clean final reaction or button that completes this story: ${normalized}`,
  ];
}

function charactersForBeat(beat: string) {
  const names = ["Joe", "Danda", "Buddy"].filter((name) => new RegExp(`\\b${name}\\b`, "i").test(beat));
  if (names.length === 1) return `ONLY ${names[0]} appears in this scene. Do not introduce Joe, Danda, Buddy, background people, reflections of other characters, or extra copies unless that named character is ${names[0]}. Exactly one ${names[0]}.`;
  if (names.length > 1) return `Characters present: ${names.join(" and ")}. Exactly one of each named character. Do not add any other people or duplicate, clone, mirror, repeat, or create extra copies of them.`;
  return "Use only the characters explicitly required by this beat. Do not invent background people, duplicate recurring characters, or add an unrelated person to create motion.";
}

function propLockForBeat(beat: string) {
  const deviceMentioned = /\b(phone|laptop|tablet|flashlight|remote|computer|screen)\b/i.test(beat);
  return deviceMentioned
    ? "PROP LOCK: Use only the device or handheld object explicitly named in the creator beat. Do not substitute it with a different device or invent an additional handheld prop."
    : "PROP LOCK: No phone, laptop, tablet, flashlight, remote, computer, glowing handheld screen, or other invented handheld device appears. Do not invent a prop just to give a character something to do.";
}

function negativeInvariants(beat: string) {
  const sentences = beat.match(/[^.!?]+[.!?]?/g) || [beat];
  const negatives = sentences.filter((sentence) => /\b(without|does not|doesn't|do not|don't|never|must not|is not|isn't|remain(?:s)? on|stay(?:s)? on)\b/i.test(sentence));
  const rules: string[] = [];
  if (negatives.length) rules.push(`CREATOR INVARIANTS: ${negatives.map((s) => s.trim()).join(" ")} Treat these as hard physical state constraints, not optional story flavor.`);
  if (/light switch/i.test(beat) && /(walks?|passes?|past)/i.test(beat) && /(without|does not|doesn't|not touch|remains? on|stays? on)/i.test(beat)) {
    rules.push("LIGHT-SWITCH STATE LOCK: The room light is already ON in the first frame and stays ON through the final frame. The wall switch remains in the exact same position. Danda's hands remain physically separated from the switch as she passes it. No finger reaches toward it. No switch movement occurs. Brightness, illumination, and shadows do not change at any point in this scene.");
  }
  return rules.join("\n");
}

function compileScenePrompt(beat: string, index: number, beats: string[]) {
  const previous = index > 0 ? beats[index - 1] : "None — this is the opening scene.";
  const next = index < beats.length - 1 ? beats[index + 1] : "None — this is the final scene.";
  const invariants = negativeInvariants(beat);
  return `PRODUCTION SCENE ${index + 1} OF ${beats.length}

SCENE GOAL:
${beat}

CHARACTERS IN SHOT:
${charactersForBeat(beat)}

FIRST FRAME / START STATE:
Begin directly at the physical state described by this creator beat. Do not invent a lead-in action. Do not perform an action that belongs to the previous or next scene. ${index > 0 ? "Visually preserve the room, wardrobe, character positions, important props, and object states established by the previous beat." : "Establish the location and character positions simply and clearly before motion begins."}

ACTION BLOCKING:
Perform only the visible action described in SCENE GOAL, in the same order. Use simple readable physical acting. Every important action must be visible on screen. Do not add business, filler actions, new props, surprise actions, or extra story beats. If the creator says a character passes, ignores, leaves, keeps, remains, stays, or does something WITHOUT another action, preserve that state literally rather than animating the prohibited action.

END STATE:
Stop immediately after this scene's stated beat is complete. Hold the final reaction or physical state briefly. Do not begin the next story beat early.

CONTINUITY:
Previous beat: ${previous}
Next beat: ${next}
The current scene must bridge these states without contradicting either one. Objects do not teleport, switches do not change state unless explicitly operated, lights do not change unless explicitly requested, and characters do not acquire unexplained props.

${propLockForBeat(beat)}
${invariants ? `\n${invariants}` : ""}

CAMERA / COMPOSITION:
One simple vertical 9:16 shot unless a cut is absolutely necessary to understand the beat. Use a stable medium-wide or medium composition that clearly shows the important character action and any story-critical prop at the same time. Keep camera movement minimal. Do not use flashy lighting effects, dramatic zooms, montage inserts, or cinematic improvisation.

AUDIO / TEXT:
This is silent physical acting. Do not make characters speak, mouth dialogue, or perform speech-like gestures. Any dialogue, captions, voiceover, music, or text will be added later in Studio. No generated on-screen text.`;
}

function compileScenes(prompt: string): Scene[] {
  const beats = splitStory(prompt);
  return beats.map((beat, index) => ({
    duration: index === 0 || index === beats.length - 1 ? 5 : 6,
    prompt: compileScenePrompt(beat, index, beats),
    caption: "",
  }));
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
    const scenes = compileScenes(prompt);
    const episode = await createCustomEpisode({ title, hook: mode === "idea" ? prompt.slice(0, 140) : "Creator-provided script", sourcePrompt: prompt, inputMode: mode, scenes });
    return NextResponse.json({ episode });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create episode plan." }, { status: 500 }); }
}
