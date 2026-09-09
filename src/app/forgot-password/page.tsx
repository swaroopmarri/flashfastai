import Link from "next/link";
import { requestPasswordReset } from "../login/actions";
import { ClearUrlParams } from "../login/ClearUrlParams";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900">Reset your password</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}
        {searchParams.message && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {searchParams.message}
          </p>
        )}

        <form action={requestPasswordReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Office email
            </label>
            <input id="email" name="email" type="email" required className={inputClass} />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Send reset link
          </button>
        </form>

        <Link href="/login" className="mt-4 block text-center text-sm text-indigo-600 hover:underline">
          Back to log in
        </Link>
        <ClearUrlParams shouldClear={Boolean(searchParams.error || searchParams.message)} />
      </div>
    </div>
  );
}
