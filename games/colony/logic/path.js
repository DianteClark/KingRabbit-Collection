// Grid pathfinding: A* (8 directions, no cutting corners past blocked tiles) and a flood fill
// that gives walking distance from one tile to every other (used to pick the nearest job).
// cost(i) returns Infinity for a blocked tile, otherwise the price of stepping onto it (>= 1).
import { W, H, N } from './data.js';

const g = new Float32Array(N);
const came = new Int32Array(N);
const stamp = new Uint32Array(N);
const shut = new Uint32Array(N);
let gen = 0;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

/** Shortest path from a to b as a list of tile indices (excluding a), or null. */
const hf = new Float64Array(N * 8);
const hi = new Int32Array(N * 8);
export function findPath(a, b, cost, maxNodes = 4000) {
  if (a === b) return [];
  if (cost(b) === Infinity) return null;
  gen++;
  let n = 0;
  const push = (f, i) => {
    let k = n++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[p] <= f) break;
      hf[k] = hf[p]; hi[k] = hi[p]; k = p;
    }
    hf[k] = f; hi[k] = i;
  };
  const pop = () => {
    const top = hi[0];
    const lf = hf[--n]; const li = hi[n];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1; const r = l + 1;
      if (l >= n) break;
      const m = r < n && hf[r] < hf[l] ? r : l;
      if (hf[m] >= lf) break;
      hf[k] = hf[m]; hi[k] = hi[m]; k = m;
    }
    hf[k] = lf; hi[k] = li;
    return top;
  };
  const bx = b % W; const by = (b - bx) / W;
  const h = (i) => { const dx = Math.abs(i % W - bx); const dy = Math.abs((i - (i % W)) / W - by); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  g[a] = 0; stamp[a] = gen; came[a] = -1;
  push(h(a), a);
  let nodes = 0;
  while (n > 0) {
    const i = pop();
    if (shut[i] === gen) continue;
    shut[i] = gen;
    if (i === b) {
      const out = [];
      for (let k = b; k !== a; k = came[k]) out.push(k);
      return out.reverse();
    }
    if (++nodes > maxNodes) return null;
    const x = i % W; const y = (i - x) / W;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d]; const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (shut[j] === gen) continue;
      const c = cost(j);
      if (c === Infinity) continue;
      if (d >= 4 && (cost(y * W + nx) === Infinity || cost(ny * W + x) === Infinity)) continue;
      const ng = g[i] + c * (d >= 4 ? 1.41 : 1);
      if (stamp[j] === gen && ng >= g[j]) continue;
      stamp[j] = gen; g[j] = ng; came[j] = i;
      if (n < hf.length) push(ng + h(j), j);
    }
  }
  return null;
}

/** Steps from start to every reachable tile (Int16Array, -1 = unreachable). */
const q = new Int32Array(N);
export function distanceMap(start, pass) {
  if (typeof pass !== 'function') { const g = pass; pass = (i) => g[i] === 1; }
  const d = new Int16Array(N).fill(-1);
  let head = 0; let tail = 0;
  d[start] = 0; q[tail++] = start;
  while (head < tail) {
    const i = q[head++];
    const x = i % W; const y = (i - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k]; const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (d[j] !== -1 || !pass(j)) continue;
      if (k >= 4 && (!pass(y * W + nx) || !pass(ny * W + x))) continue;
      d[j] = d[i] + 1;
      q[tail++] = j;
    }
  }
  return d;
}

/**
 * Where to stand to work on tile t: t itself when walkable, else the nearest walkable neighbour
 * (by the distance map). Returns { at, d } or null.
 */
export function standFor(t, dm, pass, allowOn = true) {
  if (allowOn && pass(t) && dm[t] >= 0) return { at: t, d: dm[t] };
  const x = t % W; const y = (t - x) / W;
  let best = null;
  for (let k = 0; k < 8; k++) {
    const nx = x + DX[k]; const ny = y + DY[k];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (dm[j] >= 0 && pass(j) && (!best || dm[j] < best.d)) best = { at: j, d: dm[j] };
  }
  return best;
}
