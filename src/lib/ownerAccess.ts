/**
 * Whether the given email belongs to the platform owner -- the one person
 * who should see cross-organization data (every customer's usage, not just
 * their own org's). Not a database role: a single allowlist check against
 * OWNER_EMAIL, since there's exactly one owner today and this avoids a
 * schema change or an RLS-bypassing role concept for what is, in practice,
 * one person.
 */
export function isPlatformOwner(email: string | null | undefined): boolean {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail || !email) return false;
  return email.toLowerCase() === ownerEmail.toLowerCase();
}
