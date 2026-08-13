-- Per-list status counts for the redesigned Contacts overview page, computed
-- in the database (one grouped aggregate query, using the existing
-- contacts_list_status_idx index) instead of pulling every contact row to
-- the client just to count them -- the whole point of this redesign is to
-- not do that for large lists.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create or replace function public.get_contact_list_status_counts()
returns table (contact_list_id uuid, status text, count bigint)
language sql stable
security invoker
set search_path = public
as $$
  select c.contact_list_id, c.status, count(*)
  from public.contacts c
  join public.contact_lists cl on cl.id = c.contact_list_id
  where cl.user_id = auth.uid()
  group by c.contact_list_id, c.status;
$$;
