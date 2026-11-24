// Sprite rectangles measured from the MASFunPack sheets: { sheetKey: { frame: [x, y, w, h] } }
// Frames are referenced elsewhere as 'sheetKey:frame' (e.g. 'chess:wQ').

export const SHEET_FILES = {
  ttt: 'TicTacToeSpriteSheet',
  reversi: 'ReversiSpriteSheet',
  yacht: 'YachtSpriteSheet',
  checkers: 'CheckersSpriteSheet',
  chess: 'ChessSpriteSheet',
  go: 'GoSpriteSheet',
  tables: 'TablesSpriteSheet',
  dominoes: 'DominoesSpriteSheet',
  seabattle: 'BattleshipSpriteSheet',
  cards: 'CardSpriteSheet',
  wild: 'Uno',
  airhockey: 'AirHockeySpriteSheet',
  blocks: 'BlockBreakerSpriteSheet',
  rocks: 'AsteroidSpriteSheet',
  bowling: 'BowlingSpriteSheet',
  pool: 'PoolSpriteSheet',
  tanks: 'TanksSpriteSheet',
  boxbox: 'BoxBoxSpriteSheet',
  sixball: '6BallPuzzleSpriteSheet',
  mole: 'MoleRunner',
};

const dice = (xs, ys) => {
  const f = {};
  let n = 1;
  for (const y of ys) for (const x of xs) f[`d${n++}`] = [x, y, 12, 12];
  return f;
};

