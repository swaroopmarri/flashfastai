"use client";

import { useEffect } from "react";

/**
 * Strips ?error=/?message= from the address bar right after they're shown,
 * without a Next.js navigation (which would re-render the page and could
 * make the banner disappear before the user reads it). Pure browser
 * history mutation -- so a manual refresh afterward loads a clean /login
 * instead of re-showing the same stale error.
 */
export function ClearUrlParams({ shouldClear }: { shouldClear: boolean }) {
  useEffect(() => {
    if (shouldClear) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [shouldClear]);

  return null;
}
