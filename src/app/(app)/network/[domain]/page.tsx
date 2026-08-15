import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VerifyPanel } from "../../_components/VerifyPanel";
import { createCompanyCampaign } from "../../campaigns/actions";
import { companyDisplayName } from "@/lib/companyName";

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

  const { data, error } = await supabase.rpc("get_network_domain_contacts", {
    p_domain: domain,
  });
  if (error) throw error;

  const contacts = (data ?? []) as DomainContact[];
  const pendingCount = contacts.filter((c) => c.status === "pending_verification").length;

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

      <h2 className="mb-3 text-lg font-medium text-gray-900">
        Contacts ({contacts.length})
      </h2>
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
            {contacts.map((c) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
