// Moves, pets and items. All names and creatures are original to Pocket Pets.
//
// Move fields: type, power (0 = no damage), acc (%; null never misses), pp, prio (goes first),
// status/chance (inflicts a status), stat (stage change on 'foe' or 'self'), drain/recoil/heal (fractions).

export const MOVES = {
  // Plain
  tackle: { name: 'Tackle', type: 'plain', power: 40, acc: 100, pp: 35 },
  swipe: { name: 'Swipe', type: 'plain', power: 40, acc: 100, pp: 35 },
  quickjab: { name: 'Quick Jab', type: 'plain', power: 40, acc: 100, pp: 30, prio: 1 },
  pounce: { name: 'Pounce', type: 'plain', power: 70, acc: 100, pp: 20 },
  winggust: { name: 'Wing Gust', type: 'plain', power: 55, acc: 100, pp: 25 },
  skydive: { name: 'Sky Dive', type: 'plain', power: 90, acc: 95, pp: 10 },
  hyperrush: { name: 'Hyper Rush', type: 'plain', power: 120, acc: 90, pp: 5, recoil: 0.25 },
  snarl: { name: 'Snarl', type: 'plain', power: 0, acc: 100, pp: 30, stat: { who: 'foe', key: 'atk', n: -1 } },
  brace: { name: 'Brace', type: 'plain', power: 0, acc: null, pp: 30, stat: { who: 'self', key: 'def', n: 1 } },
  rally: { name: 'Rally', type: 'plain', power: 0, acc: null, pp: 20, stat: { who: 'self', key: 'atk', n: 2 } },
  lullaby: { name: 'Lullaby', type: 'plain', power: 0, acc: 60, pp: 15, status: 'sleep', chance: 1 },
  catnap: { name: 'Cat Nap', type: 'plain', power: 0, acc: null, pp: 10, heal: 0.5 },
  flail: { name: 'Flail', type: 'plain', power: 40, acc: null, pp: 1, recoil: 0.25, hidden: true },
  // Flame
  cinder: { name: 'Cinder', type: 'flame', power: 40, acc: 100, pp: 25, status: 'burn', chance: 0.1 },
  flarekick: { name: 'Flare Kick', type: 'flame', power: 65, acc: 95, pp: 20, status: 'burn', chance: 0.1 },
  scorch: { name: 'Scorch', type: 'flame', power: 0, acc: 85, pp: 15, status: 'burn', chance: 1 },
  blazeburst: { name: 'Blaze Burst', type: 'flame', power: 90, acc: 100, pp: 15, status: 'burn', chance: 0.1 },
  inferno: { name: 'Inferno', type: 'flame', power: 120, acc: 80, pp: 5, status: 'burn', chance: 0.3 },
  // Leaf
  leafflick: { name: 'Leaf Flick', type: 'leaf', power: 40, acc: 100, pp: 25 },
  thornlash: { name: 'Thorn Lash', type: 'leaf', power: 60, acc: 100, pp: 20 },
  drainroot: { name: 'Drain Root', type: 'leaf', power: 55, acc: 100, pp: 15, drain: 0.5 },
  sporecloud: { name: 'Spore Cloud', type: 'leaf', power: 0, acc: 85, pp: 15, status: 'poison', chance: 1 },
  sleeppollen: { name: 'Sleep Pollen', type: 'leaf', power: 0, acc: 70, pp: 15, status: 'sleep', chance: 1 },
  bloombeam: { name: 'Bloom Beam', type: 'leaf', power: 90, acc: 100, pp: 10 },
  thornstorm: { name: 'Thorn Storm', type: 'leaf', power: 115, acc: 85, pp: 5, status: 'poison', chance: 0.2 },
  // Stone
  pebbletoss: { name: 'Pebble Toss', type: 'stone', power: 40, acc: 100, pp: 25 },
  rockbash: { name: 'Rock Bash', type: 'stone', power: 70, acc: 95, pp: 15 },
  quakestomp: { name: 'Quake Stomp', type: 'stone', power: 90, acc: 100, pp: 10 },
  boulderdrop: { name: 'Boulder Drop', type: 'stone', power: 115, acc: 80, pp: 5 },
  ironshell: { name: 'Iron Shell', type: 'stone', power: 0, acc: null, pp: 20, stat: { who: 'self', key: 'def', n: 2 } },
  gritspray: { name: 'Grit Spray', type: 'stone', power: 0, acc: 100, pp: 20, stat: { who: 'foe', key: 'spd', n: -2 } },
  // Spark
  zap: { name: 'Zap', type: 'spark', power: 40, acc: 100, pp: 25, status: 'para', chance: 0.1 },
  staticpounce: { name: 'Static Pounce', type: 'spark', power: 65, acc: 100, pp: 20, status: 'para', chance: 0.2 },
  joltwave: { name: 'Jolt Wave', type: 'spark', power: 0, acc: 90, pp: 15, status: 'para', chance: 1 },
  thundercrash: { name: 'Thunder Crash', type: 'spark', power: 95, acc: 90, pp: 10, status: 'para', chance: 0.1 },
  voltstorm: { name: 'Volt Storm', type: 'spark', power: 120, acc: 80, pp: 5, status: 'para', chance: 0.3 },
  chargeup: { name: 'Charge Up', type: 'spark', power: 0, acc: null, pp: 20, stat: { who: 'self', key: 'spd', n: 2 } },
  // Tide
  splashshot: { name: 'Splash Shot', type: 'tide', power: 40, acc: 100, pp: 25 },
  bubblejet: { name: 'Bubble Jet', type: 'tide', power: 60, acc: 100, pp: 20, stat: { who: 'foe', key: 'spd', n: -1, chance: 0.3 } },
  tidalslam: { name: 'Tidal Slam', type: 'tide', power: 90, acc: 100, pp: 10 },
  riptide: { name: 'Riptide', type: 'tide', power: 115, acc: 85, pp: 5 },
  mistveil: { name: 'Mist Veil', type: 'tide', power: 0, acc: null, pp: 20, stat: { who: 'self', key: 'def', n: 2 } },
  dewdrink: { name: 'Dew Drink', type: 'tide', power: 0, acc: null, pp: 10, heal: 0.5 },
};

