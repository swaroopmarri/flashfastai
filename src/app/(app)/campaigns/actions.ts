"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";
import { startCampaignSend, type StartSendResult } from "@/lib/campaignSend";
import { companyDisplayName } from "@/lib/companyName";

export async function createCampaign(name: string, contactListId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership(supabase);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name,
      contact_list_id: contactListId,
      organization_id: membership?.organization_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}/audience`);
}

/** "Start campaign with this company" from My Network -- creates a
 * domain-scoped (not list-scoped) draft campaign, defaulting to
 * deliverable-only, and jumps straight to its Audience step. */
export async function createCompanyCampaign(domain: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership(supabase);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: `${companyDisplayName(domain)} campaign`,
      company_domain: domain,
      organization_id: membership?.organization_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}/audience`);
}

export async function updateAudience(campaignId: string, includeRisky: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ include_risky: includeRisky })
    .eq("id", campaignId);

  if (error) throw error;
  revalidatePath(`/campaigns/${campaignId}/audience`);
}

export async function updateCampaignContent(
  campaignId: string,
  subject: string,
  body: string,
  replyTo: string,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      subject: subject.trim(),
      body: body.trim(),
      reply_to: replyTo.trim() || null,
    })
    .eq("id", campaignId);

  if (error) throw error;
  revalidatePath(`/campaigns/${campaignId}/compose`);
}

export async function startCampaignSendAction(campaignId: string): Promise<StartSendResult> {
  const supabase = createClient();
  const result = await startCampaignSend(supabase, campaignId);
  revalidatePath(`/campaigns/${campaignId}/compose`);
  return result;
}
