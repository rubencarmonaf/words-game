---
target: lobby page
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:C:\\Users\\ruben\\words-game\\client-angular\\src\\app\\features\\lobby.html"
target_fingerprint: "sha256:5dfc47ad8487245976abcc0e6cf7ddd8b52e5ec1374bc5f0d27db2a3f222209c"
target_path: "C:\\Users\\ruben\\words-game\\client-angular\\src\\app\\features\\lobby.html"
timestamp: 2026-09-16T11-22-41Z
slug: client-angular-src-app-features-lobby-html
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Clicking "Invitar" flips to "Invitado" with zero network request. "Jugadores: 1/15" never updates. |
| 2 | Match Between System / Real World | 1 | Header reads "Modo: Cadena," but a separate real scarlet "Cadena" mode exists at /play/setup/cadena; this lobby is entered via the lime "Crear lobby" button. |
| 3 | User Control and Freedom | 3 | "Volver" and "Salir del Lobby" both work cleanly. |
| 4 | Consistency and Standards | 2 | Reuses .btn/.board-badge correctly, but card radius (10px/15px) undercuts DESIGN.md 12-16px floor; host highlight uses amber instead of the lime entry-point color. |
| 5 | Error Prevention | 1 | "Invitar" gives an unconditional false-success state; disabled primary CTA explains nothing. |
| 6 | Recognition Rather Than Recall | 3 | Labels are textual; online/offline uses color dot + text. |
| 7 | Flexibility and Efficiency | 1 | No "invite all," no shareable link, one rigid path. |
| 8 | Aesthetic and Minimalist Design | 3 | Visually clean, uses real system tokens even where structure is generic. |
| 9 | Error Recovery | 1 | No handling for a dropped connection, failed invite, or any edge case. |
| 10 | Help and Documentation | 1 | Nothing explains "Cadena," the disabled CTA, or "1/15." |
| Total | | 17/40 | Poor |

## Design Specificity Verdict

This is the least product-specific screen in the app. The menu mode-row cards use real transit vocabulary (icon chip, connector rail, chevron); lobby drops that entirely for bespoke bordered rows any generic multiplayer waiting room could ship unchanged. DESIGN.md stated shared primitives (line-rule/station-tick) never appear here.

Root cause is documented, not drift: lobby.ts states it was ported as-is from client/index.html lobby-screen, with no backend support to build against, so it keeps the same static shape. It never received the Angular-era design pass (Phase 6 motion, Phase 8 ambient presence, Phase 9 real-data work).

Deterministic scan: CLI (impeccable detect --json on lobby.html alone) is clean - 0 findings, exit 0. Browser-injected detection on the live rendered page found 1 anti-pattern: codex-grid-background (two-axis grid-line gradient background) on body, traced to client-angular/src/styles.scss lines 9-31 - a global, app-wide style (Phase 8 ambient texture), not lobby-specific.

Visual overlays: injection succeeded and a Human-tab overlay confirming the grid-background finding was visually verified during the run; that tab has since been closed as part of the assessment cleanup.

## Overall Impression

The lobby looks finished - real tokens, clean layout, working exits - which is what makes it dangerous: a player who taps the menu lime Crear lobby button lands on something that reads as real and is a static mock. The biggest opportunity is also the most honest fix: build the real invite flow, or clearly mark this Proximamente until it exists.

## What is Working

1. Escape routes are solid - both Volver and Salir del Lobby route correctly.
2. Real token reuse where it exists - board-badge--amber, ww-accent/ww-accent-ink, line-lime all pull from the actual DESIGN.md palette.
3. Responsive intent is sensible, even if the section promoted on mobile is the non-functional one.

## Priority Issues

[P0] The entire Con amigos path is a functional dead end, not a lobby.
- Why it matters: friends() is hardcoded mock data, Invitar fires zero network requests (verified live), and the primary CTA is permanently disabled with no code path that ever enables it - yet it is promoted on the menu as a real mode.
- Fix: Either gate this entry point with a visible Proximamente state, or build the real thing the way Versus online got a real server-authoritative build in Fase 10.
- Suggested command: impeccable harden

[P1] Mode-identity collision: this screen calls itself Cadena, but Cadena already means something else.
- Why it matters: A separate real scarlet-coded Cadena mode already exists at /play/setup/cadena. This lobby is reached via the lime Crear lobby button instead, and DESIGN.md mode/color table does not map amber to either candidate. Blurs the ranked-vs-friendly distinction PRODUCT.md treats as meaningful.
- Fix: Header should name the actual mode (Modo: Con amigos), and the host badge/CTA should be recolored lime to match the entry point.
- Suggested command: impeccable clarify

[P2] The mock friends list directly contradicts the real friends state shown one click away.
- Why it matters: On the same logged-in account, /menu correctly shows No tienes amigos aun, while /lobby shows two fabricated friends available to invite - confidently wrong data next to the correct empty state, one navigation apart.
- Fix: Reuse menu.ts real friends data/empty-state pattern instead of mock entries.
- Suggested command: impeccable harden

[P3] No ambient alive signal while waiting - a step down from the app own precedent.
- Why it matters: Phase 6 built a sweeping-dot search track for matchmaking dead time; Phase 8 extended an ambient traveling dot to game/daily-challenge headers, citing flatness. This social waiting room got none of that budget.
- Fix: Extend the existing search-track/game-rail vocabulary to this screen.
- Suggested command: impeccable animate

## Persona Red Flags

Jordan (Confused First-Timer): Taps Crear lobby, lands on a screen titled Modo: Cadena with nothing explaining the label change. Taps Invitar, sees a lime Invitado pill - the app real success styling - and reasonably believes a friend was notified; none was.

Riley (Deliberate Stress Tester): Invitar is a textbook silent-fail (UI changes, zero request fired, confirmed via network capture). Two-tab comparison instantly exposes the fabricated friends list contradicting the real (empty) one. Jugadores: 1/15 never moves under any available action.

Casey (Distracted Mobile User): invite-btn renders at roughly 28-30px tall - under the 44x44pt minimum touch target. On mobile, the reordered layout puts the fake invite panel and dead CTA above the real player list. (Live mobile screenshot was blocked this session; findings are source-verified from the max-width 768px block, not a live capture.)

## Minor Observations

- lobby-player/friend-to-invite use 10px radius, wrapper containers use 15px - both diverge from DESIGN.md 12-16px floor and do not reference the shared radius token.
- invite-btn hover state hardcodes a color absent from DESIGN.md palette (should derive from line-amber).
- Host-row highlight is hand-rolled inline rather than using the card-accent custom-property pattern menu.scss already established.
- lobby.spec.ts exists - worth checking whether it only tests the mock-data plumbing, which would mask this gap in CI.
- App-wide codex-grid-background detector finding (body-level ambient grid texture, styles.scss lines 9-31) - real and reproducible but affects every screen equally, not lobby-specific.

## Questions to Consider

1. If Crear lobby can never lead to a real match today, should it stay on the menu at all, or would a clearly-labeled Proximamente be more honest than a fully-styled dead end?
2. The victory sequence and matchmaking screen both got dedicated motion/copy budget for their waiting moments - what would it take to give this social waiting room the same treatment?
3. Two different features are both named Cadena today - is that collision intentional, or a leftover from the vanilla-client port that never got reconciled during the Angular migration?
