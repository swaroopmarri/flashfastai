import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedContactRow } from "@/app/contacts/actions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_HEADER_EXACT = ["email", "e-mail", "email address", "mail", "mail id", "mailid"];
const EMAIL_HEADER_SUBSTRINGS = ["email", "e-mail", "mail"];

function findColumn(
  headers: string[],
  exactCandidates: string[],
  substringCandidates: string[],
): string | null {
  const lowered = headers.map((h) => h.trim().toLowerCase());

  for (const candidate of exactCandidates) {
    const idx = lowered.findIndex((h) => h === candidate);
    if (idx !== -1) return headers[idx];
  }
  for (const candidate of substringCandidates) {
    const idx = lowered.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/** Falls back to scanning cell values when no header looks like an email column. */
function findEmailColumnByContent(
  headers: string[],
  records: Record<string, unknown>[],
): string | null {
  let bestHeader: string | null = null;
  let bestScore = 0;

  for (const header of headers) {
    let matches = 0;
    let nonEmpty = 0;
    for (const record of records) {
      const value = String(record[header] ?? "").trim();
      if (!value) continue;
      nonEmpty++;
      if (EMAIL_REGEX.test(value)) matches++;
    }
    // Require most non-empty values in the column to look like emails, not
    // just one coincidental match, so we don't misidentify an unrelated
    // free-text column.
    if (matches > 0 && nonEmpty > 0 && matches / nonEmpty >= 0.5 && matches > bestScore) {
      bestScore = matches;
      bestHeader = header;
    }
  }

  return bestHeader;
}

function rowsFromRecords(records: Record<string, unknown>[]): {
  rows: ParsedContactRow[];
  skipped: number;
} {
  if (records.length === 0) return { rows: [], skipped: 0 };

  const headers = Object.keys(records[0]);
  const emailCol =
    findColumn(headers, EMAIL_HEADER_EXACT, EMAIL_HEADER_SUBSTRINGS) ||
    findEmailColumnByContent(headers, records);
  if (!emailCol) {
    throw new Error(
      "Couldn't find a column with email addresses in it — check the file has a column labeled \"email\" (or similar) or containing actual email addresses.",
    );
  }
  const nameCol = findColumn(headers, ["name"], ["name"]);
  const companyCol = findColumn(
    headers,
    ["company", "organization", "organisation"],
    ["company", "organization", "organisation"],
  );

  const rows: ParsedContactRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const rawEmail = String(record[emailCol] ?? "").trim();
    if (!EMAIL_REGEX.test(rawEmail)) {
      if (rawEmail) skipped++;
      continue;
    }
    rows.push({
      email: rawEmail,
      name: nameCol ? String(record[nameCol] ?? "").trim() || undefined : undefined,
      company: companyCol
        ? String(record[companyCol] ?? "").trim() || undefined
        : undefined,
    });
  }

  return { rows, skipped };
}

export async function parseContactsFile(
  file: File,
): Promise<{ rows: ParsedContactRow[]; skipped: number }> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors[0].message);
    }
    return rowsFromRecords(parsed.data);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The spreadsheet has no sheets.");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rowsFromRecords(records);
}
