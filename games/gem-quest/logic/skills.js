// Every skill (heroes' and monsters'). A skill costs mana of one or two colours and runs a list
// of effects. Numbers are [base, perLevel]: value = base + perLevel x (level - 1).
//   dmg      hit the foe (shield soaks it first)       heal     heal yourself
//   shield   gain a shield                             drain    take mana from the foe
//   poison   foe loses v HP at the start of its turns (for `turns` turns)
//   stun     foe skips its next v turns                 rage     your skulls hit +v harder for `turns`
//   weak     foe's skulls hit v softer for `turns`      leech    hit the foe and heal the same
//   mana     gain v mana of colour `col`
//   convert  turn every `from` gem into `to` (lines that form go off for you)
//   smash    destroy gems: 'row' (a random row), 'col', 'bottom' (bottom 2 rows), 'color' (all of `col`),
//            'random' (v gems); destroyed gems count for you (skulls hit, gems give mana)
//   plant    put v special gems of kind `s` on the board
// extra: true means the skill does not end your turn.
// Colours: 0 red, 1 blue, 2 green, 3 yellow, 4 skull, 5 coin.

export const SKILLS = {
  // ---------------------------------------------------------------- Knight (red / yellow)
  cleave: { name: 'Cleave', cost: [6, 0, 0, 0], icon: 'sp:6,5', fx: [{ k: 'dmg', v: [9, 2] }] },
  shieldWall: { name: 'Shield Wall', cost: [0, 0, 0, 5], icon: 'sp:1,2', extra: true, fx: [{ k: 'shield', v: [10, 2] }] },
  rally: { name: 'Rally', cost: [0, 0, 0, 8], icon: 'sp:0,1', fx: [{ k: 'heal', v: [12, 3] }, { k: 'mana', col: 0, v: [4, 0] }] },
  judgement: { name: 'Judgement', cost: [9, 0, 0, 5], icon: 'sp:7,1', fx: [{ k: 'dmg', v: [16, 3] }, { k: 'stun', v: [1, 0] }] },
  // ---------------------------------------------------------------- Mage (red / blue)
  fireball: { name: 'Fireball', cost: [6, 0, 0, 0], icon: 'sp:4,4', fx: [{ k: 'dmg', v: [10, 2] }] },
  frostBolt: { name: 'Frost Bolt', cost: [0, 6, 0, 0], icon: 'sp:3,0', fx: [{ k: 'dmg', v: [5, 1] }, { k: 'stun', v: [1, 0] }] },
  transmute: { name: 'Transmute', cost: [0, 7, 0, 0], icon: 'sp:4,5', fx: [{ k: 'convert', from: 2, to: 4 }] },
  meteor: { name: 'Meteor', cost: [9, 6, 0, 0], icon: 'sp:7,0', fx: [{ k: 'dmg', v: [10, 2] }, { k: 'smash', how: 'random', v: [12, 0] }] },
  // ---------------------------------------------------------------- Ranger (green / yellow)
  aimedShot: { name: 'Aimed Shot', cost: [0, 0, 5, 0], icon: 'sp:3,1', fx: [{ k: 'dmg', v: [8, 2] }] },
  poisonArrow: { name: 'Venom Arrow', cost: [0, 0, 6, 0], icon: 'sp:5,0', fx: [{ k: 'poison', v: [3, 0.5], turns: 4 }] },
  volley: { name: 'Volley', cost: [0, 0, 0, 7], icon: 'sp:5,1', fx: [{ k: 'smash', how: 'bottom' }] },
  entangle: { name: 'Entangle', cost: [0, 0, 8, 6], icon: 'sp:1,3', fx: [{ k: 'stun', v: [2, 0] }, { k: 'drain', v: [4, 0] }] },
  // ---------------------------------------------------------------- Berserker (red / green)
  rage: { name: 'Rage', cost: [5, 0, 0, 0], icon: 'sp:7,3', extra: true, fx: [{ k: 'rage', v: [2, 0], turns: 3 }] },
  bloodlust: { name: 'Bloodlust', cost: [0, 0, 6, 0], icon: 'sp:2,1', fx: [{ k: 'leech', v: [7, 2] }] },
  skullStorm: { name: 'Skull Storm', cost: [7, 0, 0, 0], icon: 'sp:5,6', fx: [{ k: 'convert', from: 3, to: 4 }] },
  earthquake: { name: 'Earthquake', cost: [9, 0, 7, 0], icon: 'sp:5,2', fx: [{ k: 'dmg', v: [6, 1] }, { k: 'smash', how: 'color', col: 4 }] },

  // ---------------------------------------------------------------- monsters
  bite: { name: 'Bite', cost: [5, 0, 0, 0], icon: 'sp:2,0', fx: [{ k: 'dmg', v: [6, 0.9] }] },
  slash: { name: 'Slash', cost: [0, 0, 0, 6], icon: 'sp:6,5', fx: [{ k: 'dmg', v: [7, 1] }] },
  arrow: { name: 'Arrow', cost: [0, 0, 5, 0], icon: 'sp:5,0', fx: [{ k: 'dmg', v: [6, 0.9] }] },
  firebolt: { name: 'Firebolt', cost: [6, 0, 0, 0], icon: 'sp:4,4', fx: [{ k: 'dmg', v: [8, 1.1] }] },
  iceShard: { name: 'Ice Shard', cost: [0, 6, 0, 0], icon: 'sp:4,2', fx: [{ k: 'dmg', v: [5, 0.7] }, { k: 'stun', v: [1, 0] }] },
  mend: { name: 'Mend', cost: [0, 0, 7, 0], icon: 'sp:0,1', fx: [{ k: 'heal', v: [8, 1.2] }] },
  guard: { name: 'Guard', cost: [0, 5, 0, 0], icon: 'sp:1,2', fx: [{ k: 'shield', v: [8, 1.1] }] },
  venom: { name: 'Venom', cost: [0, 0, 6, 0], icon: 'sp:4,1', fx: [{ k: 'poison', v: [2, 0.25], turns: 4 }] },
  manaBurn: { name: 'Mana Burn', cost: [0, 7, 0, 0], icon: 'sp:6,4', fx: [{ k: 'drain', v: [5, 0] }, { k: 'dmg', v: [4, 0.5] }] },
  curse: { name: 'Curse', cost: [0, 0, 0, 6], icon: 'sp:2,2', fx: [{ k: 'weak', v: [1, 0], turns: 3 }, { k: 'dmg', v: [3, 0.4] }] },
  howl: { name: 'Howl', cost: [5, 0, 0, 0], icon: 'sp:7,3', fx: [{ k: 'rage', v: [1, 0], turns: 3 }] },
  boneCall: { name: 'Bone Call', cost: [0, 0, 7, 0], icon: 'sp:0,2', fx: [{ k: 'convert', from: 1, to: 4 }] },
  drainLife: { name: 'Drain Life', cost: [0, 7, 0, 0], icon: 'sp:0,3', fx: [{ k: 'leech', v: [6, 0.9] }] },
  stomp: { name: 'Stomp', cost: [8, 0, 0, 0], icon: 'sp:2,3', fx: [{ k: 'dmg', v: [9, 1.2] }, { k: 'stun', v: [1, 0] }] },
  breath: { name: 'Fire Breath', cost: [9, 0, 0, 0], icon: 'sp:1,0', fx: [{ k: 'dmg', v: [12, 1.4] }] },
  gaze: { name: 'Dread Gaze', cost: [0, 8, 0, 0], icon: 'sp:3,4', fx: [{ k: 'stun', v: [1, 0] }, { k: 'drain', v: [4, 0] }] },
  blizzard: { name: 'Blizzard', cost: [0, 9, 0, 0], icon: 'sp:6,1', fx: [{ k: 'dmg', v: [8, 1] }, { k: 'weak', v: [1, 0], turns: 3 }] },
  quake: { name: 'Tremor', cost: [0, 0, 8, 0], icon: 'sp:5,2', fx: [{ k: 'smash', how: 'row' }, { k: 'dmg', v: [5, 0.6] }] },
  hex: { name: 'Hex', cost: [0, 0, 0, 7], icon: 'sp:6,0', fx: [{ k: 'convert', from: 0, to: 4 }] },
};

