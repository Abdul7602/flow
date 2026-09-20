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
//   FCM_SERVICE_ACCOUNT — the full contents of the Firebase service account
//                     JSON file (Project Settings → Service Accounts →
//                     Generate new private key), pasted as one secret value
// (SUPABASE_URL / SERVICE_ROLE_KEY are auto-injected)
//
// NOTE: APNs and FCM sending are INACTIVE until their secrets above are
// set. Until then, native subscribers on that platform are silently
// skipped — Web Push subscribers (browser/PWA) continue to work.
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { SignJWT, importPKCS8 } from 'npm:jose@5'

const APNS_BUNDLE_ID = 'com.flowdaily.app'
const APNS_URL = 'https://api.push.apple.com' // TestFlight + App Store both use production APNs

let cachedApnsJwt: { token: string; issuedAt: number } | null = null
const debugLog: string[] = [] // ⭐ TEMP DEBUG — collected and returned directly in the response body

// Cleans up the most common copy-paste corruption patterns for a PEM key:
// literal "\n" text instead of real newlines, Windows CRLF endings, or the
// whole key collapsed onto a single line (a known old-Notepad quirk with
// Unix-style line endings in short text files).
function normalizePkcs8Key(raw: string): string {
  let key = raw.trim()
  key = key.replace(/\\n/g, '\n')      // literal backslash-n → real newline
  key = key.replace(/\r\n/g, '\n')     // CRLF → LF
  if (!key.includes('\n') && key.includes('-----BEGIN PRIVATE KEY-----')) {
    const body = key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .trim()
    const lines = body.match(/.{1,64}/g) || []
    key = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----'
  }
  return key
}

async function getApnsJwt(): Promise<string | null> {
  const rawKey = Deno.env.get('APNS_AUTH_KEY')
  const key = rawKey ? normalizePkcs8Key(rawKey) : rawKey
  debugLog.push('raw key length: ' + (rawKey?.length||0) + ', starts: ' + JSON.stringify(rawKey?.slice(0,30)) + ', ends: ' + JSON.stringify(rawKey?.slice(-30))) // ⭐ TEMP DEBUG
  const keyId = Deno.env.get('APNS_KEY_ID')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  debugLog.push('secrets present: ' + JSON.stringify({ hasKey: !!key, hasKeyId: !!keyId, hasTeamId: !!teamId, keyId, teamId })) // ⭐ TEMP DEBUG
  if (!key || !keyId || !teamId) {
    debugLog.push('one or more secrets missing — skipping') // ⭐ TEMP DEBUG
    return null // not configured yet — feature inactive
  }

  // APNs JWTs are valid up to 1hr — reuse for 50 min to avoid re-signing every call
  if (cachedApnsJwt && Date.now() - cachedApnsJwt.issuedAt < 50 * 60 * 1000) {
    debugLog.push('using cached JWT') // ⭐ TEMP DEBUG
    return cachedApnsJwt.token
  }

  try {
    const privateKey = await importPKCS8(key, 'ES256')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuedAt()
      .setIssuer(teamId)
      .sign(privateKey)

    cachedApnsJwt = { token, issuedAt: Date.now() }
    debugLog.push('JWT signed successfully') // ⭐ TEMP DEBUG
    return token
  } catch (e) {
    debugLog.push('JWT signing FAILED: ' + String(e)) // ⭐ TEMP DEBUG
    return null
  }
}

async function sendApns(deviceToken: string, title: string, body: string): Promise<{ ok: boolean; shouldDelete?: boolean }> {
  const jwt = await getApnsJwt()
  if (!jwt) {
    debugLog.push('no JWT available — cannot send') // ⭐ TEMP DEBUG
    return { ok: false } // APNs not configured yet — skip quietly
  }

  debugLog.push('sending to device token: ' + deviceToken.slice(0, 12)+'…') // ⭐ TEMP DEBUG

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

  const resBody = await res.text() // ⭐ TEMP DEBUG — read body for diagnostics
  debugLog.push('response status: ' + res.status + ' body: ' + resBody) // ⭐ TEMP DEBUG

  if (res.status === 200) return { ok: true }
  // 410 Gone / 400 BadDeviceToken → token is dead, clean it up
  if (res.status === 410 || res.status === 400) return { ok: false, shouldDelete: true }
  return { ok: false }
}


// ── Android native app (Firebase Cloud Messaging — HTTP v1 API) ──
// Uses a Firebase Service Account (not the deprecated Legacy server key).
// Requires the FCM_SERVICE_ACCOUNT secret — see docs/android-launch-guide.md.
// Inactive (silently skipped) until that secret is set, same pattern as APNs.

let cachedFcmToken: { token: string; issuedAt: number } | null = null

async function getFcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return null // FCM not configured yet — skip quietly

  const svc = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string }

  // reuse a cached Google OAuth2 access token for up to 50 minutes (tokens last 1hr)
  if (cachedFcmToken && Date.now() - cachedFcmToken.issuedAt < 50 * 60 * 1000) {
    return { token: cachedFcmToken.token, projectId: svc.project_id }
  }

  const privateKey = await importPKCS8(svc.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(svc.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) return null

  cachedFcmToken = { token: tokenData.access_token, issuedAt: Date.now() }
  return { token: tokenData.access_token, projectId: svc.project_id }
}

async function sendFcm(deviceToken: string, title: string, body: string): Promise<{ ok: boolean; shouldDelete?: boolean }> {
  const auth = await getFcmAccessToken()
  if (!auth) return { ok: false } // FCM not configured yet — skip quietly

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        android: { priority: 'high', notification: { sound: 'default' } },
      },
    }),
  })

  if (res.status === 200) return { ok: true }
  const data = await res.json().catch(() => ({}))
  const status = data?.error?.status
  if (status === 'NOT_FOUND' || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
    return { ok: false, shouldDelete: true }
  }
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

      debugLog.push(`user ${s.user_id.slice(0,8)}… matched review time — checking ${(subs||[]).length} subscription row(s)`) // ⭐ TEMP DEBUG

      for (const row of subs || []) {
        const sub = row.subscription as any
        debugLog.push('row subscription: ' + JSON.stringify(sub)) // ⭐ TEMP DEBUG

        if (sub?.native && sub?.token && sub?.platform === 'android') {
          // ── Native Android app (FCM) ──
          const result = await sendFcm(sub.token, title, body)
          if (result.ok) sent++
          if (result.shouldDelete) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id)
          }
        } else if (sub?.native && sub?.token) {
          // ── Native iOS app (APNs) — default for any other native platform value ──
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

    return new Response(JSON.stringify({ ok: true, sent, debug: debugLog }), { // ⭐ TEMP DEBUG — added debugLog to response
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), debug: debugLog }), { status: 500 }) // ⭐ TEMP DEBUG
  }
})
