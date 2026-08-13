import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { processSendJobBatch } from "@/lib/campaignSend";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { origin } = new URL(request.url);

  try {
    const result = await processSendJobBatch(supabase, params.jobId, origin);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Poll failed" },
      { status: 500 },
    );
  }
}
