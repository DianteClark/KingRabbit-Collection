// Shared numbers for Hollow Crown. Everything in logic/ is plain JavaScript (no Phaser) so the
// rules, maps and puzzles can be tested in node.

export const TILE = 16;
export const COLS = 11;           // a room is 11 x 13 tiles (176 x 208 px, drawn at 2x)
export const ROWS = 13;
export const ROOM_W = COLS * TILE;
export const ROOM_H = ROWS * TILE;

export const SIDES = ['top', 'right', 'bottom', 'left'];
export const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
export const SIDE_DELTA = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export const DIRS = ['down', 'left', 'right', 'up'];
export const DIR_VEC = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

/** Door cells of a dungeon room (the middle of each wall). */
export const DOOR_CELL = { top: [5, 0], bottom: [5, ROWS - 1], left: [0, 6], right: [COLS - 1, 6] };

export const PLAYER = {
  w: 10, h: 10,
  speed: 74,          // px per second
  invuln: 1.0,        // seconds of blinking after a hit
  knock: 0.18,        // seconds of knockback
  knockSpeed: 170,
  swing: 0.26,        // sword swing length
  pushDelay: 0.28,    // lean on a block this long before it moves
};

export const BOOMERANG = { speed: 190, range: 92, back: 210, stun: 1.8 };
export const BOMB = { fuse: 1.5, radius: 26, hurtPlayer: 18, breakReach: 30, damage: 2, max: 10, start: 8 };

export const AREA_NAMES = {
  ow: 'Fernwick Vale',
  in: '',
  d1: 'Mossy Hollow',
  d2: 'Ember Lab',
  d3: 'Hollow Keep',
};
export const DUNGEONS = ['d1', 'd2', 'd3'];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
