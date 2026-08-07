import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UploadForm } from "../UploadForm";
import { VerifyPanel } from "./VerifyPanel";

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-gray-100 text-gray-700",
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
};

export default async function ContactListPage({
  params,
}: {
  params: { listId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: list } = await supabase
    .from("contact_lists")
    .select("id, name")
    .eq("id", params.listId)
    .maybeSingle();

  if (!list) notFound();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, email, name, company, status")
    .eq("contact_list_id", params.listId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const { data: activeJob } = await supabase
    .from("verification_jobs")
    .select("id, status")
    .eq("contact_list_id", params.listId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  const pendingCount =
    contacts?.filter((c) => c.status === "pending_verification").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{list.name}</h1>
        <Link href="/contacts" className="text-sm text-indigo-600 hover:underline">
          Back to lists
        </Link>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <VerifyPanel
          listId={list.id}
          pendingCount={pendingCount}
          activeJobId={activeJob?.id ?? null}
        />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Add more contacts</h2>
        <UploadForm mode="merge" listId={list.id} />
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">
        Contacts ({contacts?.length ?? 0})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-gray-900">{c.email}</td>
                <td className="px-4 py-2 text-gray-600">{c.name || "—"}</td>
                <td className="px-4 py-2 text-gray-600">{c.company || "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {c.status.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
