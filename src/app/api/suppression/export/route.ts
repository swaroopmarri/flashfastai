import Papa from "papaparse";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type ExportType = "complaints" | "unsubscribed" | "bounced";

function isExportType(v: string | null): v is ExportType {
  return v === "complaints" || v === "unsubscribed" || v === "bounced";
}

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

  if (type === "bounced") {
    const { data, error } = await supabase
      .from("contacts")
      .select("email, zerobounce_sub_status")
      .eq("status", "undeliverable");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byEmail = new Map<string, string>();
    for (const c of data ?? []) {
      byEmail.set((c.email as string).toLowerCase(), c.zerobounce_sub_status ?? "unknown");
    }
    fields = ["email", "reason"];
    rows = Array.from(byEmail.entries()).map(([email, reason]) => [email, reason]);
  } else {
    const { data, error } = await supabase
      .from("unsubscribes")
      .select("email, unsubscribed_at, reason, campaigns(name)")
      .eq("user_id", user.id)
      .eq("reason", type === "complaints" ? "complaint" : "unsubscribe_link")
      .order("unsubscribed_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    fields = ["email", "unsubscribed_at", "campaign"];
    rows = (data ?? []).map((r) => [
      r.email,
      r.unsubscribed_at,
      (r.campaigns as unknown as { name: string } | null)?.name ?? "",
    ]);
  }

  const csv = Papa.unparse({ fields, data: rows });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
