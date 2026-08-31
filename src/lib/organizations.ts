import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface InviteInfo {
  organization_name: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
}

export interface Membership {
  id: string;
  organization_id: string;
  role: "admin" | "member";
  status: "invited" | "active";
  validation_quota: number;
  send_quota: number;
  validation_used: number;
  send_used: number;
}

export async function getCurrentMembership(
  supabase: SupabaseClient,
): Promise<Membership | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Explicitly scoped to the calling user: the memberships RLS SELECT
  // policy also lets an admin read every membership in their org, so an
  // unfiltered query here would return multiple rows for any admin whose
  // org has more than one member and crash .maybeSingle().
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, organization_id, role, status, validation_quota, send_quota, validation_used, send_used",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Ensures the given (now-authenticated) user has a membership, creating one
 * from whatever signup metadata was stashed on their auth user record.
 * Idempotent -- safe to call on every login/callback.
 */
export async function finalizeSignup(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const existing = await getCurrentMembership(supabase);
  if (existing) return;

  await ensureProfile(supabase, user);

  const inviteToken = user.user_metadata?.pending_invite_token as string | undefined;
  if (inviteToken) {
    const { error } = await supabase.rpc("accept_invite", { p_token: inviteToken });
    if (error) throw error;
    return;
  }

  const orgName = (user.user_metadata?.pending_org_name as string | undefined) || "My Organization";
  const { error } = await supabase.rpc("create_organization", { p_name: orgName });
  if (error) throw error;
}

/**
 * Creates the profiles row from signup-time metadata (see signup() in
 * app/login/actions.ts). No-op if that metadata isn't present -- e.g. an
 * invited member who joined via an invite link rather than the signup form
 * doesn't have it, and fills in their profile later from /account instead.
 */
async function ensureProfile(supabase: SupabaseClient, user: User): Promise<void> {
  const firstName = user.user_metadata?.pending_first_name as string | undefined;
  const lastName = user.user_metadata?.pending_last_name as string | undefined;
  const yearsExperience = user.user_metadata?.pending_years_experience as number | undefined;
  const termsAcceptedAt = user.user_metadata?.pending_terms_accepted_at as string | undefined;

  if (!firstName || !lastName || yearsExperience === undefined) return;

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    first_name: firstName,
    last_name: lastName,
    years_experience: yearsExperience,
    terms_accepted_at: termsAcceptedAt ?? null,
  });
  if (error) throw error;
}
