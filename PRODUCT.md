# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Spanish-speaking word-game players, from casual solo practicers to competitive players who track an ELO ranking. Primary session shape: sit down for a quick real-time round (or the daily challenge) against a rival or friends, often on mobile.

## Product Purpose

WordWars is a real-time competitive word-formation game in Spanish: given a prefix, players type as many valid words starting with it as they can before time runs out. Words are validated against the official Real Academia Española (RAE) dictionary. Success means winning rounds, climbing the ELO ladder, and returning daily for the challenge.

## Positioning

A neighboring word game could not truthfully copy: real-time, ranked (ELO), head-to-head word races validated against the official RAE dictionary, in Spanish. Most Spanish-language word games are casual/solo or not officially validated; most competitive/ranked word games are English-only.

## Operating Context

- Game modes: Solo (practice, no time limit), Versus/Cadena (ranked, real-time, ELO-affecting), Amigos (friendly, does not affect ELO), Daily Challenge (one shared prefix per day, 2-minute timer, same for everyone).
- Core loop: landing → auth (login/register) → main menu → pick a mode → lobby/matchmaking → live round (prefix shown, countdown timer, type words, live word list + score) → results (ELO delta, winner) → back to menu.
- Real-time via Socket.io; REST API (Express) for auth/profile/friends/daily-challenge; MongoDB for persistence.
- Password reset flow via email link (dev mode logs to console; SMTP configurable for production).
- Legal/compliance pages exist (privacy, terms, legal notice, cookies) and a cookie-consent banner gating Google Analytics (GA4, not yet configured with a real measurement ID).

## Capabilities and Constraints

- Frontend: TypeScript (no framework) + Vite, single-page app (`client/index.html` + screen-toggle pattern) plus a handful of standalone static pages (legal, contact, thank-you, 404).
- Backend: Express + Socket.io + MongoDB/Mongoose + JWT auth.
- Word validation depends on an external RAE-backed dictionary service (`src/utils/dictionary.ts`) — must stay accurate; never fake or locally approximate validation.
- ELO, games played/won, and daily-challenge completion are real, persisted stats — never invent demo numbers as if real.
- No design system file exists yet; the landing screen (`#landing-screen` / `.ww-*` classes) already carries one coherent, deliberately art-directed identity (dark, editorial). Every other screen (auth, menu, lobby, live game, results, daily challenge, modals) still carries older, plainer styling that was only partially retrofitted to dark mode.

## Brand Commitments

- Name: **WordWars**. Existing wordmark/logo at `client/assets/logo.png` (white) and `logo_black.png` (dark-on-light variant, currently unused in code).
- Language: Spanish only (UI copy, marketing copy, legal pages).
- Personal project by Ruben Carmona (no registered company); contact `rubencarmonaf@gmail.com`.
- User has approved discarding the current landing identity too: this redesign is a full visual-identity replacement, not an extension of the existing "editorial lima" look.

## Evidence on Hand

- Real, working game mechanics and copy throughout `client/index.html` and `client/main.ts` — reusable as real content, not placeholder.
- No product photography, illustration, or brand assets beyond the wordmark.
- No customer testimonials, press, or case studies — none should be invented.

## Product Principles

1. Real-time and speed are the emotional core — the interface should feel fast and alive, not just display a timer.
2. Official RAE validation is the credibility anchor — never let the visual language undercut that seriousness (e.g. cartoonish word-game clichés).
3. Spanish-language, competitive-but-approachable: ELO/ranking matters to some users, but Solo and Daily Challenge must stay welcoming to casual players.
4. One visual world across the whole app: landing (persuade), auth/menu/lobby (operate), live game (operate, scanability-critical), results/daily challenge (operate), legal/contact (read) all read as the same product.
