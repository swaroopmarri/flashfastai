"use client";

import { useState, useTransition } from "react";
import { createInvite } from "./actions";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    startTransition(async () => {
      try {
        const result = await createInvite(email.trim());
        setLink(result.url);
        setEmail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create invite.");
      }
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Invite member"}
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {link && (
        <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Invite link created — send this to them:
          <div className="mt-1 break-all rounded bg-white px-2 py-1 font-mono text-xs text-gray-700">
            {link}
          </div>
        </div>
      )}
    </div>
  );
}
