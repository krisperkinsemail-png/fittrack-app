# Restaurant Library Import

This project now supports a public `restaurant_library` table for cloud-backed restaurant search.

## 1. Apply schema

Run [schema.sql](/Users/kp/Documents/FitTrack/supabase/schema.sql) in the Supabase SQL Editor.

That adds:
- `public.restaurant_library`
- public read policy
- brand/item and search indexes
- normalized search support so punctuation differences like `mcdonalds` vs `McDonald's` still match
- trigram-based fuzzy search so near-miss queries like `burito` or `taco bel` can still return relevant items

## 2. Build the latest merged dataset

From the repo root:

```bash
python3 research/build_food_library_datasets.py
```

That regenerates:
- [food-library-merged.csv](/Users/kp/Documents/FitTrack/research/food-library-merged.csv)
- [restaurant-library.json](/Users/kp/Documents/FitTrack/public/restaurant-library.json)

## 3. Import to Supabase

### Option A: Dashboard CSV import

Use the Supabase Table Editor to import:
- table: `public.restaurant_library`
- file: [food-library-merged.csv](/Users/kp/Documents/FitTrack/research/food-library-merged.csv)

The CSV headers already match the table columns.

### Option B: Service-role sync script

Export env vars:

```bash
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Then run:

```bash
npm run sync:restaurants
```

This script:
- clears `public.restaurant_library`
- upserts the merged CSV in batches

Script path:
- [syncRestaurantLibrary.mjs](/Users/kp/Documents/FitTrack/scripts/syncRestaurantLibrary.mjs)

## 4. App behavior

When Supabase is configured:
- the `Restaraunts` library button queries `public.restaurant_library`

When Supabase is not configured:
- the app falls back to [restaurant-library.json](/Users/kp/Documents/FitTrack/public/restaurant-library.json)
