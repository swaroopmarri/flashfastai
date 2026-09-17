"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { flushIdleAutosave } from "@/lib/idleAutosave";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];

export function IdleLogout() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const loggingOutRef = useRef(false);

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const interval = setInterval(async () => {
      if (loggingOutRef.current) return;
      const remaining = IDLE_LIMIT_MS - (Date.now() - lastActivityRef.current);

      if (remaining <= 0) {
        loggingOutRef.current = true;
        clearInterval(interval);
        await flushIdleAutosave();
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/login?message=" + encodeURIComponent("You were logged out after 30 minutes of inactivity.");
        return;
      }

      setSecondsLeft(remaining <= WARNING_BEFORE_MS ? Math.ceil(remaining / 1000) : null);
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      clearInterval(interval);
    };
  }, []);

  function stayLoggedIn() {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900">Still there?</h2>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;ve been inactive for a while. For your security, you&apos;ll be logged out in{" "}
          <span className="font-medium text-gray-900">{secondsLeft}s</span> unless you stay logged
          in.
        </p>
        <button
          onClick={stayLoggedIn}
          className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Stay logged in
        </button>
      </div>
    </div>
  );
}
