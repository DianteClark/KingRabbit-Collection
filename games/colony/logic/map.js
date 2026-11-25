// Grid helpers and the wilderness generator.
import { W, H, N, T, P } from './data.js';
import { next } from './rng.js';

export const idx = (x, y) => y * W + x;
export const tx = (i) => i % W;
export const ty = (i) => (i - (i % W)) / W;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const dist = (a, b) => Math.hypot(tx(a) - tx(b), ty(a) - ty(b));
export const near = (i, cb, diag = true) => {
  const x = tx(i); const y = ty(i);
  for (const [dx, dy] of diag ? N8 : N4) { const nx = x + dx; const ny = y + dy; if (inMap(nx, ny)) cb(idx(nx, ny), dx, dy); }
};
export const START = { x: Math.floor(W / 2), y: Math.floor(H / 2) };

/** Smooth value noise on a grid of the given cell size, 0..1. */
function noise(r, cell) {
  const gw = Math.ceil(W / cell) + 2; const gh = Math.ceil(H / cell) + 2;
  const g = Array.from({ length: gw * gh }, () => next(r));
  const out = new Float32Array(N);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / cell; const fy = y / cell;
      const x0 = Math.floor(fx); const y0 = Math.floor(fy);
      const sx = sm(fx - x0); const sy = sm(fy - y0);
      const v = (i, j) => g[(y0 + j) * gw + (x0 + i)];
      const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
      const b = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
      out[idx(x, y)] = a + (b - a) * sy;
    }
  }
  return out;
}

/**
 * Generate a wilderness. opts: { ore: multiplier, food: multiplier }.
 * Returns { ter, plant } arrays of length W*H.
 */
export function generate(seed, opts = {}) {
  const r = { rng: seed >>> 0 };
  const oreMul = opts.ore ?? 1; const foodMul = opts.food ?? 1;
  const e1 = noise(r, 12); const e2 = noise(r, 5); const m = noise(r, 9); const f2 = noise(r, 4); const o = noise(r, 3);
  const ter = new Array(N).fill(T.GRASS);
  const plant = new Array(N).fill(P.NONE);
  // A mountain along one side (raises elevation toward a random edge).
  const side = Math.floor(next(r) * 4);
  for (let i = 0; i < N; i++) {
    const x = tx(i); const y = ty(i);
    const edge = [x / W, 1 - x / W, y / H, 1 - y / H][side];
    const e = e1[i] * 0.55 + e2[i] * 0.2 + (1 - edge) * 0.45;
    const d = Math.hypot(x - START.x, (y - START.y) * 0.8);
    if (d < 6) continue;
    if (e > 0.78) ter[i] = o[i] > 0.66 - 0.08 * (oreMul - 1) ? T.ORE : T.ROCK;
    else if (e < 0.26 && m[i] > 0.35) ter[i] = T.WATER;
    else if (m[i] < 0.28) ter[i] = T.DIRT;
  }
  // Make sure there is water, rock and some ore.
  const count = (t) => ter.filter((v) => v === t).length;
  if (count(T.WATER) < 25) blob(r, ter, T.WATER, 4, side);
  if (count(T.ROCK) + count(T.ORE) < 70) blob(r, ter, T.ROCK, 5, (side + 1) % 4);
  let ores = count(T.ORE);
  for (let guard = 0; ores < 24 * oreMul && guard < 4000; guard++) {
    const i = Math.floor(next(r) * N);
    if (ter[i] === T.ROCK) { ter[i] = T.ORE; ores++; }
  }
  // Plants
  for (let i = 0; i < N; i++) {
    if (ter[i] !== T.GRASS && ter[i] !== T.DIRT) continue;
    const x = tx(i); const y = ty(i);
    if (Math.hypot(x - START.x, (y - START.y) * 0.8) < 4.5) continue;
    const forest = f2[i] * 0.6 + m[i] * 0.4;
    const rr = next(r);
    if (forest > 0.56 && rr < 0.7) plant[i] = e1[i] > 0.5 ? P.PINE : P.TREE;
    else if (rr < 0.05) plant[i] = next(r) < 0.5 ? P.TREE : P.PINE;
    else if (rr < 0.05 + 0.028 * foodMul) plant[i] = P.BUSH;
    else if (rr < 0.05 + 0.028 * foodMul + 0.012) plant[i] = P.HERB;
  }
  // A few bushes near the landing spot so the first days have food.
  let placed = 0;
  for (let guard = 0; placed < Math.round(4 * foodMul) && guard < 500; guard++) {
    const x = START.x + Math.floor(next(r) * 17) - 8; const y = START.y + Math.floor(next(r) * 17) - 8;
    const i = idx(x, y);
    if (Math.hypot(x - START.x, y - START.y) < 5) continue;
    if (inMap(x, y) && ter[i] <= T.DIRT && !plant[i]) { plant[i] = P.BUSH; placed++; }
  }
  // Keep everything walkable connected to the landing spot: fill any cut-off pocket with rock.
  const seen = reach(ter, idx(START.x, START.y));
  for (let i = 0; i < N; i++) if (!seen[i] && ter[i] <= T.DIRT) { ter[i] = T.ROCK; plant[i] = P.NONE; }
  return { ter, plant };
}

function blob(r, ter, kind, rad, side) {
  const cx = [rad + 2, W - rad - 3, Math.floor(W / 2), Math.floor(W / 2)][side] + Math.floor(next(r) * 6) - 3;
  const cy = [Math.floor(H / 2), Math.floor(H / 2), rad + 2, H - rad - 3][side] + Math.floor(next(r) * 6) - 3;
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      if (inMap(x, y) && Math.hypot(x - cx, y - cy) <= rad + next(r) * 0.8 && Math.hypot(x - START.x, y - START.y) > 7) ter[idx(x, y)] = kind;
    }
  }
}

/** Walkable tiles reachable from i (terrain only). */
export function reach(ter, start) {
  const seen = new Uint8Array(N);
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const i = q.pop();
    near(i, (j) => { if (!seen[j] && ter[j] <= T.DIRT) { seen[j] = 1; q.push(j); } }, false);
  }
  return seen;
}
