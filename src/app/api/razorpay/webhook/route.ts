import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createAdminClient } from "@/utils/supabase/admin";
import { getPlanAndTermByRazorpayPlanId, getPlanById } from "@/lib/pricingPlans";
import { getRazorpayClient } from "@/lib/razorpay";

interface RazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
}

interface RazorpayPaymentEntity {
  id: string;
  invoice_id?: string | null;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: RazorpayPaymentEntity };
  };
}

// The referral reward is granted only on true first activation -- see
// evaluate_referral_reward() in 0019_referral_program.sql for why this is
// the one event that qualifies (never a renewal, upgrade, or downgrade).
const REFERRAL_QUALIFYING_EVENT = "subscription.activated";

// Reverses a referral reward if its qualifying payment is later refunded
// or charged back. Best-effort and NOT verified against a real refund:
// Razorpay's refund payload carries a payment, not a subscription, so
// this walks payment -> invoice -> subscription -> organization via the
// API. invoice_id on the payment entity is documented; subscription_id
// on the returned invoice is NOT declared anywhere in the razorpay npm
// package's own type definitions (node_modules/razorpay/dist/types/
// invoices.d.ts only lists it as a request-side filter, not a response
// field), so the cast below may simply come back undefined at runtime --
// in that case this silently no-ops rather than reversing anything.
// Before relying on this, trigger a real test refund and confirm what
// the invoice entity actually contains.
const REFUND_EVENTS = new Set(["payment.refunded", "refund.created"]);

async function reverseReferralForRefund(
  razorpay: Razorpay,
  supabase: ReturnType<typeof createAdminClient>,
  payment: RazorpayPaymentEntity,
): Promise<void> {
  if (!payment.invoice_id) return;

  const invoice = await razorpay.invoices.fetch(payment.invoice_id);
  const subscriptionId = (invoice as unknown as { subscription_id?: string }).subscription_id;
  if (!subscriptionId) return;

  const { data: subscriptionRow, error } = await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!subscriptionRow) return;

  const { error: reverseError } = await supabase.rpc("reverse_referral_reward", {
    p_organization_id: subscriptionRow.organization_id,
  });
  if (reverseError) throw reverseError;
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

  const supabase = createAdminClient();

  if (REFUND_EVENTS.has(body.event)) {
    const payment = body.payload.payment?.entity;
    if (payment) {
      await reverseReferralForRefund(getRazorpayClient(), supabase, payment);
    }
    return NextResponse.json({ ok: true });
  }

  const entity = body.payload.subscription?.entity;
  if (!entity) return NextResponse.json({ ok: true });

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

  if (body.event === REFERRAL_QUALIFYING_EVENT && match) {
    const starterContacts = getPlanById("starter")!.contacts;
    const { error: referralError } = await supabase.rpc("evaluate_referral_reward", {
      p_organization_id: subscriptionRow.organization_id,
      p_plan_id: match.plan.id,
      p_reward_contacts: starterContacts,
    });
    if (referralError) throw referralError;
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
