"use client";

import { useState, useTransition } from "react";
import { parseContactsFile } from "@/lib/parseContactsFile";
import { createContactList, mergeContacts, type ParsedContactRow } from "./actions";

type Props =
  | { mode: "create" }
  | { mode: "merge"; listId: string };

export function UploadForm(props: Props) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: ParsedContactRow[]; skipped: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    if (!f) return;
    try {
      const result = await parseContactsFile(f);
      if (result.rows.length === 0) {
        setError("No valid email addresses were found in that file.");
        return;
      }
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse that file.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || preview.rows.length === 0) return;

    startTransition(async () => {
      try {
        if (props.mode === "create") {
          await createContactList(name.trim() || "Untitled list", preview.rows);
        } else {
          await mergeContacts(props.listId, preview.rows);
          setFile(null);
          setPreview(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {props.mode === "create" && (
        <div>
          <label htmlFor="list-name" className="block text-sm font-medium text-gray-700">
            List name
          </label>
          <input
            id="list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      <div>
        <label htmlFor="contacts-file" className="block text-sm font-medium text-gray-700">
          CSV or Excel file
        </label>
        <input
          id="contacts-file"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500">
          Needs a column containing &quot;email&quot;. Optional name/company columns
          will be picked up automatically.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {preview && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Found {preview.rows.length} contact{preview.rows.length === 1 ? "" : "s"}
          {preview.skipped > 0
            ? ` (skipped ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} with invalid emails)`
            : ""}
          .
        </p>
      )}

      <button
        type="submit"
        disabled={!file || !preview || isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending
          ? "Uploading..."
          : props.mode === "create"
            ? "Create list"
            : "Merge into list"}
      </button>
    </form>
  );
}
