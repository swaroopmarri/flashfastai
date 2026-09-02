"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isPlatformOwner } from "@/lib/ownerAccess";

/**
 * Re-checked on every call, independent of whether the button that
 * triggered it should even be visible -- these actions bypass RLS via the
 * service-role client and can act on ANY organization, so the UI rendering
 * a button only for the owner is not the real security boundary.
 */
async function requireOwner(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformOwner(user.email)) {
    throw new Error("Not authorized.");
  }
}

/**
 * Sets an organization's plan quota directly -- for comping a customer,
 * granting extra credits outside a Razorpay plan, or correcting a stuck
 * value. This deliberately bypasses the normal "only the Razorpay webhook
 * writes quota" rule (see src/app/api/razorpay/webhook/route.ts) -- that
 * rule exists to stop a customer's browser from granting itself quota; the
 * owner acting here has full authority, there's no equivalent trust
 * problem.
 */
export async function setOrganizationQuota(
  organizationId: string,
  validationQuota: number,
  sendQuota: number,
): Promise<void> {
  await requireOwner();

  if (
    !Number.isInteger(validationQuota) ||
    !Number.isInteger(sendQuota) ||
    validationQuota < 0 ||
    sendQuota < 0
  ) {
    throw new Error("Quota values must be whole numbers, zero or greater.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ plan_validation_quota: validationQuota, plan_send_quota: sendQuota })
    .eq("id", organizationId);
  if (error) throw error;

  revalidatePath("/owner");
}

/**
 * Permanently deletes an organization and every one of its members'
 * accounts -- their contact lists, contacts, verification jobs, campaigns,
 * profile, and login. Works by deleting each member's actual auth user
 * (admin.auth.admin.deleteUser), which cascades all of that automatically
 * via the foreign keys already in the schema (contact_lists/campaigns/
 * profiles/memberships all reference auth.users ON DELETE CASCADE, and
 * organizations.owner_id does too -- deleting the owner cascades the
 * organization itself). Irreversible.
 *
 * The confirmName check is a misclick guard, not the real authorization --
 * requireOwner() above is.
 */
export async function deleteOrganization(
  organizationId: string,
  confirmName: string,
): Promise<void> {
  await requireOwner();

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single();
  if (orgError) throw orgError;

  if (confirmName.trim() !== org.name) {
    throw new Error("Organization name didn't match -- nothing was deleted.");
  }

  const { data: members, error: membersError } = await admin
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId);
  if (membersError) throw membersError;

  for (const member of members ?? []) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(member.user_id);
    if (deleteUserError) throw deleteUserError;
  }

  // Safety net -- deleting the owner above should already have cascaded
  // this away via organizations.owner_id's ON DELETE CASCADE, but delete it
  // explicitly too in case of an inconsistent edge case (e.g. an org whose
  // owner_id doesn't match any current membership row). Deleting zero rows
  // is not an error.
  const { error: orgDeleteError } = await admin.from("organizations").delete().eq("id", organizationId);
  if (orgDeleteError) throw orgDeleteError;

  revalidatePath("/owner");
}
