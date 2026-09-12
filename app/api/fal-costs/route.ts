import { NextResponse } from "next/server";
import { dbConfigured, getEpisodeGenerationRequests } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingEvent = {
  request_id?: string;
  endpoint_id?: string;
  cost_total?: number;
  cost_estimate_nano_usd?: number;
  timestamp?: string;
  created_at?: string;
};

function authHeader() {
  const key = process.env.FAL_KEY || "";
  return key.startsWith("Key ") ? key : `Key ${key}`;
}

function eventCost(event: BillingEvent) {
  if (Number.isFinite(Number(event.cost_total))) return Number(event.cost_total);
  if (Number.isFinite(Number(event.cost_estimate_nano_usd))) return Number(event.cost_estimate_nano_usd) / 1_000_000_000;
  return 0;
}

function estimateCost(model: string, duration: number) {
  const seconds = Math.max(0, Number(duration) || 0);
  return seconds * (model === "seedance-standard" ? 0.3034 : 0.2419);
}

async function loadBillingEvents() {
  const now = new Date();
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const events: BillingEvent[] = [];
  let unavailable = false;
  let unavailableStatus: number | null = null;

  while (cursor < now) {
    const end = new Date(Math.min(now.getTime(), cursor.getTime() + 89 * 24 * 60 * 60 * 1000));
    const url = new URL("https://api.fal.ai/v1/models/billing-events");
    url.searchParams.set("start", cursor.toISOString());
    url.searchParams.set("end", end.toISOString());
    url.searchParams.set("limit", "10000");
    const response = await fetch(url, { headers: { Authorization: authHeader() }, cache: "no-store" });

    if (!response.ok) {
      unavailable = true;
      unavailableStatus = response.status;
      break;
    }

    const data = await response.json();
    if (Array.isArray(data?.items)) events.push(...data.items);
    cursor = new Date(end.getTime() + 1000);
  }

  return { events, unavailable, unavailableStatus };
}

async function loadBalance() {
  const response = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", { headers: { Authorization: authHeader() }, cache: "no-store" });
  if (!response.ok) return { balance: null, currency: "USD" };
  const data = await response.json();
  return { balance: data?.credits?.current_balance ?? null, currency: data?.credits?.currency || "USD" };
}

export async function GET(request: Request) {
  try {
    if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 500 });
    if (!dbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    const episodeId = new URL(request.url).searchParams.get("episodeId") || "";
    if (!episodeId) return NextResponse.json({ error: "episodeId is required." }, { status: 400 });

    const [{ attempts, currentScenes }, billing, credit] = await Promise.all([
      getEpisodeGenerationRequests(episodeId),
      loadBillingEvents(),
      loadBalance(),
    ]);

    const events = billing.events;
    const eventByRequest = new Map<string, BillingEvent>();
    for (const event of events) if (event.request_id) eventByRequest.set(event.request_id, event);
    const ytdSpend = events.reduce((sum, event) => sum + eventCost(event), 0);

    const tracked = new Map<string, any>();
    for (const attempt of attempts) tracked.set(String(attempt.request_id), attempt);
    for (const scene of currentScenes) {
      const requestId = String(scene.request_id || "");
      if (requestId && !tracked.has(requestId)) tracked.set(requestId, { request_id: requestId, scene_index: scene.scene_index, model: "seedance-fast", duration: 0, historical: true });
    }

    const rows = Array.from(tracked.values()).map((attempt) => {
      const requestId = String(attempt.request_id);
      const event = eventByRequest.get(requestId);
      const exact = event ? eventCost(event) : null;
      const estimated = exact == null && Number(attempt.duration) > 0 ? estimateCost(String(attempt.model || "seedance-fast"), Number(attempt.duration)) : null;
      return {
        requestId,
        sceneIndex: Number(attempt.scene_index),
        model: String(attempt.model || "seedance-fast"),
        duration: Number(attempt.duration) || null,
        cost: exact ?? estimated,
        exact: exact != null,
        historical: Boolean(attempt.historical),
        createdAt: attempt.created_at || event?.timestamp || event?.created_at || null,
      };
    }).filter((row) => Number.isInteger(row.sceneIndex));

    const scenes = new Map<number, { sceneIndex: number; cost: number; exactCost: number; estimatedCost: number; attempts: number }>();
    for (const row of rows) {
      const current = scenes.get(row.sceneIndex) || { sceneIndex: row.sceneIndex, cost: 0, exactCost: 0, estimatedCost: 0, attempts: 0 };
      if (typeof row.cost === "number") current.cost += row.cost;
      if (row.exact && typeof row.cost === "number") current.exactCost += row.cost;
      if (!row.exact && typeof row.cost === "number") current.estimatedCost += row.cost;
      current.attempts += 1;
      scenes.set(row.sceneIndex, current);
    }
    const sceneCosts = Array.from(scenes.values()).sort((a, b) => a.sceneIndex - b.sceneIndex);
    const episodeCost = sceneCosts.reduce((sum, scene) => sum + scene.cost, 0);

    const billingNote = billing.unavailable
      ? `Fal billing events returned ${billing.unavailableStatus ?? "an error"}, so episode costs are being estimated from tracked generation duration instead of exact billing events.`
      : "Exact costs come from Fal billing events. Older scene retries from before cost tracking was added may only be included in the account total, not attributed to a specific scene.";

    return NextResponse.json({
      episodeId,
      balance: credit.balance,
      currency: credit.currency,
      ytdSpend: billing.unavailable ? null : ytdSpend,
      ytdLabel: billing.unavailable ? "Fal spend unavailable" : `${new Date().getUTCFullYear()} Fal spend`,
      episodeCost,
      sceneCosts,
      requests: rows,
      note: billingNote,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Fal costs." }, { status: 500 });
  }
}
