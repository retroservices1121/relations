export type SongChunk = {
  text?: string;
  timestamp?: [number, number] | { start?: number; end?: number };
  start?: number;
  end?: number;
};

export type SceneTiming = {
  start: number;
  end: number;
  duration: number;
  anchor: string;
};

const sceneAnchors: Record<string, string[]> = {
  "danda-spider-hero": [
    "She found a spider",
    "She points across the room",
    "He looks at that little spider",
    "Go on girl",
    "She takes one step",
    "He gives her a thumbs up",
  ],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function chunkTimes(chunk: SongChunk) {
  if (Array.isArray(chunk.timestamp)) return { start: Number(chunk.timestamp[0]) || 0, end: Number(chunk.timestamp[1]) || 0 };
  if (chunk.timestamp && typeof chunk.timestamp === "object") return { start: Number(chunk.timestamp.start) || 0, end: Number(chunk.timestamp.end) || 0 };
  return { start: Number(chunk.start) || 0, end: Number(chunk.end) || 0 };
}

function flattenWords(chunks: SongChunk[]) {
  return chunks.flatMap((chunk) => {
    const times = chunkTimes(chunk);
    return normalize(chunk.text || "").split(" ").filter(Boolean).map((word) => ({ word, start: times.start, end: times.end }));
  });
}

function findAnchorTime(words: ReturnType<typeof flattenWords>, anchor: string, after: number) {
  const target = normalize(anchor).split(" ").filter(Boolean).slice(0, 3);
  if (!target.length) return null;
  for (let i = 0; i <= words.length - target.length; i += 1) {
    if (words[i].start + 0.05 < after) continue;
    if (target.every((word, offset) => words[i + offset]?.word === word)) return words[i].start;
  }
  return null;
}

export function deriveSceneTimings(
  episodeId: string,
  chunks: SongChunk[],
  songDuration: number,
  fallbackDurations: number[],
): SceneTiming[] {
  const anchors = sceneAnchors[episodeId] || fallbackDurations.map((_, index) => `Scene ${index + 1}`);
  const safeDuration = Math.max(1, Number(songDuration) || fallbackDurations.reduce((sum, value) => sum + value, 0));
  const totalFallback = Math.max(1, fallbackDurations.reduce((sum, value) => sum + value, 0));
  const proportionalStarts = fallbackDurations.map((_, index) => {
    const elapsed = fallbackDurations.slice(0, index).reduce((sum, value) => sum + value, 0);
    return (elapsed / totalFallback) * safeDuration;
  });
  const words = flattenWords(chunks);
  const starts = [0];
  for (let index = 1; index < fallbackDurations.length; index += 1) {
    const found = findAnchorTime(words, anchors[index] || "", starts[index - 1] + 0.25);
    const fallback = proportionalStarts[index];
    const candidate = found !== null && found > starts[index - 1] + 0.25 ? found : fallback;
    starts.push(Math.min(safeDuration - 0.25, Math.max(starts[index - 1] + 0.25, candidate)));
  }
  return starts.map((start, index) => {
    const end = index === starts.length - 1 ? safeDuration : starts[index + 1];
    return {
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number(Math.max(0.25, end - start).toFixed(2)),
      anchor: anchors[index] || `Scene ${index + 1}`,
    };
  });
}
