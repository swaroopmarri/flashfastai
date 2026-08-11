"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only an organization admin can do this.");
  }
  return membership;
}

export async function createInvite(email: string): Promise<{ url: string }> {
  const supabase = createClient();
  const membership = await requireAdmin(supabase);
  const origin = headers().get("origin");

  const token = randomBytes(24).toString("hex");

  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase.from("invites").insert({
    organization_id: membership.organization_id,
    email: email.trim().toLowerCase(),
    token,
    invited_by: user.user!.id,
  });

  if (error) throw error;

  revalidatePath("/team");
  return { url: `${origin}/invite/${token}` };
}

export async function updateMemberQuota(
  membershipId: string,
  validationQuota: number,
  sendQuota: number,
) {
  const supabase = createClient();
  const membership = await requireAdmin(supabase);

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("plan_validation_quota, plan_send_quota")
    .eq("id", membership.organization_id)
    .single();
  if (orgError) throw orgError;

  const { data: others, error: othersError } = await supabase
    .from("memberships")
    .select("id, validation_quota, send_quota")
    .eq("organization_id", membership.organization_id)
    .neq("id", membershipId);
  if (othersError) throw othersError;

  const othersValidation = others.reduce((sum, m) => sum + m.validation_quota, 0);
  const othersSend = others.reduce((sum, m) => sum + m.send_quota, 0);

  if (othersValidation + validationQuota > org.plan_validation_quota) {
    throw new Error(
      `That validation quota would exceed the organization's total (${org.plan_validation_quota}). Remaining: ${org.plan_validation_quota - othersValidation}.`,
    );
  }
  if (othersSend + sendQuota > org.plan_send_quota) {
    throw new Error(
      `That send quota would exceed the organization's total (${org.plan_send_quota}). Remaining: ${org.plan_send_quota - othersSend}.`,
    );
  }

  const { error } = await supabase
    .from("memberships")
    .update({ validation_quota: validationQuota, send_quota: sendQuota })
    .eq("id", membershipId);
  if (error) throw error;

  revalidatePath("/team");
}

export async function removeMember(membershipId: string) {
  const supabase = createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
  if (error) throw error;

  revalidatePath("/team");
}
