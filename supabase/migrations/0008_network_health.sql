-- My Network redesign: real-data KPI overview + a single paginated/
-- searchable/filterable contacts query (used for the company-detail table,
-- the global search/filter results, the duplicates review view, AND a
-- campaign-audience count for a bulk "Add to Campaign" selection -- one
-- query, one dedup/tie-break rule, reused everywhere instead of four
-- slightly different ones). Also lets a campaign target an explicit set of
-- selected emails, alongside the existing contact_list_id/company_domain
-- scopes.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0007.

-- campaigns: a third audience scope, for "Add to Campaign" from a bulk
-- selection in My Network (alongside the existing contact_list_id /
-- company_domain scopes -- campaigns RLS is already user_id-scoped
-- directly, so no policy change needed).

alter table public.campaigns add column if not exists selected_contact_emails text[];

-- verification_jobs: a third scope, for "Verify Selected" on a bulk
-- selection in My Network (alongside the existing contact_list_id /
-- company_domain scopes from migration 0006). A bulk (>50 contact) job
-- needs the original email list on the row itself so a page reload can
-- resume polling and know which contacts to apply results to -- the list
-- and company scopes don't need this since they can be recomputed from
-- contact_list_id / company_domain alone.

alter table public.verification_jobs add column if not exists selected_emails text[];

-- Network-wide KPI overview, deduplicated by email across every list, with
-- the same "best status wins" tie-break get_network_domain_counts() uses
-- (migration 0006) so this page's totals always agree with the per-company
-- cards. duplicate_emails counts emails present in more than one of the
-- user's contact_lists.

create or replace function public.get_network_overview()
returns table (
  total_contacts bigint,
  companies bigint,
  deliverable bigint,
  undeliverable bigint,
  risky bigint,
  pending bigint,
  unsubscribed bigint,
  duplicate_emails bigint
)
language sql stable
security invoker
set search_path = public
as $$
  with matching as (
    select lower(trim(c.email)) as email,
           lower(split_part(c.email, '@', 2)) as domain,
           c.status, c.verified_at, c.created_at, c.contact_list_id
    from public.contacts c
    join public.contact_lists cl on cl.id = c.contact_list_id
    where cl.user_id = auth.uid()
  ),
  best as (
    select distinct on (email) email, domain, status
    from matching
    order by email, (status <> 'pending_verification') desc, verified_at desc nulls last, created_at desc
  ),
  dup_counts as (
    select email, count(distinct contact_list_id) as list_count
    from matching
    group by email
  )
  select
    count(*) as total_contacts,
    count(distinct domain) as companies,
    count(*) filter (where status = 'deliverable') as deliverable,
    count(*) filter (where status = 'undeliverable') as undeliverable,
    count(*) filter (where status = 'risky') as risky,
    count(*) filter (where status = 'pending_verification') as pending,
    count(*) filter (where status = 'unsubscribed') as unsubscribed,
    (select count(*) from dup_counts where list_count > 1) as duplicate_emails
  from best;
$$;

-- One paginated, filterable, deduplicated contacts query for every
-- "show me a page of contacts" need in My Network:
--   - p_domain set        -> one company's expandable contact table
--   - p_search/p_status   -> the global search bar + status filter tabs
--   - p_duplicates_only   -> the "Review Duplicates" recommended action
--   - p_emails            -> tallying a bulk-selection campaign's audience
-- total_count is the filtered row count (via a window function), so the
-- client can render "Showing 1-50 of 412" from the same query, no second
-- round trip -- and the browser only ever receives the current page.

create or replace function public.search_network_contacts(
  p_domain text default null,
  p_search text default null,
  p_status text default null,
  p_emails text[] default null,
  p_duplicates_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  email text,
  name text,
  company text,
  status text,
  verified_at timestamptz,
  list_names text[],
  list_count bigint,
  total_count bigint
)
language sql stable
security invoker
set search_path = public
as $$
  with matching as (
    select c.id, lower(trim(c.email)) as email, c.name, c.company, c.status,
           c.verified_at, c.created_at, cl.name as list_name, cl.id as list_id,
           lower(split_part(c.email, '@', 2)) as domain
    from public.contacts c
    join public.contact_lists cl on cl.id = c.contact_list_id
    where cl.user_id = auth.uid()
      and (p_domain is null or lower(split_part(c.email, '@', 2)) = lower(p_domain))
      and (p_emails is null or lower(trim(c.email)) = any(p_emails))
  ),
  best as (
    select distinct on (email) email, name, company, status, verified_at, domain
    from matching
    order by email, (status <> 'pending_verification') desc, verified_at desc nulls last, created_at desc
  ),
  lists as (
    select email,
           array_agg(distinct list_name order by list_name) as list_names,
           count(distinct list_id) as list_count
    from matching
    group by email
  ),
  filtered as (
    select b.email, b.name, b.company, b.status, b.verified_at,
           l.list_names, l.list_count
    from best b
    join lists l on l.email = b.email
    where (p_status is null or b.status = p_status)
      and (not p_duplicates_only or l.list_count > 1)
      and (
        p_search is null or p_search = '' or
        b.email ilike '%' || p_search || '%' or
        b.name ilike '%' || p_search || '%' or
        b.company ilike '%' || p_search || '%' or
        b.domain ilike '%' || p_search || '%'
      )
  )
  select email, name, company, status, verified_at, list_names, list_count,
         count(*) over() as total_count
  from filtered
  order by email
  limit p_limit offset p_offset;
$$;
