import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ComposeForm } from "./ComposeForm";
import { SendPanel } from "./SendPanel";
import { isMissingSchemaError } from "@/lib/schemaGuard";

export default async function ComposePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, name, subject, body, reply_to, status, contact_list_id, company_domain, selected_contact_emails, include_risky, user_id",
    )
    .eq("id", params.id)
    .maybeSingle();

  // selected_contact_emails is added by migration 0008 -- if it hasn't run
  // yet, fall back to the pre-0008 select so existing list/domain-scoped
  // campaigns still work rather than 404ing on an unrelated column.
  if (campaignError && isMissingSchemaError(campaignError)) {
    const fallback = await supabase
      .from("campaigns")
      .select(
        "id, name, subject, body, reply_to, status, contact_list_id, company_domain, include_risky, user_id",
      )
      .eq("id", params.id)
      .maybeSingle();
    campaign = fallback.data ? { ...fallback.data, selected_contact_emails: null } : null;
    campaignError = fallback.error;
  }
  if (campaignError && !isMissingSchemaError(campaignError)) throw campaignError;

  if (
    !campaign ||
    (!campaign.contact_list_id && !campaign.company_domain && !campaign.selected_contact_emails?.length)
  )
    notFound();

  const statuses = campaign.include_risky ? ["deliverable", "risky"] : ["deliverable"];
  let eligibleQuery = supabase.from("contacts").select("email").in("status", statuses);
  eligibleQuery = campaign.contact_list_id
    ? eligibleQuery.eq("contact_list_id", campaign.contact_list_id)
    : campaign.company_domain
      ? eligibleQuery.ilike("email", `%@${campaign.company_domain}`)
      : eligibleQuery.in("email", campaign.selected_contact_emails as string[]);
  const { data: eligibleContacts, error: contactsError } = await eligibleQuery;
  if (contactsError) throw contactsError;

  const { data: unsubs, error: unsubError } = await supabase
    .from("unsubscribes")
    .select("email")
    .eq("user_id", campaign.user_id);
  if (unsubError) throw unsubError;
  const unsubSet = new Set((unsubs ?? []).map((u) => u.email));

  const recipientCount = new Set(
    (eligibleContacts ?? [])
      .map((c) => c.email.toLowerCase())
      .filter((email) => !unsubSet.has(email)),
  ).size;

  const { data: latestJob } = await supabase
    .from("send_jobs")
    .select("id, status, total_recipients, sent_count, failed_count")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let failedRecipients: { email: string; error_message: string | null }[] = [];
  if (latestJob && campaign.status === "sent" && latestJob.failed_count > 0) {
    const { data } = await supabase
      .from("campaign_recipients")
      .select("email, error_message")
      .eq("send_job_id", latestJob.id)
      .eq("status", "failed");
    failedRecipients = data ?? [];
  }

  const isDraft = campaign.status === "draft";
  const canSend = Boolean(campaign.subject?.trim() && campaign.body?.trim());

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{campaign.name}</h1>
        <Link
          href={`/campaigns/${campaign.id}/audience`}
          className="text-sm text-indigo-600 hover:underline"
        >
          Back to Audience
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {isDraft ? (
          <ComposeForm
            campaignId={campaign.id}
            initialSubject={campaign.subject ?? ""}
            initialBody={campaign.body ?? ""}
            initialReplyTo={campaign.reply_to ?? ""}
            ownEmail={user.email ?? ""}
          />
        ) : (
          <div>
            <p className="mb-1 text-xs text-gray-400">Subject</p>
            <p className="mb-4 font-medium text-gray-900">{campaign.subject}</p>
            <p className="mb-1 text-xs text-gray-400">Body</p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{campaign.body}</p>
          </div>
        )}
      </div>

      <SendPanel
        campaignId={campaign.id}
        canSend={canSend}
        recipientCount={recipientCount}
        campaignStatus={campaign.status}
        initialJobId={latestJob?.id ?? null}
        initialSummary={
          latestJob
            ? {
                totalRecipients: latestJob.total_recipients,
                sentCount: latestJob.sent_count,
                failedCount: latestJob.failed_count,
              }
            : null
        }
      />

      {failedRecipients.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Failed recipient</th>
                <th className="px-4 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {failedRecipients.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-gray-900">{r.email}</td>
                  <td className="px-4 py-2 text-gray-600">{r.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
