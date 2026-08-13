import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UploadForm } from "./UploadForm";

const STATUS_LABELS: Record<string, string> = {
  deliverable: "deliverable",
  risky: "risky",
  undeliverable: "undeliverable",
  pending_verification: "pending verification",
  unsubscribed: "unsubscribed",
};

const STATUS_STYLES: Record<string, string> = {
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
  pending_verification: "bg-gray-100 text-gray-700",
  unsubscribed: "bg-gray-200 text-gray-500",
};

const STATUS_ORDER = ["deliverable", "risky", "undeliverable", "pending_verification", "unsubscribed"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ContactsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lists, error } = await supabase
    .from("contact_lists")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const { data: statusCounts, error: countsError } = await supabase.rpc(
    "get_contact_list_status_counts",
  );
  if (countsError) throw countsError;

  const countsByList = new Map<string, Record<string, number>>();
  for (const row of (statusCounts ?? []) as {
    contact_list_id: string;
    status: string;
    count: number;
  }[]) {
    const existing = countsByList.get(row.contact_list_id) ?? {};
    existing[row.status] = row.count;
    countsByList.set(row.contact_list_id, existing);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Contact lists</h1>

      <div className="mb-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Upload a new list</h2>
        <UploadForm mode="create" />
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Your lists</h2>
      {lists && lists.length > 0 ? (
        <div className="space-y-4">
          {lists.map((list) => {
            const counts = countsByList.get(list.id) ?? {};
            const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
            const deliverablePct =
              total > 0 ? Math.round(((counts.deliverable ?? 0) / total) * 100) : null;

            return (
              <div
                key={list.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{list.name}</h3>
                    <p className="text-xs text-gray-400">
                      Created {formatDate(list.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{total} contacts</p>
                    {deliverablePct !== null && (
                      <p className="text-lg font-semibold text-gray-900">
                        {deliverablePct}%{" "}
                        <span className="text-xs font-normal text-gray-400">deliverable</span>
                      </p>
                    )}
                  </div>
                </div>

                {total > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {STATUS_ORDER.filter((s) => counts[s] > 0).map((status) => (
                      <span
                        key={status}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                      >
                        {counts[status]} {STATUS_LABELS[status]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mb-4 text-sm text-gray-400">No contacts in this list yet.</p>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/contacts/${list.id}`}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Open list
                  </Link>
                  <a
                    href={`/api/contacts/${list.id}/export`}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Download CSV
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No contact lists yet.</p>
      )}
    </div>
  );
}
