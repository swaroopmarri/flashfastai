This is a [Next.js](https://nextjs.org) 14 (App Router) project with Supabase email/password authentication, contact list management with ZeroBounce email verification, and a minimal campaign builder.

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

   The two `NEXT_PUBLIC_` values are safe to expose in the browser — they're scoped by Supabase Row Level Security, not secrets. `ZEROBOUNCE_API_KEY` is different: it must **never** be prefixed with `NEXT_PUBLIC_` and is only read server-side (Server Actions / Route Handlers), never bundled to the client.

   In **Vercel**, add all three under Project → Settings → Environment Variables (check Production, Preview, and Development), then redeploy — env var changes don't apply to already-running deployments.

4. Run the database migration. Open the Supabase dashboard → **SQL Editor → New query**, paste the contents of `supabase/migrations/0001_contacts_and_campaigns.sql`, and run it. This creates the `contact_lists`, `contacts`, `verification_jobs`, and `campaigns` tables with Row Level Security so each user only sees their own data.

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
- `src/app/api/verification-jobs/[jobId]` — polling endpoint the browser calls while a bulk ZeroBounce verification job runs in the background
- `src/lib/zerobounce.ts` — ZeroBounce API client (single-email `validate` and the bulk `sendfile` / `filestatus` / `getfile` flow) and status mapping
- `src/lib/verification.ts` — verification business logic shared by the "start verification" action and the poll route
- `src/lib/parseContactsFile.ts` — client-side CSV/Excel parsing (Papa Parse / SheetJS), detects email/name/company columns by header name
- `src/utils/supabase` — Supabase client helpers for the browser, Server Components/Actions, and middleware
- `src/middleware.ts` — refreshes the auth session on every request and guards `/dashboard`
- `supabase/migrations/0001_contacts_and_campaigns.sql` — schema + RLS policies for contacts, contact lists, verification jobs, and campaigns

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
