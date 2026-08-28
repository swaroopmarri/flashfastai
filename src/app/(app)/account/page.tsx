import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isMissingSchemaError } from "@/lib/schemaGuard";
import { ProfileForm, type ProfileValues } from "./ProfileForm";
import { ChangeEmailForm } from "./ChangeEmailForm";

const EMPTY_PROFILE: ProfileValues = {
  firstName: "",
  lastName: "",
  currentCompany: "",
  yearsExperience: "",
};

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let profile: ProfileValues = EMPTY_PROFILE;
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, current_company, years_experience")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && !isMissingSchemaError(error)) throw error;
  if (data) {
    profile = {
      firstName: data.first_name,
      lastName: data.last_name,
      currentCompany: data.current_company,
      yearsExperience: data.years_experience,
    };
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Account</h1>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Profile</h2>
        <ProfileForm initial={profile} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-gray-900">Office email</h2>
        <ChangeEmailForm currentEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
