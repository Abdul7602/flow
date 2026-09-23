# Welcome Screen Concept

**Status: concept only, NOT wired into the real app.** This is a standalone mockup, deliberately deferred to a future update rather than the first version — Abdul wanted to think it through more deeply rather than ship it half-finished.

Open `index.html` directly in any browser to preview it. It's fully self-contained (plain HTML/CSS, no build step, no dependencies) — nothing here depends on Flow's actual app code or any external tool.

## What it shows

A one-time first-open moment for brand-new sign-ups: a few seconds of animated night sky (twinkling stars at varying brightness/size, a couple of small loose clusters, two subtly color-tinted stars for realism), a shooting star, then "Welcome to Flow." fades up with a tagline, followed by a "Let's flow" button.

## Color decisions, as currently set

- **Shooting star**: hardcoded to Midnight Purple (`#3B0764`) — deliberately independent of everything else on the screen, by explicit request. Keep it purple regardless of what the rest of the screen's accent is set to.
- **Everything else** ("Flow." period, the button): currently orange (`#d4680a`), matching the real app's current free-tier accent. This was previously set to purple at one point during design exploration, then reverted back to orange — orange is the current intended state.

To change the accent, search for `#d4680a` in `index.html` — it appears twice (the period dot, the button background).

## History / how this evolved

Originally included a card explaining the moon button's tap-vs-hold gestures ("One button, two moves"). **That entire card has been removed** — the moon's hold gesture no longer exists in the real app (Settings moved to its own separate gear icon; see EDIT no.102 in the main repo's commit history). Since both the moon and the gear are now just plain, self-explanatory taps, there's nothing left that needs a discoverability explainer.

## If picking this up later

- The animation timing (fade-in delays, shooting star duration) is all in CSS `@keyframes` and `animation-delay` values at the top of the file — safe to retune without touching structure.
- If integrating into the real app: this would need to become a one-time screen shown only on a genuinely fresh sign-up (see `flow_first_open`-style logic patterns already used elsewhere in the app for "has this account seen X before" checks), with a real "Let's flow" button action that dismisses it and proceeds to the normal signed-in app.
- A prior version of this file lived only as a Claude Artifact (claude.ai) during design exploration — this repo copy is now the source of truth going forward.
