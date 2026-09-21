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
  const step = length / (hazards.length + 1);
  hazards.forEach((effect, i) => {
    let pos = Math.round(step * (i + 1));
    pos = Math.max(1, Math.min(length - 1, pos));
    while (usedIndices.has(pos)) pos = Math.min(length - 1, pos + 1);
    usedIndices.add(pos);
    spaces[pos].effect = effect;
  });

  return { id, name, length, hazardous: true, spaces };
}

export const TRACKS: Track[] = [
  buildMildTrack('track-1', 'Mild Mile I', 40, 0),
  buildWildTrack('track-2', 'Wild Wilds I', 45, 1, [
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
  ]),
  buildMildTrack('track-3', 'Mild Mile II', 50, 2),
  buildWildTrack('track-4', 'Wild Wilds II', 55, 3, [
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
  ]),
];

/** Chip point values scale up with each subsequent race (index 0-3). */
export const CHIP_VALUES: { gold: number; silver: number; bronze: number }[] = [
  { gold: 3, silver: 1, bronze: 1 },
  { gold: 4, silver: 2, bronze: 1 },
  { gold: 5, silver: 3, bronze: 2 },
  { gold: 6, silver: 4, bronze: 2 },
];

