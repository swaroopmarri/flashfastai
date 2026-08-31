/**
 * Pricing tiers shown on the public landing page (src/app/page.tsx) and used
 * to provision real subscriptions via Razorpay (src/lib/razorpay.ts,
 * src/app/(app)/team/billingActions.ts). Update a price or quota here and
 * it's reflected everywhere.
 *
 * These contact numbers are sized for 50%+ gross margin against
 * MillionVerifier's 1M-credit plan (~₹0.043/verification) plus AWS SES
 * sending (~₹0.01/email) and a small per-customer overhead allowance.
 * MillionVerifier IS the actual integrated verification provider
 * (src/lib/millionverifier.ts, replacing the earlier ZeroBounce
 * integration) -- so unlike when this comment was first written, this
 * margin assumption now matches the real cost basis, not a hoped-for
 * future one.
 *
 * Each plan offers 3 prepay terms -- monthly (no discount), 6 months (5%
 * off), 12 months (8% off) -- to push customers toward prepaying for better
 * cash flow. Each term is its OWN Razorpay Plan (different billing
 * frequency + total amount per cycle), not a discount applied at checkout.
 */
export interface BillingTerm {
  id: string;
  label: string;
  /** Billing frequency in months -- 1, 6, or 12. */
  months: number;
  discountPercent: number;
  /** Total amount charged per billing cycle (i.e. every `months` months),
   * already discounted -- NOT a per-month price. */
  totalPriceInr: number;
  /**
   * Razorpay Plan ID (e.g. "plan_ABC123"), created once in the Razorpay
   * dashboard or API -- see README "Setting up Razorpay billing". Must be
   * replaced with a real ID before this term can actually be subscribed to.
   */
  razorpayPlanId: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  /** Reference monthly price, shown on the landing page and used as the
   * basis for computing each term's discounted total. */
  priceInr: number;
  /** Contacts included per month -- assumed verified once and sent to
   * once each, i.e. this same number is used for both plan_validation_quota
   * and plan_send_quota when a subscription activates, regardless of which
   * billing term was chosen. */
  contacts: number;
  terms: BillingTerm[];
}

function buildTerms(
  planKey: string,
  priceInr: number,
): BillingTerm[] {
  return [
    {
      id: "monthly",
      label: "Monthly",
      months: 1,
      discountPercent: 0,
      totalPriceInr: priceInr,
      razorpayPlanId: `REPLACE_WITH_${planKey}_MONTHLY_RAZORPAY_PLAN_ID`,
    },
    {
      id: "6month",
      label: "6 months",
      months: 6,
      discountPercent: 5,
      totalPriceInr: Math.round(priceInr * 6 * 0.95),
      razorpayPlanId: `REPLACE_WITH_${planKey}_6MONTH_RAZORPAY_PLAN_ID`,
    },
    {
      id: "12month",
      label: "12 months",
      months: 12,
      discountPercent: 8,
      totalPriceInr: Math.round(priceInr * 12 * 0.92),
      razorpayPlanId: `REPLACE_WITH_${planKey}_12MONTH_RAZORPAY_PLAN_ID`,
    },
  ];
}

export const PRICING_PLANS: PricingPlan[] = [
  { id: "starter", name: "Starter", priceInr: 499, contacts: 3500, terms: buildTerms("STARTER", 499) },
  { id: "growth", name: "Growth", priceInr: 999, contacts: 8000, terms: buildTerms("GROWTH", 999) },
  { id: "pro", name: "Pro", priceInr: 1999, contacts: 17000, terms: buildTerms("PRO", 1999) },
  { id: "scale", name: "Scale", priceInr: 4999, contacts: 45000, terms: buildTerms("SCALE", 4999) },
];

/**
 * Monthly-cycle-equivalent horizon used for every subscription's
 * total_count (Razorpay requires a finite count, not "forever"). 120
 * one-month cycles, 20 six-month cycles, and 10 twelve-month cycles all
 * cover the same ~10 years -- the customer can cancel anytime before that.
 */
const SUBSCRIPTION_HORIZON_MONTHS = 120;

export function totalCountForTerm(term: BillingTerm): number {
  return SUBSCRIPTION_HORIZON_MONTHS / term.months;
}

export function getPlanById(id: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === id);
}

export function getTerm(planId: string, termId: string): BillingTerm | undefined {
  return getPlanById(planId)?.terms.find((t) => t.id === termId);
}

export function getPlanAndTermByRazorpayPlanId(
  razorpayPlanId: string,
): { plan: PricingPlan; term: BillingTerm } | undefined {
  for (const plan of PRICING_PLANS) {
    const term = plan.terms.find((t) => t.razorpayPlanId === razorpayPlanId);
    if (term) return { plan, term };
  }
  return undefined;
}
