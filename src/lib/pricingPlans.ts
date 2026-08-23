/**
 * Single source of truth for fastflash's pricing tiers. Update a price or
 * quota here and it's reflected everywhere it's used, instead of hunting
 * through the landing page (and, once real plan-based billing exists,
 * wherever quotas get provisioned) separately.
 *
 * Quotas are sized for 50%+ gross margin against the CURRENTLY INTEGRATED
 * verification provider -- ZeroBounce, at ~₹0.76/verification via their
 * ONE subscription billed annually (public list price, not a confirmed
 * negotiated rate) -- plus AWS SES sending (~₹0.01/email) and a small
 * per-customer overhead allowance. Each contact is assumed verified once
 * and sent to once per month (worst case: the customer uses the full
 * quota every month).
 *
 * NOT using the cheaper MillionVerifier-based numbers that were also
 * discussed, since that provider isn't actually wired into the app --
 * src/lib/zerobounce.ts is ZeroBounce-specific. Raise these once either
 * (a) MillionVerifier (or another cheaper provider) is actually
 * integrated, or (b) your real negotiated ZeroBounce rate is confirmed
 * lower than this public-list-price estimate.
 *
 * IMPORTANT: these plan definitions are NOT yet wired into actual
 * signup/billing. Every new organization still gets the flat default
 * quota set in migrations 0002/0003 (10,000 validation + 10,000 send).
 * Letting a customer pick one of these plans at signup and having it
 * automatically provision this quota is a separate, larger feature that
 * needs a real payment flow (Razorpay/Stripe/etc.) -- not built yet.
 */
export interface PricingPlan {
  id: string;
  name: string;
  priceInr: number;
  /** Contacts included per month -- assumed verified once and sent to
   * once each, i.e. this same number applies to both validation_quota
   * and send_quota once real plan provisioning exists. */
  contacts: number;
}

export const PRICING_PLANS: PricingPlan[] = [
  { id: "starter", name: "Starter", priceInr: 499, contacts: 250 },
  { id: "growth", name: "Growth", priceInr: 999, contacts: 550 },
  { id: "pro", name: "Pro", priceInr: 1999, contacts: 1200 },
  { id: "scale", name: "Scale", priceInr: 4999, contacts: 3000 },
];