// Learnsets are shared by every stage of a line: [level, move].
export const LINES = {
  embit: [[1, 'tackle'], [1, 'snarl'], [5, 'cinder'], [9, 'quickjab'], [13, 'flarekick'], [17, 'scorch'], [21, 'rally'], [25, 'blazeburst'], [32, 'inferno']],
  dribbit: [[1, 'tackle'], [1, 'brace'], [5, 'splashshot'], [9, 'snarl'], [13, 'bubblejet'], [17, 'mistveil'], [21, 'dewdrink'], [25, 'tidalslam'], [32, 'riptide']],
  sprigling: [[1, 'tackle'], [1, 'snarl'], [5, 'leafflick'], [9, 'sporecloud'], [13, 'thornlash'], [17, 'drainroot'], [21, 'sleeppollen'], [25, 'bloombeam'], [32, 'thornstorm']],
  peeplet: [[1, 'tackle'], [1, 'snarl'], [5, 'quickjab'], [9, 'winggust'], [14, 'brace'], [19, 'pounce'], [25, 'rally'], [30, 'skydive'], [36, 'hyperrush']],
  mewlet: [[1, 'swipe'], [1, 'snarl'], [5, 'quickjab'], [9, 'lullaby'], [13, 'pounce'], [19, 'catnap'], [24, 'rally'], [30, 'hyperrush']],
  tadling: [[1, 'tackle'], [4, 'splashshot'], [8, 'brace'], [12, 'bubblejet'], [17, 'dewdrink'], [22, 'tidalslam'], [30, 'riptide']],
  emberkit: [[1, 'swipe'], [1, 'snarl'], [4, 'cinder'], [8, 'quickjab'], [12, 'scorch'], [16, 'flarekick'], [22, 'blazeburst'], [30, 'inferno']],
  fernkit: [[1, 'swipe'], [4, 'leafflick'], [8, 'sleeppollen'], [12, 'thornlash'], [16, 'drainroot'], [22, 'bloombeam'], [28, 'catnap'], [32, 'thornstorm']],
  zapkit: [[1, 'swipe'], [1, 'chargeup'], [4, 'zap'], [8, 'quickjab'], [12, 'joltwave'], [16, 'staticpounce'], [22, 'thundercrash'], [30, 'voltstorm']],
  sparkpod: [[1, 'tackle'], [4, 'zap'], [8, 'brace'], [12, 'joltwave'], [16, 'staticpounce'], [20, 'chargeup'], [26, 'thundercrash'], [33, 'voltstorm']],
  pebbit: [[1, 'tackle'], [1, 'brace'], [4, 'pebbletoss'], [8, 'gritspray'], [12, 'rockbash'], [18, 'ironshell'], [23, 'quakestomp'], [30, 'boulderdrop']],
  pebbleby: [[1, 'tackle'], [1, 'ironshell'], [4, 'pebbletoss'], [9, 'snarl'], [13, 'rockbash'], [17, 'gritspray'], [23, 'quakestomp'], [32, 'boulderdrop']],
};

// Sprite rows in the Pocket Pets sheet: 0 octopus, 1 sprout, 2 chick, 3 fox, 4 cat, 5 frog.
// stage: 'baby' (small dark sprite), 'mid' (bigger dark sprite) or 'adult' (big sprite with faces).
const S = (name, type, line, row, stage, base, extra = {}) => ({ name, type, line, row, stage, base, ...extra });
const B = (hp, atk, def, spd) => ({ hp, atk, def, spd });

