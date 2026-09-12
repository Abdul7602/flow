// ═══════════════════════════════════════════════════
// FLOW — RevenueCat Webhook Receiver
// RevenueCat calls this URL whenever a subscription event happens
// (purchase, renewal, cancellation, expiration). We update the
// user's subscription_status in Supabase so the app and the
// claude-proxy usage cap both know their current plan.
//
// Setup: RevenueCat dashboard → Project → Integrations → Webhooks
//   URL: https://<your-project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: set to the same value as REVENUECAT_WEBHOOK_SECRET
//
// Secret needed: REVENUECAT_WEBHOOK_SECRET (any string you choose —
// set it the same in both RevenueCat's webhook config and here)
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // verify this call genuinely came from RevenueCat
    const auth = req.headers.get('Authorization')
    const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
    if (!expected || auth !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await req.json()
    const event = body.event
    if (!event) return new Response(JSON.stringify({ ok: true, note: 'no event' }))

    // app_user_id is set to the Supabase user's UUID when we configure the SDK client-side
    const userId = event.app_user_id
    if (!userId) return new Response(JSON.stringify({ ok: true, note: 'no user id' }))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let status: string | null = null
    let expiresAt: string | null = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
        status = 'active'
        break
      case 'TRIAL_STARTED':
        status = 'trial'
        break
      case 'CANCELLATION':
        // user cancelled but may still have access until expiration — leave status as-is,
        // EXPIRATION event below is what actually flips it
        break
      case 'EXPIRATION':
        status = 'expired'
        break
      case 'BILLING_ISSUE':
        status = 'expired'
        break
    }

    if (status) {
      await supabase.from('settings')
        .update({
          subscription_status: status,
          subscription_expires_at: expiresAt,
          revenuecat_user_id: userId,
        })
        .eq('user_id', userId)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
