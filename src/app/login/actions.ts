"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { finalizeSignup } from "@/lib/organizations";
import { isPersonalEmailDomain } from "@/lib/officeEmail";

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

  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const organizationName = (formData.get("organizationName") as string).trim();
  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const yearsExperienceRaw = formData.get("yearsExperience") as string;
  const yearsExperience = Number(yearsExperienceRaw);

  if (!organizationName) {
    redirect(`/login?error=${encodeURIComponent("Organization name is required to sign up.")}`);
  }
  if (!firstName || !lastName || !yearsExperienceRaw || Number.isNaN(yearsExperience) || yearsExperience < 0) {
    redirect(
      `/login?error=${encodeURIComponent(
        "First name, last name, and years of experience are all required to sign up.",
      )}`,
    );
  }
  if (isPersonalEmailDomain(email)) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Please sign up with your work/office email address, not a personal email provider.",
      )}`,
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        pending_org_name: organizationName,
        pending_first_name: firstName,
        pending_last_name: lastName,
        pending_years_experience: yearsExperience,
      },
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