export const SPECIES = {
  embit: S('Embit', 'flame', 'embit', 2, 'baby', B(41, 54, 42, 62), { evo: ['cindrel', 14], dex: 'A fluffy chick with a warm belly. It sleeps curled round a glowing ember.' }),
  cindrel: S('Cindrel', 'flame', 'embit', 2, 'mid', B(58, 68, 56, 80), { evo: ['blazquill', 28], dex: 'Its feathers crackle like a campfire. It hops about when it is excited.' }),
  blazquill: S('Blazquill', 'flame', 'embit', 2, 'adult', B(80, 92, 74, 98), { dex: 'The crest on its head burns brighter the braver it feels.' }),
  dribbit: S('Dribbit', 'tide', 'dribbit', 0, 'baby', B(46, 48, 62, 44), { evo: ['splashpod', 14], dex: 'A tiny blob of sea water with eight wiggly legs. It loves puddles.' }),
  splashpod: S('Splashpod', 'tide', 'dribbit', 0, 'mid', B(62, 64, 78, 58), { evo: ['octorrent', 28], dex: 'It squirts jets of water to scare off bigger pets.' }),
  octorrent: S('Octorrent', 'tide', 'dribbit', 0, 'adult', B(84, 84, 100, 78), { dex: 'Calm and wise. Its arms can stir up a wave strong enough to topple a cart.' }),
  sprigling: S('Sprigling', 'leaf', 'sprigling', 1, 'baby', B(47, 50, 50, 46), { evo: ['budhorn', 14], dex: 'A seed that grew legs. It naps in sunny spots to grow.' }),
  budhorn: S('Budhorn', 'leaf', 'sprigling', 1, 'mid', B(62, 64, 66, 60), { evo: ['bloomhorn', 28], dex: 'The buds on its horns open on warm mornings.' }),
  bloomhorn: S('Bloomhorn', 'leaf', 'sprigling', 1, 'adult', B(84, 82, 86, 80), { dex: 'A gentle giant crowned with leaves. Little pets shelter in its shade.' }),
  peeplet: S('Peeplet', 'plain', 'peeplet', 2, 'baby', B(40, 45, 40, 56), { evo: ['chirrup', 16], dex: 'Peeps all day long. Flocks of them wake the whole meadow at dawn.' }),
  chirrup: S('Chirrup', 'plain', 'peeplet', 2, 'mid', B(62, 62, 56, 74), { evo: ['crestwing', 30], dex: 'It guards its patch of grass fiercely against bigger pets.' }),
  crestwing: S('Crestwing', 'plain', 'peeplet', 2, 'adult', B(82, 82, 74, 100), { dex: 'It soars above the summit, diving on its prey from the clouds.' }),
  mewlet: S('Mewlet', 'plain', 'mewlet', 4, 'baby', B(42, 46, 36, 70), { evo: ['whiskar', 20], dex: 'A curious kitten that follows travellers for snacks.' }),
  whiskar: S('Whiskar', 'plain', 'mewlet', 4, 'adult', B(68, 74, 60, 104), { dex: 'Proud and quick. Its whiskers sense a foe before it moves.' }),
  tadling: S('Tadling', 'tide', 'tadling', 5, 'baby', B(44, 48, 42, 72), { evo: ['bogtoad', 20], dex: 'A slippery tadpole that hides in pond weed.' }),
  bogtoad: S('Bogtoad', 'tide', 'tadling', 5, 'adult', B(92, 76, 78, 64), { dex: 'It sits so still in the marsh that birds land on its head.' }),
  emberkit: S('Emberkit', 'flame', 'emberkit', 3, 'baby', B(40, 46, 40, 66), { evo: ['flarefox', 20], dex: 'Its tail tip smoulders. Rare in the meadow, common near the cave.' }),
  flarefox: S('Flarefox', 'flame', 'emberkit', 3, 'adult', B(72, 82, 70, 100), { dex: 'It runs so fast that the grass behind it smokes.' }),
  fernkit: S('Fernkit', 'leaf', 'fernkit', 4, 'baby', B(46, 50, 46, 56), { evo: ['mossmew', 20], dex: 'Moss grows on its fur. It purrs a sleepy pollen into the air.' }),
  mossmew: S('Mossmew', 'leaf', 'fernkit', 4, 'adult', B(78, 80, 76, 84), { dex: 'The forest folk say a Mossmew in the garden means a good harvest.' }),
  zapkit: S('Zapkit', 'spark', 'zapkit', 3, 'baby', B(36, 56, 32, 90), { evo: ['voltfox', 20], dex: 'Static makes its fur stand on end. Petting one tingles.' }),
  voltfox: S('Voltfox', 'spark', 'zapkit', 3, 'adult', B(62, 92, 56, 112), { dex: 'A streak of light in the woods. It strikes before you see it.' }),
  sparkpod: S('Sparkpod', 'spark', 'sparkpod', 0, 'baby', B(46, 46, 46, 50), { evo: ['joltlet', 18], dex: 'It glows faintly in dark caves, buzzing like a lamp.' }),
  joltlet: S('Joltlet', 'spark', 'sparkpod', 0, 'mid', B(62, 62, 60, 66), { evo: ['voltopus', 32], dex: 'It stores lightning in its round body and lets it out in bursts.' }),
  voltopus: S('Voltopus', 'spark', 'sparkpod', 0, 'adult', B(86, 90, 78, 92), { dex: 'Its eight arms crackle with power. Storms seem to follow it.' }),
  pebbit: S('Pebbit', 'stone', 'pebbit', 5, 'baby', B(50, 60, 70, 26), { evo: ['cragtoad', 22], dex: 'It looks just like a pebble until it hops away.' }),
  cragtoad: S('Cragtoad', 'stone', 'pebbit', 5, 'adult', B(84, 96, 108, 40), { dex: 'Its rocky skin can stop a falling boulder.' }),
  pebbleby: S('Pebbleby', 'stone', 'pebbleby', 1, 'baby', B(40, 74, 92, 22), { evo: ['rockhorn', 18], dex: 'A beetle with a shell of stone. It digs tunnels in cave walls.' }),
  rockhorn: S('Rockhorn', 'stone', 'pebbleby', 1, 'mid', B(56, 92, 110, 34), { evo: ['granitroot', 32], dex: 'It charges horn first and can crack a cave wall in one blow.' }),
  granitroot: S('Granitroot', 'stone', 'pebbleby', 1, 'adult', B(86, 110, 128, 44), { dex: 'It sits on mountain tops for years, growing roots into the rock.' }),
};

