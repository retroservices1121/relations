import type { Scene } from "../data/episodes";

type CharacterKey = "joe" | "danda" | "buddy";

type ScreenplayScene = {
  duration: number;
  storyBeat: string;
  startState: string;
  action: string;
  endState: string;
  continuity: string;
  forbidden: string;
  caption: string;
  characters: CharacterKey[];
};

type ScreenplayPlan = {
  title: string;
  hook: string;
  scenes: ScreenplayScene[];
};

const SCREENPLAY_SCHEMA = {
  name: "relations_episode_screenplay",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook", "scenes"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 100 },
      hook: { type: "string", minLength: 1, maxLength: 180 },
      scenes: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "duration",
            "storyBeat",
            "startState",
            "action",
            "endState",
            "continuity",
            "forbidden",
            "caption",
            "characters",
          ],
          properties: {
            duration: { type: "integer", minimum: 4, maximum: 12 },
            storyBeat: { type: "string", minLength: 1 },
            startState: { type: "string", minLength: 1 },
            action: { type: "string", minLength: 1 },
            endState: { type: "string", minLength: 1 },
            continuity: { type: "string", minLength: 1 },
            forbidden: { type: "string", minLength: 1 },
            caption: { type: "string", minLength: 1, maxLength: 90 },
            characters: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: ["joe", "danda", "buddy"] },
            },
          },
        },
      },
    },
  },
} as const;

const SCENE_REWRITE_SCHEMA = {
  name: "relations_scene_rewrite",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: { prompt: { type: "string", minLength: 40 } },
  },
} as const;

