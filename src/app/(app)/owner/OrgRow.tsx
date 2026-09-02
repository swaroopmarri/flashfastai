"use client";

import { useState, useTransition } from "react";
import { setOrganizationQuota, deleteOrganization } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  created: "bg-gray-100 text-gray-500",
  authenticated: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
  halted: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
  completed: "bg-gray-100 text-gray-400",
  expired: "bg-gray-100 text-gray-400",
};

export interface OrgRowData {
  id: string;
  name: string;
  createdAt: string;
  planValidationQuota: number;
  planSendQuota: number;
  validationUsed: number;
  sendUsed: number;
  planId: string | null;
  termId: string | null;
  currency: string | null;
  subscriptionStatus: string | null;
}

export function OrgRow({ org }: { org: OrgRowData }) {
  const [validationQuota, setValidationQuota] = useState(org.planValidationQuota);
  const [sendQuota, setSendQuota] = useState(org.planSendQuota);
  const [editingQuota, setEditingQuota] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"closed" | "confirmName" | "finalConfirm">("closed");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveQuota() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await setOrganizationQuota(org.id, validationQuota, sendQuota);
        setNotice("Quota updated.");
        setEditingQuota(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update quota.");
      }
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteOrganization(org.id, confirmName);
        // Row disappears once /owner revalidates -- no local state needed
        // on success.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete organization.");
      }
    });
  }

  const validationPct = org.planValidationQuota
    ? Math.round((org.validationUsed / org.planValidationQuota) * 100)
    : 0;
  const sendPct = org.planSendQuota ? Math.round((org.sendUsed / org.planSendQuota) * 100) : 0;

  return (
    <>
      <tr>
        <td className="px-4 py-2 font-medium text-gray-900">{org.name}</td>
        <td className="px-4 py-2 text-gray-500">{new Date(org.createdAt).toLocaleDateString()}</td>
        <td className="px-4 py-2 text-gray-500">
          {org.planId ? `${org.planId} — ${org.termId} (${org.currency})` : "No subscription"}
        </td>
        <td className="px-4 py-2">
          {org.subscriptionStatus ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_COLORS[org.subscriptionStatus] ?? "bg-gray-100 text-gray-500"
              }`}
            >
              {org.subscriptionStatus}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-gray-700">
          {editingQuota ? (
            <input
              type="number"
              min={0}
              value={validationQuota}
              onChange={(e) => setValidationQuota(Number(e.target.value))}
              className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            />
          ) : (
            <span className={validationPct >= 80 ? "font-medium text-amber-600" : ""}>
              {org.validationUsed} / {org.planValidationQuota} ({validationPct}%)
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-gray-700">
          {editingQuota ? (
            <input
              type="number"
              min={0}
              value={sendQuota}
              onChange={(e) => setSendQuota(Number(e.target.value))}
              className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            />
          ) : (
            <span className={sendPct >= 80 ? "font-medium text-amber-600" : ""}>
              {org.sendUsed} / {org.planSendQuota} ({sendPct}%)
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            {editingQuota ? (
              <>
                <button
                  type="button"
                  onClick={saveQuota}
                  disabled={isPending}
                  className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuota(false);
                    setValidationQuota(org.planValidationQuota);
                    setSendQuota(org.planSendQuota);
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditingQuota(true)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Edit quota
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteStep("confirmName")}
              className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {error && (
        <tr>
          <td colSpan={7} className="bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </td>
        </tr>
      )}
      {notice && !error && (
        <tr>
          <td colSpan={7} className="bg-green-50 px-4 py-2 text-xs text-green-700">
            {notice}
          </td>
        </tr>
      )}

      {deleteStep === "confirmName" && (
        <tr>
          <td colSpan={7} className="bg-red-50 px-4 py-3">
            <p className="mb-2 text-xs text-red-800">
              Step 1 of 2 — this will permanently delete <strong>{org.name}</strong> and every
              member&apos;s account, contact lists, campaigns, and data. Type the organization name
              to continue:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={org.name}
                className="w-64 rounded border border-red-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => setDeleteStep("finalConfirm")}
                disabled={confirmName !== org.name}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteStep("closed");
                  setConfirmName("");
                }}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}

      {deleteStep === "finalConfirm" && (
        <tr>
          <td colSpan={7} className="bg-red-100 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-red-900">
              Step 2 of 2 — last chance. Deleting <strong>{org.name}</strong> cannot be undone: every
              member loses their login immediately, and all their contact lists, contacts,
              verification history, and campaigns are permanently erased.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Deleting…" : `Yes, permanently delete ${org.name}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteStep("closed");
                  setConfirmName("");
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
