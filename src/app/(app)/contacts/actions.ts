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

// Postgres/PostgREST accept a large insert/upsert payload in one request
// (it's a POST body, not a URL) -- unlike the suppression lookup below,
// this size is only about keeping any single request reasonably sized.
const CONTACT_WRITE_CHUNK_SIZE = 1000;
const CONTACT_WRITE_CONCURRENCY = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Runs `fn` over every item in `chunks`, at most `concurrency` in flight at
 * once. A large merged file can produce well over a hundred chunks -- doing
 * them one at a time would each add a full network round trip in serial and
 * risk the function's own execution-time limit long before any single
 * request is actually too large. */
async function runChunked<T>(
  chunks: T[][],
  concurrency: number,
  fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      await fn(chunk);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
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

// Supabase's .in() filter is encoded into the request URL -- an
// uncapped list (a merged file can easily carry thousands of emails)
// risks exceeding a proxy's URL-length limit and failing outright with an
// opaque network error. Chunking keeps every request well under that.
const SUPPRESSION_CHECK_CHUNK_SIZE = 200;
const SUPPRESSION_CHECK_CONCURRENCY = 8;

/** The `unsubscribes` table is the authoritative, user-wide suppression
 * list (see migration 0004) -- checked here so a suppressed email can
 * never re-enter a sendable state just by being re-uploaded into a list
 * (new or existing) it doesn't already appear in. */
async function getSuppressedEmails(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  emails: string[],
): Promise<Set<string>> {
  const suppressed = new Set<string>();
  await runChunked(
    chunk(emails, SUPPRESSION_CHECK_CHUNK_SIZE),
    SUPPRESSION_CHECK_CONCURRENCY,
    async (batch) => {
      const { data, error } = await supabase
        .from("unsubscribes")
        .select("email")
        .eq("user_id", userId)
        .in("email", batch);
      if (error) throw error;
      for (const r of data ?? []) suppressed.add(r.email as string);
    },
  );
  return suppressed;
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

  await runChunked(chunk(importable, CONTACT_WRITE_CHUNK_SIZE), CONTACT_WRITE_CONCURRENCY, async (batch) => {
    const { error: contactsError } = await supabase.from("contacts").insert(
      batch.map((row) => ({
        contact_list_id: list.id,
        email: row.email,
        name: row.name || null,
        company: row.company || null,
      })),
    );
    if (contactsError) throw contactsError;
  });

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

  await runChunked(chunk(importable, CONTACT_WRITE_CHUNK_SIZE), CONTACT_WRITE_CONCURRENCY, async (batch) => {
    const { error } = await supabase.from("contacts").upsert(
      batch.map((row) => ({
        contact_list_id: listId,
        email: row.email,
        name: row.name || null,
        company: row.company || null,
      })),
      { onConflict: "contact_list_id,email", ignoreDuplicates: false },
    );
    if (error) throw error;
  });

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
