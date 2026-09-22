// ═══════════════════════════════════════════════════
// FLOW — RevenueCat Webhook Receiver
// RevenueCat calls this URL whenever a subscription event happens
// (purchase, renewal, cancellation, expiration, transfer). We update
// the user's subscription_status in Supabase so the app and the
// claude-proxy usage cap both know their current plan.
//
// Setup: RevenueCat dashboard → Project → Integrations → Webhooks
//   URL: https://<your-project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: set to the same value as REVENUECAT_WEBHOOK_SECRET
//
// Secrets needed:
//   REVENUECAT_WEBHOOK_SECRET — any string you choose, set the same in
//     both RevenueCat's webhook config and here
//   REVENUECAT_SECRET_API_KEY — a SECRET key (starts sk_...), from
//     RevenueCat dashboard → Project Settings → API Keys → Secret keys.
//     This is DIFFERENT from the public SDK keys used client-side.
//     Needed only for TRANSFER events (see below) — everything else
//     works without it, but TRANSFER updates are silently skipped if
//     it's missing.
//
// TRANSFER events (2026-09-22): unlike every other event type, RevenueCat's
// TRANSFER payload does NOT include app_user_id, product_id, period_type,
// or expiration_at_ms — only transferred_from/transferred_to arrays. There's
// nothing in the payload itself to determine the destination user's actual
// entitlement, so we look it up directly via RevenueCat's REST API
// (GET /v1/subscribers/{id}) instead of trying to read it from the event.
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENTITLEMENT_ID = 'flow_daily_pro'

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
    console.log('[webhook] received event:', JSON.stringify(event))
    if (!event) return new Response(JSON.stringify({ ok: true, note: 'no event' }))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── TRANSFER: special case, no app_user_id in the payload at all ──
    if (event.type === 'TRANSFER') {
      const destIds: string[] = event.transferred_to || []
      const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY')
      if (!secretKey || destIds.length === 0) {
        console.log('[webhook] TRANSFER received but cannot resolve — secretKey present:', !!secretKey, 'destIds:', destIds)
        return new Response(JSON.stringify({ ok: true, note: 'transfer unresolved' }))
      }
      for (const destId of destIds) {
        try {
          const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${destId}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          })
          const data = await res.json()
          const ent = data?.subscriber?.entitlements?.[ENTITLEMENT_ID]
          const stillActive = ent?.expires_date ? new Date(ent.expires_date) > new Date() : false
          const status = stillActive ? 'active' : 'expired'
          const expiresAt = ent?.expires_date || null
          console.log('[webhook] TRANSFER destination', destId, 'entitlement:', JSON.stringify(ent), 'resolved status:', status)
          const { error: updateErr, data: updateData } = await supabase.from('settings')
            .update({ subscription_status: status, subscription_expires_at: expiresAt, revenuecat_user_id: destId })
            .eq('user_id', destId)
            .select()
          console.log('[webhook] TRANSFER update result:', JSON.stringify({ updateErr, rowsAffected: updateData?.length }))
        } catch (e) {
          console.log('[webhook] TRANSFER lookup failed for', destId, String(e))
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ── every other event type carries app_user_id directly ──
    const userId = event.app_user_id
    if (!userId) return new Response(JSON.stringify({ ok: true, note: 'no user id' }))

    let status: string | null = null
    let expiresAt: string | null = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
        // a trial purchase also arrives here as INITIAL_PURCHASE with
        // period_type:'TRIAL' — TRIAL_STARTED is not a real RevenueCat
        // webhook event type, so this correctly catches trials too
        status = event.period_type === 'TRIAL' ? 'trial' : 'active'
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

    console.log('[webhook] resolved status:', status, 'for userId:', userId)

    if (status) {
      const { error: updateErr, data: updateData } = await supabase.from('settings')
        .update({
          subscription_status: status,
          subscription_expires_at: expiresAt,
          revenuecat_user_id: userId,
        })
        .eq('user_id', userId)
        .select()
      console.log('[webhook] update result:', JSON.stringify({ updateErr, rowsAffected: updateData?.length }))
    } else {
      console.log('[webhook] status stayed null — event.type was:', event.type)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
