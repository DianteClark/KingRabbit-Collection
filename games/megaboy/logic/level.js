// A stage's map and the tile physics every body uses (player, walkers, bosses, the reach checker).
// Moving platforms and appearing blocks are pure functions of time, so the reach checker can
// replay them exactly.
import { TILE, ROWS, T, TILE_CHARS, SOLID_TILES, ENEMY_CHARS, PICKUP_CHARS } from './constants.js';

export class Level {
  /** def: { id, map: string[15], movers: [{dx, dy, period, w?, offset?}], blink: {period, on, groups} } */
  constructor(def) {
    this.def = def;
    const rows = def.map;
    if (rows.length !== ROWS) throw new Error(`${def.id}: map must be ${ROWS} rows, got ${rows.length}`);
    this.cols = rows[0].length;
    this.rows = ROWS;
    rows.forEach((r, i) => { if (r.length !== this.cols) throw new Error(`${def.id}: row ${i} is ${r.length} wide, expected ${this.cols}`); });
    this.W = this.cols * TILE;
    this.H = this.rows * TILE;
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.spawns = [];
    this.items = [];
    this.movers = [];
    this.blinks = [];
    this.blinkAt = new Map();
    this.checkpoints = [];
    this.start = null;
    this.bossAt = null;
    this.doorCol = -1;
    const moverDefs = def.movers || [];
    const marks = [];
    // read column by column so movers are numbered left to right
    for (let cx = 0; cx < this.cols; cx++) {
      for (let cy = 0; cy < this.rows; cy++) {
        const ch = rows[cy][cx];
        const i = cy * this.cols + cx;
        if (ch in TILE_CHARS) {
          this.tiles[i] = TILE_CHARS[ch];
          if (ch === 'D' && this.doorCol < 0) this.doorCol = cx;
          continue;
        }
        const x = cx * TILE; const y = cy * TILE;
        if (ch === 'P') this.start = { x: x + TILE / 2, y: y + TILE };
        else if (ch === 'C') this.checkpoints.push({ x: x + TILE / 2, y: y + TILE });
        else if (ch === 'B') this.bossAt = { x: x + TILE / 2, y: y + TILE };
        else if (ENEMY_CHARS[ch]) this.spawns.push({ id: this.spawns.length, kind: ENEMY_CHARS[ch], x: x + TILE / 2, y: y + TILE, cx, cy });
        else if (PICKUP_CHARS[ch]) this.items.push({ id: `${def.id}:${cx},${cy}`, kind: PICKUP_CHARS[ch], x: x + TILE / 2, y: y + TILE });
        else if (ch === 'M') marks.push({ cx, cy });
        else if (ch >= '1' && ch <= '9') {
          const b = { cx, cy, x, y, group: Number(ch) - 1 };
          this.blinks.push(b);
          this.blinkAt.set(i, b);
        } else if (ch !== ' ') throw new Error(`${def.id}: unknown map char '${ch}' at ${cx},${cy}`);
      }
    }
    marks.forEach((m, k) => {
      const d = moverDefs[k];
      if (!d) throw new Error(`${def.id}: mover ${k} at ${m.cx},${m.cy} has no settings`);
      this.movers.push({ id: k, x0: m.cx * TILE, y0: m.cy * TILE, w: d.w || 24, h: 4, dx: d.dx || 0, dy: d.dy || 0, period: d.period || 4, offset: d.offset || 0 });
    });
    if (moverDefs.length !== marks.length) throw new Error(`${def.id}: ${marks.length} movers on the map, ${moverDefs.length} defined`);
    if (!this.start) throw new Error(`${def.id}: no player start`);
    this.blink = def.blink || { period: 3, on: 1.8, groups: 3 };
    this.checkpoints.sort((a, b) => a.x - b.x);
    this.broken = new Set();
    this.doorOpen = false;
    // boss arena: everything right of the shutter door
    this.arena = this.doorCol >= 0 ? { x0: (this.doorCol + 1) * TILE, x1: this.W } : null;
  }

  idx(cx, cy) { return cy * this.cols + cx; }

  /** Tile code with doors and broken blocks applied. Off the sides is wall; above the top repeats row 0. */
  at(cx, cy) {
    if (cx < 0 || cx >= this.cols) return T.SOLID;
    if (cy >= this.rows) return T.EMPTY;
    if (cy < 0) cy = 0;
    const i = cy * this.cols + cx;
    const t = this.tiles[i];
    if (t === T.CRACK && this.broken.has(i)) return T.EMPTY;
    if (t === T.DOOR && this.doorOpen) return T.EMPTY;
    return t;
  }

  blinkOn(b, time) {
    const { period, on, groups } = this.blink;
    const ph = (((time / period) - b.group / groups) % 1 + 1) % 1;
    return ph * period < on;
  }

