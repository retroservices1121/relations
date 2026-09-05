# Relations Studio

Private AI production studio for short-form cartoon relationship videos featuring recurring couple **Joe + Danda**.

## V1 goals
- Reusable relationship episode library
- Recurring Joe + Danda character framework
- Cartoon-first prompts and visual continuity
- Scene-by-scene generation
- fal.ai provider layer with Seedance/Kling support
- 9:16 short-form output for X, Instagram Reels, TikTok, and Shorts

## Local setup
```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your fal.ai API key to `.env.local`:
```bash
FAL_KEY=your_key_here
```

For Vercel, add `FAL_KEY` in Project Settings -> Environment Variables.
