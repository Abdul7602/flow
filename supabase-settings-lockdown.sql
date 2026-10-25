-- EDIT no.119 — SECURITY: stop users editing their own subscription and usage columns.
--
-- Before: the policy "Users can update own settings" let any signed-in user update EVERY
-- column of their own settings row through the public API — including subscription_status
-- (free Premium) and free_used_total / parse_count (unlimited AI).
--
-- After: users can only update review_time (the only column the app itself changes).
-- Subscription and usage columns are written only by the server functions
-- (revenuecat-webhook, claude-proxy), which use the service role and are unaffected.
-- New settings rows are still created by the on_auth_user_created trigger (security definer).
--
-- ORDER: deploy the new claude-proxy FIRST, then run this in Supabase → SQL Editor.
-- If the app ever needs to let users change another settings column, add it to the
-- grant below, e.g.  grant update (review_time, new_column) on public.settings to authenticated;

revoke insert, update on public.settings from anon, authenticated;
grant update (review_time) on public.settings to authenticated;

-- Undo (restores the old, open behaviour):
--   grant insert, update on public.settings to authenticated;
