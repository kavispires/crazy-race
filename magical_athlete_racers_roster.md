# Magical Athlete Racers & Implementation Guide

This document catalogs the official racers from `Magical_Athlete_racers_PLAYTEST_v1.pdf`, paired with UI emojis and logic hooks for the React/Zustand game engine.

### Engine Hooks Reference

To implement these, your Zustand store should fire events that characters can subscribe to. Common hooks needed:

* `onTurnStart(player)` / `onTurnEnd(player)`

* `onRoll(player, result)` / `onBeforeMove(player)` / `onAfterMove(player)`

* `onPass(passer, passee)` / `onShareSpace(playerA, playerB)`

## The Roster

### 🧪 Alchemist

**Ability (TRANSMUTE 'N' SCOOT):** When I roll a 1 or 2 for my main move, I can move 4 instead.

* **Implementation:** Intercept `onRoll`. If result is 1 or 2, pause the queue and show an AntD Modal/Prompt to the player: "Move 4 instead?". If AI, auto-accept.

### 🧙‍♀️ Baba Yaga

**Ability (LEGIT):** Trip any racer that stops on my space, or when I stop on theirs.

* **Implementation:** `onAfterMove`. Check if `currentSpace.players.includes(BabaYaga)` or if Baba Yaga lands on an occupied space. Apply `setTripped(true)` to the other racer.

### 🍌 Banana

**Ability (THE SLIP):** When a racer passes me, they trip.

* **Implementation:** `onPass`. If `movingPlayer.startIndex < banana.index` and `movingPlayer.endIndex > banana.index`, immediately `setTripped(movingPlayer, true)`.

### 🎈 Blimp

**Ability (BLOW IT):** When I start my turn before the second corner of the track, I get +3 to my main move. On or after that corner, I get -1.

* **Implementation:** The Track data structure needs a `cornerIndices` array. On `onTurnStart(Blimp)`, evaluate position and apply `setRollModifier(+3)` or `setRollModifier(-1)`.

### 🐎 Centaur

**Ability (HOOFWHACK):** When I pass a racer, they move -2.

* **Implementation:** `onPass`. For every player whose index is crossed during Centaur's move, trigger `moveRelative(passedPlayer, -2)`.

### 📣 Cheerleader

**Ability (RAH RAH):** At the start of my turn, I can make the racer(s) in last place move 2. If I do, I move 1.

* **Implementation:** `onTurnStart`. Prompt player. If yes, identify `Math.min(...allPlayerIndices)`, move those players +2, and move Cheerleader +1. *Note: Main move happens after this.*

### 🧢 Coach

**Ability (GOOD HUSTLE):** Everyone on my space gets +1 to their main move, including me.

* **Implementation:** Passive state calculation. Any player calculating their move checks: `if (player.spaceIndex === coach.spaceIndex) { roll += 1 }`.

### 🪞 Copy Cat

**Ability (COPY THAT):** I have the power of the racer currently in the lead. If there's a tie, I pick.

* **Implementation:** Dynamic pointer. `getCurrentAbility()` checks `Math.max(...allPlayerIndices)`. If tied, trigger a UI selection modal for the player to choose their target.

### 🎲 Dicemonger

**Ability (DICEY DEALS):** Anyone can reroll their main move once per turn. When another racer does it, I move 1.

* **Implementation:** Add a global `canReroll` boolean to turn state. If a player clicks "Reroll", trigger `onRoll` again, and if `currentPlayer !== Dicemonger`, trigger `moveRelative(Dicemonger, 1)`.

### 🤺 Duelist

**Ability (DUEL!):** Whenever a racer shares my space, I can shout DUEL! We roll our dice and whoever rolls highest moves 2. I win ties.

* **Implementation:** `onShareSpace`. Prompt Duelist (or auto-trigger for AI). Roll two background dice. If `DuelistRoll >= EnemyRoll`, `moveRelative(Duelist, 2)`, else `moveRelative(Enemy, 2)`.

