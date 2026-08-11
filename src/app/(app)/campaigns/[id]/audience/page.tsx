import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AudienceToggle } from "./AudienceToggle";

export default async function AudiencePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, include_risky, contact_list_id, contact_lists(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!campaign || !campaign.contact_list_id) notFound();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("status")
    .eq("contact_list_id", campaign.contact_list_id);

  if (error) throw error;

  const counts = { deliverable: 0, risky: 0, undeliverable: 0, pending_verification: 0 };
  for (const c of contacts ?? []) {
    counts[c.status as keyof typeof counts]++;
  }

  const listName = (campaign.contact_lists as unknown as { name: string } | null)?.name;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{campaign.name}</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-medium text-gray-900">Audience</h2>
        <p className="mb-4 text-sm text-gray-500">
          List:{" "}
          <Link
            href={`/contacts/${campaign.contact_list_id}`}
            className="text-indigo-600 hover:underline"
          >
            {listName}
          </Link>
        </p>

        <div className="mb-4 flex gap-4 text-sm">
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
            {counts.deliverable} deliverable
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700">
            {counts.risky} risky
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
            {counts.undeliverable} undeliverable
          </span>
        </div>

        {counts.pending_verification > 0 && (
          <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {counts.pending_verification} contact
            {counts.pending_verification === 1 ? "" : "s"} on this list{" "}
            {counts.pending_verification === 1 ? "hasn't" : "haven't"} been
            verified yet and won&apos;t be included in this campaign.{" "}
            <Link
              href={`/contacts/${campaign.contact_list_id}`}
              className="underline"
            >
              Verify them
            </Link>
            .
          </p>
        )}

        <AudienceToggle
          campaignId={campaign.id}
          initialIncludeRisky={campaign.include_risky}
          deliverableCount={counts.deliverable}
          riskyCount={counts.risky}
        />

        <p className="mt-6 text-sm text-gray-400">
          Campaign content and sending aren&apos;t built yet — this step only
          defines the audience for now.
        </p>
      </div>
    </div>
  );
}
