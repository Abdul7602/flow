# Sign in with Apple + Google — setup (EDIT no.124)

The sign-in screen now offers:

| Where | Apple | Google | Email code |
|---|---|---|---|
| iPhone app | ✅ native sheet | ✅ native sheet | ✅ |
| Android app | — (see note) | ✅ native account picker | ✅ |
| Website (app.flow-daily.com) | — | ✅ redirect | ✅ |

- Apple and Google sign-in send **no email**. The email code stays as the backup (and the reviewer password login is unchanged).
- Same email = same Flow account. If someone signed up by email code and later taps Google with the same Gmail, Supabase links it to the existing account (same notes, same subscription).
- Apple is iPhone-only. Apple's rule (Guideline 4.8) only applies to the iOS app. A user who picks "Hide My Email" on iPhone gets an `@privaterelay.appleid.com` address and can only get back in on iPhone. Adding Apple to Android and the website later needs an Apple "Services ID" plus a secret key that has to be renewed every 6 months, so it's left out for now.
- **The Google button stays hidden** until the client IDs are filled in at the top of the sign-in code in `index.html` (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`). The Apple button shows in the iPhone app as soon as the build has the plugin.
- The code uses the plugin `@capgo/capacitor-social-login` (pinned at 8.5.16). Each sign-in uses a nonce, and the ID token goes to `supa.auth.signInWithIdToken`.
- **Account deletion:** for Apple accounts, the app asks for one more Apple confirmation, then `delete-account` revokes the Apple sign-in, as Apple requires. If revoking fails, the account is still deleted.

Do the steps in this order. Values in `code` are exact.

---

## 1. Google Cloud: create the OAuth clients

Use the **same Google Cloud project as Firebase (`flow-22ea5`)**. Go to console.cloud.google.com, pick the project at the top, then open **Google Auth Platform**.

1. **Branding:**
   - App name `Flow`
   - User support email: yours
   - Logo optional (adding one triggers a brand review)
   - Authorized domains: `flow-daily.com` and `supabase.co`
   - Developer contact: yours
2. **Audience:** User type **External**, then **Publish app** (In production). For just email/profile there is no Google verification. While in Testing, only listed test users can sign in.
3. **Data access:** the default scopes are enough (`openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`).
4. **Clients → Create client.** Make 3 kinds:

   **a) Web application**, named `Flow Web (Supabase)`:
   - Authorized JavaScript origins: `https://app.flow-daily.com`
   - Authorized redirect URIs: `https://aqtnelbqkwtrbqbpzuut.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and the **Client secret**.

   **b) Android.** Make one client per SHA-1 fingerprint, all with package name `com.flowdaily.app`:
   - **Play App Signing key:** Play Console → Flow → Test and release → App integrity → App signing → *App signing key certificate* → SHA-1. Store installs are signed with this key.
   - **Upload key:** same page, *Upload key certificate* → SHA-1. This is your keystore, used for signed APKs you install yourself.
   - **Debug key** (for Run ▶ from Android Studio). In a terminal:
     `keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android`
     Copy the SHA1 line.
   - These Android clients have no ID to copy. They only tell Google "this app is allowed".

   **c) iOS**, named `Flow iOS`:
   - Bundle ID `com.flowdaily.app`
   - Team ID `32U99TJCDY`
   - App Store ID `6809710060`
   - Copy the **Client ID**. It looks like `1234-abc.apps.googleusercontent.com`. Its reversed form `com.googleusercontent.apps.1234-abc` becomes the iPhone app's URL scheme.

➡️ **Send Claude:** the Web client ID and the iOS client ID. Never send the client secret; that only goes into Supabase.

## 2. Apple Developer: enable Sign in with Apple

1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → `com.flowdaily.app`. Tick **Sign In with Apple**, choose *Enable as a primary App ID*, then **Save**. Apple will warn that the provisioning profiles become invalid.
2. **Profiles:** delete (or leave to Codemagic) the old *App Store* profile for `com.flowdaily.app` that is now marked Invalid. Codemagic's automatic signing creates a fresh one with the new capability on the next build.
3. **Keys → +** → name `Flow Sign in with Apple` → tick **Sign in with Apple** → Configure → primary App ID `com.flowdaily.app` → Save → Continue → Register.
   - **Download the .p8 file. You can only download it once.**
   - Note the **Key ID**.
   - Back it up next to the APNs key. This key is only used to revoke Apple sign-ins when an account is deleted.

## 3. Supabase: turn the providers on

Dashboard → project → **Authentication → Sign In / Providers**.

**Google:** Enable.
- **Client IDs:** `<WEB_CLIENT_ID>,<IOS_CLIENT_ID>`, web first, comma, no spaces.
- **Client Secret (for OAuth):** the Web client secret.
- **Skip nonce checks:** OFF.
- Save.

**Apple:** Enable.
- **Client IDs:** `com.flowdaily.app`.
- **Secret Key (for OAuth):** leave empty. It's only for web Apple sign-in, which isn't used.
- Save.

**Authentication → URL Configuration → Redirect URLs:** make sure `https://app.flow-daily.com/**` is listed (website Google sign-in comes back there).

**Edge Function secrets** (Project Settings → Edge Functions → Secrets), for Apple revocation on account deletion:
- `APPLE_TEAM_ID` = `32U99TJCDY`
- `APPLE_SIGNIN_KEY_ID` = the Key ID from step 2.3
- `APPLE_SIGNIN_PRIVATE_KEY` = the full text of the .p8 file (missing BEGIN/END lines are repaired automatically)

Then deploy the function: `npx supabase functions deploy delete-account --no-verify-jwt`

Optional, for fewer confused users: **Authentication → Emails → Magic Link** template. The app now uses only the code, so make `{{ .Token }}` big and drop the link.

## 4. Code (Claude does this once the client IDs arrive)

- Fill `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` in `index.html` / `www/index.html` on main, android and ios.
- ios branch: add the reversed iOS client ID as a URL scheme in `ios/App/App/Info.plist`. The entitlement `com.apple.developer.applesignin` is already in `App.entitlements`.

## 5. Build and test

**Android** (in `C:\dev\flow`, on `android`):
1. `git pull`
2. `npm install` (adds the plugin)
3. `npx cap sync android`
4. Run ▶ on the phone and test:
   - Google with a new Gmail (a new account is made)
   - Google with abdulmikaeel55@gmail.com (lands in the existing account)
   - Email code
   - Sign out, then sign in again (the account picker shows)
5. Only then do the signed bundle → closed testing → production.

**iOS:** Codemagic build from `ios`. On TestFlight, test:
- Apple (new account)
- Apple with "Hide My Email"
- Google
- Email code
- Delete an Apple account. It asks for Apple once more; the Supabase function log shows `apple revoke: revoked`.

**Website:** Google redirect sign-in works once Supabase is set up and the web client ID is in `main`.

## Troubleshooting

| What you see | Cause / fix |
|---|---|
| Android `[28444] Developer console is not set up correctly` | The SHA-1 of the installed build isn't on an Android client, or the Web client ID is wrong. Debug runs need the debug SHA-1; Play installs need the App signing SHA-1. Changes can take minutes to hours. |
| "Unacceptable audience in id_token" | That client ID is missing from Supabase → Google → Client IDs. |
| "Nonces mismatch" | Supabase "Skip nonce checks" can stay OFF. The app always sends a matching nonce. If this appears, tell Claude. |
| iPhone Google sheet crashes or says a URL scheme is missing | The reversed iOS client ID isn't in Info.plist yet. |
| iPhone Apple sign-in fails with error 1000 | The build's provisioning profile lacks Sign in with Apple. Check step 2.1–2.2 and rebuild. |
