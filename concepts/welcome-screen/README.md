# Welcome Screen Concept

**Status: concept only, NOT wired into the real app.** This is a standalone mockup, deliberately deferred to a future update rather than the first version — Abdul wanted to think it through more deeply rather than ship it half-finished.

Open `index.html` directly in any browser to preview it. It's fully self-contained (plain HTML/CSS, no build step, no dependencies) — nothing here depends on Flow's actual app code or any external tool.

## What it shows

A one-time first-open moment for brand-new sign-ups: a few seconds of animated night sky (twinkling stars at varying brightness/size, a couple of small loose clusters, two subtly color-tinted stars for realism), a shooting star, then "Welcome to Flow." fades up with a tagline, followed by a "Let's flow" button.

## Color decisions, as currently set

- **Shooting star**: hardcoded to Midnight Purple (`#3B0764`) — deliberately independent of everything else on the screen, by explicit request. Keep it purple regardless of what the rest of the screen's accent is set to.
- **Everything else** ("Flow." period, the button): currently orange (`#d4680a`), matching the real app's current free-tier accent. This was previously set to purple at one point during design exploration, then reverted back to orange — orange is the current intended state.

To change the accent, search for `#d4680a` in `index.html` — it appears twice (the period dot, the button background).

## Sequence, as currently timed

"Welcome to" appears first (`.3s`), then the tagline (`.6s`) — the layout space for "Flow." is already reserved (it's just invisible via `opacity:0`, still occupying its spot in the flex column), so nothing shifts when it later appears. The shooting star doesn't begin its journey until `1.3s` — after both are settled. It lands and fades out at `2.6s`, the exact moment "Flow." fades in. The button doesn't appear until `3.4s` — after Flow's own fade-in animation has fully finished (2.6s delay + .7s duration = 3.3s), giving it a beat to breathe before the button shows up. So the full order is: Welcome to → tagline → (pause) → star falls and delivers Flow → (pause) → button.

## Shooting star choreography

The star genuinely originates from outside the visible frame — not just faded in from an already-in-place, invisible starting point. It starts at `(-10px, -40px)` (above and to the left of the 390×844 frame entirely) and travels via `translate(205px, 409px)` at a `rotate(63deg)` angle, landing at roughly the frame's horizontal and vertical center — where the flex-centered text block places "Flow." given the frame's actual dimensions and font sizes. Since the outer frame has `overflow:hidden`, the star is physically clipped/invisible until its translated position actually crosses into the visible bounds, reinforcing the "falling in from outside the screen" feel rather than a soft fade-in trick. Timed to complete (`1.3s` duration + `1.3s` delay = `2.6s` total) at the exact same `animation-delay` the "Flow." text itself uses to fade in, so the hand-off is simultaneous.

If this needs retuning once actually previewed live (browser text rendering can shift the exact landing spot slightly): adjust the `translate()` end values in the `@keyframes shoot` rule and/or the star div's own `top`/`left` starting position — keep the starting position off-screen (negative values) to preserve the falling-in effect, and keep the animation duration/delay matched to "Flow."'s own `animation-delay` (currently `2.6s`) for the hand-off to still land correctly.

## History / how this evolved

Originally included a card explaining the moon button's tap-vs-hold gestures ("One button, two moves"). **That entire card has been removed** — the moon's hold gesture no longer exists in the real app (Settings moved to its own separate gear icon; see EDIT no.102 in the main repo's commit history). Since both the moon and the gear are now just plain, self-explanatory taps, there's nothing left that needs a discoverability explainer.

## If picking this up later

- The animation timing (fade-in delays, shooting star duration) is all in CSS `@keyframes` and `animation-delay` values at the top of the file — safe to retune without touching structure.
- If integrating into the real app: this would need to become a one-time screen shown only on a genuinely fresh sign-up (see `flow_first_open`-style logic patterns already used elsewhere in the app for "has this account seen X before" checks), with a real "Let's flow" button action that dismisses it and proceeds to the normal signed-in app.
- A prior version of this file lived only as a Claude Artifact (claude.ai) during design exploration — this repo copy is now the source of truth going forward.
