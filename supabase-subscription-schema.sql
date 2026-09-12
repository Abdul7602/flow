-- Subscription status — run in Supabase SQL Editor

alter table public.settings add column if not exists subscription_status text default 'free';
-- values: 'free' | 'trial' | 'active' | 'expired' | 'cancelled'
alter table public.settings add column if not exists subscription_expires_at timestamptz;
alter table public.settings add column if not exists revenuecat_user_id text;
