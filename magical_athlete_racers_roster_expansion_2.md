# Magical Athlete - Fan-Made Racers Extension (Part 2)

This file contains additional highly-dynamic fan-made racers that introduce complex positional shifts and unique pacing without breaking the core mechanics of the game.

## 1. Android 🤖
* **Ability:** I do not roll for my main move. On my first turn, I move 1 space. On my second turn, I move 2. I continue adding 1 space per turn until I reach a maximum of 5 spaces per turn.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Add a `turnCount` variable to Android's local state starting at 0. On turn start, `turnCount = Math.min(turnCount + 1, 5)`. Bypass the roll phase entirely and fire `movePlayer(Android.id, turnCount)`.

## 2. Cheetah 🐆
* **Ability:** I can skip rolling for my main move to sprint 8 spaces forward instead. If I do, I skip my main move on my next turn and move backward 1 space.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Track a boolean `isFatigued`. If `isFatigued` is true, bypass the turn choice, `movePlayer(Cheetah.id, -1)`, and set `isFatigued` to false. If false, prompt the player: "Roll or Sprint 8?". If they sprint, execute the move and set `isFatigued = true`.

## 3. Spring 🐸
* **Ability:** Whenever I stop my movement exactly 1 space behind another racer, I immediately warp to the space directly in front of them.
* **Implementation:** 
  * **Zustand Hook:** `onAfterMove`
  * **Logic:** After Spring finishes any movement, check the board state. If `anyPlayer.index === Spring.index + 1`, immediately trigger a warp event setting `Spring.index = anyPlayer.index + 1`. Since this can cause a chain reaction, ensure this hook loops or recursively checks until Spring lands in an empty space or behind a space with no racer.

## 4. Kraken 🦑
* **Ability:** Whenever another racer ends their turn exactly 5 or 6 spaces ahead of me, I drag them back to my space, and then I move forward 2 spaces.
* **Implementation:** 
  * **Zustand Hook:** `onTurnEnd(any)`
  * **Logic:** Listen for any racer ending their turn. Calculate `distance = activePlayer.index - Kraken.index`. If `distance === 5 || distance === 6`, update `activePlayer.index = Kraken.index`, push a "Dragged!" event to the action log, and then fire `movePlayer(Kraken.id, 2)`.

## 5. Poltergeist 🌪️
* **Ability:** Once per race, instead of rolling for my main move, I can instantly warp every other racer on the track to the space of the racer currently in 1st place. I then move 3 spaces.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Track `hasUsedAbility`. If false, provide the option to "Trigger Chaos". If clicked, find the highest index among racers. Map through all other players and set their index to that leader's index. Finally, execute `movePlayer(Poltergeist.id, 3)` and set `hasUsedAbility = true`.

## 6. Snail 🐌
* **Ability:** I do not roll for my main move; I simply move 1 space. However, whenever any other racer rolls a 1 for their main move, I immediately move 3 spaces.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart` & `onDiceRoll`
  * **Logic:** On Snail's turn, bypass the roll and execute `movePlayer(Snail.id, 1)`. Listen globally to `onDiceRoll`; if the resulting `roll === 1` and `roller !== Snail.id`, enqueue a `movePlayer(Snail.id, 3)` action.

## 7. Scientist 🥼
* **Ability:** At the start of my turn, if I share a space with another racer, I can permanently swap my ability with theirs for the rest of the race.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Check if `currentSpace.occupants.length > 1`. If so, prompt the player: "Swap abilities with [Racer Name]?". If accepted, swap the active ability references in the Zustand store between the two character IDs. (Be sure to leave Scientist's character ID intact so their visual token remains the same).