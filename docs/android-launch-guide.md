# Flow — Android / Play Store Launch Guide

Android is simpler than iOS in almost every way — the build runs on your own Windows laptop (no cloud Mac needed), the developer fee is a one-time $25 instead of $99/year, and you already own a real test device (Galaxy A17).

---

## Where things stand

- ✅ Capacitor Android project wrapped (`android/` folder, Gradle project)
- ✅ Package name: `com.flowdaily.app` (matches iOS bundle ID exactly)
- ✅ Portrait orientation hard-locked natively (`android:screenOrientation="portrait"`)
- ✅ `com.android.vending.BILLING` permission added (required for subscriptions to function at all)
- ✅ Push notification permission declared, plugin wired
- ✅ Native push delivery (FCM) — configured and confirmed working on real device
- ✅ Signing keystore — generated and backed up
- ✅ Google Play Developer account — enrolled and verified
- ✅ Subscriptions (RevenueCat + Play Console) — fully wired and confirmed working end-to-end on Android; see `docs/subscriptions-setup.md`
- ✅ Current versionCode: 8 (see git log / `android/app/build.gradle` for the latest — bump on every rebuild)

---

## Release checklist (every Android build) — added 2026-10-12

Build only from **`C:\dev\flow`** on the **`android`** branch.

1. `git switch android` then `git pull` (pull **while on the branch you build**).
2. Make sure **`android/app/google-services.json` exists**. It is deliberately NOT in GitHub (`.gitignore`), so a fresh clone does not have it. Without it the app builds fine but **push notifications are greyed out**. Re-download any time from Firebase → Project settings → Your apps → Android (`com.flowdaily.app`, project `flow-22ea5`).
3. `npx cap sync android` (copies the web code + plugin list into the Android project; skipping it caused the 34/35 black screen).
4. Check `android/app/build.gradle` has a **new versionCode** (Play rejects reused codes).
5. Android Studio: Gradle JDK = **jbr-21** (Java 25 is too new for Gradle 8.14.3) → Sync Project with Gradle Files.
6. **Test on the phone first (Run ▶ / APK) before any upload**: app opens, sign in, write a note (tasks extracted, usage counter +1), notifications toggle turns on, sign out → sign in → buy Monthly.
7. Only then: signed bundle → closed testing → production. Tag the release `android-vc<code>-<name>`.

## Step 1 — Install Android Studio (one-time, free)

1. Download from **developer.android.com/studio** — works fine on your Windows/AMD laptop
2. During setup, let it install the Android SDK (default options are fine)
3. This is the *only* tool you need locally — unlike iOS, no cloud service is required to build

---

## Step 2 — Build and test locally

From the project folder, in a terminal:

```
npx cap sync android
npx cap open android
```

The second command opens the project in Android Studio. From there:
- Connect your Galaxy A17 via USB (enable **Developer Options → USB Debugging** on the phone first: Settings → About phone → tap "Build number" 7 times, then Settings → Developer options)
- Click the green **Run ▶** button in Android Studio — it installs and launches Flow directly on your phone, no store needed for this stage

This is your fast iteration loop — same speed as web development, entirely on your own machine.

---

## Step 3 — Google Play Developer account

1. Go to **play.google.com/console/signup**
2. Pay the **$25 one-time fee** (not yearly — this is the whole cost, forever)
3. Identity verification is typically much faster than Apple's — often same-day

---

## Step 4 — Generate your signing keystore (do this once, keep it forever)

In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle → Create new keystore**

Fill in the form (organization details, a password). **Save the resulting `.jks` file and its passwords somewhere safe and backed up** — losing this file means you can never update your app again under the same listing; you'd have to publish as a brand new app.

---

## Step 5 — Native push notifications (Firebase / FCM)

Android's push system is different from iOS's — it goes through **Firebase Cloud Messaging**, using the modern **HTTP v1 API** (the older "Legacy" key method is deprecated by Google and can be unreliable to even access now).

1. Go to **console.firebase.google.com** → Create a project (free) → name it `Flow` or similar
2. From Firebase: **Project settings → General → Add app → Android** → package name `com.flowdaily.app` → download **`google-services.json`**
3. Place that file at `android/app/google-services.json` in the project
4. **Project settings → Service Accounts tab** → **Generate new private key** → downloads a `.json` file (this is a real credential — handle it like a password)
5. Open that downloaded file in a text editor, copy its **entire contents** (the whole JSON object)
6. In Supabase → Edge Functions → Secrets, add: `FCM_SERVICE_ACCOUNT` = paste the entire JSON contents as the value
7. Redeploy `send-review-push` (no code change needed — the FCM-sending code already uses this modern approach, following the same JWT-based pattern as the APNs code for iOS)

Once that secret exists, Android push notifications go live immediately.

---

## Step 6 — Build the release bundle and submit

1. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**, using the keystore from Step 4
2. This produces a `.aab` file
3. In Play Console → your app → **Production → Create release** → upload the `.aab`
4. Fill in the store listing (screenshots, description, privacy policy URL — use `app.flow-daily.com/privacy.html`)
5. Submit for review

**Google's review is typically much faster than Apple's** — often hours to 1-2 days for a first submission.

---

## Realistic timeline from here

| Step | Time |
|---|---|
| Android Studio install | ~30 min (one-time) |
| Local test build on your phone | ~15 min |
| Play Developer account | usually same-day approval |
| Firebase + push wiring | ~30 min |
| Keystore generation | ~10 min (one-time, critical to back up) |
| Play Store review | hours – 2 days typically |

Everything here runs on hardware you already own — no cloud service, no waiting on anyone else's approval process except Google's review itself.
