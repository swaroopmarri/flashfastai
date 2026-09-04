import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isPlatformOwner } from "@/lib/ownerAccess";
import { isMissingSchemaError } from "@/lib/schemaGuard";
import { getTerm, type CurrencyCode, type TermId } from "@/lib/pricingPlans";
import { verificationCostInr, sendCostInr, USD_TO_INR_RATE } from "@/lib/providerCosts";
import { OrgRow, type OrgRowData } from "./OrgRow";
import { TrendChart, type TrendPoint } from "./TrendChart";

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString("en-IN")}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function MrrCard({ currency, amount }: { currency: "INR" | "USD"; amount: number }) {
  const formatted =
    currency === "INR"
      ? `₹${Math.round(amount).toLocaleString("en-IN")}`
      : `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">MRR ({currency})</p>
      <p className="text-2xl font-semibold text-gray-900">{formatted}</p>
      <p className="text-xs text-gray-400">Ex-GST, active subscriptions only</p>
    </div>
  );
}

/** Monthly-equivalent revenue (ex-GST) for one org's active subscription, or
 * null if it has none / isn't active / references a plan-term combo that no
 * longer exists in pricingPlans.ts. */
function monthlyRevenueExGst(org: OrgRowData): number | null {
  if (org.subscriptionStatus !== "active" || !org.planId || !org.termId || !org.currency) {
    return null;
  }
  const term = getTerm(org.planId, org.currency as CurrencyCode, org.termId as TermId);
  return term ? term.totalPriceExGst / term.months : null;
}

/** Buckets ISO timestamps into UTC-day counts covering the last `days` days
 * (oldest first), including days with zero activity. */
function bucketByDay(timestamps: string[], days: number): TrendPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ts of timestamps) {
    const day = ts.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
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
      .select("verified_at")
      .not("verified_at", "is", null)
      .gte("verified_at", thirtyDaysAgo),
    admin.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("status", "sent"),
    admin
      .from("campaign_recipients")
      .select("sent_at")
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

  const abuseReportsResult = await admin
    .from("abuse_reports")
    .select("id, reporter_email, recipient_email, sender_email, subject, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (abuseReportsResult.error && !isMissingSchemaError(abuseReportsResult.error)) {
    throw abuseReportsResult.error;
  }
  const abuseReports = abuseReportsResult.data ?? [];

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

  const mrrByCurrency = new Map<CurrencyCode, number>();
  for (const org of orgRows) {
    const monthly = monthlyRevenueExGst(org);
    if (monthly !== null) {
      mrrByCurrency.set(
        org.currency as CurrencyCode,
        (mrrByCurrency.get(org.currency as CurrencyCode) ?? 0) + monthly,
      );
    }
  }

  const dailyVerifications = bucketByDay(
    (verified30dResult.data ?? []).map((r) => r.verified_at as string),
    30,
  );
  const dailySends = bucketByDay(
    (sent30dResult.data ?? []).map((r) => r.sent_at as string),
    30,
  );
  const verified30dCount = dailyVerifications.reduce((sum, d) => sum + d.count, 0);
  const sent30dCount = dailySends.reduce((sum, d) => sum + d.count, 0);

  const cost30dInr = verificationCostInr(verified30dCount) + sendCostInr(sent30dCount);
  const revenue30dInr =
    (mrrByCurrency.get("INR") ?? 0) + (mrrByCurrency.get("USD") ?? 0) * USD_TO_INR_RATE;
  const margin30dInr = revenue30dInr - cost30dInr;
  const marginPct30d = revenue30dInr > 0 ? (margin30dInr / revenue30dInr) * 100 : null;

  const paymentIssues = orgRows.filter(
    (o) => o.subscriptionStatus === "halted" || o.subscriptionStatus === "pending",
  );
  const quotaAlerts = orgRows.filter((o) => {
    const validationPct = o.planValidationQuota ? o.validationUsed / o.planValidationQuota : 0;
    const sendPct = o.planSendQuota ? o.sendUsed / o.planSendQuota : 0;
    return validationPct >= 0.9 || sendPct >= 0.9;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Owner Dashboard</h1>
      <p className="mb-8 text-sm text-gray-500">
        Platform-wide data across every organization — not visible to
        customers, gated to a single owner email.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <MrrCard currency="INR" amount={mrrByCurrency.get("INR") ?? 0} />
        <MrrCard currency="USD" amount={mrrByCurrency.get("USD") ?? 0} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Est. revenue (30d)</p>
          <p className="text-2xl font-semibold text-gray-900">
            ₹{Math.round(revenue30dInr).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-400">MRR, INR + USD blended at ₹{USD_TO_INR_RATE}/USD</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Est. provider cost (30d)</p>
          <p className="text-2xl font-semibold text-gray-900">
            ₹{Math.round(cost30dInr).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-400">MillionVerifier + AWS SES, actual usage</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Est. margin (30d)</p>
          <p className="text-2xl font-semibold text-gray-900">
            ₹{Math.round(margin30dInr).toLocaleString("en-IN")}
            {marginPct30d !== null && (
              <span className="ml-1 text-base font-normal text-gray-400">
                ({marginPct30d.toFixed(0)}%)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">Rough estimate -- ignores non-provider overhead</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Organizations" value={organizations.length} />
        <StatCard label="Users" value={users.length} />
        <StatCard label="Active (30d)" value={activeLast30d} />
        <StatCard
          label="Verifications"
          value={totalVerifiedResult.count ?? 0}
          sub={`${verified30dCount} in last 30d`}
        />
        <StatCard
          label="Emails sent"
          value={totalSentResult.count ?? 0}
          sub={`${sent30dCount} in last 30d`}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart title="Verifications per day" color="blue" data={dailyVerifications} />
        <TrendChart title="Emails sent per day" color="orange" data={dailySends} />
      </div>

      {(paymentIssues.length > 0 || quotaAlerts.length > 0) && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-gray-900">Needs attention</h2>
          <div className="space-y-2">
            {paymentIssues.map((org) => (
              <div
                key={`payment-${org.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm"
              >
                <span className="font-medium text-red-900">{org.name}</span>
                <span className="text-red-700">
                  Subscription {org.subscriptionStatus} — payment failing, quota frozen
                </span>
              </div>
            ))}
            {quotaAlerts.map((org) => (
              <div
                key={`quota-${org.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm"
              >
                <span className="font-medium text-amber-900">{org.name}</span>
                <span className="text-amber-700">
                  {org.validationUsed}/{org.planValidationQuota} validations,{" "}
                  {org.sendUsed}/{org.planSendQuota} sends — near quota
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {abuseReports.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-gray-900">Abuse reports</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Reported</th>
                  <th className="px-4 py-2 font-medium">Reporter</th>
                  <th className="px-4 py-2 font-medium">Recipient</th>
                  <th className="px-4 py-2 font-medium">Sender</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {abuseReports.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{r.reporter_email}</td>
                    <td className="px-4 py-2 text-gray-900">{r.recipient_email}</td>
                    <td className="px-4 py-2 text-gray-500">{r.sender_email ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orgRows.map((org) => (
              <OrgRow key={org.id} org={org} />
            ))}
            {orgRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
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
