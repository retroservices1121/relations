export type SeriesCharacter = {
  key: string;
  name: string;
  description: string;
  referenceUrl?: string;
};

export type SeriesConfig = {
  id: string;
  title: string;
  description: string;
  visualStyle: string;
  screenplayRules: string;
  format: "silent" | "dialogue" | "narrated";
  aspectRatio?: "9:16" | "16:9";
  musicMode: "household-theme" | "none";
  locked: boolean;
  characters: SeriesCharacter[];
};

export const householdNonsenseSeries: SeriesConfig = {
  id: "household-nonsense",
  title: "Household Nonsense",
  description: "Silent animated relationship comedy starring Joe, Danda, and their family.",
  visualStyle:
    "Simple flat hand-drawn 2D internet cartoon comedy with thick clean outlines, solid colors, readable uncluttered household backgrounds, exaggerated expressions and limited-animation physical acting.",
  screenplayRules:
    "Use silent physical comedy, closed and visually still mouths, believable household behavior, one clear action per scene and concise overlay captions. Preserve every creator-requested distinct beat, costume, action, or caption; never merge or omit explicit beats merely to reduce scene count. Decorative pillows belong on a living-room sofa during daytime or on a bed while it is being made in the morning; do not freshly arrange decorative bed pillows immediately before sleep unless that contradiction is explicitly the joke.",
  format: "silent",
  musicMode: "household-theme",
  locked: true,
  characters: [
    { key: "joe", name: "Joe", description: "Early-40s man with short dark hair, a neat full beard, and an average slightly stocky everyday-dad build." },
    { key: "danda", name: "Danda", description: "Early-40s woman with long dark-brown hair with warm highlights and normal adult proportions." },
    { key: "raquel", name: "Raquel", description: "Joe and Danda's young-adult daughter with shoulder-length dark-brown hair, softly curled ends, a warm complexion, and a witty, observant personality." },
    { key: "daniel", name: "Daniel", description: "Joe and Danda's young-adult son with short dense curly black hair, a light mustache and small chin beard, a slim build, and a relaxed, quietly sarcastic personality." },
    { key: "buddy", name: "Buddy", description: "Small black-and-white Maltese-like dog." },
  ],
};

export function cleanSeriesKey(value: string, fallback = "character") {
  const cleaned = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || fallback;
}
