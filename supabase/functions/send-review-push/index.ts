// ═══════════════════════════════════════════════════
// FLOW — Review Push Sender
// Runs on a cron schedule (every 5 min). For each user whose
// local time matches their review_time, sends a Web Push.
// Secrets needed: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// (SUPABASE_URL / SERVICE_ROLE_KEY are auto-injected)
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    webpush.setVapidDetails(
      'mailto:abdul@flow.app',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    )

    // all users' settings
    const MAX_PUSHES_PER_DAY = 1  // production: one review push per day (raise for testing)

    const { data: settings, error } = await supabase
      .from('settings')
      .select('user_id, review_time, timezone, last_push_date, push_count')
    if (error) throw error

    let sent = 0
    const now = new Date()

    for (const s of settings || []) {
      const tz = s.timezone || 'Europe/Helsinki'

      // user's local time & date
      const localNow = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now)
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now) // YYYY-MM-DD

      // daily push limit
      const countToday = s.last_push_date === localDate ? (s.push_count || 0) : 0
      if (countToday >= MAX_PUSHES_PER_DAY) continue

      // review time match (within the 5-min cron window)
      const review = (s.review_time || '22:00').slice(0, 5)
      const [rh, rm] = review.split(':').map(Number)
      const [lh, lm] = localNow.split(':').map(Number)
      const diff = (lh * 60 + lm) - (rh * 60 + rm)
      if (diff < 0 || diff > 4) continue

      // count today's open tasks
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', s.user_id)
        .eq('date', localDate)
        .eq('done', false)

      const n = count || 0
      const body = n === 0
        ? 'All clear today — nothing outstanding 🎉'
        : `${n} task${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} your attention`

      // send to all of the user's subscriptions
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', s.user_id)

      for (const row of subs || []) {
        try {
          await webpush.sendNotification(
            row.subscription,
            JSON.stringify({ title: '🌙 Evening check-in', body })
          )
          sent++
        } catch (e: any) {
          // subscription expired/revoked → clean it up
          if (e.statusCode === 404 || e.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id)
          }
        }
      }

      await supabase.from('settings')
        .update({ last_push_date: localDate, push_count: countToday + 1 })
        .eq('user_id', s.user_id)
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
