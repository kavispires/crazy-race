import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { getCharacter, makeCharacterPool, baseCharacterId } from '../data/characters';
import { CHIP_VALUES, TRACKS } from '../data/tracks';
import { buildContext, createInitialRacers, type RaceRuntime, type RaceRuntimeCallbacks } from '../engine/raceEngine';
import { isRaceOver, playTurn, useDiceReroll } from '../engine/turnResolver';
import { aiDraftPick, aiSecretSelect } from '../ai/ai';
import type {
  Decision,
  GamePhase,
  LogEntry,
  Player,
  RacerState,
  Track,
} from '../types';

/** How long to wait after the 2nd racer finishes, so its move/celebration animation can play before cutting to results. */
const FINISH_ANIMATION_DELAY_MS = 900;

/** Converts a 0-based index into a spreadsheet-style letter label: 0->A, 25->Z, 26->AA, 27->AB, ... */
function botLetter(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

interface DraftPick {
  playerId: string;
  round: number;
}

interface GameStore {
  phase: GamePhase;
  players: Player[];
  playerOrder: string[]; // ids, fixed seating order

  // Draft
  draftPool: string[];
  draftPickQueue: DraftPick[];
  draftRound: number; // 0 or 1 (two reveal rounds)
  round2Pool: string[]; // instance ids reserved for the second reveal round

  // Race setup
  raceIndex: number;
  track: Track;
  secretSelections: Record<string, string>; // playerId -> characterId, hidden until reveal
  secretSelectionOrderHint: string | null;
  firstPlayerId: string | null;

  // Live race
  racers: Record<string, RacerState>;
  turnOrder: string[]; // characterIds
  turnPointer: number;
  priorityQueue: string[]; // characterIds that should take the very next turn (Skipper, Genius)
  starsCollected: Record<string, number>; // playerId -> star count this race
  actionLog: LogEntry[];
  pendingDecision: Decision | null;
  isProcessingTurn: boolean;
  lastRaceResult: { first: string; second: string; raceIndex: number } | null;
  winnerBaseIdHistory: string[]; // base character ids that have won a race this game (for Twins)

  // internal (not for UI)
  _runtime: RaceRuntime | null;
  _decisionResolver: ((value: string) => void) | null;

  // Actions
  startGame: (humanName: string, aiCount: number) => void;
  draftPick: (characterId: string) => void;
  maybeAutoDraft: () => void;
  startSecretSelection: () => void;
  chooseSecretCharacter: (characterId: string) => void;
  beginRaceIfReady: () => void;
  advanceTurn: () => Promise<void>;
  resolveDecision: (value: string) => void;
  useReroll: () => Promise<void>;
  finishRace: () => void;
  proceedToNextRace: () => void;
  restart: () => void;
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSnakeQueue(playerIds: string[], round: number): DraftPick[] {
  const forward = playerIds.map((playerId) => ({ playerId, round }));
  const backward = [...playerIds].reverse().map((playerId) => ({ playerId, round }));
  return [...forward, ...backward];
}

function makeEmptyLog(message: string): LogEntry {
  return { id: uuid(), message, timestamp: Date.now(), kind: 'system' };
}

/**
 * Builds the live (non-serializable) callback set for a RaceRuntime. Extracted so it can be
 * rebuilt both when a race first begins and when a persisted game is rehydrated from
 * localStorage on page load (functions can't survive JSON serialization).
 */
function createRuntimeCallbacks(
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
): RaceRuntimeCallbacks {
  return {
    onLog: (entry) => set((s) => ({ actionLog: [...s.actionLog, entry] })),
    onRacersChange: (racers) => set({ racers: { ...racers } }),
    onStarCollected: (characterId) => {
      const ownerId = get().racers[characterId]?.ownerId;
      if (!ownerId) return;
      set((s) => ({
        starsCollected: { ...s.starsCollected, [ownerId]: (s.starsCollected[ownerId] ?? 0) + 1 },
      }));
    },
    onStarRemoved: (characterId) => {
      const ownerId = get().racers[characterId]?.ownerId;
      if (!ownerId) return;
      set((s) => ({
        starsCollected: {
          ...s.starsCollected,
          [ownerId]: Math.max(0, (s.starsCollected[ownerId] ?? 0) - 1),
        },
      }));
    },
    requestHumanDecision: (characterId, message, options) =>
      new Promise<string>((resolve) => {
        const ownerId = get().racers[characterId]?.ownerId ?? '';
        set({
          pendingDecision: { id: uuid(), characterId, ownerId, message, options },
          _decisionResolver: resolve,
        });
      }),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    requestPriorityTurn: (characterId) =>
      set((s) => ({ priorityQueue: [...s.priorityQueue, characterId] })),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  phase: 'setup',
  players: [],
  playerOrder: [],

  draftPool: [],
  draftPickQueue: [],
  draftRound: 0,
  round2Pool: [],

  raceIndex: 0,
  track: TRACKS[0],
  secretSelections: {},
  secretSelectionOrderHint: null,
  firstPlayerId: null,

  racers: {},
  turnOrder: [],
  turnPointer: 0,
  priorityQueue: [],
  starsCollected: {},
  actionLog: [],
  pendingDecision: null,
  isProcessingTurn: false,
  lastRaceResult: null,
  winnerBaseIdHistory: [],

  _runtime: null,
  _decisionResolver: null,

  startGame: (humanName, aiCount) => {
    const players: Player[] = [
      { id: 'human', name: humanName || 'You', isHuman: true, characterIds: [], usedCharacterIds: [], score: 0, chips: [] },
      ...Array.from({ length: aiCount }, (_, i) => ({
        id: `ai-${i}`,
        name: `Bot ${botLetter(i)}`,
        isHuman: false,
        characterIds: [],
        usedCharacterIds: [],
        score: 0,
        chips: [],
      })),
    ];
    const playerOrder = shuffled(players.map((p) => p.id));
    const orderedPlayers = playerOrder.map((id) => players.find((p) => p.id === id)!);

    // Each player needs exactly 4 racers by the end of the draft (2 reveal
    // rounds x 2 picks/player). With only 12 base characters, larger tables
    // reuse characters as extra "copies" (see makeCharacterPool).
    const totalNeeded = playerOrder.length * 4;
    const masterPool = shuffled(makeCharacterPool(totalNeeded));
    const perRound = playerOrder.length * 2;
    const draftPool = masterPool.slice(0, perRound);
    const round2Pool = masterPool.slice(perRound, perRound * 2);

    set({
      phase: 'draft',
      players: orderedPlayers,
      playerOrder,
      draftPool,
      round2Pool,
      draftPickQueue: buildSnakeQueue(playerOrder, 0),
      draftRound: 0,
      raceIndex: 0,
      track: TRACKS[0],
      actionLog: [makeEmptyLog(`The draft begins! ${draftPool.length} characters revealed.`)],
    });

    get().maybeAutoDraft();
  },

  draftPick: (characterId) => {
    const state = get();
    const [current, ...rest] = state.draftPickQueue;
    if (!current) return;
    if (!state.draftPool.includes(characterId)) return;

    const players = state.players.map((p) =>
      p.id === current.playerId ? { ...p, characterIds: [...p.characterIds, characterId] } : p,
    );
    const draftPool = state.draftPool.filter((id) => id !== characterId);
    const playerName = players.find((p) => p.id === current.playerId)?.name;
    const log = [
      ...state.actionLog,
      makeEmptyLog(`${playerName} drafts ${getCharacter(characterId).name}.`),
    ];

    if (rest.length === 0) {
      if (state.draftRound === 0) {
        set({
          players,
          draftPool: state.round2Pool,
          round2Pool: [],
          draftPickQueue: buildSnakeQueue(state.playerOrder, 1),
          draftRound: 1,
          actionLog: [...log, makeEmptyLog(`Round 2! ${state.round2Pool.length} more characters revealed.`)],
        });
        get().maybeAutoDraft();
        return;
      }
      // Draft complete -> move to secret selection for race 1.
      set({ players, draftPool: [], draftPickQueue: [], actionLog: log });
      get().startSecretSelection();
      return;
    }

    set({ players, draftPool, draftPickQueue: rest, actionLog: log });
    get().maybeAutoDraft();
  },

  maybeAutoDraft: () => {
    const state = get();
    const current = state.draftPickQueue[0];
    if (!current) return;
    const player = state.players.find((p) => p.id === current.playerId);
    if (!player || player.isHuman) return;
    const pick = aiDraftPick(state.draftPool);
    setTimeout(() => get().draftPick(pick), 350);
  },

  startSecretSelection: () => {
    set({ phase: 'secret-select', secretSelections: {} });
    // AI players pick immediately (hidden); human picks via UI.
    const state = get();
    for (const player of state.players) {
      if (player.isHuman) continue;
      const remaining = player.characterIds;
      if (remaining.length === 0) continue;
      const pick = aiSecretSelect(remaining, state.track.hazardous);
      set((s) => ({ secretSelections: { ...s.secretSelections, [player.id]: pick } }));
    }
  },

  chooseSecretCharacter: (characterId) => {
    const state = get();
    const human = state.players.find((p) => p.isHuman);
    if (!human) return;
    set({ secretSelections: { ...state.secretSelections, [human.id]: characterId } });
    get().beginRaceIfReady();
  },

  beginRaceIfReady: () => {
    const state = get();
    if (state.players.some((p) => !(p.id in state.secretSelections))) return;

    const owners: Record<string, string> = {};
    for (const [playerId, characterId] of Object.entries(state.secretSelections)) {
      owners[characterId] = playerId;
    }
    const racers = createInitialRacers(owners);

    // Turn order: race 1 = random (die-roll stand-in); later races = last-place player first.
    let orderedPlayerIds: string[];
    if (state.raceIndex === 0 || !state.firstPlayerId) {
      orderedPlayerIds = shuffled(state.playerOrder);
    } else {
      const idx = state.playerOrder.indexOf(state.firstPlayerId);
      orderedPlayerIds = [...state.playerOrder.slice(idx), ...state.playerOrder.slice(0, idx)];
    }
    const turnOrder = orderedPlayerIds.map((pid) => state.secretSelections[pid]);

    const playersById: Record<string, Player> = Object.fromEntries(state.players.map((p) => [p.id, p]));

    const runtime: RaceRuntime = {
      track: state.track,
      racers,
      players: playersById,
      finishOrderCounter: 0,
      finishedCharacterIds: [],
      eliminatedCharacterIds: [],
      rerollUsedThisTurn: false,
      custom: {},
      previousWinnerBaseIds: [...state.winnerBaseIdHistory],
      pendingMoveCancelled: false,
      callbacks: createRuntimeCallbacks(set, get),
    };

    set({
      phase: 'reveal',
      racers,
      turnOrder,
      turnPointer: 0,
      priorityQueue: [],
      starsCollected: {},
      _runtime: runtime,
      actionLog: [
        ...state.actionLog,
        makeEmptyLog(
          `Race ${state.raceIndex + 1} on ${state.track.name}: ` +
            turnOrder.map((cid) => getCharacter(cid).name).join(', ') +
            ' revealed!',
        ),
      ],
    });

    // Run any pre-race setup abilities (Egg's draw, Twins' copy, Boulder's
    // chips, Mastermind's prediction, ...) sequentially, then start the race.
    (async () => {
      const ctx = buildContext(runtime);
      for (const cid of turnOrder) {
        await getCharacter(cid).abilities.onRaceSetup?.(ctx, cid);
      }
      set({ phase: 'race' });
    })();
  },

  advanceTurn: async () => {
    const state = get();
    if (state.isProcessingTurn || state.phase !== 'race' || !state._runtime) return;
    const runtime = state._runtime;

    // Priority turns (Skipper, Genius) go before normal turn-order cycling.
    if (state.priorityQueue.length > 0) {
      const [characterId, ...restQueue] = state.priorityQueue;
      if (runtime.racers[characterId]?.finished) {
        set({ priorityQueue: restQueue });
        return;
      }
      set({ isProcessingTurn: true, priorityQueue: restQueue });
      const ctx = buildContext(runtime);
      await playTurn(runtime, ctx, characterId);
      set({ racers: { ...runtime.racers } });
      if (isRaceOver(runtime)) {
        // Let the finishing racer's move/celebration animation play before cutting to results.
        await new Promise((resolve) => setTimeout(resolve, FINISH_ANIMATION_DELAY_MS));
        set({ isProcessingTurn: false });
        get().finishRace();
        return;
      }
      set({ isProcessingTurn: false });
      return;
    }

    // Find next non-finished racer starting at turnPointer.
    let pointer = state.turnPointer;
    const order = state.turnOrder;
    let attempts = 0;
    while (attempts < order.length && runtime.racers[order[pointer % order.length]].finished) {
      pointer++;
      attempts++;
    }
    if (attempts >= order.length || isRaceOver(runtime)) {
      get().finishRace();
      return;
    }
    const characterId = order[pointer % order.length];

    set({ isProcessingTurn: true });
    const ctx = buildContext(runtime);
    await playTurn(runtime, ctx, characterId);
    set({ racers: { ...runtime.racers } });

    if (isRaceOver(runtime)) {
      // Let the finishing racer's move/celebration animation play before cutting to results.
      await new Promise((resolve) => setTimeout(resolve, FINISH_ANIMATION_DELAY_MS));
      set({ isProcessingTurn: false });
      get().finishRace();
      return;
    }

    set({ turnPointer: (pointer + 1) % order.length, isProcessingTurn: false });
  },

  useReroll: async () => {
    const state = get();
    if (!state._runtime) return;
    const order = state.turnOrder;
    const characterId = order[state.turnPointer % order.length];
    if (state._runtime.rerollUsedThisTurn) return;
    const ctx = buildContext(state._runtime);
    await useDiceReroll(state._runtime, ctx, characterId);
    set({ racers: { ...state._runtime.racers } });
  },

  resolveDecision: (value) => {
    const resolver = get()._decisionResolver;
    set({ pendingDecision: null, _decisionResolver: null });
    resolver?.(value);
  },

  finishRace: () => {
    const state = get();
    const runtime = state._runtime;
    if (!runtime) return;
    const finishers = Object.values(runtime.racers)
      .filter((r) => r.finishOrder !== null && r.finishOrder >= 0)
      .sort((a, b) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0));

    const first = finishers[0];
    const second = finishers[1];
    const chipValues = CHIP_VALUES[state.raceIndex];

    let players = state.players.map((p) => ({ ...p, chips: [...p.chips] }));
    if (first) {
      players = players.map((p) =>
        p.id === first.ownerId
          ? { ...p, chips: [...p.chips, { raceIndex: state.raceIndex, type: 'gold' as const, points: chipValues.gold }] }
          : p,
      );
    }
    if (second) {
      players = players.map((p) =>
        p.id === second.ownerId
          ? { ...p, chips: [...p.chips, { raceIndex: state.raceIndex, type: 'silver' as const, points: chipValues.silver }] }
          : p,
      );
    }
    for (const [playerId, count] of Object.entries(state.starsCollected)) {
      players = players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              chips: [
                ...p.chips,
                ...Array.from({ length: count }, () => ({ raceIndex: state.raceIndex, type: 'bronze' as const, points: 1 })),
              ],
            }
          : p,
      );
    }

    // Remove raced characters from their owners' remaining pool permanently.
    players = players.map((p) => {
      const raced = Object.entries(state.secretSelections).find(([pid]) => pid === p.id)?.[1];
      if (!raced) return p;
      return {
        ...p,
        characterIds: p.characterIds.filter((c) => c !== raced),
        usedCharacterIds: [...p.usedCharacterIds, raced],
        score: p.score + p.chips.filter((c) => c.raceIndex === state.raceIndex).reduce((a, c) => a + c.points, 0),
      };
    });

    // Determine who goes first next race: whoever's racer was furthest behind / eliminated.
    const active = Object.values(runtime.racers);
    const behindMost = [...active].sort((a, b) => {
      const aElim = a.finishOrder === -1;
      const bElim = b.finishOrder === -1;
      if (aElim && !bElim) return -1;
      if (bElim && !aElim) return 1;
      return a.position - b.position;
    })[0];

    set({
      players,
      phase: 'race-result',
      lastRaceResult: { first: first?.characterId ?? '', second: second?.characterId ?? '', raceIndex: state.raceIndex },
      firstPlayerId: behindMost?.ownerId ?? state.firstPlayerId,
      winnerBaseIdHistory: first
        ? [...state.winnerBaseIdHistory, baseCharacterId(first.characterId)]
        : state.winnerBaseIdHistory,
      priorityQueue: [],
    });
  },

  proceedToNextRace: () => {
    const state = get();
    const nextIndex = state.raceIndex + 1;
    if (nextIndex >= TRACKS.length) {
      const finalPlayers = [...state.players].sort((a, b) => b.score - a.score);
      set({ players: finalPlayers, phase: 'final' });
      return;
    }
    set({
      raceIndex: nextIndex,
      track: TRACKS[nextIndex],
      secretSelections: {},
      racers: {},
      turnOrder: [],
      turnPointer: 0,
      priorityQueue: [],
      starsCollected: {},
      _runtime: null,
      lastRaceResult: null,
      actionLog: [...state.actionLog, makeEmptyLog(`Flipping the board to ${TRACKS[nextIndex].name}!`)],
    });
    get().startSecretSelection();
  },

  restart: () => {
    set({
      phase: 'setup',
      players: [],
      playerOrder: [],
      draftPool: [],
      draftPickQueue: [],
      draftRound: 0,
      round2Pool: [],
      raceIndex: 0,
      track: TRACKS[0],
      secretSelections: {},
      firstPlayerId: null,
      racers: {},
      turnOrder: [],
      turnPointer: 0,
      priorityQueue: [],
      starsCollected: {},
      actionLog: [],
      pendingDecision: null,
      isProcessingTurn: false,
      lastRaceResult: null,
      winnerBaseIdHistory: [],
      _runtime: null,
      _decisionResolver: null,
    });
  },
    }),
    {
      name: 'magical-athlete-save',
      storage: createJSONStorage(() => localStorage),
      // `_decisionResolver` is a live function and can't survive JSON serialization; it's
      // dropped automatically by JSON.stringify, but we null it explicitly for clarity/typing.
      partialize: (state) => ({ ...state, _decisionResolver: null }),
      // On rehydration, `_runtime.callbacks` (functions) and `_decisionResolver` are lost, and
      // any in-flight turn/decision can't be resumed safely. Rebuild fresh callbacks bound to
      // the live store, and clear transient async flags so the player can simply continue.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        useGameStore.setState({
          isProcessingTurn: false,
          pendingDecision: null,
          _decisionResolver: null,
          _runtime: state._runtime
            ? { ...state._runtime, callbacks: createRuntimeCallbacks(useGameStore.setState, useGameStore.getState) }
            : null,
        });
      },
    },
  ),
);
