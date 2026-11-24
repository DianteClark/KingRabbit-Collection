// Overworld tiles, drawn as 16x16 pixel strings (no Phaser here, so tests and previews can use it).
// Each tile is a list of 16 rows; letters map to colours in TILE_COLORS, '.' is see-through and
// shows the tile's base underneath.

export const TILE_COLORS = {
  k: '#1c1618', G: '#2f5a2c', g: '#5f9a43', h: '#4c8638', l: '#8cc456',
  y: '#ecd9a0', o: '#d6bb7c', d: '#a88a58',
  b: '#3a6cc0', c: '#7fb2ec', W: '#d8ecff',
  w: '#f9f5ef', t: '#5e3b22', T: '#8a5a34',
  s: '#9a9488', S: '#d2cbb8', D: '#5a554c',
  r: '#d84848', u: '#f2d24a', p: '#f3a5c8',
  m: '#6e5a4c', n: '#85705e', M: '#54443a', q: '#2e2420', Q: '#5c4a3e', R: '#7a6454',
};

const fill = (ch) => Array.from({ length: 16 }, () => ch.repeat(16));

/** Scatter `ch` at fixed pseudo-random spots over rows (deterministic). */
function speckle(rows, spots) {
  const out = rows.map((r) => r.split(''));
  for (const [x, y, ch] of spots) out[y][x] = ch;
  return out.map((r) => r.join(''));
}

const GRASS = speckle(fill('g'), [
  [2, 2, 'l'], [2, 3, 'h'], [9, 1, 'l'], [9, 2, 'h'], [13, 5, 'l'], [13, 6, 'h'], [5, 7, 'l'], [5, 8, 'h'],
  [11, 10, 'l'], [11, 11, 'h'], [1, 12, 'l'], [1, 13, 'h'], [7, 13, 'l'], [7, 14, 'h'], [14, 14, 'l'], [14, 15, 'h'],
]);

const TALL = [
  'hGlhhhGlhhhGlhhh',
  'GgGlhGgGlhGgGlhG',
  'GglGlGglGlGglGlG',
  'kGgGGkGgGGkGgGGk',
  'hhGlhhhGlhhhGlhh',
  'hGgGlhGgGlhGgGlh',
  'lGglGlGglGlGglGl',
  'GkGgGGkGgGGkGgGG',
  'hGlhhhGlhhhGlhhh',
  'GgGlhGgGlhGgGlhG',
  'GglGlGglGlGglGlG',
  'kGgGGkGgGGkGgGGk',
  'hhGlhhhGlhhhGlhh',
  'hGgGlhGgGlhGgGlh',
  'lGglGlGglGlGglGl',
  'GkGgGGkGgGGkGgGG',
];

const PATH = speckle(fill('o'), [
  [3, 2, 'y'], [4, 2, 'y'], [11, 4, 'd'], [7, 7, 'y'], [13, 9, 'y'], [2, 10, 'd'], [9, 12, 'y'], [10, 12, 'y'], [5, 14, 'd'], [14, 14, 'y'],
]);

const FLOWERS = speckle(GRASS, [
  [3, 3, 'r'], [2, 4, 'r'], [4, 4, 'r'], [3, 5, 'r'], [3, 4, 'u'],
  [11, 8, 'w'], [10, 9, 'w'], [12, 9, 'w'], [11, 10, 'w'], [11, 9, 'u'],
  [5, 11, 'p'], [4, 12, 'p'], [6, 12, 'p'], [5, 13, 'p'], [5, 12, 'u'],
]);

const TREE = [
  '.....kkkkkk.....',
  '...kkGGlGGGkk...',
  '..kGGgllgggGGk..',
  '.kGgglllgggggGk.',
  '.kGgllggggglgGk.',
  'kGgggggglllggGGk',
  'kGgglgggllgggGGk',
  'kGgllggggggglgGk',
  'kGGggggglgggggGk',
  '.kGgggglllggGGk.',
  '.kGGgggglgGGGGk.',
  '..kGGGGGGGGGGk..',
  '...kkkkttkkkk...',
  '......kTtk......',
  '.....kTTttk.....',
  '......kkkk......',
];

