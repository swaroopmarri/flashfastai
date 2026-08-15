"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchNetworkContactsAction,
  type NetworkContactRow,
} from "../network/actions";
import { startSelectionVerificationAction } from "../contacts/actions";
import { createSelectionCampaign } from "../campaigns/actions";
import { companyDisplayName } from "@/lib/companyName";

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-gray-100 text-gray-700",
  deliverable: "bg-green-100 text-green-700",
  risky: "bg-yellow-100 text-yellow-700",
  undeliverable: "bg-red-100 text-red-700",
  unsubscribed: "bg-gray-200 text-gray-500",
};

const POLL_INTERVAL_MS = 6000;

type BulkState =
  | { phase: "idle" }
  | { phase: "working"; label: string }
  | { phase: "done"; message: string }
  | { phase: "error"; message: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ContactsTable({
  domain,
  search,
  status,
  duplicatesOnly,
  pageSize = 25,
}: {
  domain?: string;
  search?: string;
  status?: string | null;
  duplicatesOnly?: boolean;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<NetworkContactRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<BulkState>({ phase: "idle" });
  const jobPollRef = useRef<string | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // A filter change invalidates the current result set entirely, so both
  // the page and any prior selection reset. Page alone changing keeps the
  // selection -- picking contacts across pages before running a bulk
  // action is expected to work.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, search, status, duplicatesOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchNetworkContactsAction({
      domain,
      search,
      status: status ?? undefined,
      duplicatesOnly,
      page,
      pageSize,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotalCount(res.totalCount);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, search, status, duplicatesOnly, page, pageSize]);

  function refetch() {
    setLoading(true);
    searchNetworkContactsAction({
      domain,
      search,
      status: status ?? undefined,
      duplicatesOnly,
      page,
      pageSize,
    })
      .then((res) => {
        setRows(res.rows);
        setTotalCount(res.totalCount);
      })
      .finally(() => setLoading(false));
  }

  function toggleRow(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleAllOnPage() {
    const pageEmails = rows.map((r) => r.email);
    const allSelected = pageEmails.every((e) => selected.has(e));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageEmails.forEach((e) => next.delete(e));
      else pageEmails.forEach((e) => next.add(e));
      return next;
    });
  }

  function pollJob(jobId: string) {
    jobPollRef.current = jobId;
    setBulkState({ phase: "working", label: "Verifying..." });

    async function poll() {
      if (jobPollRef.current !== jobId) return;
      try {
        const res = await fetch(`/api/verification-jobs/${jobId}`);
        const data = await res.json();
        if (jobPollRef.current !== jobId) return;

        if (data.status === "completed") {
          setBulkState({
            phase: "done",
            message: `${data.summary.deliverable} deliverable, ${data.summary.risky} risky, ${data.summary.undeliverable} undeliverable.`,
          });
          setSelected(new Set());
          router.refresh();
          refetch();
        } else if (data.status === "failed") {
          setBulkState({
            phase: "error",
            message: data.errorMessage || "Verification failed.",
          });
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
  }

  async function handleVerifySelected() {
    setBulkState({ phase: "working", label: "Starting..." });
    try {
      const result = await startSelectionVerificationAction(Array.from(selected));
      if (result.mode === "none") {
        setBulkState({
          phase: "error",
          message: "None of the selected contacts are pending verification.",
        });
      } else if (result.mode === "quota_exceeded") {
        setBulkState({ phase: "error", message: result.message });
      } else if (result.mode === "single") {
        setBulkState({
          phase: "done",
          message: `${result.summary.deliverable} deliverable, ${result.summary.risky} risky, ${result.summary.undeliverable} undeliverable.`,
        });
        setSelected(new Set());
        router.refresh();
        refetch();
      } else {
        pollJob(result.jobId);
      }
    } catch (e) {
      setBulkState({
        phase: "error",
        message: e instanceof Error ? e.message : "Could not start verification.",
      });
    }
  }

  async function handleExportSelected() {
    setBulkState({ phase: "working", label: "Preparing export..." });
    try {
      const res = await fetch("/api/contacts/export-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: Array.from(selected) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "selected_contacts.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBulkState({ phase: "idle" });
    } catch (e) {
      setBulkState({
        phase: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    }
  }

  function handleAddToCampaign() {
    const emails = Array.from(selected);
    startTransition(async () => {
      await createSelectionCampaign(emails);
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.email));

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-indigo-900">
            {selected.size} contact{selected.size === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={handleVerifySelected}
            disabled={bulkState.phase === "working"}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            Verify Selected
          </button>
          <button
            onClick={handleExportSelected}
            disabled={bulkState.phase === "working"}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={handleAddToCampaign}
            disabled={bulkState.phase === "working" || isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending ? "Creating campaign..." : "Add to Campaign"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-indigo-700 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {bulkState.phase === "working" && (
        <p className="mb-3 flex items-center gap-2 text-sm text-indigo-700">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
          {bulkState.label}
        </p>
      )}
      {bulkState.phase === "done" && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {bulkState.message}
        </p>
      )}
      {bulkState.phase === "error" && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {bulkState.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="w-8 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={rows.length === 0}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Verified</th>
              <th className="px-4 py-2 font-medium">Lists</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  No contacts match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.email} className={selected.has(r.email) ? "bg-indigo-50/50" : ""}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.email)}
                      onChange={() => toggleRow(r.email)}
                      aria-label={`Select ${r.email}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-900">{r.email}</td>
                  <td className="px-4 py-2 text-gray-600">{r.name || "—"}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.company || companyDisplayName(r.email.split("@")[1] ?? "")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(r.verifiedAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.listNames.map((name) => (
                        <span
                          key={name}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {rangeStart}–{rangeEnd} of {totalCount.toLocaleString()} contacts
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 py-1">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
