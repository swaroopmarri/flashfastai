"use client";

import { useRef, useState, useTransition } from "react";
import { changeOfficeEmail } from "./actions";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await changeOfficeEmail(formData);
        setDone(true);
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not change email.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        Current office email: <span className="font-medium">{currentEmail}</span>
      </p>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700">
            New office email
          </label>
          <input
            id="newEmail"
            name="newEmail"
            type="email"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Must be a work/office email address -- personal providers like
            Gmail, Yahoo, or Outlook.com aren&apos;t accepted.
          </p>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {done && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Confirmation link sent to your new email address. Click it to
            complete the change -- your login email stays the same until
            then.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Change email"}
        </button>
      </form>
    </div>
  );
}
