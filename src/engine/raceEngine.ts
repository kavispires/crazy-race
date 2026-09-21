import { v4 as uuid } from 'uuid';
import type { AbilityContext, Character, LogEntry, LogKind, Player, RacerState, Track } from '../types';
import { getCharacter, CHARACTER_MAP } from '../data/characters';
import { aiDecide } from '../ai/ai';

export interface RaceRuntimeCallbacks {
  onLog: (entry: LogEntry) => void;
  onRacersChange: (racers: Record<string, RacerState>) => void;
  onStarCollected: (characterId: string) => void;
  onStarRemoved: (characterId: string) => void;
  /** Pause the turn and wait for a human to answer via the UI. */
  requestHumanDecision: (
    characterId: string,
    message: string,
    options: { label: string; value: string }[],
  ) => Promise<string>;
  /** Small artificial delay so AI moves are visible to the player. */
  delay: (ms: number) => Promise<void>;
  /** Requests that `characterId` take the very next turn, ahead of normal turn order. */
  requestPriorityTurn: (characterId: string) => void;
}

export interface RaceRuntime {
  track: Track;
  racers: Record<string, RacerState>;
  players: Record<string, Player>;
  callbacks: RaceRuntimeCallbacks;
  finishOrderCounter: number;
  finishedCharacterIds: string[];
  eliminatedCharacterIds: string[];
  rerollUsedThisTurn: boolean;
  /** Free-form per-character scratch space that persists for the whole race. */
  custom: Record<string, Record<string, unknown>>;
  /** Base character ids that won a previous race this game (for Twins). */
  previousWinnerBaseIds: string[];
  /** Set by a reactive ability (e.g. Worm) to cancel the active racer's pending move this turn. */
  pendingMoveCancelled: boolean;
}

export function createInitialRacers(characterIdToOwner: Record<string, string>): Record<string, RacerState> {
  const racers: Record<string, RacerState> = {};
  for (const [characterId, ownerId] of Object.entries(characterIdToOwner)) {
    racers[characterId] = {
      characterId,
      ownerId,
      position: 0,
      tripped: false,
      finished: false,
      finishOrder: null,
      rollModifier: 0,
      skipNextRoll: false,
      spacesMovedLastTurn: 0,
      flatMoveOverride: null,
    };
  }
  return racers;
}

function character(id: string): Character {
  return getCharacter(id);
}

/**
 * Resolves the *effective* character used for ability-hook dispatch. Normally
 * this is just the racer's own character, but a few racers borrow another
 * character's abilities for the whole race:
 *  - Copy Cat dynamically mirrors whoever is currently in the lead.
 *  - Egg / Twins pick a fixed ability at race setup (stored in `runtime.custom`).
 */
export function effectiveCharacter(runtime: RaceRuntime, characterId: string): Character {
  const own = character(characterId);
  const borrowedBaseId = runtime.custom[characterId]?.borrowedBaseId as string | undefined;
  if (borrowedBaseId && CHARACTER_MAP[borrowedBaseId]) {
    return { ...own, abilities: CHARACTER_MAP[borrowedBaseId].abilities };
  }
  if (own.id === 'copy-cat') {
    const active = Object.values(runtime.racers).filter((r) => !r.finished && r.characterId !== characterId);
    if (active.length > 0) {
      const leadPosition = Math.max(...active.map((r) => r.position));
      const leaders = active.filter((r) => r.position === leadPosition);
      // Deterministic tie-break: earliest in the racer map's insertion order.
      const leader = leaders[0];
      const leaderCharacter = character(leader.characterId);
      if (leaderCharacter.id !== 'copy-cat') {
        return { ...own, abilities: leaderCharacter.abilities };
      }
    }
  }
  return own;
}

/** True if this racer (e.g. Panda) is completely unaffected by other characters' abilities. */
export function isImmune(runtime: RaceRuntime, characterId: string): boolean {
  return effectiveCharacter(runtime, characterId).abilities.immune === true;
}

