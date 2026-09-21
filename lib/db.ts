import { Pool } from "pg";
import type { Episode, Scene } from "../data/episodes";
import type { SeriesConfig } from "./series";
import { householdNonsenseSeries } from "./series";

declare global {
  var relationsPool: Pool | undefined;
  var relationsSchemaReady: Promise<void> | undefined;
}
export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured.");
  if (!global.relationsPool)
    global.relationsPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  return global.relationsPool;
}
export async function ensureSchema() {
  if (!global.relationsSchemaReady) {
    global.relationsSchemaReady = (async () => {
      const db = pool();
      await db.query(
        `CREATE TABLE IF NOT EXISTS relations_projects (episode_id TEXT PRIMARY KEY, final_url TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
      );
      await db.query(
        `ALTER TABLE relations_projects ADD COLUMN IF NOT EXISTS posted BOOLEAN NOT NULL DEFAULT FALSE;`,
      );
      await db.query(
        `CREATE TABLE IF NOT EXISTS relations_custom_episodes (episode_id TEXT PRIMARY KEY,title TEXT NOT NULL,hook TEXT NOT NULL DEFAULT '',source_prompt TEXT NOT NULL DEFAULT '',input_mode TEXT NOT NULL DEFAULT 'idea',scenes JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
      );
      await db.query(`CREATE TABLE IF NOT EXISTS relations_series (series_id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',visual_style TEXT NOT NULL DEFAULT '',screenplay_rules TEXT NOT NULL DEFAULT '',format TEXT NOT NULL DEFAULT 'silent',music_mode TEXT NOT NULL DEFAULT 'none',locked BOOLEAN NOT NULL DEFAULT FALSE,characters JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
      await db.query(`ALTER TABLE relations_custom_episodes ADD COLUMN IF NOT EXISTS series_id TEXT NOT NULL DEFAULT 'household-nonsense';`);
      await db.query(`ALTER TABLE relations_series ADD COLUMN IF NOT EXISTS aspect_ratio TEXT NOT NULL DEFAULT '9:16'`);
      await db.query(`CREATE TABLE IF NOT EXISTS relations_narration (episode_id TEXT NOT NULL,scene_index INTEGER NOT NULL,text TEXT NOT NULL DEFAULT '',voice TEXT NOT NULL DEFAULT 'onyx',url TEXT NOT NULL DEFAULT '',duration DOUBLE PRECISION NOT NULL DEFAULT 0,PRIMARY KEY (episode_id,scene_index))`);
      for (const series of [householdNonsenseSeries]) {
        await db.query(`INSERT INTO relations_series (series_id,title,description,visual_style,screenplay_rules,format,music_mode,locked,characters) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (series_id) DO NOTHING`,[series.id,series.title,series.description,series.visualStyle,series.screenplayRules,series.format,series.musicMode,series.locked,JSON.stringify(series.characters)]);
      }
      await db.query(
        `CREATE TABLE IF NOT EXISTS relations_scenes (episode_id TEXT NOT NULL, scene_index INTEGER NOT NULL, video_url TEXT, source_video_url TEXT, request_id TEXT,persisted BOOLEAN NOT NULL DEFAULT FALSE, overlay_text TEXT NOT NULL DEFAULT '', overlay_position TEXT NOT NULL DEFAULT 'bottom',overlay_start DOUBLE PRECISION NOT NULL DEFAULT 0, overlay_end DOUBLE PRECISION NOT NULL DEFAULT 0, scene_prompt TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (episode_id, scene_index));`,
      );
      await db.query(
        `ALTER TABLE relations_scenes ADD COLUMN IF NOT EXISTS source_video_url TEXT;`,
      );
      await db.query(
        `ALTER TABLE relations_scenes ADD COLUMN IF NOT EXISTS theme_baked BOOLEAN NOT NULL DEFAULT TRUE;`,
      );
      await db.query(
        `ALTER TABLE relations_scenes ADD COLUMN IF NOT EXISTS scene_prompt TEXT;`,
      );
      await db.query(
        `CREATE TABLE IF NOT EXISTS relations_generation_requests (request_id TEXT PRIMARY KEY,episode_id TEXT,scene_index INTEGER,model TEXT NOT NULL DEFAULT 'seedance-fast',endpoint_id TEXT NOT NULL DEFAULT '',duration DOUBLE PRECISION NOT NULL DEFAULT 0,cost_usd DOUBLE PRECISION,cost_source TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
      );
      await db.query(
        `CREATE INDEX IF NOT EXISTS relations_generation_episode_scene_idx ON relations_generation_requests (episode_id, scene_index, created_at);`,
      );
    })();
  }
  await global.relationsSchemaReady;
}
export async function createCustomEpisode(input: {
  title: string;
  hook: string;
  sourcePrompt: string;
  inputMode: string;
  scenes: Scene[];
  seriesId?: string;
}) {
  await ensureSchema();
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await pool().query(
    `INSERT INTO relations_custom_episodes (episode_id,title,hook,source_prompt,input_mode,scenes,series_id) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [
      id,
      input.title,
      input.hook,
      input.sourcePrompt,
      input.inputMode,
      JSON.stringify(input.scenes),
      input.seriesId || "household-nonsense",
    ],
  );
  return {
    id,
    title: input.title,
    hook: input.hook,
    scenes: input.scenes,
    seriesId: input.seriesId || "household-nonsense",
  } satisfies Episode;
}
export async function listCustomEpisodes(): Promise<Episode[]> {
  await ensureSchema();
  const result = await pool().query(
    `SELECT episode_id,title,hook,scenes,series_id FROM relations_custom_episodes ORDER BY created_at DESC`,
  );
  return result.rows.map((row) => ({
    id: String(row.episode_id),
    title: String(row.title),
    hook: String(row.hook || ""),
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
    seriesId: String(row.series_id || "household-nonsense"),
  }));
}
export async function getCustomEpisode(id: string): Promise<Episode | null> {
  await ensureSchema();
  const result = await pool().query(
    `SELECT episode_id,title,hook,scenes,series_id FROM relations_custom_episodes WHERE episode_id=$1`,
    [id],
  );
  const row = result.rows[0];
  return row
    ? {
        id: String(row.episode_id),
        title: String(row.title),
        hook: String(row.hook || ""),
        scenes: Array.isArray(row.scenes) ? row.scenes : [],
        seriesId: String(row.series_id || "household-nonsense"),
      }
    : null;
}

function mapSeries(row: Record<string, unknown>): SeriesConfig {
  return { id:String(row.series_id),title:String(row.title),description:String(row.description||""),visualStyle:String(row.visual_style||""),screenplayRules:String(row.screenplay_rules||""),aspectRatio:row.aspect_ratio==="16:9"?"16:9":"9:16",format:row.format==="narrated"?"narrated":row.format==="dialogue"?"dialogue":"silent",musicMode:row.music_mode==="household-theme"?"household-theme":"none",locked:Boolean(row.locked),characters:Array.isArray(row.characters)?row.characters as SeriesConfig["characters"]:[] };
}
export async function listSeries() { await ensureSchema(); const result=await pool().query(`SELECT * FROM relations_series ORDER BY locked DESC,created_at`); return result.rows.map(mapSeries); }
export async function getSeries(id:string) { await ensureSchema(); const result=await pool().query(`SELECT * FROM relations_series WHERE series_id=$1`,[id]); return result.rows[0]?mapSeries(result.rows[0]):null; }
export async function saveSeries(input:SeriesConfig) { await ensureSchema(); await pool().query(`INSERT INTO relations_series (series_id,title,description,visual_style,screenplay_rules,format,music_mode,locked,characters,aspect_ratio,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,NOW()) ON CONFLICT (series_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,visual_style=EXCLUDED.visual_style,screenplay_rules=EXCLUDED.screenplay_rules,format=EXCLUDED.format,music_mode=EXCLUDED.music_mode,characters=EXCLUDED.characters,aspect_ratio=EXCLUDED.aspect_ratio,updated_at=NOW() WHERE relations_series.locked=FALSE`,[input.id,input.title,input.description,input.visualStyle,input.screenplayRules,input.format,input.musicMode,input.locked,JSON.stringify(input.characters),input.aspectRatio||"9:16"]); return getSeries(input.id); }
export async function saveGenerationRequest(input: {
  requestId: string;
  model: string;
  endpointId: string;
  duration: number;
}) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_generation_requests (request_id,model,endpoint_id,duration,created_at,updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (request_id) DO UPDATE SET model=EXCLUDED.model,endpoint_id=EXCLUDED.endpoint_id,duration=EXCLUDED.duration,updated_at=NOW()`,
    [input.requestId, input.model, input.endpointId, input.duration],
  );
}
export async function associateGenerationRequest(input: {
  requestId: string;
  episodeId: string;
  sceneIndex: number;
}) {
  await ensureSchema();
  await pool().query(
    `UPDATE relations_generation_requests SET episode_id=$2,scene_index=$3,updated_at=NOW() WHERE request_id=$1`,
    [input.requestId, input.episodeId, input.sceneIndex],
  );
}
export async function saveGenerationCost(input: {
  requestId: string;
  costUsd: number;
  source: string;
}) {
  await ensureSchema();
  await pool().query(
    `UPDATE relations_generation_requests SET cost_usd=$2,cost_source=$3,updated_at=NOW() WHERE request_id=$1`,
    [input.requestId, input.costUsd, input.source],
  );
}
export async function getEpisodeGenerationRequests(episodeId: string) {
  await ensureSchema();
  const [attempts, currentScenes] = await Promise.all([
    pool().query(
      `SELECT request_id,episode_id,scene_index,model,endpoint_id,duration,cost_usd,cost_source,created_at FROM relations_generation_requests WHERE episode_id=$1 ORDER BY scene_index,created_at`,
      [episodeId],
    ),
    pool().query(
      `SELECT scene_index,request_id FROM relations_scenes WHERE episode_id=$1 AND request_id IS NOT NULL ORDER BY scene_index`,
      [episodeId],
    ),
  ]);
  return { attempts: attempts.rows, currentScenes: currentScenes.rows };
}
export async function saveSceneVideo(input: {
  episodeId: string;
  sceneIndex: number;
  videoUrl: string;
  requestId: string;
  sourceVideoUrl?: string;
  themeBaked?: boolean;
}) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_scenes (episode_id,scene_index,video_url,source_video_url,request_id,persisted,theme_baked,updated_at) VALUES ($1,$2,$3,$4,$5,TRUE,$6,NOW()) ON CONFLICT (episode_id,scene_index) DO UPDATE SET video_url=EXCLUDED.video_url,source_video_url=COALESCE(EXCLUDED.source_video_url,relations_scenes.source_video_url),request_id=EXCLUDED.request_id,persisted=TRUE,theme_baked=EXCLUDED.theme_baked,updated_at=NOW()`,
    [
      input.episodeId,
      input.sceneIndex,
      input.videoUrl,
      input.sourceVideoUrl || null,
      input.requestId,
      input.themeBaked ?? false,
    ],
  );
}
export async function restoreOriginalSceneAudio(
  episodeId: string,
  sceneIndex: number,
) {
  await ensureSchema();
  const result = await pool().query(
    `UPDATE relations_scenes
     SET video_url=source_video_url,theme_baked=FALSE,updated_at=NOW()
     WHERE episode_id=$1 AND scene_index=$2
       AND source_video_url IS NOT NULL AND source_video_url <> ''
     RETURNING video_url,source_video_url,request_id,persisted,theme_baked`,
    [episodeId, sceneIndex],
  );
  return result.rows[0] || null;
}
export async function saveOverlay(input: {
  episodeId: string;
  sceneIndex: number;
  text: string;
  position: string;
  start: number;
  end: number;
}) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_scenes (episode_id,scene_index,overlay_text,overlay_position,overlay_start,overlay_end,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (episode_id,scene_index) DO UPDATE SET overlay_text=EXCLUDED.overlay_text,overlay_position=EXCLUDED.overlay_position,overlay_start=EXCLUDED.overlay_start,overlay_end=EXCLUDED.overlay_end,updated_at=NOW()`,
    [
      input.episodeId,
      input.sceneIndex,
      input.text,
      input.position,
      input.start,
      input.end,
    ],
  );
}
export async function saveScenePrompt(input: {
  episodeId: string;
  sceneIndex: number;
  prompt: string;
}) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_scenes (episode_id,scene_index,scene_prompt,updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (episode_id,scene_index) DO UPDATE SET scene_prompt=EXCLUDED.scene_prompt,updated_at=NOW()`,
    [input.episodeId, input.sceneIndex, input.prompt],
  );
}
export async function saveFinalVideo(episodeId: string, finalUrl: string) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_projects (episode_id,final_url,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (episode_id) DO UPDATE SET final_url=EXCLUDED.final_url,updated_at=NOW()`,
    [episodeId, finalUrl],
  );
}
export async function clearFinalVideo(episodeId: string) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_projects (episode_id,final_url,updated_at) VALUES ($1,NULL,NOW()) ON CONFLICT (episode_id) DO UPDATE SET final_url=NULL,updated_at=NOW()`,
    [episodeId],
  );
}
export async function getBuiltEpisodeIds() {
  await ensureSchema();
  const result = await pool().query(
    `SELECT episode_id FROM relations_projects WHERE final_url IS NOT NULL AND final_url <> ''`,
  );
  return result.rows.map((row) => String(row.episode_id));
}
export async function getPostedEpisodeIds() {
  await ensureSchema();
  const result = await pool().query(
    `SELECT episode_id FROM relations_projects WHERE posted=TRUE`,
  );
  return result.rows.map((row) => String(row.episode_id));
}
export async function setEpisodePosted(episodeId: string, posted: boolean) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_projects (episode_id,posted,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (episode_id) DO UPDATE SET posted=EXCLUDED.posted,updated_at=NOW()`,
    [episodeId, posted],
  );
}
export async function loadProject(episodeId: string) {
  await ensureSchema();
  const [project, scenes] = await Promise.all([
    pool().query(
      `SELECT final_url FROM relations_projects WHERE episode_id=$1`,
      [episodeId],
    ),
    pool().query(
      `SELECT scene_index,video_url,source_video_url,request_id,persisted,theme_baked,overlay_text,overlay_position,overlay_start,overlay_end,scene_prompt FROM relations_scenes WHERE episode_id=$1 ORDER BY scene_index`,
      [episodeId],
    ),
  ]);
  return { finalUrl: project.rows[0]?.final_url || "", scenes: scenes.rows };
}
