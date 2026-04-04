# AI Fit / FitTrack Project Handbook

This document is a plain-text project handbook that can be pasted into Google Docs or imported as a Markdown document later.

## 1. Project Overview

Project name:
- AI Fit

Repo folder on this Mac:
- `/Users/kp/Documents/FitTrack`

GitHub repo:
- `https://github.com/krisperkinsemail-png/fittrack-app`

What this app does:
- Tracks food, calories, macros, body weight, workouts, and daily progress
- Supports per-day navigation across past and future dates
- Supports cloud-backed accounts and syncing through Supabase
- Supports a mobile-friendly home-screen install experience

Current product direction:
- Mobile-first fitness tracker
- Strong focus on fast food logging, quick search, workout logging, and compact dashboard views
- Supports account-specific data and some account-specific content rules

## 2. Tech Stack

Frontend:
- React 19
- Vite 7
- Plain CSS

Cloud / backend services:
- Supabase
  - Auth
  - Postgres tables
  - cloud data persistence
  - restaurant search table / RPC support

Hosting / deployment:
- Vercel

Version control:
- Git
- GitHub

Local persistence fallback:
- Browser local storage

Other project data:
- local JSON and CSV research files
- restaurant dataset import tooling

## 3. Important Services Used

### GitHub
Used for:
- source control
- commit history
- main branch deployment source
- backup of the codebase

Current remote:
- `origin https://github.com/krisperkinsemail-png/fittrack-app.git`

### Supabase
Used for:
- sign-in / auth
- user-scoped settings
- food entries
- meal templates / saved foods
- weight entries
- workout entries
- custom workout systems
- restaurant search data

Important env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Files related to Supabase:
- [src/lib/supabase.js](/Users/kp/Documents/FitTrack/src/lib/supabase.js)
- [src/lib/storage.supabase.js](/Users/kp/Documents/FitTrack/src/lib/storage.supabase.js)
- [supabase/schema.sql](/Users/kp/Documents/FitTrack/supabase/schema.sql)
- [supabase/restaurant-library-import.md](/Users/kp/Documents/FitTrack/supabase/restaurant-library-import.md)

### Vercel
Used for:
- hosting the production web app
- automatic deploys from GitHub

Typical flow:
- push to `main`
- Vercel deploys the newest version

## 4. Local Project Structure

Main app entry:
- [src/App.jsx](/Users/kp/Documents/FitTrack/src/App.jsx)

Main sections:
- [src/components/DashboardSection.jsx](/Users/kp/Documents/FitTrack/src/components/DashboardSection.jsx)
- [src/components/FoodLogSection.jsx](/Users/kp/Documents/FitTrack/src/components/FoodLogSection.jsx)
- [src/components/WeightSection.jsx](/Users/kp/Documents/FitTrack/src/components/WeightSection.jsx)
- [src/components/WorkoutSection.jsx](/Users/kp/Documents/FitTrack/src/components/WorkoutSection.jsx)
- [src/components/SettingsSection.jsx](/Users/kp/Documents/FitTrack/src/components/SettingsSection.jsx)
- [src/components/AuthGate.jsx](/Users/kp/Documents/FitTrack/src/components/AuthGate.jsx)

State and persistence:
- [src/hooks/useFitTrackStore.js](/Users/kp/Documents/FitTrack/src/hooks/useFitTrackStore.js)
- [src/lib/storage.js](/Users/kp/Documents/FitTrack/src/lib/storage.js)
- [src/lib/storage.local.js](/Users/kp/Documents/FitTrack/src/lib/storage.local.js)
- [src/lib/storage.supabase.js](/Users/kp/Documents/FitTrack/src/lib/storage.supabase.js)

Shared libraries / data:
- [src/lib/foodLibrary.js](/Users/kp/Documents/FitTrack/src/lib/foodLibrary.js)
- [src/lib/restaurantLibrary.js](/Users/kp/Documents/FitTrack/src/lib/restaurantLibrary.js)
- [src/lib/workoutTemplates.js](/Users/kp/Documents/FitTrack/src/lib/workoutTemplates.js)
- [public/restaurant-library.json](/Users/kp/Documents/FitTrack/public/restaurant-library.json)

Styling:
- [src/styles.css](/Users/kp/Documents/FitTrack/src/styles.css)

PWA / app icon files:
- [index.html](/Users/kp/Documents/FitTrack/index.html)
- [public/site.webmanifest](/Users/kp/Documents/FitTrack/public/site.webmanifest)
- [public/app-icon.png](/Users/kp/Documents/FitTrack/public/app-icon.png)

## 5. What We Built In This Project

Major product areas:
- Dashboard / Data Snapshot
- Food Logging
- Weight Tracking
- Workout Tracking
- Goals / Settings
- Mobile home-screen install behavior

Examples of important implemented behavior:
- Selected date navigation across days
- Refresh starts on today
- Midnight rollover support
- Quick food search and restaurant filtering
- Saved foods and meal templates
- Weight overwrite confirmation
- Workout program selection and popup pickers
- Collapsed workout cards
- Resumable workout drafts
- Exercise and set reordering
- Timer presets and timer sound
- Account-scoped Optavia library items
- Mobile collapsible dashboard / history sections
- Undo for destructive actions
- Last sync timestamp

