"use client";

import { useRef, useState, useTransition } from "react";
import { uploadSiteImage } from "./actions";

export function SiteImageUploadForm({
  slot,
  label,
  currentUrl,
}: {
  slot: string;
  label: string;
  currentUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    setError(null);
    setDone(false);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        await uploadSiteImage(slot, formData);
        setDone(true);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{label}</p>

      <div className="flex items-center gap-4">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview ?? currentUrl ?? undefined}
            alt=""
            className={`h-full w-full object-cover ${!preview && !currentUrl ? "hidden" : ""}`}
          />
          {!preview && !currentUrl && (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No image yet
            </div>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">JPEG, PNG, or WebP, up to 5MB.</p>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {done && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Uploaded — the landing page now shows this image.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
