import { getCharacter } from '../data/characters';
import type { RaceRuntime } from '../engine/raceEngine';

/** Sorts a pool of character ids by tier (1 = best) for the AI draft heuristic. */
export function aiDraftPick(available: string[]): string {
  const sorted = [...available].sort((a, b) => getCharacter(a).tier - getCharacter(b).tier);
  // Mostly greedy, but occasionally take the 2nd-best pick to avoid fully predictable drafts.
  if (sorted.length > 1 && Math.random() < 0.2) return sorted[1];
  return sorted[0];
}

/** Weighted-random secret selection, favoring stronger characters on hazardous tracks. */
export function aiSecretSelect(remaining: string[], isHazardTrack: boolean): string {
  const weights = remaining.map((id) => {
    const tier = getCharacter(id).tier; // 1 (best) .. 4 (worst)
    const base = 5 - tier; // 4..1
    return isHazardTrack ? base * base : base;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < remaining.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return remaining[i];
  }
  return remaining[remaining.length - 1];
}

/**
 * Simple AI heuristic for in-race optional decisions: "does this help me get
 * closer to the finish, or does it hurt whoever is currently in the lead?"
 * Since most prompts here are binary (do the beneficial thing or not), the AI
 * leans towards the proactive option most of the time.
 */
export function aiDecide(
  characterId: string,
  message: string,
  options: { label: string; value: string }[],
  runtime: RaceRuntime,
): string {
  // For prompts with more than a simple yes/no (e.g. "pick a racer", "pick a space",
  // "predict a number"), fall back to a random pick among the offered options.
  if (options.length > 2) {
    return options[Math.floor(Math.random() * options.length)].value;
  }

  const affirmative = options.find((o) => o.value === 'yes') ?? options[0];
  const decline = options.find((o) => o.value === 'no') ?? options[options.length - 1];

  const lowerMsg = message.toLowerCase();
  let yesChance = 0.6;

  if (lowerMsg.includes('transmute')) {
    yesChance = 0.95; // guaranteed upgrade from a low roll
  } else if (lowerMsg.includes('duel')) {
    const self = runtime.racers[characterId];
    const leader = Object.values(runtime.racers)
      .filter((r) => !r.finished)
      .sort((a, b) => b.position - a.position)[0];
    // More willing to gamble when behind the leader.
    yesChance = leader && self.position < leader.position ? 0.65 : 0.4;
  } else if (lowerMsg.includes('rally')) {
    yesChance = 0.5;
  }

  return Math.random() < yesChance ? affirmative.value : decline.value;
}
