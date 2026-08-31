"use client";

import { useState, useTransition } from "react";
import {
  PRICING_PLANS,
  getCurrencyPricing,
  withGst,
  type CurrencyCode,
  type TermId,
} from "@/lib/pricingPlans";
import { startSubscription, changePlan, cancelSubscription } from "./billingActions";

const STATUS_LABELS: Record<string, string> = {
  created: "Awaiting payment authorization",
  authenticated: "Awaiting first charge",
  active: "Active",
  pending: "Payment retry in progress",
  halted: "Payments failing -- quota paused",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};

const TERM_OPTIONS: { id: TermId; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "6month", label: "6 months (5% off)" },
  { id: "12month", label: "12 months (8% off)" },
];

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { INR: "₹", USD: "$" };

export function BillingSection({
  currentPlanId,
  currentCurrency,
  currentTermId,
  status,
}: {
  currentPlanId: string | null;
  currentCurrency: CurrencyCode | null;
  currentTermId: string | null;
  status: string | null;
}) {
  const [currency, setCurrency] = useState<CurrencyCode>(currentCurrency ?? "INR");
  const [selectedTermId, setSelectedTermId] = useState<TermId>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOpen = status !== null && status !== "cancelled" && status !== "completed" && status !== "expired";
  const isActive = status === "active";
  const isFrozen = status === "halted";

  function runAction(action: () => Promise<void>, successMessage: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await action();
        setNotice(successMessage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const symbol = CURRENCY_SYMBOL[currency];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Current plan:{" "}
        <span className="font-medium">
          {currentPlanId
            ? `${PRICING_PLANS.find((p) => p.id === currentPlanId)?.name ?? currentPlanId}${
                currentTermId ? ` -- ${TERM_OPTIONS.find((t) => t.id === currentTermId)?.label ?? currentTermId}` : ""
              }${currentCurrency ? ` (${currentCurrency})` : ""}`
            : "None -- subscribe to a plan below"}
        </span>
        {status && (
          <span className="ml-2 text-xs text-gray-400">({STATUS_LABELS[status] ?? status})</span>
        )}
      </p>

      {isFrozen && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Payments have failed and quota is paused. Update the payment method
          in Razorpay, or cancel below -- quota resumes automatically once a
          charge succeeds again.
        </p>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
      )}

      <div className="flex flex-wrap gap-6">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">Currency</p>
          <div className="flex gap-2">
            {(["INR", "USD"] as CurrencyCode[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={isOpen && c !== currentCurrency}
                title={isOpen && c !== currentCurrency ? "Cancel the current subscription to switch currency" : undefined}
                onClick={() => setCurrency(c)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  currency === c
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">Billing term (for Subscribe/Switch below)</p>
          <div className="flex gap-2">
            {TERM_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTermId(t.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  selectedTermId === t.id
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRICING_PLANS.map((plan) => {
          const pricing = getCurrencyPricing(plan.id, currency);
          const term = pricing?.terms.find((t) => t.id === selectedTermId);
          const displayTotal = term
            ? pricing?.gstApplicable
              ? withGst(term.totalPriceExGst)
              : term.totalPriceExGst
            : undefined;
          const isCurrent =
            isActive && plan.id === currentPlanId && selectedTermId === currentTermId && currency === currentCurrency;

          return (
            <div key={plan.id} className="rounded-md border border-gray-200 p-3 text-center">
              <p className="text-sm font-medium text-gray-900">{plan.name}</p>
              <p className="text-xs text-gray-500">
                {symbol}
                {displayTotal?.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}
                {term && term.months > 1 ? ` / ${term.months}mo` : "/mo"}
              </p>
              {pricing?.gstApplicable && (
                <p className="text-[10px] text-gray-400">incl. 18% GST</p>
              )}

              {isCurrent ? (
                <p className="mt-2 rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500">
                  Current plan
                </p>
              ) : isOpen ? (
                <button
                  type="button"
                  disabled={isPending || !isActive || currency !== currentCurrency}
                  title={
                    currency !== currentCurrency
                      ? "Cancel the current subscription to switch currency"
                      : !isActive
                        ? "Wait for the current subscription to finish activating"
                        : undefined
                  }
                  onClick={() =>
                    runAction(
                      () => changePlan(plan.id, currency, selectedTermId),
                      "Change requested -- this updates within a few seconds once Razorpay confirms.",
                    )
                  }
                  className="mt-2 w-full rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Switch
                </button>
              ) : (
                <form action={startSubscription.bind(null, plan.id, currency, selectedTermId)}>
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {isOpen && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction(
              () => cancelSubscription(),
              "Cancellation requested -- this updates within a few seconds once Razorpay confirms.",
            )
          }
          className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel subscription
        </button>
      )}
    </div>
  );
}
