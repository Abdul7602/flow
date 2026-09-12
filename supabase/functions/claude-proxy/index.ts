// ═══════════════════════════════════════════════════
// FLOW — Claude API Proxy Edge Function
// Deploy: supabase functions deploy claude-proxy
// The ANTHROPIC_API_KEY is set as a secret in Supabase,
// never exposed to the frontend.
//
// Includes a monthly per-user extraction cap to protect
// against runaway API costs (one bad actor or bug can't
// drain the account). Adjust MONTHLY_LIMIT below anytime.
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FREE_MONTHLY_LIMIT = 300     // extractions per user per month — free tier
const PREMIUM_MONTHLY_LIMIT = 3000 // extractions per user per month — active subscribers (generous, not unlimited, still cost-protected)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Check subscription status + monthly usage ──
    const nowMonth = new Date().toISOString().slice(0, 7)

    const { data: settings } = await supabase
      .from('settings')
      .select('parse_count, parse_month, subscription_status, subscription_expires_at')
      .eq('user_id', user.id)
      .single()

    // an active/trial subscriber gets the premium limit, but only while genuinely
    // still within their paid period (defends against a stale status if a webhook
    // was ever missed) — expired/cancelled/free all fall back to the free limit
    const now = new Date()
    const stillEntitled = (settings?.subscription_status === 'active' || settings?.subscription_status === 'trial')
      && (!settings?.subscription_expires_at || new Date(settings.subscription_expires_at) > now)
    const MONTHLY_LIMIT = stillEntitled ? PREMIUM_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT

    const currentCount = settings?.parse_month === nowMonth ? (settings?.parse_count || 0) : 0

    // usage-check mode: just report the count, don't call Claude or increment
    const bodyPeek = req.method === 'POST' ? await req.clone().json().catch(() => ({})) : {}
    if (bodyPeek.usageCheck) {
      return new Response(JSON.stringify({
        used: currentCount, limit: MONTHLY_LIMIT, remaining: Math.max(0, MONTHLY_LIMIT - currentCount),
        subscribed: stillEntitled,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (currentCount >= MONTHLY_LIMIT) {
      return new Response(JSON.stringify({
        error: 'monthly_limit_reached',
        message: stillEntitled
          ? `You've reached this month's extraction limit (${MONTHLY_LIMIT}). It resets on the 1st.`
          : `You've reached the free plan's monthly limit (${MONTHLY_LIMIT}). Upgrade to Flow Premium for a much higher limit.`,
        used: currentCount, limit: MONTHLY_LIMIT, subscribed: stillEntitled,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    supabase.from('settings')
      .update({ parse_count: currentCount + 1, parse_month: nowMonth })
      .eq('user_id', user.id)
      .then(() => {})

    const body = await req.json()

    const claudePayload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(body.max_tokens || 600, 1000),
      system: body.system || '',
      messages: body.messages || [],
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudePayload),
    })

    const data = await claudeRes.json()

    return new Response(JSON.stringify(data), {
      status: claudeRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
