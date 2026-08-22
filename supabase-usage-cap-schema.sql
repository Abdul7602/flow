-- Usage cap — run in Supabase SQL Editor

alter table public.settings add column if not exists parse_count int default 0;
alter table public.settings add column if not exists parse_month text; -- 'YYYY-MM', resets counter when month changes
