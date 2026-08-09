"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { finalizeSignup } from "@/lib/organizations";

export async function login(formData: FormData) {
  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const origin = headers().get("origin");

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const organizationName = (formData.get("organizationName") as string).trim();

  if (!organizationName) {
    redirect(`/login?error=${encodeURIComponent("Organization name is required to sign up.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { pending_org_name: organizationName },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is off, signUp() returns an active session
  // immediately and /auth/callback never runs -- finalize here instead.
  if (data.session && data.user) {
    await finalizeSignup(supabase, data.user);
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  revalidatePath("/", "layout");
  redirect("/login?message=Check your email to confirm your account");
}
