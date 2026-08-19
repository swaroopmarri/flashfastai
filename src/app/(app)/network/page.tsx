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
  "undeliverable",
  "risky",
  "pending",
  "unsubscribed",
  "last_verified_at",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function isSortField(v: string | undefined): v is SortField {
  return !!v && (SORT_FIELDS as readonly string[]).includes(v);
}

// One-touch WhatsApp contact link -- a single fixed number, not per-contact
// (contacts don't store a phone number today).
const WHATSAPP_NUMBER = "14106700167";
const WHATSAPP_MESSAGE = "Hi, I have a question about my contacts.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

function formatLastVerified(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
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

function SortHeader({
  field,
  label,
  align = "right",
  activeSort,
  activeDir,
}: {
  field: SortField;
  label: string;
  align?: "left" | "right";
  activeSort: SortField;
  activeDir: "asc" | "desc";
}) {
  const isActive = activeSort === field;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={`/network?sort=${field}&dir=${nextDir}`}
        className={`inline-flex items-center gap-0.5 hover:text-gray-900 ${isActive ? "text-gray-900" : ""}`}
      >
        {label}
        {isActive && <span className="text-[10px]">{activeDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_network_domain_counts");
  if (error) throw error;

  const sort: SortField = isSortField(searchParams.sort) ? searchParams.sort : "total";
  const dir: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";
  const domains = sortDomains((data ?? []) as DomainCount[], sort, dir);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">My Network</h1>
        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
        >
          💬 Chat on WhatsApp
        </a>
      </div>
      <p className="mb-8 text-sm text-gray-500">
        Every contact across all your lists, grouped by company (email
        domain), deduplicated by email address.
      </p>

      {domains.length === 0 ? (
        <p className="text-sm text-gray-500">
          No contacts yet.{" "}
          <Link href="/contacts" className="text-indigo-600 hover:underline">
            Upload a contact list
          </Link>{" "}
          to see companies here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <SortHeader field="company" label="Company" align="left" activeSort={sort} activeDir={dir} />
                <SortHeader field="total" label="Total" activeSort={sort} activeDir={dir} />
                <SortHeader field="verified" label="Verified" activeSort={sort} activeDir={dir} />
                <SortHeader field="deliverable" label="Deliverable" activeSort={sort} activeDir={dir} />
                <SortHeader field="undeliverable" label="Undeliverable" activeSort={sort} activeDir={dir} />
                <SortHeader field="risky" label="Risky" activeSort={sort} activeDir={dir} />
                <SortHeader field="pending" label="Pending" activeSort={sort} activeDir={dir} />
                <SortHeader field="unsubscribed" label="Unsubscribed" activeSort={sort} activeDir={dir} />
                <SortHeader
                  field="last_verified_at"
                  label="Last Verified"
                  align="left"
                  activeSort={sort}
                  activeDir={dir}
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
                      <span className="ml-1.5 text-xs text-gray-400">{d.domain}</span>
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
                    <td className="px-3 py-1.5 text-right text-green-700">
                      {d.deliverable || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-red-700">
                      {d.undeliverable || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-yellow-700">{d.risky || "—"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{d.pending || "—"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-400">
                      {d.unsubscribed || "—"}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-1.5 text-gray-500"
                      title={d.last_verified_at ? new Date(d.last_verified_at).toLocaleString() : undefined}
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
    </div>
  );
}
