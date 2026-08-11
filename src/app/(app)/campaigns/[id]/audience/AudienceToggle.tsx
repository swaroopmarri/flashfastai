"use client";

import { useState, useTransition } from "react";
import { updateAudience } from "../../actions";

export function AudienceToggle({
  campaignId,
  initialIncludeRisky,
  deliverableCount,
  riskyCount,
}: {
  campaignId: string;
  initialIncludeRisky: boolean;
  deliverableCount: number;
  riskyCount: number;
}) {
  const [includeRisky, setIncludeRisky] = useState(initialIncludeRisky);
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setIncludeRisky(checked);
    startTransition(() => updateAudience(campaignId, checked));
  }

  const audienceSize = deliverableCount + (includeRisky ? riskyCount : 0);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={includeRisky}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Also include risky contacts (accept the deliverability risk)
      </label>

      <p className="mt-4 text-sm text-gray-600">
        This campaign will send to{" "}
        <span className="font-semibold text-gray-900">{audienceSize}</span>{" "}
        recipient{audienceSize === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
