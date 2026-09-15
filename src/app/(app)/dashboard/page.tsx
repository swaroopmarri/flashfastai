import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";
import { isPlatformOwner } from "@/lib/ownerAccess";
import { isMissingSchemaError } from "@/lib/schemaGuard";
import { ReferralCodeBox } from "../account/ReferralCodeBox";

function UsageBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>
          {used} / {quota}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (isPlatformOwner(user.email)) {
    redirect("/owner");
  }

  const membership = await getCurrentMembership(supabase);

  let referralCode: string | null = null;
  const { data: codeData, error: codeError } = await supabase.rpc("ensure_referral_code");
  if (codeError) {
    if (!isMissingSchemaError(codeError)) throw codeError;
  } else {
    referralCode = codeData;
  }

  const host = headers().get("host");
  const shareUrl = referralCode ? `https://${host}/login?ref=${referralCode}` : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-600">
        Signed in as <span className="font-medium">{user.email}</span>
      </p>

      {membership ? (
        <div className="mb-8 space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <UsageBar
            label="Validations used this month"
            used={membership.validation_used}
            quota={membership.validation_quota}
          />
          <UsageBar
            label="Sends used this month"
            used={membership.send_used}
            quota={membership.send_quota}
          />
        </div>
      ) : (
        <p className="mb-8 text-sm text-gray-500">
          You&apos;re not part of an organization yet.
        </p>
      )}

      {referralCode && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-gray-900">Refer a friend</h2>
          <p className="mb-3 text-sm text-gray-600">
            Share your link. When someone you refer subscribes to Growth, Pro, or Scale for the
            first time, you get a one-time Starter-level quota bonus (3,500 validations + 3,500
            sends) added to your account for that billing cycle.
          </p>
          <ReferralCodeBox code={referralCode} shareUrl={shareUrl} />
        </div>
      )}
    </div>
  );
}
