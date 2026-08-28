-- Removes profiles.current_company -- the org's own name (organizations.name)
-- is used instead, so this was a redundant duplicate field. Run this in the
-- Supabase dashboard: SQL Editor -> New query -> paste -> Run. Only needed if
-- you already ran 0011_profiles.sql before this change; a fresh install of
-- 0011 never creates the column.

alter table public.profiles drop column if exists current_company;
