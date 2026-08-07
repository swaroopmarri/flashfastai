"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  startVerification as startVerificationLib,
  type StartVerificationResult,
} from "@/lib/verification";

export interface ParsedContactRow {
  email: string;
  name?: string;
  company?: string;
}

function dedupeRows(rows: ParsedContactRow[]): ParsedContactRow[] {
  const byEmail = new Map<string, ParsedContactRow>();
  for (const row of rows) {
    const key = row.email.trim().toLowerCase();
    if (!key) continue;
    // Emails are normalized to lowercase so the DB's plain unique
    // constraint on (contact_list_id, email) can dedupe case-insensitively.
    byEmail.set(key, { ...row, email: key });
  }
  return Array.from(byEmail.values());
}

export async function createContactList(name: string, rows: ParsedContactRow[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: list, error: listError } = await supabase
    .from("contact_lists")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (listError) throw listError;

  const deduped = dedupeRows(rows);
  if (deduped.length > 0) {
    const { error: contactsError } = await supabase.from("contacts").insert(
      deduped.map((row) => ({
        contact_list_id: list.id,
        email: row.email,
        name: row.name || null,
        company: row.company || null,
      })),
    );
    if (contactsError) throw contactsError;
  }

  revalidatePath("/contacts");
  redirect(`/contacts/${list.id}`);
}

export async function mergeContacts(listId: string, rows: ParsedContactRow[]) {
  const supabase = createClient();

  const deduped = dedupeRows(rows);
  if (deduped.length > 0) {
    // Omitting `status` here means new rows get the column default
    // (pending_verification) while existing rows keep their current status.
    const { error } = await supabase.from("contacts").upsert(
      deduped.map((row) => ({
        contact_list_id: listId,
        email: row.email,
        name: row.name || null,
        company: row.company || null,
      })),
      { onConflict: "contact_list_id,email", ignoreDuplicates: false },
    );
    if (error) throw error;
  }

  revalidatePath(`/contacts/${listId}`);
}

export async function startVerificationAction(
  listId: string,
): Promise<StartVerificationResult> {
  const supabase = createClient();
  const result = await startVerificationLib(supabase, listId);
  revalidatePath(`/contacts/${listId}`);
  return result;
}
