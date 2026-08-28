"use client";

import { useState, useTransition } from "react";
import { PRICING_PLANS } from "@/lib/pricingPlans";
import { startSubscription, changePlan, cancelSubscription } from "./billingActions";

const STATUS_LABELS: Record<string, string> = {
  created: "Awaiting payment authorization",
  authenticated: "Awaiting first charge",
  active: "Active",
  pending: "Payment retry in progress",
  halted: "Payments failing -- action needed",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};

export function BillingSection({
  currentPlanId,
  status,
}: {
  currentPlanId: string | null;
  status: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOpen = status !== null && status !== "cancelled" && status !== "completed" && status !== "expired";
  const isActive = status === "active";

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Current plan:{" "}
        <span className="font-medium">
          {currentPlanId
            ? PRICING_PLANS.find((p) => p.id === currentPlanId)?.name ?? currentPlanId
            : "None -- subscribe to a plan below"}
        </span>
        {status && (
          <span className="ml-2 text-xs text-gray-400">({STATUS_LABELS[status] ?? status})</span>
        )}
      </p>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRICING_PLANS.map((plan) => {
          const isCurrent = isActive && plan.id === currentPlanId;

          return (
            <div key={plan.id} className="rounded-md border border-gray-200 p-3 text-center">
              <p className="text-sm font-medium text-gray-900">{plan.name}</p>
              <p className="text-xs text-gray-500">
                ₹{plan.priceInr.toLocaleString("en-IN")}/mo
              </p>

              {isCurrent ? (
                <p className="mt-2 rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500">
                  Current plan
                </p>
              ) : isOpen ? (
                <button
                  type="button"
                  disabled={isPending || !isActive}
                  title={!isActive ? "Wait for the current subscription to finish activating" : undefined}
                  onClick={() =>
                    runAction(
                      () => changePlan(plan.id),
                      "Change requested -- this updates within a few seconds once Razorpay confirms.",
                    )
                  }
                  className="mt-2 w-full rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Switch
                </button>
              ) : (
                <form action={startSubscription.bind(null, plan.id)}>
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
