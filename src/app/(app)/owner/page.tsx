import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isPlatformOwner } from "@/lib/ownerAccess";
import { isMissingSchemaError } from "@/lib/schemaGuard";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  created: "bg-gray-100 text-gray-500",
  authenticated: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
  halted: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
  completed: "bg-gray-100 text-gray-400",
  expired: "bg-gray-100 text-gray-400",
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString("en-IN")}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function OwnerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isPlatformOwner(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    usersResult,
    orgsResult,
    subscriptionsResult,
    membershipsResult,
    totalVerifiedResult,
    verified30dResult,
    totalSentResult,
    sent30dResult,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("organizations")
      .select("id, name, created_at, plan_validation_quota, plan_send_quota"),
    admin.from("subscriptions").select("organization_id, plan_id, term_id, currency, status"),
    admin.from("memberships").select("organization_id, validation_used, send_used"),
    admin.from("contacts").select("*", { count: "exact", head: true }).not("verified_at", "is", null),
    admin
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .not("verified_at", "is", null)
      .gte("verified_at", thirtyDaysAgo),
    admin.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("status", "sent"),
    admin
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", thirtyDaysAgo),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (orgsResult.error) throw orgsResult.error;
  if (subscriptionsResult.error && !isMissingSchemaError(subscriptionsResult.error)) {
    throw subscriptionsResult.error;
  }
  if (membershipsResult.error) throw membershipsResult.error;
  if (totalVerifiedResult.error) throw totalVerifiedResult.error;
  if (verified30dResult.error) throw verified30dResult.error;
  if (totalSentResult.error) throw totalSentResult.error;
  if (sent30dResult.error) throw sent30dResult.error;

  const users = usersResult.data.users;
  const organizations = orgsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];

  const activeLast30d = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(thirtyDaysAgo),
  ).length;

  const subscriptionByOrg = new Map(subscriptions.map((s) => [s.organization_id, s]));
  const usageByOrg = new Map<string, { validationUsed: number; sendUsed: number }>();
  for (const m of memberships) {
    const existing = usageByOrg.get(m.organization_id) ?? { validationUsed: 0, sendUsed: 0 };
    existing.validationUsed += m.validation_used;
    existing.sendUsed += m.send_used;
    usageByOrg.set(m.organization_id, existing);
  }

  const orgRows = organizations
    .map((org) => {
      const subscription = subscriptionByOrg.get(org.id);
      const usage = usageByOrg.get(org.id) ?? { validationUsed: 0, sendUsed: 0 };
      return {
        id: org.id as string,
        name: org.name as string,
        createdAt: org.created_at as string,
        planValidationQuota: org.plan_validation_quota as number,
        planSendQuota: org.plan_send_quota as number,
        validationUsed: usage.validationUsed,
        sendUsed: usage.sendUsed,
        planId: subscription?.plan_id ?? null,
        termId: subscription?.term_id ?? null,
        currency: subscription?.currency ?? null,
        subscriptionStatus: subscription?.status ?? null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Owner Dashboard</h1>
      <p className="mb-8 text-sm text-gray-500">
        Platform-wide data across every organization — not visible to
        customers, gated to a single owner email.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Organizations" value={organizations.length} />
        <StatCard label="Users" value={users.length} />
        <StatCard label="Active (30d)" value={activeLast30d} />
        <StatCard
          label="Verifications"
          value={totalVerifiedResult.count ?? 0}
          sub={`${verified30dResult.count ?? 0} in last 30d`}
        />
        <StatCard
          label="Emails sent"
          value={totalSentResult.count ?? 0}
          sub={`${sent30dResult.count ?? 0} in last 30d`}
        />
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Organizations</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Organization</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Validations</th>
              <th className="px-4 py-2 font-medium">Sends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orgRows.map((org) => {
              const validationPct = org.planValidationQuota
                ? Math.round((org.validationUsed / org.planValidationQuota) * 100)
                : 0;
              const sendPct = org.planSendQuota
                ? Math.round((org.sendUsed / org.planSendQuota) * 100)
                : 0;
              return (
                <tr key={org.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{org.name}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {org.planId ? `${org.planId} — ${org.termId} (${org.currency})` : "No subscription"}
                  </td>
                  <td className="px-4 py-2">
                    {org.subscriptionStatus ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[org.subscriptionStatus] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {org.subscriptionStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2 ${
                      validationPct >= 80 ? "font-medium text-amber-600" : "text-gray-700"
                    }`}
                  >
                    {org.validationUsed} / {org.planValidationQuota} ({validationPct}%)
                  </td>
                  <td
                    className={`px-4 py-2 ${
                      sendPct >= 80 ? "font-medium text-amber-600" : "text-gray-700"
                    }`}
                  >
                    {org.sendUsed} / {org.planSendQuota} ({sendPct}%)
                  </td>
                </tr>
              );
            })}
            {orgRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Recent signups</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Signed up</th>
              <th className="px-4 py-2 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 text-gray-900">{u.email}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never logged in"}
                </td>
              </tr>
            ))}
            {recentUsers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
