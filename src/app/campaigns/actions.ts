"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function createCampaign(name: string, contactListId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name,
      contact_list_id: contactListId,
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
