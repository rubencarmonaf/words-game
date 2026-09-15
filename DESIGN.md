# Design

<!-- impeccable:design-schema 1 -->

## World

**Red de Metro Nocturna** (Midnight Transit Network). WordWars reads as a live transit diagram: the shared prefix is the interchange station, every valid word is a stop further down your line, ELO tiers and game modes are named colored lines, a live match is a train in transit. Chosen over the seed's assigned "newsprint puzzle page" direction after a challenger-fusion round (seed key `a8862afe`) — the transit-diagram grammar (live service states, route topology) fits the product's real-time/competitive core better than newsprint's static/daily-ritual connotation. Full replacement of the prior "editorial lima" landing identity, extended to every screen.

Full direction contract: `.impeccable/surfaces/client-index-html.md`.

## Color

Strategy: **Full palette, 4 named roles** — each accent color is tied to game semantics, not decorative choice.

```
--ww-bg:            #0a1628   midnight-enamel background
--ww-bg-2:           #0d1c33
--ww-surface:        #11233f  card/panel fill
--ww-surface-2:      #152947  hover/elevated fill
--ww-line:           rgba(178,198,224,.14)   hairline rule
--ww-line-strong:    rgba(178,198,224,.28)   stronger hairline / border
--ww-text:           #f1efe7  porcelain — primary text
--ww-muted:          #a3b4cc  secondary text
--ww-faint:          #7183a3  tertiary text (≥4.5:1 on --ww-bg)
--ww-accent:         #f5a623  amber — primary CTA / focus / links (alias of --line-amber)
--ww-accent-ink:     #0a1628  text on amber
--ww-radius:         14px     shared corner radius (cards, panels)

--line-scarlet:      #cc3f52  Versus / Cadena (competitive) · critical/danger states
--line-cobalt:        #4a90e2  structural / navigation / default line
--line-amber:         #f5a623  Reto diario · time-critical · primary accent
--line-lime:          #5fd97a  Solo / Con amigos (casual) · success states
```

`--line-scarlet` is intentionally darker than a typical "bright red" so white button text on a solid scarlet fill clears 4.5:1 (it was `#ef4a5f` during early Phase 1, darkened in the Phase 4 accessibility pass).

## Type

```
--ww-serif:  'Overpass', 'Arial Narrow', sans-serif    — display/headings (transit-signage heritage face)
--ww-sans:   'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif  — body/UI
--ww-mono:   'IBM Plex Mono', 'Courier New', monospace  — numeric readouts only (timer, ELO, scores, station codes)
```

Headline scale is mixed-case (not uppercase) for legibility at display sizes; uppercase is reserved for short labels (buttons, nav, badges, the footer wordmark).

## Components

- **`.line-rule` / `.station-tick` / `.board-badge` / `.platform-panel`** (`client/styles.css`, "FUNDAMENTOS" section) — the shared primitives every screen builds on: a colored rail segment, a stop marker, a departure-board-style numeric tag, and a nested panel surface.
- **Mode/color pairing**: Solo & Validación RAE → cobalt · Versus & Cadena → scarlet · Reto diario → amber · Con amigos/Crear lobby → lime. Applied consistently on the landing's mode cards and the menu's mode buttons via a top 3px indicator strip (`--card-accent` custom property per `--*-scarlet/amber/lime` modifier class) — deliberately not a left border, which is a banned pattern; the top strip reads as a line-color tab, earned by the transit-line brief.
- **Cards/panels**: one elevation method only — border-only for full-screen containers (`.auth-content`, `.menu-content`, etc.) and shared card grids; shadow-only for floating layers (modals). Radius fixed at `var(--ww-radius)` (14px), within the 12–16px floor.
- **Route panel** (`.ww-route-panel` + `.ww-route-line` + `.ww-route-versus`): the landing hero's signature device — a live match rendered as stops on a line with an animated arrival sequence (`ww-lane-fill`, `scaleX` not `width`) and a pulsing "in transit" tick, added in the Phase 1b motion pass.
- **Buttons**: `.btn` (app-wide) and `.ww-btn` (landing) share the same geometry (8–13px radius, uppercase, tracked) and color roles. Exactly one colored glow shadow is kept as the authored moment — the landing hero's primary CTA (`.ww-btn--primary`); every other button/card/badge uses neutral dark elevation shadows instead of colored glows, per the finish-pass cleanup in Phase 4.
- **Roundels** (`.ww-roundel`, `.ww-cta-tiles span`): circular badges styled after transit-map station roundels, used for the hero's floating letter accents and the closing CTA's "JUEGA" lettering.

## Motion

One authored moment on the flagship surface (the hero route panel's arrival sequence), plus scroll-reveal fades on section entry and a small live-state pulse on the in-progress station tick. No hover-shimmer or scattered decorative motion — removed deliberately in Phase 1.

## Known gaps / deferred work

- The mode-card grids (landing + menu) still follow an icon-above-heading-above-text structure the design detector flags as the generic "card" template. It reads as differentiated in practice (real per-mode color, real icons, real varied copy) but a genuine structural alternative wasn't explored — candidate for a future pass, not fixed in this build.
- A `border-radius`-and-`overflow: hidden` combination on `.ww-landing` (needed to prevent the full-bleed layout trick from causing horizontal scroll) clips positioned children at extreme viewport sizes; not observed to cause visible clipping in the tested viewports.
- Legacy pre-redesign CSS (`#667eea` / `#ff6b6b` gradients, `.feature-card`, base `.btn-primary`/`.btn-danger` declarations before the dark-theme override) remains in `client/styles.css`, fully overridden by cascade and confirmed not visually live, but not deleted — dead-code removal was out of scope for a visual redesign pass.
- The design-quality detector reports ~90 "low-contrast" findings against a `#f1f6fd` background on the standalone legal/utility pages (privacidad, terminos, aviso-legal, cookies, contacto, gracias, 404); this does not match any color in the system and is contradicted by direct screenshot verification of every one of those pages (dark background, correct high-contrast text). Treated as a detector/tooling artifact in resolving the multi-layer `body` background gradient for non-SPA pages, not a real defect.
