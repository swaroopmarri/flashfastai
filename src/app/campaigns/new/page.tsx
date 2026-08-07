import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NewCampaignForm } from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lists, error } = await supabase
    .from("contact_lists")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">New campaign</h1>
        <Link href="/campaigns" className="text-sm text-indigo-600 hover:underline">
          Back to campaigns
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {lists && lists.length > 0 ? (
          <NewCampaignForm lists={lists} />
        ) : (
          <p className="text-sm text-gray-600">
            You need a contact list before creating a campaign.{" "}
            <Link href="/contacts" className="text-indigo-600 hover:underline">
              Upload one first
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
