-- Razorpay subscription tracking, one row per organization. Run this in the
-- Supabase dashboard: SQL Editor -> New query -> paste -> Run. Run AFTER
-- 0002_organizations.sql.
--
-- Status and plan_id are only ever written by the Razorpay webhook (via the
-- service-role client), never trusted from a client-reported "payment
-- succeeded" signal -- see src/app/api/razorpay/webhook/route.ts. The one
-- exception is the initial row inserted by startSubscription() right after
-- creating the Razorpay subscription (status 'created', before any money has
-- moved), so the webhook has something to match against by
-- razorpay_subscription_id.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'growth', 'pro', 'scale')),
  -- Which prepay term the plan was subscribed under (monthly / 6month /
  -- 12month) -- see BillingTerm in src/lib/pricingPlans.ts. Doesn't affect
  -- quota (that's plan_id only), just billing frequency/amount and display.
  term_id text not null default 'monthly' check (term_id in ('monthly', '6month', '12month')),
  razorpay_subscription_id text not null unique,
  status text not null default 'created' check (
    status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')
  ),
  current_start timestamptz,
  current_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_org" on public.subscriptions
  for select using (
    organization_id in (select organization_id from public.memberships where user_id = auth.uid())
  );

-- Lets an org admin create/update their own org's subscription row via the
-- normal (RLS-respecting) client from the billing Server Actions. The
-- webhook route uses the service-role client instead, which bypasses RLS
-- entirely, so this policy doesn't need to (and shouldn't) cover it.
create policy "subscriptions_admin_write" on public.subscriptions
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and role = 'admin'
    )
  );
