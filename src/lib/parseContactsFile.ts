import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedContactRow } from "@/app/contacts/actions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findColumn(headers: string[], candidates: string[]): string | null {
  const lowered = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lowered.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function rowsFromRecords(records: Record<string, unknown>[]): {
  rows: ParsedContactRow[];
  skipped: number;
} {
  if (records.length === 0) return { rows: [], skipped: 0 };

  const headers = Object.keys(records[0]);
  const emailCol = findColumn(headers, ["email"]);
  if (!emailCol) {
    throw new Error("No column containing \"email\" was found in the file.");
  }
  const nameCol = findColumn(headers, ["name"]);
  const companyCol = findColumn(headers, ["company", "organization", "organisation"]);

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