## 6. How the App Runs Locally

Open Terminal and run:

```bash
cd /Users/kp/Documents/FitTrack
npm install
npm run dev
```

Typical local URL:
- `http://localhost:5173`

If you want a production-style local build:

```bash
npm run build
npm run preview
```

## 7. Environment Setup

Env example file:
- [.env.example](/Users/kp/Documents/FitTrack/.env.example)

Local env file:
- `.env.local`

Expected values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

If `.env.local` is missing or wrong:
- cloud auth may fail
- cloud sync may fail
- the app may fall back to local-only behavior

## 8. How Deployment Works

Normal release process:
1. Make code changes locally
2. Run `npm run build`
3. Commit changes to git
4. Push to `origin main`
5. Vercel deploys the updated app

Useful commands:

```bash
git status
git add <files>
git commit -m "Your message"
git push origin main
```

## 9. How Supabase Fits Into the App

Supabase is used for user accounts and cloud-backed data.

Important behavior:
- reads are user-scoped
- writes are user-scoped
- saved foods and meals are user-specific
- weight and workout data are user-specific
- some content can be restricted to one account by email

Example of account-specific behavior already in this project:
- Optavia foods are restricted to `jennica.perkins@gmail.com`

## 10. Restaurant Data Workflow

Restaurant search has a separate import flow.

Reference doc:
- [supabase/restaurant-library-import.md](/Users/kp/Documents/FitTrack/supabase/restaurant-library-import.md)

Useful commands:

```bash
python3 research/build_food_library_datasets.py
npm run sync:restaurants
```

The restaurant sync script uses:
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 11. How to Return Later and Use Codex Again

If you come back after a long break, use this process.

### Step 1: Open the project folder

In Terminal:

```bash
cd /Users/kp/Documents/FitTrack
```

### Step 2: Start Codex in this folder

Open Codex from the project directory so it shares the right workspace context.

### Step 3: Tell Codex what project this is

A good reminder prompt:

```text
We are working on AI Fit in /Users/kp/Documents/FitTrack. This is the React + Vite fitness tracker app with Supabase auth/data, GitHub repo fittrack-app, and Vercel hosting. Please inspect the project and help me continue from here.
```

### Step 4: Tell Codex the exact task

Examples:
- “Fix a bug in workout logging”
- “Add a new saved food feature”
- “Push the local changes”
- “Inspect the mobile layout”
- “Update the app icon”

### Step 5: Ask Codex to verify before pushing

Good reminder:

```text
Run a build before pushing anything.
```

## 12. Good Prompt Examples for Future Codex Sessions

Examples:

```text
Look through this codebase and explain how food logging works.
```

```text
Add a new dashboard card for weekly compliance trend.
```

```text
This feature should only be visible to one user: email@example.com
```

```text
Push all current changes except unrelated local data files.
```

```text
Inspect mobile view issues in the workout section and fix them.
```

## 13. Important Project Habits

Before pushing:
- run `npm run build`
- make sure only intended files are staged
- check `git status`

When changing cloud behavior:
- confirm data is user-scoped
- be careful not to leak one user’s data to another

When changing mobile UI:
- test compact layout
- test collapsible sections
- test iPhone home-screen behavior if relevant

When changing icons or install behavior:
- update manifest and Apple touch icon references
- remember iPhone may require removing and re-adding the saved app icon

## 14. Known Important Files To Remember

If you forget where things are, start here:
- [README.md](/Users/kp/Documents/FitTrack/README.md)
- [src/App.jsx](/Users/kp/Documents/FitTrack/src/App.jsx)
- [src/styles.css](/Users/kp/Documents/FitTrack/src/styles.css)
- [src/hooks/useFitTrackStore.js](/Users/kp/Documents/FitTrack/src/hooks/useFitTrackStore.js)
- [src/components/FoodLogSection.jsx](/Users/kp/Documents/FitTrack/src/components/FoodLogSection.jsx)
- [src/components/WorkoutSection.jsx](/Users/kp/Documents/FitTrack/src/components/WorkoutSection.jsx)
- [src/components/WeightSection.jsx](/Users/kp/Documents/FitTrack/src/components/WeightSection.jsx)
- [src/components/DashboardSection.jsx](/Users/kp/Documents/FitTrack/src/components/DashboardSection.jsx)
- [src/components/SettingsSection.jsx](/Users/kp/Documents/FitTrack/src/components/SettingsSection.jsx)

## 15. Practical Recovery Checklist If You Forget Everything

Use this exact sequence:

1. Open Terminal
2. `cd /Users/kp/Documents/FitTrack`
3. Run `git status`
4. Run `npm run dev` if you need to see the app locally
5. Open Codex in this project folder
6. Tell Codex:

```text
Please inspect this AI Fit project, summarize the current architecture, list any uncommitted changes, and help me continue working on it.
```

7. Ask Codex to make the next change
8. Ask Codex to run `npm run build`
9. Ask Codex to push when ready

## 16. Notes

This handbook is meant to be practical, not exhaustive. If anything is unclear later, use Codex to re-inspect the codebase and refresh the project state before making changes.
