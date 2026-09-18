import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateBatch,
  submitBulkFile,
  getBulkFileStatus,
  getBulkFileResult,
  type SimplifiedStatus,
  type SingleValidateResult,
} from "@/lib/millionverifier";
import { getCurrentMembership } from "@/lib/organizations";
import { fetchAllRows } from "@/lib/supabasePagination";

// NOTE: the `contacts.zerobounce_sub_status` / `verification_jobs.zerobounce_file_id`
// DB column names predate the switch to MillionVerifier and are kept as-is
// (a rename is a larger, purely cosmetic migration) -- they now hold
// MillionVerifier's data, not ZeroBounce's.

const BULK_THRESHOLD = 50;

export type VerificationScope =
  | { type: "list"; contactListId: string }
  | { type: "company"; domain: string };

export interface VerificationSummary {
  deliverable: number;
  risky: number;
  undeliverable: number;
}

export type StartVerificationResult =
  | { mode: "none" }
  | { mode: "quota_exceeded"; message: string }
  | {
      mode: "single";
      summary: VerificationSummary;
      submittedCount: number;
      leftoverPending: number;
      reusedCount: number;
    }
  | { mode: "bulk"; jobId: string; submittedCount: number; leftoverPending: number; reusedCount: number };

const QUOTA_EXCEEDED_MESSAGE =
  "You've used your monthly validation limit. Contact your admin to increase it.";
const NOT_ACTIVE_MESSAGE =
  "Your organization membership isn't active yet. Contact your admin.";

/**
 * Updates every contact row matching an email, scoped to one list when
 * `contactListId` is set or across every list the caller owns (RLS still
 * restricts to their own rows) when it's a company-wide verification --
 * so if the same email exists in multiple lists, verifying it once via
 * "My Network" keeps every copy in sync instead of only one.
 */
// Supabase has no single-call "bulk update, different value per row" via
// the JS client, so this still issues one UPDATE per email -- but with a
// bounded worker pool instead of one at a time, so a few hundred rows
// (one poll's batch, see applyNextBatch) finish in a couple of seconds
// instead of one request per row in strict sequence.
const APPLY_CONCURRENCY = 10;

async function applyResults(
  supabase: SupabaseClient,
  scope: VerificationScope,
  results: { email: string; status: SimplifiedStatus; subStatus: string | null }[],
): Promise<VerificationSummary> {
  const summary: VerificationSummary = { deliverable: 0, risky: 0, undeliverable: 0 };

  let next = 0;
  async function worker() {
    while (next < results.length) {
      const result = results[next++];
      summary[result.status]++;
      let query = supabase
        .from("contacts")
        .update({
          status: result.status,
          zerobounce_sub_status: result.subStatus,
          verified_at: new Date().toISOString(),
        })
        .eq("email", result.email.trim().toLowerCase());

      if (scope.type === "list") {
        query = query.eq("contact_list_id", scope.contactListId);
      }

      await query;
    }
  }
  await Promise.all(Array.from({ length: Math.min(APPLY_CONCURRENCY, results.length) }, worker));

  return summary;
}