/** Builds the AbilityContext bound to a specific runtime, wiring up chain-reaction notifications. */
export function buildContext(runtime: RaceRuntime): AbilityContext {
  const describe = (characterId: string) => {
    const racer = runtime.racers[characterId];
    const owner = racer ? runtime.players[racer.ownerId] : undefined;
    const name = character(characterId).name;
    return owner ? `${name} (${owner.name})` : name;
  };

  const log = (message: string, kind: LogKind = 'ability') => {
    runtime.callbacks.onLog({ id: uuid(), message, timestamp: Date.now(), kind });
  };

  const notifyAbilityResolve = (triggerId: string) => {
    for (const racer of Object.values(runtime.racers)) {
      if (racer.characterId === triggerId || racer.finished) continue;
      const abilities = effectiveCharacter(runtime, racer.characterId).abilities;
      abilities.onAbilityResolve?.(ctx, triggerId, racer.characterId);
    }
  };

  const checkMastermindPrediction = (finishedCharacterId: string) => {
    for (const [mmId, data] of Object.entries(runtime.custom)) {
      if (data?.mastermindPredictedWinner !== finishedCharacterId) continue;
      const mmRacer = runtime.racers[mmId];
      if (!mmRacer || mmRacer.finished) continue;
      mmRacer.finished = true;
      mmRacer.finishOrder = runtime.finishOrderCounter++;
      runtime.finishedCharacterIds.push(mmId);
      log(`♟️ ${describe(mmId)} correctly predicted the winner and claims 2nd place, ending the race!`, 'finish');
    }
  };

  const checkSeerPrediction = () => {
    const active = Object.values(runtime.racers).filter((r) => !r.finished);
    if (active.length === 0) return;
    const last = active.reduce((a, b) => (a.position <= b.position ? a : b));
    for (const [seerId, data] of Object.entries(runtime.custom)) {
      if (data?.seerPredictedLast !== last.characterId) continue;
      runtime.callbacks.onStarCollected(seerId);
      runtime.callbacks.onStarCollected(seerId);
      runtime.callbacks.onStarCollected(seerId);
      log(`🔮 ${describe(seerId)} correctly predicted ${describe(last.characterId)} would finish last and earns 3 bonus chips!`, 'ability');
    }
  };

  const move = async (characterId: string, delta: number, opts?: { silent?: boolean; depth?: number }) => {
    const racer = runtime.racers[characterId];
    if (!racer || racer.finished) return;
    const depth = opts?.depth ?? 0;
    // Safety valve: an arrow hazard and a landing-redirect ability (e.g. Baby) can bounce a
    // racer back and forth forever (arrow pushes onto the redirect target, which pushes right back
    // onto the arrow). If we recurse too deep, stop chaining and just settle in place.
    if (depth > 25) {
      log(`⚠️ ${describe(characterId)} gets stuck bouncing between hazards and stays put!`, 'hazard');
      return;
    }
    const from = racer.position;

    // Racers sharing the mover's space before it departs (for Suckerfish).
    const stationaryAtFrom = Object.values(runtime.racers).filter(
      (r) => r.characterId !== characterId && !r.finished && r.position === from && !isImmune(runtime, r.characterId),
    );

    let to = from + delta;
    if (to < 0) to = 0;

    // Stickler: other racers can't overshoot the finish line, only land exactly (immune racers ignore this).
    if (to > runtime.track.length && !isImmune(runtime, characterId)) {
      const sticklerBlocking = Object.values(runtime.racers).some(
        (r) => r.characterId !== characterId && !r.finished && effectiveCharacter(runtime, r.characterId).abilities.blocksOvershoot,
      );
      if (sticklerBlocking) {
        log(`🤓 ${describe(characterId)} overshoots the finish and doesn't move (must land exactly)!`, 'hazard');
        return;
      }
    }

    // Frog: skip over any space currently occupied by another racer.
    if (effectiveCharacter(runtime, characterId).abilities.skipOccupiedSpaces && !opts?.silent && delta !== 0) {
      const dir = delta > 0 ? 1 : -1;
      let steps = Math.abs(delta);
      let pos = from;
      while (steps > 0) {
        pos += dir;
        if (pos <= 0) {
          pos = 0;
          break;
        }
        if (pos >= runtime.track.length) {
          pos = runtime.track.length;
          break;
        }
        const occupied = Object.values(runtime.racers).some(
          (r) => r.characterId !== characterId && !r.finished && r.position === pos,
        );
        if (!occupied) steps--;
      }
      to = pos;
    }

    // Baby / Guard: let others redirect where the mover would land (immune racers ignore this).
    if (to !== 0 && !isImmune(runtime, characterId)) {
      for (const other of Object.values(runtime.racers)) {
        if (other.characterId === characterId || other.finished) continue;
        const adjusted = await effectiveCharacter(runtime, other.characterId).abilities.adjustLanding?.(
          ctx,
          other.characterId,
          characterId,
          to,
        );
        if (adjusted !== undefined) to = Math.max(0, Math.min(adjusted, runtime.track.length));
      }
    }

    const forward = to > from;
    const passedCharacterIds = Object.values(runtime.racers)
      .filter((r) => r.characterId !== characterId && !r.finished)
      .filter((r) => (forward ? r.position > from && r.position < to : r.position < from && r.position > to))
      .map((r) => r.characterId);

    racer.position = to >= runtime.track.length ? runtime.track.length : to;
    runtime.callbacks.onRacersChange({ ...runtime.racers });

    if (!opts?.silent) {
      for (const otherId of passedCharacterIds) {
        // Panda-style immunity: neither side of a pass interaction fires if either racer is immune.
        if (isImmune(runtime, characterId) || isImmune(runtime, otherId)) continue;
        const selfAbilities = effectiveCharacter(runtime, characterId).abilities;
        const otherAbilities = effectiveCharacter(runtime, otherId).abilities;
        if (selfAbilities.onPass) {
          await selfAbilities.onPass(ctx, characterId, otherId);
          notifyAbilityResolve(characterId);
        }
        if (otherAbilities.onPassedBy) {
          await otherAbilities.onPassedBy(ctx, otherId, characterId);
          notifyAbilityResolve(otherId);
        }
      }

      // Suckerfish: racers left behind at the old space may follow to the new one.
      if (!isImmune(runtime, characterId)) {
        for (const stayer of stationaryAtFrom) {
          if (stayer.finished || stayer.position !== from) continue;
          const onSharedDeparture = effectiveCharacter(runtime, stayer.characterId).abilities.onSharedDeparture;
          if (onSharedDeparture) {
            await onSharedDeparture(ctx, stayer.characterId, characterId);
            notifyAbilityResolve(stayer.characterId);
          }
        }
      }
    }

    // Finish line check.
    if (racer.position >= runtime.track.length && !racer.finished) {
      racer.finished = true;
      racer.finishOrder = runtime.finishOrderCounter++;
      runtime.finishedCharacterIds.push(characterId);
      const place = racer.finishOrder === 0 ? '1st 🥇' : racer.finishOrder === 1 ? '2nd 🥈' : `#${racer.finishOrder + 1}`;
      log(`🏁 ${describe(characterId)} crosses the finish line in ${place} place!`, 'finish');
      runtime.callbacks.onRacersChange({ ...runtime.racers });
      if (racer.finishOrder === 0) checkMastermindPrediction(characterId);
      if (runtime.finishedCharacterIds.length === 2) checkSeerPrediction();
      return;
    }

    // Hazard resolution (only meaningful landing, not pass-through).
    const space = runtime.track.spaces[racer.position];
    if (space?.effect) {
      if (space.effect.type === 'rock') {
        log(`🪨 ${describe(characterId)} lands on a rock and trips!`, 'hazard');
        racer.tripped = true;
      } else if (space.effect.type === 'star') {
        log(`⭐ ${describe(characterId)} grabs a star chip (+1 bonus point at game end)!`, 'hazard');
        runtime.callbacks.onStarCollected(characterId);
      } else if (space.effect.type === 'arrow') {
        const direction = space.effect.delta > 0 ? 'forward' : 'backward';
        log(`↔️ ${describe(characterId)} is caught by an arrow and pushed ${direction}!`, 'hazard');
        await move(characterId, space.effect.delta, { silent: opts?.silent, depth: depth + 1 });
        return;
      }
    }

    // Shared-space resolution (fires for both racers involved, plus third parties).
    if (!opts?.silent && !isImmune(runtime, characterId)) {
      const sharing = Object.values(runtime.racers).filter(
        (r) => r.characterId !== characterId && !r.finished && r.position === racer.position && !isImmune(runtime, r.characterId),
      );
      for (const other of sharing) {
        const selfAbilities = effectiveCharacter(runtime, characterId).abilities;
        const otherAbilities = effectiveCharacter(runtime, other.characterId).abilities;
        if (selfAbilities.onShareSpace) {
          await selfAbilities.onShareSpace(ctx, characterId, other.characterId);
          notifyAbilityResolve(characterId);
        }
        if (otherAbilities.onShareSpace) {
          await otherAbilities.onShareSpace(ctx, other.characterId, characterId);
          notifyAbilityResolve(other.characterId);
        }
      }
      if (sharing.length === 1) {
        const otherId = sharing[0].characterId;
        for (const third of Object.values(runtime.racers)) {
          if (third.finished || third.characterId === characterId || third.characterId === otherId) continue;
          const onAnyShareSpace = effectiveCharacter(runtime, third.characterId).abilities.onAnyShareSpace;
          if (onAnyShareSpace) {
            await onAnyShareSpace(ctx, third.characterId, characterId, otherId);
            notifyAbilityResolve(third.characterId);
          }
        }
      }
    }

    runtime.callbacks.onRacersChange({ ...runtime.racers });
  };

  const ctx: AbilityContext = {
    move,
    setPosition: async (characterId, position) => {
      const racer = runtime.racers[characterId];
      if (!racer) return;
      racer.position = Math.max(0, Math.min(position, runtime.track.length));
      runtime.callbacks.onRacersChange({ ...runtime.racers });
    },
    setTripped: (characterId, tripped) => {
      const racer = runtime.racers[characterId];
      if (!racer) return;
      racer.tripped = tripped;
      runtime.callbacks.onRacersChange({ ...runtime.racers });
    },
    eliminate: (characterId) => {
      const racer = runtime.racers[characterId];
      if (!racer) return;
      racer.finished = true;
      racer.finishOrder = -1;
      runtime.eliminatedCharacterIds.push(characterId);
      runtime.callbacks.onRacersChange({ ...runtime.racers });
    },
    getRacer: (characterId) => runtime.racers[characterId],
    getAllRacers: () => Object.values(runtime.racers),
    addRollModifier: (characterId, amount) => {
      const racer = runtime.racers[characterId];
      if (!racer) return;
      racer.rollModifier += amount;
    },
    setFlatMoveOverride: (characterId, value) => {
      const racer = runtime.racers[characterId];
      if (!racer) return;
      racer.flatMoveOverride = value;
    },
    log,
    describe,
    decide: async (characterId, message, options) => {
      const owner = runtime.players[runtime.racers[characterId].ownerId];
      if (owner?.isHuman) {
        return runtime.callbacks.requestHumanDecision(characterId, message, options);
      }
      await runtime.callbacks.delay(400);
      return aiDecide(characterId, message, options, runtime);
    },
    isHazardTrack: runtime.track.hazardous,
    trackLength: runtime.track.length,
    custom: runtime.custom,
    grantBronzeChip: (characterId) => runtime.callbacks.onStarCollected(characterId),
    removeBronzeChip: (characterId) => runtime.callbacks.onStarRemoved(characterId),
    cancelPendingMove: () => {
      runtime.pendingMoveCancelled = true;
    },
    requestPriorityTurn: (characterId) => runtime.callbacks.requestPriorityTurn(characterId),
    getPreviousWinnerBaseIds: () => runtime.previousWinnerBaseIds,
  };

  return ctx;
}


