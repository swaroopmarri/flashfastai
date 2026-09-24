// Escapes ILIKE's own wildcard characters in user-typed search text so a
// literal "%" or "_" in what someone searches for is treated as a literal
// character instead of a pattern wildcard.
export function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, (m) => `\\${m}`);
}
