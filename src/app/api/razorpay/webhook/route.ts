import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createAdminClient } from "@/utils/supabase/admin";
import { getPlanAndTermByRazorpayPlanId } from "@/lib/pricingPlans";

interface RazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
  };
}

// Events that mean "the customer is now paying for (possibly a new) plan" --
// this is the only place quota actually gets granted, never from a
// client-reported checkout success.
const QUOTA_PROVISIONING_EVENTS = new Set([
  "subscription.activated",
  "subscription.charged",
  "subscription.updated",
]);

// "halted" is Razorpay's terminal retry-exhausted state -- it gave up
// retrying a failed charge (as opposed to "pending", which just means a
// retry is still in progress this cycle). Without this, an org whose card
// stopped working would keep its full quota indefinitely, unpaid, until
// someone noticed and cancelled manually.
const QUOTA_FREEZE_EVENTS = new Set(["subscription.halted"]);

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !secret || !Razorpay.validateWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const entity = body.payload.subscription?.entity;
  if (!entity) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();

  const { data: subscriptionRow, error: lookupError } = await supabase
    .from("subscriptions")
    .select("id, organization_id")
    .eq("razorpay_subscription_id", entity.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!subscriptionRow) {
    // Not one of ours -- nothing to do.
    return NextResponse.json({ ok: true });
  }

  const match = getPlanAndTermByRazorpayPlanId(entity.plan_id);

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: entity.status,
      plan_id: match?.plan.id,
      term_id: match?.term.id,
      current_start: toIso(entity.current_start),
      current_end: toIso(entity.current_end),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionRow.id);
  if (updateError) throw updateError;

  if (QUOTA_PROVISIONING_EVENTS.has(body.event) && match) {
    const { error: quotaError } = await supabase
      .from("organizations")
      .update({
        plan_validation_quota: match.plan.contacts,
        plan_send_quota: match.plan.contacts,
      })
      .eq("id", subscriptionRow.organization_id);
    if (quotaError) throw quotaError;
  }

  if (QUOTA_FREEZE_EVENTS.has(body.event)) {
    const { error: freezeError } = await supabase
      .from("organizations")
      .update({ plan_validation_quota: 0, plan_send_quota: 0 })
      .eq("id", subscriptionRow.organization_id);
    if (freezeError) throw freezeError;
  }

  return NextResponse.json({ ok: true });
}
