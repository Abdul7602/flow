# Flow

> Write naturally. Your day connects itself.

Flow is an AI-powered personal productivity app that unifies notes, tasks, and calendar in one place. Write anything in a note — dates, appointments, tasks — and Flow extracts and organises them automatically. No context switching, no separate apps.

**Live at:** [app.flow-daily.com](https://app.flow-daily.com)

---

## Status

- ✅ **Live, multi-user, in production** as an installable PWA (iOS + Android)
- ✅ **iOS native app wrapped** (Capacitor) — in TestFlight/App Store submission process
- ⬜ Android native app (Play Store) — planned once broader testing is done
- 📄 See `docs/` for setup guides and tunable settings

---


<p align="center">
  <img src="images/Flow-note.png" alt="Flow Timeline Concept" width="100%">
</p>

## Features

1. **Three-tab layout** — Calendar, Notes, and Week view in a single iOS-style app, no switching between apps
2. **AI note parsing** — Claude API reads your note as you type and extracts tasks and appointments automatically after a short pause
3. **Default date to today** — tasks with no date mentioned are automatically assigned to today
4. **Smart deduplication** — re-parsing a note wipes and rewrites extracted tasks cleanly so edits like adding "at 5pm" update the existing task rather than creating a duplicate
5. **Manual checklists** — tap "+ Add item" inside any note to add your own checklist item alongside AI-extracted ones
6. **Task archiving** — when every task in a note is checked off, the note silently moves to archived and disappears from your live list
7. **Empty note auto-delete** — leaving a note blank and tapping back removes it instantly, no clutter
8. **Priority levels** — Normal, Priority, and Urgent tags on notes and tasks
9. **Configurable evening review** — a daily modal surfaces all unchecked tasks with Done, Tomorrow, and Cancel options, at a time you choose (long-press the 🌙 on Calendar)
10. **Task rollover** — postponed tasks move to the next day; urgent ones get downgraded to priority when rolled
11. **Reschedule by writing** — write in a note that something was moved (e.g. "dentist rescheduled to next Saturday") and Flow detects it, moves the existing task, and removes it from the old date
12. **Calendar & Week views** — dots on days with tasks, tap through to see and check off tasks directly
13. **Pinned daily routine** — one permanent note whose tasks appear on every day from today forward, auto-resetting each morning
14. **Foreign timezone conversion** — mention a meeting in another city and Flow converts the time to your local device timezone
15. **3-style "and" task splitting** — Claude confidently splits clearly independent tasks, keeps inseparable ones together, and leaves ambiguous ones combined for manual splitting
16. **Address maps hyperlink** — locations in notes become tappable links that open Google Maps
17. **Note search** — expandable search bar filters notes by title, body, and task text
18. **Swipe-to-delete** — iOS Notes-style swipe gesture on note cards
19. **Dark mode** — follows system setting automatically
20. **Push notifications** — real daily review reminders, delivered via Web Push (browser/PWA) or APNs (native iOS app)
21. **Multi-user accounts** — email + magic link/OTP login, each user's data isolated via Row Level Security
22. **Self-service account deletion** — one tap in settings permanently erases all of a user's data
23. **Monthly usage cap** — protects against runaway AI costs, with visible usage tracking in settings

---

## Stack

- **Frontend** — Single self-contained HTML/JS file, wrapped natively for iOS via **Capacitor**
- **Backend** — **Supabase**: PostgreSQL (with Row Level Security), Auth (magic link + OTP), Edge Functions
- **AI** — Claude API (Haiku 4.5) via a secure Edge Function proxy — the API key never touches the client
- **Email** — Resend, sending from a verified custom domain
- **Hosting** — GitHub Pages, served through a custom domain (Cloudflare DNS)
- **Push** — Web Push (VAPID) for browser/PWA, APNs for the native iOS app
- **CI/CD (iOS)** — Codemagic (cloud Mac builds → TestFlight → App Store), since local development is Windows-only

---

## Repository layout

```
index.html                    the entire app (frontend)
sw.js                          service worker (offline shell, push handling)
manifest.json                  PWA manifest
privacy.html                   privacy policy page
capacitor.config.json          native app wrapper config
ios/                            generated Xcode project (Capacitor)
www/                            web assets copied in for the native build
codemagic.yaml                  cloud iOS build recipe
supabase/functions/
  claude-proxy/                 secure AI extraction proxy + usage cap
  send-review-push/             daily notification sender (Web Push + APNs)
  delete-account/                self-service account deletion
supabase-*.sql                  database schema files (run in Supabase SQL Editor)
docs/
  key-settings.md                quick-reference for every tunable value
  usage-cap.md                    how to adjust the AI cost cap
  ios-launch-guide.md             full path from Apple enrollment to App Store
```

---

## Roadmap

- [ ] Native push fully wired end-to-end (code is done — waiting on Apple Developer account approval to generate APNs credentials)
- [ ] App Store submission
- [ ] Play Store submission (Android device now available for testing)
- [ ] Deferred: "Flow Memory" — ask questions across all your notes
- [ ] Deferred: image-based task extraction (attach a photo, extract tasks from it)
- [ ] Deferred: smart trip clustering (batch same-location tasks)

---

## Local development

Open `index.html` directly, or serve the repo root with any static server. The app talks to a live Supabase backend — there is no separate local backend to run. AI extraction requires the Supabase Edge Functions to be deployed with a valid Anthropic API key set as a secret.

For the native iOS build: `npm install`, then `npx cap sync ios`, then build via Xcode or Codemagic (see `docs/ios-launch-guide.md`).

---

*Built with Claude — [github.com/Abdul7602/flow](https://github.com/Abdul7602/flow)*
