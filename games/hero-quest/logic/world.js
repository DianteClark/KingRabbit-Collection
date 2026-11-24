// Room lookup, neighbours, door identities and the dynamic state of cells (opened doors, bombed
// walls, bridges). Pure functions of the room data and the save flags.
import { ROOMS } from './data.js';
import { COLS, ROWS, SIDE_DELTA, OPPOSITE } from './constants.js';
import { WALKABLE } from './tiles.js';

export const room = (id) => ROOMS[id];
export const roomId = (area, x, y) => `${area}:${x},${y}`;

/** The room across `side`, or null. */
export function neighbour(r, side) {
  if (r.area === 'in') return null;
  const [dx, dy] = SIDE_DELTA[side];
  return ROOMS[roomId(r.area, r.gx + dx, r.gy + dy)] || null;
}

/** Which side of the room a cell is on (edge cells only), or null for inner cells. */
export function sideOf(x, y) {
  if (y === 0) return 'top';
  if (y === ROWS - 1) return 'bottom';
  if (x === 0) return 'left';
  if (x === COLS - 1) return 'right';
  return null;
}

/**
 * Flag name for a door or cracked wall. Doors on an edge are shared with the neighbouring room,
 * so both sides use the same name; anything else is local to the room.
 */
export function cellFlag(r, x, y) {
  const side = sideOf(x, y);
  const n = side ? neighbour(r, side) : null;
  if (n) {
    const a = side === 'bottom' || side === 'right' ? r : n;
    const kind = side === 'top' || side === 'bottom' ? 'v' : 'h';
    return `door:${a.area}:${a.gx},${a.gy}${kind}`;
  }
  return `cell:${r.id}:${x},${y}`;
}

export const chestFlag = (r, x, y) => `chest:${r.id}:${x},${y}`;
export const trigFlag = (r, kind) => `trig:${r.id}:${kind}`;

export function charAt(r, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return r.map[y][x];
}

/**
 * Is the cell passable for someone walking, given the save flags?
 * ctx: { flags, clear (room enemies all gone), sealed (room is sealed while enemies live) }
 */
export function cellOpen(r, x, y, flags, ctx = {}) {
  const c = charAt(r, x, y);
  if (c === null) return false;
  // A sealed room (boss, mini-boss) shuts every doorway until its enemies are gone.
  if (ctx.sealed && sideOf(x, y) && c !== 'D') return false;
  if (WALKABLE.has(c) || c === 'P') return true;
  switch (c) {
    case 'W': return !!flags[trigFlag(r, 'crystal')];
    case 'c': case 'k': case 'K': case 's': return !!flags[cellFlag(r, x, y)];
    case 'z': return !!ctx.clear;
    default: return false;
  }
}

/** Openings along one edge (cell indexes along the edge that a walker could cross). */
export function edgeCells(r, side) {
  const out = [];
  const n = side === 'top' || side === 'bottom' ? COLS : ROWS;
  for (let i = 0; i < n; i++) {
    const [x, y] = side === 'top' ? [i, 0] : side === 'bottom' ? [i, ROWS - 1] : side === 'left' ? [0, i] : [COLS - 1, i];
    out.push({ i, x, y, c: r.map[y][x] });
  }
  return out;
}

export { OPPOSITE };
