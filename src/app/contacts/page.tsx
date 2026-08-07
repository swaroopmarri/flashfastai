import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UploadForm } from "./UploadForm";

export default async function ContactsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lists, error } = await supabase
    .from("contact_lists")
    .select("id, name, created_at, contacts(count)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Contact lists</h1>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <div className="mb-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Upload a new list</h2>
        <UploadForm mode="create" />
      </div>

      <h2 className="mb-3 text-lg font-medium text-gray-900">Your lists</h2>
      {lists && lists.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/contacts/${list.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{list.name}</span>
                <span className="text-sm text-gray-500">
                  {(list.contacts as unknown as { count: number }[])[0]?.count ?? 0} contacts
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No contact lists yet.</p>
      )}
    </div>
  );
}
