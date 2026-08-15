"use client";

import { useState } from "react";
import Link from "next/link";
import { companyDisplayName } from "@/lib/companyName";
import { ContactsTable } from "./ContactsTable";

export interface DomainCount {
  domain: string;
  total: number;
  deliverable: number;
  risky: number;
  undeliverable: number;
  pending: number;
  unsubscribed: number;
}

function healthPercent(d: DomainCount): number {
  if (d.total === 0) return 0;
  return Math.round((d.deliverable / d.total) * 100);
}

function healthColor(pct: number): string {
  if (pct >= 80) return "text-green-700";
  if (pct >= 50) return "text-yellow-700";
  return "text-red-700";
}

export function CompanyCardsGrid({ companies }: { companies: DomainCount[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {companies.map((d) => {
        const isOpen = expanded === d.domain;
        const health = healthPercent(d);
        return (
          <div
            key={d.domain}
            className="rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : d.domain)}
              className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="truncate font-medium text-gray-900">
                    {companyDisplayName(d.domain)}
                  </h3>
                  <span className="shrink-0 text-xs text-gray-400">{d.domain}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {d.total.toLocaleString()} contacts &middot;{" "}
                  <span className="text-green-700">{d.deliverable} deliverable</span>
                  {d.undeliverable > 0 && (
                    <>
                      {" "}
                      &middot; <span className="text-red-700">{d.undeliverable} undeliverable</span>
                    </>
                  )}
                  {d.risky > 0 && (
                    <>
                      {" "}
                      &middot; <span className="text-yellow-700">{d.risky} risky</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className={`text-sm font-semibold ${healthColor(health)}`}>{health}%</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">health</p>
                </div>
                <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Contacts at {companyDisplayName(d.domain)}</p>
                  <Link
                    href={`/network/${d.domain}`}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Open full page ↗
                  </Link>
                </div>
                <ContactsTable domain={d.domain} pageSize={10} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
