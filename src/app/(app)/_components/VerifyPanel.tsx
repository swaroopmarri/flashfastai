"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startVerificationAction, startCompanyVerificationAction } from "../contacts/actions";

export type VerifyTarget =
  | { type: "list"; listId: string }
  | { type: "company"; domain: string };

interface Summary {
  deliverable: number;
  risky: number;
  undeliverable: number;
}

type PanelState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "polling" }
  | { phase: "done"; summary: Summary }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 6000;

export function VerifyPanel({
  target,
  pendingCount,
  activeJobId,
  label = "Verify contacts",
  buttonLabel = "Verify Contacts",
}: {
  target: VerifyTarget;
  pendingCount: number;
  activeJobId: string | null;
  label?: string;
  buttonLabel?: string;
}) {
  const [state, setState] = useState<PanelState>(
    activeJobId ? { phase: "polling" } : { phase: "idle" },
  );
  const jobIdRef = useRef<string | null>(activeJobId);
  const router = useRouter();

  useEffect(() => {
    if (state.phase !== "polling" || !jobIdRef.current) return;

    let cancelled = false;
    const jobId = jobIdRef.current;

    async function poll() {
      try {
        const res = await fetch(`/api/verification-jobs/${jobId}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "completed") {
          setState({ phase: "done", summary: data.summary });
          router.refresh();
        } else if (data.status === "failed") {
          setState({ phase: "error", message: data.errorMessage || "Verification failed." });
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  async function handleVerify() {
    setState({ phase: "starting" });
    try {
      const result =
        target.type === "list"
          ? await startVerificationAction(target.listId)
          : await startCompanyVerificationAction(target.domain);

      if (result.mode === "none") {
        setState({ phase: "error", message: "No contacts are pending verification." });
      } else if (result.mode === "quota_exceeded") {
        setState({ phase: "error", message: result.message });
      } else if (result.mode === "single") {
        setState({ phase: "done", summary: result.summary });
        router.refresh();
      } else {
        jobIdRef.current = result.jobId;
        setState({ phase: "polling" });
      }
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Could not start verification.",
      });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">{label}</h2>
        <button
          onClick={handleVerify}
          disabled={pendingCount === 0 || state.phase === "starting" || state.phase === "polling"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.phase === "starting"
            ? "Starting..."
            : state.phase === "polling"
              ? "Verifying..."
              : buttonLabel}
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {pendingCount} contact{pendingCount === 1 ? "" : "s"} pending verification.
      </p>

      {state.phase === "polling" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-indigo-700">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
          Verifying against ZeroBounce — larger batches can take a few minutes.
          You can leave this page and come back; verification continues in the
          background.
        </p>
      )}

      {state.phase === "error" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {state.phase === "done" && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
            {state.summary.deliverable} deliverable
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700">
            {state.summary.risky} risky
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
            {state.summary.undeliverable} undeliverable
          </span>
        </div>
      )}
    </div>
  );
}
