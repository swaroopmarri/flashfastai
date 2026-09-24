-- unsubscribe_by_token() has been broken since it was first written: it
-- returns table (email text, ...), which in PL/pgSQL creates an implicit
-- "email" variable in scope for the whole function body. Every unqualified
-- `email` reference in later SQL statements (the unsubscribes insert's
-- ON CONFLICT (user_id, email) target, and the contacts update's WHERE
-- email = ...) is ambiguous between that variable and the real table
-- column, so Postgres raises "column reference \"email\" is ambiguous"
-- before the function can do anything. The exception was caught by the
-- calling page as a generic error and shown as "This unsubscribe link is
-- invalid or has expired" -- meaning every unsubscribe click has always
-- failed, regardless of whether the token was valid, and no recipient has
-- ever actually been unsubscribed through this path.
--
-- #variable_conflict use_column tells PL/pgSQL to resolve any such
-- ambiguity in favor of the table column (the normal SQL behavior),
-- eliminating the error with no change to the function's signature or
-- what callers receive back.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0022.

create or replace function public.unsubscribe_by_token(p_token text)
returns table (email text, already_unsubscribed boolean)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
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