/** Skill value at a level (plus gear power for damage/heal/shield/leech). */
export function fxValue(f, level, power = 0) {
  if (!f.v) return 0;
  const base = f.v[0] + f.v[1] * (level - 1);
  const boosted = ['dmg', 'heal', 'shield', 'leech'].includes(f.k) ? base + power : base;
  return Math.max(0, Math.round(boosted));
}

const COLOR_WORD = ['red', 'blue', 'green', 'yellow', 'skull', 'coin'];

/** Plain words for a skill at a level, e.g. "Deal 12 damage. Stun 1 turn." */
export function describe(id, level = 1, power = 0) {
  const s = SKILLS[id];
  const parts = s.fx.map((f) => {
    const v = fxValue(f, level, power);
    switch (f.k) {
      case 'dmg': return `Deal ${v} damage.`;
      case 'heal': return `Heal ${v} HP.`;
      case 'shield': return `Gain a ${v} HP shield.`;
      case 'poison': return `Poison: ${v} damage a turn for ${f.turns} turns.`;
      case 'stun': return `Stun the foe for ${v} turn${v > 1 ? 's' : ''}.`;
      case 'rage': return `Skulls hit +${v} harder for ${f.turns} turns.`;
      case 'weak': return `Foe's skulls hit ${v} softer for ${f.turns} turns.`;
      case 'leech': return `Deal ${v} damage and heal ${v}.`;
      case 'drain': return `Drain ${v} of each foe mana.`;
      case 'mana': return `Gain ${v} ${COLOR_WORD[f.col]} mana.`;
      case 'convert': return `Turn all ${COLOR_WORD[f.from]} gems into ${COLOR_WORD[f.to]}s.`;
      case 'smash': return {
        row: 'Smash a row of gems.', col: 'Smash a column of gems.', bottom: 'Smash the bottom two rows.',
        color: `Smash every ${COLOR_WORD[f.col]}.`, random: `Smash ${v} random gems.`,
      }[f.how] + ' You get what they give.';
      case 'plant': return `Add ${v} ${f.s} gems.`;
      default: return '';
    }
  });
  if (s.extra) parts.push('Free: your turn goes on.');
  return parts.join(' ');
}

/** Short label for the cost: "6R 5Y". */
export function costLabel(id) {
  return SKILLS[id].cost.map((n, c) => (n ? `${n}${'RBGY'[c]}` : '')).filter(Boolean).join(' ');
}
