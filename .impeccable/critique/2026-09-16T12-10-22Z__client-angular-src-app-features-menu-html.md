---
target: menu (Modos de Juego + Amigos)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\ruben\\words-game\\client-angular\\src\\app\\features\\menu.html"
target_fingerprint: "sha256:a7b4217f2246d08e81c402dbc90d6fb7d1225d2f6ab24a6f862bde34878aa88c"
target_path: "C:\\Users\\ruben\\words-game\\client-angular\\src\\app\\features\\menu.html"
timestamp: 2026-09-16T12-10-22Z
slug: client-angular-src-app-features-menu-html
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No loading skeleton while friends/daily-challenge fetch resolves - "No tienes amigos aun" can flash before real data lands. |
| 2 | Match Between System / Real World | 3 | Spanish copy natural throughout; flame icon for "Reto diario" leans streak-convention but the label resolves it. |
| 3 | User Control and Freedom | 2 | "+ Agregar" toggle never changes label or adds a cancel affordance - no obvious way to back out once opened. |
| 4 | Consistency and Standards | 2 | The two panels use two different spacing scales and two different item-container conventions (hairline rows vs. bordered cards). |
| 5 | Error Prevention | 3 | Add-friend button disabled on empty/whitespace input; failed submit preserves state for retry. |
| 6 | Recognition Rather Than Recall | 3 | Everything is text-labeled; avatar/tier chip clickability relies only on a subtle hover, no stronger affordance. |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard accelerators on the screen players return to every session, despite speed being the emotional core. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean at a glance; row-height inconsistency and Amigos dead space undercut it under close inspection. |
| 9 | Error Recovery | 3 | Toasts are plain-language, non-blocking, server-sourced, form state preserved on failure. |
| 10 | Help and Documentation | 1 | No contextual help anywhere - acceptable for a largely self-explanatory screen, but genuinely absent. |
| Total | | 24/40 | Acceptable (60 percent) |

## Design Specificity Verdict

Grounded, not generic, on balance. The mode-row-connector rail literally joins consecutive rows and is deliberately omitted on the last row (Reto diario as terminal stop) - a specific, working execution of the transit metaphor, not a reskin. The card-accent cascade (cobalt/scarlet/amber/lime) matches DESIGN.md mode/color contract exactly, verified live. Worth noting: DESIGN.md Known gaps section still describes a mode-btn generic card template that no longer exists in the codebase (zero grep matches) - the doc is stale in the implementation favor.

Where it slips: the two side-by-side panels do not share one component language. Modos de Juego is a single bordered list-box with hairline-separated, edge-adjacent rows (0px gap). Amigos is a stack of individually-bordered, rounded cards with an explicit 8px flex gap. Both are legitimate patterns alone, but nothing unifies them - undercutting PRODUCT.md own Principle 4 (one visual world across the whole app).

Deterministic scan: CLI clean (0 findings, exit 0). Browser-injected detector found the same 1 anti-pattern already known from the lobby critique - codex-grid-background, the global ambient grid texture on body. It is page-wide, not localized to either Modos de Juego or Amigos. Neither scan flagged anything spacing-specific in the two requested sections - every spacing issue below comes from direct measurement, not the detector, which currently has no rule for cross-component rhythm mismatches or row-height drift.

Supplementary measurements (factual, both agents independently converged on this): the mode-row list uses shared 1px borders between edge-adjacent 76px rows (no gap), while the friends list uses an explicit 8px flex gap between independently-carded rows - two different spacing mechanisms on the same screen, not just different numbers.

## Overall Impression

The bones are genuinely specific to this product - the rail/connector device and color cascade are not decoration. But the two panels the user asked about were clearly built at different times without a shared ruler: different padding scales, different container conventions, a documented fix (DESIGN.md friends-panel centering) that is not actually in the CSS anymore, and a measurable 13px row-height glitch in the list players open most often.

## What is Working

1. Mode-color semantics are load-bearing. The card-accent/card-accent-soft/card-accent-border triad cascades from each mode-row modifier into the icon chip fill, border, and hover-chevron color - verified live against DESIGN.md contract.
2. The connector-rail is a genuine metaphor execution, not a generic divider - deliberately absent on the terminal row.
3. Friend status never relies on color alone - a dot plus an explicit "En linea"/"Desconectado" label.

## Priority Issues

