-- Bulk verification results used to be applied to `contacts` in one giant
-- sequential loop (one UPDATE per email) inside a single poll request. For
-- a list of tens of thousands of contacts that always exceeds the
-- serverless function's execution time budget before the loop finishes --
-- and since the job is only marked "completed" after the whole loop
-- succeeds, it never converges: every subsequent poll re-downloads the
-- full MillionVerifier report and restarts the same doomed loop from
-- scratch, forever.
--
-- This stages the downloaded report into its own table once, then lets
-- polling apply it in small batches across many requests -- the same
-- "process a bounded batch per poll call" shape already used for campaign
-- sending (send_jobs / campaign_recipients).
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run AFTER 0001-0021.

alter table public.verification_jobs
  add column if not exists results_downloaded boolean not null default false;

create table if not exists public.verification_job_results (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.verification_jobs(id) on delete cascade,
  email text not null,
  status text not null check (status in ('deliverable', 'risky', 'undeliverable')),
  sub_status text,
  applied boolean not null default false
);

-- Every poll's "give me the next batch" query filters on (job_id, applied =
-- false) -- a partial index keeps that fast even after most of a large
-- job's rows have already been applied.
create index if not exists verification_job_results_pending_idx
  on public.verification_job_results(job_id)
  where not applied;

alter table public.verification_job_results enable row level security;

drop policy if exists "Users manage their own verification job results" on public.verification_job_results;
create policy "Users manage their own verification job results"
  on public.verification_job_results for all
  using (exists (
    select 1 from public.verification_jobs vj
    where vj.id = verification_job_results.job_id and vj.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.verification_jobs vj
    where vj.id = verification_job_results.job_id and vj.user_id = auth.uid()
  ));
