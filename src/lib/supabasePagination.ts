// Supabase/PostgREST caps any unranged select (table or RPC) at a
// project-level default (commonly 1000 rows) -- past that, a query
// silently returns a truncated result instead of erroring, so a large
// contact list, company, or account can end up partially sent, partially
// verified, or partially exported with no indication anything was cut off.
// Every query over a table that can grow past that cap needs to page
// through it explicitly instead of relying on the project's dashboard
// setting.
const PAGE_SIZE = 1000;

/** Calls `fetchPage(from, to)` repeatedly, advancing the range each time,
 * until a page comes back shorter than a full page (the real end of the
 * result set) -- collecting every row regardless of how many pages that
 * takes. `fetchPage` should build and run a fresh query each call (apply
 * `.range(from, to)` to it) since a Supabase query builder can't be reused
 * across multiple requests. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
