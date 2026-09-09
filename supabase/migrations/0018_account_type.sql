-- Distinguishes individual accounts (single user, can't invite teammates)
-- from company accounts (can invite members and split the shared quota
-- pool). Both account types pay the same plan prices for the same
-- contact limits -- this only gates the invite feature, not pricing.
-- Run AFTER 0017_no_free_signup_quota.sql.

alter table public.organizations
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'company'));

-- Re-created to accept the account type chosen at signup (see
-- src/app/login/actions.ts / src/lib/organizations.ts). Identical to the
-- original in 0002_organizations.sql otherwise.
create or replace function public.create_organization(p_name text, p_account_type text default 'individual')
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_org_id uuid;
begin
  if p_account_type not in ('individual', 'company') then
    raise exception 'invalid account type: %', p_account_type;
  end if;

  select organization_id into v_existing from public.memberships where user_id = auth.uid();
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.organizations (name, owner_id, account_type)
  values (p_name, auth.uid(), p_account_type)
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
