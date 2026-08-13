-- Campaign compose + send: content fields, send jobs, per-recipient
-- tracking, and org/user-wide unsubscribe suppression.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001, 0002, 0003.

-- campaigns: compose content + broader status lifecycle -------------------

alter table public.campaigns add column if not exists subject text;
alter table public.campaigns add column if not exists body text;
alter table public.campaigns add column if not exists reply_to text;
alter table public.campaigns add column if not exists sent_at timestamptz;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check
  check (status in ('draft', 'sending', 'sent', 'failed'));

-- contacts: allow an 'unsubscribed' status for display ---------------------

alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts add constraint contacts_status_check
  check (status in ('pending_verification', 'deliverable', 'risky', 'undeliverable', 'unsubscribed'));

-- unsubscribes ---------------------------------------------------------
-- Authoritative suppression list, scoped per sending user (not per list or
-- per campaign) so an unsubscribe excludes that email from every future
-- campaign the same customer sends, regardless of which list it's on.

create table if not exists public.unsubscribes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  unsubscribed_at timestamptz not null default now(),
  unique (user_id, email)
);

create index if not exists unsubscribes_user_email_idx on public.unsubscribes(user_id, email);

alter table public.unsubscribes enable row level security;

drop policy if exists "Users view their own unsubscribes" on public.unsubscribes;
create policy "Users view their own unsubscribes"
  on public.unsubscribes for select
  using (user_id = auth.uid());

-- No insert/update/delete policy for normal clients: rows are only ever
-- created via the unsubscribe_by_token() SECURITY DEFINER function below,
-- reachable by an unauthenticated recipient clicking an email link.

-- send_jobs -----------------------------------------------------------------

create table if not exists public.send_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  total_recipients integer not null default 0,
  processed_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists send_jobs_campaign_idx on public.send_jobs(campaign_id);

drop trigger if exists set_updated_at on public.send_jobs;
create trigger set_updated_at
  before update on public.send_jobs
  for each row execute function public.set_updated_at();

alter table public.send_jobs enable row level security;

drop policy if exists "Users manage send jobs for their own campaigns" on public.send_jobs;
create policy "Users manage send jobs for their own campaigns"
  on public.send_jobs for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = send_jobs.campaign_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.campaigns c
    where c.id = send_jobs.campaign_id and c.user_id = auth.uid()
  ));

-- campaign_recipients ---------------------------------------------------
-- One row per contact targeted by a campaign send; unsubscribe_token backs
-- the public /unsubscribe/[token] link embedded in that specific email.

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  send_job_id uuid not null references public.send_jobs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped_unsubscribed')),
  error_message text,
  ses_message_id text,
  unsubscribe_token text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists campaign_recipients_job_idx on public.campaign_recipients(send_job_id, status);
create index if not exists campaign_recipients_campaign_idx on public.campaign_recipients(campaign_id);

alter table public.campaign_recipients enable row level security;

drop policy if exists "Users manage recipients for their own campaigns" on public.campaign_recipients;
create policy "Users manage recipients for their own campaigns"
  on public.campaign_recipients for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = campaign_recipients.campaign_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.campaigns c
    where c.id = campaign_recipients.campaign_id and c.user_id = auth.uid()
  ));

-- Public, token-scoped unsubscribe -------------------------------------
-- Called by an unauthenticated recipient clicking the link in their email.
-- Safe to expose because the token is an unguessable random string minted
-- per recipient per send, not enumerable, and this function only ever acts
-- on the single (user_id, email) pair that token names.

create or replace function public.unsubscribe_by_token(p_token text)
returns table (email text, already_unsubscribed boolean)
language plpgsql security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_user_id uuid;
  v_already boolean;
begin
  select cr.*, c.user_id as campaign_user_id
    into v_recipient
    from public.campaign_recipients cr
    join public.campaigns c on c.id = cr.campaign_id
    where cr.unsubscribe_token = p_token;

  if not found then
    raise exception 'Invalid unsubscribe link.';
  end if;

  v_user_id := v_recipient.campaign_user_id;

  select exists(
    select 1 from public.unsubscribes u
    where u.user_id = v_user_id and u.email = lower(v_recipient.email)
  ) into v_already;

  insert into public.unsubscribes (user_id, email, campaign_id)
  values (v_user_id, lower(v_recipient.email), v_recipient.campaign_id)
  on conflict (user_id, email) do nothing;

  update public.contacts
    set status = 'unsubscribed'
    where email = lower(v_recipient.email)
      and contact_list_id in (
        select id from public.contact_lists where user_id = v_user_id
      );

  return query select v_recipient.email, v_already;
end;
$$;
