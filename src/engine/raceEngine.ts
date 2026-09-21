import { v4 as uuid } from 'uuid';
import type { AbilityContext, Character, LogEntry, LogKind, Player, RacerState, Track } from '../types';
import { getCharacter } from '../data/characters';
import { aiDecide } from '../ai/ai';

export interface RaceRuntimeCallbacks {
  onLog: (entry: LogEntry) => void;
  onRacersChange: (racers: Record<string, RacerState>) => void;
  onStarCollected: (characterId: string) => void;
  /** Pause the turn and wait for a human to answer via the UI. */
  requestHumanDecision: (
    characterId: string,
    message: string,
    options: { label: string; value: string }[],
  ) => Promise<string>;
  /** Small artificial delay so AI moves are visible to the player. */
  delay: (ms: number) => Promise<void>;
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
      const abilities = character(racer.characterId).abilities;
      abilities.onAbilityResolve?.(ctx, triggerId, racer.characterId);
    }
  };

  const move = async (characterId: string, delta: number, opts?: { silent?: boolean }) => {
    const racer = runtime.racers[characterId];
    if (!racer || racer.finished) return;
    const from = racer.position;
    let to = from + delta;
    if (to < 0) to = 0;

    const forward = delta > 0;
    const passedCharacterIds = Object.values(runtime.racers)
      .filter((r) => r.characterId !== characterId && !r.finished)
      .filter((r) => (forward ? r.position > from && r.position < to : r.position < from && r.position > to))
      .map((r) => r.characterId);

    racer.position = to >= runtime.track.length ? runtime.track.length : to;
    runtime.callbacks.onRacersChange({ ...runtime.racers });

    if (!opts?.silent) {
      for (const otherId of passedCharacterIds) {
        const selfAbilities = character(characterId).abilities;
        const otherAbilities = character(otherId).abilities;
        await selfAbilities.onPass?.(ctx, characterId, otherId);
        notifyAbilityResolve(characterId);
        await otherAbilities.onPassedBy?.(ctx, otherId, characterId);
        notifyAbilityResolve(otherId);
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
        await move(characterId, space.effect.delta, { silent: opts?.silent });
        return;
      }
    }

    // Shared-space resolution.
    if (!opts?.silent) {
      const sharing = Object.values(runtime.racers).filter(
        (r) => r.characterId !== characterId && !r.finished && r.position === racer.position,
      );
      for (const other of sharing) {
        const selfAbilities = character(characterId).abilities;
        await selfAbilities.onShareSpace?.(ctx, characterId, other.characterId);
        notifyAbilityResolve(characterId);
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
  };

  return ctx;
}


