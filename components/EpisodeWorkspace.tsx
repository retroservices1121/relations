"use client";
import NarrationPanel from "./NarrationPanel";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Episode } from "../data/episodes";
import { householdNonsenseSeries, type SeriesConfig } from "../lib/series";
import sceneStyles from "./EpisodeWorkspace.module.css";
import SpeechInputButton from "./SpeechInputButton";

type SceneState = {
  status: "idle" | "queued" | "generating" | "saving" | "done" | "error";
  videoUrl?: string;
  sourceVideoUrl?: string;
  themeBaked?: boolean;
  error?: string;
  requestId?: string;
  persisted?: boolean;
};
type OverlayPosition = "top" | "middle" | "bottom";
type OverlayConfig = {
  text: string;
  position: OverlayPosition;
  start: number;
  end: number;
};
type TimedCaption = { text: string; start: number; end: number };
type CharacterKey = string;
type PromptSaveStatus = "idle" | "saving" | "saved" | "error";
type DatabaseScene = {
  scene_index: number;
  video_url?: string | null;
  source_video_url?: string | null;
  theme_baked?: boolean | null;
  request_id?: string | null;
  persisted?: boolean;
  overlay_text?: string | null;
  overlay_position?: string | null;
  overlay_start?: number | null;
  overlay_end?: number | null;
  scene_prompt?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function referenceStorageKey(seriesId: string, characterKey: string) {
  return `relations:series:${seriesId}:character:${characterKey}`;
}

function parseTimedCaptions(
  value: unknown,
  fallbackStart: number,
  fallbackEnd: number,
): TimedCaption[] {
  const text = typeof value === "string" ? value : "";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = lines.map((line) => {
    const match = line.match(
      /^\[(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\]\s*(.+)$/,
    );
    if (!match) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      text: match[3].trim(),
    };
  });
  if (parsed.length > 0 && parsed.every(Boolean))
    return parsed as TimedCaption[];
  return text.trim()
    ? [{ text: text.trim(), start: fallbackStart, end: fallbackEnd }]
    : [];
}
function isMessageCaption(text: string) {
  return text.trim().startsWith("💬");
}
function displayCaption(text: string) {
  return isMessageCaption(text) ? text.trim().replace(/^💬\s*/, "") : text;
}
function ScenePreview({
  videoUrl,
  overlay,
}: {
  videoUrl: string;
  overlay: OverlayConfig;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const captions = useMemo(
    () => parseTimedCaptions(overlay.text, overlay.start, overlay.end),
    [overlay.text, overlay.start, overlay.end],
  );
  const visible = captions.find(
    (caption) => currentTime >= caption.start && currentTime <= caption.end,
  );
  const message = visible ? isMessageCaption(visible.text) : false;
  return (
    <div className="videoPreviewWrap">
      <video
        className="sceneVideo"
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        onPlay={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime || 0)
        }
        onSeeked={(event) =>
          setCurrentTime(event.currentTarget.currentTime || 0)
        }
        onLoadedMetadata={() => setCurrentTime(0)}
      />
      {visible && (
        <div
          className={`${message ? "messageBubblePreview" : "overlayPreview"} overlay-${overlay.position}`}
        >
          {displayCaption(visible.text)}
        </div>
      )}
    </div>
  );
}

export default function EpisodeWorkspace({ episode, series = householdNonsenseSeries }: { episode: Episode; series?: SeriesConfig }) {
  const router = useRouter();
  const [referenceUrls, setReferenceUrls] = useState<Record<string, string>>({});
  const [model, setModel] = useState("seedance-fast");
  const [sceneStates, setSceneStates] = useState<Record<number, SceneState>>(
    {},
  );
  const [overlays, setOverlays] = useState<Record<number, OverlayConfig>>({});
  const [scenePrompts, setScenePrompts] = useState<Record<number, string>>({});
  const [promptSaveStatuses, setPromptSaveStatuses] = useState<
    Record<number, PromptSaveStatus>
  >({});
  const [revisionNotes, setRevisionNotes] = useState<Record<number, string>>(
    {},
  );
  const [rewritingScenes, setRewritingScenes] = useState<
    Record<number, boolean>
  >({});
  const [rewriteErrors, setRewriteErrors] = useState<Record<number, string>>(
    {},
  );
  const [episodeRevisionNote, setEpisodeRevisionNote] = useState("");
  const [rewritingEpisode, setRewritingEpisode] = useState(false);
  const [episodeRewriteError, setEpisodeRewriteError] = useState("");
  const [episodeRewriteStatus, setEpisodeRewriteStatus] = useState("");
  const [uploading, setUploading] = useState<CharacterKey | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [narrationReady,setNarrationReady]=useState(false);
  const [renderingFinal, setRenderingFinal] = useState(false);
  const [finalUrl, setFinalUrl] = useState("");
  const [finalError, setFinalError] = useState("");
  const [regeneratingSoundtracks, setRegeneratingSoundtracks] = useState(false);
  const [soundtrackProgress, setSoundtrackProgress] = useState("");
  const [soundtrackError, setSoundtrackError] = useState("");
  const [restoringAudio, setRestoringAudio] = useState<Record<number, boolean>>(
    {},
  );
  const [restoringAllAudio, setRestoringAllAudio] = useState(false);
  const overlayTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );
  const promptTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );
  const pollingRequests = useRef<Set<string>>(new Set());
  const projectStorageKey = `relations:project:${episode.id}`;
  const generationProvider = model.startsWith("higgsfield-")
    ? "Higgsfield"
    : "fal";
  function defaultOverlay(index: number): OverlayConfig {
    const scene = episode.scenes[index];
    return {
      text: scene.caption || "",
      position: "bottom",
      start: scene.captionStart ?? 0,
      end: scene.captionEnd ?? scene.duration,
    };
  }
  function normalizeOverlay(index: number, value: unknown): OverlayConfig {
    const defaults = defaultOverlay(index);
    if (!value || typeof value !== "object") return defaults;
    const candidate = value as Partial<OverlayConfig>;
    const position: OverlayPosition =
      candidate.position === "top" ||
      candidate.position === "middle" ||
      candidate.position === "bottom"
        ? candidate.position
        : defaults.position;
    const hasSavedText =
      typeof candidate.text === "string" && candidate.text.trim().length > 0;
    const text = hasSavedText ? (candidate.text as string) : defaults.text;
    const start =
      hasSavedText && Number.isFinite(Number(candidate.start))
        ? Number(candidate.start)
        : defaults.start;
    const end =
      hasSavedText && Number.isFinite(Number(candidate.end))
        ? Number(candidate.end)
        : defaults.end;
    return { text, position, start, end };
  }
  async function loadBalance() {
    try {
      const response = await fetch("/api/fal-balance", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load balance");
      setBalance(typeof data.balance === "number" ? data.balance : null);
      setBalanceError("");
    } catch (error) {
      setBalanceError(
        error instanceof Error ? error.message : "Balance unavailable",
      );
    }
  }
  useEffect(() => {
    let cancelled = false;
    setReferenceUrls(Object.fromEntries(series.characters.map((character) => [character.key, localStorage.getItem(referenceStorageKey(series.id, character.key)) || character.referenceUrl || ""])));
    const defaults = Object.fromEntries(
      episode.scenes.map((_, index) => [index, defaultOverlay(index)]),
    );
    const promptDefaults = Object.fromEntries(
      episode.scenes.map((scene, index) => [index, scene.prompt]),
    );
    let localStates: Record<number, SceneState> = {};
    let localOverlays: Record<number, OverlayConfig> = defaults;
    let localPrompts: Record<number, string> = promptDefaults;
    let localFinalUrl = "";
    try {
      const saved = localStorage.getItem(projectStorageKey);
      if (saved) {
        const project = JSON.parse(saved) as {
          sceneStates?: Record<number, SceneState>;
          overlays?: Record<number, unknown>;
          scenePrompts?: Record<number, string>;
          finalUrl?: string;
        };
        localStates = project.sceneStates || {};
        localOverlays = Object.fromEntries(
          episode.scenes.map((_, index) => [
            index,
            normalizeOverlay(index, project.overlays?.[index]),
          ]),
        );
        localPrompts = Object.fromEntries(
          episode.scenes.map((scene, index) => [
            index,
            typeof project.scenePrompts?.[index] === "string" &&
            project.scenePrompts[index].trim()
              ? project.scenePrompts[index]
              : scene.prompt,
          ]),
        );
        localFinalUrl =
          typeof project.finalUrl === "string" ? project.finalUrl : "";
      }
    } catch {}
    setSceneStates(localStates);
    setOverlays(localOverlays);
    setScenePrompts(localPrompts);
    setFinalUrl(localFinalUrl);
    void (async () => {
      try {
        const response = await fetch(
          `/api/project?episodeId=${encodeURIComponent(episode.id)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load Railway project data");
        if (cancelled) return;
        const dbStates: Record<number, SceneState> = {};
        const dbOverlays: Record<number, OverlayConfig> = { ...defaults };
        const dbPrompts: Record<number, string> = {};
        for (const row of (data.scenes || []) as DatabaseScene[]) {
          const index = Number(row.scene_index);
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= episode.scenes.length
          )
            continue;
          if (row.video_url)
            dbStates[index] = {
              status: "done",
              videoUrl: row.video_url,
              sourceVideoUrl: row.source_video_url || undefined,
              themeBaked: Boolean(row.theme_baked),
              requestId: row.request_id || undefined,
              persisted: Boolean(row.persisted),
            };
          const fallback = defaults[index];
          dbOverlays[index] = normalizeOverlay(index, {
            text: row.overlay_text ?? fallback.text,
            position: row.overlay_position ?? fallback.position,
            start: row.overlay_start ?? fallback.start,
            end: row.overlay_end ?? fallback.end,
          });
          if (typeof row.scene_prompt === "string" && row.scene_prompt.trim())
            dbPrompts[index] = row.scene_prompt;
        }
        setSceneStates((prev) => ({ ...prev, ...dbStates }));
        setOverlays((prev) => ({ ...prev, ...dbOverlays }));
        setScenePrompts((prev) => ({ ...prev, ...dbPrompts }));
        setFinalUrl(typeof data.finalUrl === "string" ? data.finalUrl : "");
        setStorageError("");
      } catch (error) {
        if (!cancelled)
          setStorageError(
            `${error instanceof Error ? error.message : "Railway project storage unavailable"} Local device cache is being used until Postgres is connected.`,
          );
      } finally {
        if (!cancelled) setProjectLoaded(true);
      }
    })();
    void loadBalance();
    return () => {
      cancelled = true;
      Object.values(promptTimers.current).forEach(clearTimeout);
    };
  }, [episode.id, episode.scenes, projectStorageKey, series]);
  useEffect(() => {
    if (!projectLoaded) return;
    localStorage.setItem(
      projectStorageKey,
      JSON.stringify({ sceneStates, overlays, scenePrompts, finalUrl }),
    );
  }, [
    sceneStates,
    overlays,
    scenePrompts,
    finalUrl,
    projectLoaded,
    projectStorageKey,
  ]);
  useEffect(() => {
    if (!projectLoaded) return;
    for (const [key, state] of Object.entries(sceneStates)) {
      if (state.status !== "queued" && state.status !== "generating") continue;
      const index = Number(key);
      if (!state.requestId) {
        setSceneStates((prev) => ({
          ...prev,
          [index]: { ...prev[index], status: "idle" },
        }));
        continue;
      }
      if (pollingRequests.current.has(state.requestId)) continue;
      const requestId = state.requestId;
      pollingRequests.current.add(requestId);
      void pollForResult(index, requestId, model)
        .catch((error) =>
          setSceneStates((prev) => ({
            ...prev,
            [index]: {
              ...prev[index],
              status: "error",
              requestId,
              error:
                error instanceof Error
                  ? error.message
                  : "Could not resume generation",
            },
          })),
        )
        .finally(() => pollingRequests.current.delete(requestId));
    }
  }, [projectLoaded, sceneStates, model]);
  function persistReference(character: CharacterKey, url: string) {
    setReferenceUrls((current) => ({ ...current, [character]: url }));
    const key = referenceStorageKey(series.id, character);
    if (url) localStorage.setItem(key, url);
    else localStorage.removeItem(key);
  }
  async function uploadReference(character: CharacterKey, file?: File) {
    if (!file) return;
    setUploading(character);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload-reference", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      if (!data.url) throw new Error("Upload completed without a file URL");
      persistReference(character, data.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }
  async function saveGeneratedVideo(
    index: number,
    requestId: string,
    sourceUrl: string,
  ) {
    setSceneStates((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        status: "saving",
        requestId,
        videoUrl: sourceUrl,
      },
    }));
    const response = await fetch("/api/persist-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceUrl,
        episodeId: episode.id,
        sceneIndex: index,
        requestId,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStorageError(data.error || "Permanent storage is not configured.");
      setSceneStates((prev) => ({
        ...prev,
        [index]: {
          status: "done",
          videoUrl: sourceUrl,
          requestId,
          persisted: false,
        },
      }));
      return;
    }
    setStorageError("");
    setSceneStates((prev) => ({
      ...prev,
      [index]: {
        status: "done",
        videoUrl: data.url,
        sourceVideoUrl: data.sourceUrl || sourceUrl,
        themeBaked: false,
        requestId,
        persisted: true,
      },
    }));
  }
  async function pollForResult(
    index: number,
    requestId: string,
    selectedModel: string,
  ) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(3000);
      const response = await fetch(
        `/api/generate-video?requestId=${encodeURIComponent(requestId)}&model=${encodeURIComponent(selectedModel)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not check generation status");
      if (data.status === "COMPLETED" && data.videoUrl) {
        await saveGeneratedVideo(index, requestId, data.videoUrl);
        void loadBalance();
        return;
      }
      setSceneStates((prev) => ({
        ...prev,
        [index]: { ...prev[index], status: "generating", requestId },
      }));
    }
    throw new Error(
      "Generation is still running. Try Generate Scene again in a moment to start a new job.",
    );
  }
  function clearSavedFinal() {
    setFinalUrl("");
    setFinalError("");
    void fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-final", episodeId: episode.id }),
    }).catch(() => undefined);
  }
  async function generateScene(index: number) {
    const scene = episode.scenes[index];
    const prompt = (scenePrompts[index] || scene.prompt).trim();
    if (prompt.length < 10) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          status: "error",
          error: "Add a clear scene instruction before generating.",
        },
      }));
      return;
    }
    const allowedKeys = new Set(series.characters.map((character) => character.key));
    const explicitKeys = (scene.characters || []).filter((key): key is CharacterKey => allowedKeys.has(key));
    const characterKeys: CharacterKey[] = explicitKeys.length
      ? explicitKeys
      : series.characters.slice(0, 2).map((character) => character.key);
    const missing = characterKeys.filter((key) => !(referenceUrls[key] || "").trim());
    if (missing.length) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          status: "error",
          error: `Upload the approved reference for ${missing.map((key) => series.characters.find((character) => character.key === key)?.name || key).join(" and ")} before generating this scene.`,
        },
      }));
      return;
    }
    const imageUrls = characterKeys.map((key) => referenceUrls[key].trim());
    const referenceMap = characterKeys
      .map(
        (key, position) =>
          `@Image${position + 1} is ${series.characters.find((character) => character.key === key)?.name || key}.`,
      )
      .join(" ");
    const selectedModel = model;
    clearSavedFinal();
    setSceneStates((prev) => ({
      ...prev,
      [index]: { ...prev[index], status: "queued", error: undefined },
    }));
    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          duration: scene.duration,
          imageUrls,
          characterKeys,
          characterNames: Object.fromEntries(series.characters.map((character) => [character.key, character.name])),
          characterDescriptions: Object.fromEntries(series.characters.map((character) => [character.key, character.description])),
          seriesId: series.id,
          seriesFormat: series.format,
          seriesVisualStyle: series.visualStyle,
          seriesRules: series.screenplayRules,
          prompt: `Use only the approved recurring character assets required for this scene. ${referenceMap} Preserve each referenced identity exactly. Do not introduce a recurring character who is not listed for this scene. SERIES VISUAL STYLE: ${series.visualStyle} SERIES RULES: ${series.screenplayRules} ${series.aspectRatio === "16:9" ? "Landscape 16:9" : "Vertical 9:16"} series episode. Scene action: ${prompt}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      if (!data.requestId)
        throw new Error(
          "The selected video provider did not return a request ID",
        );
      setSceneStates((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          status: "generating",
          requestId: data.requestId,
          error: undefined,
        },
      }));
      await pollForResult(index, data.requestId, selectedModel);
    } catch (error) {
      setSceneStates((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          status: "error",
          error: error instanceof Error ? error.message : "Generation failed",
        },
      }));
      void loadBalance();
    }
  }
  async function regenerateAllSoundtracks() {
    if (regeneratingSoundtracks) return;
    if (
      !window.confirm(
        "AI sound effects can occasionally invent unwanted noises. Continue and replace the current audio for every scene?",
      )
    )
      return;
    const ready = episode.scenes
      .map((scene, index) => ({ scene, index, state: sceneStates[index] }))
      .filter(
        ({ state }) => state?.status === "done" && Boolean(state.videoUrl),
      );
    if (ready.length !== episode.scenes.length) {
      setSoundtrackError(
        "All scenes must be generated before regenerating the episode soundtrack.",
      );
      return;
    }
    setRegeneratingSoundtracks(true);
    setSoundtrackError("");
    clearSavedFinal();
    try {
      for (let position = 0; position < ready.length; position += 1) {
        const { scene, index, state } = ready[position];
        setSoundtrackProgress(
          `Regenerating scene SFX ${position + 1} of ${ready.length}…`,
        );
        const response = await fetch("/api/generate-soundtrack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: state.videoUrl,
            episodeId: episode.id,
            sceneIndex: index,
            duration: scene.duration,
            requestId: state.requestId || crypto.randomUUID(),
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || `Could not regenerate Scene ${index + 1} soundtrack.`,
          );
        if (!data.url)
          throw new Error(
            `Scene ${index + 1} soundtrack completed without a saved URL.`,
          );
        setSceneStates((prev) => ({
          ...prev,
          [index]: {
            ...prev[index],
            status: "done",
            videoUrl: data.url,
            sourceVideoUrl: data.sourceUrl || state.sourceVideoUrl,
            themeBaked: false,
            persisted: true,
          },
        }));
      }
      setSoundtrackProgress(
        `✓ Regenerated SFX for all ${ready.length} scenes. The theme will be added continuously at final export.`,
      );
      void loadBalance();
    } catch (error) {
      setSoundtrackError(
        error instanceof Error
          ? error.message
          : "Could not regenerate all soundtracks.",
      );
      setSoundtrackProgress("");
    } finally {
      setRegeneratingSoundtracks(false);
    }
  }
  async function restoreSceneOriginalAudio(index: number) {
    const state = sceneStates[index];
    if (!state?.sourceVideoUrl || restoringAudio[index]) return false;
    setRestoringAudio((current) => ({ ...current, [index]: true }));
    setSoundtrackError("");
    clearSavedFinal();
    try {
      const response = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore-original-audio",
          episodeId: episode.id,
          sceneIndex: index,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || `Could not restore Scene ${index + 1} audio.`,
        );
      const restoredUrl = data.scene?.video_url || state.sourceVideoUrl;
      setSceneStates((current) => ({
        ...current,
        [index]: {
          ...current[index],
          status: "done",
          videoUrl: restoredUrl,
          sourceVideoUrl: data.scene?.source_video_url || state.sourceVideoUrl,
          themeBaked: false,
          persisted: true,
          error: undefined,
        },
      }));
      setSoundtrackProgress(`✓ Restored Scene ${index + 1} to its original generated audio.`);
      return true;
    } catch (error) {
      setSoundtrackError(
        error instanceof Error
          ? error.message
          : `Could not restore Scene ${index + 1} audio.`,
      );
      return false;
    } finally {
      setRestoringAudio((current) => ({ ...current, [index]: false }));
    }
  }
  async function restoreAllOriginalAudio() {
    if (restoringAllAudio) return;
    const restorable = episode.scenes
      .map((_, index) => index)
      .filter(
        (index) =>
          Boolean(sceneStates[index]?.sourceVideoUrl) &&
          sceneStates[index]?.videoUrl !== sceneStates[index]?.sourceVideoUrl,
      );
    if (!restorable.length) {
      setSoundtrackError("No original generated scene audio is available to restore.");
      return;
    }
    setRestoringAllAudio(true);
    setSoundtrackError("");
    setSoundtrackProgress("");
    try {
      let restored = 0;
      for (const index of restorable)
        if (await restoreSceneOriginalAudio(index)) restored += 1;
      setSoundtrackProgress(
        `✓ Restored original generated audio for ${restored} scene${restored === 1 ? "" : "s"}.`,
      );
    } finally {
      setRestoringAllAudio(false);
    }
  }
  function updateOverlay(index: number, patch: Partial<OverlayConfig>) {
    const current = normalizeOverlay(index, overlays[index]);
    const next = { ...current, ...patch };
    setOverlays((prev) => ({ ...prev, [index]: next }));
    clearSavedFinal();
    if (overlayTimers.current[index])
      clearTimeout(overlayTimers.current[index]);
    overlayTimers.current[index] = setTimeout(() => {
      void fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: episode.id,
          sceneIndex: index,
          ...next,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(
              data.error || "Could not save overlay to Railway Postgres",
            );
          }
          setStorageError("");
        })
        .catch((error) =>
          setStorageError(
            error instanceof Error
              ? error.message
              : "Could not save overlay to Railway Postgres",
          ),
        );
    }, 500);
  }
  function updateScenePrompt(index: number, prompt: string) {
    setScenePrompts((prev) => ({ ...prev, [index]: prompt }));
    setPromptSaveStatuses((prev) => ({ ...prev, [index]: "saving" }));
    clearSavedFinal();
    if (promptTimers.current[index]) clearTimeout(promptTimers.current[index]);
    promptTimers.current[index] = setTimeout(() => {
      void fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-scene-prompt",
          episodeId: episode.id,
          sceneIndex: index,
          prompt,
        }),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(data.error || "Could not save scene instruction");
          setPromptSaveStatuses((prev) => ({ ...prev, [index]: "saved" }));
          setStorageError("");
        })
        .catch((error) => {
          setPromptSaveStatuses((prev) => ({ ...prev, [index]: "error" }));
          setStorageError(
            error instanceof Error
              ? error.message
              : "Could not save scene instruction",
          );
        });
    }, 700);
  }
  function resetScenePrompt(index: number) {
    updateScenePrompt(index, episode.scenes[index].prompt);
  }
  async function rewriteScene(index: number) {
    const revisionNote = (revisionNotes[index] || "").trim();
    if (!revisionNote) {
      setRewriteErrors((prev) => ({
        ...prev,
        [index]: "Tell the screenplay AI what needs to change.",
      }));
      return;
    }
    setRewritingScenes((prev) => ({ ...prev, [index]: true }));
    setRewriteErrors((prev) => ({ ...prev, [index]: "" }));
    try {
      const promptFor = (position: number) =>
        position >= 0 && position < episode.scenes.length
          ? scenePrompts[position] || episode.scenes[position].prompt
          : "";
      const response = await fetch("/api/rewrite-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeTitle: episode.title,
          sceneIndex: index,
          totalScenes: episode.scenes.length,
          currentPrompt: promptFor(index),
          previousPrompt: promptFor(index - 1),
          nextPrompt: promptFor(index + 1),
          revisionNote,
          seriesId: series.id,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The screenplay AI could not revise this scene.",
        );
      if (typeof data.prompt !== "string" || data.prompt.trim().length < 10)
        throw new Error(
          "The screenplay AI returned an incomplete scene revision.",
        );
      updateScenePrompt(index, data.prompt);
      setRevisionNotes((prev) => ({ ...prev, [index]: "" }));
    } catch (error) {
      setRewriteErrors((prev) => ({
        ...prev,
        [index]:
          error instanceof Error
            ? error.message
            : "The screenplay AI could not revise this scene.",
      }));
    } finally {
      setRewritingScenes((prev) => ({ ...prev, [index]: false }));
    }
  }
  async function rewriteEntireEpisode() {
    const revisionNote = episodeRevisionNote.trim();
    if (!revisionNote) {
      setEpisodeRewriteError(
        "Tell the screenplay AI what needs to change across the episode.",
      );
      return;
    }
    setRewritingEpisode(true);
    setEpisodeRewriteError("");
    setEpisodeRewriteStatus("");
    try {
      const scenes = episode.scenes.map((scene, index) => ({
        prompt: scenePrompts[index] || scene.prompt,
        caption: normalizeOverlay(index, overlays[index]).text,
      }));

      // A full-episode revision may intentionally change the production-scene
      // count. Existing scene slots cannot safely be expanded in place because
      // they may already have generated media attached. When the creator asks
      // for a different explicit count, re-plan the screenplay as a new episode
      // and move directly to that new production workspace.
      const sceneCountMatch =
        revisionNote.match(/(?:exactly|total(?: of)?|must (?:be|have)|there (?:must|should) be)\s+(\d{1,2})\s+(?:production\s+)?scenes?/i) ||
        revisionNote.match(/(\d{1,2})\s+(?:separate\s+|total\s+)?(?:production\s+)?scenes?/i);
      const requestedSceneCount = Number(sceneCountMatch?.[1]);
      if (
        Number.isInteger(requestedSceneCount) &&
        requestedSceneCount >= 2 &&
        requestedSceneCount <= 12 &&
        requestedSceneCount !== episode.scenes.length
      ) {
        const currentScript = scenes
          .map((scene, index) => `SCENE ${index + 1}\nCAPTION: ${scene.caption}\n${scene.prompt}`)
          .join("\n\n---\n\n");
        const response = await fetch("/api/episodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "script",
            title: episode.title,
            seriesId: series.id,
            prompt: `REQUIRED FULL EPISODE REVISION:\n${revisionNote}\n\nCURRENT SCREENPLAY TO REPLAN:\n${currentScript}`,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "The screenplay AI could not re-plan this episode.");
        if (!data.episode?.id)
          throw new Error("The screenplay AI did not return the re-planned episode.");
        router.push(`/episodes/${data.episode.id}`);
        router.refresh();
        return;
      }

      const response = await fetch("/api/rewrite-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeTitle: episode.title,
          revisionNote,
          scenes,
          seriesId: series.id,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The screenplay AI could not revise this episode.",
        );
      if (!Array.isArray(data.scenes) || data.scenes.length !== episode.scenes.length)
        throw new Error("The screenplay AI returned an incomplete episode revision.");
      data.scenes.forEach(
        (scene: { prompt?: unknown; caption?: unknown }, index: number) => {
          if (typeof scene.prompt === "string")
            updateScenePrompt(index, scene.prompt);
          if (typeof scene.caption === "string")
            updateOverlay(index, { text: scene.caption });
        },
      );
      setEpisodeRevisionNote("");
      setEpisodeRewriteStatus(
        `✓ Rewrote all ${data.scenes.length} scene instructions and captions. Review them before regenerating video.`,
      );
    } catch (error) {
      setEpisodeRewriteError(
        error instanceof Error
          ? error.message
          : "The screenplay AI could not revise this episode.",
      );
    } finally {
      setRewritingEpisode(false);
    }
  }
  const allScenesReady = useMemo(
    () =>
      episode.scenes.every(
        (_, index) =>
          sceneStates[index]?.status === "done" &&
          Boolean(sceneStates[index]?.videoUrl) &&
          sceneStates[index]?.persisted === true,
      ),
    [episode.scenes, sceneStates],
  );
  async function buildFinalVideo() {
    if(series.format === "narrated" && !narrationReady){setFinalError("Save narration changes and generate all non-empty lines first.");return;}
    if (!allScenesReady) {
      setFinalError(
        "Generate and permanently save every scene before building the final episode.",
      );
      return;
    }
    setRenderingFinal(true);
    setFinalError("");
    try {
      const scenes = episode.scenes.map((_, index) => {
        const overlay = normalizeOverlay(index, overlays[index]);
        return {
          videoUrl:
            sceneStates[index].themeBaked && sceneStates[index].sourceVideoUrl
              ? sceneStates[index].sourceVideoUrl
              : sceneStates[index].videoUrl,
          text: overlay.text,
          position: overlay.position,
          start: overlay.start,
          end: overlay.end,
        };
      });
      const response = await fetch("/api/render-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, scenes, musicMode: series.musicMode, seriesId: series.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Final render failed");
      setFinalUrl(data.url);
    } catch (error) {
      setFinalError(
        error instanceof Error ? error.message : "Final render failed",
      );
    } finally {
      setRenderingFinal(false);
    }
  }
  function finalDownloadUrl() {
    return `/api/download-video?url=${encodeURIComponent(finalUrl)}&filename=${encodeURIComponent(`${episode.id}.mp4`)}`;
  }
  function sceneDownloadUrl(index: number, videoUrl: string) {
    return `/api/download-video?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(`${episode.id}-scene-${index + 1}.mp4`)}`;
  }
  return (
    <div className="workspace">
      <div className="workspaceTop">
        <div>
          <a className="backLink" href="/">
            ← Episode Library
          </a>
          <span className="eyebrow">{series.title}</span>
          <h1>{episode.title}</h1>
          <p>{episode.hook}</p>
        </div>
        <div className="workspaceControls">
          {generationProvider === "fal" ? (
            <div
              className="creditBalance"
              onClick={() => void loadBalance()}
              title="Tap to refresh fal balance"
            >
              <span>fal credits</span>
              <b>
                {balance === null
                  ? balanceError
                    ? "Unavailable"
                    : "Loading…"
                  : `$${balance.toFixed(2)}`}
              </b>
            </div>
          ) : (
            <div
              className="creditBalance"
              title="Generation is routed through the Higgsfield API"
            >
              <span>provider</span>
              <b>Higgsfield API</b>
            </div>
          )}
          <label>
            Model
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="higgsfield-seedance-2.5">
                Higgsfield · Seedance 2.5
              </option>
              <option value="seedance-fast">fal · Seedance 2 Fast</option>
              <option value="seedance-standard">
                fal · Seedance 2 Standard
              </option>
            </select>
          </label>
        </div>
      </div>
      <section className="referencePanel">
        <div>
          <span className="eyebrow">LOCKED CHARACTER LIBRARY</span>
          <h2>{series.title} character references</h2>
          <p>
            Use the final cartoon character images here. Once uploaded, they are
            remembered and reused automatically across every episode on this
            device.
          </p>
          <p className="statusText">
            {series.format === "silent"
              ? "Silent format is locked for this series; Studio adds timed overlays after generation."
              : "Dialogue format is enabled for this series; character and screenplay rules come from its series bible."}
          </p>
          <p className="statusText">
            Production storage: Railway Postgres saves project data and
            Cloudflare R2 saves video files.
          </p>
          {uploadError && <p className="errorText">{uploadError}</p>}
          {storageError && <p className="errorText">{storageError}</p>}
        </div>
        <div className="referenceInputs">
          {series.characters.map((character) => {
            const url = referenceUrls[character.key] || "";
            return <div className="characterRef" key={character.key}>
              <label>{character.name} reference {url && "✓ Locked"}</label>
              {url && <img className="referenceThumb" src={url} alt={`${character.name} reference`} />}
              <label className="uploadButton">
                {uploading === character.key ? `Uploading ${character.name}…` : url ? `Replace ${character.name} Reference` : `Upload ${character.name} Reference`}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => uploadReference(character.key, event.target.files?.[0])} />
              </label>
              <input value={url} onChange={(event) => persistReference(character.key, event.target.value)} placeholder={`Or paste the approved ${character.name} image URL`} />
            </div>;
          })}
        </div>
      </section>
      <section className={sceneStyles.episodeRevisionPanel}>
        <span className="eyebrow">FULL EPISODE SCREENPLAY</span>
        <h2>Revise the entire episode with AI</h2>
        <p>
          Use this when one correction affects multiple scenes, such as the
          location, time of day, prop continuity, setup or ending. This rewrites
          every scene instruction and caption together without generating video.
        </p>
        <div className={sceneStyles.episodeRevisionTools}>
          <textarea
            value={episodeRevisionNote}
            onChange={(event) => setEpisodeRevisionNote(event.target.value)}
            placeholder="Example: Move the decorative-pillow story to the living-room couch during daytime. Update every scene so the location, lighting, pillow positions and actions remain consistent."
            aria-label="Episode-wide screenplay revision"
          />
        </div>
        <div className={sceneStyles.episodeRevisionActions}>
          <SpeechInputButton
            value={episodeRevisionNote}
            onChange={setEpisodeRevisionNote}
            label="Speak episode revision"
          />
          <button
            type="button"
            className={sceneStyles.episodeRevisionSubmit}
            disabled={rewritingEpisode || !episodeRevisionNote.trim()}
            onClick={() => void rewriteEntireEpisode()}
          >
            {rewritingEpisode
              ? "Submitting Revision…"
              : "Submit Full Episode Revision"}
          </button>
        </div>
        {episodeRewriteStatus && (
          <p className="savedText">{episodeRewriteStatus}</p>
        )}
        {episodeRewriteError && (
          <p className="errorText">{episodeRewriteError}</p>
        )}
      </section>
      <div className="sceneList">
        {episode.scenes.map((scene, index) => {
          const state = sceneStates[index] || { status: "idle" };
          const overlay = normalizeOverlay(index, overlays[index]);
          const timed = parseTimedCaptions(
            overlay.text,
            overlay.start,
            overlay.end,
          );
          const currentPrompt = scenePrompts[index] ?? scene.prompt;
          const promptStatus = promptSaveStatuses[index] || "idle";
          return (
            <article className="sceneCard" key={index}>
              <div className="sceneMeta">
                <span>SCENE {index + 1}</span>
                <b>{scene.duration}s</b>
              </div>
              <div className={sceneStyles.sceneScriptEditor}>
                <div className={sceneStyles.sceneScriptHeading}>
                  <span className="eyebrow">
                    SCENE INSTRUCTION — EDIT BEFORE GENERATING
                  </span>
                  <div className={sceneStyles.scenePromptTools}>
                    <SpeechInputButton
                      value={currentPrompt}
                      onChange={(value) => updateScenePrompt(index, value)}
                      label={`Speak scene ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={sceneStyles.textButton}
                      disabled={currentPrompt === scene.prompt}
                      onClick={() => resetScenePrompt(index)}
                    >
                      Reset original
                    </button>
                  </div>
                </div>
                <textarea
                  value={currentPrompt}
                  onChange={(event) =>
                    updateScenePrompt(index, event.target.value)
                  }
                  aria-label={`Scene ${index + 1} generation instruction`}
                />
                <p
                  className={
                    promptStatus === "error"
                      ? "errorText"
                      : promptStatus === "saved"
                        ? "savedText"
                        : "statusText"
                  }
                >
                  {promptStatus === "saving"
                    ? "Saving scene instruction…"
                    : promptStatus === "saved"
                      ? "✓ Scene instruction saved"
                      : promptStatus === "error"
                        ? "Scene instruction could not be saved. The local copy is still available."
                        : "Edit only this scene, then regenerate it without changing the others."}
                </p>
                <div className={sceneStyles.aiRevision}>
                  <label>
                    Ask the screenplay AI to fix this scene
                    <input
                      value={revisionNotes[index] || ""}
                      onChange={(event) =>
                        setRevisionNotes((prev) => ({
                          ...prev,
                          [index]: event.target.value,
                        }))
                      }
                      placeholder="Example: Keep the light on. Danda walks directly from the doorway to the bed and never touches the switch."
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      Boolean(rewritingScenes[index]) ||
                      !(revisionNotes[index] || "").trim()
                    }
                    onClick={() => void rewriteScene(index)}
                  >
                    {rewritingScenes[index]
                      ? "Rewriting Scene…"
                      : "Rewrite Only This Scene with AI"}
                  </button>
                  {rewriteErrors[index] && (
                    <p className="errorText">{rewriteErrors[index]}</p>
                  )}
                </div>
              </div>
              {state.videoUrl && (
                <div className={series.aspectRatio === "16:9" ? "landscapePreview" : ""}><ScenePreview videoUrl={state.videoUrl} overlay={overlay} /></div>
              )}{" "}
              {state.status === "queued" && (
                <p className="statusText">
                  Submitting this scene to {generationProvider}… Your previous
                  version remains available until the replacement succeeds.
                </p>
              )}
              {state.status === "generating" && (
                <p className="statusText">
                  Generating this scene on {generationProvider}… Your previous
                  version remains available until the replacement succeeds.
                </p>
              )}
              {state.status === "saving" && (
                <p className="statusText">
                  Generation complete. Saving the scene audio and replacement…
                </p>
              )}
              {state.status === "done" && (
                <p className={state.persisted ? "savedText" : "errorText"}>
                  {state.persisted
                    ? "✓ Saved permanently to R2"
                    : `⚠ Showing ${generationProvider} copy; R2/Postgres storage is not ready`}
                </p>
              )}
              {state.error && <p className="errorText">{state.error}</p>}
              <div className="overlayEditor">
                <span className="eyebrow">TEXT OVERLAY — TIMED IN STUDIO</span>
                <label>
                  Overlay text
                  <textarea
                    value={overlay.text}
                    onChange={(event) =>
                      updateOverlay(index, { text: event.target.value })
                    }
                    placeholder="Optional caption or [start-end] timed captions"
                  />
                </label>
                <div className="overlayGrid">
                  <label>
                    Position
                    <select
                      value={overlay.position}
                      onChange={(event) =>
                        updateOverlay(index, {
                          position: event.target.value as OverlayPosition,
                        })
                      }
                    >
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                  <label>
                    Start (sec)
                    <input
                      type="number"
                      min="0"
                      max={scene.duration}
                      step="0.1"
                      value={overlay.start}
                      onChange={(event) =>
                        updateOverlay(index, {
                          start: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    End (sec)
                    <input
                      type="number"
                      min="0"
                      max={scene.duration}
                      step="0.1"
                      value={overlay.end}
                      onChange={(event) =>
                        updateOverlay(index, {
                          end: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                {timed.length > 1 && (
                  <p className="statusText">
                    Timed lines preview individually. Bracket timing is never
                    shown in the video.
                  </p>
                )}
                {overlay.text.includes("💬") && (
                  <p className="statusText">
                    💬 lines render as floating phone-message bubbles in preview
                    and final video.
                  </p>
                )}
              </div>
              <div className={sceneStyles.sceneActions}>
                <button
                  disabled={
                    ["queued", "generating", "saving"].includes(state.status) ||
                    currentPrompt.trim().length < 10
                  }
                  onClick={() => generateScene(index)}
                >
                  {state.status === "queued"
                    ? "Submitting…"
                    : state.status === "generating"
                      ? "Generating…"
                      : state.status === "saving"
                        ? "Saving…"
                        : state.videoUrl
                          ? "Regenerate Only This Scene"
                          : "Generate This Scene"}
                </button>
                {state.videoUrl && (
                  <a
                    className="downloadLink"
                    href={sceneDownloadUrl(index, state.videoUrl)}
                    download={`${episode.id}-scene-${index + 1}.mp4`}
                  >
                    Download Scene {index + 1}
                  </a>
                )}
                {state.sourceVideoUrl &&
                  state.videoUrl !== state.sourceVideoUrl && (
                    <button
                      type="button"
                      className={sceneStyles.restoreAudioButton}
                      disabled={Boolean(restoringAudio[index]) || restoringAllAudio}
                      onClick={() => void restoreSceneOriginalAudio(index)}
                    >
                      {restoringAudio[index]
                        ? "Restoring Audio…"
                        : "Restore Original Audio"}
                    </button>
                  )}
              </div>
            </article>
          );
        })}
      </div>
      <section className="finalBuilder">
        <span className="eyebrow">EPISODE AUDIO</span>
        <h2>{series.title} audio</h2>
        {series.format === "narrated" && <NarrationPanel episode={episode} onChange={()=>setFinalUrl("")} onReady={setNarrationReady} />}
        <p>
          AI sound effects replace the current scene audio while preserving the
          approved visuals. The audio model can occasionally invent unwanted
          noises. You can restore the original generated audio without spending
          video credits.
          {series.musicMode === "household-theme"
            ? " The staple theme is added once across the full episode during final export."
            : " No automatic background theme will be added during final export."}
        </p>
        <button
          disabled={!allScenesReady || regeneratingSoundtracks || restoringAllAudio}
          onClick={() => void regenerateAllSoundtracks()}
        >
          {regeneratingSoundtracks
            ? soundtrackProgress || "Regenerating Soundtracks…"
            : "Generate AI Sound Effects for All Scenes"}
        </button>
        <button
          type="button"
          disabled={regeneratingSoundtracks || restoringAllAudio || !episode.scenes.some((_, index) => Boolean(sceneStates[index]?.sourceVideoUrl) && sceneStates[index]?.videoUrl !== sceneStates[index]?.sourceVideoUrl)}
          onClick={() => void restoreAllOriginalAudio()}
        >
          {restoringAllAudio
            ? "Restoring Original Audio…"
            : "Restore Original Audio for All Scenes"}
        </button>
        {soundtrackProgress && !regeneratingSoundtracks && (
          <p className="savedText">{soundtrackProgress}</p>
        )}
        {soundtrackError && <p className="errorText">{soundtrackError}</p>}
      </section>
      <section className="finalBuilder">
        <span className="eyebrow">FINAL EPISODE</span>
        <h2>Build the finished short</h2>
        <p>
          Studio stitches the approved scenes in order, burns each caption only
          during its intended moment, keeps the scene sound effects, then uses
          {series.musicMode === "household-theme"
            ? " one continuous Household Nonsense music bed across the full episode."
            : " the approved scene audio without adding a series theme."}
        </p>
        <button
          disabled={!allScenesReady || renderingFinal}
          onClick={() => void buildFinalVideo()}
        >
          {renderingFinal ? "Rendering Final Video…" : "Build Final Video"}
        </button>
        {!allScenesReady && (
          <p className="statusText">
            Generate and permanently save all {episode.scenes.length} scenes to
            unlock final rendering.
          </p>
        )}
        {finalError && <p className="errorText">{finalError}</p>}
        {finalUrl && (
          <div className="finalResult">
            <p className="savedText">
              ✓ Final episode saved permanently to R2 + Railway Postgres
            </p>
            <video className="finalVideo" style={series.aspectRatio === "16:9" ? {aspectRatio:"16 / 9",maxWidth:960,objectFit:"contain"} : undefined} src={finalUrl} controls playsInline />
            <p className="statusText">
              Exports are H.264/AAC MP4 with mobile-compatible yuv420p video.
            </p>
            <a
              className="downloadLink"
              href={finalDownloadUrl()}
              download={`${episode.id}.mp4`}
            >
              Download MP4
            </a>
            <a
              className="downloadLink"
              href={finalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open R2 Copy
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
