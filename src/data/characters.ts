import type { Character } from '../types';

/**
 * The 12 starter roster characters. Ability logic mirrors the pseudo-code from
 * the game plan, implemented against the shared `AbilityContext` so the
 * engine can resolve chain reactions (movement, tripping, elimination, and
 * follow-up prompts) consistently for every character.
 */
export const CHARACTERS: Character[] = [
  {
    id: 'alchemist',
    name: 'Alchemist',
    description: 'On a roll of 1-2, may transmute the roll into a flat move of 4.',
    tier: 2,
    abilities: {
      onRoll: async (ctx, self, roll) => {
        if (roll > 2) return roll;
        const choice = await ctx.decide(self, 'Alchemist rolled low. Transmute into a move of 4?', [
          { label: 'Yes, move 4', value: 'yes' },
          { label: 'No, keep roll', value: 'no' },
        ]);
        if (choice === 'yes') {
          ctx.log(`⚗️ ${ctx.describe(self)} transmutes the roll into a move of 4!`);
          return 4;
        }
        return roll;
      },
    },
  },
  {
    id: 'banana',
    name: 'Banana',
    description: 'Anyone who passes the Banana slips and trips.',
    tier: 3,
    abilities: {
      onPassedBy: (ctx, self, other) => {
        ctx.setTripped(other, true);
        ctx.log(`🍌 ${ctx.describe(other)} slips on ${ctx.describe(self)}'s peel and trips!`);
      },
    },
  },
  {
    id: 'centaur',
    name: 'Centaur',
    description: 'Charges past anyone it passes, knocking them back 2 spaces.',
    tier: 2,
    abilities: {
      onPass: async (ctx, self, other) => {
        ctx.log(`🐎 ${ctx.describe(self)} charges past, knocking ${ctx.describe(other)} back 2 spaces!`);
        await ctx.move(other, -2);
      },
    },
  },
  {
    id: 'cheerleader',
    name: 'Cheerleader',
    description: 'Can rally whoever is in last place (+2) at the cost of her own move (+1).',
    tier: 3,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const choice = await ctx.decide(
          self,
          'Give last place a +2 boost, but only move +1 yourself this turn?',
          [
            { label: 'Yes, rally the team', value: 'yes' },
            { label: 'No, race normally', value: 'no' },
          ],
        );
        if (choice !== 'yes') return;
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        if (others.length === 0) return;
        const last = others.reduce((a, b) => (a.position <= b.position ? a : b));
        ctx.addRollModifier(last.characterId, 2);
        ctx.setFlatMoveOverride(self, 1);
        ctx.log(
          `📣 ${ctx.describe(self)} rallies ${ctx.describe(last.characterId)} (+2 next roll) but only moves 1 herself!`,
        );
      },
    },
  },
  {
    id: 'coach',
    name: 'Coach',
    description: 'Anyone sharing a space with the Coach gets +1 to their roll.',
    tier: 2,
    abilities: {
      onAnyTurnStart: (ctx, self, activeCharacterId) => {
        if (activeCharacterId === self) return;
        const coach = ctx.getRacer(self);
        const active = ctx.getRacer(activeCharacterId);
        if (coach.finished || active.finished) return;
        if (coach.position === active.position) {
          ctx.addRollModifier(activeCharacterId, 1);
          ctx.log(`📋 ${ctx.describe(self)} coaches ${ctx.describe(activeCharacterId)} up: +1 to the roll!`);
        }
      },
    },
  },
  {
    id: 'dicemonger',
    name: 'Dicemonger',
    description: 'Offers a once-per-turn reroll to anyone; moves 1 whenever someone else uses it.',
    tier: 2,
    abilities: {
      // Reroll usage is handled globally by the engine (see engine/turnResolver.ts),
      // which calls notifyDicemongerReroll() whenever another racer rerolls.
    },
  },
  {
    id: 'duelist',
    name: 'Duelist',
    description: 'May challenge anyone sharing a space to a dice duel; the loser trips.',
    tier: 3,
    abilities: {
      onShareSpace: async (ctx, self, other) => {
        const choice = await ctx.decide(self, `Challenge ${ctx.describe(other)} to a duel?`, [
          { label: 'Duel!', value: 'yes' },
          { label: 'Let it go', value: 'no' },
        ]);
        if (choice !== 'yes') return;
        const selfRoll = 1 + Math.floor(Math.random() * 6);
        const otherRoll = 1 + Math.floor(Math.random() * 6);
        ctx.log(`⚔️ Duel! ${ctx.describe(self)} rolls ${selfRoll}, ${ctx.describe(other)} rolls ${otherRoll}.`);
        if (selfRoll === otherRoll) {
          ctx.log('⚔️ The duel ends in a tie. No one trips.');
          return;
        }
        const loser = selfRoll > otherRoll ? other : self;
        ctx.setTripped(loser, true);
        ctx.log(`⚔️ ${ctx.describe(loser)} loses the duel and trips!`);
      },
    },
  },
  {
    id: 'gunk',
    name: 'Gunk',
    description: 'A sticky aura slows every other racer by -1 on their rolls.',
    tier: 1,
    abilities: {
      onAnyTurnStart: (ctx, self, activeCharacterId) => {
        if (activeCharacterId === self) return;
        const gunk = ctx.getRacer(self);
        if (gunk.finished) return;
        ctx.addRollModifier(activeCharacterId, -1);
      },
    },
  },
  {
    id: 'heckler',
    name: 'Heckler',
    description: 'Mocks anyone who barely moves, hopping ahead 2 spaces whenever they do.',
    tier: 3,
    abilities: {
      onOtherTurnEnd: (ctx, self, other, spacesMoved) => {
        if (spacesMoved > 1) return;
        ctx.log(`😝 ${ctx.describe(self)} jeers at ${ctx.describe(other)}'s puny move and hops ahead 2 spaces!`);
        void ctx.move(self, 2);
      },
    },
  },
  {
    id: 'mouth',
    name: 'M.O.U.T.H.',
    description: 'If exactly one other racer shares its space at end of turn, eliminates them.',
    tier: 4,
    abilities: {
      onTurnEnd: (ctx, self) => {
        const mouth = ctx.getRacer(self);
        const sharing = ctx
          .getAllRacers()
          .filter((r) => r.characterId !== self && !r.finished && r.position === mouth.position);
        if (sharing.length === 1) {
          ctx.log(`👄 ${ctx.describe(self)} devours ${ctx.describe(sharing[0].characterId)}!`);
          ctx.eliminate(sharing[0].characterId);
        }
      },
    },
  },
  {
    id: 'rocket-scientist',
    name: 'Rocket Scientist',
    description: 'Doubles every roll, but trips after each launch.',
    tier: 1,
    abilities: {
      onRoll: (ctx, self, roll) => {
        ctx.log(`🚀 ${ctx.describe(self)} doubles the roll for a huge launch!`);
        return roll * 2;
      },
      onTurnEnd: (ctx, self) => {
        ctx.setTripped(self, true);
        ctx.log(`🚀 ${ctx.describe(self)} trips after the launch!`);
      },
    },
  },
  {
    id: 'scoocher',
    name: 'Scoocher',
    description: 'Scoots forward 1 space whenever another character resolves an ability.',
    tier: 2,
    abilities: {
      onAbilityResolve: (ctx, trigger, self) => {
        if (trigger === self) return;
        void ctx.move(self, 1, { silent: true });
        ctx.log(`🐾 ${ctx.describe(self)} scoots forward 1 space!`);
      },
    },
  },
];

