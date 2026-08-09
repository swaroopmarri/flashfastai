import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function CampaignsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <Link
        href="/campaigns/new"
        className="mb-8 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        New campaign
      </Link>

      {campaigns && campaigns.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campaigns/${c.id}/audience`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-sm capitalize text-gray-500">{c.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No campaigns yet.</p>
      )}
    </div>
  );
}
