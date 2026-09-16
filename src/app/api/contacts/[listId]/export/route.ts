import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/lib/supabasePagination";

interface ExportContactRow {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  zerobounce_sub_status: string | null;
  verified_at: string | null;
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "contacts";
}

// Exporting a large list needs several paginated reads to fetch in full
// (see fetchAllRows) -- give this route's serverless function more than
// the platform default (often ~10-15s) to finish them all.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: { listId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: list } = await supabase
    .from("contact_lists")
    .select("id, name")
    .eq("id", params.listId)
    .maybeSingle();

  if (!list) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let contacts: ExportContactRow[];
  try {
    contacts = await fetchAllRows<ExportContactRow>((from, to) =>
      supabase
        .from("contacts")
        .select("email, name, company, status, zerobounce_sub_status, verified_at")
        .eq("contact_list_id", params.listId)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }

  const csv = Papa.unparse({
    fields: ["email", "name", "company", "status", "zerobounce_sub_status", "verified_at"],
    data: contacts.map((c) => [
      c.email,
      c.name ?? "",
      c.company ?? "",
      c.status,
      c.zerobounce_sub_status ?? "",
      c.verified_at ?? "",
    ]),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sanitizeFilename(list.name)}.csv"`,
    },
  });
}
