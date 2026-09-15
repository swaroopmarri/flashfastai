-- Fixes a real bug: granting quota to an organization (via the owner's
-- manual override in src/app/(app)/owner/actions.ts, or the Razorpay
-- webhook's real quota-provisioning in
-- src/app/api/razorpay/webhook/route.ts) only ever updated
-- organizations.plan_validation_quota/plan_send_quota -- the org-wide pool
-- cap. But try_consume_quota() checks the MEMBERSHIP-level quota first
-- (see 0002_organizations.sql), and that's also what the customer's own
-- dashboard displays. Membership quota was previously only ever set once,
-- at org creation (create_organization() in 0018_account_type.sql) -- so a
-- later quota change (a real subscription, an upgrade, a manual comp) never
-- reached the customer's actual usable limit. This was masked before
-- 0017_no_free_signup_quota.sql removed the old flat 10,000 default that
-- every membership started with; now it fully blocks paid usage.
--
-- For a company account with more than one active member, the admin
-- deliberately splits the shared pool across members (see
-- updateMemberQuota() in src/app/(app)/team/actions.ts) -- auto-syncing
-- would clobber that manual allocation, so this function only acts when
-- there is exactly one active membership (every individual account, and
-- every company account before its admin has invited anyone).
-- Run AFTER 0019_referral_program.sql.

create or replace function public.sync_solo_membership_quota(p_organization_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_org record;
  v_member_count integer;
begin
  select plan_validation_quota, plan_send_quota into v_org
    from public.organizations where id = p_organization_id;

  if not found then
    return;
  end if;

  select count(*) into v_member_count
    from public.memberships
    where organization_id = p_organization_id and status = 'active';

  if v_member_count <> 1 then
    return;
  end if;

  update public.memberships
    set validation_quota = v_org.plan_validation_quota,
        send_quota = v_org.plan_send_quota
    where organization_id = p_organization_id and status = 'active';
end;
$$;

revoke execute on function public.sync_solo_membership_quota(uuid) from public, anon, authenticated;