async function fetchPendingEmails(
  supabase: SupabaseClient,
  scope: VerificationScope,
): Promise<string[]> {
  const rows = await fetchAllRows<{ email: string }>((from, to) => {
    let query = supabase.from("contacts").select("email").eq("status", "pending_verification");
    query =
      scope.type === "list"
        ? query.eq("contact_list_id", scope.contactListId)
        : query.ilike("email", `%@${scope.domain}`);
    return query.range(from, to);
  });

  // Company scope can return the same email more than once (present in
  // multiple lists) -- dedupe so we don't pay quota or call MillionVerifier
  // twice for one address.
  return Array.from(new Set(rows.map((r) => r.email.trim().toLowerCase())));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Runs `fn` over every item in `chunks`, at most `concurrency` in flight at
 * once, instead of one at a time -- a large list can produce well over a
 * hundred chunks, and doing them strictly in sequence adds a full network
 * round trip per chunk before verification can even start. */
async function runChunked<T>(
  chunks: T[][],
  concurrency: number,
  fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      await fn(chunk);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
}

// .in() is encoded into the request URL, so each chunk stays well under
// any proxy's URL-length limit -- and since the result can never exceed
// the input chunk's size, no further pagination is needed on the read side.
const KNOWN_RESULT_CHECK_CHUNK_SIZE = 200;
const KNOWN_RESULT_CHECK_CONCURRENCY = 8;

/**
 * Finds pending emails that already have a real result (deliverable/risky/
 * undeliverable) somewhere ELSE in the account -- e.g. the same address
 * exists in another list that was already verified. There's no reason to
 * pay MillionVerifier again for an address whose answer we already have;
 * this reuses that known result instead. RLS already scopes `contacts` to
 * the caller's own rows, so this naturally can't see another customer's
 * data.
 */
async function findKnownResults(
  supabase: SupabaseClient,
  emails: string[],
): Promise<Map<string, { status: SimplifiedStatus; subStatus: string | null }>> {
  const known = new Map<string, { status: SimplifiedStatus; subStatus: string | null }>();
  await runChunked(
    chunk(emails, KNOWN_RESULT_CHECK_CHUNK_SIZE),
    KNOWN_RESULT_CHECK_CONCURRENCY,
    async (batch) => {
      const { data, error } = await supabase
        .from("contacts")
        .select("email, status, zerobounce_sub_status, verified_at")
        .in("email", batch)
        .neq("status", "pending_verification")
        .order("verified_at", { ascending: false });
      if (error) throw error;
      for (const row of data ?? []) {
        const email = (row.email as string).trim().toLowerCase();
        // Rows are ordered newest-verified-first within a batch, but
        // batches resolve concurrently and out of order -- an email can
        // only appear in one 200-item batch to begin with (no duplicates
        // across chunks), so racing writes into the map are never for the
        // same key and this stays safe without extra locking.
        if (!known.has(email)) {
          known.set(email, {
            status: row.status as SimplifiedStatus,
            subStatus: row.zerobounce_sub_status as string | null,
          });
        }
      }
    },
  );
  return known;
}

async function startVerificationForScope(
  supabase: SupabaseClient,
  scope: VerificationScope,
): Promise<StartVerificationResult> {
  let emails = await fetchPendingEmails(supabase, scope);
  if (emails.length === 0) {
    return { mode: "none" };
  }

  // Reuse any result we already have for these addresses from elsewhere in
  // the account before spending quota or calling MillionVerifier at all.
  const known = await findKnownResults(supabase, emails);
  let reusedSummary: VerificationSummary = { deliverable: 0, risky: 0, undeliverable: 0 };
  if (known.size > 0) {
    reusedSummary = await applyResults(
      supabase,
      scope,
      Array.from(known.entries()).map(([email, r]) => ({
        email,
        status: r.status,
        subStatus: r.subStatus,
      })),
    );
    emails = emails.filter((e) => !known.has(e));
  }
  const reusedCount = known.size;

  if (emails.length === 0) {
    return {
      mode: "single",
      summary: reusedSummary,
      submittedCount: 0,
      leftoverPending: 0,
      reusedCount,
    };
  }

  // try_consume_quota() only matches memberships with status = 'active' and
  // returns a plain false either way, so check membership state ourselves
  // first to give a message that actually points at the real problem
  // instead of always blaming "quota exceeded".
  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.status !== "active") {
    return { mode: "quota_exceeded", message: NOT_ACTIVE_MESSAGE };
  }

  // try_consume_quota() is all-or-nothing: it only succeeds if the FULL
  // amount requested fits. Now that fetchPendingEmails() returns every
  // pending contact (not just the first page), asking to consume quota for
  // all of them at once would block verification entirely for a large list
  // sitting on a smaller remaining quota, even though the account could
  // afford to verify part of it right now. Cap what's requested to the
  // membership's own remaining quota first, so a big list gets verified in
  // as many quota-affordable rounds as it takes -- this is the same
  // enforcement, just requested in a size that can actually succeed;
  // try_consume_quota() still re-checks (and is the real authority on) the
  // org-level shared pool underneath it.
  const remaining = Math.max(0, membership.validation_quota - membership.validation_used);
  if (remaining === 0) {
    return { mode: "quota_exceeded", message: QUOTA_EXCEEDED_MESSAGE };
  }
  const totalPending = emails.length;
  if (emails.length > remaining) {
    emails.length = remaining;
  }
  const leftoverPending = totalPending - emails.length;

  const { data: quotaOk, error: quotaError } = await supabase.rpc("try_consume_quota", {
    p_kind: "validation",
    p_amount: emails.length,
  });
  if (quotaError) throw quotaError;
  if (!quotaOk) {
    return { mode: "quota_exceeded", message: QUOTA_EXCEEDED_MESSAGE };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const jobBase =
    scope.type === "list"
      ? { contact_list_id: scope.contactListId, company_domain: null }
      : { contact_list_id: null, company_domain: scope.domain };

  if (emails.length <= BULK_THRESHOLD) {
    const results = await validateBatch(emails);
    const freshSummary = await applyResults(supabase, scope, results);
    const summary: VerificationSummary = {
      deliverable: freshSummary.deliverable + reusedSummary.deliverable,
      risky: freshSummary.risky + reusedSummary.risky,
      undeliverable: freshSummary.undeliverable + reusedSummary.undeliverable,
    };
    await supabase.from("verification_jobs").insert({
      ...jobBase,
      user_id: user.id,
      mode: "single",
      status: "completed",
      total_contacts: emails.length,
      processed_contacts: emails.length,
      deliverable_count: freshSummary.deliverable,
      risky_count: freshSummary.risky,
      undeliverable_count: freshSummary.undeliverable,
    });
    return { mode: "single", summary, submittedCount: emails.length, leftoverPending, reusedCount };
  }

  const { fileId } = await submitBulkFile(emails);
  const { data: job, error: jobError } = await supabase
    .from("verification_jobs")
    .insert({
      ...jobBase,
      user_id: user.id,
      mode: "bulk",
      zerobounce_file_id: fileId,
      status: "processing",
      total_contacts: emails.length,
    })
    .select("id")
    .single();

  if (jobError) throw jobError;

  return {
    mode: "bulk",
    jobId: job.id as string,
    submittedCount: emails.length,
    leftoverPending,
    reusedCount,
  };
}

export async function startVerification(
  supabase: SupabaseClient,
  contactListId: string,
): Promise<StartVerificationResult> {
  return startVerificationForScope(supabase, { type: "list", contactListId });
}

export async function startCompanyVerification(
  supabase: SupabaseClient,
  domain: string,
): Promise<StartVerificationResult> {
  return startVerificationForScope(supabase, { type: "company", domain });
}

export interface JobPollResult {
  status: "queued" | "processing" | "completed" | "failed";
  totalContacts: number;
  summary: VerificationSummary;
  errorMessage: string | null;
}

interface VerificationJobRow {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  mode: "single" | "bulk";
  zerobounce_file_id: string | null;
  contact_list_id: string | null;
  company_domain: string | null;
  results_downloaded: boolean;
  total_contacts: number;
  processed_contacts: number;
  deliverable_count: number;
  risky_count: number;
  undeliverable_count: number;
  error_message: string | null;
}

function toJobPollResult(job: VerificationJobRow): JobPollResult {
  return {
    status: job.status,
    totalContacts: job.total_contacts,
    summary: {
      deliverable: job.deliverable_count,
      risky: job.risky_count,
      undeliverable: job.undeliverable_count,
    },
    errorMessage: job.error_message,
  };
}

// Applying to `contacts` can't be done for the whole report at once (see
// APPLY_CONCURRENCY's comment) -- so once the report is downloaded, it's
// staged row-by-row into verification_job_results and applied this many at
// a time per poll, the same "bounded batch per request" shape already used
// for campaign sending (processSendJobBatch).
const APPLY_BATCH_SIZE = 300;

const STAGE_CHUNK_SIZE = 1000;
const STAGE_CONCURRENCY = 4;

async function stageResults(
  supabase: SupabaseClient,
  jobId: string,
  results: SingleValidateResult[],
): Promise<void> {
  const rows = results.map((r) => ({
    job_id: jobId,
    email: r.email.trim().toLowerCase(),
    status: r.status,
    sub_status: r.subStatus,
  }));
  await runChunked(chunk(rows, STAGE_CHUNK_SIZE), STAGE_CONCURRENCY, async (batch) => {
    const { error } = await supabase.from("verification_job_results").insert(batch);
    if (error) throw error;
  });
}

/** Applies up to APPLY_BATCH_SIZE not-yet-applied staged rows to `contacts`,
 * advancing the job's counters -- once a poll finds nothing left to apply,
 * the job is done. */
async function applyNextBatch(
  supabase: SupabaseClient,
  job: VerificationJobRow,
): Promise<JobPollResult> {
  const { data: batch, error: batchError } = await supabase
    .from("verification_job_results")
    .select("id, email, status, sub_status")
    .eq("job_id", job.id)
    .eq("applied", false)
    .limit(APPLY_BATCH_SIZE);
  if (batchError) throw batchError;

  if (!batch || batch.length === 0) {
    const { data: finished, error: finalizeError } = await supabase
      .from("verification_jobs")
      .update({ status: "completed" })
      .eq("id", job.id)
      .select("*")
      .single();
    if (finalizeError) throw finalizeError;
    return toJobPollResult(finished);
  }

  const scope: VerificationScope = job.contact_list_id
    ? { type: "list", contactListId: job.contact_list_id }
    : { type: "company", domain: job.company_domain as string };

  const summary = await applyResults(
    supabase,
    scope,
    batch.map((r) => ({
      email: r.email as string,
      status: r.status as SimplifiedStatus,
      subStatus: r.sub_status as string | null,
    })),
  );

  await supabase
    .from("verification_job_results")
    .update({ applied: true })
    .in(
      "id",
      batch.map((r) => r.id),
    );

  const { data: updated, error: updateError } = await supabase
    .from("verification_jobs")
    .update({
      processed_contacts: job.processed_contacts + batch.length,
      deliverable_count: job.deliverable_count + summary.deliverable,
      risky_count: job.risky_count + summary.risky,
      undeliverable_count: job.undeliverable_count + summary.undeliverable,
    })
    .eq("id", job.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return toJobPollResult(updated);
}

export async function pollVerificationJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<JobPollResult> {
  const { data: job, error } = await supabase
    .from("verification_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw error;

  if (job.status === "completed" || job.status === "failed") {
    return toJobPollResult(job);
  }

  if (job.mode !== "bulk" || !job.zerobounce_file_id) {
    return toJobPollResult(job);
  }

  // The report has already been downloaded and staged (possibly by an
  // earlier poll) -- just keep applying it in batches without re-checking
  // MillionVerifier or re-downloading anything.
  if (job.results_downloaded) {
    return applyNextBatch(supabase, job);
  }

  const { status: zbStatus, errorReason } = await getBulkFileStatus(
    job.zerobounce_file_id,
  );

  if (zbStatus === "Processing" || zbStatus === "Unknown") {
    return toJobPollResult(job);
  }

  if (zbStatus === "Failed") {
    const { data: failed, error: failError } = await supabase
      .from("verification_jobs")
      .update({ status: "failed", error_message: errorReason || "Verification failed" })
      .eq("id", jobId)
      .select("*")
      .single();
    if (failError) throw failError;
    return toJobPollResult(failed);
  }

  // zbStatus === "Complete" -- download the report exactly once and stage
  // it for batched application. If MillionVerifier's actual column names
  // don't match what getBulkFileResult() expects, this comes back empty
  // instead of silently completing with a false all-zero result.
  const results = await getBulkFileResult(job.zerobounce_file_id);
  if (results.length === 0 && job.total_contacts > 0) {
    const { data: failed, error: failError } = await supabase
      .from("verification_jobs")
      .update({
        status: "failed",
        error_message:
          "MillionVerifier's report came back with no usable rows -- the report format may have changed.",
      })
      .eq("id", jobId)
      .select("*")
      .single();
    if (failError) throw failError;
    return toJobPollResult(failed);
  }

  await stageResults(supabase, jobId, results);
  const { data: staged, error: stageError } = await supabase
    .from("verification_jobs")
    .update({ results_downloaded: true })
    .eq("id", jobId)
    .select("*")
    .single();
  if (stageError) throw stageError;

  return applyNextBatch(supabase, staged);
}
