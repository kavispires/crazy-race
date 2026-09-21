# Magical Athlete: Complete Game Plan & App Architecture

This document outlines the step-by-step plan for setting up, playing, and scoring a full game of Magical Athlete, followed by a technical blueprint for building a solo-play React TypeScript web application.

## Phase 1: Preparation & Setup (The Draft)

* **Step 1:** Count the players. Reveal face-up character cards equal to twice the number of players (e.g., 8 cards for a 4-player game).
* **Step 2:** Everyone rolls a standard 6-sided die. The highest roller gets the first pick.
* **Step 3 (First Snake Draft):** Proceeding clockwise, each player drafts one character. When the last player drafts their first character, they immediately draft their second, and the turn order reverses (counter-clockwise) back to the first player.
* **Step 4 (Second Snake Draft):** Reveal a new batch of cards and repeat Step 3 exactly. Stop when every player has exactly **4 racers**.

## Phase 2: Race Execution

A full game consists of **four distinct races**. Once a character is used, they are removed from the game.

* **Step 1: Secret Selection.** Before the race begins, all players secretly select one of their remaining characters.
* **Step 2: The Reveal.** All players reveal their chosen characters simultaneously.
* **Step 3: Determine Turn Order.**
  * *Race 1:* Players roll a die to see who goes first.
  * *Races 2-4:* The player whose character was furthest behind (or eliminated) in the previous race takes the first turn.
* **Step 4: Taking Turns.**
  * Roll the die and move forward that many spaces (Your "Main Move").
  * Resolve any mandatory or optional character abilities.
  * *Tripping:* If an ability or space causes a character to "Trip," lay the token face down. On their next turn, they skip their roll/move, stand their token back up, and their turn ends.

## Phase 3: Track Management

The game uses a double-sided board. You must alternate the track after every race.

* **Mild Mile (Races 1 & 3):** A clean track with no special spaces. Focus on character interactions.
* **Wild Wilds (Races 2 & 4):** A hazardous track with environmental effects.
  * *Rocks:* Characters landing here immediately trip.
  * *Arrows:* Pushes the character forward or backward.
  * *Stars:* Grants a bronze chip worth 1 bonus Victory Point at the end of the game.

## Phase 4: Scoring & Winning

The race stops the exact moment a **second character** crosses the finish line.

* **Step 1: Award Chips.**
  * 1st Place receives the Gold chip for that round.
  * 2nd Place receives the Silver chip for that round.
  * *Note: Chip point values increase with each subsequent race.*
* **Step 2: Next Race.** Discard used characters, flip the board, and return to Phase 2.
* **Step 3: Final Scoring.** After the fourth race, tally the points. The highest score wins.

## Phase 5: Digital App Implementation Plan (React + TypeScript)

This section outlines the logic required to build a single-player web app against `N` AI opponents.

### 1. App Architecture & Tech Stack

* **Framework:** React with TypeScript.
* **State Manager:** Zustand (ideal for predictable, boilerplate-free board state and event queues).
* **UI Component Library:** Ant Design (AntD) for rapid development of modals, drawers, buttons, action logs, and layout grids.
* **Animation:** `motion` (for smooth, performant piece movements across the track).
* **Utilities:** `lodash` (for state cloning, sorting, deep comparisons, and array shuffling).
* **Asset Management:** Racers will be represented by simple placeholder `<div>` components that will easily accept standard SVG injections later.
* **Event System:** An Event Bus or Zustand Middleware to handle chain reactions (e.g., Player A moves -> triggers Player B's ability -> triggers Player C's ability).

### 2. Race Track Logic

Represent tracks as an Array of `Space` objects: `{ index: number, effect?: 'rock' | 'star' | { type: 'arrow', delta: number } }`.

* **Track 1 (Mild Mile 1):** Length 40, no effects.
* **Track 2 (Wild Wilds 1):** Length 45, populated with `effect` objects on specific indices.
* **Track 3 (Mild Mile 2):** Length 50, no effects.
* **Track 4 (Wild Wilds 2):** Length 55, higher density of hazards and star tokens.

### 3. AI Player Implementation

* **Drafting:** The AI evaluates characters based on a predefined tier list.
* **Secret Selection:** AI picks randomly from its remaining pool, weighted by track type.
* **In-Race Choices:** For optional abilities, the AI uses simple heuristics: "Does this move me closer to the finish line?" or "Does this hurt the player in 1st place?"

### 4. Starter Roster Logic (12 Characters)

 1. **Alchemist:** `if (roll <= 2) { prompt("Move 4 instead?"); }`
 2. **Banana:** `onPassedBy(other) => setTripped(other, true)`
 3. **Centaur:** `onPass(other) => moveRelative(other, -2)`
 4. **Cheerleader:** `onTurnStart(self) => prompt("Give last place +2 to move +1?")`
 5. **Coach:** `if (player.spaceIndex === coach.spaceIndex) { player.rollModifier += 1; }`
 6. **Dicemonger:** Global UI button for 1 reroll/turn. `if (reroller !== dicemonger) move(dicemonger, 1)`
 7. **Duelist:** `onShareSpace(other) => prompt("Duel?") -> roll vs roll`
 8. **Gunk:** `Global Passive => allOtherPlayers.rollModifier -= 1`
 9. **Heckler:** `onTurnEnd(other) => if (other.spacesMoved <= 1) move(self, 2)`
10. **M.O.U.T.H.:** `onTurnEnd(self) => if (space.players === 2) eliminate(other)`
11. **Rocket Scientist:** `rollModifier = roll;` then `setTripped(self, true)`
12. **Scoocher:** `onAbilityResolve() => if (trigger !== self) move(self, 1)`

## Phase 6: Confirmed Architectural Decisions

The following key design choices have been locked in for the application build:

1. **Animation System:** We will use `motion` to handle piece movements. This will clearly visualize chain reactions instead of pieces teleporting around the board.
2. **The "Action Log":** An on-screen action log (using AntD) will record all events in real-time (e.g., "Banana tripped Centaur! -> Scoocher scooched 1 space!"). This is crucial for keeping the player informed of complex ability interactions.
3. **AI Pacing & Progression:** To keep the game feeling natural, AI turns will have artificial delays. Furthermore, the human player must press a **"Next"** button to advance through AI actions/turns. This guarantees the player never misses what the AI just did.
4. **Board Layout:** The race track will be built horizontally and scaled so that the **entire track fits on the screen at once**. There will be no horizontal scrolling, giving the player a complete tactical overview of the race at all times.