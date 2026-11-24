// MegaBoy Run: shared numbers for the simulation. Everything in world pixels and seconds.
// The world uses an 8 px tile grid (the MegaBoy hero is about 14 px tall, so this gives the
// classic "hero is under two tiles tall" proportions). The camera shows it at 3x.

export const TILE = 8;
export const ROWS = 15;                 // every stage is 15 tiles (120 px) tall: one screen high
export const DT = 1 / 60;               // fixed simulation step
export const ZOOM = 3;
export const VIEW_W = 640 / ZOOM;       // 213.33 world px across the screen
export const VIEW_H = 120;

// Player tuning. Jump peak = jumpV^2 / (2 grav) = 27.3 px (3.4 tiles); a full running jump
// covers about 29 px (3.6 tiles) of flat ground.
export const P = {
  w: 10, h: 14,
  run: 46, grav: 560, jumpV: 175, cutV: 30, maxFall: 230, climb: 40,
  coyote: 0.08, buffer: 0.12,
  kbTime: 0.32, kbSpeed: 30, inv: 1.3,
  maxHp: 28, shootAnim: 0.25,
  chargeMid: 0.45, chargeFull: 1.1,
  conveyor: 24,
  spikeDmg: 8,
};

export const MAX_ENERGY = 28;
export const BOSS_HP = 28;              // never changes with difficulty
export const MAX_ETANKS = 4;
export const START_LIVES = 3;
export const MAX_LIVES = 9;

// Tile codes
export const T = {
  EMPTY: 0, SOLID: 1, ONEWAY: 2, LADDER: 3, SPIKE: 4, CONVL: 5, CONVR: 6, CRACK: 7, DOOR: 8, SOLID2: 9, SPIKED: 10,
};
export const TILE_CHARS = {
  '.': T.EMPTY, '#': T.SOLID, '=': T.SOLID2, '-': T.ONEWAY, H: T.LADDER, '^': T.SPIKE, v: T.SPIKED,
  '<': T.CONVL, '>': T.CONVR, '%': T.CRACK, D: T.DOOR,
};
export const SOLID_TILES = new Set([T.SOLID, T.SOLID2, T.SPIKE, T.SPIKED, T.CONVL, T.CONVR, T.CRACK, T.DOOR]);
export const HAZARD_TILES = new Set([T.SPIKE, T.SPIKED]);

// Map characters that place things rather than tiles.
export const ENEMY_CHARS = { w: 'walker', m: 'hardhat', h: 'hopper', b: 'bat', f: 'flyer', t: 'turret', s: 'guard', c: 'crawler' };
export const PICKUP_CHARS = { '+': 'hpBig', '*': 'wpBig', o: 'hpSmall', L: 'life', E: 'etank' };

// Weapons. cost = energy per use (out of 28). The buster is free.
export const WEAPONS = {
  buster: { name: 'BUSTER', short: 'BST', cost: 0, color: '#d84a4a', boss: null },
  ember: { name: 'EMBER BOMB', short: 'EMB', cost: 2, color: '#d88038', boss: 'ember' },
  ice: { name: 'ICE LANCE', short: 'ICE', cost: 1, color: '#5fcde4', boss: 'glacia' },
  thorn: { name: 'THORN RING', short: 'THN', cost: 3, color: '#6cbe50', boss: 'thorn' },
  volt: { name: 'VOLT FAN', short: 'VLT', cost: 2, color: '#e3d245', boss: 'volt' },
  drill: { name: 'DRILL SEEKER', short: 'DRL', cost: 2, color: '#c08a5a', boss: 'drill' },
  gale: { name: 'GALE RANG', short: 'GAL', cost: 1, color: '#e8eef8', boss: 'gale' },
};
export const WEAPON_ORDER = ['buster', 'ember', 'ice', 'thorn', 'volt', 'drill', 'gale'];
