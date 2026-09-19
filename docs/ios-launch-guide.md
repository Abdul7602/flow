# Flow — iOS App Store Launch Guide

Written for a Windows-only setup with no Mac — all builds run on Codemagic's cloud Macs, triggered from your browser.

---

## Where things actually stand

- ✅ Apple Developer account — enrolled, verified, tax forms done
- ✅ App Store Connect app created (`Flow-Daily`, numeric Apple ID `6809710060`, bundle ID `com.flowdaily.app`)
- ✅ **Codemagic build pipeline works end-to-end** — archive, export, upload to App Store Connect, and TestFlight group assignment all succeed
- ✅ Push Notifications entitlement added to the Xcode project (`App.entitlements`, `aps-environment=production`) and enabled on the App ID in Apple Developer Portal
- ✅ Provisioning profile ("Flow App Store Profile") regenerated to include both In-App Purchase and Push Notifications capabilities
- ✅ First-ever real-device testing done: found and fixed an iOS WKWebView long-press bug (moon icon → Settings)
- ✅ Both subscription products created (`flow_premium_monthly` €4.99/14-day trial, `flow_premium_yearly` €49.99/no trial)
- ✅ RevenueCat connected to App Store Connect (API key + App Store Server Notifications configured)
- ✅ **Real sandbox purchase confirmed successful** on TestFlight (Monthly, full purchase→entitlement flow worked)
- ⬜ Push notification toggle not yet re-tested since the entitlement fix (should work now, unconfirmed)
- ⬜ Both subscriptions not yet submitted for App Store review — deliberately held back pending full validation
- ⬜ App Store listing metadata (age rating, screenshots, full description) — not started, not needed until real public submission

---

## The five real bugs that were actually blocking this for weeks, and their fixes

If a future build breaks in a similar way, these are the patterns to check first:

**1. Provisioning profile never found ("Did not find matching provisioning profiles")**
Root cause: `codemagic.yaml` used `environment: groups: [ios_signing]` — an environment **variable group** with that name, created earlier by mistake to fix an unrelated error. Codemagic actually has a *reserved* YAML key also named `ios_signing:` (with `distribution_type` and `bundle_identifier` sub-fields) that's the real mechanism `xcode-project use-profiles` needs to search your account's Code Signing Identities. The variable group did nothing for signing at all.
**Fix:** use the real key:
```yaml
environment:
  ios_signing:
    distribution_type: app_store
    bundle_identifier: com.flowdaily.app
```

**2. "RevenueCat_RevenueCat does not support provisioning profiles"**
Root cause: a manual `xcodebuild archive` command applied `CODE_SIGN_STYLE=Manual` globally to *every* target being built, including RevenueCat's own Swift Package framework (a library, which should never carry a provisioning profile).
**Fix:** use `xcode-project build-ipa` (the Codemagic wrapper) instead of a hand-rolled `xcodebuild` command — it correctly scopes manual signing to only the actual App target.

**3. Build number collision ("bundle version must be higher than previously uploaded")**
Root cause: the auto-increment step checked `get-latest-app-store-build-number`, which only considers builds released to the **public** App Store (always 0, since Flow has never been public) — so it kept recomputing "1" and colliding with the already-uploaded TestFlight build.
**Fix:** use `get-latest-build-number` (considers TestFlight + App Store together) with the app's real **numeric** Apple ID, not the bundle identifier string:
```yaml
agvtool new-version -all $(($(app-store-connect get-latest-build-number "$APP_STORE_APPLE_ID") + 1))
```

**4. "Cannot add internal group to a build"**
Root cause: the TestFlight internal group had "Enable automatic distribution" turned ON — which, per multiple confirmed reports, causes Apple's API to reject Codemagic's *explicit* "add build to group" call. This setting can't be changed after a group is created.
**Fix:** create a new group with automatic distribution **OFF** — this repo uses one named `CI Testers` (not "Internal Testers," which remains broken for CI use).

**5. Export Compliance blocking group assignment**
A build can upload and process successfully, then still fail group assignment until the app answers Apple's encryption question.
**Fix:** `ITSAppUsesNonExemptEncryption = false` in `Info.plist` (Flow only uses standard HTTPS/TLS, which is exempt) — this auto-skips the question for every future build.

---

## Push notifications — what was missing and how it was fixed

The `ios/` project had **no `.entitlements` file at all** — meaning Push Notifications was never actually enabled as an Xcode capability, even though the JS/plugin code was correct. This can cause push permission/registration to silently fail on a real device.

**Fixed via:**
1. Created `ios/App/App/App.entitlements` with `aps-environment = production`
2. Wired `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` into both Debug and Release build configs in `project.pbxproj`
3. Enabled "Push Notifications" capability on the App ID in Apple Developer Portal
4. Regenerated "Flow App Store Profile" to pick up both capabilities

**Backend side (separate from the above, already done earlier):** `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID` secrets are set in Supabase, and `send-review-push` already contains the full APNs JWT-signing/delivery logic.

**Status: fix is in place, not yet re-confirmed working on a real device since the entitlement fix.** This is the next thing to test.

---

## Subscriptions — current state

Both products exist in App Store Connect, RevenueCat is connected (App Store Connect API key + Server Notifications configured), and both are attached to the same `flow_daily_pro` entitlement and the `default` offering (same offering Android uses — one offering serves both platforms' correct product automatically). A real sandbox purchase on Monthly has been confirmed successful end-to-end.

**Not yet done:** exhaustive renewal/cancellation testing (Apple's sandbox is known to be flaky/slow for this across the industry — not unique to Flow, and lower priority since the core purchase mechanic is already proven). Neither subscription has been submitted for App Store review yet.

**Full setup reference:** see `docs/subscriptions-setup.md` for the complete step-by-step (shared doc covering both platforms).

---

## What's left before an actual public App Store submission

1. Re-test push notification toggle on a fresh TestFlight build (entitlement fix should resolve it, unconfirmed)
2. Decide whether to pursue deeper subscription lifecycle testing or accept current validation as sufficient (matches the bar Android was held to)
3. Fill in App Store listing metadata: age rating, screenshots, full app description, keywords
4. Create an actual **App Store version** (separate from TestFlight) in App Store Connect and attach both subscriptions to it — this is required, since subscriptions cannot be submitted for review independently of an app version
5. Submit the app version + both subscriptions together for Apple's review
6. Apple review turnaround: typically 1-3 days

None of this is blocked by hardware — everything still happens in a browser via Codemagic and App Store Connect.
