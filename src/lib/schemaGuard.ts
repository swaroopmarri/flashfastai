/**
 * Postgres error codes for "this table/column/function doesn't exist yet"
 * -- i.e. a migration that adds it hasn't been run against this database.
 * Used to degrade a page gracefully (show a default / empty state) instead
 * of crashing when code and schema are temporarily out of sync.
 */
export function isMissingSchemaError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "42883" || error?.code === "42P01";
}
