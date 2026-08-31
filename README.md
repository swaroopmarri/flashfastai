This is a [Next.js](https://nextjs.org) 14 (App Router) project with Supabase email/password authentication, multi-tenant organizations with per-member quotas, contact list management with MillionVerifier email verification, and a campaign builder that composes and sends email through Amazon SES.

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
   | `MILLIONVERIFIER_API_KEY` | [MillionVerifier dashboard → API](https://app.millionverifier.com/api) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same Supabase API page → **service_role** secret key |
   | `CRON_SECRET` | Any long random string you generate (e.g. `openssl rand -hex 32`) |
   | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | An IAM user scoped to SES — see **Setting up Amazon SES** below |
   | `AWS_REGION` | The AWS region your SES identity is verified in, e.g. `us-east-1` |
   | `SES_FROM_ADDRESS` | The verified sender address campaigns send from, e.g. `campaigns@campaign-monster.com` |
   | `SES_NOTIFICATIONS_SECRET` | Any long random string you generate — optional, only needed for SES bounce/complaint feedback (see **Setting up SES bounce and complaint feedback**) |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard → Settings → API Keys — see **Setting up Razorpay billing** |
   | `RAZORPAY_WEBHOOK_SECRET` | The secret you set when creating the Razorpay webhook — see **Setting up Razorpay billing** |

   The two `NEXT_PUBLIC_` values are safe to expose in the browser — they're scoped by Supabase Row Level Security, not secrets. The rest are server-only and must never be prefixed with `NEXT_PUBLIC_`:
   - `MILLIONVERIFIER_API_KEY` is only read in Server Actions / Route Handlers.
   - `SUPABASE_SERVICE_ROLE_KEY` is **extremely sensitive** — it bypasses every RLS policy in the database. It's used in exactly one place (`src/utils/supabase/admin.ts`), imported only by the cron quota-reset route and the SES notifications webhook (both act outside any one user's session, so they can't go through the normal RLS-scoped client). Do not reuse it anywhere else.
   - `CRON_SECRET` protects `/api/cron/reset-quotas` from being invoked by anyone else. Vercel automatically sends it as a Bearer token when it triggers the cron job, once the same value is set in your Vercel project.
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are only read in `src/lib/ses.ts`, called from Server Actions and the send-job poll route — never bundled to the client.
   - `SES_NOTIFICATIONS_SECRET` protects `/api/ses/notifications` the same way `CRON_SECRET` protects the cron route — it's a query-string token (`?secret=...`) rather than a header, since that's what an SNS HTTPS subscription URL supports.
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are only read in `src/lib/razorpay.ts`, called from the billing Server Actions (`src/app/(app)/team/billingActions.ts`) — never bundled to the client.
   - `RAZORPAY_WEBHOOK_SECRET` protects `/api/razorpay/webhook` by verifying Razorpay's HMAC signature on every request (the `x-razorpay-signature` header) — unlike the SES/cron secrets, this isn't a shared-secret query param, it's a real cryptographic signature check.

   In **Vercel**, add all twelve under Project → Settings → Environment Variables (check Production, Preview, and Development), then redeploy — env var changes don't apply to already-running deployments.

4. Run the database migrations, **in order**. Open the Supabase dashboard → **SQL Editor → New query** for each:
   - `supabase/migrations/0001_contacts_and_campaigns.sql` — creates `contact_lists`, `contacts`, `verification_jobs`, `campaigns`.
   - `supabase/migrations/0002_organizations.sql` — creates `organizations`, `memberships`, `invites`, quota-enforcement functions, and backfills a personal organization for any user who already had contact lists before this migration.
   - `supabase/migrations/0003_fix_membership_backfill.sql` — a corrected re-run of that backfill (0002's version missed accounts that didn't have a contact list yet at the time it ran); safe to run even if you already ran 0002 successfully.
   - `supabase/migrations/0004_campaign_sending.sql` — adds campaign content fields, `send_jobs`, `campaign_recipients`, `unsubscribes`, and the public unsubscribe function.
   - `supabase/migrations/0005_contact_list_summaries.sql` — adds `get_contact_list_status_counts()`, a grouped-aggregate function backing the Contacts overview cards.
   - `supabase/migrations/0006_network.sql` — adds "My Network" (company/domain grouping across every list) and lets verification jobs and campaigns target a company domain instead of only one list.
   - `supabase/migrations/0007_suppression.sql` — adds a `reason` column to `unsubscribes` (unsubscribe-link click vs. SES spam complaint), a `resubscribe_log` audit table, and `resubscribe_contact()` for manual resubscribes.
   - `supabase/migrations/0011_profiles.sql` — adds `profiles` (first name, last name, years of experience), collected at signup and editable from `/account`.
   - `supabase/migrations/0012_drop_profile_company.sql` — drops `profiles.current_company`; the org's own name (`organizations.name`) is used instead, so it was a redundant duplicate field.
   - `supabase/migrations/0013_billing.sql` — adds `subscriptions` (one row per org: Razorpay subscription id, plan, term, currency, status, current billing cycle dates), written only by the Razorpay webhook (plus an initial placeholder row from `startSubscription()`) — see **Setting up Razorpay billing**.
   - `supabase/migrations/0014_subscription_currency.sql` — idempotent `currency` column add for a `subscriptions` table already created by an earlier version of 0013.sql (harmless no-op if you're running 0013.sql fresh, since it already includes `currency`).
   - `supabase/migrations/0015_terms_acceptance.sql` — adds `profiles.terms_accepted_at`, set when a user checks the Terms/Privacy acceptance box at signup.

## Setting up Amazon SES

Campaign sending won't work until this is done:

1. **Verify a sender identity.** In the SES console (pick the region you'll set as `AWS_REGION`) → **Verified identities → Create identity**. Verifying the whole **domain** (not just one address) is recommended — SES gives you a set of DNS records to add:
   - **DKIM**: 3 CNAME records (Easy DKIM) — add these at your DNS provider so outgoing mail is signed; this is what most inbox providers check before trusting your mail.
   - Domain ownership is confirmed via a TXT or CNAME record SES also provides.
   - Verification usually completes within minutes to a few hours once DNS propagates.
   - Alternative for quick testing: verify a single **email address** identity instead of a domain — faster, but only that exact address can send, and (in sandbox) only to other verified addresses.
2. **Set `SES_FROM_ADDRESS`** to an address at that verified domain (e.g. `campaigns@campaign-monster.com`) — no separate per-address verification needed once the domain itself is verified.
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

### Setting up SES bounce and complaint feedback (optional)

Everything else in this app works without this — sending, verification, unsubscribe links, and the Bounced/Undeliverable and Unsubscribed groups on the Suppression List page all work regardless. This step only wires up the third group, **Spam complaints**, plus real post-send bounce detection (as opposed to MillionVerifier's pre-send prediction). Skip it and that group just stays empty.

1. **Create an SNS topic** (any region — doesn't need to match `AWS_REGION`, though same-region is simplest): SNS console → **Topics → Create topic** (Standard type is fine).
2. **Subscribe your webhook to it**: on that topic → **Create subscription** → protocol **HTTPS** → endpoint `https://<your-app-domain>/api/ses/notifications?secret=<SES_NOTIFICATIONS_SECRET>` (the same value you set for that env var). SNS immediately POSTs a subscription-confirmation handshake to that URL, which the route handles automatically — no separate confirmation click needed, but check the subscription shows **Confirmed** in the SNS console after a few seconds.
3. **Point SES at that topic**: SES console → **Verified identities** → your domain/address → **Notifications** tab → set both **Bounce feedback** and **Complaint feedback** to the SNS topic you just created.
4. That's it — real bounces and complaints on future sends now flow into the Suppression List page automatically. Nothing needs to change on the MillionVerifier/verification side.

This endpoint is protected by the `secret` query param, not full SNS message-signature verification — sufficient to stop opportunistic abuse of a discovered URL, but not as strong as cryptographically verifying every request came from AWS. If you want that stronger guarantee, `src/app/api/ses/notifications/route.ts` is where to add it.

## Setting up Razorpay billing

Real self-service subscriptions (upgrade/downgrade/cancel on the Team page) won't work until this is done. Everything else in the app works fine without it — the four pricing tiers still show on the landing page either way.

1. **Create a Razorpay account** at [razorpay.com](https://razorpay.com) if you don't have one, and get it activated for live payments (test mode works for trying this out first).
2. **Get your API keys**: Dashboard → **Settings → API Keys → Generate Key** → set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. **Create 24 Plans** — each of the 4 tiers × 3 prepay terms (monthly, 6 months at 5% off, 12 months at 8% off) × 2 currencies (INR, USD) is its own Razorpay Plan, since each has a different billing frequency, currency, and amount per cycle. Either in the dashboard (**Subscriptions → Plans → Create Plan**) or via the API:
   - **Monthly** plans: `period: "monthly"`, `interval: 1`.
   - **6-month** plans: `period: "monthly"`, `interval: 6` (charges once every 6 months).
   - **12-month** plans: `period: "yearly"`, `interval: 1` (charges once a year).
   - **INR amounts are GST-inclusive** (18%) — Razorpay charges one fixed amount per cycle with no separate tax line item, so GST has to be baked into the Plan amount itself. `src/lib/pricingPlans.ts` stores the pre-tax price and computes this total via `withGst()`; use the GST-inclusive amount below when creating the Plan (in **paise**, ₹ × 100).
   - **USD amounts have no GST** (it's an Indian tax) and are priced independently of the INR tiers against the same USD-denominated provider costs — see the comment at the top of `pricingPlans.ts`.

     | Tier | INR Monthly (incl. GST) | INR 6mo (incl. GST) | INR 12mo (incl. GST) | USD Monthly | USD 6mo | USD 12mo |
     | --- | --- | --- | --- | --- | --- | --- |
     | Starter | ₹589 | ₹3,356 | ₹6,501 | $6.99 | $39.99 | $76.99 |
     | Growth | ₹1,179 | ₹6,719 | ₹13,014 | $13.99 | $79.99 | $154.99 |
     | Pro | ₹2,359 | ₹13,445 | ₹26,041 | $27.99 | $159.99 | $308.99 |
     | Scale | ₹5,899 | ₹33,623 | ₹65,123 | $69.99 | $398.99 | $772.99 |

   - Copy each resulting Plan ID (e.g. `plan_ABC123`) into the matching `razorpayPlanId` field inside that tier's `currencies[INR|USD].terms` array in `src/lib/pricingPlans.ts`, replacing the `REPLACE_WITH_..._RAZORPAY_PLAN_ID` placeholders (24 total). Subscriptions for a given plan+currency+term can't be created until its placeholder is replaced.
   - **Accepting USD requires Razorpay's international payments feature to be enabled on your account first** — this is a separate account-level approval (additional KYC, subject to RBI/FEMA rules for an India-based merchant), not just a code or dashboard-config change. Confirm that's active before relying on the USD Plans; until then, leave customers on INR.
4. **Create a webhook**: Dashboard → **Settings → Webhooks → Add New Webhook**:
   - **URL**: `https://<your-app-domain>/api/razorpay/webhook`
   - **Secret**: any value you choose — set it as `RAZORPAY_WEBHOOK_SECRET` too (must match exactly).
   - **Active events**: enable at least `subscription.activated`, `subscription.charged`, `subscription.updated`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`.
5. That's it — an admin can now subscribe/switch/cancel plans from the Team page's "Plan & billing" section.

**How quota provisioning actually works** (why this is safe against a spoofed or replayed "payment succeeded" client request): the webhook is the *only* place `organizations.plan_validation_quota`/`plan_send_quota` and `subscriptions.status`/`plan_id` ever get written after the initial subscribe. `startSubscription()` only creates a Razorpay subscription and a placeholder DB row (status `created`, no quota granted); `changePlan()`/`cancelSubscription()` only call the Razorpay API. None of them trust anything the browser reports back — every actual state change comes from `src/app/api/razorpay/webhook/route.ts` verifying Razorpay's own signed request first.

**Upgrade/downgrade**, once a subscription is active, calls Razorpay's `subscriptions.update()` with `schedule_change_at: "now"` — takes effect immediately (no proration logic beyond whatever Razorpay itself applies). There's no "pause and resume mid-cycle" refinement here; that's a reasonable future improvement if needed. Currency can't be changed on an existing subscription (a different currency means a different payment method/mandate) — the customer has to cancel and start a new subscription in the new currency.

**On payment failure**, the webhook freezes the org's quota to zero the moment Razorpay reports `subscription.halted` (its terminal "gave up retrying" state, as opposed to `pending`, which just means a retry is still in progress this cycle) — see `QUOTA_FREEZE_EVENTS` in the webhook route. This closes a real gap that existed before: without it, an org whose card stopped working could keep using its full quota indefinitely, unpaid, until someone noticed and cancelled manually. Quota resumes automatically, with no extra code, the moment a later `subscription.activated`/`charged` event reports a successful charge again.

**On cancellation**, the org's quota is left as-is rather than reset to some "free tier" — there isn't one defined anywhere in this app (every org's quota otherwise defaults to a flat 10,000/10,000 from migrations 0002/0003, which is actually more generous than any paid tier). If you want cancellation to actually reduce quota, that policy needs to be decided and added to the webhook handler's `subscription.cancelled` case.

## Structure

- `src/app/login` — email/password login + signup form (Server Actions in `actions.ts`); signup requires checking a Terms of Service/Privacy Policy acceptance box, recorded as `profiles.terms_accepted_at`
- `src/app/dashboard` — protected page; redirects to `/login` if not authenticated, has a logout button
- `src/app/auth/callback` — exchanges Supabase's email-confirmation `code` for a session
- `src/app/contacts` — contact list overview, CSV/Excel upload & merge (`UploadForm.tsx`), per-list detail page with a "Verify Contacts" button (`[listId]/VerifyPanel.tsx`)
- `src/app/campaigns` — campaign builder: `new` creates a draft campaign against a contact list, `[id]/audience` filters to deliverable-only or includes risky, `[id]/compose` writes subject/body + Reply-To and sends
- `src/app/team` — admin-only Team page: invite members, view/edit their quotas, see org-wide usage totals
- `src/app/(app)/account` — edit profile (first/last name, years of experience) and request an office email change; `src/lib/officeEmail.ts` blocks personal-provider domains (Gmail, Yahoo, Outlook.com, etc.) both here and at signup
- `src/app/invite/[token]` — public invite-acceptance page; sets a password and joins the inviting org
- `src/app/unsubscribe/[token]` — public, unauthenticated page a recipient lands on from the unsubscribe link in a campaign email
- `src/app/api/verification-jobs/[jobId]` — polling endpoint the browser calls while a bulk MillionVerifier verification job runs in the background
- `src/app/api/send-jobs/[jobId]` — polling + processing endpoint for campaign sends; each poll sends one batch of pending recipients via SES
- `src/app/api/cron/reset-quotas` — called by Vercel Cron (see `vercel.json`) to reset monthly usage; protected by `CRON_SECRET`
- `src/lib/millionverifier.ts` — MillionVerifier API client (single-email real-time endpoint and the bulk `upload` / `fileinfo` / `download` flow) and quality mapping; replaced the earlier ZeroBounce integration. Note: `contacts.zerobounce_sub_status` and `verification_jobs.zerobounce_file_id` keep their original column names (a rename is a separate, purely cosmetic migration) but now hold MillionVerifier's data.
- `src/lib/verification.ts` — verification business logic shared by the "start verification" action and the poll route; checks/consumes quota before calling MillionVerifier
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
- `supabase/migrations/0006_network.sql` — `get_network_domain_counts()` / `get_network_domain_contacts()` (deduplicated by email, across every list) and the schema changes letting verification/campaigns target a domain instead of one list
- `src/app/api/contacts/[listId]/export` — downloads all contacts in a list as CSV (email, name, company, status, zerobounce_sub_status, verified_at)
- `src/app/(app)/network` — My Network: one card per company (email domain) across all your lists; `[domain]` is the detail view with deduplicated contacts, per-contact list tags, a "Verify all unverified" button, and "Start campaign with this company"
- `src/app/(app)/_components/VerifyPanel.tsx` — shared verify-and-poll UI used by both the list detail page and a company's network page (takes a `target: {type:"list"|"company"}` prop)
- `src/app/(app)/suppression` — Suppression List page: spam complaints, unsubscribes, and bounced/undeliverable contacts (grouped by reason), each unsubscribe/complaint row has a "Resubscribe" button behind a confirmation step
- `src/app/(app)/_components/ResubscribeButton.tsx` — the confirm-then-resubscribe UI for one email
- `src/app/api/ses/notifications` — webhook SES's SNS topic posts bounce/complaint feedback to; protected by a `?secret=` query token (`SES_NOTIFICATIONS_SECRET`)
- `src/lib/sesFeedback.ts` — applies a complaint (adds to `unsubscribes`, reason `'complaint'`) or a permanent bounce (marks the contact `undeliverable`) once the webhook has matched an SES notification back to a specific recipient
- `src/lib/razorpay.ts` — thin Razorpay client wrapper (`getRazorpayClient`)
- `src/app/(app)/team/billingActions.ts` — `startSubscription`/`changePlan`/`cancelSubscription` Server Actions; call the Razorpay API but never write subscription status/quota directly (see **Setting up Razorpay billing**)
- `src/app/(app)/team/BillingSection.tsx` — the Team page's "Plan & billing" UI: current plan/status, Subscribe/Switch buttons per tier, Cancel subscription
- `src/app/api/razorpay/webhook` — verifies Razorpay's signed webhook request, then is the only place that writes `subscriptions.status`/`plan_id` and provisions `organizations.plan_validation_quota`/`plan_send_quota`

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
2. Clicking **Verify Contacts** calls MillionVerifier:
   - **≤ 50 pending contacts**: calls MillionVerifier's real-time single-email endpoint concurrently (bounded concurrency) and updates statuses immediately.
   - **> 50 pending contacts**: submits the list to MillionVerifier's bulk endpoint, which processes asynchronously. A `verification_jobs` row tracks progress; the browser polls `/api/verification-jobs/[jobId]` every few seconds until MillionVerifier reports the file finished, then downloads and applies the results. You can navigate away and come back — the job keeps running server-side and the page resumes polling on reload.
3. MillionVerifier's `quality` field is mapped to three simplified statuses: `good` → `deliverable`, `bad` → `undeliverable`, everything else (`risky`, `unknown`, or unrecognized) → `risky`.
4. In a campaign's Audience step, only `deliverable` contacts are targeted by default; there's a checkbox to also include `risky` contacts.

## How campaign sending works

1. **Compose** (`/campaigns/[id]/compose`): plain-text subject + body with a live preview, and an optional Reply-To override (defaults to the sending user's own account email). The body is auto-converted to a simple HTML version (paragraphs from blank lines) alongside the plain-text version — no rich text editor, kept intentionally simple.
2. **Audience at send time**: the recipient list is recomputed fresh from the Audience step's filter (`deliverable`, plus `risky` if checked) minus anyone in that user's `unsubscribes` table — so a contact who unsubscribed after being added to a list is still excluded even though their `contacts.status` elsewhere still says `deliverable`.
3. **Quota**: before sending, `try_consume_quota('send', recipientCount)` runs the same atomic member+org check as verification. Blocked with a clear message if either limit is hit, or if the membership isn't active yet.
4. **Sending**: a `send_jobs` row tracks the job; a `campaign_recipients` row is created per recipient with its own unique unsubscribe token. The browser polls `/api/send-jobs/[jobId]`, and each poll sends one small batch (10 recipients) via SES — this keeps every request short regardless of list size and avoids serverless timeouts, the same pattern bulk MillionVerifier verification already uses. You can navigate away and come back; the job resumes.
5. **Per-recipient failures** (e.g. an unverified address while SES is in sandbox mode) are caught individually — one failure never aborts the batch — and stored with SES's actual error message, shown in a table under the send summary once the job completes.
6. **Unsubscribe**: every email includes an unsubscribe link unique to that send. Clicking it (no login required) inserts into `unsubscribes` for that sender, marks every matching contact across all of that sender's lists as `unsubscribed`, and is checked at the start of every future send — not optional, not per-list.
7. Once every recipient has been processed, the campaign's status flips to `sent` (or stays viewable mid-send as `sending`).

## How My Network works

- Every contact across every list you own is grouped by email domain (`swiftit-solutions.com`, etc.), deduplicated by lowercased/trimmed email — the same email in three different lists counts once.
- When copies disagree (e.g. verified in one list, still pending in another, uploaded a second time with a different name), a "best" row is picked: a non-`pending_verification` status wins over pending, then the most recently verified/created copy — the overview cards and the company detail page always agree on this.
- Both **verification** and **campaigns** now support two audience scopes, not just one list: `verification_jobs` and `campaigns` can have either a `contact_list_id` (unchanged, single-list behavior) or a `company_domain` (spans every list). Same job/send machinery either way — "Verify all unverified" on a company page runs the identical single/bulk MillionVerifier flow as the per-list Verify Contacts button, just querying by email domain instead of one `contact_list_id`, and updates every matching row across every list so copies stay in sync. "Start campaign with this company" creates a `company_domain`-scoped campaign and drops you at its Audience step, defaulting to deliverable-only.

## How the Suppression List works

- **Three groups, three sources**: Bounced/Undeliverable (red, grouped by `zerobounce_sub_status`) comes straight from `contacts.status = 'undeliverable'` — either MillionVerifier's pre-send prediction, or (labeled `ses_<subtype>`) a real permanent bounce reported after an actual send. Unsubscribed (grey) and Spam complaints (orange) are both rows in `unsubscribes`, distinguished by its `reason` column (`'unsubscribe_link'` vs. `'complaint'`) — same table, same enforcement path, just a different cause.
- **Complaints reuse the unsubscribe path on purpose.** `applyComplaint()` in `src/lib/sesFeedback.ts` inserts into `unsubscribes` exactly the way `unsubscribe_by_token()` already does, just tagged `reason: 'complaint'`. That means every place that already excludes unsubscribes from a send — the Audience step's counts, `campaignSend.ts`'s recipient query, the `contacts.status` filter — excludes complaints too, automatically, with no separate code path to keep in sync or forget.
- **Re-import protection**: `createContactList` and `mergeContacts` (`src/app/(app)/contacts/actions.ts`) check every uploaded email against the user's `unsubscribes` table before inserting. A suppressed email is never inserted as `pending_verification` — new lists skip it entirely, and merges into an existing list leave that contact's row (and its `unsubscribed` status) untouched. The upload preview shows a count of how many rows were excluded this way, checked via a `checkSuppressedEmails` Server Action right after parsing — informational only; the real enforcement happens again, server-side, in the two actions regardless of what the client saw.
- **Manual resubscribe** goes through `resubscribe_contact()` (migration 0007), not a plain client-side delete: it deletes the `unsubscribes` row, reverts every matching contact back to `pending_verification` (never straight back to `deliverable` — it has to be re-verified before it can be mailed again), and writes a `resubscribe_log` row (who, when, and what was reversed) — all in one transaction. The UI requires an explicit "Are you sure?" confirmation naming the original opt-out date before calling it.
- **SES bounce/complaint feedback is opt-in infrastructure**, not just a UI toggle — see **Setting up SES bounce and complaint feedback** above. Without it, the Spam complaints group is simply always empty; nothing else about suppression depends on it.

## Known limitation

The `xlsx` (SheetJS) package on the npm registry has [known unpatched CVEs](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (SheetJS only publishes fixes to their own CDN, not npm). Since parsing happens client-side against files the user uploads themselves, the risk is limited to a user crashing their own browser tab on a malicious file — not a server-side or cross-user risk. If you want the patched build, install SheetJS's CDN tarball per [their docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs) instead of the npm package.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Auth with Next.js (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [MillionVerifier API docs](https://developer.millionverifier.com/)
