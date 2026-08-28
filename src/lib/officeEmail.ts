/**
 * Domains of free/personal email providers, blocked at signup and when
 * changing the account email -- this app requires a work/office email
 * address. Not exhaustive (new free providers appear over time), but covers
 * the large majority of personal signups we'd otherwise see.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "rediffmail.com",
  "inbox.com",
  "zoho.com",
]);

export function isPersonalEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return true;
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}
