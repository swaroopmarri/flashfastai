import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses every RLS policy -- use ONLY for narrow,
 * server-only operations that genuinely cannot be scoped to a user's own
 * session (e.g. the cron-triggered quota reset, which touches every
 * organization). Never import this into anything reachable from a
 * user-driven request path; those should use utils/supabase/server.ts
 * instead so RLS stays in effect.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
