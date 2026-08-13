-- Suppression List: distinguishes *why* an email is suppressed
-- (unsubscribe-link click vs. SES spam complaint), adds manual resubscribe
-- with an audit trail, and supports checking new uploads against the
-- suppression list before import.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0006.
--
-- Note: contacts.status = 'unsubscribed' already exists (migration 0004) and
-- is already distinct from 'undeliverable' -- that part of this feature was
-- already built. This migration adds *why* (reason), lets a user reverse it
-- (with logging), and nothing here changes how campaign sends already
-- exclude 'unsubscribed'/'undeliverable' contacts or anyone in
-- `unsubscribes` -- that exclusion was already airtight and untouched.

-- unsubscribes: record *why* a suppression happened -------------------------

alter table public.unsubscribes add column if not exists reason text not null default 'unsubscribe_link';
alter table public.unsubscribes drop constraint if exists unsubscribes_reason_check;
alter table public.unsubscribes add constraint unsubscribes_reason_check
  check (reason in ('unsubscribe_link', 'complaint'));

-- Resubscribe is a normal delete by the owning user (not the SECURITY
-- DEFINER unsubscribe_by_token path used by anonymous recipients), so it
-- needs an explicit RLS policy.
drop policy if exists "Users remove their own unsubscribes" on public.unsubscribes;
create policy "Users remove their own unsubscribes"
  on public.unsubscribes for delete
  using (user_id = auth.uid());

-- resubscribe_log: compliance audit trail for manual resubscribes -----------

create table if not exists public.resubscribe_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  performed_by uuid not null references auth.users(id),
  performed_at timestamptz not null default now(),
  original_reason text,
  original_unsubscribed_at timestamptz,
  original_campaign_id uuid
);

create index if not exists resubscribe_log_user_idx on public.resubscribe_log(user_id, performed_at desc);

alter table public.resubscribe_log enable row level security;

drop policy if exists "Users view their own resubscribe log" on public.resubscribe_log;
create policy "Users view their own resubscribe log"
  on public.resubscribe_log for select
  using (user_id = auth.uid());

drop policy if exists "Users log their own resubscribes" on public.resubscribe_log;
create policy "Users log their own resubscribes"
  on public.resubscribe_log for insert
  with check (user_id = auth.uid() and performed_by = auth.uid());

-- resubscribe_contact(): the only sanctioned way to reverse a suppression.
-- Deletes the unsubscribes row, reverts every matching contact back to
-- pending_verification (never straight back to deliverable -- it must be
-- re-verified before it can be mailed again), and writes an audit row in
-- the same transaction. SECURITY INVOKER: runs as the calling user, so RLS
-- (plus the explicit user_id filters below) already confines it to their
-- own data -- no elevated privilege needed since, unlike the public
-- unsubscribe-by-token link, only an authenticated owner can call this.

create or replace function public.resubscribe_contact(p_email text)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.unsubscribes%rowtype;
begin
  select * into v_row from public.unsubscribes
    where user_id = auth.uid() and email = v_email;

  if not found then
    raise exception 'This email is not on your suppression list.';
  end if;

  insert into public.resubscribe_log
    (user_id, email, performed_by, original_reason, original_unsubscribed_at, original_campaign_id)
  values
    (auth.uid(), v_email, auth.uid(), v_row.reason, v_row.unsubscribed_at, v_row.campaign_id);

  delete from public.unsubscribes where user_id = auth.uid() and email = v_email;

  update public.contacts
    set status = 'pending_verification'
    where email = v_email
      and contact_list_id in (
        select id from public.contact_lists where user_id = auth.uid()
      );
end;
$$;
