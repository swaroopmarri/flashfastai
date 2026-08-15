import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VerifyPanel } from "../../_components/VerifyPanel";
import { ContactsTable } from "../../_components/ContactsTable";
import { createCompanyCampaign } from "../../campaigns/actions";
import { companyDisplayName } from "@/lib/companyName";
import { isMissingSchemaError } from "@/lib/schemaGuard";

interface DomainCount {
  domain: string;
  total: number;
  deliverable: number;
  risky: number;
  undeliverable: number;
  pending: number;
  unsubscribed: number;
}

export default async function NetworkDomainPage({
  params,
}: {
  params: { domain: string };
}) {
  const domain = decodeURIComponent(params.domain);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Reuses the same per-company aggregate the overview page's cards are
  // built from, rather than loading every contact just to count them.
  const { data: domainCounts, error: countsError } = await supabase.rpc(
    "get_network_domain_counts",
  );
  if (countsError && !isMissingSchemaError(countsError)) throw countsError;
  const summary = ((domainCounts ?? []) as DomainCount[]).find((d) => d.domain === domain);

  const { data: activeJob } = await supabase
    .from("verification_jobs")
    .select("id, status")
    .eq("company_domain", domain)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const createCampaignForDomain = createCompanyCampaign.bind(null, domain);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {companyDisplayName(domain)}
          </h1>
          <p className="text-sm text-gray-400">{domain}</p>
        </div>
        <Link href="/network" className="text-sm text-indigo-600 hover:underline">
          Back to My Network
        </Link>
      </div>

      {summary && (
        <div className="mb-8 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
            {summary.total.toLocaleString()} contacts
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
            {summary.deliverable} deliverable
          </span>
          {summary.risky > 0 && (
            <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700">
              {summary.risky} risky
            </span>
          )}
          {summary.undeliverable > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
              {summary.undeliverable} undeliverable
            </span>
          )}
        </div>
      )}

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <VerifyPanel
          target={{ type: "company", domain }}
          pendingCount={summary?.pending ?? 0}
          activeJobId={activeJob?.id ?? null}
          label="Verify all unverified"
          buttonLabel="Verify all unverified"
        />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-medium text-gray-900">Start a campaign</h2>
        <p className="mb-4 text-sm text-gray-500">
          Creates a new campaign targeting this company&apos;s deliverable
          contacts (across every list), ready to compose.
        </p>
        <form action={createCampaignForDomain}>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Start campaign with this company
          </button>
        </form>
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Contacts</h2>
      <ContactsTable domain={domain} pageSize={25} />
    </div>
  );
}
