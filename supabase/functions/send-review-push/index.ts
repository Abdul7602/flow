// ═══════════════════════════════════════════════════
// FLOW — Review Push Sender
// Runs on a cron schedule (every 5 min). For each user whose
// local time matches their review_time, sends a push —
// via Web Push (browser/PWA subscribers) or APNs (native iOS
// app subscribers), depending on what kind of subscription
// they have stored.
//
// Secrets needed:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   — for Web Push (already set)
//   APNS_AUTH_KEY   — contents of the .p8 file from Apple (Certificates,
//                     Identifiers & Profiles → Keys → APNs Auth Key)
//   APNS_KEY_ID     — the Key ID shown next to that key in Apple's portal
//   APNS_TEAM_ID    — your Apple Developer Team ID (top right of the portal,
//                     or Membership Details page)
// (SUPABASE_URL / SERVICE_ROLE_KEY are auto-injected)
//
// NOTE: APNs sending is INACTIVE until the three APNS_* secrets above
// are set. Until then, native subscribers are silently skipped — Web
// Push subscribers (browser/PWA) continue to work exactly as before.
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { SignJWT, importPKCS8 } from 'npm:jose@5'

const APNS_BUNDLE_ID = 'com.flowdaily.app'
const APNS_URL = 'https://api.push.apple.com' // TestFlight + App Store both use production APNs

let cachedApnsJwt: { token: string; issuedAt: number } | null = null

async function getApnsJwt(): Promise<string | null> {
  const key = Deno.env.get('APNS_AUTH_KEY')
  const keyId = Deno.env.get('APNS_KEY_ID')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  if (!key || !keyId || !teamId) return null // not configured yet — feature inactive

  // APNs JWTs are valid up to 1hr — reuse for 50 min to avoid re-signing every call
  if (cachedApnsJwt && Date.now() - cachedApnsJwt.issuedAt < 50 * 60 * 1000) {
    return cachedApnsJwt.token
  }

  const privateKey = await importPKCS8(key, 'ES256')
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuedAt()
    .setIssuer(teamId)
    .sign(privateKey)

  cachedApnsJwt = { token, issuedAt: Date.now() }
  return token
}

async function sendApns(deviceToken: string, title: string, body: string): Promise<{ ok: boolean; shouldDelete?: boolean }> {
  const jwt = await getApnsJwt()
  if (!jwt) return { ok: false } // APNs not configured yet — skip quietly

  const res = await fetch(`${APNS_URL}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
    }),
  })

  if (res.status === 200) return { ok: true }
  // 410 Gone / 400 BadDeviceToken → token is dead, clean it up
  if (res.status === 410 || res.status === 400) return { ok: false, shouldDelete: true }
  return { ok: false }
}

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

    const MAX_PUSHES_PER_DAY = 1 // production: one review push per day (raise for testing)

    const { data: settings, error } = await supabase
      .from('settings')
      .select('user_id, review_time, timezone, last_push_date, push_count')
    if (error) throw error

    let sent = 0
    const now = new Date()

    for (const s of settings || []) {
      const tz = s.timezone || 'Europe/Helsinki'

      const localNow = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now)
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)

      const countToday = s.last_push_date === localDate ? (s.push_count || 0) : 0
      if (countToday >= MAX_PUSHES_PER_DAY) continue

      const review = (s.review_time || '22:00').slice(0, 5)
      const [rh, rm] = review.split(':').map(Number)
      const [lh, lm] = localNow.split(':').map(Number)
      const diff = (lh * 60 + lm) - (rh * 60 + rm)
      if (diff < 0 || diff > 4) continue

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
      const title = '🌙 Evening check-in'

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', s.user_id)

      for (const row of subs || []) {
        const sub = row.subscription as any

        if (sub?.native && sub?.token) {
          // ── Native iOS app (APNs) ──
          const result = await sendApns(sub.token, title, body)
          if (result.ok) sent++
          if (result.shouldDelete) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id)
          }
        } else {
          // ── Web Push (browser / installed PWA) ──
          try {
            await webpush.sendNotification(sub, JSON.stringify({ title, body }))
            sent++
          } catch (e: any) {
            if (e.statusCode === 404 || e.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', row.id)
            }
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
