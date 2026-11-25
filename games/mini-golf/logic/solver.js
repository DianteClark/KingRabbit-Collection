// A brute-force shot finder used by the tests (and to record each hole's known solution).
// It plays real shots with the game's own physics and keeps the few best resting spots, ranked by
// the walking distance to the cup from a grid flood fill.
import { simulate, validSpot, zoneAt, inPoly, BALL_R } from './physics.js';

/** Grid distance (px) from every cell to the cup, around walls. Water costs a lot but can be crossed (ramps). */
export function flowField(W, cell = 6) {
  const { box } = W;
  const cols = Math.ceil(box.w / cell) + 1; const rows = Math.ceil(box.h / cell) + 1;
  const cost = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = box.x + c * cell; const y = box.y + r * cell;
      let k = 0;
      if (!inPoly(W.bounds, x, y) || W.blocks.some((b) => inPoly(b, x, y))) k = Infinity;
      else if (W.bumpers.some((b) => Math.hypot(x - b.x, y - b.y) < b.r + BALL_R)) k = Infinity;
      else if (zoneAt(W, x, y)?.t === 'water') k = W.hole.zones.some((z) => z.t === 'ramp') ? 12 : Infinity;
      else k = 1;
      cost[r * cols + c] = k;
    }
  }
  const dist = new Float64Array(cols * rows).fill(Infinity);
  const idx = (x, y) => Math.round((y - box.y) / cell) * cols + Math.round((x - box.x) / cell);
  const start = idx(W.cup.x, W.cup.y);
  dist[start] = 0;
  // Dijkstra with a simple binary heap.
  const heap = [[0, start]];
  const push = (d, i) => { heap.push([d, i]); let j = heap.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (heap[p][0] <= heap[j][0]) break; [heap[p], heap[j]] = [heap[j], heap[p]]; j = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let j = 0; for (;;) { const l = 2 * j + 1; const r = l + 1; let m = j; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === j) break; [heap[m], heap[j]] = [heap[j], heap[m]]; j = m; } } return top; };
  // teleporters work both ways for distance purposes: from a -> b means dist(a) <= dist(b)
  const teleFrom = new Map();
  for (const tp of W.teleports) teleFrom.set(idx(tp.b[0], tp.b[1]), [...(teleFrom.get(idx(tp.b[0], tp.b[1])) || []), idx(tp.a[0], tp.a[1])]);
  const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const c = i % cols; const r = (i - c) / cols;
    for (const [dc, dr, w] of D8) {
      const nc = c + dc; const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (cost[j] === Infinity) continue;
      const nd = d + w * cell * cost[j];
      if (nd < dist[j]) { dist[j] = nd; push(nd, j); }
    }
    for (const j of teleFrom.get(i) || []) if (d < dist[j]) { dist[j] = d; push(d, j); }
  }
  const at = (x, y) => {
    const c = Math.round((x - box.x) / cell); const r = Math.round((y - box.y) / cell);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return Infinity;
    // nearest open neighbour (a ball against a wall sits half in a wall cell)
    let best = dist[r * cols + c];
    for (const [dc, dr] of D8) {
      const nc = c + dc; const nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) best = Math.min(best, dist[nr * cols + nc] + cell);
    }
    return best;
  };
  return { at, cell, dist, cols, rows };
}

/** Can the cup be reached from the tee without swimming (unless the hole has ramps)? */
export function cupReachable(W) {
  return Number.isFinite(flowField(W).at(W.tee.x, W.tee.y));
}

const hasMovers = (W) => W.movers.length > 0;

/**
 * Find a way to hole out. Returns { strokes, shots: [{ angle, power, wait }] } or null.
 * strokes counts water penalties. limit = most strokes to look for.
 */
export function solve(W, { limit = 6, beam = 5, angles = 72, powers = [0.1, 0.16, 0.22, 0.3, 0.38, 0.47, 0.57, 0.68, 0.8, 0.92, 1], waits, t0 = 0 } = {}) {
  const field = flowField(W);
  const waitList = waits || (hasMovers(W) ? [0, 0.4, 0.8, 1.2, 1.6] : [0]);
  let frontier = [{ x: W.tee.x, y: W.tee.y, t: t0, strokes: 0, shots: [] }];
  let best = null;
  for (let depth = 0; depth < limit && frontier.length; depth++) {
    const next = new Map();
    for (const st of frontier) {
      if (best && st.strokes + 1 >= best.strokes) continue;
      const dirs = [];
      for (let k = 0; k < angles; k++) dirs.push((k / angles) * Math.PI * 2);
      const toCup = Math.atan2(W.cup.y - st.y, W.cup.x - st.x);
      for (const d of [-0.04, -0.02, 0, 0.02, 0.04]) dirs.push(toCup + d);
      for (const tp of W.teleports) dirs.push(Math.atan2(tp.a[1] - st.y, tp.a[0] - st.x));
      for (const wait of waitList) {
        for (const angle of dirs) {
          for (const power of powers) {
            const r = simulate(W, st.x, st.y, st.t + wait, angle, power);
            const shot = { angle, power, wait };
            if (r.status === 'holed') {
              const strokes = st.strokes + 1;
              if (!best || strokes < best.strokes) best = { strokes, shots: [...st.shots, shot] };
              continue;
            }
            if (r.status !== 'rest') continue; // water / reset: no progress
            const score = field.at(r.x, r.y);
            if (!Number.isFinite(score)) continue;
            const key = `${Math.round(r.x / 14)},${Math.round(r.y / 14)}`;
            const prev = next.get(key);
            if (!prev || prev.score > score) next.set(key, { x: r.x, y: r.y, t: r.t, strokes: st.strokes + 1, shots: [...st.shots, shot], score });
          }
        }
      }
    }
    if (best && best.strokes <= depth + 2) return best;
    frontier = [...next.values()].sort((a, b) => a.score - b.score).slice(0, beam);
  }
  return best;
}

/** Replay recorded shots. Returns { strokes, holed }. */
export function replay(W, shots, t0 = 0) {
  let x = W.tee.x; let y = W.tee.y; let t = t0; let strokes = 0;
  for (const s of shots) {
    const r = simulate(W, x, y, t + (s.wait || 0), s.angle, s.power);
    strokes++;
    if (r.status === 'holed') return { strokes, holed: true };
    if (r.status === 'water' || r.status === 'reset') { if (r.status === 'water') strokes++; t = r.t; continue; }
    x = r.x; y = r.y; t = r.t;
  }
  return { strokes, holed: false, x, y };
}

export { validSpot };
