-- Multi-tenant organizations, memberships, invite links, and quota enforcement.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001_contacts_and_campaigns.sql.

-- organizations -----------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_validation_quota integer not null default 10000,
  plan_send_quota integer not null default 10000,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- memberships ---------------------------------------------------------------
-- One row per user (enforced by the unique constraint below): this app
-- supports exactly one organization per user, not multi-org membership.

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  validation_quota integer not null default 0,
  send_quota integer not null default 0,
  validation_used integer not null default 0,
  send_used integer not null default 0,
  quota_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  invited_at timestamptz,
  status text not null default 'invited' check (status in ('invited', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists memberships_org_idx on public.memberships(organization_id);

drop trigger if exists set_updated_at on public.memberships;
create trigger set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

alter table public.memberships enable row level security;

-- invites ---------------------------------------------------------------
-- App-generated invite links (no Supabase-managed invite email, no
-- service-role key needed). Admin creates a row, shares the link
-- containing `token` however they like.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists invites_org_idx on public.invites(organization_id);

alter table public.invites enable row level security;

-- contact_lists / campaigns: tag with organization_id for quota bookkeeping
-- and admin dashboards. Visibility RLS on these tables is unchanged -- they
-- stay private per-user even within an org (see is_org_admin usage below,
-- which is NOT applied to these tables).

alter table public.contact_lists add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.campaigns add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- Helper functions (SECURITY DEFINER to avoid RLS self-recursion) ----------

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
      and m.status = 'active'
  );
$$;

-- Returns membership + email for every member of an org. Callable by any
-- member, but only admins get every row -- a non-admin caller only ever
-- gets their own row back, even though the org-wide Team UI that calls
-- this is itself admin-gated at the page level.
create or replace function public.get_org_members(p_org_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  role text,
  status text,
  validation_quota integer,
  send_quota integer,
  validation_used integer,
  send_used integer,
  invited_at timestamptz,
  created_at timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select m.id, m.user_id, u.email::text, m.role, m.status,
         m.validation_quota, m.send_quota, m.validation_used, m.send_used,
         m.invited_at, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org_id
    and (
      public.is_org_admin(p_org_id)
      or m.user_id = auth.uid()
    )
  order by m.created_at asc;
$$;

-- Returns minimal, non-sensitive invite info for an unauthenticated
-- visitor landing on /invite/[token] -- safe because token is an
-- unguessable random string, not enumerable.
create or replace function public.get_invite_info(p_token text)
returns table (organization_name text, email text, status text)
language sql security definer stable
set search_path = public
as $$
  select o.name, i.email, i.status
  from public.invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
    and i.expires_at > now();
$$;

-- Creates the caller's own membership from a pending invite token. Only
-- ever inserts a row for auth.uid() (the calling, now-authenticated user)
-- -- never an arbitrary user -- so this is safe to expose without a
-- separate RLS insert policy covering it.
create or replace function public.accept_invite(p_token text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    return; -- already has a membership; nothing to do (idempotent)
  end if;

  select * into v_invite from public.invites
    where token = p_token and status = 'pending' and expires_at > now()
    for update;

  if not found then
    raise exception 'Invite is invalid, expired, or already used.';
  end if;

  insert into public.memberships (organization_id, user_id, role, status, invited_at)
  values (v_invite.organization_id, auth.uid(), 'member', 'active', v_invite.created_at);

  update public.invites set status = 'accepted' where id = v_invite.id;
end;
$$;

-- Creates a brand-new organization with the caller as its admin. Only
-- ever creates a membership for auth.uid(); no-ops if one already exists.
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_org_id uuid;
begin
  select organization_id into v_existing from public.memberships where user_id = auth.uid();
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.organizations (name, owner_id)
  values (p_name, auth.uid())
  returning id into v_org_id;

  insert into public.memberships (
    organization_id, user_id, role, status, invited_at,
    validation_quota, send_quota
  )
  select v_org_id, auth.uid(), 'admin', 'active', now(),
         plan_validation_quota, plan_send_quota
  from public.organizations where id = v_org_id;

  return v_org_id;
end;
$$;

-- Atomically checks and consumes quota for the calling user. Locks the
-- membership row so concurrent verification/send attempts can't both pass
-- the check before either increments (classic check-then-act race).
create or replace function public.try_consume_quota(p_kind text, p_amount integer)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_membership record;
  v_org record;
  v_org_used bigint;
begin
  if p_kind not in ('validation', 'send') then
    raise exception 'invalid quota kind: %', p_kind;
  end if;

  select * into v_membership from public.memberships
    where user_id = auth.uid() and status = 'active'
    for update;

  if not found then
    return false; -- not part of an organization; caller should treat as blocked
  end if;

  select * into v_org from public.organizations where id = v_membership.organization_id;

  if p_kind = 'validation' then
    if v_membership.validation_used + p_amount > v_membership.validation_quota then
      return false;
    end if;
    select coalesce(sum(validation_used), 0) into v_org_used
      from public.memberships where organization_id = v_org.id;
    if v_org_used + p_amount > v_org.plan_validation_quota then
      return false;
    end if;
    update public.memberships set validation_used = validation_used + p_amount where id = v_membership.id;
  else
    if v_membership.send_used + p_amount > v_membership.send_quota then
      return false;
    end if;
    select coalesce(sum(send_used), 0) into v_org_used
      from public.memberships where organization_id = v_org.id;
    if v_org_used + p_amount > v_org.plan_send_quota then
      return false;
    end if;
    update public.memberships set send_used = send_used + p_amount where id = v_membership.id;
  end if;

  return true;
end;
$$;

-- Resets usage for any membership whose reset date has passed. Safe to
-- call repeatedly/frequently (e.g. from a daily cron) -- only rows that
-- are actually due get touched.
--
-- Unlike every other function above, this one is NOT scoped to auth.uid()
-- -- it operates across every organization unconditionally. If it were
-- left callable via PostgREST with the public anon key (the default for
-- any function), anyone could call it directly through Supabase's REST
-- API and reset every customer's usage early, bypassing quota
-- enforcement. Revoke public execute so only the service role (used
-- narrowly by the cron route, never exposed to the browser) can call it.
create or replace function public.reset_due_quotas()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.memberships
    set validation_used = 0,
        send_used = 0,
        quota_reset_at = quota_reset_at + interval '1 month'
    where quota_reset_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reset_due_quotas() from public, anon, authenticated;

-- RLS policies --------------------------------------------------------------

drop policy if exists "Members can view their organization" on public.organizations;
create policy "Members can view their organization"
  on public.organizations for select
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  ));

drop policy if exists "Admins can update their organization" on public.organizations;
create policy "Admins can update their organization"
  on public.organizations for update
  using (owner_id = auth.uid() or public.is_org_admin(id))
  with check (owner_id = auth.uid() or public.is_org_admin(id));

-- No direct insert policy: organizations are created via the
-- create_organization() SECURITY DEFINER function above, not directly
-- by clients, so row creation stays paired with the admin membership.

drop policy if exists "Members can view their own membership or admins view all" on public.memberships;
create policy "Members can view their own membership or admins view all"
  on public.memberships for select
  using (user_id = auth.uid() or public.is_org_admin(organization_id));

drop policy if exists "Admins can update memberships in their org" on public.memberships;
create policy "Admins can update memberships in their org"
  on public.memberships for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Admins can remove members (not themselves)" on public.memberships;
create policy "Admins can remove members (not themselves)"
  on public.memberships for delete
  using (public.is_org_admin(organization_id) and user_id <> auth.uid());

-- No direct insert policy: membership rows are only ever created via the
-- create_organization() / accept_invite() SECURITY DEFINER functions,
-- which are careful to only ever insert a row for the calling user.

drop policy if exists "Admins manage invites for their org" on public.invites;
create policy "Admins manage invites for their org"
  on public.invites for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Backfill: give any existing user who already owns contact lists (i.e.
-- signed up before organizations existed) a personal organization so
-- quota enforcement and the Team page work for them too.
do $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  for v_user_id in
    select distinct user_id from public.contact_lists
    where user_id is not null
      and not exists (select 1 from public.memberships m where m.user_id = contact_lists.user_id)
  loop
    insert into public.organizations (name, owner_id)
    values ('My Organization', v_user_id)
    returning id into v_org_id;

    insert into public.memberships (
      organization_id, user_id, role, status, invited_at,
      validation_quota, send_quota
    )
    values (v_org_id, v_user_id, 'admin', 'active', now(), 10000, 10000);

    update public.contact_lists set organization_id = v_org_id where user_id = v_user_id;
    update public.campaigns set organization_id = v_org_id where user_id = v_user_id;
  end loop;
end $$;
