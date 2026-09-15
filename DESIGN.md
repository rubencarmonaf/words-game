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
- **Mode/color pairing**: Solo & Validación RAE → cobalt · Versus & Cadena → scarlet · Reto diario → amber · Con amigos/Crear lobby → lime. On the menu (Operate context) this reads as a top 3px indicator strip on each mode button (`--card-accent` custom property per `--*-scarlet/amber/lime` modifier class) — deliberately not a left border, which is a banned pattern. On the landing (Persuade context) the same roles drive `.ww-route-map`, a connected line diagram (continuous `.ww-route-map-connector` rail + `.station-tick` stops, icon inline with heading) rather than a grid of cards — replaces the original card-grid layout, which the design detector correctly flagged as the generic "icon above heading" template.
- **Cards/panels**: one elevation method only — border-only for full-screen containers (`.auth-content`, `.menu-content`, etc.) and shared card grids; shadow-only for floating layers (modals). Radius fixed at `var(--ww-radius)` (14px), within the 12–16px floor.
- **Route panel** (`.ww-route-panel` + `.ww-route-line` + `.ww-route-versus`): the landing hero's signature device — a live match rendered as stops on a line with an animated arrival sequence (`ww-lane-fill`, `scaleX` not `width`) and a pulsing "in transit" tick, added in the Phase 1b motion pass.
- **Buttons**: `.btn` (app-wide) and `.ww-btn` (landing) share the same geometry (8–13px radius, uppercase, tracked) and color roles. Exactly one colored glow shadow is kept as the authored moment — the landing hero's primary CTA (`.ww-btn--primary`); every other button/card/badge uses neutral dark elevation shadows instead of colored glows, per the finish-pass cleanup in Phase 4.
- **Roundels** (`.ww-roundel`, `.ww-cta-tiles span`): circular badges styled after transit-map station roundels, used for the hero's floating letter accents and the closing CTA's "JUEGA" lettering.

## Motion

One authored moment on the flagship surface (the hero route panel's arrival sequence), plus scroll-reveal fades on section entry and a small live-state pulse on the in-progress station tick. No hover-shimmer or scattered decorative motion — removed deliberately in Phase 1.

**Phase 6 (motion pass)** extended real gameplay screens, found via `find-animation-opportunities` and gated one-by-one against frequency/purpose/speed/function before building:
- Global press feedback (`:active { transform: scale(0.97) }`, 140ms) on every `.btn`/`.ww-btn` — previously only `.back-btn` had one.
- Word chips arrive rather than teleport: `UI.syncWordItems()` appends only the new item (`.word-item--enter`, reuses `ww-stop-arrive` at 220ms) instead of rebuilding the whole list on every submission — fixed in both the live game and the daily challenge, which had duplicated the same rebuild-from-scratch code.
- Rejected words get a 220ms input shake (`.word-input--shake`) alongside the existing toast, auto-clearing after 900ms.
- Matchmaking's generic spinner became `.ww-search-track` — a dot sweeping a rail, with the status line cycling through phrases ("Buscando línea disponible…", "Confirmando andén…") every 2.6s. This is the one surface with real dead time and no functional reading task, so it carries more motion/copy budget than anywhere else in Operate territory.

Rejected in the same pass: animating the per-second game timer (functional data, too frequent), and a "travel between stations" screen-transition redesign (current 0.3s fade is already correctly calibrated for how often screen nav fires — more motion there would slow the app down, not bring it to life).

**Phase 7 (victory sequence)** — the one signature "delight" moment in the whole app, reserved for the rarest, highest-emotion surface (game win) per the Rare/first-time tier of the motion gate. Built after direct user feedback that the redesign, despite the transit metaphor, had no comparable moment to a Duolingo-style victory celebration. `UI.showResults()` now takes a `won: boolean` (solo mode always wins; multiplayer compares the top scorer against the local player) and, on a win, prepends a `#ww-victory` overlay to the results card:
- **Route-line draw** — an SVG path (`.ww-victory-path`, `stroke-dasharray`/`-dashoffset` matched to the measured path length) draws itself over 650ms, arriving at a roundel that lights lime with a checkmark (`.ww-victory-roundel--lit`) — the match's route arriving at its terminal station.
- **Split-flap score reveal** — once the line lands, each score digit is a mechanical departure-board flap (`.ww-flap` / `.ww-flap-strip`, a 10-cell vertical reel moved via `translateY(-N*10%)`) that spins to the final number, staggered 90ms per digit.
- **Particle burst** — 16 small dots/dashes in the four line colors fire outward from the roundel in a circular spread (randomized angle/distance/delay per particle) and fade over 900ms, then are removed from the DOM — a burst built from the system's own shapes (roundel dots, line dashes), not generic confetti.
- Full `prefers-reduced-motion` fallback: line pre-drawn, roundel pre-lit, flaps set directly to their final digit, particles skipped entirely.
- One-time authoring bug caught during build: the line-draw `animation:` property referenced a `@keyframes ww-victory-draw` rule that was never actually written, so the path stayed stuck at full offset indefinitely; fixed by adding the missing keyframe and correcting the dasharray/dashoffset from a guessed 420 to the measured 324px path length.

## Known gaps / deferred work

- The menu's mode buttons (`.mode-btn`) still follow an icon-above/beside-heading structure the design detector flags as the generic "card" template. This is a deliberate call, not an oversight: the menu is an Operate surface (choosing a mode to start), where the floor's own guidance ("scanability... outrank expression") favors a clear, conventional button grid over an inventive structure. The landing's equivalent section (Persuade context, where distinctiveness matters more) was restructured into `.ww-route-map` — a connected line diagram, not a card grid — specifically to resolve this.
- A `border-radius`-and-`overflow: hidden` combination on `.ww-landing` (needed to prevent the full-bleed layout trick from causing horizontal scroll) clips positioned children at extreme viewport sizes; not observed to cause visible clipping in the tested viewports.
- Most legacy pre-redesign CSS (the entire original pre-"ww-" landing page: `.landing-content`, `.hero-section`, `.feature-card`, `.steps-container`, etc. — none of it referenced by any current HTML) was deleted in the closing pass, after verifying each selector against every HTML file. A recheck of the remaining hardcoded `#667eea`/`#ff6b6b` instances caught one real bug this way — `.timer-danger` (the game screen's critical-time state) was still using the old red via `!important`, with no dark-theme override to catch it; fixed to `var(--line-scarlet)`. A residual ~20 instances remain, individually confirmed dead (verbatim-duplicated selectors overridden later in the cascade) but not deleted — low value, and deletion of duplicate rules (vs. wholesale unused blocks) carries more risk for no visual change.
- The design-quality detector reports ~90 "low-contrast" findings against a `#f1f6fd` background on the standalone legal/utility pages (privacidad, terminos, aviso-legal, cookies, contacto, gracias, 404); this does not match any color in the system and is contradicted by direct screenshot verification of every one of those pages (dark background, correct high-contrast text). Treated as a detector/tooling artifact in resolving the multi-layer `body` background gradient for non-SPA pages, not a real defect.
