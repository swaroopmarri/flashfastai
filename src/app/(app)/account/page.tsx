import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isMissingSchemaError } from "@/lib/schemaGuard";
import { ProfileForm, type ProfileValues } from "./ProfileForm";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { ReferralCodeBox } from "./ReferralCodeBox";

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending first payment",
  rewarded: "Rewarded",
  ineligible: "Not eligible (Starter plan)",
  reversed: "Reversed (refunded)",
};

const REFERRAL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  rewarded: "bg-green-100 text-green-700",
  ineligible: "bg-gray-100 text-gray-400",
  reversed: "bg-red-100 text-red-700",
};

const EMPTY_PROFILE: ProfileValues = {
  firstName: "",
  lastName: "",
  yearsExperience: "",
};

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let profile: ProfileValues = EMPTY_PROFILE;
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, years_experience")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && !isMissingSchemaError(error)) throw error;
  if (data) {
    profile = {
      firstName: data.first_name,
      lastName: data.last_name,
      yearsExperience: data.years_experience,
    };
  }

  let referralCode: string | null = null;
  let referrals: { id: string; status: string; reward_validation_amount: number | null; created_at: string }[] = [];
  const { data: codeData, error: codeError } = await supabase.rpc("ensure_referral_code");
  if (codeError) {
    if (!isMissingSchemaError(codeError)) throw codeError;
  } else {
    referralCode = codeData;
    const { data: referralsData, error: referralsError } = await supabase
      .from("referrals")
      .select("id, status, reward_validation_amount, created_at")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });
    if (referralsError) throw referralsError;
    referrals = referralsData ?? [];
  }

  const host = headers().get("host");
  const shareUrl = referralCode ? `https://${host}/login?ref=${referralCode}` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Account</h1>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Profile</h2>
        <ProfileForm initial={profile} />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Office email</h2>
        <ChangeEmailForm currentEmail={user.email ?? ""} />
      </div>

      {referralCode && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-medium text-gray-900">Refer a friend</h2>
          <p className="mb-3 text-sm text-gray-600">
            Share your link. When someone you refer subscribes to Growth, Pro, or Scale for the
            first time, you get a one-time Starter-level quota bonus (3,500 validations + 3,500
            sends) added to your account for that billing cycle.
          </p>
          <ReferralCodeBox code={referralCode} shareUrl={shareUrl} />

          {referrals.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-gray-500">Your referrals</p>
              <div className="space-y-1.5">
                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        REFERRAL_STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {REFERRAL_STATUS_LABELS[r.status] ?? r.status}
                      {r.status === "rewarded" && r.reward_validation_amount
                        ? ` (+${r.reward_validation_amount.toLocaleString("en-IN")})`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
