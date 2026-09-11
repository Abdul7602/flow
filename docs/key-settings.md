# Flow — Key Settings Reference

One place to find every number/value in Flow that might need changing later, why it exists, and exactly where to edit it. Each entry follows the same pattern as `docs/usage-cap.md` (kept separate since it's the one most likely to need urgent changes).

---

## 1. Monthly extraction limit (cost control)

**What:** caps how many AI note-extractions each user can run per month.
**Current value:** `300` per user/month
**Where:** `supabase/functions/claude-proxy/index.ts` → `const MONTHLY_LIMIT = 300`
**How to change:** edit the number → Deploy in Supabase dashboard. No other files need touching.
**Full detail:** see `docs/usage-cap.md`

---

## 2. Daily review push limit

**What:** how many times per day the evening review notification can fire for one user (normally always 1 — the testing-only lever).
**Current value:** `1` (production setting)
**Where:** `supabase/functions/send-review-push/index.ts` → `const MAX_PUSHES_PER_DAY = 1`
**How to change:** raise temporarily (e.g. to `3`) to test the notification multiple times in one day without waiting for the daily reset; always return to `1` afterward. Deploy after editing.

---

## 3. AI model (cost vs quality)

**What:** which Claude model does the note extraction.
**Current value:** `claude-haiku-4-5-20251001` (chosen for cost — ~3x cheaper than Sonnet, extraction quality is fine for this structured task)
**Where:** `supabase/functions/claude-proxy/index.ts` → `model: 'claude-haiku-4-5-20251001'`
**How to change:** if extraction quality ever needs to improve (e.g. handling more complex notes), swap to a Sonnet model string here. Check `docs.claude.com` for current model names before changing — they update periodically.

---

## 4. Extraction debounce timing

**What:** how long Flow waits after you stop typing before it parses the note (avoids parsing on every keystroke).
**Current value:** `2000` ms (2 seconds)
**Where:** `index.html` → `parseTimer=setTimeout(triggerParse,2000)`
**How to change:** lower = feels more responsive but more API calls (higher cost); higher = fewer calls but feels slower. 2s is a reasonable middle ground — only revisit if user feedback specifically complains about either side.

---

## 5. Bundle ID (native app identity)

**What:** the unique identifier for the iOS (and future Android) app — used by Apple/Google, TestFlight, push notifications, everything platform-level.
**Current value:** `com.flowdaily.app`
**Where:** `capacitor.config.json` (`appId`) and `supabase/functions/send-review-push/index.ts` (`APNS_BUNDLE_ID`) — **must always match exactly in both places**
**How to change:** only ever change this before first App Store submission — once submitted, the bundle ID is permanent for that app's life. Changing it later means creating a brand new App Store listing from scratch.

---

## 6. APNs secrets (native push delivery)

**What:** the three values that let `send-review-push` deliver notifications to the native iOS app.
**Current value:** not yet set — feature is code-complete but inactive until these exist
**Where:** Supabase → Edge Functions → Secrets → `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`
**How to set them:** full walkthrough in `docs/ios-launch-guide.md` — needs an active Apple Developer account first.

---

## 6b. FCM secret (Android native push delivery)

**What:** the value that lets `send-review-push` deliver notifications to the native Android app.
**Current value:** not yet set — feature is code-complete but inactive until this exists
**Where:** Supabase → Edge Functions → Secrets → `FCM_SERVICE_ACCOUNT` (full JSON contents of a Firebase service account key — uses the modern HTTP v1 API, not the deprecated Legacy server key)
**How to set it:** full walkthrough in `docs/android-launch-guide.md` — needs a free Firebase project first.

---

## 7. Domain & email sender

**What:** the domain Flow is served from, and where login-code emails come from.
**Current value:** app served at `app.flow-daily.com`; emails sent from `login@flow-daily.com` via Resend
**Where:** Cloudflare (DNS + domain), Supabase → Authentication → SMTP Settings (sender address)
**How to change:** only if the domain itself ever changes — would need new DNS records, new Resend verification, and updating Supabase's Site URL / Redirect URLs.

---

## 8. GitHub repo visibility

**What:** whether the source code repo is public or private.
**Current value:** **Public** (required for GitHub Pages to serve the free plan without a paid upgrade — going private breaks `app.flow-daily.com` until Pages is manually re-enabled)
**Where:** GitHub → repo → Settings → Danger Zone
**Note:** all real secrets (API keys, service role keys) live in Supabase, never in this repo — so public visibility carries no meaningful security risk. If ever made private again, remember to also re-enable GitHub Pages manually afterward (Settings → Pages → Source).

---

## 9. Apple's revenue cut

**What:** the percentage Apple takes from any in-app purchases/subscriptions.
**Current default:** 30%
**Lower option:** enroll in the **App Store Small Business Program** (App Store Connect → Business/Agreements) once revenue is under $1M/year (true by default for a new app) → drops to **15%**. Free, just needs enrolling — not automatic.
**Where:** App Store Connect (only accessible once Apple Developer account is fully approved).

---

*Keep this file updated whenever a new tunable constant is added — one line here beats hunting through commit history later.*
