"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isPersonalEmailDomain } from "@/lib/officeEmail";

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const yearsExperience = Number(formData.get("yearsExperience"));

  if (!firstName || !lastName || Number.isNaN(yearsExperience) || yearsExperience < 0) {
    throw new Error("First name, last name, and years of experience are all required.");
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    first_name: firstName,
    last_name: lastName,
    years_experience: yearsExperience,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  revalidatePath("/account");
}

/**
 * Changes the account's login email to another office email. Supabase Auth
 * sends a confirmation link to the new address (and, depending on the
 * project's "Secure email change" setting, to the old one too) -- the email
 * on file doesn't actually change until that link is clicked.
 */
export async function changeOfficeEmail(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const newEmail = (formData.get("newEmail") as string).trim().toLowerCase();
  if (!newEmail) throw new Error("Enter a new office email address.");
  if (isPersonalEmailDomain(newEmail)) {
    throw new Error("Please use a work/office email address, not a personal email provider.");
  }
  if (newEmail === user.email) {
    throw new Error("That's already your current email address.");
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;

  revalidatePath("/account");
}
