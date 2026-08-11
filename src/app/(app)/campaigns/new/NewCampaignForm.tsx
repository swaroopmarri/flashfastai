"use client";

import { useState, useTransition } from "react";
import { createCampaign } from "../actions";

export function NewCampaignForm({
  lists,
}: {
  lists: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listId) {
      setError("Create a contact list first.");
      return;
    }
    startTransition(async () => {
      try {
        await createCampaign(name.trim() || "Untitled campaign", listId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create campaign.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700">
          Campaign name
        </label>
        <input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="contact-list" className="block text-sm font-medium text-gray-700">
          Contact list
        </label>
        <select
          id="contact-list"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || lists.length === 0}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Continue to Audience"}
      </button>
    </form>
  );
}
