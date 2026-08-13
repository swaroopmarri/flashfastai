import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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
    <div className="mx-auto max-w-3xl px-4 py-10">
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
        <div className="space-y-4">
          {domains.map((d) => (
            <Link
              key={d.domain}
              href={`/network/${d.domain}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">{d.domain}</h3>
                  {d.pending > 0 && (
                    <p className="mt-0.5 text-xs font-medium text-yellow-700">
                      ⚠ Needs attention — {d.pending} pending verification
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500">{d.total} contacts</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {d.deliverable > 0 && (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    {d.deliverable} deliverable
                  </span>
                )}
                {d.risky > 0 && (
                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
                    {d.risky} risky
                  </span>
                )}
                {d.undeliverable > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                    {d.undeliverable} undeliverable
                  </span>
                )}
                {d.pending > 0 && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {d.pending} pending
                  </span>
                )}
                {d.unsubscribed > 0 && (
                  <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
                    {d.unsubscribed} unsubscribed
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
