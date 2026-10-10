-- EDIT no.113 — one-time free allowance (75 extractions per account, ever).
-- Run ONCE in Supabase → SQL Editor, BEFORE deploying the new claude-proxy.
-- Existing table, so no new grants are needed. Everyone starts at 0 (a fresh 75).
alter table public.settings add column if not exists free_used_total int not null default 0;
