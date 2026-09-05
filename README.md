# Relations Studio

Private AI production studio for short-form cartoon relationship videos featuring recurring couple **Joe + Danda**.

## Production architecture

- **Railway** — Next.js app hosting
- **Railway Postgres** — episode/project metadata, saved scenes, overlay settings, final render records
- **Cloudflare R2** — permanent MP4 storage for generated scenes and final episodes
- **fal.ai / Seedance** — scene generation
- **FFmpeg** — final scene stitching and burned-in text overlays

The database tables are created automatically on first use, so there is no manual migration step for the current Studio schema.

## Railway setup

1. Create a Railway project from this GitHub repository.
2. Add a Railway Postgres service to the project. Railway will provide `DATABASE_URL` to the app service when referenced/connected.
3. Add the fal.ai API key as `FAL_KEY`.
4. Create a Cloudflare R2 bucket, enable a public/custom-domain URL for the bucket, and create R2 API credentials with object read/write access.
5. Add these variables to the Railway app service:

```bash
FAL_KEY=
DATABASE_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=relations-media
R2_PUBLIC_URL=https://your-public-r2-domain.example
```

`R2_PUBLIC_URL` must be the public base URL that serves objects in the bucket. Do not include a trailing slash.

Railway can use the standard commands automatically:

```bash
npm install
npm run build
npm start
```

## Studio workflow

1. Upload the approved Joe and Danda cartoon references.
2. Generate a scene through Seedance.
3. Studio downloads the completed scene and saves the MP4 to R2.
4. Railway Postgres stores the permanent scene URL, request ID, and overlay configuration.
5. Edit text overlays inside Studio.
6. When every scene is permanently saved, click **Build Final Video**.
7. FFmpeg stitches the scenes, burns in the timed text overlays, preserves scene audio/SFX, uploads the finished MP4 to R2, and stores the final URL in Postgres.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in the variables from `.env.example` before testing permanent storage or final rendering.
