# Magical Athlete - Fan-Made Racers Extension

This file contains 12 verified fan-made racers designed to be injected into the Zustand store. These racers introduce zero new mechanics and do not conflict with the official 36-character roster. 

## 1. Apparition 👻
* **Ability:** At the start of my turn, I move 1 space for each racer ahead of me on the track.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Calculate the player's position index compared to all active racers. Count how many racers have a higher space index, then fire a `movePlayer(id, count)` event before prompting the main move roll.

## 2. Guard 👁️
* **Ability:** Racers cannot pass me during their main move unless they started on my space. If they try, they stop on my space instead. If I start my turn on a space with 2 or more other racers, I trip.
* **Implementation:** 
  * **Zustand Hook:** `onPlayerMove` (Passive Intercept) & `onTurnStart`
  * **Logic:** When resolving any racer's movement, if their path crosses Guard's index and they didn't start there, truncate their target destination to Guard's current index. On Guard's turn, check board state; if `occupants.length >= 3`, apply the tripped state and skip the roll.

## 3. Ghost 😱
* **Ability:** At the start of my turn, I can warp any racer to the space directly behind me.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart`
  * **Logic:** Pause the AI/Turn timer to prompt a UI modal: "Select a racer to warp". Once selected, update that racer's position index to `Ghost.index - 1`. 

## 4. Raptor 🦖
* **Ability:** When another racer moves exactly 4 spaces during their turn, I also move 4 spaces.
* **Implementation:** 
  * **Zustand Hook:** `onMoveComplete`
  * **Logic:** Listen to the event queue. If `event.type === 'MOVE'` and `event.amount === 4` and `event.playerId !== Raptor.id`, enqueue a new `movePlayer(Raptor.id, 4)` event. 

## 5. Octopus 🐙
* **Ability:** When anyone rolls a 3 for their main move, I move 4. When anyone rolls a 5, I move -4.
* **Implementation:** 
  * **Zustand Hook:** `onDiceRoll`
  * **Logic:** Subscribe to the dice roll event. If `roll === 3`, trigger `movePlayer(id, 4)`. If `roll === 5`, trigger `movePlayer(id, -4)`. Make sure to push this to the action log so players know why Octopus is moving erratically.

## 6. Snowman ⛄
* **Ability:** Before my race, I take 8 bronze point chips. At the start of my turn, I must discard 1 chip. I keep any chips left when the race ends.
* **Implementation:** 
  * **Zustand Hook:** `onRaceStart` & `onTurnStart`
  * **Logic:** Initialize Snowman's local state with `chips: 8`. Every time his turn starts, decrement the chip count. When the race finishes, inject the remaining chips into the player's global score state.

## 7. Seer 🏺
* **Ability:** At the start of my first turn, I predict which racer will finish last. If I'm right, I gain 3 bronze point chips.
* **Implementation:** 
  * **Zustand Hook:** `onFirstTurn` & `onRaceEnd`
  * **Logic:** Very similar to *Mastermind*. Pause the game on turn 1 to show a selection modal. Store the prediction in `Seer.prediction`. When the race concludes, evaluate the last place racer and award 3 points if it matches.

## 8. Panda 🦡
* **Ability:** I am completely unaffected by all other racer abilities. Other racers are never considered to be sharing my space.
* **Implementation:** 
  * **Zustand Hook:** `Passive Immunity`
  * **Logic:** In your event resolver function, if the target of an ability (like *Ghost's* warp or *Huge Baby's* push) is Panda, return early and do nothing. When evaluating "Share Space" triggers for racers like *Duelist* or *Baba Yaga*, dynamically exclude Panda from the occupant array.

## 9. Oracle 🔮
* **Ability:** Before any racer rolls for their main move, I can predict the result. If I'm right, I move 1.
* **Implementation:** 
  * **Zustand Hook:** `beforeDiceRoll` & `afterDiceRoll`
  * **Logic:** If an AI controls Oracle, write a lightweight heuristic to randomly guess 1-6 before every roll. If a human plays Oracle, use a quick UI pop-up (or an "auto-pass" toggle so it doesn't get annoying) before opponent rolls. Compare the prediction to the resulting roll and apply `movePlayer(id, 1)` if correct.

## 10. Queen 👑
* **Ability:** I can skip rolling for my main move and move 6 instead. Whenever anyone rolls a 6 for their main move, I move -4.
* **Implementation:** 
  * **Zustand Hook:** `onTurnStart` & `onDiceRoll`
  * **Logic:** Present the player with a choice: "Roll" or "Move 6". For the secondary ability, listen to global dice rolls; if `roll === 6`, enqueue `movePlayer(Queen.id, -4)`.

## 11. Rhino 🦏
* **Ability:** If I roll a 1 for my main move, I keep rolling and adding to my total until I roll something other than a 1.
* **Implementation:** 
  * **Zustand Hook:** `onMainMoveRoll`
  * **Logic:** Wrap Rhino's roll in a `while` loop (with animation delays). `let total = roll; while(roll === 1) { roll = rollDice(); total += roll; }`. Move the total amount after the loop resolves.

## 12. Night Owl 🌙
* **Ability:** If during my main move I pass every other racer currently on the track, I instantly warp to the Finish line.
* **Implementation:** 
  * **Zustand Hook:** `onMoveComplete`
  * **Logic:** When Night Owl finishes a move, check if `Night Owl.index > Math.max(...otherRacers.index)`. If she went from being behind *at least one* racer at the start of her turn to being strictly ahead of *all* active racers, set `Night Owl.index = FINISH_LINE`.