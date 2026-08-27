# Flow — iOS App Store Launch Guide

This covers everything from here to TestFlight and the App Store, written for a **Windows-only setup with no Mac**. All builds happen on Codemagic's cloud Macs, triggered from your browser.

---

## Where things stand

- ✅ Capacitor project wrapped (`ios/` folder, `capacitor.config.json`)
- ✅ Bundle ID set: `com.flowdaily.app`
- ✅ Portrait orientation hard-locked (native, unlike the web version)
- ✅ Push notification plugin installed and wired into the frontend (native-aware — detects Capacitor vs browser automatically)
- ⚠️ **Native push delivery (backend) is NOT built yet** — see "What's still missing" below
- ✅ `codemagic.yaml` — the cloud build recipe, ready to run once your Apple account exists

---

## Step 1 — Apple Developer account (do this FIRST — slowest step)

1. Go to **developer.apple.com/programs/enroll**
2. Sign in with (or create) an Apple ID
3. Enroll as an **Individual** (not Organization — simpler, no D-U-N-S number needed)
4. Pay the **$99/year** fee
5. Apple verifies your identity — this can take anywhere from a few hours to 2 days

**Start this now regardless of anything else** — every other step waits on this.

---

## Step 2 — App Store Connect setup (once Apple approves you)

1. Go to **appstoreconnect.apple.com**
2. **My Apps → +  → New App**
3. Platform: iOS · Name: **Flow** · Bundle ID: create new → `com.flowdaily.app` (must match exactly) · SKU: anything, e.g. `flow001`
4. Fill in the required metadata later (screenshots, description) — not needed yet for TestFlight internal testing, only for public submission

---

## Step 3 — Codemagic account (free tier, no Mac needed)

1. Sign up at **codemagic.io** with your GitHub account
2. **Add application** → select the `Abdul7602/flow` repo
3. Codemagic will detect `codemagic.yaml` in the repo automatically

### Connect Codemagic to App Store Connect
1. In Codemagic → **Teams → Integrations → App Store Connect**
2. Follow their guide to create an **API Key** in App Store Connect (Users and Access → Keys → App Store Connect API) and upload it to Codemagic
3. Name the integration `flow_app_store_connect` (must match `codemagic.yaml`)

### Set up code signing
1. Codemagic → your app → **Code signing → iOS**
2. Easiest path: let Codemagic **automatically manage signing** — it can generate certificates and provisioning profiles for you once the App Store Connect integration above is linked
3. Group name: `ios_signing` (matches `codemagic.yaml`)

---

## Step 4 — Trigger your first build

1. Codemagic → your app → **Start new build** → workflow: `ios-testflight`
2. Watch the build log in your browser (this is your "Mac" now — happens entirely in the cloud)
3. On success, it automatically uploads to **TestFlight**

---

## Step 5 — Install on your iPhone via TestFlight

1. Install the **TestFlight** app from the App Store on your iPhone
2. In App Store Connect → your app → **TestFlight** tab → add yourself as an internal tester (your Apple ID email)
3. Accept the invite that arrives → install Flow through TestFlight
4. This is a **real native app**, not the PWA — test everything fresh: login, extraction, calendar, and especially notifications

---

## What's still missing (do before public submission)

**Native push notification delivery — code is READY, just needs 3 secrets.** The app registers for native push and stores a device token in `push_subscriptions` (tagged `{native: true, platform: 'ios', token: ...}`). The `send-review-push` Edge Function already contains the full APNs-sending logic (JWT signing, HTTP/2 delivery, dead-token cleanup) — it's just inactive until three secrets exist, because Apple only issues the required key after your Developer account is approved.

**Once your Apple Developer account is active, do this (10 minutes):**

1. Go to **developer.apple.com/account → Certificates, Identifiers & Profiles → Keys**
2. Click **+** → name it e.g. `Flow APNs Key` → check **Apple Push Notifications service (APNs)** → Continue → Register
3. **Download the `.p8` file immediately** — Apple only lets you download it once, ever. If you lose it you must generate a new key.
4. Note the **Key ID** shown on that page (10-character code)
5. Note your **Team ID** — top-right of the developer portal, or **Membership Details** page (also 10 characters)
6. Open the downloaded `.p8` file in a text editor — copy its full contents (including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines)
7. In Supabase → Edge Functions → **Secrets**, add:
   - `APNS_AUTH_KEY` = the full contents of the .p8 file
   - `APNS_KEY_ID` = the Key ID from step 4
   - `APNS_TEAM_ID` = the Team ID from step 5
8. Redeploy `send-review-push` (Edge Functions → send-review-push → Deploy, no code change needed — just picks up the new secrets)

That's it — native push notifications go live the moment those three secrets are saved. No other code changes needed; this was all built in advance.

**Until those secrets exist:** native subscribers are silently skipped (no error, no crash) — Web Push subscribers (browser/PWA) continue working exactly as before, completely unaffected.

---

## Realistic timeline from here

| Step | Time |
|---|---|
| Apple Developer approval | hours – 2 days |
| Codemagic + signing setup | 1–2 hours (one-time) |
| First build | ~15–20 min build time |
| TestFlight testing | as long as you want |
| Native push wiring | ~1 hour once APNs key exists |
| App Store review after submission | 1–3 days typically |

Nothing here is blocked by your hardware — every remaining step happens in a browser.
