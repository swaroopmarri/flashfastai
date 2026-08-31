"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentMembership } from "@/lib/organizations";
import { getRazorpayClient } from "@/lib/razorpay";
import { getTerm, totalCountForTerm } from "@/lib/pricingPlans";

const OPEN_STATUSES = ["created", "authenticated", "active", "pending", "halted"];

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only an organization admin can manage billing.");
  }
  return membership;
}

/**
 * Creates a brand-new Razorpay subscription for the given plan + billing
 * term (monthly / 6month / 12month -- each its own Razorpay Plan, see
 * pricingPlans.ts) and redirects to its hosted checkout page (short_url) for
 * the customer to authorize payment. Inserts a tracking row with status
 * "created" -- no quota is granted yet; that only happens once the webhook
 * confirms activation (see src/app/api/razorpay/webhook/route.ts). Only
 * usable when the org doesn't already have an open subscription -- use
 * changePlan() for an existing one.
 */
export async function startSubscription(planId: string, termId: string): Promise<void> {
  const supabase = createClient();
  const membership = await requireAdmin(supabase);

  const term = getTerm(planId, termId);
  if (!term) throw new Error("Unknown plan or billing term.");

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing && OPEN_STATUSES.includes(existing.status)) {
    throw new Error("This organization already has a subscription -- use Change plan instead.");
  }

  const razorpay = getRazorpayClient();
  const subscription = await razorpay.subscriptions.create({
    plan_id: term.razorpayPlanId,
    total_count: totalCountForTerm(term),
    customer_notify: 1,
    notes: { organization_id: membership.organization_id },
  });

  const { error } = await supabase.from("subscriptions").upsert(
    {
      organization_id: membership.organization_id,
      plan_id: planId,
      term_id: termId,
      razorpay_subscription_id: subscription.id,
      status: subscription.status,
    },
    { onConflict: "organization_id" },
  );
  if (error) throw error;

  revalidatePath("/team");
  redirect(subscription.short_url);
}

/**
 * Changes an existing active subscription's plan/term immediately. Does NOT
 * write plan_id/term_id/status here -- the subscription.updated webhook is
 * the only place that happens, so the DB never disagrees with what Razorpay
 * actually confirmed. The Team page may show the old plan for a few seconds
 * until that webhook lands.
 */
export async function changePlan(planId: string, termId: string): Promise<void> {
  const supabase = createClient();
  const membership = await requireAdmin(supabase);

  const term = getTerm(planId, termId);
  if (!term) throw new Error("Unknown plan or billing term.");

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("razorpay_subscription_id, status")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.status !== "active") {
    throw new Error("No active subscription to change -- subscribe to a plan first.");
  }

  const razorpay = getRazorpayClient();
  await razorpay.subscriptions.update(existing.razorpay_subscription_id, {
    plan_id: term.razorpayPlanId,
    schedule_change_at: "now",
  });

  revalidatePath("/team");
}

/**
 * Cancels the org's subscription immediately. Like changePlan(), doesn't
 * write status here -- the subscription.cancelled webhook does that.
 */
export async function cancelSubscription(): Promise<void> {
  const supabase = createClient();
  const membership = await requireAdmin(supabase);

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("razorpay_subscription_id, status")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || !OPEN_STATUSES.includes(existing.status)) {
    throw new Error("No active subscription to cancel.");
  }

  const razorpay = getRazorpayClient();
  await razorpay.subscriptions.cancel(existing.razorpay_subscription_id, false);

  revalidatePath("/team");
}
