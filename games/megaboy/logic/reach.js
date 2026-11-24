// Reachability checker: proves a stage can be crossed with the hero's real jump arc.
// It runs the actual player physics (player.js + level.js) from every standing spot it can
// reach: walks, jumps of several heights with the run button held at different times, ladder
// climbs and waits for moving platforms and appearing blocks. A jump only counts if it lands
// without touching spikes or falling into a pit. Enemies are ignored (they can be shot).
import { TILE, DT, T } from './constants.js';
import { Level, moveY, overlap } from './level.js';
import { newPlayer, stepPlayer } from './player.js';

const DIRS = [-1, 0, 1];
const HOLDS = [6, 14, 60];
const TIMING = {
  all: (f) => 1,
  early: (f) => (f < 12 ? 1 : 0),
  late: (f) => (f >= 10 ? 1 : 0),
  late2: (f) => (f >= 20 ? 1 : 0),
};

function scripts() {
  const out = [];
  for (const d of [-1, 1]) {
    out.push({ name: `walk${d}`, inp: () => ({ l: d < 0, r: d > 0 }), walk: true, maxF: 40 });
    out.push({ name: `up${d}`, inp: (f, p) => ({ l: d < 0 && p.climb === null, r: d > 0 && p.climb === null, u: true }), climb: true, maxF: 700 });
    out.push({ name: `down${d}`, inp: (f, p) => ({ l: d < 0 && p.climb === null, r: d > 0 && p.climb === null, d: true }), climb: true, maxF: 700 });
  }
  for (const d of DIRS) {
    for (const hold of HOLDS) {
      for (const [tn, tf] of Object.entries(TIMING)) {
        if (d === 0 && tn !== 'all') continue;
        out.push({ name: `j${d}:${hold}:${tn}`, inp: (f) => { const k = tf(f) * d; return { l: k < 0, r: k > 0, jump: f < hold, jumpP: f === 0 }; }, maxF: 150 });
      }
    }
    // run a few steps first, then jump: gets right up to edges and spikes
    if (d !== 0) {
      for (const delay of [3, 6, 9]) {
        for (const hold of [14, 60]) {
          out.push({ name: `rj${d}:${delay}:${hold}`, inp: (f) => ({ l: d < 0, r: d > 0, jump: f >= delay && f < delay + hold, jumpP: f === delay }), maxF: 160 });
        }
      }
    }
    // jump and grab a ladder on the way up
    out.push({ name: `jl${d}`, inp: (f, p) => ({ l: d < 0 && p.climb === null, r: d > 0 && p.climb === null, jump: f < 60, jumpP: f === 0, u: true }), climb: true, maxF: 700 });
  }
  return out;
}
const SCRIPTS = scripts();

/**
 * Explore a stage. opts: { from: {x, y feet}, breakCracks } -> { nodes, items:Set, doorReached, maxX }
 */
export function reach(def, opts = {}) {
  const lv = new Level(def);
  if (opts.breakCracks) for (let i = 0; i < lv.tiles.length; i++) if (lv.tiles[i] === T.CRACK) lv.broken.add(i);
  const periods = [...lv.movers.map((m) => m.period), ...(lv.blinks.length ? [lv.blink.period] : [])];
  const cycle = periods.length ? Math.max(...periods) : 1;
  const K = periods.length ? 16 : 1;
  const step = cycle / K;
  const dynX = [...lv.movers.flatMap((m) => [m.x0, m.x0 + m.dx + m.w]), ...lv.blinks.map((b) => b.x)];
  const nearDyn = (x) => dynX.some((d) => Math.abs(d - x) < 100);
  const items = new Set();
  const doorX = lv.doorCol >= 0 ? lv.doorCol * TILE : Infinity;
  let doorReached = false;
  let maxX = 0;

  const staticUnder = (p) => {
    const row = Math.floor((p.y + p.h + 0.5) / TILE);
    const x0 = Math.floor(p.x / TILE); const x1 = Math.floor((p.x + p.w - 0.001) / TILE);
    for (let cx = x0; cx <= x1; cx++) {
      const t = lv.at(cx, row);
      if (t !== T.EMPTY && t !== T.LADDER) return true;
      if (lv.oneWay(cx, row)) return true;
    }
    return false;
  };
  const moverUnder = (p, t) => {
    for (const m of lv.movers) {
      const r = lv.moverRect(m, t);
      if (p.x + p.w > r.x + 1 && p.x < r.x + r.w - 1 && Math.abs(p.y + p.h - r.y) < 1) return m;
    }
    return null;
  };

  const start = opts.from || lv.start;
  const p0 = newPlayer(start.x, start.y);
  const nodes = new Map();
  const queue = [];
  const add = (p, t) => {
    const dyn = !staticUnder(p);
    const k = dyn ? Math.round((((t % cycle) + cycle) % cycle) / step) % K : -1;
    const key = `${Math.round(p.x / 3)},${Math.round(p.y)},${k}`;
    if (nodes.has(key)) return;
    const n = { x: p.x, y: p.y, t, dyn, key };
    nodes.set(key, n);
    queue.push(n);
    maxX = Math.max(maxX, p.x + p.w);
    if (p.x + p.w >= doorX - 1) doorReached = true;
  };

  const run = (n, t0, sc) => {
    const p = newPlayer(0, 0);
    p.x = n.x; p.y = n.y; p.onGround = true; p.mover = moverUnder(p, t0);
    let air = false; let t = t0; let climbed = false;
    for (let f = 0; f < sc.maxF; f++) {
      const inp = sc.inp(f, p);
      t += DT;
      const ev = stepPlayer(p, inp, lv, t, DT);
      if (ev.includes('spike') || ev.includes('pit')) return null;
      for (const it of lv.items) if (!items.has(it.id) && overlap(p, { x: it.x - 4, y: it.y - 8, w: 8, h: 8 })) items.add(it.id);
      if (p.climb !== null) climbed = true;
      if (!p.onGround && p.climb === null) air = true;
      if (ev.includes('ladderTop')) return { p, t };
      if (sc.walk && f >= 10 && p.onGround && !air) return { p, t };
      if ((air || climbed) && p.onGround && p.climb === null) return { p, t };
      if (sc.climb && !climbed && f > 30 && p.onGround && !air) return null; // nothing to climb here
    }
    return null;
  };

  const wait = (n) => {
    const p = newPlayer(0, 0);
    p.x = n.x; p.y = n.y; p.onGround = true; p.mover = moverUnder(p, n.t);
    let t = n.t; let air = false;
    const frames = Math.round(step / DT);
    for (let f = 0; f < 240; f++) {
      t += DT;
      const ev = stepPlayer(p, {}, lv, t, DT);
      if (ev.includes('spike') || ev.includes('pit')) return null;
      if (!p.onGround) air = true;
      if (air && p.onGround) return { p, t };
      if (!air && f >= frames - 1) return { p, t };
    }
    return null;
  };

  add(p0, 0);
  let guard = 0;
  while (queue.length && guard++ < 20000) {
    const n = queue.shift();
    const times = n.dyn ? [n.t] : (nearDyn(n.x) ? Array.from({ length: K }, (_, j) => j * step) : [0]);
    for (const t0 of times) {
      for (const sc of SCRIPTS) {
        const r = run(n, t0, sc);
        if (r) add(r.p, r.t);
      }
    }
    if (n.dyn) { const r = wait(n); if (r) add(r.p, r.t); }
  }
  return { nodes: [...nodes.values()], items, doorReached, maxX, lv };
}
