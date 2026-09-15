"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCampaign } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sending: "bg-yellow-100 text-yellow-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export interface CampaignListItem {
  id: string;
  name: string;
  status: string;
}

export function CampaignRow({ campaign }: { campaign: CampaignListItem }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete the draft "${campaign.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteCampaign(campaign.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete campaign.");
      }
    });
  }

  return (
    <li>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
        <Link
          href={`/campaigns/${campaign.id}/${campaign.status === "draft" ? "audience" : "compose"}`}
          className="flex flex-1 items-center gap-3"
        >
          <span className="font-medium text-gray-900">{campaign.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[campaign.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {campaign.status}
          </span>
        </Link>
        {campaign.status === "draft" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="ml-3 shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
      {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
