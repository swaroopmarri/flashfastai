-- Records when a user accepted the Terms of Service / Privacy Policy at
-- signup -- proof of consent, not just a UI checkbox. Run this in the
-- Supabase dashboard: SQL Editor -> New query -> paste -> Run. Run AFTER
-- 0011_profiles.sql.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
