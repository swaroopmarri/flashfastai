import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/schemaGuard";

/**
 * Reads the current uploaded image URL for a named slot (e.g.
 * 'landing_hero'), added by migration 0010. Returns null both when nothing
 * has been uploaded yet AND when the migration hasn't been run yet --
 * callers should already have a sensible default illustration for the
 * "nothing uploaded" case, which covers both.
 */
export async function getSiteImageUrl(
  supabase: SupabaseClient,
  slot: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("site_images")
    .select("url")
    .eq("slot", slot)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }

  return data?.url ?? null;
}
