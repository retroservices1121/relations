import { Pool } from "pg";

declare global {
  var relationsPool: Pool | undefined;
  var relationsSchemaReady: Promise<void> | undefined;
}

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!global.relationsPool) global.relationsPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return global.relationsPool;
}

export async function ensureSchema() {
  if (!global.relationsSchemaReady) {
    global.relationsSchemaReady = (async () => {
      const db = pool();
      await db.query(`CREATE TABLE IF NOT EXISTS relations_projects (episode_id TEXT PRIMARY KEY, final_url TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
      await db.query(`CREATE TABLE IF NOT EXISTS relations_scenes (
        episode_id TEXT NOT NULL, scene_index INTEGER NOT NULL, video_url TEXT, source_video_url TEXT, request_id TEXT,
        persisted BOOLEAN NOT NULL DEFAULT FALSE, overlay_text TEXT NOT NULL DEFAULT '', overlay_position TEXT NOT NULL DEFAULT 'bottom',
        overlay_start DOUBLE PRECISION NOT NULL DEFAULT 0, overlay_end DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (episode_id, scene_index));`);
      await db.query(`ALTER TABLE relations_scenes ADD COLUMN IF NOT EXISTS source_video_url TEXT;`);
    })();
  }
  await global.relationsSchemaReady;
}

export async function saveSceneVideo(input: { episodeId: string; sceneIndex: number; videoUrl: string; requestId: string; sourceVideoUrl?: string }) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_scenes (episode_id, scene_index, video_url, source_video_url, request_id, persisted, updated_at)
     VALUES ($1,$2,$3,$4,$5,TRUE,NOW()) ON CONFLICT (episode_id, scene_index) DO UPDATE SET
     video_url=EXCLUDED.video_url, source_video_url=COALESCE(EXCLUDED.source_video_url, relations_scenes.source_video_url),
     request_id=EXCLUDED.request_id, persisted=TRUE, updated_at=NOW()`,
    [input.episodeId, input.sceneIndex, input.videoUrl, input.sourceVideoUrl || null, input.requestId],
  );
}

export async function saveOverlay(input: { episodeId: string; sceneIndex: number; text: string; position: string; start: number; end: number }) {
  await ensureSchema();
  await pool().query(
    `INSERT INTO relations_scenes (episode_id,scene_index,overlay_text,overlay_position,overlay_start,overlay_end,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (episode_id,scene_index) DO UPDATE SET
     overlay_text=EXCLUDED.overlay_text, overlay_position=EXCLUDED.overlay_position, overlay_start=EXCLUDED.overlay_start, overlay_end=EXCLUDED.overlay_end, updated_at=NOW()`,
    [input.episodeId,input.sceneIndex,input.text,input.position,input.start,input.end],
  );
}

export async function saveFinalVideo(episodeId: string, finalUrl: string) {
  await ensureSchema();
  await pool().query(`INSERT INTO relations_projects (episode_id,final_url,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (episode_id) DO UPDATE SET final_url=EXCLUDED.final_url,updated_at=NOW()`, [episodeId, finalUrl]);
}

export async function clearFinalVideo(episodeId: string) {
  await ensureSchema();
  await pool().query(`INSERT INTO relations_projects (episode_id,final_url,updated_at) VALUES ($1,NULL,NOW()) ON CONFLICT (episode_id) DO UPDATE SET final_url=NULL,updated_at=NOW()`, [episodeId]);
}

export async function getBuiltEpisodeIds() {
  await ensureSchema();
  const result = await pool().query(`SELECT episode_id FROM relations_projects WHERE final_url IS NOT NULL AND final_url <> ''`);
  return result.rows.map((row) => String(row.episode_id));
}

export async function loadProject(episodeId: string) {
  await ensureSchema();
  const [project, scenes] = await Promise.all([
    pool().query(`SELECT final_url FROM relations_projects WHERE episode_id=$1`, [episodeId]),
    pool().query(`SELECT scene_index,video_url,source_video_url,request_id,persisted,overlay_text,overlay_position,overlay_start,overlay_end FROM relations_scenes WHERE episode_id=$1 ORDER BY scene_index`, [episodeId]),
  ]);
  return { finalUrl: project.rows[0]?.final_url || "", scenes: scenes.rows };
}
