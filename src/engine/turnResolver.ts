import { getCharacter } from '../data/characters';
import type { AbilityContext } from '../types';
import { effectiveCharacter, isImmune, type RaceRuntime } from './raceEngine';

export interface TurnResult {
  characterId: string;
  roll: number | null;
  spacesMoved: number;
  tripped: boolean;
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function notifyAbilityResolve(runtime: RaceRuntime, ctx: AbilityContext, triggerId: string) {
  for (const racer of Object.values(runtime.racers)) {
    if (racer.characterId === triggerId || racer.finished) continue;
    effectiveCharacter(runtime, racer.characterId).abilities.onAbilityResolve?.(ctx, triggerId, racer.characterId);
  }
}

/** Grants a reroll of the active racer's die to another racer's owner; moves Dice +1. */
export async function useDiceReroll(
  runtime: RaceRuntime,
  ctx: AbilityContext,
  requesterCharacterId: string,
): Promise<number> {
  runtime.rerollUsedThisTurn = true;
  const newRoll = rollDie();
  ctx.log(`🎲 ${ctx.describe(requesterCharacterId)} uses Dice's reroll: ${newRoll}!`, 'ability');
  const diceId = Object.keys(runtime.racers).find(
    (id) => getCharacter(id).id === 'dice',
  );
  if (diceId && diceId !== requesterCharacterId && !runtime.racers[diceId].finished) {
    await ctx.move(diceId, 1);
    ctx.log(`${ctx.describe(diceId)} shuffles forward 1 space, pocketing the fee.`, 'ability');
  }
  return newRoll;
}

/** Resolves one full turn for `characterId`, awaiting any human decisions along the way. */
export async function playTurn(
  runtime: RaceRuntime,
  ctx: AbilityContext,
  characterId: string,
): Promise<TurnResult> {
  const racer = runtime.racers[characterId];
  runtime.rerollUsedThisTurn = false;
  runtime.pendingMoveCancelled = false;

  ctx.log(`▶ ${ctx.describe(characterId)}'s turn (space ${racer.position}/${ctx.trackLength})`, 'turn');

  // 1. Passive auras fire for every racer before the active racer acts (skipped entirely if the
  // active racer is immune, e.g. Panda, since it can't be affected by others' abilities).
  if (!isImmune(runtime, characterId)) {
    for (const other of Object.values(runtime.racers)) {
      if (other.finished) continue;
      effectiveCharacter(runtime, other.characterId).abilities.onAnyTurnStart?.(ctx, other.characterId, characterId);
    }
  }

  // 2. Active racer's own onTurnStart hook (e.g. Cheerleader's rally prompt).
  const onTurnStart = effectiveCharacter(runtime, characterId).abilities.onTurnStart;
  if (onTurnStart) {
    await onTurnStart(ctx, characterId);
    notifyAbilityResolve(runtime, ctx, characterId);
  }

  // 3. Handle tripping: skip this turn's move, stand back up, end turn immediately.
  if (racer.tripped) {
    racer.tripped = false;
    ctx.log(`💫 ${ctx.describe(characterId)} was tripped and skips this turn (standing back up).`, 'move');
    runtime.callbacks.onRacersChange({ ...runtime.racers });
    return { characterId, roll: null, spacesMoved: 0, tripped: true };
  }

  // 4. Roll (or use a flat override, e.g. Cheerleader's self-penalty).
  let moveValue: number;
  let roll: number | null = null;
  if (racer.flatMoveOverride !== null) {
    moveValue = racer.flatMoveOverride;
    racer.flatMoveOverride = null;
  } else {
    // Oracle et al. get one last chance to predict the roll before it happens.
    if (!isImmune(runtime, characterId)) {
      for (const other of Object.values(runtime.racers)) {
        if (other.characterId === characterId || other.finished) continue;
        await effectiveCharacter(runtime, other.characterId).abilities.onBeforeAnyRoll?.(ctx, other.characterId, characterId);
      }
    }
    roll = rollDie();
    const modifier = racer.rollModifier;
    racer.rollModifier = 0;
    let adjusted = Math.max(0, roll + modifier);
    const withAbility = await effectiveCharacter(runtime, characterId).abilities.onRoll?.(ctx, characterId, adjusted);
    if (withAbility !== undefined) {
      adjusted = withAbility;
      notifyAbilityResolve(runtime, ctx, characterId);
    }
    moveValue = adjusted;
  }

  // 4b. Reactive hooks fired to every other racer right after the roll is known
  // but before movement is applied (Squire, Worm, Skipper, Octopus). Skipped
  // entirely if the roller is immune (Panda can't be cancelled/targeted).
  if (!isImmune(runtime, characterId)) {
    for (const other of Object.values(runtime.racers)) {
      if (other.characterId === characterId || other.finished) continue;
      await effectiveCharacter(runtime, other.characterId).abilities.onAnyRoll?.(ctx, other.characterId, characterId, moveValue);
    }
  }

  if (runtime.pendingMoveCancelled) {
    ctx.log(`🚫 ${ctx.describe(characterId)}'s move is cancelled this turn!`, 'move');
    moveValue = 0;
  } else {
    const rollDetail =
      roll !== null && roll !== moveValue ? ` (rolled ${roll}, adjusted to ${moveValue})` : '';
    ctx.log(`🎲 ${ctx.describe(characterId)} moves ${moveValue} space${moveValue === 1 ? '' : 's'}${rollDetail}.`, 'move');
    await ctx.move(characterId, moveValue);
  }

  // 5. End-of-turn hook for the active racer (e.g. Mouth, Scientist).
  const onTurnEnd = effectiveCharacter(runtime, characterId).abilities.onTurnEnd;
  if (onTurnEnd) {
    await onTurnEnd(ctx, characterId);
    notifyAbilityResolve(runtime, ctx, characterId);
  }

  // 5b. Genius: if it correctly predicted its own roll, it takes another turn.
  if (runtime.custom[characterId]?.geniusExtraTurn) {
    delete runtime.custom[characterId].geniusExtraTurn;
    ctx.log(`🧠 ${ctx.describe(characterId)} predicted the roll correctly and goes again!`, 'ability');
    ctx.requestPriorityTurn(characterId);
  }

  // 6. Reactive hooks for every other still-active racer (e.g. Heckler, Raptor).
  // Skipped if the just-finished turn belongs to an immune racer (Panda).
  if (!isImmune(runtime, characterId)) {
    for (const other of Object.values(runtime.racers)) {
      if (other.characterId === characterId || other.finished) continue;
      await effectiveCharacter(runtime, other.characterId).abilities.onOtherTurnEnd?.(
        ctx,
        other.characterId,
        characterId,
        moveValue,
      );
    }
  }

  return { characterId, roll, spacesMoved: moveValue, tripped: false };
}

/** A race ends the instant a second distinct racer crosses the finish line. */
export function isRaceOver(runtime: RaceRuntime): boolean {
  return runtime.finishedCharacterIds.length >= 2;
}

