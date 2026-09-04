-- Stores submissions from the public /report-abuse form. Reporters are
-- anonymous (not logged in), so this is written via the service-role
-- client (see src/app/report-abuse/actions.ts) -- RLS stays enabled with
-- no policies, meaning only that admin client can ever read/write it, the
-- same pattern used for cross-tenant admin-only tables elsewhere.
-- Run AFTER 0015_terms_acceptance.sql.

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_email text not null,
  recipient_email text not null,
  sender_email text,
  subject text,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.abuse_reports enable row level security;
