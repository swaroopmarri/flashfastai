import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MAX_SELECTION = 5000;

interface ExportRow {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  verified_at: string | null;
  list_names: string[] | null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.emails) || body.emails.length === 0) {
    return NextResponse.json({ error: "No contacts selected." }, { status: 400 });
  }
  if (body.emails.length > MAX_SELECTION) {
    return NextResponse.json(
      { error: `Select at most ${MAX_SELECTION} contacts at once.` },
      { status: 400 },
    );
  }

  const emails = body.emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase());

  // Reuses the same dedup + "best status wins" query the UI's own tables
  // are built from, so the exported CSV always matches what was on screen
  // -- RLS scopes this to the caller's own contacts regardless.
  const { data: contacts, error } = await supabase.rpc("search_network_contacts", {
    p_emails: emails,
    p_limit: emails.length,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = Papa.unparse({
    fields: ["email", "name", "company", "status", "verified_at", "lists"],
    data: ((contacts ?? []) as ExportRow[]).map((c) => [
      c.email,
      c.name ?? "",
      c.company ?? "",
      c.status,
      c.verified_at ?? "",
      (c.list_names ?? []).join("; "),
    ]),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selected_contacts.csv"`,
    },
  });
}
