import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";
import { isMissingSchemaError } from "@/lib/schemaGuard";
import { InviteMemberForm } from "./InviteMemberForm";
import { MemberRow, type OrgMember } from "./MemberRow";
import { BillingSection } from "./BillingSection";

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership(supabase);
  if (!membership) redirect("/dashboard");
  if (membership.role !== "admin") redirect("/dashboard");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name, plan_validation_quota, plan_send_quota")
    .eq("id", membership.organization_id)
    .single();
  if (orgError) throw orgError;

  const { data: members, error: membersError } = await supabase.rpc("get_org_members", {
    p_org_id: membership.organization_id,
  });
  if (membersError) throw membersError;

  const totalValidationQuota = (members as OrgMember[]).reduce(
    (sum, m) => sum + m.validation_quota,
    0,
  );
  const totalValidationUsed = (members as OrgMember[]).reduce(
    (sum, m) => sum + m.validation_used,
    0,
  );
  const totalSendQuota = (members as OrgMember[]).reduce((sum, m) => sum + m.send_quota, 0);
  const totalSendUsed = (members as OrgMember[]).reduce((sum, m) => sum + m.send_used, 0);
  const isSolo = (members as OrgMember[]).length === 1;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan_id, term_id, status")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (subscriptionError && !isMissingSchemaError(subscriptionError)) throw subscriptionError;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{org.name} — Team</h1>

      {isSolo && (
        <p className="mb-8 rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          You&apos;re currently the only member, so your quota is your
          organization&apos;s full quota below. Invite teammates to split it
          with them — each new member starts at 0 until you allocate some of
          this quota to them.
        </p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            {isSolo ? "Validations (your quota)" : "Validations (org-wide)"}
          </p>
          <p className="text-lg font-semibold text-gray-900">
            {totalValidationUsed} / {org.plan_validation_quota}
          </p>
          {!isSolo && (
            <p className="text-xs text-gray-400">
              {totalValidationQuota} allocated to members, {org.plan_validation_quota - totalValidationQuota} unallocated
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            {isSolo ? "Sends (your quota)" : "Sends (org-wide)"}
          </p>
          <p className="text-lg font-semibold text-gray-900">
            {totalSendUsed} / {org.plan_send_quota}
          </p>
          {!isSolo && (
            <p className="text-xs text-gray-400">
              {totalSendQuota} allocated to members, {org.plan_send_quota - totalSendQuota} unallocated
            </p>
          )}
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Plan &amp; billing</h2>
        <BillingSection
          currentPlanId={subscription?.plan_id ?? null}
          currentTermId={subscription?.term_id ?? null}
          status={subscription?.status ?? null}
        />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Invite a member</h2>
        <InviteMemberForm />
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Members</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium">Validation quota</th>
              <th className="px-4 py-2 font-medium">Send quota</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(members as OrgMember[]).map((m) => (
              <MemberRow key={m.membership_id} member={m} isSelf={m.user_id === user.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
