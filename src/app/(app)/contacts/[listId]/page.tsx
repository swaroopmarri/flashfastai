import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UploadForm } from "../UploadForm";
import { VerifyPanel } from "./VerifyPanel";

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-gray-100 text-gray-700",
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
  unsubscribed: "bg-gray-200 text-gray-500",
};

interface ContactRow {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
}

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/** Groups by company when known, otherwise by email domain, so contacts
 * from the same company or the same mail domain cluster together. */
function groupKey(c: ContactRow): string {
  const company = c.company?.trim().toLowerCase();
  return company ? `company:${company}` : `domain:${emailDomain(c.email)}`;
}

function groupLabel(c: ContactRow): string {
  const company = c.company?.trim();
  return company ? `Company: ${company}` : `Domain: ${emailDomain(c.email)}`;
}

function sortAndGroupContacts(contacts: ContactRow[]): {
  sorted: ContactRow[];
  counts: Map<string, number>;
} {
  const sorted = [...contacts].sort((a, b) => {
    const keyDiff = groupKey(a).localeCompare(groupKey(b));
    return keyDiff !== 0 ? keyDiff : a.email.localeCompare(b.email);
  });

  const counts = new Map<string, number>();
  for (const c of sorted) {
    const key = groupKey(c);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return { sorted, counts };
}

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

  const { sorted: sortedContacts, counts: groupCounts } = sortAndGroupContacts(
    contacts ?? [],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{list.name}</h1>

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
            {(() => {
              let lastKey: string | null = null;
              return sortedContacts.map((c) => {
                const key = groupKey(c);
                const isNewGroup = key !== lastKey;
                lastKey = key;
                return (
                  <Fragment key={c.id}>
                    {isNewGroup && (
                      <tr className="bg-gray-50">
                        <td
                          colSpan={4}
                          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {groupLabel(c)} ({groupCounts.get(key)})
                        </td>
                      </tr>
                    )}
                    <tr>
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
                  </Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
