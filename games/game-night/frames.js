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
  wild: { icon: [64, 112, 16, 24] },
  airhockey: { puck: [32, 56, 8, 8], blue: [40, 56, 8, 8], red: [40, 64, 8, 8] },
  blocks: { ball: [8, 32, 8, 8] },
  rocks: { ship: [32, 16, 8, 8] },
  bowling: { pin: [24, 24, 8, 8], ball: [40, 24, 8, 8] },
  pool: { b8: [32, 56, 8, 8] },
  tanks: { icon: [0, 16, 8, 8] },
  boxbox: { box: [32, 16, 8, 8] },
  sixball: { g1: [0, 40, 8, 8] },
  mole: { gem: [32, 16, 8, 8] },
};
