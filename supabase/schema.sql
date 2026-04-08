create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  calorie_target integer not null default 2200,
  protein_target integer not null default 180,
  carbs_target integer not null default 220,
  fat_target integer not null default 70,
  macro_target_mode text not null default 'grams',
  protein_percent integer not null default 35,
  carbs_percent integer not null default 40,
  fat_percent integer not null default 25,
  weight_goal numeric,
  weight_unit text not null default 'lb',
  accent_color text not null default 'blue',
  last_selected_workout_program_id text,
  updated_at timestamptz not null default now()
);

alter table public.settings
  add column if not exists last_selected_workout_program_id text;

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  food_name text not null,
  serving_size text not null,
  calories integer not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template_type text not null default 'meal',
  serving_size text not null,
  calories integer not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.workout_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  system_id text,
  system_name text,
  workout_id text,
  workout_name text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_workout_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_custom boolean not null default true,
  workouts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_library (
  id text primary key,
  brand text not null,
  item_name text not null,
  category text,
  description text,
  serving_amount numeric,
  serving_unit text,
  serving_label text,
  calories integer not null,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  protein_g numeric not null default 0,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  cholesterol_mg numeric,
  potassium_mg numeric,
  source_type text not null,
  source_date text,
  source_detail text,
  source_url text,
  region text not null default 'US',
  is_manual_override boolean not null default false,
  search_text text generated always as (
    lower(
      coalesce(brand, '') || ' ' ||
      coalesce(item_name, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(serving_label, '')
    )
  ) stored,
  normalized_search_text text generated always as (
    trim(
      regexp_replace(
        lower(
          replace(
            replace(
              replace(
                replace(
                  coalesce(brand, '') || ' ' ||
                  coalesce(item_name, '') || ' ' ||
                  coalesce(category, '') || ' ' ||
                  coalesce(description, '') || ' ' ||
                  coalesce(serving_label, ''),
                  '''',
                  ''
                ),
                '’',
                ''
              ),
              '`',
              ''
            ),
            '"',
            ''
          )
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    )
  ) stored
);

create index if not exists food_entries_user_id_date_idx on public.food_entries(user_id, date);
create index if not exists meal_templates_user_id_idx on public.meal_templates(user_id);
create index if not exists weight_entries_user_id_date_idx on public.weight_entries(user_id, date);
create index if not exists workout_entries_user_id_date_idx on public.workout_entries(user_id, date);
create index if not exists custom_workout_systems_user_id_idx on public.custom_workout_systems(user_id);
create index if not exists restaurant_library_brand_item_idx on public.restaurant_library(brand, item_name);
create index if not exists restaurant_library_search_text_idx on public.restaurant_library(search_text);
create index if not exists restaurant_library_normalized_search_text_idx on public.restaurant_library(normalized_search_text);
create index if not exists restaurant_library_normalized_search_trgm_idx on public.restaurant_library using gin (normalized_search_text gin_trgm_ops);

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.food_entries enable row level security;
alter table public.meal_templates enable row level security;
alter table public.weight_entries enable row level security;
alter table public.workout_entries enable row level security;
alter table public.custom_workout_systems enable row level security;
alter table public.restaurant_library enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id);
create policy "settings_delete_own" on public.settings for delete using (auth.uid() = user_id);

create policy "food_entries_select_own" on public.food_entries for select using (auth.uid() = user_id);
create policy "food_entries_insert_own" on public.food_entries for insert with check (auth.uid() = user_id);
create policy "food_entries_update_own" on public.food_entries for update using (auth.uid() = user_id);
create policy "food_entries_delete_own" on public.food_entries for delete using (auth.uid() = user_id);

create policy "meal_templates_select_own" on public.meal_templates for select using (auth.uid() = user_id);
create policy "meal_templates_insert_own" on public.meal_templates for insert with check (auth.uid() = user_id);
create policy "meal_templates_update_own" on public.meal_templates for update using (auth.uid() = user_id);
create policy "meal_templates_delete_own" on public.meal_templates for delete using (auth.uid() = user_id);

create policy "weight_entries_select_own" on public.weight_entries for select using (auth.uid() = user_id);
create policy "weight_entries_insert_own" on public.weight_entries for insert with check (auth.uid() = user_id);
create policy "weight_entries_update_own" on public.weight_entries for update using (auth.uid() = user_id);
create policy "weight_entries_delete_own" on public.weight_entries for delete using (auth.uid() = user_id);

create policy "workout_entries_select_own" on public.workout_entries for select using (auth.uid() = user_id);
create policy "workout_entries_insert_own" on public.workout_entries for insert with check (auth.uid() = user_id);
create policy "workout_entries_update_own" on public.workout_entries for update using (auth.uid() = user_id);
create policy "workout_entries_delete_own" on public.workout_entries for delete using (auth.uid() = user_id);

create policy "custom_workout_systems_select_own" on public.custom_workout_systems for select using (auth.uid() = user_id);
create policy "custom_workout_systems_insert_own" on public.custom_workout_systems for insert with check (auth.uid() = user_id);
create policy "custom_workout_systems_update_own" on public.custom_workout_systems for update using (auth.uid() = user_id);
create policy "custom_workout_systems_delete_own" on public.custom_workout_systems for delete using (auth.uid() = user_id);

create policy "restaurant_library_public_read" on public.restaurant_library for select using (true);

create or replace function public.search_restaurant_library(search_query text, result_limit integer default 120)
returns setof public.restaurant_library
language sql
stable
as $$
  select *
  from public.restaurant_library
  where normalized_search_text % search_query
     or similarity(normalized_search_text, search_query) >= 0.18
  order by
    case when normalized_search_text like '%' || search_query || '%' then 1 else 0 end desc,
    greatest(
      similarity(normalized_search_text, search_query),
      word_similarity(normalized_search_text, search_query)
    ) desc,
    brand asc,
    item_name asc
  limit greatest(1, least(result_limit, 200));
$$;
