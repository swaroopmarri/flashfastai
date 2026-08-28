/**
 * Pricing tiers shown on the public landing page (src/app/page.tsx) and used
 * to provision real subscriptions via Razorpay (src/lib/razorpay.ts,
 * src/app/(app)/team/billingActions.ts). Update a price or quota here and
 * it's reflected everywhere.
 *
 * These contact numbers are sized for 50%+ gross margin against
 * MillionVerifier's 1M-credit plan (~₹0.043/verification) plus AWS SES
 * sending (~₹0.01/email) and a small per-customer overhead allowance --
 * NOT against ZeroBounce, which is what the app actually calls today
 * (src/lib/zerobounce.ts). MillionVerifier is NOT integrated yet.
 *
 * This is a deliberate, display-only choice for the contact numbers: they
 * are marketing copy, not automatically enforced by the verification
 * provider. Before a real customer could actually be provisioned at these
 * contact volumes, MillionVerifier needs to be integrated for real --
 * otherwise fulfilling these numbers against ZeroBounce's real (higher) cost
 * would run at a loss, not a 50%+ margin.
 */
export interface PricingPlan {
  id: string;
  name: string;
  priceInr: number;
  /** Contacts included per month -- assumed verified once and sent to
   * once each, i.e. this same number is used for both plan_validation_quota
   * and plan_send_quota when a subscription activates. */
  contacts: number;
  /**
   * Razorpay Plan ID (e.g. "plan_ABC123"), created once in the Razorpay
   * dashboard or API -- see README "Setting up Razorpay billing". Every
   * subscription create/update call references this, and the webhook
   * reverse-looks-up a plan from it via getPlanByRazorpayPlanId(). Must be
   * replaced with real IDs before subscriptions can actually be created.
   */
  razorpayPlanId: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceInr: 499,
    contacts: 3500,
    razorpayPlanId: "REPLACE_WITH_STARTER_RAZORPAY_PLAN_ID",
  },
  {
    id: "growth",
    name: "Growth",
    priceInr: 999,
    contacts: 8000,
    razorpayPlanId: "REPLACE_WITH_GROWTH_RAZORPAY_PLAN_ID",
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 1999,
    contacts: 17000,
    razorpayPlanId: "REPLACE_WITH_PRO_RAZORPAY_PLAN_ID",
  },
  {
    id: "scale",
    name: "Scale",
    priceInr: 4999,
    contacts: 45000,
    razorpayPlanId: "REPLACE_WITH_SCALE_RAZORPAY_PLAN_ID",
  },
];

export function getPlanById(id: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === id);
}

export function getPlanByRazorpayPlanId(razorpayPlanId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.razorpayPlanId === razorpayPlanId);
}