export const FRAMES = {
  ttt: { x: [33, 17, 14, 14], o: [17, 17, 14, 14] },
  reversi: { dark: [24, 16, 8, 8], light: [32, 16, 8, 8], cell: [40, 16, 8, 8] },
  yacht: { ...dice([18, 34], [42, 58, 74]), hold: [25, 17, 14, 14] },
  checkers: { light: [24, 16, 8, 8], dark: [32, 16, 8, 8] },
  // Chess: b = dark (red) set, w = light set.  P pawn, R rook, N knight, B bishop, Q queen, K king
  chess: {
    bP: [40, 16, 8, 8], bR: [48, 16, 8, 8], bN: [56, 16, 8, 8], bB: [40, 24, 8, 8], bQ: [48, 24, 8, 8], bK: [56, 24, 8, 8],
    wP: [40, 32, 8, 8], wR: [48, 32, 8, 8], wN: [56, 32, 8, 8], wB: [40, 40, 8, 8], wQ: [48, 40, 8, 8], wK: [56, 40, 8, 8],
  },
  go: { light: [16, 16, 8, 8], dark: [24, 16, 8, 8], cell: [32, 16, 8, 8] },
  tables: {
    ...dice([2, 18], [42, 58, 74]),
    pointDarkDown: [32, 16, 8, 32], pointLightDown: [40, 16, 8, 32],
    pointDarkUp: [32, 48, 8, 32], pointLightUp: [40, 48, 8, 32],
    dark: [32, 80, 8, 8], light: [40, 80, 8, 8],
  },
  dominoes: { icon: [0, 66, 16, 6] },
  seabattle: {
    boom1: [0, 16, 8, 8], boom2: [8, 16, 8, 8], boom3: [16, 16, 8, 8], boom4: [24, 16, 8, 8], boom: [32, 16, 8, 8],
    water: [40, 16, 8, 8], hit: [0, 24, 8, 8], miss: [8, 24, 8, 8], wreck: [40, 24, 8, 8],
    bow: [16, 24, 8, 8], mid: [16, 32, 8, 8], stern: [16, 40, 8, 8],
    bowR: [24, 24, 8, 8], midR: [24, 32, 8, 8], sternR: [24, 40, 8, 8],
  },
  cards: {
    back: [16, 16, 16, 24],
    spade: [16, 104, 8, 8], heart: [32, 104, 8, 8], club: [16, 120, 8, 8], diamond: [32, 120, 8, 8],
  },
  wild: (() => {
    // 16x24 cards. Colours: 0 red, 1 orange, 2 blue, 3 green.
    const f = { back: [64, 136, 16, 24], wild: [64, 160, 16, 24], wild4: [64, 184, 16, 24], icon: [64, 160, 16, 24] };
    for (let c = 0; c < 4; c++) {
      for (let n = 0; n <= 5; n++) f[`c${c}_${n}`] = [n * 16, 16 + c * 24, 16, 24];
      for (let n = 6; n <= 9; n++) f[`c${c}_${n}`] = [(n - 6) * 16, 112 + c * 24, 16, 24];
      f[`c${c}_skip`] = [80, 112 + c * 24, 16, 24];
      f[`c${c}_reverse`] = [0, 208 + c * 24, 16, 24];
      f[`c${c}_draw2`] = [16, 208 + c * 24, 16, 24];
      f[`c${c}_wild`] = [80, 208 + c * 24, 16, 24];   // a wild after its colour is chosen
    }
    return f;
  })(),
  airhockey: { puck: [32, 56, 8, 8], blue: [40, 56, 8, 8], red: [40, 64, 8, 8] },
  blocks: { green: [0, 16, 16, 8], orange: [16, 16, 16, 8], red: [0, 24, 16, 8], lavender: [16, 24, 16, 8], ball: [8, 32, 8, 8], paddle: [24, 32, 24, 8] },
  rocks: { ship: [32, 16, 8, 8], player: [0, 24, 8, 8], ufo: [32, 24, 8, 8], flame1: [0, 32, 8, 8], flame2: [8, 32, 8, 8], rockL: [0, 40, 24, 24], rockM: [16, 16, 16, 16], rockS: [8, 24, 8, 8] },
  bowling: { pin: [24, 24, 8, 8], pinDown: [32, 24, 8, 8], ball: [40, 24, 8, 8] },
  pool: (() => {
    // b0 cue, b1-7 solids, b8 eight ball, b9-15 stripes
    const spots = [[0, 48], [8, 48], [16, 48], [24, 48], [32, 48], [40, 48], [0, 56], [8, 56], [16, 56], [24, 56], [32, 56], [40, 56], [0, 64], [8, 64], [16, 64], [24, 64]];
    return Object.fromEntries(spots.map(([x, y], n) => [`b${n}`, [x, y, 8, 8]]));
  })(),
  tanks: {
    icon: [0, 16, 8, 8], p1: [0, 16, 8, 8], p2: [8, 16, 8, 8], g1: [0, 24, 8, 8], g2: [8, 24, 8, 8],
    w1: [0, 32, 8, 8], w2: [8, 32, 8, 8], r1: [0, 40, 8, 8], r2: [8, 40, 8, 8],
    steel: [0, 48, 8, 8], brick: [8, 48, 8, 8], base: [16, 48, 8, 8], bush: [0, 56, 8, 8], water: [8, 56, 8, 8],
    bullet: [0, 72, 8, 8], bulletH: [8, 72, 8, 8], ex1: [16, 80, 8, 8], ex2: [24, 80, 8, 8], ex3: [32, 80, 8, 8], ex4: [40, 80, 8, 8],
    spark1: [24, 72, 8, 8], spark2: [32, 72, 8, 8], spark3: [40, 72, 8, 8],
    pw_shield: [0, 88, 8, 8], pw_clock: [8, 88, 8, 8], pw_shovel: [16, 88, 8, 8], pw_star: [24, 88, 8, 8], pw_grenade: [32, 88, 8, 8], pw_life: [40, 88, 8, 8],
  },
  boxbox: { wall: [24, 16, 8, 8], box: [32, 16, 8, 8], goal: [40, 16, 8, 8], player: [24, 24, 8, 8] },
  sixball: { g1: [0, 40, 8, 8], g2: [8, 40, 8, 8], g3: [16, 40, 8, 8], g4: [24, 40, 8, 8], g5: [32, 40, 8, 8], g6: [40, 40, 8, 8] },
  mole: {
    stone: [0, 16, 8, 8], brick: [8, 16, 8, 8], rope: [16, 16, 8, 8], ladder: [24, 24, 8, 8], gem: [32, 16, 8, 8],
    pwalk1: [0, 32, 8, 8], pwalk2: [8, 32, 8, 8], pclimb1: [0, 40, 8, 8], pclimb2: [8, 40, 8, 8], prope1: [0, 48, 8, 8], prope2: [8, 48, 8, 8],
    ewalk1: [0, 56, 8, 8], ewalk2: [8, 56, 8, 8], eclimb1: [0, 64, 8, 8], eclimb2: [8, 64, 8, 8], erope1: [0, 72, 8, 8], erope2: [8, 72, 8, 8],
  },
};
