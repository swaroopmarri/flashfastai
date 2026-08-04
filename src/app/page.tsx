import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center">
      <h1 className="text-4xl font-semibold text-gray-900">flashfastai</h1>
      <p className="max-w-md text-gray-600">
        A Next.js + Supabase starter with email/password authentication and a
        protected dashboard.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Log in / Sign up
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
