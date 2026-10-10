-- EDIT no.120 — let the app save each user's device timezone (for the daily review push).
-- Run once in Supabase → SQL Editor. Extends the EDIT no.119 lockdown: users may update
-- only review_time and timezone on their own settings row.
grant update (review_time, timezone) on public.settings to authenticated;
