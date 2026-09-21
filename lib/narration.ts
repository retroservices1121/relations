import { ensureSchema, pool } from "./db";
import type { Narration } from "./production";

export async function loadNarration(episodeId: string): Promise<Record<number, Narration>> {
  await ensureSchema();
  const result = await pool().query("SELECT scene_index,text,voice,url,duration FROM relations_narration WHERE episode_id=$1", [episodeId]);
  return Object.fromEntries(result.rows.map(row => [row.scene_index, {text:row.text,voice:row.voice,url:row.url,duration:Number(row.duration)}]));
}
export async function saveNarration(episodeId: string, sceneIndex: number, item: Narration) {
  await ensureSchema();
  await pool().query(`INSERT INTO relations_narration (episode_id,scene_index,text,voice,url,duration) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (episode_id,scene_index) DO UPDATE SET text=EXCLUDED.text,voice=EXCLUDED.voice,url=EXCLUDED.url,duration=EXCLUDED.duration`,
    [episodeId,sceneIndex,item.text,item.voice,item.url,item.duration]);
}
