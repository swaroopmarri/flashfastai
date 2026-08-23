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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Uploads a replacement image for a named public-site slot (e.g.
 * "landing_hero"), stored in the "site-images" bucket (migration 0010) and
 * recorded in site_images so the public landing page knows which file is
 * current. Storage RLS also enforces admin-only writes on that bucket, so
 * this check is defense in depth, not the only gate. */
export async function uploadSiteImage(slot: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  await requireAdmin(supabase);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an image file.");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Only JPEG, PNG, or WebP images are supported.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be under 5MB.");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slot}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("site-images").getPublicUrl(path);

  const { error } = await supabase.from("site_images").upsert({
    slot,
    url: publicUrl,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/team");
}
