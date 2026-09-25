import assert from "node:assert/strict";
import test from "node:test";
import { hybridVideoBlockReason, replaceTimelineVideo } from "../lib/hybrid-timeline.ts";

const rawUrl = "https://media.example/raw.mp4";
const processedUrl = "https://media.example/locked.mp4";
const opening = { id: "opening", type: "video", url: rawUrl, duration: 7.5, label: "Opening video" };
const stills = Array.from({ length: 6 }, (_, index) => ({
  id: `still-${index}`, type: "image", url: `https://media.example/${index}.png`,
  duration: index + 0.5, label: `Costume still ${index + 1}`,
}));

test("completion replaces the raw clip while preserving IDs, timing, order, and all six stills", () => {
  const original = [opening, ...stills];
  const label = "Opening video — locked Joe and Danda cartoon heads applied";
  const updated = replaceTimelineVideo(original, processedUrl, label);
  assert.deepEqual(updated, [{ ...opening, url: processedUrl, label }, ...stills]);
  assert.equal(original[0].url, rawUrl);
  stills.forEach((still, index) => assert.equal(updated[index + 1], still));
  assert.equal(hybridVideoBlockReason(updated, "done", processedUrl), "");
});

test("replacement preserves a video position and edits made during processing", () => {
  const edited = [stills[0], { ...opening, duration: 11 }, ...stills.slice(2)];
  const updated = replaceTimelineVideo(edited, processedUrl, "Locked Joe head applied");
  assert.deepEqual(updated.map(({ id, duration }) => ({ id, duration })), edited.map(({ id, duration }) => ({ id, duration })));
  assert.equal(updated[1].url, processedUrl);
});

test("completion never restores a video removed during processing", () => {
  assert.deepEqual(replaceTimelineVideo(stills, processedUrl, "Applied"), stills);
});

test("new uploads and retries replace the old processed video without losing stills or duration", () => {
  const completed = replaceTimelineVideo([opening, ...stills], processedUrl, "Applied");
  const replacement = replaceTimelineVideo(completed, "https://media.example/new.mp4", "Locked heads required");
  assert.equal(replacement[0].url, "https://media.example/new.mp4");
  assert.equal(replacement[0].duration, opening.duration);
  assert.deepEqual(replacement.slice(1), stills);
  assert.notEqual(hybridVideoBlockReason(replacement, "ready", ""), "");
});

test("raw video export is blocked before processing, during processing, and after failure", () => {
  for (const status of ["idle", "uploading", "ready", "generating", "error", "done"]) {
    assert.notEqual(hybridVideoBlockReason([opening, ...stills], status, ""), "", status);
  }
  assert.match(hybridVideoBlockReason([opening], "generating", ""), /still processing/);
});

test("a successful preview cannot authorize a timeline still pointing at the raw or stale video", () => {
  assert.notEqual(hybridVideoBlockReason([opening, ...stills], "done", processedUrl), "");
  const completed = replaceTimelineVideo([opening], processedUrl, "Applied");
  assert.notEqual(hybridVideoBlockReason(completed, "done", "https://media.example/other.mp4"), "");
  assert.notEqual(hybridVideoBlockReason(completed, "error", processedUrl), "");
  assert.notEqual(hybridVideoBlockReason(completed, "generating", processedUrl), "");
});

test("stills-only timelines remain exportable without locked-head processing", () => {
  for (const status of ["idle", "uploading", "ready", "generating", "error", "done"]) {
    assert.equal(hybridVideoBlockReason(stills, status, ""), "");
  }
});
