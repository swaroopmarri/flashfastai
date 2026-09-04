"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startCampaignSendAction } from "../../actions";

interface Summary {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
}

type PanelState =
  | { phase: "idle" }
  | { phase: "confirming" }
  | { phase: "starting" }
  | { phase: "polling"; totalRecipients: number; processedRecipients: number }
  | { phase: "done"; summary: Summary }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 3000;

export function SendPanel({
  campaignId,
  canSend,
  recipientCount,
  campaignStatus,
  initialJobId,
  initialSummary,
}: {
  campaignId: string;
  canSend: boolean;
  recipientCount: number;
  campaignStatus: "draft" | "sending" | "sent" | "failed";
  initialJobId: string | null;
  initialSummary: Summary | null;
}) {
  const [state, setState] = useState<PanelState>(() => {
    if (campaignStatus === "sent" && initialSummary) {
      return { phase: "done", summary: initialSummary };
    }
    if (campaignStatus === "sending" && initialJobId) {
      return {
        phase: "polling",
        totalRecipients: initialSummary?.totalRecipients ?? 0,
        processedRecipients: 0,
      };
    }
    return { phase: "idle" };
  });
  const [confirmed, setConfirmed] = useState(false);
  const jobIdRef = useRef<string | null>(initialJobId);
  const router = useRouter();

  useEffect(() => {
    if (state.phase !== "polling" || !jobIdRef.current) return;

    let cancelled = false;
    const jobId = jobIdRef.current;

    async function poll() {
      try {
        const res = await fetch(`/api/send-jobs/${jobId}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "completed") {
          setState({
            phase: "done",
            summary: {
              totalRecipients: data.totalRecipients,
              sentCount: data.sentCount,
              failedCount: data.failedCount,
            },
          });
          router.refresh();
        } else if (data.status === "failed") {
          setState({ phase: "error", message: data.errorMessage || "Send failed." });
        } else {
          setState({
            phase: "polling",
            totalRecipients: data.totalRecipients,
            processedRecipients: data.processedRecipients,
          });
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

  async function handleSend() {
    setState({ phase: "starting" });
    try {
      const result = await startCampaignSendAction(campaignId);
      if (result.mode === "no_recipients") {
        setState({ phase: "error", message: "No eligible recipients (all deliverable contacts may already be unsubscribed)." });
      } else if (result.mode === "blocked") {
        setState({ phase: "error", message: result.message });
      } else {
        jobIdRef.current = result.jobId;
        setState({ phase: "polling", totalRecipients: recipientCount, processedRecipients: 0 });
      }
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Could not start the send.",
      });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Send</h2>
        {state.phase === "idle" && (
          <button
            onClick={() => setState({ phase: "confirming" })}
            disabled={!canSend || recipientCount === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Review Campaign
          </button>
        )}
      </div>

      {state.phase === "idle" && (
        <p className="mt-2 text-sm text-gray-500">
          {recipientCount} recipient{recipientCount === 1 ? "" : "s"} will
          receive this campaign.
          {!canSend && " Save a subject and body before sending."}
        </p>
      )}

      {state.phase === "confirming" && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Please confirm that this campaign is being sent to recipients who have provided
            appropriate permission or for whom you have another lawful basis to communicate.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
            />
            I confirm that I am authorized to send this campaign to the {recipientCount}{" "}
            selected recipient{recipientCount === 1 ? "" : "s"}.
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSend}
              disabled={!confirmed}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send Campaign
            </button>
            <button
              onClick={() => {
                setState({ phase: "idle" });
                setConfirmed(false);
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.phase === "starting" && (
        <p className="mt-3 text-sm text-gray-500">Starting send...</p>
      )}

      {state.phase === "polling" && (
        <div className="mt-3">
          <p className="flex items-center gap-2 text-sm text-indigo-700">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
            Sending {state.processedRecipients} / {state.totalRecipients || recipientCount}...
          </p>
          <p className="mt-1 text-xs text-gray-400">
            You can leave this page — the send continues in the background
            and resumes showing progress when you come back.
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {state.phase === "done" && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-4 text-sm">
            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
              {state.summary.sentCount} sent
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
              {state.summary.failedCount} failed
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
              {state.summary.totalRecipients} total
            </span>
          </div>
          {state.summary.failedCount > 0 && (
            <p className="text-xs text-gray-500">
              If your SES account is still in sandbox mode, failures are
              usually because the recipient address isn&apos;t verified.
              Check the recipient list below for specific reasons.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
