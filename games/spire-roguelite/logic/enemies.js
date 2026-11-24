// Enemies, their moves and how they choose them. Every move is announced one turn ahead (the
// intent over the enemy's head), so the player can always plan around it.
//
// move fields: dmg, times, block, blockAllies, buff {status: n} (self), buffAllies, debuff {status: n}
//   (on the player), add [cardId, count, pile], heal, drain (heals the unblocked damage),
//   summon enemyId, fn(c, e) for anything special.
// sprite: 'sheetKey:row' (see frames.js). Bosses use 24px sheets.

const repeats = (hist, m, n) => hist.length >= n && hist.slice(-n).every((h) => h === m);

/** Moves in a fixed loop. */
const cycle = (...keys) => (e) => keys[e.turn % keys.length];

/** Weighted random, never the same move more than `max` times in a row. */
function rand(weights, max = 2) {
  return (e, k) => {
    let opts = Object.entries(weights).filter(([m]) => !repeats(e.hist, m, max));
    if (!opts.length) opts = Object.entries(weights);
    const total = opts.reduce((s, [, w]) => s + w, 0);
    let x = k.rng() * total;
    for (const [m, w] of opts) { x -= w; if (x < 0) return m; }
    return opts[opts.length - 1][0];
  };
}

/** Use `first` on turn 0, then hand over to `then`. */
const opener = (first, then) => (e, k) => (e.turn === 0 ? first : then(e, k));

