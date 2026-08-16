import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ResubscribeButton } from "../_components/ResubscribeButton";

interface UndeliverableRow {
  email: string;
  zerobounce_sub_status: string | null;
}

interface UnsubscribeRow {
  email: string;
  unsubscribed_at: string;
  reason: string;
  campaigns: { name: string } | null;
}

function dedupeByEmail(rows: UndeliverableRow[]): UndeliverableRow[] {
  const byEmail = new Map<string, UndeliverableRow>();
  for (const row of rows) byEmail.set(row.email.toLowerCase(), row);
  return Array.from(byEmail.values());
}

function groupByReason(rows: UndeliverableRow[]): Map<string, UndeliverableRow[]> {
  const groups = new Map<string, UndeliverableRow[]>();
  for (const row of rows) {
    const reason = row.zerobounce_sub_status || "unknown";
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason)!.push(row);
  }
  return new Map(Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DownloadLink({ type }: { type: "complaints" | "unsubscribed" | "bounced" }) {
  return (
    <a
      href={`/api/suppression/export?type=${type}`}
      className="text-xs font-medium text-indigo-600 hover:underline"
    >
      Download CSV
    </a>
  );
}

export default async function SuppressionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: undeliverableData, error: undeliverableError }, { data: unsubData, error: unsubError }] =
    await Promise.all([
      supabase.from("contacts").select("email, zerobounce_sub_status").eq("status", "undeliverable"),
      supabase
        .from("unsubscribes")
        .select("email, unsubscribed_at, reason, campaigns(name)")
        .eq("user_id", user.id)
        .order("unsubscribed_at", { ascending: false }),
    ]);
  if (undeliverableError) throw undeliverableError;
  if (unsubError) throw unsubError;

  const bounceGroups = groupByReason(dedupeByEmail((undeliverableData ?? []) as UndeliverableRow[]));
  const allUnsubs = (unsubData ?? []) as unknown as UnsubscribeRow[];
  const unsubscribed = allUnsubs.filter((r) => r.reason !== "complaint");
  const complaints = allUnsubs.filter((r) => r.reason === "complaint");

  const totalBounced = Array.from(bounceGroups.values()).reduce((n, rows) => n + rows.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Suppression List</h1>
      <p className="mb-8 text-sm text-gray-500">
        Every email address that will never be sent a campaign, and why —
        bounced/undeliverable, unsubscribed, and (if your SES setup reports
        it) spam complaints.
      </p>

      {/* Spam complaints -- highest risk, shown first */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Spam complaints
            <span className="font-normal text-gray-400">({complaints.length})</span>
          </h2>
          {complaints.length > 0 && <DownloadLink type="complaints" />}
        </div>
        {complaints.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-sm text-gray-400">
            No spam complaints reported.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-orange-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-orange-100 text-sm">
              <thead>
                <tr className="bg-orange-50 text-left text-gray-500">
                  <th className="px-3 py-1.5 font-medium">Email</th>
                  <th className="px-3 py-1.5 font-medium">Complained</th>
                  <th className="px-3 py-1.5 font-medium">Campaign</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {complaints.map((r) => (
                  <tr key={r.email} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-900">{r.email}</td>
                    <td className="px-3 py-1.5 text-gray-600">{formatDate(r.unsubscribed_at)}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.campaigns?.name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      <ResubscribeButton email={r.email} unsubscribedAt={r.unsubscribed_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Unsubscribed */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            Unsubscribed
            <span className="font-normal text-gray-400">({unsubscribed.length})</span>
          </h2>
          {unsubscribed.length > 0 && <DownloadLink type="unsubscribed" />}
        </div>
        {unsubscribed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-sm text-gray-400">
            No unsubscribes yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-1.5 font-medium">Email</th>
                  <th className="px-3 py-1.5 font-medium">Unsubscribed</th>
                  <th className="px-3 py-1.5 font-medium">From campaign</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unsubscribed.map((r) => (
                  <tr key={r.email} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-900">{r.email}</td>
                    <td className="px-3 py-1.5 text-gray-600">{formatDate(r.unsubscribed_at)}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.campaigns?.name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      <ResubscribeButton email={r.email} unsubscribedAt={r.unsubscribed_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bounced / undeliverable */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Bounced / undeliverable
            <span className="font-normal text-gray-400">({totalBounced})</span>
          </h2>
          {totalBounced > 0 && <DownloadLink type="bounced" />}
        </div>
        {bounceGroups.size === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-sm text-gray-400">
            No bounced contacts.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-red-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-red-100 text-sm">
              <thead>
                <tr className="bg-red-50 text-left text-gray-500">
                  <th className="px-3 py-1.5 font-medium">Email</th>
                  <th className="px-3 py-1.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array.from(bounceGroups.entries()).map(([reason, rows]) =>
                  rows.map((r) => (
                    <tr key={r.email} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{r.email}</td>
                      <td className="px-3 py-1.5 text-gray-600">{reason.replace(/_/g, " ")}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
