/**
 * Pricing tiers shown on the public landing page ONLY (src/app/page.tsx).
 * Update a price or quota here and it's reflected there.
 *
 * These contact numbers are sized for 50%+ gross margin against
 * MillionVerifier's 1M-credit plan (~₹0.043/verification) plus AWS SES
 * sending (~₹0.01/email) and a small per-customer overhead allowance --
 * NOT against ZeroBounce, which is what the app actually calls today
 * (src/lib/zerobounce.ts). MillionVerifier is NOT integrated yet.
 *
 * This is a deliberate, display-only choice: these numbers are marketing
 * copy, not an enforced quota. They do NOT match what a customer signing
 * up today would actually get -- every new organization still gets the
 * flat default quota from migrations 0002/0003 (10,000 validation +
 * 10,000 send, ZeroBounce-backed), and plan selection isn't wired into
 * signup/billing at all yet (no payment flow exists).
 *
 * Before a real customer could actually be provisioned at these contact
 * volumes, MillionVerifier needs to be integrated for real -- otherwise
 * fulfilling these numbers against ZeroBounce's real (higher) cost would
 * run at a loss, not a 50%+ margin.
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
  { id: "starter", name: "Starter", priceInr: 499, contacts: 3500 },
  { id: "growth", name: "Growth", priceInr: 999, contacts: 8000 },
  { id: "pro", name: "Pro", priceInr: 1999, contacts: 17000 },
  { id: "scale", name: "Scale", priceInr: 4999, contacts: 45000 },
];
