import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { companyDisplayName } from "@/lib/companyName";
import { CampaignRow } from "./CampaignRow";

export default async function CampaignsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, sent_at, contact_list_id, company_domain")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const listIds = Array.from(
    new Set((campaigns ?? []).map((c) => c.contact_list_id).filter((id): id is string => !!id)),
  );
  const listNames: Record<string, string> = {};
  if (listIds.length > 0) {
    const { data: lists, error: listsError } = await supabase
      .from("contact_lists")
      .select("id, name")
      .in("id", listIds);
    if (listsError) throw listsError;
    for (const l of lists ?? []) listNames[l.id] = l.name;
  }

  // send_jobs ordered newest-first, so the first row seen per campaign_id
  // below is that campaign's latest job -- a campaign can accumulate more
  // than one job across retries.
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const latestJobByCampaign: Record<
    string,
    { total_recipients: number; sent_count: number; failed_count: number }
  > = {};
  if (campaignIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("send_jobs")
      .select("campaign_id, total_recipients, sent_count, failed_count, created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });
    if (jobsError) throw jobsError;
    for (const j of jobs ?? []) {
      if (!latestJobByCampaign[j.campaign_id]) {
        latestJobByCampaign[j.campaign_id] = j;
      }
    }
  }

  const items = (campaigns ?? []).map((c) => {
    const job = latestJobByCampaign[c.id];
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.created_at as string,
      sentAt: c.sent_at as string | null,
      audienceLabel: c.contact_list_id
        ? (listNames[c.contact_list_id] ?? "Deleted list")
        : c.company_domain
          ? companyDisplayName(c.company_domain)
          : null,
      sentCount: job?.sent_count ?? null,
      totalRecipients: job?.total_recipients ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Campaigns</h1>

      <Link
        href="/campaigns/new"
        className="mb-8 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        New campaign
      </Link>

      {items.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {items.map((c) => (
            <CampaignRow key={c.id} campaign={c} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No campaigns yet.</p>
      )}
    </div>
  );
}
