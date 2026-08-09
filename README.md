This is a [Next.js](https://nextjs.org) 14 (App Router) project with Supabase email/password authentication, multi-tenant organizations with per-member quotas, contact list management with ZeroBounce email verification, and a minimal campaign builder.

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

   The two `NEXT_PUBLIC_` values are safe to expose in the browser — they're scoped by Supabase Row Level Security, not secrets. The rest are server-only and must never be prefixed with `NEXT_PUBLIC_`:
   - `ZEROBOUNCE_API_KEY` is only read in Server Actions / Route Handlers.
   - `SUPABASE_SERVICE_ROLE_KEY` is **extremely sensitive** — it bypasses every RLS policy in the database. It's used in exactly one place (`src/utils/supabase/admin.ts`), imported only by the cron quota-reset route. Do not reuse it anywhere else.
   - `CRON_SECRET` protects `/api/cron/reset-quotas` from being invoked by anyone else. Vercel automatically sends it as a Bearer token when it triggers the cron job, once the same value is set in your Vercel project.

   In **Vercel**, add all five under Project → Settings → Environment Variables (check Production, Preview, and Development), then redeploy — env var changes don't apply to already-running deployments.

4. Run the database migrations, in order. Open the Supabase dashboard → **SQL Editor → New query**:
   - Paste and run `supabase/migrations/0001_contacts_and_campaigns.sql` first — creates `contact_lists`, `contacts`, `verification_jobs`, `campaigns`.
   - Then paste and run `supabase/migrations/0002_organizations.sql` — creates `organizations`, `memberships`, `invites`, quota-enforcement functions, and backfills a personal organization for any user who already had contact lists before this migration.

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
- `src/app/campaigns` — minimal campaign builder; `new` creates a draft campaign against a contact list, `[id]/audience` is the Audience step (filter to deliverable-only or include risky)
- `src/app/team` — admin-only Team page: invite members, view/edit their quotas, see org-wide usage totals
- `src/app/invite/[token]` — public invite-acceptance page; sets a password and joins the inviting org
- `src/app/api/verification-jobs/[jobId]` — polling endpoint the browser calls while a bulk ZeroBounce verification job runs in the background
- `src/app/api/cron/reset-quotas` — called by Vercel Cron (see `vercel.json`) to reset monthly usage; protected by `CRON_SECRET`
- `src/lib/zerobounce.ts` — ZeroBounce API client (single-email `validate` and the bulk `sendfile` / `filestatus` / `getfile` flow) and status mapping
- `src/lib/verification.ts` — verification business logic shared by the "start verification" action and the poll route; checks/consumes quota before calling ZeroBounce
- `src/lib/parseContactsFile.ts` — client-side CSV/Excel parsing (Papa Parse / SheetJS), detects email/name/company columns by header name
- `src/lib/organizations.ts` — membership lookups and the post-signup "create org or accept invite" logic
- `src/utils/supabase` — Supabase client helpers: browser, Server Components/Actions (RLS-respecting), middleware, and `admin.ts` (service-role, cron-only)
- `src/middleware.ts` — refreshes the auth session on every request and guards `/dashboard`
- `supabase/migrations/0001_contacts_and_campaigns.sql` — schema + RLS policies for contacts, contact lists, verification jobs, and campaigns
- `supabase/migrations/0002_organizations.sql` — organizations, memberships, invites, and the quota-enforcement/reset functions

## Organizations, invites, and quotas

- Signing up always creates a **new organization** with you as its admin (enter an organization name on the signup form). There's no self-serve "join with a code" option — joining only happens via an admin-sent invite link.
- On the **Team** page (admin-only, linked from the dashboard), an admin can invite members (generates a shareable `/invite/[token]` link — no email is sent automatically), edit each member's `validation_quota`/`send_quota` (capped by the organization's total plan quota), and see org-wide usage.
- Every user belongs to **exactly one organization**.
- Before running verification, `try_consume_quota()` (a Postgres function) atomically checks both the member's own remaining quota and the organization's aggregate quota, and blocks with "You've used your monthly validation limit. Contact your admin to increase it." if either is exceeded. The same function supports a `'send'` kind for when campaign sending is built.
- Contact lists and campaigns are still private per-user even within an organization — an admin sees teammates' usage numbers, not their contact data.
- Monthly usage resets via `/api/cron/reset-quotas`, scheduled daily in `vercel.json` (only memberships whose `quota_reset_at` has actually passed get reset, so daily granularity is fine for a monthly cycle).

## How contact verification works

1. On the contact list page, contacts start out `pending_verification` after upload.
2. Clicking **Verify Contacts** calls ZeroBounce:
   - **≤ 50 pending contacts**: calls ZeroBounce's single-email `validate` endpoint concurrently (bounded concurrency) and updates statuses immediately.
   - **> 50 pending contacts**: submits the list to ZeroBounce's bulk endpoint, which processes asynchronously. A `verification_jobs` row tracks progress; the browser polls `/api/verification-jobs/[jobId]` every few seconds until ZeroBounce reports the file complete, then downloads and applies the results. You can navigate away and come back — the job keeps running server-side and the page resumes polling on reload.
3. ZeroBounce's status is mapped to three simplified statuses: `valid` → `deliverable`, `invalid` → `undeliverable`, everything else (`catch-all`, `unknown`, `spamtrap`, `abuse`, `do_not_mail`) → `risky`.
4. In a campaign's Audience step, only `deliverable` contacts are targeted by default; there's a checkbox to also include `risky` contacts.

Note: campaign **content and actual sending** are not implemented yet — the Audience step is the only part of the campaign builder built so far.

## Known limitation

The `xlsx` (SheetJS) package on the npm registry has [known unpatched CVEs](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (SheetJS only publishes fixes to their own CDN, not npm). Since parsing happens client-side against files the user uploads themselves, the risk is limited to a user crashing their own browser tab on a malicious file — not a server-side or cross-user risk. If you want the patched build, install SheetJS's CDN tarball per [their docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs) instead of the npm package.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Auth with Next.js (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [ZeroBounce API docs](https://www.zerobounce.net/docs/)