export const ENEMIES = {
  // ======================= ACT 1: the Greenwood =======================
  skeleton: {
    name: 'Skeleton', sprite: 'necro:16', hp: [34, 38],
    moves: {
      slash: { name: 'Slash', dmg: 8 },
      rattle: { name: 'Rattle', dmg: 5, block: 5 },
      guard: { name: 'Bone Guard', block: 8, buff: { str: 1 } },
    },
    ai: rand({ slash: 45, rattle: 35, guard: 20 }, 2),
  },
  zombie: {
    name: 'Zombie', sprite: 'necro:32', hp: [42, 46],
    moves: {
      grasp: { name: 'Grasp', dmg: 6, debuff: { weak: 1 } },
      lurch: { name: 'Lurch', dmg: 11 },
    },
    ai: cycle('grasp', 'lurch'),
  },
  rat: {
    name: 'Giant Rat', sprite: 'necro:48', hp: [11, 15],
    init: (e, k) => { e.mem.bite = 5 + Math.floor(k.rng() * 3); },
    moves: {
      bite: { name: 'Bite', dmg: (e) => e.mem.bite },
      gnaw: { name: 'Gnaw', buff: { str: 3 } },
    },
    ai: rand({ bite: 75, gnaw: 25 }, 1),
  },
  acolyte: {
    name: 'Acolyte', sprite: 'necro:96', hp: [46, 52],
    moves: {
      ritual: { name: 'Dark Ritual', buff: { ritual: 3 } },
      bolt: { name: 'Curse Bolt', dmg: 6 },
    },
    ai: opener('ritual', () => 'bolt'),
  },
  goblin: {
    name: 'Goblin', sprite: 'strong:16', hp: [13, 17],
    moves: {
      stab: { name: 'Stab', dmg: 6 },
      trip: { name: 'Dirty Trick', dmg: 3, debuff: { weak: 1 } },
      hide: { name: 'Cower', block: 6 },
    },
    ai: rand({ stab: 50, trip: 30, hide: 20 }, 1),
  },
  pikeman: {
    name: 'Bandit', sprite: 'castle:16', hp: [30, 34],
    moves: {
      thrust: { name: 'Thrust', dmg: 10 },
      brace: { name: 'Brace', dmg: 5, block: 7 },
    },
    ai: rand({ thrust: 55, brace: 45 }, 2),
  },
  archer: {
    name: 'Crossbowman', sprite: 'castle:32', hp: [24, 28],
    moves: {
      volley: { name: 'Volley', dmg: 3, times: 2 },
      aim: { name: 'Pin Down', dmg: 4, debuff: { frail: 2 } },
    },
    ai: cycle('aim', 'volley', 'volley'),
  },
  wolfRider: {
    name: 'Wolf Rider', sprite: 'strong:48', hp: [44, 48],
    moves: {
      charge: { name: 'Charge', dmg: 13 },
      bite: { name: 'Savage Bite', dmg: 7, debuff: { vuln: 1 } },
      howl: { name: 'Howl', block: 6, buff: { str: 2 } },
    },
    ai: cycle('bite', 'charge', 'howl'),
  },
  orc: {
    name: 'Orc Grunt', sprite: 'strong:112', hp: [48, 52],
    moves: {
      smash: { name: 'Smash', dmg: 12 },
      roar: { name: 'Intimidate', block: 6, debuff: { weak: 2 } },
    },
    ai: opener('roar', rand({ smash: 65, roar: 35 }, 2)),
  },
  // Act 1 elites
  ogre: {
    name: 'Ogre Brute', sprite: 'strong:96', hp: [82, 86], elite: true,
    moves: {
      bellow: { name: 'Bellow', buff: { enrage: 2 } },
      rush: { name: 'Rush', dmg: 14 },
      skull: { name: 'Skull Bash', dmg: 6, debuff: { vuln: 2 } },
    },
    ai: opener('bellow', rand({ rush: 60, skull: 40 }, 2)),
  },
  treant: {
    name: 'Old Treant', sprite: 'rampart:112', hp: [86, 90], elite: true,
    start: { thorns: 2 },
    moves: {
      entangle: { name: 'Entangle', block: 8, debuff: { weak: 2 } },
      slam: { name: 'Slam', dmg: 16 },
      grow: { name: 'Grow', block: 10, buff: { str: 2 } },
    },
    ai: cycle('entangle', 'slam', 'grow', 'slam'),
  },
  graveKnight: {
    name: 'Grave Knight', sprite: 'necro:64', hp: [70, 76], elite: true,
    start: { plated: 8 },
    moves: {
      cleave: { name: 'Twin Cleave', dmg: 7, times: 2 },
      dark: { name: 'Dark Strike', dmg: 11, add: ['wound', 1, 'discard'] },
      fortify: { name: 'Fortify', block: 14 },
    },
    ai: rand({ cleave: 40, dark: 40, fortify: 20 }, 1),
  },
  // Act 1 bosses
  hydra: {
    name: 'Swamp Hydra', sprite: 'boss1:48', hp: [170, 170], boss: true,
    init: (e) => { e.st.heads = 2; },
    moves: {
      bite: { name: 'Bites', dmg: 6, times: (e) => e.st.heads || 1 },
      spit: { name: 'Venom Spit', dmg: 9, debuff: { weak: 2 } },
      regrow: { name: 'Regrow', block: 14, buff: { heads: 1 } },
    },
    ai: cycle('bite', 'spit', 'bite', 'regrow'),
  },
  bogMaw: {
    name: 'Bog Maw', sprite: 'boss1:0', hp: [160, 160], boss: true,
    moves: {
      spores: { name: 'Spore Cloud', debuff: { weak: 2 }, add: ['slimed', 2, 'discard'] },
      lash: { name: 'Vine Lash', dmg: 8, times: 2 },
      root: { name: 'Take Root', block: 12, buff: { str: 2 } },
      devour: { name: 'Devour', dmg: 20 },
    },
    ai: cycle('spores', 'lash', 'root', 'devour'),
  },

  // ======================= ACT 2: the Sunken Keep =======================
  gargoyle: {
    name: 'Gargoyle', sprite: 'tower:32', hp: [52, 58],
    start: { plated: 4 },
    moves: {
      dive: { name: 'Dive', dmg: 14 },
      claw: { name: 'Claws', dmg: 7, times: 2 },
      stone: { name: 'Stone Skin', block: 12 },
    },
    ai: rand({ dive: 40, claw: 40, stone: 20 }, 1),
  },
  naga: {
    name: 'Naga', sprite: 'tower:64', hp: [60, 66],
    moves: {
      fang: { name: 'Venom Fang', dmg: 7, debuff: { poison: 3 } },
      constrict: { name: 'Constrict', dmg: 12 },
      coil: { name: 'Coil', block: 10, buff: { str: 2 } },
    },
    ai: cycle('fang', 'constrict', 'coil'),
  },
  vampire: {
    name: 'Vampire', sprite: 'necro:80', hp: [56, 62],
    moves: {
      drain: { name: 'Blood Drain', dmg: 10, drain: true },
      bats: { name: 'Bat Swarm', dmg: 4, times: 3 },
      mesmer: { name: 'Mesmerize', debuff: { weak: 2, frail: 2 } },
    },
    ai: opener('mesmer', rand({ drain: 50, bats: 50 }, 2)),
  },
  wraith: {
    name: 'Wraith', sprite: 'necro:192', hp: [28, 32],
    moves: {
      chill: { name: 'Chill Touch', dmg: 7, debuff: { frail: 1 } },
      wail: { name: 'Wail', dmg: 4, debuff: { vuln: 1 } },
      fade: { name: 'Fade', block: 10 },
    },
    ai: rand({ chill: 45, wail: 30, fade: 25 }, 1),
  },
  golem: {
    name: 'Stone Golem', sprite: 'tower:48', hp: [84, 90],
    moves: {
      build: { name: 'Build Up', block: 12, buff: { str: 2 } },
      punch: { name: 'Punch', dmg: 11 },
      crush: { name: 'Crush', dmg: 22 },
    },
    ai: cycle('build', 'punch', 'crush'),
  },
  lich: {
    name: 'Lich', sprite: 'necro:208', hp: [56, 60],
    moves: {
      raise: { name: 'Raise Dead', summon: 'skeleton' },
      bolt: { name: 'Soul Bolt', dmg: 12 },
      wither: { name: 'Wither', debuff: { weak: 2, vuln: 2 } },
    },
    ai: (e, k) => {
      if (e.turn === 0 || (k.allies < 3 && e.turn % 3 === 0)) return 'raise';
      return rand({ bolt: 65, wither: 35 }, 1)(e, k);
    },
  },
  darkMage: {
    name: 'Dark Mage', sprite: 'castle:80', hp: [34, 38],
    moves: {
      hex: { name: 'Hex Bolt', dmg: 8, debuff: { vuln: 1 } },
      ward: { name: 'Ward Allies', blockAllies: 8 },
    },
    ai: rand({ hex: 60, ward: 40 }, 1),
  },
  // Act 2 elites
  minotaur: {
    name: 'Minotaur', sprite: 'inferno:192', hp: [118, 124], elite: true,
    moves: {
      stomp: { name: 'Stomp', dmg: 9, debuff: { vuln: 2 } },
      gore: { name: 'Gore', dmg: 19 },
      enrage: { name: 'Enrage', block: 10, buff: { str: 3 } },
    },
    ai: cycle('stomp', 'gore', 'enrage', 'gore'),
  },
  ironGolem: {
    name: 'Iron Golem', sprite: 'tower:160', hp: [106, 112], elite: true,
    start: { plated: 10, artifact: 1 },
    moves: {
      fist: { name: 'Iron Fist', dmg: 15 },
      grind: { name: 'Grind', dmg: 8, times: 2 },
      reinforce: { name: 'Reinforce', block: 18, buff: { plated: 4 } },
    },
    ai: cycle('fist', 'grind', 'reinforce'),
  },
  drake: {
    name: 'Green Drake', sprite: 'boss2:24', hp: [126, 132], elite: true,
    moves: {
      acid: { name: 'Acid Breath', dmg: 10, add: ['burn', 2, 'discard'] },
      tail: { name: 'Tail Swipe', dmg: 6, times: 3 },
      roar: { name: 'Roar', buff: { str: 2 }, debuff: { weak: 2 } },
    },
    ai: opener('roar', rand({ acid: 50, tail: 50 }, 1)),
  },
  // Act 2 bosses
  kraken: {
    name: 'Kraken', sprite: 'boss1:24', hp: [240, 240], boss: true,
    moves: {
      tentacles: { name: 'Tentacles', dmg: 4, times: 4 },
      ink: { name: 'Ink Cloud', block: 20, debuff: { weak: 2, frail: 2 } },
      crush: { name: 'Crushing Grip', dmg: 24 },
      grow: { name: 'Deep Rage', buff: { str: 2 }, block: 12 },
    },
    ai: cycle('tentacles', 'ink', 'crush', 'grow'),
  },
  beholder: {
    name: 'Beholder', sprite: 'boss2:48', hp: [230, 230], boss: true,
    start: { artifact: 2 },
    moves: {
      rays: { name: 'Eye Rays', dmg: 3, times: 5 },
      gaze: { name: 'Paralyzing Gaze', debuff: { weak: 2 }, add: ['dazed', 3, 'draw'] },
      beam: { name: 'Disintegrate', dmg: 26 },
      shield: { name: 'Anti-Magic', block: 24, buff: { artifact: 1, str: 2 } },
    },
    ai: cycle('gaze', 'rays', 'beam', 'shield'),
  },

  // ======================= ACT 3: the Ember Spire =======================
  imp: {
    name: 'Imp', sprite: 'inferno:16', hp: [22, 26],
    moves: {
      bolt: { name: 'Fire Bolt', dmg: 8 },
      singe: { name: 'Singe', dmg: 4, add: ['burn', 1, 'discard'] },
    },
    ai: rand({ bolt: 60, singe: 40 }, 2),
  },
  demon: {
    name: 'Demon', sprite: 'inferno:32', hp: [82, 88],
    moves: {
      claw: { name: 'Rend', dmg: 16 },
      hellfire: { name: 'Hellfire', dmg: 9, add: ['burn', 1, 'discard'] },
      pact: { name: 'Dark Pact', block: 10, buff: { str: 3 } },
    },
    ai: cycle('hellfire', 'claw', 'pact'),
  },
  hellhound: {
    name: 'Hellhound', sprite: 'inferno:48', hp: [44, 48],
    moves: {
      bite: { name: 'Bite', dmg: 10, debuff: { vuln: 1 } },
      pounce: { name: 'Pounce', dmg: 6, times: 2 },
    },
    ai: rand({ bite: 50, pounce: 50 }, 2),
  },
  efreet: {
    name: 'Efreet', sprite: 'inferno:96', hp: [86, 92],
    moves: {
      fireball: { name: 'Fireball', dmg: 21 },
      wave: { name: 'Heat Wave', dmg: 7, times: 2, add: ['burn', 1, 'discard'] },
      stoke: { name: 'Stoke Flames', buff: { ritual: 2 }, block: 12 },
    },
    ai: opener('stoke', cycle('wave', 'fireball')),
  },
  pitFiend: {
    name: 'Pit Fiend', sprite: 'inferno:112', hp: [112, 118],
    start: { angry: 1 },
    moves: {
      rend: { name: 'Rend', dmg: 12, times: 2 },
      howl: { name: 'Infernal Howl', debuff: { weak: 2, vuln: 2 } },
      guard: { name: 'Brimstone', block: 16 },
    },
    ai: opener('howl', rand({ rend: 60, guard: 40 }, 1)),
  },
  devil: {
    name: 'Devil', sprite: 'inferno:240', hp: [88, 94],
    moves: {
      trident: { name: 'Trident', dmg: 14 },
      curse: { name: 'Curse', debuff: { frail: 2, weak: 2 }, add: ['dazed', 2, 'draw'] },
      feast: { name: 'Soul Feast', dmg: 9, drain: true },
    },
    ai: cycle('curse', 'trident', 'feast'),
  },
  giant: {
    name: 'Cyclops', sprite: 'tower:224', hp: [128, 134],
    moves: {
      rest: { name: 'Gather Strength', block: 20, buff: { str: 2 } },
      club: { name: 'Club', dmg: 14 },
      boulder: { name: 'Boulder', dmg: 32 },
    },
    ai: cycle('rest', 'club', 'boulder'),
  },
  // Act 3 elites
  blackKnight: {
    name: 'Black Knight', sprite: 'necro:112', hp: [150, 158], elite: true,
    start: { plated: 6, artifact: 1 },
    moves: {
      charge: { name: 'Death Charge', dmg: 24 },
      combo: { name: 'Blade Flurry', dmg: 8, times: 3 },
      dread: { name: 'Dread Aura', block: 15, debuff: { weak: 2, frail: 2 } },
    },
    ai: cycle('dread', 'combo', 'charge'),
  },
  fireTitan: {
    name: 'Fire Giant', sprite: 'inferno:224', hp: [160, 168], elite: true,
    moves: {
      stoke: { name: 'Stoke', buff: { str: 3 }, block: 15 },
      smash: { name: 'Magma Smash', dmg: 18, add: ['burn', 2, 'discard'] },
      sweep: { name: 'Sweep', dmg: 9, times: 3 },
    },
    ai: cycle('smash', 'sweep', 'stoke'),
  },
  shadowCat: {
    name: 'Shadow Stalker', sprite: 'boss2:120', hp: [140, 146], elite: true,
    moves: {
      pounce: { name: 'Pounce', dmg: 7, times: 4 },
      fade: { name: 'Fade', block: 25, buff: { str: 2 } },
      maul: { name: 'Maul', dmg: 15, debuff: { vuln: 2 } },
    },
    ai: cycle('maul', 'pounce', 'fade', 'pounce'),
  },
  // Act 3 bosses
  redDragon: {
    name: 'Red Dragon', sprite: 'boss2:0', hp: [300, 300], boss: true,
    start: { artifact: 1 },
    moves: {
      breath: { name: 'Inferno Breath', dmg: 8, times: 3, add: ['burn', 2, 'discard'] },
      claws: { name: 'Claws', dmg: 13, times: 2 },
      wings: { name: 'Wing Buffet', dmg: 12, debuff: { weak: 2 } },
      hoard: { name: 'Guard the Hoard', block: 30, buff: { str: 3 } },
    },
    ai: cycle('wings', 'breath', 'claws', 'hoard'),
  },
  voidHorror: {
    name: 'Void Horror', sprite: 'boss2:72', hp: [300, 300], boss: true,
    start: { regen: 5 },
    moves: {
      grasp: { name: 'Void Grasp', dmg: 14, debuff: { frail: 2 } },
      gaze: { name: 'Maddening Gaze', debuff: { weak: 2, vuln: 2 }, add: ['dazed', 2, 'draw'] },
      consume: { name: 'Consume', dmg: 24, drain: true },
      grow: { name: 'Grow', buff: { str: 3 }, block: 20 },
    },
    ai: cycle('gaze', 'grasp', 'consume', 'grow'),
  },
};