const ROCK = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kSSSSssk....',
  '...kSSwSssssk...',
  '..kSSwSsssssDk..',
  '..kSSSsssssDDk..',
  '.kSSssssssssDDk.',
  '.kSsssssssssDDk.',
  '.ksssssssssDDDk.',
  '.kDssssssDDDDDk.',
  '..kDDDDDDDDDDk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

const FENCE = [
  '................',
  '................',
  '..kk........kk..',
  '.kTTk......kTTk.',
  'kkTtkkkkkkkkTtkk',
  'TTTtTTTTTTTTTtTT',
  'ttTtttttttttTttt',
  'kkTtkkkkkkkkTtkk',
  'kkTtkkkkkkkkTtkk',
  'TTTtTTTTTTTTTtTT',
  'ttTtttttttttTttt',
  'kkTtkkkkkkkkTtkk',
  '.kTtk......kTtk.',
  '.kTtk......kTtk.',
  '.kttk......kttk.',
  '..kk........kk..',
];

const SIGN = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kTTTTTTTTTTTTk.',
  '.kTwwwwwwwwwwTk.',
  '.kTwkkwkwkkwwTk.',
  '.kTwwwwwwwwwwTk.',
  '.kTwkwkkwkkwwTk.',
  '.kTwwwwwwwwwwTk.',
  '.kttttttttttttk.',
  '..kkkkkTtkkkkk..',
  '......kTtk......',
  '......kTtk......',
  '......kTtk......',
  '.....kkttkk.....',
  '................',
];

const WATER1 = speckle(fill('b'), [
  [2, 3, 'c'], [3, 3, 'c'], [4, 3, 'c'], [10, 6, 'c'], [11, 6, 'c'], [12, 6, 'c'], [5, 10, 'c'], [6, 10, 'c'], [7, 10, 'c'], [12, 13, 'c'], [13, 13, 'c'], [14, 13, 'c'], [3, 3, 'W'],
]);
const WATER2 = speckle(fill('b'), [
  [3, 4, 'c'], [4, 4, 'c'], [5, 4, 'c'], [9, 7, 'c'], [10, 7, 'c'], [11, 7, 'c'], [6, 11, 'c'], [7, 11, 'c'], [8, 11, 'c'], [11, 14, 'c'], [12, 14, 'c'], [13, 14, 'c'], [10, 7, 'W'],
]);

const CAVE_FLOOR = speckle(fill('m'), [
  [2, 2, 'n'], [3, 2, 'n'], [12, 3, 'M'], [7, 6, 'n'], [1, 9, 'M'], [10, 10, 'n'], [11, 10, 'n'], [5, 13, 'M'], [14, 14, 'n'],
]);
const CAVE_GRAVEL = speckle(fill('M'), [
  [1, 1, 'n'], [2, 1, 'm'], [5, 2, 'm'], [9, 1, 'n'], [10, 1, 'm'], [13, 3, 'm'], [3, 5, 'n'], [4, 5, 'm'], [7, 6, 'm'],
  [11, 5, 'n'], [12, 5, 'm'], [15, 7, 'm'], [1, 9, 'm'], [5, 9, 'n'], [6, 9, 'm'], [9, 10, 'm'], [13, 9, 'n'], [14, 9, 'm'],
  [3, 13, 'n'], [4, 13, 'm'], [7, 12, 'm'], [11, 13, 'n'], [12, 13, 'm'], [0, 14, 'm'], [8, 15, 'n'], [14, 15, 'm'],
]);
const CAVE_WALL = [
  'qQQQQQRqQQQQQQRq',
  'qQRRQQQqQRRQQQQq',
  'qQQQQQQqQQQQQQQq',
  'qqqqqqqqqqqqqqqq',
  'QQQRqQQQQQQRqQQQ',
  'QRQQqQQRRQQQqQQQ',
  'QQQQqQQQQQQQqQQQ',
  'qqqqqqqqqqqqqqqq',
  'qQQQQQRqQQQQQQRq',
  'qQRRQQQqQRRQQQQq',
  'qQQQQQQqQQQQQQQq',
  'qqqqqqqqqqqqqqqq',
  'QQQRqQQQQQQRqQQQ',
  'QRQQqQQRRQQQqQQQ',
  'QQQQqQQQQQQQqQQQ',
  'qqqqqqqqqqqqqqqq',
];
const MOUTH = [
  '....kkkkkkkk....',
  '..kkqqqqqqqqkk..',
  '.kqqqqqqqqqqqqk.',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
  'kqqqqqqqqqqqqqqk',
];

