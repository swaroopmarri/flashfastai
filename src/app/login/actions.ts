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

export async function requestPasswordReset(formData: FormData) {
  const supabase = createClient();
  const origin = headers().get("origin");

  const email = (formData.get("email") as string).trim().toLowerCase();
  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Enter your email address.")}`);
  }

  // Never reveal whether an account exists for this email -- always show
  // the same success message regardless of what resetPasswordForEmail
  // actually did, so this can't be used to enumerate registered accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
  });

  redirect(
    `/forgot-password?message=${encodeURIComponent(
      "If an account exists for that email, a password reset link has been sent.",
    )}`,
  );
}

export async function updatePassword(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("That password reset link has expired. Request a new one.")}`);
  }

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 6) {
    redirect(`/auth/update-password?error=${encodeURIComponent("Password must be at least 6 characters.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/auth/update-password?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Password updated. Log in with your new password.");
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const origin = headers().get("origin");

  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const organizationName = (formData.get("organizationName") as string).trim();
  const accountTypeRaw = formData.get("accountType") as string;
  const accountType = accountTypeRaw === "company" ? "company" : "individual";
  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const yearsExperienceRaw = formData.get("yearsExperience") as string;
  const yearsExperience = Number(yearsExperienceRaw);
  const acceptedTerms = formData.get("acceptedTerms") === "on";

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
  if (!acceptedTerms) {
    redirect(
      `/login?error=${encodeURIComponent(
        "You must agree to the Terms of Service and Privacy Policy to sign up.",
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
        pending_account_type: accountType,
        pending_first_name: firstName,
        pending_last_name: lastName,
        pending_years_experience: yearsExperience,
        pending_terms_accepted_at: new Date().toISOString(),
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
