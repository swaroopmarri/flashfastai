import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { sendCampaignEmail } from "@/lib/ses";
import { getCurrentMembership } from "@/lib/organizations";

const BATCH_SIZE = 10;

export type StartSendResult =
  | { mode: "no_recipients" }
  | { mode: "blocked"; message: string }
  | { mode: "started"; jobId: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtmlBody(plainText: string, unsubscribeUrl: string): string {
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<div>${paragraphs}<hr><p style="font-size:12px;color:#6b7280;">Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p></div>`;
}

export async function startCampaignSend(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<StartSendResult> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, user_id, contact_list_id, include_risky, subject, body, status")
    .eq("id", campaignId)
    .single();
  if (error) throw error;

  if (campaign.status !== "draft") {
    return { mode: "blocked", message: `This campaign is already ${campaign.status}.` };
  }
  if (!campaign.subject?.trim() || !campaign.body?.trim()) {
    return { mode: "blocked", message: "Add a subject and body before sending." };
  }
  if (!campaign.contact_list_id) {
    return { mode: "no_recipients" };
  }

  const statuses = campaign.include_risky ? ["deliverable", "risky"] : ["deliverable"];
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, email")
    .eq("contact_list_id", campaign.contact_list_id)
    .in("status", statuses);
  if (contactsError) throw contactsError;

  const { data: unsubs, error: unsubError } = await supabase
    .from("unsubscribes")
    .select("email")
    .eq("user_id", campaign.user_id);
  if (unsubError) throw unsubError;
  const unsubSet = new Set((unsubs ?? []).map((u) => u.email as string));

  const recipients = (contacts ?? []).filter(
    (c) => !unsubSet.has((c.email as string).toLowerCase()),
  );

  if (recipients.length === 0) {
    return { mode: "no_recipients" };
  }

  // try_consume_quota() only matches an active membership and returns a
  // plain false either way -- check status first for a message that names
  // the real problem, same fix applied to verification.
  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.status !== "active") {
    return {
      mode: "blocked",
      message: "Your organization membership isn't active yet. Contact your admin.",
    };
  }

  const { data: quotaOk, error: quotaError } = await supabase.rpc("try_consume_quota", {
    p_kind: "send",
    p_amount: recipients.length,
  });
  if (quotaError) throw quotaError;
  if (!quotaOk) {
    return {
      mode: "blocked",
      message: "You've used your monthly send limit. Contact your admin to increase it.",
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("send_jobs")
    .insert({
      campaign_id: campaignId,
      status: "processing",
      total_recipients: recipients.length,
    })
    .select("id")
    .single();
  if (jobError) throw jobError;

  const recipientRows = recipients.map((c) => ({
    send_job_id: job.id,
    campaign_id: campaignId,
    contact_id: c.id,
    email: c.email,
    unsubscribe_token: randomBytes(24).toString("hex"),
  }));
  const { error: insertError } = await supabase
    .from("campaign_recipients")
    .insert(recipientRows);
  if (insertError) throw insertError;

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);

  return { mode: "started", jobId: job.id };
}

export interface SendJobPollResult {
  status: "processing" | "completed" | "failed";
  totalRecipients: number;
  processedRecipients: number;
  sentCount: number;
  failedCount: number;
  errorMessage: string | null;
}

/**
 * Processes one batch of pending recipients per call. The client polls this
 * repeatedly (same pattern as bulk ZeroBounce verification) so each request
 * stays short regardless of audience size, and the job finishes itself once
 * no pending recipients remain.
 */
export async function processSendJobBatch(
  supabase: SupabaseClient,
  jobId: string,
  origin: string,
): Promise<SendJobPollResult> {
  const { data: job, error } = await supabase
    .from("send_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error) throw error;

  const toResult = (j: typeof job): SendJobPollResult => ({
    status: j.status,
    totalRecipients: j.total_recipients,
    processedRecipients: j.processed_recipients,
    sentCount: j.sent_count,
    failedCount: j.failed_count,
    errorMessage: j.error_message,
  });

  if (job.status !== "processing") {
    return toResult(job);
  }

  const { data: batch, error: batchError } = await supabase
    .from("campaign_recipients")
    .select("id, email, unsubscribe_token")
    .eq("send_job_id", jobId)
    .eq("status", "pending")
    .limit(BATCH_SIZE);
  if (batchError) throw batchError;

  if (!batch || batch.length === 0) {
    const { data: finishedJob, error: finalizeError } = await supabase
      .from("send_jobs")
      .update({ status: "completed" })
      .eq("id", jobId)
      .select("*")
      .single();
    if (finalizeError) throw finalizeError;

    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", job.campaign_id);

    return toResult(finishedJob);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("subject, body, reply_to")
    .eq("id", job.campaign_id)
    .single();
  if (campaignError) throw campaignError;

  let replyTo = campaign.reply_to?.trim();
  if (!replyTo) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    replyTo = user?.email ?? undefined;
  }
  if (!replyTo) {
    throw new Error("Could not determine a reply-to address for this send.");
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of batch) {
    const unsubscribeUrl = `${origin}/unsubscribe/${recipient.unsubscribe_token}`;
    const textBody = `${campaign.body}\n\n---\nUnsubscribe: ${unsubscribeUrl}`;
    const htmlBody = renderHtmlBody(campaign.body, unsubscribeUrl);

    try {
      const result = await sendCampaignEmail({
        to: recipient.email,
        subject: campaign.subject,
        textBody,
        htmlBody,
        replyTo,
      });
      await supabase
        .from("campaign_recipients")
        .update({
          status: "sent",
          ses_message_id: result.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", recipient.id);
      sent++;
    } catch (e) {
      // SES sandbox mode rejects unverified recipients with a clear
      // MessageRejected error -- caught here per-recipient so one failure
      // (or many) never aborts the batch, and the reason is preserved for
      // the results summary instead of surfacing as a crash.
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Unknown SES error",
        })
        .eq("id", recipient.id);
      failed++;
    }
  }

  const { data: updatedJob, error: updateError } = await supabase
    .from("send_jobs")
    .update({
      processed_recipients: job.processed_recipients + sent + failed,
      sent_count: job.sent_count + sent,
      failed_count: job.failed_count + failed,
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return toResult(updatedJob);
}