[P1] Amigos: the friends list does not vertically center a short real list, leaving large dead space.
- Why it matters: DESIGN.md own changelog claims this exact problem (lopsided panel) was fixed by centering friends-list content - but the live rule (menu.scss lines 263-268) has no justify-content at all. Live-measured with one real friend: a 327px-tall panel with a 43px row pinned to the top, 284px (87 percent) empty below it.
- Fix: Add justify-content: center back to friends-list, or cap/grow it top-down once the list is long enough that centering would look strange at scale.
- Suggested command: impeccable polish

[P2] Modos de Juego: row heights are inconsistent by 13px (76px vs 63px).
- Why it matters: Rows 1-4 measure 76px; the last row (Reto diario) measures 63px, purely because the mode-row-connector min-height of 8px plus margin-top of 5px only exists on rows with a next stop, inflating their intrinsic height past the 37px body content. No other signal marks the last row as deliberately different.
- Fix: Give every mode-row a shared fixed/min height (or size the connector off the row own height via align-self: stretch) so all five rows are uniform.
- Suggested command: impeccable layout

[P2] The two panel headings and their action button are misaligned by 21px and 10px.
- Why it matters: Modos de Juego and Amigos are grid siblings sharing one heading rule, yet live-measured top edges differ by 21px - friends-section has its own padding of 20px wrapping the heading while game-modes-section delegates padding down into each row instead. Within the Amigos header itself, the heading visual center sits 10px off the Agregar button center.
- Fix: Give game-modes-section its own padding box to match friends-section, and replace the heading margin-bottom with a gap on friends-header.
- Suggested command: impeccable layout

[P2] No shared spacing scale between the two panels.
- Why it matters: Modos uses 13px/18px row padding and a 14px internal gap; Amigos uses 10px/12px, 8px, 9px/12px - no shared step between them. Sitting side-by-side in a 50/50 grid, Modos reads roomy and Amigos reads tight with no deliberate density reason.
- Fix: Standardize both panels on one spacing scale (e.g. 8/12/16/20/24) and pick one item-container convention for both.
- Suggested command: impeccable harden

[P3] Add-friend form has no visible close/cancel affordance.
- Why it matters: the Agregar button opens the form but its label never changes and there is no cancel/X inside it - no obvious exit once opened.
- Fix: Swap the label/icon to Cancelar or an X while open, or add an explicit close control.
- Suggested command: impeccable clarify

## Persona Red Flags

Casey (Distracted Mobile User): PRODUCT.md states sessions happen often on mobile - the one max-width 900px media rule collapses the grid but never reduces the 48px host padding plus 40px card padding, leaving roughly 270px of usable width on a 390px phone. Friend-request Aceptar/Rechazar buttons (padding 6px 12px, font-size 0.78rem) render well under the 44x44pt touch-target minimum. Live mobile emulation did not take effect this session; fell back to reading the media rule directly rather than fabricating a screenshot.

Jordan (Confused First-Timer): the ambiguous Agregar toggle (no cancel affordance) is exactly what Jordan would hunt for and fail to find. The avatar/tier chip clickability into the profile has no stronger cue than a subtle hover background.

Sam (Accessibility-Dependent User): no custom focus-visible styling anywhere (browser default ring survives, a fair baseline, but not reinforced with the product own amber focus language). Each mode row nests an h3 inside a button - five heading-level elements inside interactive controls, under two real h2s - an unconventional pattern for screen-reader heading navigation.

## Minor Observations

- DESIGN.md Known gaps note about mode-btn generic card template is stale - that class does not exist anymore; the shipped mode-row is already more specific than the doc credits it for.
- No loading skeleton while friends/daily-challenge data fetches on mount.
- friend-request and friend-row share consistent padding/radius internally - good within Amigos, just mismatched against Modos.
- Tier badge deliberately omits the raw ELO number on the menu (moved to profile in Fase 9) - a reasonable minimalism call, not a gap.

## Questions to Consider

1. The friends panel already got one documented balance fix for this exact dead-space problem - was the justify-content center line lost in a later edit, or was the changelog written ahead of the code?
2. Modos de Juego treats all five modes as visually equal weight. Given Versus online is the ELO/competitive core loop the product is positioned around, should it read as the primary action, or is flat equality intentional?
3. Given real-time speed is the stated emotional core, is zero keyboard accelerators the right trade-off for the screen every session starts on?
