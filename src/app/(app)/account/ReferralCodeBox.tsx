"use client";

import { useState } from "react";

export function ReferralCodeBox({ code, shareUrl }: { code: string; shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) -- the
      // input below is still selectable/copyable by hand either way.
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-600">
        Your referral code: <span className="font-mono font-medium text-gray-900">{code}</span>
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.target.select()}
          className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
