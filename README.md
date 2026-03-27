# FitTrack

FitTrack is a mobile-first React web app for tracking calories, macros, body weight, meals, workouts, and goal progress.

## Stack

- React + Vite
- Plain CSS
- Local browser storage through an isolated persistence module

## Current Phase 1 scope

- Dashboard with daily calories, macros, remaining targets, and weight trend
- Food logging with add, edit, delete, and per-day history
- Date navigation across days
- Weight tracking with a simple SVG trend chart
- Workout logging with sets, reps, weight, and recent history
- Goals/settings for calorie, macro, and weight targets

## Start locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite, usually `http://localhost:5173`.

## Build for deployment

```bash
npm run build
```

## Supabase setup

1. Copy `.env.example` to `.env.local`
2. Add:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. In Supabase SQL Editor, run [supabase/schema.sql](/Users/kp/Documents/FitTrack/supabase/schema.sql)
4. In Supabase Auth, enable Email and Magic Link sign-in

The app is structured so the persistence layer can later move from `localStorage` to a backend without rewriting the UI components.
