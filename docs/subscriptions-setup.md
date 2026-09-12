# Flow — Subscriptions Setup (RevenueCat)

This covers connecting Flow's already-built paywall to real Apple/Google billing via RevenueCat.

**Why RevenueCat instead of raw StoreKit/Play Billing:** building direct integrations with both platforms' native billing APIs is multi-week engineering work (separate receipt validation, separate webhook systems, separate purchase flows for iOS and Android). RevenueCat wraps both into one API and is **free up to $2.5k/month in tracked revenue** — far beyond where Flow is now. Revisit raw APIs only if Flow is earning enough that RevenueCat's percentage fee above that threshold becomes meaningful (a good problem to have).

---

## What's already built (code-complete, waiting on your account setup)

- `@revenuecat/purchases-capacitor` installed and synced into both iOS and Android native projects
- Paywall UI in the app (settings → "⚡ Upgrade to Premium")
- Automatic prompt to upgrade when a free user hits their monthly AI extraction limit
- Backend: `claude-proxy` already checks subscription status and gives active/trial subscribers a **10x higher** monthly limit (3000 vs 300)
- Backend: `revenuecat-webhook` Edge Function ready to receive subscription events and keep Supabase in sync
- Settings screen shows "⚡ Premium" badge and thank-you message once subscribed

## What you need to do

### 1. Create a RevenueCat account
1. Go to **app.revenuecat.com** → sign up (free)
2. Create a new project → name it `Flow`

### 2. Connect your App Store Connect and Play Console
1. In RevenueCat → Project Settings → **Apps** → **+ New**
2. Add an **iOS app**: paste your Bundle ID (`com.flowdaily.app`), and connect it to App Store Connect via an API key (similar process to the Codemagic one — App Store Connect → Users and Access → Keys)
3. Add an **Android app**: paste your Package name (`com.flowdaily.app`), and upload your Google Play service account JSON (Play Console → Setup → API access → create/link a service account with the right permissions)

### 3. Create your subscription products
You need to create the **actual product** in App Store Connect AND Google Play Console first (matching price, e.g. €3.99/month with a 14-day free trial), **then** import them into RevenueCat:

- **App Store Connect** → your app → **Monetization → Subscriptions** → create a subscription group and a monthly subscription product
- **Google Play Console** → your app → **Monetize → Subscriptions** → create the subscription (you may have already started this)
- Back in RevenueCat → **Products** tab → it should detect these once connected, or you can manually add them by Product ID

### 4. Create an Entitlement
1. RevenueCat → **Entitlements** → **+ New**
2. Identifier: `premium` (must match exactly — this is hardcoded in Flow's code as `PREMIUM_ENTITLEMENT_ID`)
3. Attach your subscription product to this entitlement

### 5. Create an Offering
1. RevenueCat → **Offerings** → **+ New** → name it `default`
2. Add a **Package** inside it (e.g. "Monthly") pointing to your subscription product
3. Mark this offering as the **Current** offering — this is what the app fetches to show the paywall

### 6. Get your public API keys
1. RevenueCat → Project Settings → **API Keys**
2. Copy the **iOS public SDK key** and the **Android public SDK key** (these are safe to embed client-side — same trust model as Supabase's anon key)
3. In `index.html`, find these two lines near the top of the RevenueCat section and replace the placeholders:
   ```js
   const REVENUECAT_API_KEY_IOS = 'REPLACE_WITH_IOS_PUBLIC_SDK_KEY';
   const REVENUECAT_API_KEY_ANDROID = 'REPLACE_WITH_ANDROID_PUBLIC_SDK_KEY';
   ```
4. Commit and push this change (a normal EDIT, same as any other code change)

### 7. Set up the webhook (keeps Supabase in sync)
1. RevenueCat → Project Settings → **Integrations → Webhooks** → **+ Add**
2. URL: `https://aqtnelbqkwtrbqbpzuut.supabase.co/functions/v1/revenuecat-webhook`
3. Authorization header value: make up any secret string, e.g. a long random password
4. In Supabase → Edge Functions → Secrets, add: `REVENUECAT_WEBHOOK_SECRET` = the exact same string
5. Deploy the `revenuecat-webhook` function (Edge Functions → deploy new function → paste from `supabase/functions/revenuecat-webhook/index.ts`, JWT verification OFF since RevenueCat calls it directly, not a logged-in user)

### 8. Run the subscription schema SQL
Run `supabase-subscription-schema.sql` in the Supabase SQL Editor (adds `subscription_status`, `subscription_expires_at`, `revenuecat_user_id` columns to `settings`).

---

## Testing

- **iOS:** use a **Sandbox Apple ID** (created in App Store Connect → Users and Access → Sandbox Testers) to test purchases without real charges, on a TestFlight build
- **Android:** add your own Google account as a **License Tester** (Play Console → Setup → License testing) to test without real charges, on an internal testing release

## Play Console "restricted content" declaration

When Play Console asks *"Is any part of your app restricted?"* — answer **Yes**, and check both:
- **Account sign-in details** (Flow requires email login)
- **Payments** (once subscriptions are live — one-time products, memberships, subscriptions)

You'll need to provide test login instructions for the reviewer, since Flow uses passwordless email codes. Suggested approach: provide a dedicated test email (e.g. `reviewer@flow-daily.com`, easy since domain email routing is already set up) and explain in the "App access instructions" field that a one-time code is sent to it, which you'll monitor during the review window.

---

## Revisit later, once revenue justifies it

If Flow's subscription revenue grows well beyond RevenueCat's free tier and their percentage fee becomes a meaningful cost, the migration path is: build native StoreKit 2 (iOS) and Google Play Billing Library (Android) integrations directly, with your own receipt validation and Apple/Google notification webhook handling. This is a multi-week project — worth it only once the fee RevenueCat charges exceeds what that engineering time would cost you elsewhere. Not a launch-day concern.
