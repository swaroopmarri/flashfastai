"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-sm font-medium text-gray-900">Something went wrong loading this page.</p>
      <p className="mt-1 text-sm text-gray-500">
        If this keeps happening after a database migration was just run, try reloading — some
        pages cache data briefly.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Try again
      </button>
    </div>
  );
}
