-- Referral program: every user gets a permanent unique referral code;
-- entering someone else's code at signup permanently links the two
-- accounts; the referrer earns a one-time Starter-level quota bonus
-- (3,500 validations + 3,500 sends for the current billing cycle only)
-- the first time the referred account's first-ever successful payment is
-- for Growth, Pro, or Scale (never Starter, never a renewal/upgrade/
-- downgrade -- see evaluate_referral_reward() below for the exact rules).
-- Run AFTER 0018_account_type.sql.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own" on public.referral_codes
  for select using (user_id = auth.uid());

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referred_organization_id uuid references public.organizations(id) on delete set null,
  -- pending: referred user signed up, hasn't had a qualifying payment yet.
  -- rewarded: first payment qualified (Growth/Pro/Scale), bonus granted.
  -- ineligible: first payment was Starter -- permanently disqualified,
  --   since only the FIRST payment ever counts (rule: an upgrade later
  --   doesn't generate a reward either).
  -- reversed: the qualifying payment was refunded/charged back after
  --   reward was granted.
  status text not null default 'pending'
    check (status in ('pending', 'rewarded', 'ineligible', 'reversed')),
  qualifying_plan_id text,
  reward_validation_amount integer,
  reward_send_amount integer,
  reward_granted_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals
  for select using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

-- Whether this organization has EVER had a subscription reach active
-- status, regardless of plan or which subscription row -- this, not
-- "does a referrals row still say pending", is what "first successful
-- payment" means. Without it, cancelling and resubscribing later (or a
-- second subscription object after a failed one) would look like a fresh
-- "first payment" and could double-grant or wrongly re-evaluate a reward.
alter table public.organizations add column if not exists has_ever_paid boolean not null default false;

-- Tracks exactly how much of a membership's current validation_quota/
-- send_quota is a temporary referral bonus, so reset_due_quotas() can
-- remove precisely that amount (and nothing else) at the membership's
-- next reset -- see the updated function below.
alter table public.memberships add column if not exists bonus_validation_quota integer not null default 0;
alter table public.memberships add column if not exists bonus_send_quota integer not null default 0;

-- Idempotent: returns the caller's existing code if they already have
-- one, otherwise generates and stores a new one. Called lazily wherever
-- a user's code needs to be shown (see /account), not at signup time --
-- every user gets one eventually, not just those who filled the full
-- signup form.
create or replace function public.ensure_referral_code()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_code text;
  v_existing text;
begin
  select code into v_existing from public.referral_codes where user_id = auth.uid();
  if v_existing is not null then
    return v_existing;
  end if;

  loop
    v_code := 'CM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into public.referral_codes (user_id, code) values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      -- Collision on the random suffix -- vanishingly rare, just retry.
    end;
  end loop;
end;
$$;

