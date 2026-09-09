-- New organizations previously got a flat 10,000/10,000 quota on signup,
-- a leftover default from before Razorpay billing existed. Real quota
-- should come only from an active subscription (see
-- src/app/api/razorpay/webhook/route.ts, which already sets
-- plan_validation_quota/plan_send_quota to the purchased plan's contact
-- count on activation, and zeroes them on payment failure) -- there is no
-- free tier in pricingPlans.ts, so signup itself should grant nothing.
-- Run AFTER 0016_abuse_reports.sql.

alter table public.organizations
  alter column plan_validation_quota set default 0,
  alter column plan_send_quota set default 0;

-- Reset any existing organization that has no active subscription back to
-- zero -- it never should have received the old flat starter default.
update public.organizations o
set plan_validation_quota = 0, plan_send_quota = 0
where not exists (
  select 1 from public.subscriptions s
  where s.organization_id = o.id and s.status = 'active'
);

-- Membership-level quota is copied from the organization at creation time
-- (see get_or_create_organization()), so it must be corrected the same way
-- for memberships whose organization was just reset above.
update public.memberships m
set validation_quota = 0, send_quota = 0
where exists (
  select 1 from public.organizations o
  where o.id = m.organization_id
    and o.plan_validation_quota = 0
    and o.plan_send_quota = 0
);
