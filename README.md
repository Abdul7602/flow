# Flow

> Write naturally. Your day connects itself.

Flow is an AI-powered personal productivity PWA that unifies notes, tasks, and calendar in one place. Write anything in a note — dates, appointments, tasks — and Flow extracts and organises them automatically. No context switching, no separate apps.

---

## Features

1. **Three-tab layout** — Calendar, Notes, and Week view in a single iOS-style PWA, no switching between apps

2. **AI note parsing** — Claude API reads your note as you type and extracts tasks and appointments automatically after a short pause

3. **Default date to today** — tasks with no date mentioned are automatically assigned to today

4. **Smart deduplication** — re-parsing a note wipes and rewrites extracted tasks cleanly so edits like adding "at 5pm" update the existing task rather than creating a duplicate

5. **Manual checklists** — tap "+ Add item" inside any note to add your own checklist item alongside AI-extracted ones

6. **Task archiving** — when every task in a note is checked off, the note silently moves to archived and disappears from your live list

7. **Empty note auto-delete** — leaving a note blank and tapping back removes it instantly, no clutter

8. **Priority levels** — Normal, Priority, and Urgent tags on notes and tasks, shown as coloured badges and left-border accents on note cards

9. **10pm evening review** — a daily modal surfaces all unchecked tasks one by one with Done, Tomorrow, and Cancel options

10. **Configurable review time** — long-press the 🌙 moon button on Calendar to set your own daily review time; defaults to 10pm

11. **Task rollover** — postponed tasks move to the next day; urgent ones get downgraded to priority when rolled

12. **Reschedule by writing** — write in a note that something was moved (e.g. "dentist rescheduled to next Saturday") and Flow detects it, moves the existing task, and removes it from the old date

13. **Calendar view** — monthly grid with dots on days that have tasks, red dots for urgent; tap any day to see its events with checkboxes

14. **Check off from calendar** — tasks can be marked done directly from the calendar day view without opening the note

15. **Week view** — 7-day strip with per-day dots; tap any day to see an hour-by-hour timeline of events

16. **Pinned daily routine** — one permanent note that never archives, stays on top, and whose tasks appear on every day from today forward

17. **Daily routine auto-reset** — pinned tasks uncheck themselves each morning so the routine is always fresh

18. **Daily routine hidden from calendar dots** — routine tasks don't pollute the calendar dot indicators but are visible when you tap into a day

19. **Foreign timezone conversion** — mention a meeting in another city and Flow converts the time to your local device timezone, showing both e.g. `3pm (4pm Helsinki)`

20. **3-style "and" task splitting** — Claude confidently splits clearly independent tasks, keeps inseparable ones together, and leaves ambiguous ones combined for the user to split manually with "+ Add item"

21. **Address maps hyperlink** — locations in notes become tappable blue links that open Google Maps, with venue name as the short link text and street detail in grey alongside

22. **First body line as display title** — if a note has no title, the first line of body becomes the bold display title in the notes list, exactly like iOS Notes

23. **iOS Notes-inspired design** — pure white and black palette, system font, large bold titles, hairline dividers, circular today highlight in Claude orange

24. **Dark mode** — follows system setting automatically, no toggle needed, full iOS-accurate dark palette

---

## Stack

- **Frontend** — Single self-contained HTML file (React-free, vanilla JS)
- **AI** — Claude API (`claude-sonnet-4-20250514`) for natural language extraction, reschedule detection, and timezone resolution
- **Storage** — `localStorage` (backend / cloud sync coming later)
- **Hosting** — GitHub Pages

---

## Roadmap

- [ ] User accounts + cloud sync
- [ ] Real push notifications and daily review calls (Twilio)
- [ ] Backend API proxy (secure Claude API key)
- [ ] Multi-device support
- [ ] Backend architecture (Node.js + Supabase + PostgreSQL)

---

## Local development

Just open `index.html` in a browser. No build step, no dependencies.

For the Claude API to work you'll need to supply your own API key via the Anthropic platform.

---

*Built with Claude — github.com/Abdul7602/flow*
