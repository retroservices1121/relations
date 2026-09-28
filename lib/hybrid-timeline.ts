export type TimelineItem = {
  id: string;
  type: "video" | "image";
  url: string;
  duration: number;
  label: string;
  sourceUrl?: string;
  processed?: boolean;
};

export function hybridVideoBlockReason(items: TimelineItem[], processingCount = 0) {
  const videos = items.filter((item) => item.type === "video");
  if (!videos.length) return "";
  if (processingCount > 0) return `${processingCount} video${processingCount === 1 ? "" : "s"} still processing locked cartoon heads.`;
  const pending = videos.filter((item) => !item.processed);
  if (pending.length) return `Apply Locked Cartoon Heads to ${pending.length} video${pending.length === 1 ? "" : "s"} before export. Raw recordings cannot be exported.`;
  return "";
}