export const CHARACTER_MAP: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

/**
 * With only 12 base characters, supporting large player counts (N > 3, since
 * each player needs 4 unique racers = 4N cards) requires reusing characters
 * across multiple physical "copies". Drafted cards therefore use instance ids
 * of the form `${baseId}` for the first copy and `${baseId}::${cycle}` for
 * additional copies, keeping abilities identical while giving each drafted
 * card a unique identity in the race/draft state.
 */
const INSTANCE_SEPARATOR = '::';

export function baseCharacterId(instanceId: string): string {
  const idx = instanceId.indexOf(INSTANCE_SEPARATOR);
  return idx === -1 ? instanceId : instanceId.slice(0, idx);
}

export function getCharacter(instanceId: string): Character {
  const character = CHARACTER_MAP[baseCharacterId(instanceId)];
  if (!character) throw new Error(`Unknown character instance id: ${instanceId}`);
  return character;
}

/** Builds a pool of `totalNeeded` unique instance ids, cycling through the roster as needed. */
export function makeCharacterPool(totalNeeded: number): string[] {
  const pool: string[] = [];
  let cycle = 0;
  while (pool.length < totalNeeded) {
    for (const c of CHARACTERS) {
      if (pool.length >= totalNeeded) break;
      pool.push(cycle === 0 ? c.id : `${c.id}${INSTANCE_SEPARATOR}${cycle}`);
    }
    cycle++;
  }
  return pool;
}

