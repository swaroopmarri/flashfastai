"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { finalizeSignup, type InviteInfo } from "@/lib/organizations";

export async function acceptInvite(token: string, password: string) {
  const supabase = createClient();
  const origin = headers().get("origin");

  const { data: rpcData, error: infoError } = await supabase
    .rpc("get_invite_info", { p_token: token })
    .maybeSingle();
  const info = rpcData as InviteInfo | null;

  if (infoError || !info || info.status !== "pending") {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite is invalid or has already been used.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: info.email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { pending_invite_token: token },
    },
  });

  if (error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session && data.user) {
    await finalizeSignup(supabase, data.user);
    redirect("/dashboard");
  }

  redirect("/login?message=Check your email to confirm your account");
}
