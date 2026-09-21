import { getCharacter } from '../data/characters';
import type { AbilityContext } from '../types';
import type { RaceRuntime } from './raceEngine';

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
    getCharacter(racer.characterId).abilities.onAbilityResolve?.(ctx, triggerId, racer.characterId);
  }
}

/** Grants a reroll of the active racer's die to another racer's owner; moves the Dicemonger +1. */
export async function useDicemongerReroll(
  runtime: RaceRuntime,
  ctx: AbilityContext,
  requesterCharacterId: string,
): Promise<number> {
  runtime.rerollUsedThisTurn = true;
  const newRoll = rollDie();
  ctx.log(`🎲 ${ctx.describe(requesterCharacterId)} uses Dicemonger's reroll: ${newRoll}!`, 'ability');
  const dicemongerId = Object.keys(runtime.racers).find(
    (id) => getCharacter(id).id === 'dicemonger',
  );
  if (dicemongerId && dicemongerId !== requesterCharacterId && !runtime.racers[dicemongerId].finished) {
    await ctx.move(dicemongerId, 1);
    ctx.log(`${ctx.describe(dicemongerId)} shuffles forward 1 space, pocketing the fee.`, 'ability');
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

  ctx.log(`▶ ${ctx.describe(characterId)}'s turn (space ${racer.position}/${ctx.trackLength})`, 'turn');

  // 1. Passive auras fire for every racer before the active racer acts.
  for (const other of Object.values(runtime.racers)) {
    if (other.finished) continue;
    getCharacter(other.characterId).abilities.onAnyTurnStart?.(ctx, other.characterId, characterId);
  }

  // 2. Active racer's own onTurnStart hook (e.g. Cheerleader's rally prompt).
  await getCharacter(characterId).abilities.onTurnStart?.(ctx, characterId);
  notifyAbilityResolve(runtime, ctx, characterId);

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
    roll = rollDie();
    const modifier = racer.rollModifier;
    racer.rollModifier = 0;
    let adjusted = Math.max(0, roll + modifier);
    const withAbility = await getCharacter(characterId).abilities.onRoll?.(ctx, characterId, adjusted);
    if (withAbility !== undefined) {
      adjusted = withAbility;
      notifyAbilityResolve(runtime, ctx, characterId);
    }
    moveValue = adjusted;
  }

  const rollDetail =
    roll !== null && roll !== moveValue ? ` (rolled ${roll}, adjusted to ${moveValue})` : '';
  ctx.log(`🎲 ${ctx.describe(characterId)} moves ${moveValue} space${moveValue === 1 ? '' : 's'}${rollDetail}.`, 'move');
  await ctx.move(characterId, moveValue);

  // 5. End-of-turn hook for the active racer (e.g. M.O.U.T.H., Rocket Scientist).
  await getCharacter(characterId).abilities.onTurnEnd?.(ctx, characterId);
  notifyAbilityResolve(runtime, ctx, characterId);

  // 6. Reactive hooks for every other still-active racer (e.g. Heckler).
  for (const other of Object.values(runtime.racers)) {
    if (other.characterId === characterId || other.finished) continue;
    await getCharacter(other.characterId).abilities.onOtherTurnEnd?.(
      ctx,
      other.characterId,
      characterId,
      moveValue,
    );
  }

  return { characterId, roll, spacesMoved: moveValue, tripped: false };
}

/** A race ends the instant a second distinct racer crosses the finish line. */
export function isRaceOver(runtime: RaceRuntime): boolean {
  return runtime.finishedCharacterIds.length >= 2;
}
