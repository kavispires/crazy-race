import type { AbilityContext, Character } from '../types';

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
          .filter((r) => r.characterId !== self && !r.finished && r.position === mouth.position && !isImmuneRacer(r.characterId));
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
  {
    id: 'baba-yaga',
    name: 'Baba Yaga',
    description: 'Trips any racer that stops on her space, or that she stops on.',
    tier: 2,
    abilities: {
      onShareSpace: (ctx, self, other) => {
        ctx.setTripped(other, true);
        ctx.log(`🧙‍♀️ ${ctx.describe(other)} stumbles into ${ctx.describe(self)}'s hut and trips!`);
      },
    },
  },
  {
    id: 'blimp',
    name: 'Blimp',
    description: 'Before the halfway point, +3 to the main move. After, -1.',
    tier: 2,
    abilities: {
      onTurnStart: (ctx, self) => {
        const halfway = ctx.trackLength / 2;
        const position = ctx.getRacer(self).position;
        if (position < halfway) {
          ctx.addRollModifier(self, 3);
          ctx.log(`🎈 ${ctx.describe(self)} floats ahead of the halfway point: +3 to the roll!`);
        } else {
          ctx.addRollModifier(self, -1);
          ctx.log(`🎈 ${ctx.describe(self)} is past the halfway point and deflates a little: -1 to the roll.`);
        }
      },
    },
  },
  {
    id: 'copy-cat',
    name: 'Copy Cat',
    description: "Has the power of whichever racer is currently in the lead (ties broken automatically).",
    tier: 1,
    abilities: {
      // Delegation is handled dynamically by effectiveCharacter() in raceEngine.ts, which
      // resolves the current position-leader's abilities for every hook call.
    },
  },
  {
    id: 'egg',
    name: 'Egg',
    description: 'At the start of the race, draws 3 random racers and permanently takes on one of their powers.',
    tier: 2,
    abilities: {
      onRaceSetup: async (ctx, self) => {
        const candidates = CHARACTERS.filter((c) => c.id !== 'egg' && c.id !== 'copy-cat');
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const drawn = shuffled.slice(0, 3);
        if (drawn.length === 0) return;
        const choice = await ctx.decide(
          self,
          'Egg hatches! Pick a power to be born with:',
          drawn.map((c) => ({ label: c.name, value: c.id })),
        );
        const picked = drawn.find((c) => c.id === choice) ?? drawn[0];
        ctx.custom[self] = { ...ctx.custom[self], borrowedBaseId: picked.id };
        ctx.log(`🥚 ${ctx.describe(self)} hatches with the power of ${picked.name}!`);
      },
    },
  },
  {
    id: 'flip-flop',
    name: 'Flip Flop',
    description: 'Can skip rolling and instead swap spaces with another racer.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        if (others.length === 0) return;
        const choice = await ctx.decide(self, 'Roll normally, or flip-flop spaces with someone?', [
          { label: 'Roll normally', value: 'roll' },
          { label: 'Swap spaces', value: 'swap' },
        ]);
        if (choice !== 'swap') return;
        const targetId = await ctx.decide(
          self,
          'Swap spaces with whom?',
          others.map((r) => ({ label: ctx.describe(r.characterId), value: r.characterId })),
        );
        const target = others.find((r) => r.characterId === targetId) ?? others[0];
        const selfPos = ctx.getRacer(self).position;
        const targetPos = target.position;
        await ctx.setPosition(self, targetPos);
        await ctx.setPosition(target.characterId, selfPos);
        ctx.log(`🩴 ${ctx.describe(self)} flip-flops spaces with ${ctx.describe(target.characterId)}!`);
        ctx.setFlatMoveOverride(self, 0);
      },
    },
  },
  {
    id: 'genius',
    name: 'Genius',
    description: 'Predicts its roll before rolling; if correct, takes another turn immediately after.',
    tier: 1,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const guess = await ctx.decide(
          self,
          'Predict your roll (1-6). Guess right and take another turn!',
          [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: String(n) })),
        );
        ctx.custom[self] = { ...ctx.custom[self], geniusPrediction: Number(guess) };
      },
      onRoll: (ctx, self, roll) => {
        const prediction = ctx.custom[self]?.geniusPrediction;
        if (typeof prediction === 'number' && prediction === roll) {
          ctx.custom[self] = { ...ctx.custom[self], geniusExtraTurn: true };
          ctx.log(`🧠 ${ctx.describe(self)} predicted ${prediction} correctly! Another turn is coming.`);
        }
        return roll;
      },
    },
  },
  {
    id: 'hare',
    name: 'Hare',
    description: '+2 to the main move. If alone in the lead at the start of a turn, skips the move for a bronze chip instead.',
    tier: 2,
    abilities: {
      onTurnStart: (ctx, self) => {
        if (isAloneInLead(ctx, self)) {
          ctx.grantBronzeChip(self);
          ctx.setFlatMoveOverride(self, 0);
          ctx.log(`🐇 ${ctx.describe(self)} is alone in the lead and takes a victory lap chip instead of moving!`);
          return;
        }
        ctx.addRollModifier(self, 2);
        ctx.log(`🐇 ${ctx.describe(self)} bounds ahead: +2 to the roll!`);
      },
    },
  },
  {
    id: 'huge-baby',
    name: 'Huge Baby',
    description: 'No one else may share its space (except the start). They land one space behind instead.',
    tier: 2,
    abilities: {
      adjustLanding: (ctx, self, mover, proposedPosition) => {
        if (mover === self) return undefined;
        if (proposedPosition === 0) return undefined;
        const babyPos = ctx.getRacer(self).position;
        if (!ctx.getRacer(self).finished && proposedPosition === babyPos) {
          ctx.log(`👶 ${ctx.describe(self)} won't share the space! ${ctx.describe(mover)} lands just behind instead.`);
          return Math.max(0, babyPos - 1);
        }
        return undefined;
      },
    },
  },
  {
    id: 'hypnotist',
    name: 'Hypnotist',
    description: 'At the start of its turn, may warp another racer to its space.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        if (others.length === 0) return;
        const choice = await ctx.decide(self, 'Hypnotize a racer to warp them to your space?', [
          { label: 'Yes, hypnotize', value: 'yes' },
          { label: 'No', value: 'no' },
        ]);
        if (choice !== 'yes') return;
        const targetId = await ctx.decide(
          self,
          'Warp whom to your space?',
          others.map((r) => ({ label: ctx.describe(r.characterId), value: r.characterId })),
        );
        const target = others.find((r) => r.characterId === targetId) ?? others[0];
        await ctx.setPosition(target.characterId, ctx.getRacer(self).position);
        ctx.log(`🌀 ${ctx.describe(self)} hypnotizes ${ctx.describe(target.characterId)} into warping over!`);
      },
    },
  },
  {
    id: 'inchworm',
    name: 'Inchworm',
    description: "Whenever another racer rolls a 1, cancels their move and inches forward 1 itself.",
    tier: 3,
    abilities: {
      onAnyRoll: (ctx, self, roller, roll) => {
        if (roller === self || roll !== 1) return;
        ctx.cancelPendingMove();
        void ctx.move(self, 1);
        ctx.log(`🐛 ${ctx.describe(roller)} rolled a 1! ${ctx.describe(self)} cancels it and inches forward.`);
      },
    },
  },
  {
    id: 'lackey',
    name: 'Lackey',
    description: 'Whenever another racer rolls a 6, moves 2 before they move.',
    tier: 3,
    abilities: {
      onAnyRoll: async (ctx, self, roller, roll) => {
        if (roller === self || roll !== 6) return;
        ctx.log(`🙇 ${ctx.describe(roller)} rolled a 6! ${ctx.describe(self)} scurries ahead 2 first.`);
        await ctx.move(self, 2);
      },
    },
  },
  {
    id: 'legs',
    name: 'Legs',
    description: 'Can skip rolling for the main move and move exactly 5 instead.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const choice = await ctx.decide(self, 'Roll normally, or use Legs to move exactly 5?', [
          { label: 'Roll normally', value: 'roll' },
          { label: 'Move 5', value: 'move5' },
        ]);
        if (choice !== 'move5') return;
        ctx.setFlatMoveOverride(self, 5);
        ctx.log(`🦵 ${ctx.describe(self)} strides forward exactly 5 spaces!`);
      },
    },
  },
  {
    id: 'leaptoad',
    name: 'Leaptoad',
    description: 'While moving, hops over any space that has another racer on it.',
    tier: 2,
    abilities: {
      skipOccupiedSpaces: true,
    },
  },
  {
    id: 'lovable-loser',
    name: 'Lovable Loser',
    description: 'At the start of its turn, gets a bronze chip if alone in last place.',
    tier: 4,
    abilities: {
      onTurnStart: (ctx, self) => {
        if (isAloneInLast(ctx, self)) {
          ctx.grantBronzeChip(self);
          ctx.log(`🥺 ${ctx.describe(self)} is alone in last place and earns a sympathy chip.`);
        }
      },
    },
  },
  {
    id: 'magician',
    name: 'Magician',
    description: 'Can reroll its main move up to twice per turn.',
    tier: 2,
    abilities: {
      onRoll: async (ctx, self, roll) => {
        let current = roll;
        for (let i = 0; i < 2; i++) {
          const choice = await ctx.decide(self, `Current roll: ${current}. Reroll it (${2 - i} left)?`, [
            { label: 'Reroll', value: 'yes' },
            { label: 'Keep it', value: 'no' },
          ]);
          if (choice !== 'yes') break;
          current = 1 + Math.floor(Math.random() * 6);
          ctx.log(`🎩 ${ctx.describe(self)} waves a wand and rerolls: ${current}!`);
        }
        return current;
      },
    },
  },
  {
    id: 'mastermind',
    name: 'Mastermind',
    description: 'Before the race, predicts the winner. If correct, the race ends immediately and it finishes 2nd.',
    tier: 1,
    abilities: {
      onRaceSetup: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self);
        if (others.length === 0) return;
        const choice = await ctx.decide(
          self,
          'Predict the winner of this race:',
          others.map((r) => ({ label: ctx.describe(r.characterId), value: r.characterId })),
        );
        ctx.custom[self] = { ...ctx.custom[self], mastermindPredictedWinner: choice };
        ctx.log(`♟️ ${ctx.describe(self)} secretly predicts ${ctx.describe(choice)} will win!`);
      },
    },
  },
  {
    id: 'party-animal',
    name: 'Party Animal',
    description: 'At the start of its turn, pulls everyone 1 space closer; gains +1 per racer that joins its space.',
    tier: 1,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const selfPos = ctx.getRacer(self).position;
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        for (const other of others) {
          if (other.position < selfPos) await ctx.move(other.characterId, 1, { silent: true });
          else if (other.position > selfPos) await ctx.move(other.characterId, -1, { silent: true });
        }
        const newSelfPos = ctx.getRacer(self).position;
        const gathered = ctx
          .getAllRacers()
          .filter((r) => r.characterId !== self && !r.finished && r.position === newSelfPos).length;
        if (gathered > 0) {
          ctx.addRollModifier(self, gathered);
          ctx.log(`🪩 ${ctx.describe(self)} throws a party! ${gathered} racer(s) join in: +${gathered} to the roll!`);
        } else {
          ctx.log(`🪩 ${ctx.describe(self)} pulls everyone 1 space closer.`);
        }
      },
    },
  },
  {
    id: 'romantic',
    name: 'Romantic',
    description: 'Whenever any two other racers end up sharing a space, swoons forward 2.',
    tier: 3,
    abilities: {
      onAnyShareSpace: (ctx, self) => {
        ctx.log(`🌹 ${ctx.describe(self)} swoons at the sight of new friends and drifts forward 2!`);
        void ctx.move(self, 2);
      },
    },
  },
  {
    id: 'third-wheel',
    name: 'Third Wheel',
    description: 'Before its main move, may warp to any space occupied by exactly 2 racers.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        const counts = new Map<number, number>();
        for (const r of others) counts.set(r.position, (counts.get(r.position) ?? 0) + 1);
        const pairSpaces = [...counts.entries()].filter(([, count]) => count === 2).map(([pos]) => pos);
        if (pairSpaces.length === 0) return;
        const choice = await ctx.decide(
          self,
          'Warp to a cozy pair of racers?',
          [
            { label: 'Stay put', value: 'stay' },
            ...pairSpaces.map((pos) => ({ label: `Space ${pos}`, value: String(pos) })),
          ],
        );
        if (choice === 'stay') return;
        await ctx.setPosition(self, Number(choice));
        ctx.log(`🛞 ${ctx.describe(self)} warps in as the third wheel!`);
      },
    },
  },
  {
    id: 'twin',
    name: 'Twin',
    description: "At the start of the race, may copy the power of a racer that won a previous race.",
    tier: 2,
    abilities: {
      onRaceSetup: async (ctx, self) => {
        const winners = [...new Set(ctx.getPreviousWinnerBaseIds())].filter((id) => id !== 'twin');
        if (winners.length === 0) {
          ctx.log(`👯 ${ctx.describe(self)} has no past winners to copy yet.`);
          return;
        }
        const choice = await ctx.decide(
          self,
          'Copy the power of a previous race winner:',
          winners.map((id) => ({ label: CHARACTER_MAP[id]?.name ?? id, value: id })),
        );
        ctx.custom[self] = { ...ctx.custom[self], borrowedBaseId: choice };
        ctx.log(`👯 ${ctx.describe(self)} copies the power of ${CHARACTER_MAP[choice]?.name ?? choice}!`);
      },
    },
  },
  {
    id: 'skipper',
    name: 'Skipper',
    description: 'Whenever anyone rolls a 1, jumps to the front of the turn order.',
    tier: 2,
    abilities: {
      onAnyRoll: (ctx, self, roller, roll) => {
        if (roller === self || roll !== 1) return;
        ctx.requestPriorityTurn(self);
        ctx.log(`⛵ ${ctx.describe(roller)} rolled a 1! ${ctx.describe(self)} sails to the front of the line.`);
      },
    },
  },
  {
    id: 'suckerfish',
    name: 'Suckerfish',
    description: 'When a racer it shares a space with moves away, may follow them to their new space.',
    tier: 2,
    abilities: {
      onSharedDeparture: async (ctx, self, mover) => {
        const choice = await ctx.decide(self, `${ctx.describe(mover)} is moving away. Latch on and follow?`, [
          { label: 'Follow', value: 'yes' },
          { label: 'Stay', value: 'no' },
        ]);
        if (choice !== 'yes') return;
        await ctx.setPosition(self, ctx.getRacer(mover).position);
        ctx.log(`🐟 ${ctx.describe(self)} latches onto ${ctx.describe(mover)} and follows along!`);
      },
    },
  },
  {
    id: 'sisyphus',
    name: 'Sisyphus',
    description: 'Starts with 4 bonus chips. Rolling a 6 sends it back to Start and costs it a chip instead of moving.',
    tier: 2,
    abilities: {
      onRaceSetup: (ctx, self) => {
        for (let i = 0; i < 4; i++) ctx.grantBronzeChip(self);
        ctx.log(`🪨 ${ctx.describe(self)} shoulders 4 bonus chips before the race even begins.`);
      },
      onRoll: async (ctx, self, roll) => {
        if (roll !== 6) return roll;
        ctx.cancelPendingMove();
        await ctx.setPosition(self, 0);
        ctx.removeBronzeChip(self);
        ctx.log(`🪨 ${ctx.describe(self)} rolls a 6, and the boulder rolls all the way back to Start! (-1 chip)`);
        return roll;
      },
    },
  },
  {
    id: 'stickler',
    name: 'Stickler',
    description: 'Other racers can only cross the finish line with an exact roll; overshooting keeps them in place.',
    tier: 3,
    abilities: {
      blocksOvershoot: true,
    },
  },
  {
    id: 'apparition',
    name: 'Apparition',
    description: 'At the start of its turn, moves 1 space for every racer currently ahead of it.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const selfPos = ctx.getRacer(self).position;
        const ahead = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished && r.position > selfPos).length;
        if (ahead > 0) {
          ctx.log(`👻 ${ctx.describe(self)} drifts forward ${ahead} space${ahead === 1 ? '' : 's'}, one for each racer ahead!`);
          await ctx.move(self, ahead);
        }
      },
    },
  },
  {
    id: 'argus',
    name: 'Argus',
    description:
      "Racers can't pass its space unless they started their move there (they stop on it instead); trips if 2+ racers start a turn on its space.",
    tier: 2,
    abilities: {
      onTurnStart: (ctx, self) => {
        const argusPos = ctx.getRacer(self).position;
        const occupants = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished && r.position === argusPos);
        if (occupants.length >= 2) {
          ctx.setTripped(self, true);
          ctx.log(`👁️ ${ctx.describe(self)} is surrounded by a crowd and trips!`);
        }
      },
      adjustLanding: (ctx, self, mover, proposedPosition) => {
        if (mover === self) return undefined;
        const argusPos = ctx.getRacer(self).position;
        const movingFrom = ctx.getRacer(mover).position;
        if (movingFrom === argusPos) return undefined; // started here, free to pass through
        const crossesForward = movingFrom < argusPos && argusPos < proposedPosition;
        const crossesBackward = movingFrom > argusPos && argusPos > proposedPosition;
        if (crossesForward || crossesBackward) {
          ctx.log(`👁️ ${ctx.describe(self)}'s watchful eye stops ${ctx.describe(mover)} in their tracks!`);
          return argusPos;
        }
        return undefined;
      },
    },
  },
  {
    id: 'banshee',
    name: 'Banshee',
    description: 'At the start of its turn, may warp any racer to the space directly behind it.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        if (others.length === 0) return;
        const choice = await ctx.decide(self, 'Warp a racer to the space behind you?', [
          { label: 'Yes, warp someone', value: 'yes' },
          { label: 'No', value: 'no' },
        ]);
        if (choice !== 'yes') return;
        const targetId = await ctx.decide(
          self,
          'Warp whom behind you?',
          others.map((r) => ({ label: ctx.describe(r.characterId), value: r.characterId })),
        );
        const target = others.find((r) => r.characterId === targetId) ?? others[0];
        const behind = Math.max(0, ctx.getRacer(self).position - 1);
        await ctx.setPosition(target.characterId, behind);
        ctx.log(`😱 ${ctx.describe(self)} lets out a wail and warps ${ctx.describe(target.characterId)} behind her!`);
      },
    },
  },
  {
    id: 'allosaurus',
    name: 'Allosaurus',
    description: 'Whenever another racer moves exactly 4 spaces on their turn, also moves 4.',
    tier: 3,
    abilities: {
      onOtherTurnEnd: async (ctx, self, other, spacesMoved) => {
        if (spacesMoved !== 4) return;
        ctx.log(`🦖 ${ctx.describe(other)} moved 4 spaces! ${ctx.describe(self)} stomps forward 4 too!`);
        await ctx.move(self, 4);
      },
    },
  },
  {
    id: 'cecaelia',
    name: 'Cecaelia',
    description: 'Whenever anyone rolls a 3 for their main move, moves 4. Whenever anyone rolls a 5, moves -4.',
    tier: 2,
    abilities: {
      onAnyRoll: async (ctx, self, roller, roll) => {
        if (roller === self) return;
        if (roll === 3) {
          ctx.log(`🐙 ${ctx.describe(roller)} rolled a 3! ${ctx.describe(self)} lashes forward 4 tentacles' worth.`);
          await ctx.move(self, 4);
        } else if (roll === 5) {
          ctx.log(`🐙 ${ctx.describe(roller)} rolled a 5! ${ctx.describe(self)} gets yanked back 4.`);
          await ctx.move(self, -4);
        }
      },
    },
  },
  {
    id: 'snowman',
    name: 'Snowman',
    description: 'Starts with 8 bonus chips, but must discard 1 at the start of every turn. Keeps whatever is left.',
    tier: 3,
    abilities: {
      onRaceSetup: (ctx, self) => {
        for (let i = 0; i < 8; i++) ctx.grantBronzeChip(self);
        ctx.log(`⛄ ${ctx.describe(self)} rolls into the race carrying 8 chips of packed snow.`);
      },
      onTurnStart: (ctx, self) => {
        ctx.removeBronzeChip(self);
        ctx.log(`⛄ ${ctx.describe(self)} melts a little and drops 1 chip.`);
      },
    },
  },
  {
    id: 'greek',
    name: 'Greek',
    description: 'Before the race, predicts who will finish last. If correct, earns 3 bonus chips.',
    tier: 2,
    abilities: {
      onRaceSetup: async (ctx, self) => {
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self);
        if (others.length === 0) return;
        const choice = await ctx.decide(
          self,
          'Predict who will finish LAST in this race:',
          others.map((r) => ({ label: ctx.describe(r.characterId), value: r.characterId })),
        );
        ctx.custom[self] = { ...ctx.custom[self], greekPredictedLast: choice };
        ctx.log(`🏺 ${ctx.describe(self)} secretly predicts ${ctx.describe(choice)} will finish last!`);
      },
    },
  },
  {
    id: 'honey-badger',
    name: 'Honey Badger',
    description: "Completely unaffected by every other racer's ability, and never considered to be sharing a space.",
    tier: 1,
    abilities: {
      immune: true,
    },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: 'Before any roll (its own or another racer\'s), predicts the result. Correct guesses move it 1.',
    tier: 2,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const guess = await ctx.decide(
          self,
          'Predict your own upcoming roll (1-6):',
          [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: String(n) })),
        );
        ctx.custom[self] = { ...ctx.custom[self], oracleSelfPrediction: Number(guess) };
      },
      onRoll: (ctx, self, roll) => {
        const prediction = ctx.custom[self]?.oracleSelfPrediction;
        if (typeof prediction === 'number' && prediction === roll) {
          ctx.log(`🔮 ${ctx.describe(self)} foresaw the roll! Drifts forward 1.`);
          void ctx.move(self, 1);
        }
        return roll;
      },
      onBeforeAnyRoll: async (ctx, self, roller) => {
        const guess = await ctx.decide(
          self,
          `Predict ${ctx.describe(roller)}'s upcoming roll (1-6):`,
          [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: String(n) })),
        );
        ctx.custom[self] = { ...ctx.custom[self], oracleOtherPrediction: Number(guess) };
      },
      onAnyRoll: (ctx, self, roller, roll) => {
        if (roller === self) return;
        const prediction = ctx.custom[self]?.oracleOtherPrediction;
        if (typeof prediction === 'number' && prediction === roll) {
          ctx.log(`🔮 ${ctx.describe(self)} correctly predicted ${ctx.describe(roller)}'s roll! Drifts forward 1.`);
          void ctx.move(self, 1);
        }
      },
    },
  },
  {
    id: 'queen',
    name: 'Queen',
    description: 'Can skip rolling and move exactly 6 instead. Whenever anyone rolls a 6, moves -4.',
    tier: 1,
    abilities: {
      onTurnStart: async (ctx, self) => {
        const choice = await ctx.decide(self, 'Roll normally, or command a royal move of 6?', [
          { label: 'Roll normally', value: 'roll' },
          { label: 'Move 6', value: 'move6' },
        ]);
        if (choice !== 'move6') return;
        ctx.setFlatMoveOverride(self, 6);
        ctx.log(`👑 ${ctx.describe(self)} commands a royal advance of exactly 6!`);
      },
      onAnyRoll: async (ctx, self, roller, roll) => {
        if (roller === self || roll !== 6) return;
        ctx.log(`👑 ${ctx.describe(roller)} rolled a 6! ${ctx.describe(self)} recoils back 4.`);
        await ctx.move(self, -4);
      },
    },
  },
  {
    id: 'rhinoceros',
    name: 'Rhinoceros',
    description: 'If it rolls a 1, keeps rolling and adding to the total until something other than a 1 comes up.',
    tier: 2,
    abilities: {
      onRoll: async (ctx, self, roll) => {
        let total = roll;
        while (total === 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const extra = 1 + Math.floor(Math.random() * 6);
          ctx.log(`🦏 ${ctx.describe(self)} rolled a 1 and charges on: +${extra}!`);
          total += extra;
        }
        return total;
      },
    },
  },
  {
    id: 'nyx',
    name: 'Nyx',
    description: 'If it passes every other active racer in a single move, instantly warps to the finish line.',
    tier: 1,
    abilities: {
      onTurnStart: (ctx, self) => {
        ctx.custom[self] = { ...ctx.custom[self], nyxPassedThisTurn: [] };
      },
      onPass: (ctx, self, other) => {
        const data = ctx.custom[self] ?? {};
        const passed = Array.isArray(data.nyxPassedThisTurn) ? (data.nyxPassedThisTurn as string[]) : [];
        ctx.custom[self] = { ...data, nyxPassedThisTurn: [...passed, other] };
      },
      onTurnEnd: async (ctx, self) => {
        const data = ctx.custom[self];
        const passed = Array.isArray(data?.nyxPassedThisTurn) ? (data!.nyxPassedThisTurn as string[]) : [];
        const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
        if (others.length > 0 && new Set(passed).size >= others.length) {
          ctx.log(`🌙 ${ctx.describe(self)} slips past everyone in the dark and warps straight to the finish!`);
          const selfPos = ctx.getRacer(self).position;
          await ctx.move(self, ctx.trackLength - selfPos);
        }
      },
    },
  },
];

/** True if `self` has the strictly highest position among all still-active racers. */
function isAloneInLead(ctx: AbilityContext, self: string): boolean {
  const selfPos = ctx.getRacer(self).position;
  const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
  return others.every((r) => r.position < selfPos);
}

/** True if `self` has the strictly lowest position among all still-active racers. */
function isAloneInLast(ctx: AbilityContext, self: string): boolean {
  const selfPos = ctx.getRacer(self).position;
  const others = ctx.getAllRacers().filter((r) => r.characterId !== self && !r.finished);
  return others.every((r) => r.position > selfPos);
}

/** True if this racer's base character is immune to other characters' abilities (e.g. Honey Badger). */
function isImmuneRacer(characterId: string): boolean {
  return CHARACTER_MAP[baseCharacterId(characterId)]?.abilities.immune === true;
}

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

