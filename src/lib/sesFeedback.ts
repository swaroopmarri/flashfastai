import type { SupabaseClient } from "@supabase/supabase-js";

interface RecipientLookup {
  email: string;
  campaignId: string;
  userId: string;
}

/**
 * A campaign_recipients row's ses_message_id is unique per send, so it maps
 * back to exactly one (email, campaign, user) -- the correlation key an SES
 * bounce/complaint notification carries back via mail.messageId.
 */
export async function findRecipientByMessageId(
  supabase: SupabaseClient,
  messageId: string,
): Promise<RecipientLookup | null> {
  const { data, error } = await supabase
    .from("campaign_recipients")
    .select("email, campaign_id, campaigns(user_id)")
    .eq("ses_message_id", messageId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const userId = (data.campaigns as unknown as { user_id: string } | null)?.user_id;
  if (!userId) return null;

  return { email: data.email as string, campaignId: data.campaign_id as string, userId };
}

async function markContact(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { data: lists, error: listsError } = await supabase
    .from("contact_lists")
    .select("id")
    .eq("user_id", userId);
  if (listsError) throw listsError;

  const listIds = (lists ?? []).map((l) => l.id as string);
  if (listIds.length === 0) return;

  const { error } = await supabase
    .from("contacts")
    .update(fields)
    .eq("email", email)
    .in("contact_list_id", listIds);
  if (error) throw error;
}

/**
 * A spam complaint is the highest-severity suppression signal available --
 * it goes into the same `unsubscribes` table an unsubscribe-link click
 * does (tagged reason='complaint'), so it's excluded from every future
 * send through the exact same, already-airtight path.
 */
export async function applyComplaint(
  supabase: SupabaseClient,
  recipient: RecipientLookup,
): Promise<void> {
  const { error } = await supabase.from("unsubscribes").upsert(
    {
      user_id: recipient.userId,
      email: recipient.email,
      campaign_id: recipient.campaignId,
      reason: "complaint",
      unsubscribed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,email" },
  );
  if (error) throw error;

  await markContact(supabase, recipient.userId, recipient.email, { status: "unsubscribed" });
}

/**
 * A permanent bounce is a real post-send delivery failure -- distinct from
 * ZeroBounce's pre-send prediction, so the reason is prefixed "ses_" to
 * keep the two sources visually distinguishable on the Suppression List
 * page while reusing the same status + column ZeroBounce already writes.
 */
export async function applyBounce(
  supabase: SupabaseClient,
  recipient: RecipientLookup,
  bounceSubType: string,
): Promise<void> {
  await markContact(supabase, recipient.userId, recipient.email, {
    status: "undeliverable",
    zerobounce_sub_status: `ses_${bounceSubType.toLowerCase()}`,
    verified_at: new Date().toISOString(),
  });
}
