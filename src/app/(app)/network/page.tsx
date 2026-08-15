import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RecommendedActions } from "../_components/RecommendedActions";
import { NetworkSearchFilters } from "../_components/NetworkSearchFilters";
import { CompanyCardsGrid, type DomainCount } from "../_components/CompanyCardsGrid";
import { ContactsTable } from "../_components/ContactsTable";
import { isMissingSchemaError } from "@/lib/schemaGuard";

interface Overview {
  total_contacts: number;
  companies: number;
  deliverable: number;
  undeliverable: number;
  risky: number;
  pending: number;
  unsubscribed: number;
  duplicate_emails: number;
}

function KpiCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-gray-900">
        {value === null ? "N/A" : value.toLocaleString()}
      </p>
    </div>
  );
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; view?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // get_network_overview() is added by migration 0008 -- if that hasn't
  // been run yet, degrade to "N/A" cards instead of crashing the page.
  const { data: overviewData, error: overviewError } = await supabase.rpc(
    "get_network_overview",
  );
  if (overviewError && !isMissingSchemaError(overviewError)) throw overviewError;
  const migrationPending = Boolean(overviewError && isMissingSchemaError(overviewError));
  const overview = (overviewData?.[0] ?? {
    total_contacts: 0,
    companies: 0,
    deliverable: 0,
    undeliverable: 0,
    risky: 0,
    pending: 0,
    unsubscribed: 0,
    duplicate_emails: 0,
  }) as Overview;

  const search = searchParams.q?.trim() || "";
  const status = searchParams.status || null;
  const duplicatesOnly = searchParams.view === "duplicates";
  const isFiltering = Boolean(search || status || duplicatesOnly);

  let companies: DomainCount[] = [];
  if (!migrationPending && !isFiltering && overview.total_contacts > 0) {
    const { data: domainData, error: domainError } = await supabase.rpc(
      "get_network_domain_counts",
    );
    if (domainError && !isMissingSchemaError(domainError)) throw domainError;
    companies = (domainData ?? []) as DomainCount[];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">My Network</h1>
      <p className="mb-8 text-sm text-gray-500">
        Manage, understand, and improve the health of your contact database.
      </p>

      {migrationPending ? (
        <div className="rounded-lg border border-dashed border-yellow-300 bg-yellow-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-yellow-900">
            My Network needs a database migration that hasn&apos;t been run yet.
          </p>
          <p className="mt-1 text-sm text-yellow-800">
            Run <code className="rounded bg-yellow-100 px-1 py-0.5">0008_network_health.sql</code>{" "}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : overview.total_contacts === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-900">No contacts yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Import your contacts to start building your network.
          </p>
          <Link
            href="/contacts"
            className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Import Contacts
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <KpiCard label="Total Contacts" value={overview.total_contacts} />
            <KpiCard label="Companies" value={overview.companies} />
            <KpiCard label="Deliverable" value={overview.deliverable} />
            <KpiCard label="Undeliverable" value={overview.undeliverable} />
            <KpiCard label="Risky" value={overview.risky} />
            <KpiCard label="Pending Verification" value={overview.pending} />
            <KpiCard label="Unsubscribed" value={overview.unsubscribed} />
          </div>

          <RecommendedActions
            pendingCount={overview.pending}
            undeliverableCount={overview.undeliverable}
            duplicateCount={overview.duplicate_emails}
          />

          <NetworkSearchFilters
            initialSearch={search}
            initialStatus={status}
            initialView={searchParams.view ?? null}
          />

          {isFiltering ? (
            <ContactsTable
              search={search}
              status={status}
              duplicatesOnly={duplicatesOnly}
              pageSize={25}
            />
          ) : companies.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">
              No companies yet.
            </p>
          ) : (
            <CompanyCardsGrid companies={companies} />
          )}
        </>
      )}
    </div>
  );
}
