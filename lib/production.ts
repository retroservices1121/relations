export function aspectRatio(value: unknown): "9:16" | "16:9" {
  return value === "16:9" ? "16:9" : "9:16";
}
export function dimensions(value: unknown) {
  return aspectRatio(value) === "16:9" ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
}
export const narrationVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type Narration = { text: string; voice: string; url: string; duration: number };
