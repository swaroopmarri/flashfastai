import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateBatch,
  submitBulkFile,
  getBulkFileStatus,
  getBulkFileResult,
  type SimplifiedStatus,
} from "@/lib/zerobounce";

const BULK_THRESHOLD = 50;

export interface VerificationSummary {
  deliverable: number;
  risky: number;
  undeliverable: number;
}

export type StartVerificationResult =
  | { mode: "none" }
  | { mode: "single"; summary: VerificationSummary }
  | { mode: "bulk"; jobId: string };

async function applyResults(
  supabase: SupabaseClient,
  contactListId: string,
  results: { email: string; status: SimplifiedStatus; subStatus: string | null }[],
): Promise<VerificationSummary> {
  const summary: VerificationSummary = { deliverable: 0, risky: 0, undeliverable: 0 };

  for (const result of results) {
    summary[result.status]++;
    await supabase
      .from("contacts")
      .update({
        status: result.status,
        zerobounce_sub_status: result.subStatus,
        verified_at: new Date().toISOString(),
      })
      .eq("contact_list_id", contactListId)
      .eq("email", result.email.trim().toLowerCase());
  }

  return summary;
}

export async function startVerification(
  supabase: SupabaseClient,
  contactListId: string,
): Promise<StartVerificationResult> {
  const { data: pending, error } = await supabase
    .from("contacts")
    .select("email")
    .eq("contact_list_id", contactListId)
    .eq("status", "pending_verification");

  if (error) throw error;
  if (!pending || pending.length === 0) {
    return { mode: "none" };
  }

  const emails = pending.map((c) => c.email as string);

  if (emails.length <= BULK_THRESHOLD) {
    const results = await validateBatch(emails);
    const summary = await applyResults(supabase, contactListId, results);
    await supabase.from("verification_jobs").insert({
      contact_list_id: contactListId,
      mode: "single",
      status: "completed",
      total_contacts: emails.length,
      processed_contacts: emails.length,
      deliverable_count: summary.deliverable,
      risky_count: summary.risky,
      undeliverable_count: summary.undeliverable,
    });
    return { mode: "single", summary };
  }

  const { fileId } = await submitBulkFile(emails);
  const { data: job, error: jobError } = await supabase
    .from("verification_jobs")
    .insert({
      contact_list_id: contactListId,
      mode: "bulk",
      zerobounce_file_id: fileId,
      status: "processing",
      total_contacts: emails.length,
    })
    .select("id")
    .single();

  if (jobError) throw jobError;

  return { mode: "bulk", jobId: job.id as string };
}

export interface JobPollResult {
  status: "queued" | "processing" | "completed" | "failed";
  totalContacts: number;
  summary: VerificationSummary;
  errorMessage: string | null;
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

  const toResult = (): JobPollResult => ({
    status: job.status,
    totalContacts: job.total_contacts,
    summary: {
      deliverable: job.deliverable_count,
      risky: job.risky_count,
      undeliverable: job.undeliverable_count,
    },
    errorMessage: job.error_message,
  });

  if (job.status === "completed" || job.status === "failed") {
    return toResult();
  }

  if (job.mode !== "bulk" || !job.zerobounce_file_id) {
    return toResult();
  }

  const { status: zbStatus, errorReason } = await getBulkFileStatus(
    job.zerobounce_file_id,
  );

  if (zbStatus === "Processing" || zbStatus === "Unknown") {
    return toResult();
  }

  if (zbStatus === "Failed") {
    await supabase
      .from("verification_jobs")
      .update({ status: "failed", error_message: errorReason || "ZeroBounce reported a failure" })
      .eq("id", jobId);
    job.status = "failed";
    job.error_message = errorReason || "ZeroBounce reported a failure";
    return toResult();
  }

  // zbStatus === "Complete"
  const results = await getBulkFileResult(job.zerobounce_file_id);
  const summary = await applyResults(supabase, job.contact_list_id, results);

  await supabase
    .from("verification_jobs")
    .update({
      status: "completed",
      processed_contacts: results.length,
      deliverable_count: summary.deliverable,
      risky_count: summary.risky,
      undeliverable_count: summary.undeliverable,
    })
    .eq("id", jobId);

  job.status = "completed";
  job.processed_contacts = results.length;
  job.deliverable_count = summary.deliverable;
  job.risky_count = summary.risky;
  job.undeliverable_count = summary.undeliverable;

  return toResult();
}
