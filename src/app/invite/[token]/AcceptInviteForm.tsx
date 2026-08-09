"use client";

import { useTransition } from "react";
import { acceptInvite } from "./actions";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string;
    startTransition(() => acceptInvite(token, password));
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          value={email}
          disabled
          className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Choose a password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Joining..." : "Join organization"}
      </button>
    </form>
  );
}
