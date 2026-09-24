import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VerifyPanel } from "../../_components/VerifyPanel";
import { Pagination } from "../../_components/Pagination";
import { createCompanyCampaign } from "../../campaigns/actions";
import { companyDisplayName } from "@/lib/companyName";
import { escapeIlike } from "@/lib/searchFilter";

const PAGE_SIZE = 100;

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-gray-100 text-gray-700",
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
  unsubscribed: "bg-gray-200 text-gray-500",
};

interface DomainContact {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  list_names: string[];
}

interface DomainCounts {
  domain: string;
  total: number;
  pending: number;
}

export default async function NetworkDomainPage({
  params,
  searchParams,
}: {
  params: { domain: string };
  searchParams: { page?: string; q?: string };
}) {
  const domain = decodeURIComponent(params.domain);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Aggregate counts for the WHOLE domain (unaffected by search/paging) --
  // reuses the same aggregate the My Network overview page already computes,
  // instead of pulling every contact just to count them.
  const { data: domainCounts } = await supabase
    .rpc("get_network_domain_counts")
    .eq("domain", domain)
    .maybeSingle<DomainCounts>();
  const total_count = domainCounts?.total ?? 0;
  const pendingCount = domainCounts?.pending ?? 0;
  const verifiedCount = total_count - pendingCount;

  let query = supabase.rpc(
    "get_network_domain_contacts",
    { p_domain: domain },
    { count: "exact" },
  );
  if (q) {
    const term = `%${escapeIlike(q)}%`;
    query = query.or(`email.ilike.${term},name.ilike.${term},company.ilike.${term}`);
  }

  const {
    data: contacts,
    count,
    error,
  } = await query.order("email", { ascending: true }).range(from, to);
  if (error) throw error;

  const matchedCount = count ?? 0;

  const { data: activeJob } = await supabase
    .from("verification_jobs")
    .select("id, status")
    .eq("company_domain", domain)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const createCampaignForDomain = createCompanyCampaign.bind(null, domain);

  function buildHref(nextPage: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return `/network/${params.domain}${qs ? `?${qs}` : ""}`;
  }

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

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <VerifyPanel
          target={{ type: "company", domain }}
          pendingCount={pendingCount}
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

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">
          {q ? (
            <>
              Contacts matching &quot;{q}&quot; ({matchedCount})
            </>
          ) : (
            <>Contacts ({total_count})</>
          )}
          {!q && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {verifiedCount} of {total_count} verified
            </span>
          )}
        </h2>
        <a
          href={`/api/network/${domain}/export`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download CSV
        </a>
      </div>

      <form action={`/network/${params.domain}`} className="mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by email, name, or company"
          className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Search
        </button>
        {q && (
          <Link
            href={`/network/${params.domain}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Lists</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {((contacts ?? []) as DomainContact[]).map((c) => (
              <tr key={c.email}>
                <td className="px-4 py-2 text-gray-900">{c.email}</td>
                <td className="px-4 py-2 text-gray-600">{c.name || "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {c.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.list_names.map((name) => (
                      <span
                        key={name}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {(contacts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No contacts match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={matchedCount} buildHref={buildHref} />
      </div>
    </div>
  );
}
