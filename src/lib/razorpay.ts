import Razorpay from "razorpay";

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (client) return client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set.");
  }

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/**
 * Razorpay subscriptions require a finite total_count rather than "runs
 * forever" -- this is a practical stand-in for an indefinite monthly
 * subscription (10 years of monthly cycles). The customer can cancel
 * anytime before that; this is never expected to actually run out.
 */
export const SUBSCRIPTION_TOTAL_CYCLES = 120;
