import Papa from "papaparse";

/**
 * MillionVerifier API client -- replaces ZeroBounce (src/lib/zerobounce.ts)
 * as the actual verification provider. Exports the exact same interface
 * (function names, SimplifiedStatus values) so src/lib/verification.ts only
 * needed a single import-path change to switch providers.
 *
 * Endpoints and field names confirmed against MillionVerifier's real-time
 * API v3 (api.millionverifier.com) and Bulk API v2 (bulkapi.millionverifier.com)
 * docs/reference client. ONE thing that could NOT be independently confirmed
 * (sandbox network egress blocked direct access to MillionVerifier's docs
 * site): the exact column header names in the downloaded bulk CSV report.
 * getBulkFileResult() below tries several plausible header names (matching
 * the real-time API's own field names) -- verify against a real downloaded
 * report once you have an account, and adjust the candidate lists in
 * parseBulkRow() if the actual headers differ.
 */

export type SimplifiedStatus = "deliverable" | "risky" | "undeliverable";

export function mapMillionVerifierQuality(quality: string): SimplifiedStatus {
  const q = quality.toLowerCase();
  if (q === "good") return "deliverable";
  if (q === "bad") return "undeliverable";
  // "risky", "unknown", or anything unrecognized -- treated as risky rather
  // than silently trusting an unmapped response as deliverable.
  return "risky";
}

function apiKey(): string {
  const key = process.env.MILLIONVERIFIER_API_KEY;
  if (!key) {
    throw new Error("MILLIONVERIFIER_API_KEY is not set");
  }
  return key;
}

export interface SingleValidateResult {
  email: string;
  status: SimplifiedStatus;
  subStatus: string | null;
}

export async function validateSingle(email: string): Promise<SingleValidateResult> {
  const url = new URL("https://api.millionverifier.com/api/v3/");
  url.searchParams.set("api", apiKey());
  url.searchParams.set("email", email);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`MillionVerifier validate failed for ${email}: ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`MillionVerifier validate error for ${email}: ${data.error}`);
  }
  return {
    email,
    status: mapMillionVerifierQuality(data.quality || ""),
    subStatus: data.result || null,
  };
}

/**
 * Validates a batch of emails against MillionVerifier's real-time endpoint
 * with bounded concurrency.
 */
export async function validateBatch(
  emails: string[],
  concurrency = 5,
): Promise<SingleValidateResult[]> {
  const results: SingleValidateResult[] = new Array(emails.length);
  let next = 0;

  async function worker() {
    while (next < emails.length) {
      const i = next++;
      results[i] = await validateSingle(emails[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, emails.length) }, worker),
  );

  return results;
}

export interface BulkSubmitResult {
  fileId: string;
}

export async function submitBulkFile(emails: string[]): Promise<BulkSubmitResult> {
  const csv = Papa.unparse({
    fields: ["email"],
    data: emails.map((email) => [email]),
  });
  const blob = new Blob([csv], { type: "text/csv" });

  const form = new FormData();
  form.set("key", apiKey());
  form.set("file_contents", blob, "contacts.csv");

  const res = await fetch("https://bulkapi.millionverifier.com/bulkapi/v2/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`MillionVerifier bulk submit failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`MillionVerifier bulk submit error: ${data.error}`);
  }
  if (!data.file_id) {
    throw new Error(
      `MillionVerifier bulk submit did not return a file_id: ${JSON.stringify(data)}`,
    );
  }

  return { fileId: String(data.file_id) };
}

export type BulkFileStatus = "Processing" | "Complete" | "Failed" | "Unknown";

export async function getBulkFileStatus(
  fileId: string,
): Promise<{ status: BulkFileStatus; errorReason?: string }> {
  const url = new URL("https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo");
  url.searchParams.set("key", apiKey());
  url.searchParams.set("file_id", fileId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`MillionVerifier fileinfo failed: ${res.status}`);
  }
  const data = await res.json();

  const status = (data.status as string | undefined)?.toLowerCase();
  if (status === "in_progress") return { status: "Processing" };
  if (status === "finished") return { status: "Complete" };
  if (status === "canceled") return { status: "Failed", errorReason: "Verification was canceled" };
  return { status: "Unknown" };
}

function firstDefined(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return undefined;
}

export async function getBulkFileResult(fileId: string): Promise<SingleValidateResult[]> {
  const url = new URL("https://bulkapi.millionverifier.com/bulkapi/v2/download");
  url.searchParams.set("key", apiKey());
  url.searchParams.set("file_id", fileId);
  url.searchParams.set("filter", "all");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`MillionVerifier download failed: ${res.status}`);
  }
  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .map((row) => ({
      email: firstDefined(row, ["email", "Email", "EMAIL"]),
      quality: firstDefined(row, ["quality", "Quality"]),
      result: firstDefined(row, ["result", "Result"]),
    }))
    .filter((row): row is { email: string; quality: string | undefined; result: string | undefined } =>
      Boolean(row.email),
    )
    .map((row) => ({
      email: row.email,
      status: mapMillionVerifierQuality(row.quality || ""),
      subStatus: row.result || null,
    }));
}
