import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "contacts";
}

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

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("email, name, company, status, zerobounce_sub_status, verified_at")
    .eq("contact_list_id", params.listId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = Papa.unparse({
    fields: ["email", "name", "company", "status", "zerobounce_sub_status", "verified_at"],
    data: (contacts ?? []).map((c) => [
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
