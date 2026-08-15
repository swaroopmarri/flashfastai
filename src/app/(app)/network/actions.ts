"use server";

import { createClient } from "@/utils/supabase/server";
import { isMissingSchemaError } from "@/lib/schemaGuard";

export interface NetworkContactRow {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  verifiedAt: string | null;
  listNames: string[];
  listCount: number;
}

export interface SearchNetworkContactsResult {
  rows: NetworkContactRow[];
  totalCount: number;
}

interface RawSearchRow {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  verified_at: string | null;
  list_names: string[] | null;
  list_count: number | string | null;
  total_count: number | string | null;
}

/**
 * Backs every paginated contact table in My Network -- one company's
 * expandable contact list, the global search/filter results, and the
 * duplicates-review view -- all through the same server-side query
 * (search_network_contacts, migration 0008), so the browser only ever
 * receives the current page, never the whole dataset.
 */
export async function searchNetworkContactsAction(params: {
  domain?: string;
  search?: string;
  status?: string;
  duplicatesOnly?: boolean;
  page: number;
  pageSize: number;
}): Promise<SearchNetworkContactsResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], totalCount: 0 };

  const { data, error } = await supabase.rpc("search_network_contacts", {
    p_domain: params.domain ?? null,
    p_search: params.search?.trim() || null,
    p_status: params.status || null,
    p_duplicates_only: params.duplicatesOnly ?? false,
    p_limit: params.pageSize,
    p_offset: (params.page - 1) * params.pageSize,
  });
  if (error) {
    // search_network_contacts is added by migration 0008 -- if it hasn't
    // been run yet, degrade to an empty result (the table already renders
    // "No contacts match your filters" for that) instead of throwing.
    if (isMissingSchemaError(error)) return { rows: [], totalCount: 0 };
    throw error;
  }

  const rawRows = (data ?? []) as RawSearchRow[];
  const rows: NetworkContactRow[] = rawRows.map((r) => ({
    email: r.email,
    name: r.name,
    company: r.company,
    status: r.status,
    verifiedAt: r.verified_at,
    listNames: r.list_names ?? [],
    listCount: Number(r.list_count ?? 0),
  }));
  const totalCount = rawRows[0]?.total_count ? Number(rawRows[0].total_count) : 0;

  return { rows, totalCount };
}
