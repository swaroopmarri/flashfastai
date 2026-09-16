import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/lib/supabasePagination";

interface DomainContact {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  list_names: string[] | null;
}

// Exporting a large company needs several paginated reads to fetch in full
// (see fetchAllRows) -- give this route's serverless function more than
// the platform default (often ~10-15s) to finish them all.
export const maxDuration = 60;

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
  let contacts: DomainContact[];
  try {
    contacts = await fetchAllRows<DomainContact>((from, to) =>
      supabase.rpc("get_network_domain_contacts", { p_domain: domain }).range(from, to),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }

  const csv = Papa.unparse({
    fields: ["email", "name", "company", "status", "lists"],
    data: contacts.map((c) => [
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
