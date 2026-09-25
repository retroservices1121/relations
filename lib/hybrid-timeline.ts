export type TimelineItem = {
  id: string;
  type: "video" | "image";
  url: string;
  duration: number;
  label: string;
};

// This workspace has one opening video; stills and timing remain user-owned.
export function replaceTimelineVideo(items: TimelineItem[], url: string, label: string) {
  return items.map((item) => item.type === "video" ? { ...item, url, label } : item);
}

export function hybridVideoBlockReason(items: TimelineItem[], status: string, resultUrl: string) {
  const videos = items.filter((item) => item.type === "video");
  if (!videos.length) return "";
  if (status === "generating") {
    return "Locked cartoon heads are still processing. Wait for completion before building the hybrid video.";
  }
  if (status !== "done" || !resultUrl || videos.some((item) => item.url !== resultUrl)) {
    return "Apply Locked Cartoon Heads successfully before building the hybrid video. The original recording cannot be exported in this timeline.";
  }
  return "";
}