-- Records a referral relationship at signup time. Silently no-ops on an
-- invalid code, self-referral, or if this user already has a referral row
-- (the unique constraint on referred_user_id makes the relationship
-- permanent and one-shot) -- signup must never fail because of a bad
-- referral code.
create or replace function public.record_referral(p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_referrer_user_id uuid;
  v_org_id uuid;
begin
  select user_id into v_referrer_user_id from public.referral_codes where code = p_code;
  if v_referrer_user_id is null or v_referrer_user_id = auth.uid() then
    return;
  end if;

  select organization_id into v_org_id from public.memberships where user_id = auth.uid();

  insert into public.referrals (referrer_user_id, referred_user_id, referred_organization_id)
  values (v_referrer_user_id, auth.uid(), v_org_id)
  on conflict (referred_user_id) do nothing;
end;
$$;

-- Called only from the Razorpay webhook (service role), only on
-- subscription.activated -- the one event that fires exactly once per
-- subscription's entire lifetime, at true first activation (upgrades and
-- downgrades update the same subscription and fire subscription.updated
-- instead; renewals fire subscription.charged) -- never on a client
-- request, so this can't be triggered by anything other than a real
-- Razorpay-confirmed first charge.
create or replace function public.evaluate_referral_reward(
  p_organization_id uuid,
  p_plan_id text,
  p_reward_contacts integer
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_already_paid boolean;
  v_referred_user_id uuid;
  v_referral record;
begin
  select has_ever_paid, owner_id into v_already_paid, v_referred_user_id
    from public.organizations where id = p_organization_id;

  -- Mark paid regardless of outcome below -- this is what makes every
  -- later payment (renewal, upgrade, a resubscribe after cancelling) NOT
  -- a "first payment" going forward, whether or not this one qualified.
  update public.organizations set has_ever_paid = true where id = p_organization_id;

  if v_already_paid then
    return;
  end if;

  select * into v_referral
    from public.referrals
    where referred_user_id = v_referred_user_id and status = 'pending'
    for update;

  if not found then
    return; -- this org's owner was never referred, or it's already resolved
  end if;

  if p_plan_id = 'starter' then
    update public.referrals set status = 'ineligible' where id = v_referral.id;
    return;
  end if;

  update public.memberships
    set validation_quota = validation_quota + p_reward_contacts,
        send_quota = send_quota + p_reward_contacts,
        bonus_validation_quota = bonus_validation_quota + p_reward_contacts,
        bonus_send_quota = bonus_send_quota + p_reward_contacts
    where user_id = v_referral.referrer_user_id and status = 'active';

  update public.organizations o
    set plan_validation_quota = plan_validation_quota + p_reward_contacts,
        plan_send_quota = plan_send_quota + p_reward_contacts
    from public.memberships m
    where m.user_id = v_referral.referrer_user_id
      and m.status = 'active'
      and m.organization_id = o.id;

  update public.referrals
    set status = 'rewarded',
        qualifying_plan_id = p_plan_id,
        reward_validation_amount = p_reward_contacts,
        reward_send_amount = p_reward_contacts,
        reward_granted_at = now()
    where id = v_referral.id;
end;
$$;

revoke execute on function public.evaluate_referral_reward(uuid, text, integer) from public, anon, authenticated;

-- Reverses a still-outstanding reward if the qualifying payment is later
-- refunded/charged back (see src/app/api/razorpay/webhook/route.ts,
-- refund/dispute handling). No-ops if the reward was already cleared by a
-- normal monthly reset in the meantime -- the bonus already did its job
-- for that cycle, there's nothing left to claw back.
create or replace function public.reverse_referral_reward(p_organization_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_referred_user_id uuid;
  v_referral record;
begin
  select owner_id into v_referred_user_id from public.organizations where id = p_organization_id;

  select * into v_referral
    from public.referrals
    where referred_user_id = v_referred_user_id and status = 'rewarded'
    for update;

  if not found then
    return;
  end if;

  update public.memberships
    set validation_quota = greatest(0, validation_quota - coalesce(v_referral.reward_validation_amount, 0)),
        send_quota = greatest(0, send_quota - coalesce(v_referral.reward_send_amount, 0)),
        bonus_validation_quota = greatest(0, bonus_validation_quota - coalesce(v_referral.reward_validation_amount, 0)),
        bonus_send_quota = greatest(0, bonus_send_quota - coalesce(v_referral.reward_send_amount, 0))
    where user_id = v_referral.referrer_user_id and status = 'active';

  update public.organizations o
    set plan_validation_quota = greatest(0, plan_validation_quota - coalesce(v_referral.reward_validation_amount, 0)),
        plan_send_quota = greatest(0, plan_send_quota - coalesce(v_referral.reward_send_amount, 0))
    from public.memberships m
    where m.user_id = v_referral.referrer_user_id
      and m.status = 'active'
      and m.organization_id = o.id;

  update public.referrals
    set status = 'reversed', reversed_at = now()
    where id = v_referral.id;
end;
$$;

revoke execute on function public.reverse_referral_reward(uuid) from public, anon, authenticated;

-- Re-created to also remove exactly the outstanding referral bonus (both
-- from the membership and its organization's pool) at the same moment
-- its normal usage resets -- a one-time bonus should not persist past the
-- one billing cycle it was granted for. Captures the due set first in a
-- temp table since the organizations update needs to see bonus amounts
-- that the memberships update is about to zero out.
create or replace function public.reset_due_quotas()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  create temporary table _due_memberships on commit drop as
    select id, organization_id, bonus_validation_quota, bonus_send_quota
    from public.memberships
    where quota_reset_at <= now();

  update public.organizations o
    set plan_validation_quota = greatest(0, plan_validation_quota - d.bonus_validation_quota),
        plan_send_quota = greatest(0, plan_send_quota - d.bonus_send_quota)
    from _due_memberships d
    where d.organization_id = o.id
      and (d.bonus_validation_quota > 0 or d.bonus_send_quota > 0);

  update public.memberships m
    set validation_used = 0,
        send_used = 0,
        validation_quota = greatest(0, validation_quota - d.bonus_validation_quota),
        send_quota = greatest(0, send_quota - d.bonus_send_quota),
        bonus_validation_quota = 0,
        bonus_send_quota = 0,
        quota_reset_at = quota_reset_at + interval '1 month'
    from _due_memberships d
    where m.id = d.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reset_due_quotas() from public, anon, authenticated;
