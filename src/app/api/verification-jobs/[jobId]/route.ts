import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pollVerificationJob } from "@/lib/verification";

// The first poll after MillionVerifier reports a bulk file complete
// downloads and stages the full report (see stageResults in
// src/lib/verification.ts) -- for a large list that's more than the
// platform's default function timeout, though every poll after that only
// applies one small batch and stays fast.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollVerificationJob(supabase, params.jobId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Poll failed" },
      { status: 500 },
    );
  }
}
