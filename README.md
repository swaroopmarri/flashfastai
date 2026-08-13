This is a [Next.js](https://nextjs.org) 14 (App Router) project with Supabase email/password authentication, multi-tenant organizations with per-member quotas, contact list management with ZeroBounce email verification, and a campaign builder that composes and sends email through Amazon SES.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project at [supabase.com](https://supabase.com) (or use an existing one).

3. Copy `.env.local.example` to `.env.local` and fill in your credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API (or "API") → **Project URL** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → API Keys → **anon / public** key |
   | `ZEROBOUNCE_API_KEY` | [ZeroBounce dashboard → API Settings](https://www.zerobounce.net/members/apikeys/) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same Supabase API page → **service_role** secret key |
   | `CRON_SECRET` | Any long random string you generate (e.g. `openssl rand -hex 32`) |
   | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | An IAM user scoped to SES — see **Setting up Amazon SES** below |
   | `AWS_REGION` | The AWS region your SES identity is verified in, e.g. `us-east-1` |
   | `SES_FROM_ADDRESS` | The verified sender address campaigns send from, e.g. `campaigns@flashfastai.com` |

   The two `NEXT_PUBLIC_` values are safe to expose in the browser — they're scoped by Supabase Row Level Security, not secrets. The rest are server-only and must never be prefixed with `NEXT_PUBLIC_`:
   - `ZEROBOUNCE_API_KEY` is only read in Server Actions / Route Handlers.
   - `SUPABASE_SERVICE_ROLE_KEY` is **extremely sensitive** — it bypasses every RLS policy in the database. It's used in exactly one place (`src/utils/supabase/admin.ts`), imported only by the cron quota-reset route. Do not reuse it anywhere else.
   - `CRON_SECRET` protects `/api/cron/reset-quotas` from being invoked by anyone else. Vercel automatically sends it as a Bearer token when it triggers the cron job, once the same value is set in your Vercel project.
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are only read in `src/lib/ses.ts`, called from Server Actions and the send-job poll route — never bundled to the client.

   In **Vercel**, add all eight under Project → Settings → Environment Variables (check Production, Preview, and Development), then redeploy — env var changes don't apply to already-running deployments.

4. Run the database migrations, **in order**. Open the Supabase dashboard → **SQL Editor → New query** for each:
   - `supabase/migrations/0001_contacts_and_campaigns.sql` — creates `contact_lists`, `contacts`, `verification_jobs`, `campaigns`.
   - `supabase/migrations/0002_organizations.sql` — creates `organizations`, `memberships`, `invites`, quota-enforcement functions, and backfills a personal organization for any user who already had contact lists before this migration.
   - `supabase/migrations/0003_fix_membership_backfill.sql` — a corrected re-run of that backfill (0002's version missed accounts that didn't have a contact list yet at the time it ran); safe to run even if you already ran 0002 successfully.
   - `supabase/migrations/0004_campaign_sending.sql` — adds campaign content fields, `send_jobs`, `campaign_recipients`, `unsubscribes`, and the public unsubscribe function.
   - `supabase/migrations/0005_contact_list_summaries.sql` — adds `get_contact_list_status_counts()`, a grouped-aggregate function backing the Contacts overview cards.

## Setting up Amazon SES

Campaign sending won't work until this is done:

1. **Verify a sender identity.** In the SES console (pick the region you'll set as `AWS_REGION`) → **Verified identities → Create identity**. Verifying the whole **domain** (not just one address) is recommended — SES gives you a set of DNS records to add:
   - **DKIM**: 3 CNAME records (Easy DKIM) — add these at your DNS provider so outgoing mail is signed; this is what most inbox providers check before trusting your mail.
   - Domain ownership is confirmed via a TXT or CNAME record SES also provides.
   - Verification usually completes within minutes to a few hours once DNS propagates.
   - Alternative for quick testing: verify a single **email address** identity instead of a domain — faster, but only that exact address can send, and (in sandbox) only to other verified addresses.
2. **Set `SES_FROM_ADDRESS`** to an address at that verified domain (e.g. `campaigns@flashfastai.com`) — no separate per-address verification needed once the domain itself is verified.
3. **Sandbox mode**: every new SES account starts in the sandbox — you can only send **to** addresses/domains that are also verified, at a low rate (~1 email/sec, ~200/day). To send to arbitrary recipients, go to the SES console → **Account dashboard → Request production access** (a short form; usually approved within 24 hours). Until then, add your own test addresses as verified identities to test end-to-end.
4. **Create an IAM user** with a policy granting `ses:SendEmail` (scope the resource to your verified identity's ARN if you want to be strict), and generate an access key pair for it → that's your `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

Sends to unverified addresses while still in sandbox mode fail per-recipient with a clear SES error message (captured and shown in the campaign's results, not a crash) — see **How campaign sending works** below.

5. By default, Supabase requires users to confirm their email before they can log in. For local testing you can either:
   - Disable it: **Authentication → Sign In / Providers → Email → turn off "Confirm email"**, or
   - Keep it on and set **Site URL** (and add to **Redirect URLs**) under **Authentication → URL Configuration** to your app's actual URL (e.g. `http://localhost:3000` locally, your Vercel URL in production) with `/auth/callback` appended for the redirect URL entry — confirmation links redirect there to complete sign-in.

6. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Structure

- `src/app/login` — email/password login + signup form (Server Actions in `actions.ts`)
- `src/app/dashboard` — protected page; redirects to `/login` if not authenticated, has a logout button
- `src/app/auth/callback` — exchanges Supabase's email-confirmation `code` for a session
- `src/app/contacts` — contact list overview, CSV/Excel upload & merge (`UploadForm.tsx`), per-list detail page with a "Verify Contacts" button (`[listId]/VerifyPanel.tsx`)
- `src/app/campaigns` — campaign builder: `new` creates a draft campaign against a contact list, `[id]/audience` filters to deliverable-only or includes risky, `[id]/compose` writes subject/body + Reply-To and sends
- `src/app/team` — admin-only Team page: invite members, view/edit their quotas, see org-wide usage totals
- `src/app/invite/[token]` — public invite-acceptance page; sets a password and joins the inviting org
- `src/app/unsubscribe/[token]` — public, unauthenticated page a recipient lands on from the unsubscribe link in a campaign email
- `src/app/api/verification-jobs/[jobId]` — polling endpoint the browser calls while a bulk ZeroBounce verification job runs in the background
- `src/app/api/send-jobs/[jobId]` — polling + processing endpoint for campaign sends; each poll sends one batch of pending recipients via SES
- `src/app/api/cron/reset-quotas` — called by Vercel Cron (see `vercel.json`) to reset monthly usage; protected by `CRON_SECRET`
- `src/lib/zerobounce.ts` — ZeroBounce API client (single-email `validate` and the bulk `sendfile` / `filestatus` / `getfile` flow) and status mapping
- `src/lib/verification.ts` — verification business logic shared by the "start verification" action and the poll route; checks/consumes quota before calling ZeroBounce
- `src/lib/ses.ts` — thin Amazon SES client wrapper (`sendCampaignEmail`)
- `src/lib/campaignSend.ts` — campaign-send business logic: builds the recipient list (audience filter minus unsubscribes), checks/consumes send quota, and processes send jobs in batches
- `src/lib/parseContactsFile.ts` — client-side CSV/Excel parsing (Papa Parse / SheetJS), detects email/name/company columns by header name
- `src/lib/organizations.ts` — membership lookups and the post-signup "create org or accept invite" logic
- `src/utils/supabase` — Supabase client helpers: browser, Server Components/Actions (RLS-respecting), middleware, and `admin.ts` (service-role, cron-only)
- `src/middleware.ts` — refreshes the auth session on every request and guards `/dashboard`
- `supabase/migrations/0001_contacts_and_campaigns.sql` — schema + RLS policies for contacts, contact lists, verification jobs, and campaigns
- `supabase/migrations/0002_organizations.sql` — organizations, memberships, invites, and the quota-enforcement/reset functions
- `supabase/migrations/0003_fix_membership_backfill.sql` — corrected backfill for accounts 0002 missed
- `supabase/migrations/0004_campaign_sending.sql` — campaign content fields, send jobs, per-recipient tracking, unsubscribe suppression
- `supabase/migrations/0005_contact_list_summaries.sql` — `get_contact_list_status_counts()`, a single grouped-aggregate query backing the Contacts overview cards
- `src/app/api/contacts/[listId]/export` — downloads all contacts in a list as CSV (email, name, company, status, zerobounce_sub_status, verified_at)

## Organizations, invites, and quotas

- Signing up always creates a **new organization** with you as its admin (enter an organization name on the signup form). There's no self-serve "join with a code" option — joining only happens via an admin-sent invite link.
- On the **Team** page (admin-only, linked from the dashboard), an admin can invite members (generates a shareable `/invite/[token]` link — no email is sent automatically), edit each member's `validation_quota`/`send_quota` (capped by the organization's total plan quota), and see org-wide usage.
- Every user belongs to **exactly one organization**.
- Before running verification or sending a campaign, `try_consume_quota()` (a Postgres function) atomically checks both the member's own remaining quota and the organization's aggregate quota, and blocks with a clear message if either is exceeded. Takes a `'validation'` or `'send'` kind.
- Contact lists and campaigns are still private per-user even within an organization — an admin sees teammates' usage numbers, not their contact data.
- Monthly usage resets via `/api/cron/reset-quotas`, scheduled daily in `vercel.json` (only memberships whose `quota_reset_at` has actually passed get reset, so daily granularity is fine for a monthly cycle).

## How contact verification works

`/contacts` shows one card per list (name, created date, total count, a status-count badge row, and a headline "X% deliverable") rather than every contact — status counts come from a single grouped-aggregate query (`get_contact_list_status_counts()`), not by pulling every row to the client, so it stays fast for large lists. Each card has **Open list** (the detail page below, with the full per-contact table, grouping, and Verify Contacts) and **Download CSV** (exports every contact in that list with full detail: email, name, company, status, zerobounce_sub_status, verified_at).

1. On the contact list detail page, contacts start out `pending_verification` after upload.
2. Clicking **Verify Contacts** calls ZeroBounce:
   - **≤ 50 pending contacts**: calls ZeroBounce's single-email `validate` endpoint concurrently (bounded concurrency) and updates statuses immediately.
   - **> 50 pending contacts**: submits the list to ZeroBounce's bulk endpoint, which processes asynchronously. A `verification_jobs` row tracks progress; the browser polls `/api/verification-jobs/[jobId]` every few seconds until ZeroBounce reports the file complete, then downloads and applies the results. You can navigate away and come back — the job keeps running server-side and the page resumes polling on reload.
3. ZeroBounce's status is mapped to three simplified statuses: `valid` → `deliverable`, `invalid` → `undeliverable`, everything else (`catch-all`, `unknown`, `spamtrap`, `abuse`, `do_not_mail`) → `risky`.
4. In a campaign's Audience step, only `deliverable` contacts are targeted by default; there's a checkbox to also include `risky` contacts.

## How campaign sending works

1. **Compose** (`/campaigns/[id]/compose`): plain-text subject + body with a live preview, and an optional Reply-To override (defaults to the sending user's own account email). The body is auto-converted to a simple HTML version (paragraphs from blank lines) alongside the plain-text version — no rich text editor, kept intentionally simple.
2. **Audience at send time**: the recipient list is recomputed fresh from the Audience step's filter (`deliverable`, plus `risky` if checked) minus anyone in that user's `unsubscribes` table — so a contact who unsubscribed after being added to a list is still excluded even though their `contacts.status` elsewhere still says `deliverable`.
3. **Quota**: before sending, `try_consume_quota('send', recipientCount)` runs the same atomic member+org check as verification. Blocked with a clear message if either limit is hit, or if the membership isn't active yet.
4. **Sending**: a `send_jobs` row tracks the job; a `campaign_recipients` row is created per recipient with its own unique unsubscribe token. The browser polls `/api/send-jobs/[jobId]`, and each poll sends one small batch (10 recipients) via SES — this keeps every request short regardless of list size and avoids serverless timeouts, the same pattern bulk ZeroBounce verification already uses. You can navigate away and come back; the job resumes.
5. **Per-recipient failures** (e.g. an unverified address while SES is in sandbox mode) are caught individually — one failure never aborts the batch — and stored with SES's actual error message, shown in a table under the send summary once the job completes.
6. **Unsubscribe**: every email includes an unsubscribe link unique to that send. Clicking it (no login required) inserts into `unsubscribes` for that sender, marks every matching contact across all of that sender's lists as `unsubscribed`, and is checked at the start of every future send — not optional, not per-list.
7. Once every recipient has been processed, the campaign's status flips to `sent` (or stays viewable mid-send as `sending`).

## Known limitation

The `xlsx` (SheetJS) package on the npm registry has [known unpatched CVEs](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (SheetJS only publishes fixes to their own CDN, not npm). Since parsing happens client-side against files the user uploads themselves, the risk is limited to a user crashing their own browser tab on a malicious file — not a server-side or cross-user risk. If you want the patched build, install SheetJS's CDN tarball per [their docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs) instead of the npm package.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Auth with Next.js (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [ZeroBounce API docs](https://www.zerobounce.net/docs/)
