-- Fixes a gap in 0002's backfill: it only created an organization for
-- users who already had a contact_lists row at the time it ran, so anyone
-- who signed up before organizations existed but hadn't yet successfully
-- uploaded a contact list (e.g. blocked by the since-fixed "no email
-- column found" bug) was skipped entirely, leaving them with no
-- organization/membership row and every quota-gated action silently
-- failing.
--
-- This backfill is based on auth.users instead, so it covers every
-- existing account. Safe to re-run: only inserts for users who still
-- don't have a membership.
do $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  for v_user_id in
    select id from auth.users u
    where not exists (select 1 from public.memberships m where m.user_id = u.id)
  loop
    insert into public.organizations (name, owner_id)
    values ('My Organization', v_user_id)
    returning id into v_org_id;

    insert into public.memberships (
      organization_id, user_id, role, status, invited_at,
      validation_quota, send_quota
    )
    values (v_org_id, v_user_id, 'admin', 'active', now(), 10000, 10000);

    update public.contact_lists set organization_id = v_org_id
      where user_id = v_user_id and organization_id is null;
    update public.campaigns set organization_id = v_org_id
      where user_id = v_user_id and organization_id is null;
  end loop;
end $$;
