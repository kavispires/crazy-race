# Magical Athlete

A solo-play web adaptation of *Magical Athlete*, built with React, TypeScript, Vite, Zustand, and
Ant Design. Draft racers, keep your picks secret, and compete in four races against AI opponents.
See `magical_athlete_game_plan.md` for the full design/rules reference.

## Running locally

```bash
yarn
yarn dev
```

Open the printed local URL in your browser.

## How it works

- **Draft:** Two snake-draft rounds reveal `2N` characters at a time until every player has 4
  racers. With only 12 base characters in the roster, tables larger than 3 players reuse
  characters as extra "copies" so everyone still gets 4 unique cards.
- **Secret selection:** Before each of the 4 races you privately choose one of your remaining
  racers; AI opponents pick automatically.
- **Racing:** Roll a die, resolve character abilities (movement, tripping, elimination, chain
  reactions), and race across a track that alternates between a hazard-free "Mild Mile" and a
  hazardous "Wild Wilds" board. The race ends the instant a second racer crosses the finish line.
- **AI pacing:** Press "Roll Die" on your turn, or "Next →" to let the AI take theirs — nothing
  advances without your input, so you never miss an ability chain reaction in the action log.
- **Scoring:** Gold/silver chips (value increasing each race) plus bronze star chips accumulate
  across all 4 races; the highest total score wins.
- **Reading the action log:** Every entry is tagged — <kbd>Turn</kbd> marks whose go it is,
  <kbd>Move</kbd> shows the roll/distance, <kbd>Ability</kbd> is a character power firing,
  <kbd>Hazard</kbd> is a rock/star/arrow, and <kbd>Finish</kbd> is a racer crossing the line.
  The same legend is shown live above the log in-game.

## Customizing racer art (SVG icons)

Racer tokens and character cards render `public/racers/<character-id>.svg`. To swap in your own
art, just drop a same-named SVG file into `public/racers/` — no code changes needed. The full
36-character roster's ids are the `id` field of each entry in `src/data/characters.ts`.

Recommended size is a square viewBox (e.g. `0 0 64 64`); the app scales it to fit automatically.
If a file is missing, the UI falls back to a plain circle with the character's initial, so you can
replace them one at a time. See `src/components/CharacterIcon.tsx` for the rendering logic.

## Project structure

- `src/types` — shared domain types (characters, tracks, racers, abilities).
- `src/data` — the 36-character roster and the 4 race tracks.
- `src/engine` — the ability/turn resolution engine (movement, passing, hazards, chain reactions).
- `src/ai` — AI heuristics for drafting, secret selection, and in-race decisions.
- `src/store` — the Zustand game store driving the whole game loop.
- `src/components` — screens for setup, draft, secret selection, racing, results, and final score.
  `CharacterIcon.tsx` is the single place that resolves a character id to its SVG.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
