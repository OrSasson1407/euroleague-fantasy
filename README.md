# EuroLeague Fantasy

A browser-based EuroLeague fantasy game, built entirely with vanilla HTML/CSS/JS (no build step, no frameworks). Hebrew UI, RTL layout. Runs on real historical EuroLeague roster data spanning the 2000–2026 era (560 team-seasons, 9,166 player records).

## Modes

- **בניית סגל (Squad Builder)** — draft an all-time-great 10-man squad (starters + bench) one player at a time from randomly drawn historical team-seasons, with strict position matching, reroll tokens, era filters, and a coaching "play system" that rewards player archetype fit.
- **1 על 1 (Head-to-Head)** — draft a 5-man squad against a friend or the computer, then play a best-of-3/5 series with quarter-by-quarter reveals, home-court swings, and pre-game win probabilities.
- **ליגה (League)** — pick a favorite club, draft its all-time roster, then simulate (all at once or game-by-game) a 20-team league season with a real standings table, mid-season trade windows, and a playoff bracket.
- **קריירה (Career)** — the deepest mode: create a custom player at age 16, develop through a real-country-tied academy, get drafted, and live out a full pro career — contracts, injuries, national team call-ups, a coaching-system fit mechanic, an upgrade shop, career milestones, and retirement.
- **טריוויה (Trivia)** — 25-question quizzes on identifying teams or seasons from real historical rosters, with an optional timed mode and streak-based difficulty.
- **פרופיל שחקן (Player Profile)** — search any of the 9,166 player records and see their full career arc and rating history across every team-season they appeared in.
- **באנרים (Badges)** — achievements tracked across every mode.

## Architecture

Each mode is a self-contained IIFE module (`game.js`, `h2h.js`, `league.js`, `trivia.js`, `career.js`, `player_profile.js`) sharing only a few global hooks: `window.EUROLEAGUE_DATA` (the dataset), `window.AppNav.showScreen` (a simple screen router), `window.Achievements`, `window.PlaySystems`/`window.PlaySystemsAPI`, and `window.RatingArchetypes`. State is persisted per-mode in `localStorage` where relevant (achievements, career saves).

## Running locally

```bash
node _static_server.js
```

Then open `http://localhost:8765`.
