"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  startVerification as startVerificationLib,
  startCompanyVerification as startCompanyVerificationLib,
  type StartVerificationResult,
} from "@/lib/verification";
import { getCurrentMembership } from "@/lib/organizations";

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

/** The `unsubscribes` table is the authoritative, user-wide suppression
 * list (see migration 0004) -- checked here so a suppressed email can
 * never re-enter a sendable state just by being re-uploaded into a list
 * (new or existing) it doesn't already appear in. */
async function getSuppressedEmails(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  emails: string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const { data, error } = await supabase
    .from("unsubscribes")
    .select("email")
    .eq("user_id", userId)
    .in("email", emails);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.email as string));
}

/** Client-side preview check, called right after parsing a file so the
 * upload preview can flag "already unsubscribed, excluded" before the
 * user ever submits -- the actual exclusion is enforced again, server-side,
 * in createContactList/mergeContacts regardless of what the client saw. */
export async function checkSuppressedEmails(emails: string[]): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const normalized = emails.map((e) => e.trim().toLowerCase());
  const suppressed = await getSuppressedEmails(supabase, user.id, normalized);
  return Array.from(suppressed);
}

export async function createContactList(name: string, rows: ParsedContactRow[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership(supabase);

  const { data: list, error: listError } = await supabase
    .from("contact_lists")
    .insert({
      user_id: user.id,
      name,
      organization_id: membership?.organization_id ?? null,
    })
    .select("id")
    .single();

  if (listError) throw listError;

  const deduped = dedupeRows(rows);
  const suppressed = await getSuppressedEmails(
    supabase,
    user.id,
    deduped.map((r) => r.email),
  );
  const importable = deduped.filter((r) => !suppressed.has(r.email));

  if (importable.length > 0) {
    const { error: contactsError } = await supabase.from("contacts").insert(
      importable.map((row) => ({
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const deduped = dedupeRows(rows);
  // Suppressed emails already present in this list keep their existing
  // 'unsubscribed' status untouched below (status is omitted from the
  // upsert payload, so ON CONFLICT never overwrites it); this only needs
  // to stop a suppressed email from being freshly INSERTed as
  // pending_verification into a list it isn't already in.
  const suppressed = await getSuppressedEmails(
    supabase,
    user.id,
    deduped.map((r) => r.email),
  );
  const importable = deduped.filter((r) => !suppressed.has(r.email));

  if (importable.length > 0) {
    const { error } = await supabase.from("contacts").upsert(
      importable.map((row) => ({
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

export async function startCompanyVerificationAction(
  domain: string,
): Promise<StartVerificationResult> {
  const supabase = createClient();
  const result = await startCompanyVerificationLib(supabase, domain);
  revalidatePath(`/network/${domain}`);
  return result;
}

/** Manual resubscribe -- compliance-sensitive, so the actual delete +
 * status revert + audit-log write happens atomically in the
 * resubscribe_contact() Postgres function (migration 0007), not here. */
export async function resubscribeContactAction(email: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("resubscribe_contact", { p_email: email });
  revalidatePath("/suppression");
  if (error) return { error: error.message };
  return {};
}
