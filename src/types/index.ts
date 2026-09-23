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
  /** Optional alternate phrasing used only for spoken narration; falls back to `message` if unset. */
  narration?: string;
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
  /** Character ids whose ability contributed to `rollModifier`, for log attribution (e.g. "adjusted to 0 because of Slime"). */
  rollModifierSources: string[];
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
  /** `sourceCharacterId` (usually the ability's own `self`) is recorded for log attribution when the roll is later adjusted. */
  addRollModifier: (characterId: string, amount: number, sourceCharacterId?: string) => void;
  setFlatMoveOverride: (characterId: string, value: number) => void;
  log: (message: string, kind?: LogKind, narration?: string) => void;
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
  /** Free-form per-character scratch space that persists for the whole race (predictions, borrowed abilities, flags). */
  custom: Record<string, Record<string, unknown>>;
  /** Awards a bronze (+1 point) chip to a racer's owner, same as landing on a star tile. */
  grantBronzeChip: (characterId: string) => void;
  removeBronzeChip: (characterId: string) => void;
  /** Cancels the active racer's pending main move for this turn (used reactively, e.g. Worm). */
  cancelPendingMove: () => void;
  /** Requests that `characterId` take the very next turn, ahead of normal turn order (Skipper, Genius). */
  requestPriorityTurn: (characterId: string) => void;
  /** Base character ids that won a previous race this game (for Twins). */
  getPreviousWinnerBaseIds: () => string[];
}

export interface CharacterAbilities {
  /** Fired once at the very start of a race, before any turns are taken (setup/pre-race choices). */
  onRaceSetup?: (ctx: AbilityContext, self: string) => Promise<void> | void;
  /** Fired at the very start of a character's own turn, before rolling. */
  onTurnStart?: (ctx: AbilityContext, self: string) => Promise<void> | void;
  /** Modify the die roll for self before movement is applied. */
  onRoll?: (ctx: AbilityContext, self: string, roll: number) => Promise<number> | number;
  /** Fired to every other still-active racer right after `roller`'s roll is finalized, before movement. */
  onAnyRoll?: (ctx: AbilityContext, self: string, roller: string, roll: number) => Promise<void> | void;
  /** Fired to every other still-active racer right before `roller` rolls the die for their main move (not fired for flat-move overrides). */
  onBeforeAnyRoll?: (ctx: AbilityContext, self: string, roller: string) => Promise<void> | void;
  /** Fired whenever `self` passes another racer during a move. */
  onPass?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired whenever `self` is passed by another racer during a move. */
  onPassedBy?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired when self ends a move sharing a space with another racer (fires for both parties). */
  onShareSpace?: (ctx: AbilityContext, self: string, other: string) => Promise<void> | void;
  /** Fired to every third-party racer whenever exactly two racers end up sharing a space. */
  onAnyShareSpace?: (ctx: AbilityContext, self: string, moverId: string, otherId: string) => Promise<void> | void;
  /** Fired to a stationary racer sharing self's old space when self departs it. */
  onSharedDeparture?: (ctx: AbilityContext, self: string, mover: string) => Promise<void> | void;
  /** Lets a passive racer redirect where another racer is about to land (e.g. Baby). Return the adjusted position, or undefined to leave unchanged. */
  adjustLanding?: (
    ctx: AbilityContext,
    self: string,
    mover: string,
    proposedPosition: number,
  ) => number | undefined | Promise<number | undefined>;
  /** If true, this racer's forward/backward move skips over any space currently occupied by another racer. */
  skipOccupiedSpaces?: boolean;
  /** If true, while this racer is active and unfinished, other racers cannot overshoot the finish line (exact landing required). */
  blocksOvershoot?: boolean;
  /** If true, this racer is completely unaffected by every other character's ability, and is never considered to be sharing a space with anyone. */
  immune?: boolean;
  /** Fired at the end of self's own turn. */
  onTurnEnd?: (ctx: AbilityContext, self: string) => Promise<void> | void;
  /** Fired whenever *any* character's ability resolves (including other characters). */
  onAbilityResolve?: (ctx: AbilityContext, trigger: string, self: string) => Promise<void> | void;
  /** Fired whenever any other player's turn ends, useful for reactive characters. */
  onOtherTurnEnd?: (ctx: AbilityContext, self: string, other: string, spacesMoved: number) => Promise<void> | void;
  /**
   * Fired for every racer (including the active one, with activeCharacterId === self)
   * whenever ANY racer's turn is about to start. Used for passive auras (e.g. Coach, Slime).
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
