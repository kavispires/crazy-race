# Crazy Race

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
  racers. With 55 characters in the roster, only very large tables need to reuse characters as
  extra "copies" so everyone still gets 4 unique cards.
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

## Racers

All 55 racers, alphabetized, with their ability. This is the source of truth for what's actually
implemented — see `src/data/characters.ts` for the code. Lower tiers are generally simpler/weaker
abilities; higher tiers are stronger or more situational.

| Racer | Tier | Ability |
|---|---|---|
| Android | 2 | Never rolls; moves 1 space on its first turn, 2 on its second, up to a max of 5. |
| Baby | 2 | No one else may share its space (except the start). They land one space behind instead. |
| Banana | 3 | Anyone who passes the Banana slips and trips. |
| Blimp | 2 | Before the halfway point, +3 to the main move. After, -1. |
| Boulder | 2 | Starts with 4 bonus chips. Rolling a 6 sends it back to Start and costs it a chip instead of moving. |
| Centaur | 2 | Charges past anyone it passes, knocking them back 2 spaces. |
| Cheerleader | 3 | Can rally whoever is in last place (+2) at the cost of her own move (+1). |
| Cheetah | 2 | Can skip rolling to sprint 8 spaces, but must move back 1 and skip its next roll after. |
| Chemist | 2 | On a roll of 1-2, may transmute the roll into a flat move of 4. |
| Coach | 2 | Anyone sharing a space with the Coach gets +1 to their roll. |
| Copy Cat | 1 | Has the power of whichever racer is currently in the lead (ties broken automatically). |
| Dice | 2 | Offers a once-per-turn reroll to anyone; moves 1 whenever someone else uses it. |
| Duelist | 3 | May challenge anyone sharing a space to a dice duel; the loser trips. |
| Egg | 2 | At the start of the race, draws 3 random racers and permanently takes on one of their powers. |
| Flip Flop | 2 | Can skip rolling and instead swap spaces with another racer. |
| Frog | 2 | While moving, hops over any space that has another racer on it. |
| Genius | 1 | Predicts its roll before rolling; if correct, takes another turn immediately after. |
| Ghost | 2 | At the start of its turn, may warp any racer to the space directly behind it. |
| Guard | 2 | Racers can't pass its space unless they started their move there (they stop on it instead); trips if 2+ racers start a turn on its space. |
| Hare | 2 | +2 to the main move. If alone in the lead at the start of a turn, skips the move for a bronze chip instead. |
| Heckler | 3 | Mocks anyone who barely moves, hopping ahead 2 spaces whenever they do. |
| Hypnotist | 2 | At the start of its turn, may warp another racer to its space. |
| Kraken | 3 | Whenever another racer ends their turn exactly 5 or 6 spaces ahead of it, drags them back and moves 2. |
| Leg | 2 | Can skip rolling for the main move and move exactly 5 instead. |
| Loser | 4 | At the start of its turn, gets a bronze chip if alone in last place. |
| Magician | 2 | Can reroll its main move up to twice per turn. |
| Mastermind | 1 | Before the race, predicts the winner. If correct, the race ends immediately and it finishes 2nd. |
| Mouth | 4 | If exactly one other racer shares its space at end of turn, eliminates them. |
| Night Owl | 1 | If it passes every other active racer in a single move, instantly warps to the finish line. |
| Octopus | 2 | Whenever anyone rolls a 3 for their main move, moves 4. Whenever anyone rolls a 5, moves -4. |
| Oracle | 2 | Before any roll (its own or another racer's), predicts the result. Correct guesses move it 1. |
| Panda | 1 | Completely unaffected by every other racer's ability, and never considered to be sharing a space. |
| Party Animal | 1 | At the start of its turn, pulls everyone 1 space closer; gains +1 per racer that joins its space. |
| Poltergeist | 1 | Once per race, may warp every other racer to 1st place, then moves 3 (instead of rolling). |
| Portal | 2 | At the start of its turn, may permanently swap abilities with a racer sharing its space. |
| Queen | 1 | Can skip rolling and move exactly 6 instead. Whenever anyone rolls a 6, moves -4. |
| Raptor | 3 | Whenever another racer moves exactly 4 spaces on their turn, also moves 4. |
| Rhino | 2 | If it rolls a 1, keeps rolling and adding to the total until something other than a 1 comes up. |
| Romantic | 3 | Whenever any two other racers end up sharing a space, swoons forward 2. |
| Scientist | 1 | Doubles every roll, but trips after each launch. |
| Seer | 2 | Before the race, predicts who will finish last. If correct, earns 3 bonus chips. |
| Skipper | 2 | Whenever anyone rolls a 1, jumps to the front of the turn order. |
| Slime | 1 | A sticky aura slows every other racer by -1 on their rolls. |
| Snail | 3 | Never rolls; always moves 1. Whenever anyone else rolls a 1, moves 3 instead. |
| Snowman | 3 | Starts with 8 bonus chips, but must discard 1 at the start of every turn. Keeps whatever is left. |
| Spirit | 2 | At the start of its turn, moves 1 space for every racer currently ahead of it. |
| Spring | 2 | Whenever it stops exactly 1 space behind another racer, warps to the space in front of them. |
| Squire | 3 | Whenever another racer rolls a 6, moves 2 before they move. |
| Stickler | 3 | Other racers can only cross the finish line with an exact roll; overshooting keeps them in place. |
| Suckerfish | 2 | When a racer it shares a space with moves away, may follow them to their new space. |
| Twins | 2 | At the start of the race, may copy the power of a racer that won a previous race. |
| Wheel | 2 | Before its main move, may warp to any space occupied by exactly 2 racers. |
| Witch | 2 | Trips any racer that stops on her space, or that she stops on. |
| Worm | 3 | Whenever another racer rolls a 1, cancels their move and inches forward 1 itself. |
| Zombie | 2 | Scoots forward 1 space whenever another character resolves an ability. |

## Customizing racer art (SVG icons)

Racer tokens and character cards render `public/racers/<character-id>.svg`. To swap in your own
art, just drop a same-named SVG file into `public/racers/` — no code changes needed. The full
55-character roster's ids are the `id` field of each entry in `src/data/characters.ts`.

Recommended size is a square viewBox (e.g. `0 0 64 64`); the app scales it to fit automatically.
If a file is missing, the UI falls back to a plain circle with the character's initial, so you can
replace them one at a time. See `src/components/CharacterIcon.tsx` for the rendering logic.

## Project structure

- `src/types` — shared domain types (characters, tracks, racers, abilities).
- `src/data` — the 55-character roster and the 4 race tracks.
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
