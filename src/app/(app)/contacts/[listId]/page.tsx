import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UploadForm } from "../UploadForm";
import { VerifyPanel } from "../../_components/VerifyPanel";
import { Pagination } from "../../_components/Pagination";
import { escapeIlike } from "@/lib/searchFilter";

const PAGE_SIZE = 100;

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-gray-100 text-gray-700",
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
  unsubscribed: "bg-gray-200 text-gray-500",
};

export default async function ContactListPage({
  params,
  searchParams,
}: {
  params: { listId: string };
  searchParams: { page?: string; q?: string };
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

  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("contacts")
    .select("id, email, name, company, status", { count: "exact" })
    .eq("contact_list_id", params.listId);

  if (q) {
    const term = `%${escapeIlike(q)}%`;
    query = query.or(`email.ilike.${term},name.ilike.${term},company.ilike.${term}`);
  }

  const {
    data: contacts,
    count,
    error,
  } = await query
    .order("company", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true })
    .range(from, to);
  if (error) throw error;

  // The Verify panel always needs the true pending count for the WHOLE
  // list, not just whatever's matched by the current search/page.
  const { count: pendingCount } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("contact_list_id", params.listId)
    .eq("status", "pending_verification");

  const { data: activeJob } = await supabase
    .from("verification_jobs")
    .select("id, status")
    .eq("contact_list_id", params.listId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  const total = count ?? 0;

  function buildHref(nextPage: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return `/contacts/${params.listId}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{list.name}</h1>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <VerifyPanel
          target={{ type: "list", listId: list.id }}
          pendingCount={pendingCount ?? 0}
          activeJobId={activeJob?.id ?? null}
        />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Add more contacts</h2>
        <UploadForm mode="merge" listId={list.id} />
      </div>

      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-gray-900">
          {q ? (
            <>
              Contacts matching &quot;{q}&quot; ({total})
            </>
          ) : (
            <>Contacts ({total})</>
          )}
        </h2>
      </div>

      <form action={`/contacts/${list.id}`} className="mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by email, name, or company"
          className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Search
        </button>
        {q && (
          <Link
            href={`/contacts/${list.id}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
        )}
      </form>

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
            {(contacts ?? []).map((c) => (
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
            {(contacts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No contacts match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={buildHref} />
      </div>
    </div>
  );
}
