-- Adds last_verified_at to get_network_domain_counts() (migration 0006),
-- backing a "Last Verified" column and a "Verify" link on the My Network
-- overview table. Same "best per email" dedup this function already used,
-- just also returning the most recent verified_at across those rows.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0008.

create or replace function public.get_network_domain_counts()
returns table (
  domain text,
  total bigint,
  deliverable bigint,
  risky bigint,
  undeliverable bigint,
  pending bigint,
  unsubscribed bigint,
  last_verified_at timestamptz
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
    select distinct on (email) email, domain, status, verified_at
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
    count(*) filter (where status = 'unsubscribed') as unsubscribed,
    max(verified_at) as last_verified_at
  from best
  group by domain
  order by count(*) desc;
$$;
