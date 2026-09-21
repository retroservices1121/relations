# Landscape and narration

Custom series support portrait 9:16 or landscape 16:9. Choose the shape when creating a series, or open its series page and save Production settings. Existing series default to portrait. Household Nonsense settings are protected by the API.

Landscape requests use 16:9 for both supported video providers. Exports are 1280×720; existing clips of other shapes are fitted with padding instead of cropped. Portrait exports retain 720×1280. Settings changes invalidate the series' saved final exports; source clips remain available.

Choose Narrated / voiceover to enable separate scene narration. The screenplay model supplies narration independently of captions and visual prompts. In the episode audio section, edit each line, select a voice, save text or generate audio, and listen before building the final video. Saving text is free. Explicit generation uses OpenAI `tts-1` and the existing `OPENAI_API_KEY`; audio is saved in R2 and indexed in Postgres. Speech is AI-generated. This feature is offscreen narration, not dialogue lip sync.

Narrated exports replace source audio, start each narration line at its scene boundary, and pad the remaining scene with silence. Blank saved lines produce silent scenes. Export rejects missing audio and lines longer than the actual clip instead of truncating speech or stretching video. Voice selection applies to the next generation, so regenerate existing lines to change their voice.

Requirements: existing Postgres and R2 configuration, `OPENAI_API_KEY`, and FFmpeg in the deployment image. The schema upgrade adds a portrait-default column and an independent narration table; it does not rewrite existing episode scenes. No new environment variables are required.

Validation: `npm run build`; `node scripts/test-production.cjs`. The integration test uses real FFmpeg with local clips, mock storage/database, and mock speech responses. It does not spend credits or verify live provider credentials. Live Postgres/R2 and speech generation still require a deployed smoke test.