### 🥚 Egg

**Ability (SCRAMBLE):** At the start of my race, draw 3 new racers from the deck and pick one. I have its powers.

* **Implementation:** Pre-race setup phase. Generate 3 random unused racers. Show a selection modal. Assign the chosen racer's logic ID to Egg's state object.

### 🩴 Flip Flop

**Ability (FLOP FLIP):** I can skip rolling for my main move and swap spaces with another racer instead.

* **Implementation:** `onTurnStart`. Show "Roll" vs "Swap" buttons. If Swap, open a modal with other players. Swap `player.index` values in Zustand.

### 🧠 Genius

**Ability (THINK GOOD):** I can predict what number I'll roll for my main move. If I'm right, I take another turn after this one.

* **Implementation:** `onTurnStart`. Show a 1-6 number picker before rolling. Store `predictedRoll`. In `onRoll`, if matched, append `Genius` to the `turnQueue`.

### 🦠 Gunk

**Ability (GOOP 'EM):** Other racers get -1 to their main move.

* **Implementation:** Global passive modifier. `if (player !== Gunk) { rollModifier -= 1 }`. Ensure minimum roll logic applies if the rules dictate moves cannot be 0.

### 🐇 Hare

**Ability (HUBRIS):** I get +2 to my main move. When I start my turn alone in the lead, I skip my move and get a bronze point chip.

* **Implementation:** `onTurnStart`. Check `if (isAloneInLead(Hare))`. If true, `addChip(Hare, 'bronze')` and `skipTurn()`. Otherwise, `rollModifier += 2`.

### 😈 Heckler

**Ability (SCHADENFREUDE):** When a racer ends their turn within 1 space of where they started, I move 2.

* **Implementation:** `onTurnEnd`. Track `startIndex` at `onTurnStart`. `if (Math.abs(endIndex - startIndex) <= 1) { moveRelative(Heckler, 2) }`.

### 🌀 Hypnotist

**Ability (HSSSSST):** At the start of my turn, I can warp a racer to my space.

* **Implementation:** `onTurnStart`. Optional prompt to select a player. If selected, set target's `index` to Hypnotist's `index`.

### 👶 Huge Baby

**Ability (REALLY HUGE):** No one can ever be on my space, besides the Start. Whenever that would happen, put the racer on the space behind me instead.

* **Implementation:** Override `onBeforeMove` resolutions. If `targetIndex === HugeBaby.index && targetIndex !== 0`, then `targetIndex = HugeBaby.index - 1`.

### 🐛 Inchworm

**Ability (WRIGGLE):** When another racer rolls a 1 for their main move, they skip that move and I move 1.

* **Implementation:** `onRoll`. If `roll === 1 && player !== Inchworm`, `cancelMove(player)` and `moveRelative(Inchworm, 1)`.

### 🙇 Lackey

**Ability (VERY GOOD SIRE):** When another racer rolls a 6 for their main move, I move 2 before they move.

* **Implementation:** `onRoll`. If `roll === 6 && player !== Lackey`, pause the active turn, `moveRelative(Lackey, 2)`, then resume the active turn.

### 🦵 Legs

**Ability (JOG):** I can skip rolling for my main move and move 5 instead.

* **Implementation:** `onTurnStart`. Show "Roll" vs "Move 5" buttons. AI heuristic: always move 5 unless 6 is required to win.

### 🐸 Leaptoad

**Ability (JUMPFROG):** While moving, I skip spaces with other racers on them.

* **Implementation:** Custom move logic. Loop `roll` times: `index++`. `while (spaceIsOccupied(index)) { index++ }`.

### 🥺 Lovable Loser

**Ability (D'AWW):** At the start of my turn, I get a bronze point chip if I'm alone in last place.

* **Implementation:** `onTurnStart`. `if (isAloneInLast(LovableLoser)) { addChip(LovableLoser, 'bronze') }`.

### 👄 M.O.U.T.H.

**Ability (CHOMP):** When I stop on a space with exactly one other racer, they're eliminated from the race.

* **Implementation:** `onAfterMove`. `if (currentSpace.players.length === 2) { eliminate(otherPlayer) }`.

### 🎩 Magician

**Ability (POOF):** I can reroll my main move twice.

* **Implementation:** Extend turn state. `MagicianRerolls = 2`. Show reroll button until count is 0.

### ♟️ Mastermind

**Ability (KNOW-IT-ALL):** At the start of my first turn, I predict which racer will win. If I'm right, the race ends immediately and I finish 2nd.

* **Implementation:** `onTurnStart` (first turn only). Show selection modal. Store `predictedWinner`. Listen on `onCrossFinishLine`: if `winner === predictedWinner`, halt game, award 2nd place to Mastermind.

### 🪩 Party Animal

**Ability (ANIMAL MAGNETISM):** At the start of my turn, all racers move 1 space towards me. Each other racer on my space gives me +1 to my main move.

* **Implementation:** `onTurnStart`. Loop all players, `moveRelative(1 or -1)` based on position relative to Party Animal. Then, `rollModifier += playersOnSpace.length - 1`.

### 🚀 Rocket Scientist

**Ability (KABLOOEY):** When I roll for my main move, I can move double that number. If I do, I trip.

* **Implementation:** `onRoll`. Prompt "Double and trip?". If yes, `moveRelative(roll * 2)` then `setTripped(RocketScientist, true)`.

### 🌹 Romantic

**Ability (AH, LOVE!):** When anyone stops on a space with exactly one other racer, I move 2.

* **Implementation:** `onAfterMove(any)`. `if (currentSpace.players.length === 2 && !includes(Romantic)) { moveRelative(Romantic, 2) }`.

### 🛞 Third Wheel

**Ability (ROLL THROUGH):** Before my main move, I can warp to any space with exactly 2 racers in it.

* **Implementation:** `onTurnStart`. Find spaces with exactly 2 players. If they exist, optionally teleport Third Wheel there before rolling.

### 👯 Twin

**Ability (DOUBLE DIP):** At the start of my race, I can pick a racer who won a previous race and race with their abilities.

* **Implementation:** Pre-race setup. Filter `previousWinners`. If empty, Twin has no power. Otherwise, pick one and copy its logic ID.

### 🤏 Scoocher

**Ability (SCOOCH SCOOCH):** When another racer's power happens, I move 1.

* **Implementation:** Global Event Bus listener. `onAbilityTriggered`. `if (source !== Scoocher) { moveRelative(Scoocher, 1) }`. *(Be careful of infinite loops here!)*

### ⛵ Skipper

**Ability (SALTY DOG):** When anyone rolls a 1 for their main move, I go next in turn order.

* **Implementation:** `onRoll`. If `roll === 1`, manipulate the `turnQueue` array to insert Skipper immediately after the current player.

### 🐟 Suckerfish

**Ability (SUCKER!):** When a racer on my space moves, I can also move to their new space.

* **Implementation:** `onBeforeMove`. If `movingPlayer.startIndex === Suckerfish.index`, listen to `onAfterMove` and optionally snap Suckerfish to `movingPlayer.endIndex`.

### 🪨 Sisyphus

**Ability (KEEP ROLLIN'):** Before my race, I take 4 point chips. When I roll a 6 for my main move, instead of moving, I warp to the Start and lose 1 point chip.

* **Implementation:** Pre-race setup: `addChip(Sisyphus, 'bronze', 4)`. `onRoll`: `if (roll === 6) { cancelMove(); setIndex(0); removeChip(Sisyphus, 'bronze', 1) }`.

### 🤓 Stickler

**Ability (ACTUALLY...):** Other racers can only cross the finish line by moving the exact amount they need. If they overshoot, they don't move.

* **Implementation:** Override `onBeforeMove`. `if (player !== Stickler && player.index + moveAmount > FinishLine.index) { cancelMove(player) }`.