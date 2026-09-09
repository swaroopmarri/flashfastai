import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { updatePassword } from "../../login/actions";
import { ClearUrlParams } from "../../login/ClearUrlParams";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only reachable with the temporary session established by clicking a
  // real password-reset email link (see auth/callback/route.ts) -- not a
  // page anyone can just navigate to.
  if (!user) redirect("/login?error=That password reset link has expired. Request a new one.");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
          Choose a new password
        </h1>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <form action={updatePassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Update password
          </button>
        </form>
        <ClearUrlParams shouldClear={Boolean(searchParams.error)} />
      </div>
    </div>
  );
}
