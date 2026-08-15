import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AudienceToggle } from "./AudienceToggle";
import { companyDisplayName } from "@/lib/companyName";
import { isMissingSchemaError } from "@/lib/schemaGuard";

export default async function AudiencePage({
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
      "id, name, include_risky, contact_list_id, company_domain, selected_contact_emails, contact_lists(name)",
    )
    .eq("id", params.id)
    .maybeSingle();

  // selected_contact_emails is added by migration 0008 -- if it hasn't run
  // yet, fall back to the pre-0008 select so existing list/domain-scoped
  // campaigns still work rather than 404ing on an unrelated column.
  if (campaignError && isMissingSchemaError(campaignError)) {
    const fallback = await supabase
      .from("campaigns")
      .select("id, name, include_risky, contact_list_id, company_domain, contact_lists(name)")
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

  const counts = { deliverable: 0, risky: 0, undeliverable: 0, pending_verification: 0 };

  if (campaign.contact_list_id) {
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("status")
      .eq("contact_list_id", campaign.contact_list_id);
    if (error) throw error;
    for (const c of contacts ?? []) {
      if (c.status in counts) counts[c.status as keyof typeof counts]++;
    }
  } else if (campaign.company_domain) {
    const { data: contacts, error } = await supabase.rpc("get_network_domain_contacts", {
      p_domain: campaign.company_domain,
    });
    if (error) throw error;
    for (const c of contacts ?? []) {
      if (c.status in counts) counts[c.status as keyof typeof counts]++;
    }
  } else {
    const emails = campaign.selected_contact_emails as string[];
    const { data: contacts, error } = await supabase.rpc("search_network_contacts", {
      p_emails: emails,
      p_limit: emails.length,
    });
    if (error) throw error;
    for (const c of contacts ?? []) {
      if (c.status in counts) counts[c.status as keyof typeof counts]++;
    }
  }

  const listName = (campaign.contact_lists as unknown as { name: string } | null)?.name;
  const audienceHref = campaign.contact_list_id
    ? `/contacts/${campaign.contact_list_id}`
    : campaign.company_domain
      ? `/network/${campaign.company_domain}`
      : "/network";
  const audienceLabel = campaign.contact_list_id
    ? "List"
    : campaign.company_domain
      ? "Company"
      : "Selection";
  const audienceName = campaign.contact_list_id
    ? listName
    : campaign.company_domain
      ? companyDisplayName(campaign.company_domain)
      : `${campaign.selected_contact_emails?.length ?? 0} selected contacts`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{campaign.name}</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-medium text-gray-900">Audience</h2>
        <p className="mb-4 text-sm text-gray-500">
          {audienceLabel}:{" "}
          <Link href={audienceHref} className="text-indigo-600 hover:underline">
            {audienceName}
          </Link>
          {campaign.company_domain && (
            <span className="text-xs text-gray-400"> ({campaign.company_domain})</span>
          )}
        </p>

        <div className="mb-4 flex gap-4 text-sm">
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
            {counts.deliverable} deliverable
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700">
            {counts.risky} risky
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
            {counts.undeliverable} undeliverable
          </span>
        </div>

        {counts.pending_verification > 0 && (
          <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {counts.pending_verification} contact
            {counts.pending_verification === 1 ? "" : "s"} in this{" "}
            {audienceLabel.toLowerCase()}{" "}
            {counts.pending_verification === 1 ? "hasn't" : "haven't"} been
            verified yet and won&apos;t be included in this campaign.{" "}
            <Link href={audienceHref} className="underline">
              Verify them
            </Link>
            .
          </p>
        )}

        <AudienceToggle
          campaignId={campaign.id}
          initialIncludeRisky={campaign.include_risky}
          deliverableCount={counts.deliverable}
          riskyCount={counts.risky}
        />

        <Link
          href={`/campaigns/${campaign.id}/compose`}
          className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Continue to Compose
        </Link>
      </div>
    </div>
  );
}
