-- Adds currency to subscriptions -- each plan now has both INR and USD
-- pricing (see src/lib/pricingPlans.ts). Run this in the Supabase
-- dashboard: SQL Editor -> New query -> paste -> Run. Run AFTER
-- 0013_billing.sql.

alter table public.subscriptions add column if not exists currency text not null default 'INR';
alter table public.subscriptions drop constraint if exists subscriptions_currency_check;
alter table public.subscriptions add constraint subscriptions_currency_check check (currency in ('INR', 'USD'));
