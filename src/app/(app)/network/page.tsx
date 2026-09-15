import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { companyDisplayName } from "@/lib/companyName";

interface DomainCount {
  domain: string;
  total: number;
  deliverable: number;
  risky: number;
  undeliverable: number;
  pending: number;
  unsubscribed: number;
  last_verified_at?: string | null;
}

const SORT_FIELDS = [
  "company",
  "total",
  "verified",
  "deliverable",
  "pending",
  "unsubscribed",
  "last_verified_at",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

const LAST_VERIFIED_FILTERS = ["never", "today", "7d", "30d", "older30"] as const;
type LastVerifiedFilter = (typeof LAST_VERIFIED_FILTERS)[number];

const LAST_VERIFIED_LABELS: Record<LastVerifiedFilter, string> = {
  never: "Never verified",
  today: "Verified today",
  "7d": "Verified within 7 days",
  "30d": "Verified within 30 days",
  older30: "Verified 30+ days ago",
};

interface Filters {
  totalMin?: number;
  verifiedMin?: number;
  deliverableMin?: number;
  pendingMin?: number;
  unsubscribedMin?: number;
  lastVerified?: LastVerifiedFilter;
}

function isSortField(v: string | undefined): v is SortField {
  return !!v && (SORT_FIELDS as readonly string[]).includes(v);
}

function isLastVerifiedFilter(v: string | undefined): v is LastVerifiedFilter {
  return !!v && (LAST_VERIFIED_FILTERS as readonly string[]).includes(v);
}

function parseMin(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function parseFilters(searchParams: Record<string, string | undefined>): Filters {
  return {
    totalMin: parseMin(searchParams.totalMin),
    verifiedMin: parseMin(searchParams.verifiedMin),
    deliverableMin: parseMin(searchParams.deliverableMin),
    pendingMin: parseMin(searchParams.pendingMin),
    unsubscribedMin: parseMin(searchParams.unsubscribedMin),
    lastVerified: isLastVerifiedFilter(searchParams.lastVerified)
      ? searchParams.lastVerified
      : undefined,
  };
}

function daysSinceVerified(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function matchesFilters(d: DomainCount, filters: Filters): boolean {
  const verified = d.total - d.pending;
  if (filters.totalMin !== undefined && d.total < filters.totalMin) return false;
  if (filters.verifiedMin !== undefined && verified < filters.verifiedMin) return false;
  if (filters.deliverableMin !== undefined && d.deliverable < filters.deliverableMin) return false;
  if (filters.pendingMin !== undefined && d.pending < filters.pendingMin) return false;
  if (filters.unsubscribedMin !== undefined && d.unsubscribed < filters.unsubscribedMin)
    return false;

  if (filters.lastVerified) {
    const days = daysSinceVerified(d.last_verified_at);
    switch (filters.lastVerified) {
      case "never":
        if (days !== null) return false;
        break;
      case "today":
        if (days === null || days > 0) return false;
        break;
      case "7d":
        if (days === null || days > 7) return false;
        break;
      case "30d":
        if (days === null || days > 30) return false;
        break;
      case "older30":
        if (days === null || days <= 30) return false;
        break;
    }
  }

  return true;
}

function hasActiveFilters(filters: Filters): boolean {
  return Object.values(filters).some((v) => v !== undefined);
}

function formatLastVerified(iso: string | null | undefined): string {
  const days = daysSinceVerified(iso);
  if (days === null) return "Never";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso as string).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortValue(d: DomainCount, field: SortField): number | string {
  switch (field) {
    case "company":
      return companyDisplayName(d.domain).toLowerCase();
    case "verified":
      return d.total - d.pending;
    case "last_verified_at":
      return d.last_verified_at ? new Date(d.last_verified_at).getTime() : 0;
    default:
      return d[field];
  }
}

function sortDomains(domains: DomainCount[], field: SortField, dir: "asc" | "desc"): DomainCount[] {
  const sorted = [...domains].sort((a, b) => {
    const av = sortValue(a, field);
    const bv = sortValue(b, field);
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function filterQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.totalMin !== undefined) params.set("totalMin", String(filters.totalMin));
  if (filters.verifiedMin !== undefined) params.set("verifiedMin", String(filters.verifiedMin));
  if (filters.deliverableMin !== undefined)
    params.set("deliverableMin", String(filters.deliverableMin));
  if (filters.pendingMin !== undefined) params.set("pendingMin", String(filters.pendingMin));
  if (filters.unsubscribedMin !== undefined)
    params.set("unsubscribedMin", String(filters.unsubscribedMin));
  if (filters.lastVerified) params.set("lastVerified", filters.lastVerified);
  return params.toString();
}

function SortHeader({
  field,
  label,
  align = "right",
  activeSort,
  activeDir,
  filterQuery,
}: {
  field: SortField;
  label: string;
  align?: "left" | "right";
  activeSort: SortField;
  activeDir: "asc" | "desc";
  filterQuery: string;
}) {
  const isActive = activeSort === field;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";
  const href = `/network?sort=${field}&dir=${nextDir}${filterQuery ? `&${filterQuery}` : ""}`;
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={href}
        className={`inline-flex items-center gap-0.5 hover:text-gray-900 ${isActive ? "text-gray-900" : ""}`}
      >
        {label}
        {isActive && <span className="text-[10px]">{activeDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}

function FilterInput({ name, label, value }: { name: string; label: string; value?: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <input
        type="number"
        name={name}
        min={0}
        defaultValue={value ?? ""}
        placeholder="Min"
        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
      />
    </label>
  );
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_network_domain_counts");
  if (error) throw error;

  const rawDomains = (data ?? []) as DomainCount[];
  const deliverableDomains = rawDomains.filter((d) => d.deliverable > 0);

  const sort: SortField = isSortField(searchParams.sort) ? searchParams.sort : "company";
  const dir: "asc" | "desc" = searchParams.dir === "desc" ? "desc" : "asc";
  const filters = parseFilters(searchParams);
  const filtered = deliverableDomains.filter((d) => matchesFilters(d, filters));
  const domains = sortDomains(filtered, sort, dir);
  const filterQuery = filterQueryString(filters);
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">My Network</h1>

      {deliverableDomains.length === 0 ? (
        <p className="text-sm text-gray-500">
          {rawDomains.length === 0 ? (
            <>
              No contacts yet.{" "}
              <Link href="/contacts" className="text-indigo-600 hover:underline">
                Upload a contact list
              </Link>{" "}
              to see companies here.
            </>
          ) : (
            <>
              No companies with deliverable contacts yet. Once a company&apos;s contacts are
              verified as deliverable, it&apos;ll show up here.
            </>
          )}
        </p>
      ) : (
        <>
          <form
            method="get"
            className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <FilterInput name="totalMin" label="Total" value={filters.totalMin} />
            <FilterInput name="verifiedMin" label="Verified" value={filters.verifiedMin} />
            <FilterInput name="deliverableMin" label="Deliverable" value={filters.deliverableMin} />
            <FilterInput name="pendingMin" label="Pending" value={filters.pendingMin} />
            <FilterInput
              name="unsubscribedMin"
              label="Unsubscribed"
              value={filters.unsubscribedMin}
            />
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Last Verified
              <select
                name="lastVerified"
                defaultValue={filters.lastVerified ?? ""}
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
              >
                <option value="">Any</option>
                {LAST_VERIFIED_FILTERS.map((f) => (
                  <option key={f} value={f}>
                    {LAST_VERIFIED_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Filter
            </button>
            {filtersActive && (
              <Link
                href={`/network?sort=${sort}&dir=${dir}`}
                className="text-sm text-gray-500 hover:underline"
              >
                Clear filters
              </Link>
            )}
          </form>

          {filtersActive && (
            <p className="mb-3 text-xs text-gray-500">
              Showing {domains.length} of {deliverableDomains.length} companies.
            </p>
          )}

          {domains.length === 0 ? (
            <p className="text-sm text-gray-500">No companies match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <SortHeader
                      field="company"
                      label="Company"
                      align="left"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="total"
                      label="Total"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="verified"
                      label="Verified"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="deliverable"
                      label="Deliverable"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="pending"
                      label="Pending"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="unsubscribed"
                      label="Unsubscribed"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <SortHeader
                      field="last_verified_at"
                      label="Last Verified"
                      align="left"
                      activeSort={sort}
                      activeDir={dir}
                      filterQuery={filterQuery}
                    />
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {domains.map((d) => {
                    const verified = d.total - d.pending;
                    return (
                      <tr key={d.domain} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <Link
                            href={`/network/${d.domain}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {companyDisplayName(d.domain)}
                          </Link>
                          {d.pending > 0 && (
                            <span
                              className="ml-1.5 text-xs font-medium text-yellow-700"
                              title={`${d.pending} pending verification`}
                            >
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{d.total}</td>
                        <td
                          className="px-3 py-1.5 text-right text-gray-700"
                          title={`${verified} of ${d.total} contacts have been verified`}
                        >
                          {verified}/{d.total}
                        </td>
                        <td className="px-3 py-1.5 text-right text-green-700">{d.deliverable}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">
                          {d.pending || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-400">
                          {d.unsubscribed || "—"}
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-1.5 text-gray-500"
                          title={
                            d.last_verified_at
                              ? new Date(d.last_verified_at).toLocaleString()
                              : undefined
                          }
                        >
                          {formatLastVerified(d.last_verified_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          <Link
                            href={`/network/${d.domain}`}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                            title="Verify this company's pending contacts"
                          >
                            Verify
                          </Link>
                          <span className="mx-1.5 text-gray-300">·</span>
                          <a
                            href={`/api/network/${d.domain}/export`}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                            title="Download this company's contacts as CSV"
                          >
                            Download
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
