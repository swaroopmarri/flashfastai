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
}

export default async function NetworkPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_network_domain_counts");
  if (error) throw error;

  const domains = (data ?? []) as DomainCount[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">My Network</h1>
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
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Deliverable</th>
                <th className="px-3 py-2 text-right font-medium">Undeliverable</th>
                <th className="px-3 py-2 text-right font-medium">Risky</th>
                <th className="px-3 py-2 text-right font-medium">Pending</th>
                <th className="px-3 py-2 text-right font-medium">Unsubscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {domains.map((d) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
