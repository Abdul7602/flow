// ═══════════════════════════════════════════════════
// FLOW — Self-service account deletion
// Verifies the caller's session, then deletes their auth user.
// All app data (notes, tasks, settings, push subscriptions)
// is removed automatically via ON DELETE CASCADE.
// Deploy with JWT verification OFF (we verify inside).
//
// EDIT no.124: accounts made with Sign in with Apple — Apple requires apps
// to revoke the user's Apple sign-in when the account is deleted. The app
// sends a fresh one-time Apple code (appleAuthorizationCode); this function
// swaps it for a token and revokes it. Best effort: if it fails, or the
// secrets aren't set yet, the account is still deleted.
// Secrets: APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY
// (a .p8 key with "Sign in with Apple" enabled). See docs/social-sign-in-setup.md
// ═══════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SignJWT, importPKCS8, decodeJwt } from 'npm:jose@5'

const APPLE_CLIENT_ID = 'com.flowdaily.app'

// Same repair as send-review-push: tolerate a .p8 pasted without its
// BEGIN/END lines or with escaped newlines.
function normalizePkcs8Key(raw: string): string {
  let key = raw.trim().replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
  if (!key.includes('-----BEGIN')) {
    const lines = key.replace(/\s+/g, '').match(/.{1,64}/g) || []
    return '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----'
  }
  if (!key.includes('\n')) {
    const body = key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').trim()
    const lines = body.replace(/\s+/g, '').match(/.{1,64}/g) || []
    key = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----'
  }
  return key
}

// deno-lint-ignore no-explicit-any
async function revokeAppleSignIn(code: string, user: any): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID')
  const keyId = Deno.env.get('APPLE_SIGNIN_KEY_ID')
  const rawKey = Deno.env.get('APPLE_SIGNIN_PRIVATE_KEY')
  if (!teamId || !keyId || !rawKey) return 'not-configured'

  const key = await importPKCS8(normalizePkcs8Key(rawKey), 'ES256')
  const now = Math.floor(Date.now() / 1000)
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience('https://appleid.apple.com')
    .setSubject(APPLE_CLIENT_ID)
    .sign(key)

  const form = (o: Record<string, string>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(o),
  })

  // 1. One-time code → refresh token
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', form({
    client_id: APPLE_CLIENT_ID, client_secret: clientSecret, code, grant_type: 'authorization_code',
  }))
  const tokenJson = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokenJson.refresh_token) return 'exchange-failed:' + (tokenJson.error || tokenRes.status)

  // 2. Only revoke if it's the same Apple account that is linked to this Flow user
  // deno-lint-ignore no-explicit-any
  const identity = (user.identities || []).find((i: any) => i.provider === 'apple')
  const expectedSub = identity?.identity_data?.sub || identity?.provider_id || identity?.id
  try {
    const sub = tokenJson.id_token ? decodeJwt(tokenJson.id_token).sub : null
    if (expectedSub && sub && sub !== expectedSub) return 'different-apple-account'
  } catch { /* no usable id_token — still revoke the token we just got */ }

  // 3. Revoke
  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', form({
    client_id: APPLE_CLIENT_ID, client_secret: clientSecret,
    token: tokenJson.refresh_token, token_type_hint: 'refresh_token',
  }))
  return revokeRes.ok ? 'revoked' : 'revoke-failed:' + revokeRes.status
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify who is asking
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Sign in with Apple accounts: revoke Apple's link to Flow (best effort)
    let appleRevoke = 'not-needed'
    const body = await req.json().catch(() => ({}))
    const appleCode = typeof body?.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : ''
    if (appleCode) {
      try { appleRevoke = await revokeAppleSignIn(appleCode, user) }
      catch (e) { appleRevoke = 'error:' + String(e).slice(0, 120) }
      console.log('apple revoke:', appleRevoke)
    }

    // 3. Delete the auth user with admin privileges — cascades wipe all data
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { error: delError } = await admin.auth.admin.deleteUser(user.id)
    if (delError) throw delError

    return new Response(JSON.stringify({ ok: true, appleRevoke }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
