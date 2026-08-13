/**
 * Derives a readable company display name from an email domain, e.g.
 * "swiftit-solutions.com" -> "Swiftit Solutions". Strips the last dot
 * segment as the TLD (2+ letters covers .com/.in/.org/.co/.net/.io/etc.
 * without hardcoding a TLD list), then splits remaining hyphens/dots
 * (subdomains included) into title-cased words.
 */
export function companyDisplayName(domain: string): string {
  const withoutTld = domain.replace(/\.[a-z]{2,}$/i, "");
  const words = withoutTld.split(/[-.]+/).filter(Boolean);
  if (words.length === 0) return domain;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
