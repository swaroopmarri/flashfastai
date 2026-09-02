/**
 * Real per-unit provider costs, used only to show a rough cost/margin
 * estimate on the Owner Dashboard -- NOT used anywhere in pricing or
 * billing logic (see pricingPlans.ts for the numbers that actually
 * determine what customers pay).
 *
 * Sourced directly from each provider's own pricing page rather than
 * estimated:
 * - MillionVerifier: app.millionverifier.com/topup, the 1,000,000-credit
 *   one-time bulk tier, ₹39,999. That tier currently also grants +10%
 *   bonus credits; ignoring the bonus here keeps this a conservative
 *   (slightly too high) per-verification cost.
 * - AWS SES: ap-south-1 (Mumbai) console, Essentials plan, the
 *   0-10M-emails/month tier -- the account's current plan.
 *
 * Both are one-off snapshots, not a live price feed -- update the two
 * constants below when either provider's pricing or plan tier changes.
 */

export const VERIFICATION_COST_INR = 39_999 / 1_000_000;

export const SEND_COST_USD = 0.16 / 1000;

/** Approximate USD->INR rate, used only to blend SES's USD-denominated
 * cost into a single INR margin estimate below. Not a live exchange rate. */
export const USD_TO_INR_RATE = 88;

export function verificationCostInr(count: number): number {
  return count * VERIFICATION_COST_INR;
}

export function sendCostInr(count: number): number {
  return count * SEND_COST_USD * USD_TO_INR_RATE;
}