export const DEX_ORDER = Object.keys(SPECIES);
export const STARTERS = ['embit', 'dribbit', 'sprigling'];

const STAGE_VALUE = { baby: { catch: 0.5, xp: 60 }, mid: { catch: 0.3, xp: 130 }, adult: { catch: 0.18, xp: 200 } };
for (const sp of Object.values(SPECIES)) {
  sp.catchRate ??= STAGE_VALUE[sp.stage].catch;
  sp.xpYield ??= STAGE_VALUE[sp.stage].xp;
}

// Items. kind: 'capsule' (wild battles only), 'heal' (hp), 'cure', 'revive', 'pp'.
export const ITEMS = {
  capsule: { name: 'Capsule', kind: 'capsule', catch: 1, price: 50, desc: 'Throw at a wild pet to catch it. Works best when the pet is weak.' },
  supercap: { name: 'Super Capsule', kind: 'capsule', catch: 1.6, price: 150, badges: 1, desc: 'A better capsule: 1.6x the catch chance.' },
  ultracap: { name: 'Ultra Capsule', kind: 'capsule', catch: 2.5, price: 350, badges: 3, desc: 'The best capsule: 2.5x the catch chance.' },
  potion: { name: 'Potion', kind: 'heal', amount: 25, price: 60, desc: 'Restores 25 HP to one pet.' },
  superpotion: { name: 'Super Potion', kind: 'heal', amount: 70, price: 170, badges: 1, desc: 'Restores 70 HP to one pet.' },
  maxpotion: { name: 'Max Potion', kind: 'heal', amount: 9999, price: 450, badges: 3, desc: 'Fully restores one pet\'s HP.' },
  curedrop: { name: 'Cure Drop', kind: 'cure', price: 80, desc: 'Cures burn, poison, paralysis or sleep.' },
  revive: { name: 'Revive Seed', kind: 'revive', price: 400, badges: 2, desc: 'Wakes a fainted pet with half its HP.' },
  tonic: { name: 'PP Tonic', kind: 'pp', price: 250, badges: 2, desc: 'Restores all PP of one pet\'s moves.' },
};
export const ITEM_ORDER = Object.keys(ITEMS);

export const STATUS_INFO = {
  burn: { name: 'Burned', short: 'BRN', color: '#e0703a', text: 'loses a little HP each turn and hits softer' },
  poison: { name: 'Poisoned', short: 'PSN', color: '#9a407e', text: 'loses HP each turn' },
  para: { name: 'Paralysed', short: 'PAR', color: '#d9b625', text: 'is slower and sometimes can\'t move' },
  sleep: { name: 'Asleep', short: 'SLP', color: '#8a8fc4', text: 'can\'t move for a few turns' },
};

/** Types that can't catch a status: Flame never burns, Leaf is never poisoned, Spark never paralysed. */
export const STATUS_IMMUNE = { burn: 'flame', poison: 'leaf', para: 'spark' };