// Encounters per act. `easy` are the first fights of an act.
export const ACTS = [
  {
    name: 'The Greenwood',
    easy: [['skeleton'], ['zombie'], ['rat', 'rat'], ['acolyte']],
    hard: [['goblin', 'goblin', 'goblin'], ['pikeman', 'archer'], ['wolfRider'], ['orc'], ['rat', 'rat', 'rat'], ['skeleton', 'rat'], ['zombie', 'goblin']],
    elites: [['ogre'], ['treant'], ['graveKnight']],
    bosses: ['hydra', 'bogMaw'],
  },
  {
    name: 'The Sunken Keep',
    easy: [['gargoyle'], ['naga'], ['vampire'], ['wraith', 'wraith']],
    hard: [['golem'], ['lich'], ['darkMage', 'darkMage'], ['gargoyle', 'wraith'], ['naga', 'darkMage'], ['wraith', 'wraith', 'wraith'], ['vampire', 'rat']],
    elites: [['minotaur'], ['ironGolem'], ['drake']],
    bosses: ['kraken', 'beholder'],
  },
  {
    name: 'The Ember Spire',
    easy: [['imp', 'imp', 'imp'], ['demon'], ['hellhound', 'hellhound'], ['efreet']],
    hard: [['pitFiend'], ['devil', 'imp'], ['giant'], ['demon', 'imp'], ['hellhound', 'hellhound', 'imp'], ['efreet', 'imp']],
    elites: [['blackKnight'], ['fireTitan'], ['shadowCat']],
    bosses: ['redDragon', 'voidHorror'],
  },
];

/** Resolve a move value that may be a number or a function of the enemy. */
export const val = (x, e) => (typeof x === 'function' ? x(e) : x);
