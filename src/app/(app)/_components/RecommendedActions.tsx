"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNetworkVerificationAction } from "../contacts/actions";

const POLL_INTERVAL_MS = 6000;

type VerifyState =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "done"; message: string }
  | { phase: "error"; message: string };

function VerifyNowCard({ pendingCount }: { pendingCount: number }) {
  const [state, setState] = useState<VerifyState>({ phase: "idle" });
  const router = useRouter();

  function poll(jobId: string) {
    async function tick() {
      try {
        const res = await fetch(`/api/verification-jobs/${jobId}`);
        const data = await res.json();
        if (data.status === "completed") {
          setState({
            phase: "done",
            message: `${data.summary.deliverable} deliverable, ${data.summary.risky} risky, ${data.summary.undeliverable} undeliverable.`,
          });
          router.refresh();
        } else if (data.status === "failed") {
          setState({ phase: "error", message: data.errorMessage || "Verification failed." });
        } else {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    }
    tick();
  }

  async function handleClick() {
    setState({ phase: "working" });
    try {
      const result = await startNetworkVerificationAction();
      if (result.mode === "none") {
        setState({ phase: "error", message: "Nothing left to verify." });
      } else if (result.mode === "quota_exceeded") {
        setState({ phase: "error", message: result.message });
      } else if (result.mode === "single") {
        setState({
          phase: "done",
          message: `${result.summary.deliverable} deliverable, ${result.summary.risky} risky, ${result.summary.undeliverable} undeliverable.`,
        });
        router.refresh();
      } else {
        setState({ phase: "working" });
        poll(result.jobId);
      }
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Could not start verification.",
      });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-800">
        <span className="font-medium">{pendingCount.toLocaleString()}</span> contact
        {pendingCount === 1 ? "" : "s"} need{pendingCount === 1 ? "s" : ""} verification.
      </p>
      <button
        onClick={handleClick}
        disabled={state.phase === "working"}
        className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {state.phase === "working" ? "Verifying..." : "Verify Now"}
      </button>
      {state.phase === "done" && (
        <p className="mt-2 text-xs text-green-700">{state.message}</p>
      )}
      {state.phase === "error" && <p className="mt-2 text-xs text-red-700">{state.message}</p>}
    </div>
  );
}

export function RecommendedActions({
  pendingCount,
  undeliverableCount,
  duplicateCount,
}: {
  pendingCount: number;
  undeliverableCount: number;
  duplicateCount: number;
}) {
  if (pendingCount === 0 && undeliverableCount === 0 && duplicateCount === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Recommended Actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {pendingCount > 0 && <VerifyNowCard pendingCount={pendingCount} />}

        {undeliverableCount > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-800">
              <span className="font-medium">{undeliverableCount.toLocaleString()}</span> contact
              {undeliverableCount === 1 ? "" : "s"} {undeliverableCount === 1 ? "is" : "are"}{" "}
              undeliverable.
            </p>
            <Link
              href="/suppression"
              className="mt-2 inline-block rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Clean Contacts
            </Link>
          </div>
        )}

        {duplicateCount > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-800">
              <span className="font-medium">{duplicateCount.toLocaleString()}</span> possible
              duplicate email{duplicateCount === 1 ? "" : "s"} across your lists.
            </p>
            <Link
              href="/network?view=duplicates"
              className="mt-2 inline-block rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Review Duplicates
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
