"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubscribeContactAction } from "../contacts/actions";

export function ResubscribeButton({
  email,
  unsubscribedAt,
}: {
  email: string;
  unsubscribedAt: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const formattedDate = new Date(unsubscribedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        Resubscribe
      </button>
    );
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs">
      <p className="mb-2 text-yellow-900">
        Are you sure? This contact explicitly opted out on {formattedDate}.
      </p>
      {error && <p className="mb-2 text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await resubscribeContactAction(email);
              if (result.error) {
                setError(result.error);
                return;
              }
              setConfirming(false);
              router.refresh();
            })
          }
          className="rounded bg-yellow-700 px-2 py-1 font-medium text-white hover:bg-yellow-800 disabled:opacity-50"
        >
          {isPending ? "Resubscribing..." : "Yes, resubscribe"}
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
