import Papa from "papaparse";

export type SimplifiedStatus = "deliverable" | "risky" | "undeliverable";

const RISKY_ZB_STATUSES = new Set([
  "catch-all",
  "unknown",
  "spamtrap",
  "abuse",
  "do_not_mail",
]);

export function mapZeroBounceStatus(zbStatus: string): SimplifiedStatus {
  const status = zbStatus.toLowerCase();
  if (status === "valid") return "deliverable";
  if (status === "invalid") return "undeliverable";
  if (RISKY_ZB_STATUSES.has(status)) return "risky";
  // Any unrecognized status is treated as risky rather than silently
  // trusting an unmapped ZeroBounce response as deliverable.
  return "risky";
}

function apiKey(): string {
  const key = process.env.ZEROBOUNCE_API_KEY;
  if (!key) {
    throw new Error("ZEROBOUNCE_API_KEY is not set");
  }
  return key;
}

export interface SingleValidateResult {
  email: string;
  status: SimplifiedStatus;
  subStatus: string | null;
}

export async function validateSingle(email: string): Promise<SingleValidateResult> {
  const url = new URL("https://api.zerobounce.net/v2/validate");
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("email", email);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`ZeroBounce validate failed for ${email}: ${res.status}`);
  }
  const data = await res.json();
  return {
    email,
    status: mapZeroBounceStatus(data.status),
    subStatus: data.sub_status || null,
  };
}

/**
 * Validates a batch of emails against ZeroBounce's single-email endpoint
 * with bounded concurrency (ZeroBounce rate-limits aggressive parallel calls).
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

export async function submitBulkFile(
  emails: string[],
): Promise<BulkSubmitResult> {
  const csv = Papa.unparse({
    fields: ["email"],
    data: emails.map((email) => [email]),
  });
  const blob = new Blob([csv], { type: "text/csv" });

  const form = new FormData();
  form.set("api_key", apiKey());
  form.set("file", blob, "contacts.csv");
  form.set("email_address_column", "1");
  form.set("has_header_row", "true");
  form.set("remove_duplicate", "true");

  const res = await fetch("https://bulkapi.zerobounce.net/v2/sendfile", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ZeroBounce bulk submit failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.file_id) {
    throw new Error(
      `ZeroBounce bulk submit did not return a file_id: ${JSON.stringify(data)}`,
    );
  }

  return { fileId: data.file_id as string };
}

export type BulkFileStatus = "Processing" | "Complete" | "Failed" | "Unknown";

export async function getBulkFileStatus(
  fileId: string,
): Promise<{ status: BulkFileStatus; errorReason?: string }> {
  const url = new URL("https://bulkapi.zerobounce.net/v2/filestatus");
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("file_id", fileId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`ZeroBounce filestatus failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    status: (data.file_status as BulkFileStatus) || "Unknown",
    errorReason: data.error_reason,
  };
}

export async function getBulkFileResult(
  fileId: string,
): Promise<SingleValidateResult[]> {
  const url = new URL("https://bulkapi.zerobounce.net/v2/getfile");
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("file_id", fileId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`ZeroBounce getfile failed: ${res.status}`);
  }
  const csvText = await res.text();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row["Email Address"])
    .map((row) => ({
      email: row["Email Address"],
      status: mapZeroBounceStatus(row["ZB Status"] || row["Status"] || ""),
      subStatus: row["ZB Sub Status"] || row["Sub Status"] || null,
    }));
}