const EPISODE_REWRITE_SCHEMA = {
  name: "relations_episode_rewrite",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["prompt", "caption"],
          properties: {
            prompt: { type: "string", minLength: 40 },
            caption: { type: "string", minLength: 1, maxLength: 90 },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are the senior animated-series screenwriter, storyboard director, and continuity supervisor inside Relations Studio.

You are writing a short vertical episode for Household Nonsense, a recurring silent 2D relationship-comedy series starring Joe and Danda. Joe is an early-40s man with short dark hair, a neat full beard, and an average slightly stocky everyday-dad build. Danda is an early-40s woman with long dark-brown hair with warm highlights and normal adult proportions. Buddy is their small black-and-white Maltese-like dog.

Turn the creator's premise into an actual episode, not generic filler. Build a clear setup, escalation, payoff, and final visual button. Every scene must earn its place and advance the same story. Preserve the creator's central joke and requested events. Do not introduce a phone, laptop, flashlight, remote, new character, or unrelated prop merely to create motion.

Choose the fewest scenes that tell the joke clearly. Every scene must have a different narrative function or materially change the situation. Never create multiple scenes that repeat the same action with only a different object, prop, expression, or camera angle. Combine repeated examples into one chronological escalation scene. For example, if Joe adds a mug, bowl, frying pan, and pot to a dishwasher, show those additions as one escalating scene rather than four separate scenes. Before returning the plan, remove any scene whose story beat can be deleted without changing the setup, escalation, reversal, or payoff. A short idea should usually be 2 to 4 scenes. Use 5 or 6 only when the plot truly has distinct turns. Treat a suggested scene count in a loose premise as flexible unless the creator explicitly says the exact count is mandatory.

Each video scene is generated separately, so every scene must be independently production-ready while maintaining exact continuity with the previous scene. Explicitly state the first frame, visible action in chronological order, and final frame. Repeat story-critical room layout, wardrobe, positions, prop states, lighting state, and character sides whenever they must remain unchanged. Never use vague phrases such as “continue the scene,” “as before,” or “the situation escalates” without spelling out what is visible.

Write simple, achievable animation. Prefer one location and one readable action per scene. Avoid montage unless the creator explicitly asks for one. Use positive physical descriptions for required states. Put prohibited actions and continuity failures in the forbidden field. If a light must stay on, state that it is already on in the first frame and remains the same through the last frame; do not center the wording on switching it off.

The characters do not speak or move their mouths. Dialogue is represented only by the caption field and is added later by Studio. Give every scene one short, useful overlay caption of no more than 90 characters. The captions should form a concise setup, escalation, and punchline when read in order. Do not leave captions blank. Do not put captions, subtitles, speech bubbles, labels, or generated words inside the visual prompt. Keep human mouths closed and visually still. The generated scene should rely on posture, eyes, eyebrows, props, and clear physical action.

Bed and sleep scenes: Joe and Danda are barefoot for the entire scene. No shoes, sneakers, slippers, boots, or sandals on the bed or beneath bedding. Buddy remains a small black-and-white Maltese-like dog.

Everyday household behavior must be believable for the stated time of day. Decorative pillows are arranged on a living-room sofa during daytime, or placed on a bed while making it in the morning; people do not freshly arrange decorative bed pillows immediately before going to sleep unless the creator explicitly makes that contradiction the joke.

Use 2 to 6 scenes, normally 2 to 4. Use 4 to 12 seconds per scene. Fewer strong scenes are always better than repetitive filler. Return only the requested JSON.`;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parsePlan(value: unknown): ScreenplayPlan {
  if (!value || typeof value !== "object")
    throw new Error("The screenplay model returned an invalid plan.");
  const candidate = value as Partial<ScreenplayPlan>;
  if (
    !Array.isArray(candidate.scenes) ||
    candidate.scenes.length < 2 ||
    candidate.scenes.length > 6
  )
    throw new Error("The screenplay model returned an invalid scene count.");
  const scenes = candidate.scenes.map((scene, index) => {
    if (!scene || typeof scene !== "object")
      throw new Error(`Scene ${index + 1} is invalid.`);
    const item = scene as Partial<ScreenplayScene>;
    const characters = Array.isArray(item.characters)
      ? item.characters.filter(
          (key): key is CharacterKey =>
            key === "joe" || key === "danda" || key === "buddy",
        )
      : [];
    const parsed: ScreenplayScene = {
      duration: Math.max(
        4,
        Math.min(12, Math.round(Number(item.duration) || 5)),
      ),
      storyBeat: clean(item.storyBeat),
      startState: clean(item.startState),
      action: clean(item.action),
      endState: clean(item.endState),
      continuity: clean(item.continuity),
      forbidden: clean(item.forbidden),
      caption: clean(item.caption),
      characters: Array.from(new Set(characters)),
    };
    if (
      !parsed.storyBeat ||
      !parsed.startState ||
      !parsed.action ||
      !parsed.endState ||
      !parsed.continuity ||
      !parsed.forbidden ||
      !parsed.characters.length
    )
      throw new Error(`Scene ${index + 1} is missing production details.`);
    return parsed;
  });
  return {
    title: clean(candidate.title, "Untitled Episode"),
    hook: clean(candidate.hook, "A new Household Nonsense episode"),
    scenes,
  };
}

function compileScene(
  scene: ScreenplayScene,
  index: number,
  total: number,
): Scene {
  const characterNames = scene.characters
    .map((key) => (key === "joe" ? "Joe" : key === "danda" ? "Danda" : "Buddy"))
    .join(" and ");
  const prompt = `PRODUCTION SCENE ${index + 1} OF ${total}

STORY BEAT:
${scene.storyBeat}

CHARACTERS IN SHOT:
Exactly one ${characterNames}. No other recurring characters, background people, duplicates, reflections, clones, or extra copies.

FIRST FRAME / START STATE:
${scene.startState}

ACTION BLOCKING:
${scene.action}

FINAL FRAME / END STATE:
${scene.endState}

CONTINUITY LOCK:
${scene.continuity}

FORBIDDEN ACTIONS / ERRORS:
${scene.forbidden}

CAMERA / COMPOSITION:
One clear vertical 9:16 shot. Use a stable medium-wide or medium composition that shows the full story action and all story-critical props. Keep camera movement minimal. No cinematic improvisation, montage insert, dramatic lighting effect, or unrelated cutaway.

AUDIO / TEXT:
Silent physical acting only. Every human mouth remains closed and visually still. No dialogue, narration, vocalization, lip sync, generated caption, subtitle, speech bubble, sign, or other on-screen text. Studio adds the caption later.`;
  return {
    duration: scene.duration,
    prompt,
    caption: scene.caption,
    captionStart: scene.caption ? 0.4 : undefined,
    captionEnd: scene.caption ? Math.max(1, scene.duration - 0.5) : undefined,
    characters: scene.characters,
  };
}

export function screenplayConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function screenplayModel() {
  const configured = process.env.OPENAI_SCREENPLAY_MODEL?.trim();

  // Correct the previously documented truncated model ID so existing Railway
  // deployments recover without sending an invalid name to OpenAI.
  if (configured === "gpt-5.6-terr") return "gpt-5.6-terra";

  return configured || "gpt-5-mini";
}

export async function writeEpisodeScreenplay(input: {
  premise: string;
  mode: "idea" | "script";
}): Promise<{ title: string; hook: string; scenes: Scene[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY is not configured. Relations requires the screenplay AI to create an episode plan.",
    );
  const model = screenplayModel();
  const instruction =
    input.mode === "script"
      ? "Adapt the creator-provided script into production scenes. Preserve its plot, scene order, joke, and ending. Improve only clarity, animation blocking, and continuity."
      : "Develop the creator's idea into a complete short animated episode with a deliberate setup, escalation, payoff, and final visual button.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${instruction}\n\nCREATOR INPUT:\n${input.premise}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: SCREENPLAY_SCHEMA,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!response.ok)
      throw new Error(
        data?.error?.message ||
          `Screenplay AI request failed with HTTP ${response.status}.`,
      );
    const content = data?.choices?.[0]?.message?.content;
    if (!content)
      throw new Error("The screenplay AI returned no episode plan.");
    const plan = parsePlan(JSON.parse(content));
    return {
      title: plan.title,
      hook: plan.hook,
      scenes: plan.scenes.map((scene, index) =>
        compileScene(scene, index, plan.scenes.length),
      ),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The screenplay AI timed out. Please try the episode idea again.",
      );
    if (error instanceof SyntaxError)
      throw new Error(
        "The screenplay AI returned malformed JSON. Please try again.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rewriteSceneWithAi(input: {
  episodeTitle: string;
  sceneIndex: number;
  totalScenes: number;
  currentPrompt: string;
  previousPrompt?: string;
  nextPrompt?: string;
  revisionNote: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY is not configured. Relations requires the screenplay AI to revise scenes.",
    );
  const model = screenplayModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const userPrompt = `EPISODE: ${input.episodeTitle}
SCENE: ${input.sceneIndex + 1} of ${input.totalScenes}

CREATOR'S REQUIRED REVISION:
${input.revisionNote}

PREVIOUS SCENE FOR CONTINUITY:
${input.previousPrompt || "This is the opening scene."}

CURRENT SCENE TO REWRITE:
${input.currentPrompt}

NEXT SCENE FOR CONTINUITY:
${input.nextPrompt || "This is the final scene."}

Rewrite only the current scene. Preserve its intended story beat unless the creator explicitly changes it. Return one complete production prompt with these labeled sections: STORY BEAT, CHARACTERS IN SHOT, FIRST FRAME / START STATE, ACTION BLOCKING, FINAL FRAME / END STATE, CONTINUITY LOCK, FORBIDDEN ACTIONS / ERRORS, CAMERA / COMPOSITION, and AUDIO / TEXT. Make the requested correction positive, literal, visually achievable, and consistent with both neighboring scenes.`;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: SCENE_REWRITE_SCHEMA,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!response.ok)
      throw new Error(
        data?.error?.message ||
          `Screenplay AI request failed with HTTP ${response.status}.`,
      );
    const content = data?.choices?.[0]?.message?.content;
    if (!content)
      throw new Error("The screenplay AI returned no scene revision.");
    const result = JSON.parse(content) as { prompt?: unknown };
    const prompt = clean(result.prompt);
    if (prompt.length < 40)
      throw new Error(
        "The screenplay AI returned an incomplete scene revision.",
      );
    return prompt;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The screenplay AI timed out. Please try the scene revision again.",
      );
    if (error instanceof SyntaxError)
      throw new Error(
        "The screenplay AI returned malformed JSON. Please try again.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rewriteEpisodeWithAi(input: {
  episodeTitle: string;
  revisionNote: string;
  scenes: Array<{ prompt: string; caption: string }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY is not configured. Relations requires the screenplay AI to revise episodes.",
    );
  const model = screenplayModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const currentScript = input.scenes
    .map(
      (scene, index) =>
        `SCENE ${index + 1}\nCAPTION: ${scene.caption}\n${scene.prompt}`,
    )
    .join("\n\n---\n\n");
  const userPrompt = `EPISODE: ${input.episodeTitle}

CREATOR'S REQUIRED EPISODE-WIDE REVISION:
${input.revisionNote}

CURRENT COMPLETE SCREENPLAY:
${currentScript}

Rewrite the complete screenplay as one coherent episode. Apply the creator's correction everywhere it affects location, time of day, props, action, continuity, captions, setup, escalation, and payoff. Preserve the central joke and keep exactly ${input.scenes.length} scenes so existing production slots remain intact. Do not merely change one sentence while leaving conflicting details elsewhere.

For every scene, return one complete production prompt with these labeled sections: STORY BEAT, CHARACTERS IN SHOT, FIRST FRAME / START STATE, ACTION BLOCKING, FINAL FRAME / END STATE, CONTINUITY LOCK, FORBIDDEN ACTIONS / ERRORS, CAMERA / COMPOSITION, and AUDIO / TEXT. Also return one short overlay caption for that scene.`;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: EPISODE_REWRITE_SCHEMA,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!response.ok)
      throw new Error(
        data?.error?.message ||
          `Screenplay AI request failed with HTTP ${response.status}.`,
      );
    const content = data?.choices?.[0]?.message?.content;
    if (!content)
      throw new Error("The screenplay AI returned no episode revision.");
    const result = JSON.parse(content) as {
      scenes?: Array<{ prompt?: unknown; caption?: unknown }>;
    };
    if (!Array.isArray(result.scenes) || result.scenes.length !== input.scenes.length)
      throw new Error("The screenplay AI changed the number of production scenes.");
    return result.scenes.map((scene, index) => {
      const prompt = clean(scene.prompt);
      const caption = clean(scene.caption);
      if (prompt.length < 40 || !caption)
        throw new Error(`The screenplay AI returned an incomplete Scene ${index + 1}.`);
      return { prompt, caption };
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The screenplay AI timed out. Please try the episode revision again.",
      );
    if (error instanceof SyntaxError)
      throw new Error(
        "The screenplay AI returned malformed JSON. Please try again.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
