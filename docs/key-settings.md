# Flow — Key Settings Reference

One place to find every number/value in Flow that might need changing later, why it exists, and exactly where to edit it. Each entry follows the same pattern as `docs/usage-cap.md` (kept separate since it's the one most likely to need urgent changes).

---

## 1. Free tier monthly extraction limit (cost control)

**What:** caps how many AI note-extractions a free (non-subscriber) user can run per month.
**Current value:** `FREE_MONTHLY_LIMIT = 75` per user/month
**Where:** `supabase/functions/claude-proxy/index.ts`
**How to change:** edit the number → Deploy in Supabase dashboard. No other files need touching.
**Full detail:** see `docs/usage-cap.md` (note: that doc's worked example still shows the old `300` value/variable name as a historical illustration of the cost-per-extraction math — the math itself still applies, just substitute the current number)

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

## 8b. Premium monthly extraction limit

**What:** the higher AI-extraction cap given to active/trial subscribers (vs the free tier's 75/month).
**Current value:** `PREMIUM_MONTHLY_LIMIT = 900` per subscriber/month
**Where:** `supabase/functions/claude-proxy/index.ts`
**How to change:** edit the number → Deploy. No schema change needed.

**Why 900 specifically — the math behind this number:**
At Claude Haiku 4.5 pricing (~$0.002/extraction worst case), 900 extractions costs ~€1.80 in raw AI usage if a subscriber uses every single one in a month. At a €3.99/month subscription price, after Apple/Google's 15% cut (~€0.60), net revenue is ~€3.39 — leaving a **guaranteed profit floor of ~€1.59/subscriber/month even in the absolute worst case**. Real average usage is far lower than 900/month for almost all users, so typical profit per subscriber is closer to €3/month. This was chosen over a higher number (e.g. 3000) specifically because 3000 could have gone *negative* for a heavy user (3000 × €0.002 = €6 cost vs €3.39 net revenue) — 900 removes that risk entirely while still being 3x the free tier.

**Yearly subscribers get the same 900/month** — the yearly plan is priced as a discount for paying annually, not a different usage tier. If yearly is priced at roughly 10x monthly (a ~17% discount, standard SaaS practice) e.g. €34.99/year for a €3.99/month plan, the same per-month profit math applies since usage resets monthly regardless of billing frequency.

---

## 8c. RevenueCat keys and entitlement ID

**What:** the public SDK keys that let the app fetch subscription offerings and process purchases, and the entitlement identifier that determines "is this user premium."
**Current value:** placeholders (`REPLACE_WITH_IOS_PUBLIC_SDK_KEY` etc.) — not yet configured
**Where:** `index.html` — `REVENUECAT_API_KEY_IOS`, `REVENUECAT_API_KEY_ANDROID`, `PREMIUM_ENTITLEMENT_ID`
**How to set them:** full walkthrough in `docs/subscriptions-setup.md` — needs a RevenueCat account first.

---

## 8d. RevenueCat webhook secret

**What:** shared secret that verifies incoming subscription-event calls genuinely came from RevenueCat.
**Current value:** not yet set
**Where:** Supabase → Edge Functions → Secrets → `REVENUECAT_WEBHOOK_SECRET` (must match the value entered in RevenueCat's webhook config)
**How to set it:** full walkthrough in `docs/subscriptions-setup.md`.

---

## 9. Apple's revenue cut

**What:** the percentage Apple takes from any in-app purchases/subscriptions.
**Current default:** 30%
**Lower option:** enroll in the **App Store Small Business Program** (App Store Connect → Business/Agreements) once revenue is under $1M/year (true by default for a new app) → drops to **15%**. Free, just needs enrolling — not automatic.
**Where:** App Store Connect (only accessible once Apple Developer account is fully approved).

---

*Keep this file updated whenever a new tunable constant is added — one line here beats hunting through commit history later.*
