// Core domain types for Magical Athlete

export type GamePhase =
  | 'setup'
  | 'draft'
  | 'secret-select'
  | 'reveal'
  | 'race'
  | 'race-result'
  | 'final';

export type SpaceEffect =
  | { type: 'rock' }
  | { type: 'star' }
  | { type: 'arrow'; delta: number };

export interface Space {
  index: number;
  effect?: SpaceEffect;
  /** Decorative background color for the space tile (purely visual). */
  color?: string;
}

export interface Track {
  id: string;
  name: string;
  length: number;
  hazardous: boolean;
  spaces: Space[];
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  characterIds: string[]; // owned, unused characters remaining in the pool of 4
  usedCharacterIds: string[]; // characters already raced
  score: number;
  chips: Chip[];
}

export interface Chip {
  raceIndex: number;
  type: 'gold' | 'silver' | 'bronze';
  points: number;
}

/** Decision prompt shown to a human player (or auto-resolved for AI). */
export interface Decision {
  id: string;
  characterId: string;
  ownerId: string;
  message: string;
  options: { label: string; value: string }[];
}

export type LogKind = 'turn' | 'move' | 'ability' | 'hazard' | 'finish' | 'system';

export interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
  kind: LogKind;
}

/** Live state of a single racer within the current race. */
export interface RacerState {
  characterId: string;
  ownerId: string;
  position: number; // 0 = start line
  tripped: boolean;
  finished: boolean;
  finishOrder: number | null;
  rollModifier: number; // persists until consumed
  skipNextRoll: boolean;
  spacesMovedLastTurn: number;
  /** If set, overrides the die roll entirely with this flat move value (consumed once). */
  flatMoveOverride: number | null;
}

export interface AbilityContext {
  /** Move a racer forward/backward by delta spaces (handles pass/trip triggers). */
  move: (characterId: string, delta: number, opts?: { silent?: boolean }) => Promise<void>;
  setPosition: (characterId: string, position: number) => Promise<void>;
  setTripped: (characterId: string, tripped: boolean) => void;
  eliminate: (characterId: string) => void;
  getRacer: (characterId: string) => RacerState;
  getAllRacers: () => RacerState[];
  addRollModifier: (characterId: string, amount: number) => void;
  setFlatMoveOverride: (characterId: string, value: number) => void;
  log: (message: string, kind?: LogKind) => void;
  /** Human-readable "Character Name (Owner)" label for use in log messages. */
  describe: (characterId: string) => string;
  /** Ask the owning player (human=modal, AI=heuristic) to choose an option. */
  decide: (
    characterId: string,
    message: string,
    options: { label: string; value: string }[],
  ) => Promise<string>;
  isHazardTrack: boolean;
  trackLength: number;
}

export interface CharacterAbilities {
  /** Fired at the very start of a character's own turn, before rolling. */
  onTurnStart?: (ctx: AbilityContext, self: string) => Promise<void> | void;
  /** Modify the die roll for self before movement is applied. */
  onRoll?: (ctx: AbilityContext, self: string, roll: number) => Promise<number> | number;
  /** Fired whenever `self` passes another racer during a move. */
  onPass?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired whenever `self` is passed by another racer during a move. */
  onPassedBy?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired when self ends a move sharing a space with another racer. */
  onShareSpace?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired at the end of self's own turn. */
  onTurnEnd?: (ctx: AbilityContext, self: string) => Promise<void> | void;
  /** Fired whenever *any* character's ability resolves (including other characters). */
  onAbilityResolve?: (ctx: AbilityContext, trigger: string, self: string) => Promise<void> | void;
  /** Fired whenever any other player's turn ends, useful for reactive characters. */
  onOtherTurnEnd?: (ctx: AbilityContext, self: string, other: string, spacesMoved: number) => Promise<void> | void;
  /**
   * Fired for every racer (including the active one, with activeCharacterId === self)
   * whenever ANY racer's turn is about to start. Used for passive auras (e.g. Coach, Gunk).
   */
  onAnyTurnStart?: (ctx: AbilityContext, self: string, activeCharacterId: string) => Promise<void> | void;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  tier: number; // 1 (best) - 4 (worst), used by AI drafting heuristic
  abilities: CharacterAbilities;
}
