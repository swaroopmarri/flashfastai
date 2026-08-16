import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface DomainContact {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  list_names: string[] | null;
}

export async function GET(
  _request: Request,
  { params }: { params: { domain: string } },
) {
  const domain = decodeURIComponent(params.domain);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reuses the same deduplicated, "best status" query the /network/[domain]
  // page itself is built from, so the exported CSV matches what's on screen.
  const { data: contacts, error } = await supabase.rpc("get_network_domain_contacts", {
    p_domain: domain,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = Papa.unparse({
    fields: ["email", "name", "company", "status", "lists"],
    data: ((contacts ?? []) as DomainContact[]).map((c) => [
      c.email,
      c.name ?? "",
      c.company ?? "",
      c.status,
      (c.list_names ?? []).join("; "),
    ]),
  });

  const filename = domain.replace(/[^a-z0-9-_.]+/gi, "_") || "contacts";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
