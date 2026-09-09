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

### Connect Codemagic to Apple

**Note:** newer Codemagic UI has consolidated this into a single screen rather than separate "Apple Developer Portal" and "App Store Connect" integrations.

1. In Codemagic → **Teams → Settings → Integrations** (or a similar path — look for "Apple Developer Portal integration")
2. Create an **API Key** in App Store Connect first: **Users and Access → Keys → App Store Connect API** → Generate → **Access role: App Manager** → download the `.p8` file, note the **Key ID** and **Issuer ID**
3. In Codemagic's integration screen, add the key (name it anything memorable, e.g. `codemagic-key`)
4. **Whatever name you give it, that exact name must appear in `codemagic.yaml`** under `integrations: app_store_connect:` — the current repo value is `codemagic-key`. If you named yours differently, either rename it to match, or edit `codemagic.yaml` to match your name and push that change.

### Set up code signing
1. Codemagic → your app → **Code signing → iOS**
2. Easiest path: let Codemagic **automatically manage signing** — it can generate certificates and provisioning profiles for you once the integration above is linked
3. **iOS certificates tab** → Generate a new certificate → type: **Apple Distribution** (not Apple Development — Distribution is required for TestFlight/App Store)
4. **iOS provisioning profiles tab** → Fetch profiles (pulls existing ones) — if none exist yet, create one manually first in Apple Developer Portal (Profiles → + → App Store Connect type → select your App ID and the Distribution certificate → download → upload here)

### Environment variable group (separate from code signing)
`codemagic.yaml` also references an environment variable group called `ios_signing` (under `environment: groups:`). This is a different thing from the certificates/profiles above — it's Codemagic's mechanism for grouping secrets/variables for a build.
1. Codemagic → your app → **Environment variables**
2. Create a new group named exactly `ios_signing`
3. It can be empty for now if code signing is fully automatic — this group existing (even without variables in it) is enough to stop the build from erroring on a missing group reference. Add variables here later if the build ever asks for a specific one by name.

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
