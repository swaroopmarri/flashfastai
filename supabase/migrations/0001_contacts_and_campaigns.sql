-- Contact lists, contacts, email verification jobs, and a minimal campaigns table.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- contact_lists ---------------------------------------------------------

create table if not exists public.contact_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_lists_user_id_idx on public.contact_lists(user_id);

drop trigger if exists set_updated_at on public.contact_lists;
create trigger set_updated_at
  before update on public.contact_lists
  for each row execute function public.set_updated_at();

alter table public.contact_lists enable row level security;

drop policy if exists "Users manage their own contact lists" on public.contact_lists;
create policy "Users manage their own contact lists"
  on public.contact_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- contacts ----------------------------------------------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  contact_list_id uuid not null references public.contact_lists(id) on delete cascade,
  email text not null,
  name text,
  company text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'deliverable', 'risky', 'undeliverable')),
  zerobounce_sub_status text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Application code always normalizes email to lowercase before writing,
-- so a plain unique constraint (rather than an expression index) works and
-- lets Supabase's upsert(..., { onConflict: "contact_list_id,email" }) target it.
alter table public.contacts
  drop constraint if exists contacts_list_email_unique;
alter table public.contacts
  add constraint contacts_list_email_unique unique (contact_list_id, email);

create index if not exists contacts_list_status_idx on public.contacts(contact_list_id, status);

drop trigger if exists set_updated_at on public.contacts;
create trigger set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

drop policy if exists "Users manage contacts in their own lists" on public.contacts;
create policy "Users manage contacts in their own lists"
  on public.contacts for all
  using (exists (
    select 1 from public.contact_lists cl
    where cl.id = contacts.contact_list_id and cl.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.contact_lists cl
    where cl.id = contacts.contact_list_id and cl.user_id = auth.uid()
  ));

-- verification_jobs --------------------------------------------------------

create table if not exists public.verification_jobs (
  id uuid primary key default gen_random_uuid(),
  contact_list_id uuid not null references public.contact_lists(id) on delete cascade,
  mode text not null check (mode in ('single', 'bulk')),
  zerobounce_file_id text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  total_contacts integer not null default 0,
  processed_contacts integer not null default 0,
  deliverable_count integer not null default 0,
  risky_count integer not null default 0,
  undeliverable_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_jobs_list_idx on public.verification_jobs(contact_list_id);

drop trigger if exists set_updated_at on public.verification_jobs;
create trigger set_updated_at
  before update on public.verification_jobs
  for each row execute function public.set_updated_at();

alter table public.verification_jobs enable row level security;

drop policy if exists "Users manage verification jobs for their own lists" on public.verification_jobs;
create policy "Users manage verification jobs for their own lists"
  on public.verification_jobs for all
  using (exists (
    select 1 from public.contact_lists cl
    where cl.id = verification_jobs.contact_list_id and cl.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.contact_lists cl
    where cl.id = verification_jobs.contact_list_id and cl.user_id = auth.uid()
  ));

-- campaigns (minimal shell; Audience step only for now) --------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_list_id uuid references public.contact_lists(id) on delete set null,
  include_risky boolean not null default false,
  status text not null default 'draft' check (status in ('draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_user_id_idx on public.campaigns(user_id);

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

drop policy if exists "Users manage their own campaigns" on public.campaigns;
create policy "Users manage their own campaigns"
  on public.campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
