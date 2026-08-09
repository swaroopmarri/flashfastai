"use client";

import { useState, useTransition } from "react";
import { updateMemberQuota, removeMember } from "./actions";

export interface OrgMember {
  membership_id: string;
  user_id: string;
  email: string;
  role: "admin" | "member";
  status: "invited" | "active";
  validation_quota: number;
  send_quota: number;
  validation_used: number;
  send_used: number;
}

export function MemberRow({ member, isSelf }: { member: OrgMember; isSelf: boolean }) {
  const [validationQuota, setValidationQuota] = useState(member.validation_quota);
  const [sendQuota, setSendQuota] = useState(member.send_quota);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMemberQuota(member.membership_id, validationQuota, sendQuota);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update quota.");
      }
    });
  }

  function handleRemove() {
    if (!confirm(`Remove ${member.email} from the organization?`)) return;
    startTransition(async () => {
      try {
        await removeMember(member.membership_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove member.");
      }
    });
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{member.email}</div>
        <div className="text-xs capitalize text-gray-500">
          {member.role} · {member.status}
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={validationQuota}
          onChange={(e) => setValidationQuota(Number(e.target.value))}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="mt-1 text-xs text-gray-500">{member.validation_used} used</div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={sendQuota}
          onChange={(e) => setSendQuota(Number(e.target.value))}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="mt-1 text-xs text-gray-500">{member.send_used} used</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Save
          </button>
          {!isSelf && (
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
