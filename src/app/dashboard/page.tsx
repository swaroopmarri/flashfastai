import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";
import { logout } from "./actions";

function UsageBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>
          {used} / {quota}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getCurrentMembership(supabase);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Dashboard
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>

        {membership && (
          <div className="mb-6 space-y-3 rounded-md bg-gray-50 p-4">
            <UsageBar
              label="Validations used this month"
              used={membership.validation_used}
              quota={membership.validation_quota}
            />
            <UsageBar
              label="Sends used this month"
              used={membership.send_used}
              quota={membership.send_quota}
            />
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/contacts"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Contact lists
          </Link>
          <Link
            href="/campaigns"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Campaigns
          </Link>
          {membership?.role === "admin" && (
            <Link
              href="/team"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Team
            </Link>
          )}
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
