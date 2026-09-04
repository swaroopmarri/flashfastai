"use server";

import { createAdminClient } from "@/utils/supabase/admin";

export interface AbuseReportInput {
  reporterEmail: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  reason: string;
  details: string;
}

/**
 * Reporters aren't logged in, so this can't go through the normal
 * session-scoped client -- the admin client is the narrow, justified
 * exception here (same reasoning as the cron job and webhooks), not a
 * general escape hatch.
 */
export async function submitAbuseReport(input: AbuseReportInput): Promise<void> {
  const reporterEmail = input.reporterEmail.trim();
  const recipientEmail = input.recipientEmail.trim();
  const reason = input.reason.trim();

  if (!reporterEmail || !recipientEmail || !reason) {
    throw new Error("Your email, the recipient address, and a reason are required.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("abuse_reports").insert({
    reporter_email: reporterEmail,
    recipient_email: recipientEmail,
    sender_email: input.senderEmail.trim() || null,
    subject: input.subject.trim() || null,
    reason,
    details: input.details.trim() || null,
  });
  if (error) throw error;
}
