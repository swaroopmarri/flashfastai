This is a [Next.js](https://nextjs.org) 14 (App Router) project with Supabase email/password authentication and a protected dashboard.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project at [supabase.com](https://supabase.com) (or use an existing one).

3. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   You need two values from your Supabase dashboard:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API (or "API") → **Project URL** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / public** key |

   These are safe to expose in the browser (that's what `NEXT_PUBLIC_` means) — they're scoped by Supabase's Row Level Security, not secret credentials.

4. By default, Supabase requires users to confirm their email before they can log in. For local testing you can either:
   - Disable it: **Authentication → Sign In / Providers → Email → turn off "Confirm email"**, or
   - Keep it on and set your Site URL / Redirect URLs under **Authentication → URL Configuration** to `http://localhost:3000` (and your production URL later) so the confirmation link routes back to `/auth/confirm` correctly.

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Structure

- `src/app/login` — email/password login + signup form (Server Actions in `actions.ts`)
- `src/app/dashboard` — protected page; redirects to `/login` if not authenticated, has a logout button
- `src/app/auth/confirm` — handles the Supabase email confirmation link
- `src/utils/supabase` — Supabase client helpers for the browser, Server Components/Actions, and middleware
- `src/middleware.ts` — refreshes the auth session on every request and guards `/dashboard`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Auth with Next.js (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