  solid(cx, cy, time) {
    if (SOLID_TILES.has(this.at(cx, cy))) return true;
    if (cy < 0 || cy >= this.rows || cx < 0 || cx >= this.cols) return false;
    const b = this.blinkAt.get(cy * this.cols + cx);
    return !!b && this.blinkOn(b, time);
  }

  /** Top of a ladder or a thin platform: you can stand on it but pass up through it. */
  oneWay(cx, cy) {
    const t = this.at(cx, cy);
    if (t === T.ONEWAY) return true;
    return t === T.LADDER && cy >= 0 && this.at(cx, cy - 1) !== T.LADDER;
  }

  isLadder(cx, cy) { return this.at(cx, cy) === T.LADDER; }

  /** Moving platform rectangle at a time (smooth ping-pong between start and start + d). */
  moverRect(m, time) {
    const ph = (((time / m.period) + m.offset) % 1 + 1) % 1;
    const k = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    return { x: m.x0 + m.dx * k, y: m.y0 + m.dy * k, w: m.w, h: m.h };
  }

  /** Mirror of a broken-block or door change for a fresh run (respawn keeps broken blocks). */
  reset() { this.doorOpen = false; }
}

// ------------------------------------------------------------------ body movement

const EPS = 0.001;

/** Move a body {x, y, w, h} sideways, stopping at solid tiles. Returns true if it hit a wall. */
export function moveX(lv, b, dx, time) {
  if (!dx) return false;
  const nx = b.x + dx;
  const y0 = Math.floor(b.y / TILE); const y1 = Math.floor((b.y + b.h - EPS) / TILE);
  if (dx > 0) {
    const cx = Math.floor((nx + b.w - EPS) / TILE);
    for (let cy = y0; cy <= y1; cy++) if (lv.solid(cx, cy, time)) { b.x = Math.max(b.x, cx * TILE - b.w); return true; }
  } else {
    const cx = Math.floor(nx / TILE);
    for (let cy = y0; cy <= y1; cy++) if (lv.solid(cx, cy, time)) { b.x = Math.min(b.x, (cx + 1) * TILE); return true; }
  }
  b.x = nx;
  return false;
}

/**
 * Move a body up or down. Lands on solid tiles, one-way tops (unless dropping) and moving platforms.
 * Returns { landed, bumped, mover } (mover = the platform landed on).
 */
export function moveY(lv, b, dy, time, { drop = false, movers = true } = {}) {
  const res = { landed: false, bumped: false, mover: null };
  if (!dy) return res;
  const x0 = Math.floor(b.x / TILE); const x1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (dy > 0) {
    const oldB = b.y + b.h; const newB = oldB + dy;
    let land = Infinity;
    // rows whose top edge the feet reach this step
    const c0 = Math.ceil((oldB - EPS) / TILE); const c1 = Math.floor(newB / TILE);
    for (let cy = c0; cy <= c1 && land === Infinity; cy++) {
      const top = cy * TILE;
      for (let cx = x0; cx <= x1; cx++) {
        if (lv.solid(cx, cy, time) || (!drop && lv.oneWay(cx, cy))) { land = top; break; }
      }
    }
    if (movers) {
      for (const m of lv.movers) {
        const r = lv.moverRect(m, time);
        if (b.x + b.w > r.x + 1 && b.x < r.x + r.w - 1 && oldB <= r.y + 0.75 && newB >= r.y && r.y < land) { land = r.y; res.mover = m; }
      }
    }
    if (land !== Infinity) { b.y = land - b.h; res.landed = true; return res; }
    b.y += dy;
    return res;
  }
  const ny = b.y + dy;
  const cy = Math.floor(ny / TILE);
  for (let cx = x0; cx <= x1; cx++) {
    if (lv.solid(cx, cy, time)) { b.y = Math.min(b.y, (cy + 1) * TILE); res.bumped = true; return res; }
  }
  b.y = ny;
  return res;
}

/** Is there something to stand on right under the body? */
export function grounded(lv, b, time) {
  const probe = { x: b.x, y: b.y, w: b.w, h: b.h };
  return moveY(lv, probe, 0.5, time).landed && probe.y <= b.y + 0.01;
}

/** Tile codes the body overlaps (optionally grown by a margin). */
export function touching(lv, b, grow = 0) {
  const out = new Set();
  const x0 = Math.floor((b.x - grow) / TILE); const x1 = Math.floor((b.x + b.w + grow - EPS) / TILE);
  const y0 = Math.floor((b.y - grow) / TILE); const y1 = Math.floor((b.y + b.h + grow - EPS) / TILE);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.add(lv.at(cx, cy));
  return out;
}

export const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
