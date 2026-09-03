"use client";

import { useState } from "react";
import Link from "next/link";
import { PRICING_PLANS, getCurrencyPricing, type CurrencyCode } from "@/lib/pricingPlans";

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { INR: "₹", USD: "$" };

export function PricingCards() {
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const symbol = CURRENCY_SYMBOL[currency];
  const locale = currency === "INR" ? "en-IN" : "en-US";

  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 text-sm">
          {(["INR", "USD"] as CurrencyCode[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded px-4 py-1.5 font-medium ${
                currency === c ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {c === "INR" ? "₹ INR" : "$ USD"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_PLANS.map((plan) => {
          const pricing = getCurrencyPricing(plan.id, currency);
          if (!pricing) return null;
          const isPopular = plan.id === "pro";

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-lg border bg-white text-center shadow-sm ${
                isPopular ? "border-indigo-400 ring-2 ring-indigo-200" : "border-gray-200"
              }`}
            >
              {isPopular && (
                <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <div
                className={`px-6 py-6 text-white ${
                  isPopular
                    ? "bg-gradient-to-r from-indigo-600 to-sky-500"
                    : "bg-gradient-to-r from-gray-700 to-gray-500"
                }`}
              >
                <p className="text-sm font-medium uppercase tracking-wide opacity-90">{plan.name}</p>
                <p className="mt-1 text-3xl font-semibold">
                  {symbol}
                  {pricing.monthlyPriceExGst.toLocaleString(locale)}
                  <span className="text-sm font-normal opacity-80">/mo</span>
                </p>
                <p className="mt-1 text-xs opacity-90">
                  Up to {plan.contacts.toLocaleString("en-IN")} contacts
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-1.5 text-left text-xs text-gray-700">
                  <li>✓ Verification included</li>
                  <li>✓ Unlimited campaigns</li>
                  <li>✓ My Network</li>
                  <li>✓ Suppression handling</li>
                </ul>

                <ul className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-left text-xs text-gray-500">
                  {pricing.terms
                    .filter((t) => t.discountPercent > 0)
                    .map((t) => (
                      <li key={t.id}>
                        Prepay {t.label.toLowerCase()}:{" "}
                        <span className="font-medium text-gray-700">
                          {symbol}
                          {t.totalPriceExGst.toLocaleString(locale)}
                        </span>{" "}
                        <span className="text-emerald-600">(save {t.discountPercent}%)</span>
                      </li>
                    ))}
                </ul>

                <Link
                  href="/login"
                  className="mt-6 block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Get Started
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
