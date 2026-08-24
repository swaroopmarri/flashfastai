import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership, finalizeSignup } from "@/lib/organizations";
import { logout } from "./dashboard/actions";
import { NavLink } from "./NavLink";
import { WhatsAppButton } from "./_components/WhatsAppButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let membership = await getCurrentMembership(supabase);

  // Safety net: every authenticated user should have a membership by the
  // time they reach any app page, but if signup-time provisioning was ever
  // skipped or failed silently (e.g. an account that predates this
  // feature), create one on the fly instead of leaving every quota-gated
  // action to fail with a confusing "not part of an organization" error.
  if (!membership) {
    await finalizeSignup(supabase, user);
    membership = await getCurrentMembership(supabase);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
              Campaign Monster
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/contacts">Contacts</NavLink>
              <NavLink href="/network">My Network</NavLink>
              <NavLink href="/campaigns">Campaigns</NavLink>
              <NavLink href="/suppression">Suppression List</NavLink>
              {membership?.role === "admin" && <NavLink href="/team">Team</NavLink>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <WhatsAppButton />
    </div>
  );
}
