"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Deliverable", value: "deliverable" },
  { label: "Undeliverable", value: "undeliverable" },
  { label: "Risky", value: "risky" },
  { label: "Pending", value: "pending_verification" },
  { label: "Unsubscribed", value: "unsubscribed" },
];

export function NetworkSearchFilters({
  initialSearch,
  initialStatus,
  initialView,
}: {
  initialSearch: string;
  initialStatus: string | null;
  initialView: string | null;
}) {
  const [search, setSearch] = useState(initialSearch);
  const router = useRouter();
  const firstRun = useRef(true);

  // Debounced: typing updates the URL (and therefore the server-fetched
  // results) 400ms after the user stops, not on every keystroke.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (initialStatus) params.set("status", initialStatus);
      router.replace(`/network${params.toString() ? `?${params}` : ""}`);
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setStatus(status: string | null) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    router.push(`/network${params.toString() ? `?${params}` : ""}`);
  }

  const hasFilters = Boolean(initialSearch || initialStatus || initialView);

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts, companies, domains, or emails..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-md"
        />
        {hasFilters && (
          <a href="/network" className="text-xs text-indigo-600 hover:underline">
            Clear filters
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = initialView !== "duplicates" && initialStatus === tab.value;
          return (
            <button
              key={tab.label}
              onClick={() => setStatus(tab.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
        {initialView === "duplicates" && (
          <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            Duplicates
          </span>
        )}
      </div>
    </div>
  );
}
