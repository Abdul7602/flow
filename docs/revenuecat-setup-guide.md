# Flow — Subscription Setup Guide (RevenueCat)

Flow uses **RevenueCat** to handle in-app subscriptions across both iOS and Android through one unified system, instead of building raw StoreKit + Google Play Billing integrations separately. RevenueCat is free up to $2.5k/month in tracked revenue — see "Revisit at scale" at the bottom for when this might change.

---

## Step 1 — Create your products in each store first

RevenueCat doesn't create the subscription itself — it reads products you've already created in App Store Connect and Play Console, and unifies access to them.

**Google Play Console:**
1. Monetize → Subscriptions → Create subscription
2. Product ID: `flow_premium_monthly`
3. Name: `Flow Premium`
4. Price: (your chosen price, e.g. €3.99/month)
5. Add a free trial if wanted (14 days)
6. Activate it

**Apple App Store Connect:**
1. Your app → Monetization → Subscriptions
2. Create a Subscription Group (e.g. "Flow Premium")
3. Add a subscription: Product ID `flow_premium_monthly`, price, duration
4. Add a free trial via an Introductory Offer if wanted
5. Submit for review (subscriptions need their own lightweight review, separate from the app binary)

**Keep the Product ID identical on both platforms** (`flow_premium_monthly`) — makes everything simpler downstream.

---

## Step 2 — Create a RevenueCat account and project

1. Sign up at **app.revenuecat.com** (free)
2. Create a new project — name it `Flow`
3. Add two apps inside the project: one for iOS, one for Android — each needs its **Bundle ID / Package name**: `com.flowdaily.app` for both

---

## Step 3 — Connect each store to RevenueCat

**For iOS:**
- RevenueCat → your iOS app → Settings → App Store Connect API keys
- Follow their guide to generate/upload an App Store Connect API key (similar process to the one you made for Codemagic — you can reuse the same key or make a dedicated one)

**For Android:**
- RevenueCat → your Android app → Settings → Google Play
- Upload a Google Play **Service Account JSON** (Play Console → Setup → API access → create a service account with the right permissions) — RevenueCat's setup wizard walks through exactly which permissions to grant

---

## Step 4 — Import your products into RevenueCat

1. RevenueCat → Products → should auto-detect `flow_premium_monthly` from both stores once connected (may take a few minutes after creating them in each store)
2. Create an **Entitlement** called exactly `premium` (this must match `PREMIUM_ENTITLEMENT_ID` in `index.html`)
3. Attach both platform products to that one entitlement
4. Create an **Offering** (RevenueCat's term for "what the paywall shows") containing that package — name it `default`

---

## Step 5 — Get your public API keys

1. RevenueCat → Project Settings → API Keys
2. Copy the **iOS public app-specific key** and the **Android public app-specific key** (these are safe to put in client-side code — same security model as Supabase's anon key)
3. Open `index.html` in the repo, find:
   ```js
   const REVENUECAT_API_KEY_IOS = 'REPLACE_WITH_IOS_PUBLIC_SDK_KEY';
   const REVENUECAT_API_KEY_ANDROID = 'REPLACE_WITH_ANDROID_PUBLIC_SDK_KEY';
   ```
4. Replace both placeholder strings with your real keys, commit and push (also update `www/index.html` the same way, or just re-run `npx cap sync` after editing `index.html`)

---

## Step 6 — Wire the webhook (so Supabase knows who's subscribed)

1. Run `supabase-subscription-schema.sql` in the Supabase SQL Editor (adds subscription tracking columns)
2. Deploy the new Edge Function: `supabase/functions/revenuecat-webhook` (same deploy process as your other functions — JWT verification OFF, since RevenueCat itself authenticates via a header)
3. Choose any secret string, e.g. a random 32-character string → set it in Supabase secrets as `REVENUECAT_WEBHOOK_SECRET`
4. In RevenueCat → Project Settings → Integrations → Webhooks → add:
   - URL: `https://aqtnelbqkwtrbqbpzuut.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header value: the same secret string from step 3

---

## Step 7 — Test it

1. Use each store's **sandbox/test purchase** mode (Apple: TestFlight sandbox tester account; Google: a test account added in Play Console's license testing) to make a real (fake-money) purchase
2. Confirm in Supabase → Table Editor → `settings` that your test user's `subscription_status` flips to `active`
3. In the app, open settings — should now show "⚡ Premium" and hide the upgrade button
4. Confirm `claude-proxy`'s usage cap raised to 3000 for that user (check via the usage-check response)

---

## Revisit at scale

RevenueCat is free up to $2.5k/month tracked revenue, then takes a small percentage above that. If Flow ever comfortably exceeds that threshold, it becomes worth evaluating a migration to raw StoreKit 2 + Google Play Billing — genuinely more engineering work (receipt validation, two separate webhook systems, subscription lifecycle edge cases) but keeps 100% of revenue in-house beyond store fees. Not a launch-time concern; revisit only once revenue data makes the tradeoff concrete.
