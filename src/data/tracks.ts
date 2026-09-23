import type { Space, SpaceEffect, Track } from '../types';

/** Palette of decorative tile colors, matching the original board's playful look. */
const TILE_COLORS = ['#4fc3e8', '#6fbe44', '#f5c93b', '#f0532a', '#f177c0'];

/** Assigns a decorative color to every space, avoiding repeating the same color twice in a row. */
function colorSpaces(spaces: Space[], seed: number): void {
  let lastColor = '';
  for (const space of spaces) {
    let color = TILE_COLORS[(space.index * 7 + seed) % TILE_COLORS.length];
    if (color === lastColor) {
      color = TILE_COLORS[(space.index * 7 + seed + 1) % TILE_COLORS.length];
    }
    space.color = color;
    lastColor = color;
  }
}

/** Builds a clean track with no hazard spaces, still visually colorful. */
function buildMildTrack(id: string, name: string, length: number, seed: number): Track {
  const spaces: Space[] = Array.from({ length: length + 1 }, (_, index) => ({ index }));
  colorSpaces(spaces, seed);
  return { id, name, length, hazardous: false, spaces };
}

/**
 * Builds a hazardous track with a fixed, evenly-spread set of special spaces
 * (rocks, arrows, stars) rather than a dense repeating pattern, mirroring how
 * the original physical board sprinkles just a handful of special tiles among
 * many plain colorful ones.
 */
function buildWildTrack(id: string, name: string, length: number, seed: number, hazards: SpaceEffect[]): Track {
  const spaces: Space[] = Array.from({ length: length + 1 }, (_, index) => ({ index }));
  colorSpaces(spaces, seed);

  const usedIndices = new Set<number>();
  const positions: number[] = [];
  const step = length / (hazards.length + 1);
  hazards.forEach((_effect, i) => {
    let pos = Math.round(step * (i + 1));
    pos = Math.max(1, Math.min(length - 1, pos));
    while (usedIndices.has(pos)) pos = Math.min(length - 1, pos + 1);
    usedIndices.add(pos);
    positions.push(pos);
  });

  // An arrow's forced landing space must never be another hazard space (e.g. a "-2" arrow
  // dropping a racer onto a trip/star tile) — that would silently double up two effects into
  // one confusing landing. If it does, nudge the arrow to the nearest free space whose landing
  // spot is plain, searching outward from its original position. Repeat until stable, since
  // resolving one arrow's conflict can shift it onto another arrow's landing spot.
  const arrowTarget = (pos: number, effect: Extract<SpaceEffect, { type: 'arrow' }>) =>
    Math.max(0, Math.min(length, pos + effect.delta));
  const hasConflict = (index: number, pos: number, effect: Extract<SpaceEffect, { type: 'arrow' }>) => {
    const target = arrowTarget(pos, effect);
    if (target === 0 || target === length) return false; // start/finish are safe, effect-free landings
    return positions.some((p, j) => j !== index && p === target);
  };
  for (let pass = 0, changed = true; changed && pass < hazards.length * 2; pass++) {
    changed = false;
    hazards.forEach((effect, i) => {
      if (effect.type !== 'arrow' || !hasConflict(i, positions[i], effect)) return;
      for (let radius = 1; radius < length; radius++) {
        const candidates = [positions[i] - radius, positions[i] + radius];
        const candidate = candidates.find(
          (pos) => pos >= 1 && pos <= length - 1 && !usedIndices.has(pos) && !hasConflict(i, pos, effect),
        );
        if (candidate === undefined) continue;
        usedIndices.delete(positions[i]);
        usedIndices.add(candidate);
        positions[i] = candidate;
        changed = true;
        break;
      }
    });
  }

  hazards.forEach((effect, i) => {
    spaces[positions[i]].effect = effect;
  });

  return { id, name, length, hazardous: true, spaces };
}

export const DEFAULT_TRACK_LENGTH = 30;
export const TRACK_LENGTH_OPTIONS = [10, 15, 20, 30] as const;

const WILD_HAZARDS_1: SpaceEffect[] = [
  { type: 'star' },
  { type: 'rock' },
  { type: 'arrow', delta: 3 },
  { type: 'rock' },
  { type: 'arrow', delta: -2 },
  { type: 'arrow', delta: 1 },
  { type: 'rock' },
  { type: 'arrow', delta: -4 },
  { type: 'arrow', delta: 2 },
  { type: 'star' },
];

const WILD_HAZARDS_2: SpaceEffect[] = [
  { type: 'star' },
  { type: 'rock' },
  { type: 'arrow', delta: 4 },
  { type: 'rock' },
  { type: 'arrow', delta: -2 },
  { type: 'star' },
  { type: 'arrow', delta: 1 },
  { type: 'rock' },
  { type: 'arrow', delta: -4 },
  { type: 'arrow', delta: 3 },
  { type: 'rock' },
  { type: 'arrow', delta: -3 },
  { type: 'arrow', delta: 2 },
  { type: 'star' },
];

/**
 * The hazard templates above were tuned for the default 30-space track. On shorter tracks there
 * isn't room for that many special spaces, so scale the hazard count down proportionally
 * (sampling evenly across the template to keep a similar mix of rocks/arrows/stars) rather than
 * cramming them in and risking every space being a hazard.
 */
function scaleHazards(hazards: SpaceEffect[], length: number): SpaceEffect[] {
  const targetCount = Math.max(2, Math.min(hazards.length, Math.round((hazards.length * length) / DEFAULT_TRACK_LENGTH)));
  if (targetCount >= hazards.length) return hazards;
  return Array.from({ length: targetCount }, (_, i) => {
    const idx = Math.round((i * (hazards.length - 1)) / Math.max(1, targetCount - 1));
    return hazards[Math.min(hazards.length - 1, idx)];
  });
}

/** Builds the full 4-race track set at the given track length. */
export function buildTracks(length: number = DEFAULT_TRACK_LENGTH): Track[] {
  return [
    buildMildTrack('track-1', 'Mild Mile I', length, 0),
    buildWildTrack('track-2', 'Wild Wilds I', length, 1, scaleHazards(WILD_HAZARDS_1, length)),
    buildMildTrack('track-3', 'Mild Mile II', length, 2),
    buildWildTrack('track-4', 'Wild Wilds II', length, 3, scaleHazards(WILD_HAZARDS_2, length)),
  ];
}

export const TRACKS: Track[] = buildTracks(DEFAULT_TRACK_LENGTH);

/** Chip point values scale up with each subsequent race (index 0-3). */
export const CHIP_VALUES: { gold: number; silver: number; bronze: number }[] = [
  { gold: 3, silver: 1, bronze: 1 },
  { gold: 4, silver: 2, bronze: 1 },
  { gold: 5, silver: 3, bronze: 2 },
  { gold: 6, silver: 4, bronze: 2 },
];

