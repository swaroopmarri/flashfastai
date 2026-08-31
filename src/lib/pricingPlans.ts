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
 * (src/lib/millionverifier.ts). Both providers bill in USD, so the USD
 * prices below aren't a currency conversion of the INR ones -- they're
 * priced independently against the same underlying USD cost, with more
 * margin cushion (~63-65% vs ~52% for INR) to absorb the higher processing
 * fees and chargeback risk that come with international cards.
 *
 * Every price here is EXCLUDING tax. GST (18%) applies only to INR prices
 * (Indian customers) and is added at checkout, never baked into the
 * displayed/base price -- see withGst() below. USD prices have no GST.
 *
 * Each plan offers 3 prepay terms per currency -- monthly (no discount), 6
 * months (5% off), 12 months (8% off) -- to push customers toward prepaying
 * for better cash flow. Each (plan, currency, term) combination is its OWN
 * Razorpay Plan (different billing frequency + amount), not a discount
 * applied at checkout.
 *
 * IMPORTANT: accepting USD (international) payments through an India-based
 * Razorpay account requires Razorpay's international payments feature to be
 * enabled on your account first (additional KYC/approval, subject to
 * RBI/FEMA rules) -- this is a real account-level prerequisite, not just a
 * code change. Confirm that's active before creating the USD Plans below.
 */

export type CurrencyCode = "INR" | "USD";
export type TermId = "monthly" | "6month" | "12month";

export const GST_RATE = 0.18;

/** Rounds a GST-exclusive amount up to the GST-inclusive amount actually
 * charged. Only meaningful for INR -- call this only where gstApplicable
 * is true. */
export function withGst(amountExGst: number): number {
  return Math.round(amountExGst * (1 + GST_RATE));
}

export interface BillingTerm {
  id: TermId;
  label: string;
  /** Billing frequency in months -- 1, 6, or 12. */
  months: number;
  discountPercent: number;
  /** Total amount charged per billing cycle (i.e. every `months` months),
   * already discounted -- NOT a per-month price, and EXCLUDING GST. */
  totalPriceExGst: number;
  /**
   * Razorpay Plan ID (e.g. "plan_ABC123"), created once in the Razorpay
   * dashboard or API -- see README "Setting up Razorpay billing". For INR
   * terms, the Plan's actual amount must be the GST-INCLUSIVE total
   * (withGst(totalPriceExGst)), since Razorpay charges a fixed amount per
   * cycle with no separate tax line item. Must be replaced with a real ID
   * before this term can actually be subscribed to.
   */
  razorpayPlanId: string;
}

export interface CurrencyPricing {
  currency: CurrencyCode;
  gstApplicable: boolean;
  /** Reference monthly price, excluding GST -- shown on the landing page
   * and used as the basis for computing each term's discounted total. */
  monthlyPriceExGst: number;
  terms: BillingTerm[];
}

export interface PricingPlan {
  id: string;
  name: string;
  /** Contacts included per month -- assumed verified once and sent to
   * once each, i.e. this same number is used for both plan_validation_quota
   * and plan_send_quota when a subscription activates, regardless of which
   * currency or billing term was chosen. */
  contacts: number;
  currencies: CurrencyPricing[];
}

function buildTerms(
  planKey: string,
  currencyKey: string,
  monthlyPriceExGst: number,
): BillingTerm[] {
  return [
    {
      id: "monthly",
      label: "Monthly",
      months: 1,
      discountPercent: 0,
      totalPriceExGst: monthlyPriceExGst,
      razorpayPlanId: `REPLACE_WITH_${planKey}_${currencyKey}_MONTHLY_RAZORPAY_PLAN_ID`,
    },
    {
      id: "6month",
      label: "6 months",
      months: 6,
      discountPercent: 5,
      totalPriceExGst: Math.round(monthlyPriceExGst * 6 * 0.95 * 100) / 100,
      razorpayPlanId: `REPLACE_WITH_${planKey}_${currencyKey}_6MONTH_RAZORPAY_PLAN_ID`,
    },
    {
      id: "12month",
      label: "12 months",
      months: 12,
      discountPercent: 8,
      totalPriceExGst: Math.round(monthlyPriceExGst * 12 * 0.92 * 100) / 100,
      razorpayPlanId: `REPLACE_WITH_${planKey}_${currencyKey}_12MONTH_RAZORPAY_PLAN_ID`,
    },
  ];
}

function buildCurrencies(
  planKey: string,
  priceInrExGst: number,
  priceUsdExGst: number,
): CurrencyPricing[] {
  return [
    {
      currency: "INR",
      gstApplicable: true,
      monthlyPriceExGst: priceInrExGst,
      terms: buildTerms(planKey, "INR", priceInrExGst),
    },
    {
      currency: "USD",
      gstApplicable: false,
      monthlyPriceExGst: priceUsdExGst,
      terms: buildTerms(planKey, "USD", priceUsdExGst),
    },
  ];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    contacts: 3500,
    currencies: buildCurrencies("STARTER", 499, 6.99),
  },
  {
    id: "growth",
    name: "Growth",
    contacts: 8000,
    currencies: buildCurrencies("GROWTH", 999, 13.99),
  },
  {
    id: "pro",
    name: "Pro",
    contacts: 17000,
    currencies: buildCurrencies("PRO", 1999, 27.99),
  },
  {
    id: "scale",
    name: "Scale",
    contacts: 45000,
    currencies: buildCurrencies("SCALE", 4999, 69.99),
  },
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

export function getCurrencyPricing(
  planId: string,
  currency: CurrencyCode,
): CurrencyPricing | undefined {
  return getPlanById(planId)?.currencies.find((c) => c.currency === currency);
}

export function getTerm(
  planId: string,
  currency: CurrencyCode,
  termId: TermId,
): BillingTerm | undefined {
  return getCurrencyPricing(planId, currency)?.terms.find((t) => t.id === termId);
}

export function getPlanAndTermByRazorpayPlanId(
  razorpayPlanId: string,
): { plan: PricingPlan; currency: CurrencyPricing; term: BillingTerm } | undefined {
  for (const plan of PRICING_PLANS) {
    for (const currency of plan.currencies) {
      const term = currency.terms.find((t) => t.razorpayPlanId === razorpayPlanId);
      if (term) return { plan, currency, term };
    }
  }
  return undefined;
}
