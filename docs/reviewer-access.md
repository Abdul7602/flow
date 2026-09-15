# Flow — App Store Reviewer Login

**Why this exists:** Flow's normal login is passwordless (email + one-time code). Apple and Google's app reviewers can't receive that code anywhere you can see it in real time, so without this, you'd have to personally watch your inbox during their review window and have no way to relay the code to them anyway. This gives the reviewer a self-service way to log in — no waiting on you.

**How it works, in one sentence:** typing the exact email `reviewer@flow-daily.com` into the login screen swaps the normal "send code" button for a password field, which signs in via Supabase's standard password authentication instead of OTP. Every other email is completely unaffected — this never touches the normal login path.

**Where the actual password lives:** nowhere in this codebase. It's set directly in Supabase's Auth system (hashed, server-side) and told to Google/Apple only through Play Console / App Store Connect's private review-notes field — never committed to git, never visible in the app's source.

---

## One-time setup (do this before submitting for review)

### 1. Create the reviewer account in Supabase
1. Supabase Dashboard → **Authentication → Users** → **Add user**
2. Email: `reviewer@flow-daily.com`
3. Set a real password — use a password manager to generate a strong one, don't reuse anything
4. **Auto Confirm User:** turn this on, so the account doesn't need its own email confirmation step

### 2. Confirm the account works end-to-end
Since this account is created directly (not through the normal signup flow), double check:
- Does opening the app and logging in as `reviewer@flow-daily.com` work correctly?
- Does a `settings` row exist for this user (check Supabase → Table Editor → `settings`)? If your schema auto-creates this via a trigger on new-user signup, confirm it fired for this manually-created account too — if not, manually insert one row so the reviewer doesn't hit a broken/empty state.

### 3. Give Google the password
In Play Console's app content questionnaire → **App access** → provide these instructions:

```
This app uses passwordless email login for regular users. For review purposes,
a dedicated test account is provided:

Email: reviewer@flow-daily.com
Password: [the password you set in step 1]

On the login screen, enter this email — a password field will appear
automatically instead of the usual one-time code flow.
```

(Same approach applies to App Store Connect's equivalent review-notes field if/when iOS submission happens.)

---

## Removing it cleanly, once no longer needed

This was built to be fully reversible with no trace left behind. Three small deletions, in `index.html`:

1. **Delete the HTML block** — the `<input id="reviewer-password">` line and its two bracketing `<!-- ⭐ REVIEWER-ONLY LOGIN ... -->` comment lines
2. **Revert the email input** — remove ` oninput="checkReviewerEmail()"` from the `<input id="auth-email">` line, restoring it to plain
3. **Delete the JS block** — everything between `// ⭐ REVIEWER-ONLY LOGIN ...` and `// ⭐ END REVIEWER-ONLY LOGIN JS ⭐` (includes `REVIEWER_EMAIL`, `checkReviewerEmail()`, `reviewerSignIn()`)

Then, separately in Supabase: **Authentication → Users → delete the `reviewer@flow-daily.com` account** (and its `settings` row, if you want a fully clean slate — though an orphaned row with no login access is harmless either way).

No other file, function, or system needs touching — this feature was deliberately kept isolated from `claude-proxy`, RevenueCat, push notifications, and every other part of Flow.
