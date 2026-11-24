// Adventure-map path finding (Dijkstra over 8 directions; straight step 10, diagonal 14).
// Some tiles can be a destination but never passed through: objects you visit or pick up,
// monsters and enemy heroes (you attack them), and tiles next to a monster (it ambushes you).

export const STEP = 10;
export const DIAG = 14;
const DIRS = [[1, 0, STEP], [-1, 0, STEP], [0, 1, STEP], [0, -1, STEP], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]];

/**
 * grid = { w, h, block: Uint8Array (1 = impassable), stop: Uint8Array (1 = can end here but not pass),
 *          attack?: Uint8Array (1 = monster tile, can be entered from a stop tile) }
 * Returns { dist: Float64Array, prev: Int32Array } from (sx, sy).
 */
export function dijkstra(grid, sx, sy, maxCost = Infinity) {
  const { w, h, block, stop, attack } = grid;
  const n = w * h;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = sy * w + sx;
  dist[start] = 0;
  // Small binary heap of [cost, idx].
  const heap = [[0, start]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, idx] = pop();
    if (d > dist[idx]) continue;
    // Stop tiles can be arrived at but not passed, except that a hero standing next to a
    // monster may still step into it (that is the attack).
    const stopped = idx !== start && stop[idx];
    if (stopped && !attack) continue;
    const x = idx % w; const y = (idx - x) / w;
    for (const [dx, dy, c] of DIRS) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (block[ni] || (stopped && !attack[ni])) continue;
      // No squeezing diagonally between two blocked tiles.
      if (dx && dy && block[y * w + nx] && block[ny * w + x]) continue;
      const nd = d + c;
      if (nd < dist[ni] && nd <= maxCost) { dist[ni] = nd; prev[ni] = idx; push([nd, ni]); }
    }
  }
  return { dist, prev };
}

/** Rebuild the tile path to (tx, ty): [{x, y, cost}] (cost = cumulative), excluding the start. */
export function tracePath(grid, res, tx, ty) {
  const { w } = grid;
  let idx = ty * w + tx;
  if (!Number.isFinite(res.dist[idx])) return null;
  const out = [];
  while (res.prev[idx] !== -1) {
    out.unshift({ x: idx % w, y: Math.floor(idx / w), cost: res.dist[idx] });
    idx = res.prev[idx];
  }
  return out;
}