/**
 * Tile art by map letter: { base, art?, frames? }. base is drawn first (a full tile), art on top.
 */
export const TILE_ART = {
  '.': { base: GRASS },
  ',': { base: TALL },
  '=': { base: PATH },
  f: { base: FLOWERS },
  T: { base: GRASS, art: TREE },
  '~': { base: WATER1, frames: [WATER1, WATER2] },
  r: { base: GRASS, art: ROCK },
  F: { base: GRASS, art: FENCE },
  s: { base: GRASS, art: SIGN },
  X: { base: CAVE_WALL },
  ':': { base: CAVE_GRAVEL },
  ';': { base: CAVE_FLOOR },
  o: { base: CAVE_FLOOR, art: MOUTH },
  '#': { base: GRASS },
};

export const SIGN_ART = SIGN;
export const ROCK_ART = ROCK;

/** Items lying on the map and in the bag: 12x12 pixel art. */
const PILL = (a, a2) => [
  '............',
  '............',
  '...kkkkkk...',
  '..kAAAwwwk..',
  '.kAAAAwwwwk.',
  '.kAaAAwwwwk.',
  '.kaaaAwwwsk.',
  '..kaaawsssk.',
  '...kkkkkk...',
  '............',
  '............',
  '............',
].map((r) => r.replace(/A/g, a).replace(/a/g, a2));
const BOTTLE = (a, a2) => [
  '....kkkk....',
  '....kTTk....',
  '....kwwk....',
  '...kkwwkk...',
  '..kwwwwwwk..',
  '..kAAAAAAk..',
  '..kAwAAAak..',
  '..kAAAAAak..',
  '..kAAAAaak..',
  '..kaaaaaak..',
  '...kkkkkk...',
  '............',
].map((r) => r.replace(/A/g, a).replace(/a/g, a2));
const DROP = [
  '.....kk.....',
  '....kGGk....',
  '....kglk....',
  '...kgglGk...',
  '...kglggk...',
  '..kggllggk..',
  '..kglgggGk..',
  '..kggggGGk..',
  '...kgGGGk...',
  '....kkkk....',
  '............',
  '............',
];
const SEED = [
  '......kk....',
  '.....kllk...',
  '....kllGk...',
  '...kkkGk....',
  '..kTTTkk....',
  '.kTtTTTtk...',
  '.kTTTtTTk...',
  '.ktTTTTtk...',
  '..kttTttk...',
  '...kkkkk....',
  '............',
  '............',
];
export const ITEM_ART = {
  capsule: PILL('r', 'R'),
  supercap: PILL('b', 'B'),
  ultracap: PILL('u', 'U'),
  potion: BOTTLE('p', 'P'),
  superpotion: BOTTLE('r', 'R'),
  maxpotion: BOTTLE('u', 'U'),
  curedrop: DROP,
  revive: SEED,
  tonic: BOTTLE('c', 'b'),
};
export const ITEM_COLORS = { ...TILE_COLORS, R: '#8e2a2a', B: '#1f3f80', U: '#b08a1a', P: '#b05080' };
