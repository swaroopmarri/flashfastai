// Supabase/PostgREST caps any unranged select (table or RPC) at a
// project-level default (commonly 1000 rows) -- past that, a query
// silently returns a truncated result instead of erroring, so a large
// contact list, company, or account can end up partially sent, partially
// verified, or partially exported with no indication anything was cut off.
// Every query over a table that can grow past that cap needs to page
// through it explicitly instead of relying on the project's dashboard
// setting.
const PAGE_SIZE = 1000;

// How many pages to request at once. Since the true total isn't known
// upfront, pages within a wave are fetched in parallel and the wave stops
// as soon as any page in it comes back short (the real end of the result
// set) -- a handful of harmless extra empty requests near the very end is
// a fair trade for turning what used to be dozens of sequential round
// trips (e.g. ~46 for a 45,000-row list) into a handful of parallel waves.
const WAVE_SIZE = 6;

/** Calls `fetchPage(from, to)` in parallel waves, advancing the range each
 * wave, until a page comes back shorter than a full page -- collecting
 * every row regardless of how many pages that takes. `fetchPage` should
 * build and run a fresh query each call (apply `.range(from, to)` to it)
 * since a Supabase query builder can't be reused across multiple
 * requests. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const starts = Array.from({ length: WAVE_SIZE }, (_, i) => from + i * PAGE_SIZE);
    const pages = await Promise.all(starts.map((start) => fetchPage(start, start + PAGE_SIZE - 1)));

    let reachedEnd = false;
    for (const { data, error } of pages) {
      if (error) throw error;
      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }
    if (reachedEnd) break;
    from += WAVE_SIZE * PAGE_SIZE;
  }
  return all;
}
