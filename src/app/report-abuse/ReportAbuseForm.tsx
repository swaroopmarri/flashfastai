"use client";

import { useState, useTransition } from "react";
import { submitAbuseReport } from "./actions";

const EMPTY = {
  reporterEmail: "",
  recipientEmail: "",
  senderEmail: "",
  subject: "",
  reason: "",
  details: "",
};

export function ReportAbuseForm() {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitAbuseReport(values);
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your report.");
      }
    });
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
        Thank you — your report has been submitted and will be reviewed.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reporterEmail" className="block text-sm font-medium text-gray-700">
          Your email
        </label>
        <input
          id="reporterEmail"
          type="email"
          required
          value={values.reporterEmail}
          onChange={(e) => set("reporterEmail", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700">
          Email address that received the message
        </label>
        <input
          id="recipientEmail"
          type="email"
          required
          value={values.recipientEmail}
          onChange={(e) => set("recipientEmail", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="senderEmail" className="block text-sm font-medium text-gray-700">
          Sender email address (if known)
        </label>
        <input
          id="senderEmail"
          type="text"
          value={values.senderEmail}
          onChange={(e) => set("senderEmail", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
          Subject line (if known)
        </label>
        <input
          id="subject"
          type="text"
          value={values.subject}
          onChange={(e) => set("subject", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
          Reason for report
        </label>
        <input
          id="reason"
          type="text"
          required
          placeholder="e.g. I never signed up to receive this / this looks like spam"
          value={values.reason}
          onChange={(e) => set("reason", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="details" className="block text-sm font-medium text-gray-700">
          Additional information
        </label>
        <textarea
          id="details"
          rows={4}
          value={values.details}
          onChange={(e) => set("details", e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit report"}
      </button>
    </form>
  );
}
