-- "My Network": groups a user's contacts by email domain across every
-- contact list they own, deduplicated by lowercased/trimmed email. Also
-- extends verification_jobs and campaigns so a verification run or a
-- campaign can target "this domain across all my lists" instead of only
-- "this one list" -- the same job/campaign machinery already built, just
-- no longer hard-tied to a single contact_list_id.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0005.

-- verification_jobs: decouple ownership from requiring a list -------------

alter table public.verification_jobs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.verification_jobs alter column contact_list_id drop not null;
alter table public.verification_jobs add column if not exists company_domain text;

update public.verification_jobs vj
set user_id = cl.user_id
from public.contact_lists cl
where vj.contact_list_id = cl.id and vj.user_id is null;

alter table public.verification_jobs alter column user_id set not null;

drop policy if exists "Users manage verification jobs for their own lists" on public.verification_jobs;
drop policy if exists "Users manage their own verification jobs" on public.verification_jobs;
create policy "Users manage their own verification jobs"
  on public.verification_jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- campaigns: allow a domain-scoped audience instead of one list -----------

alter table public.campaigns alter column contact_list_id drop not null;
alter table public.campaigns add column if not exists company_domain text;
-- (campaigns RLS already checks user_id = auth.uid() directly, not via a
-- contact_lists join, so no policy change needed here.)

-- Company (domain) counts, deduplicated by email, "best" status per email
-- picked as: verified beats pending, then most recently verified/created.
-- This is the same tie-break the detail function below uses, so the
-- overview card and the detail page always agree.

create or replace function public.get_network_domain_counts()
returns table (
  domain text,
  total bigint,
  deliverable bigint,
  risky bigint,
  undeliverable bigint,
  pending bigint,
  unsubscribed bigint
)
language sql stable
security invoker
set search_path = public
as $$
  with matching as (
    select lower(trim(c.email)) as email,
           lower(split_part(c.email, '@', 2)) as domain,
           c.status, c.verified_at, c.created_at
    from public.contacts c
    join public.contact_lists cl on cl.id = c.contact_list_id
    where cl.user_id = auth.uid()
  ),
  best as (
    select distinct on (email) email, domain, status
    from matching
    order by email, (status <> 'pending_verification') desc, verified_at desc nulls last, created_at desc
  )
  select
    domain,
    count(*) as total,
    count(*) filter (where status = 'deliverable') as deliverable,
    count(*) filter (where status = 'risky') as risky,
    count(*) filter (where status = 'undeliverable') as undeliverable,
    count(*) filter (where status = 'pending_verification') as pending,
    count(*) filter (where status = 'unsubscribed') as unsubscribed
  from best
  group by domain
  order by count(*) desc;
$$;

-- Company detail: one row per unique email, with every list it appears in.

create or replace function public.get_network_domain_contacts(p_domain text)
returns table (
  email text,
  name text,
  company text,
  status text,
  list_names text[]
)
language sql stable
security invoker
set search_path = public
as $$
  with matching as (
    select c.id, lower(trim(c.email)) as email, c.name, c.company, c.status,
           c.verified_at, c.created_at, cl.name as list_name
    from public.contacts c
    join public.contact_lists cl on cl.id = c.contact_list_id
    where cl.user_id = auth.uid()
      and lower(split_part(c.email, '@', 2)) = lower(p_domain)
  ),
  best as (
    select distinct on (email) email, name, company, status
    from matching
    order by email, (status <> 'pending_verification') desc, verified_at desc nulls last, created_at desc
  ),
  lists as (
    select email, array_agg(distinct list_name order by list_name) as list_names
    from matching
    group by email
  )
  select b.email, b.name, b.company, b.status, l.list_names
  from best b
  join lists l on l.email = b.email
  order by b.email;
$$;
