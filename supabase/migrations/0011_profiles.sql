-- Per-user profile info collected at signup (name, years of experience --
-- current company is represented by the org's own name in `organizations`,
-- not repeated here). Run this in the Supabase dashboard: SQL Editor -> New
-- query -> paste -> Run. Run AFTER 0002_organizations.sql.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  years_experience integer not null check (years_experience >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid());
