import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/lib/supabasePagination";

type ExportType = "complaints" | "unsubscribed" | "bounced";

function isExportType(v: string | null): v is ExportType {
  return v === "complaints" || v === "unsubscribed" || v === "bounced";
}

// A large account's suppression lists need several paginated reads to
// fetch in full (see fetchAllRows) -- give this route's serverless
// function more than the platform default (often ~10-15s) to finish.
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type");
  if (!isExportType(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  let fields: string[];
  let rows: (string | number)[][];

  try {
    if (type === "bounced") {
      const data = await fetchAllRows<{ email: string; zerobounce_sub_status: string | null }>(
        (from, to) =>
          supabase
            .from("contacts")
            .select("email, zerobounce_sub_status")
            .eq("status", "undeliverable")
            .range(from, to),
      );

      const byEmail = new Map<string, string>();
      for (const c of data) {
        byEmail.set(c.email.toLowerCase(), c.zerobounce_sub_status ?? "unknown");
      }
      fields = ["email", "reason"];
      rows = Array.from(byEmail.entries()).map(([email, reason]) => [email, reason]);
    } else {
      const data = await fetchAllRows<{
        email: string;
        unsubscribed_at: string;
        campaigns: unknown;
      }>((from, to) =>
        supabase
          .from("unsubscribes")
          .select("email, unsubscribed_at, reason, campaigns(name)")
          .eq("user_id", user.id)
          .eq("reason", type === "complaints" ? "complaint" : "unsubscribe_link")
          .order("unsubscribed_at", { ascending: false })
          .range(from, to),
      );

      fields = ["email", "unsubscribed_at", "campaign"];
      rows = data.map((r) => [
        r.email,
        r.unsubscribed_at,
        (r.campaigns as { name: string } | null)?.name ?? "",
      ]);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }

  const csv = Papa.unparse({ fields, data: rows });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
