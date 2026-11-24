// Terrain generation and small grid helpers. Pure logic, no Phaser.
import { MAP_W, MAP_H, T } from './defs.js';
import { mulberry } from './rng.js';

export const W = MAP_W;
export const H = MAP_H;
export const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const LAYOUTS = {
  river: { river: true, lakes: 1, forests: 6 },
  lakes: { river: false, lakes: 4, forests: 5 },
  forest: { river: true, lakes: 1, forests: 11 },
};

/**
 * Make a fresh map: grass with a river and/or lakes, clumps of forest, and a highway that comes in
 * from the west edge (the town's link to the outside world). Same seed, same map.
 * Returns { terrain: char[], road: number[], hy: highway row, start: {x, y} }.
 */
export function generate(seed, layout = 'river') {
  const L = LAYOUTS[layout] || LAYOUTS.river;
  const rng = mulberry(seed * 7919 + 13);
  const terrain = new Array(W * H).fill(T.GRASS);
  const road = new Array(W * H).fill(0);
  const set = (x, y, v) => { if (inMap(x, y)) terrain[idx(x, y)] = v; };

  if (L.river) {
    let x = 30 + Math.floor(rng() * 10);
    let wdt = 2;
    for (let y = 0; y < H; y++) {
      for (let k = 0; k < wdt; k++) set(x + k, y, T.WATER);
      const r = rng();
      if (r < 0.25 && x > 26) x--; else if (r > 0.75 && x < 42) x++;
      if (rng() < 0.1) wdt = wdt === 2 ? 3 : 2;
    }
  }
  for (let n = 0; n < L.lakes; n++) {
    const cx = 6 + Math.floor(rng() * (W - 12)); const cy = 4 + Math.floor(rng() * (H - 8));
    if (Math.abs(cy - 24) < 5 && cx < 24) continue; // keep the highway's end dry
    const rx = 2 + rng() * 3; const ry = 2 + rng() * 2.5;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d = (x / rx) ** 2 + (y / ry) ** 2;
      if (d < 1 - rng() * 0.15) set(cx + x, cy + y, T.WATER);
    }
  }
  for (let n = 0; n < L.forests; n++) {
    const cx = Math.floor(rng() * W); const cy = Math.floor(rng() * H); const r = 3 + rng() * 4;
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y) / r;
      if (d < 1 && rng() < 0.85 - d * 0.5 && inMap(cx + x, cy + y) && terrain[idx(cx + x, cy + y)] === T.GRASS) set(cx + x, cy + y, T.TREE);
    }
  }
  // A light sprinkle of single trees.
  for (let i = 0; i < W * H * 0.03; i++) {
    const k = Math.floor(rng() * W * H);
    if (terrain[k] === T.GRASS) terrain[k] = T.TREE;
  }
  // The highway: from the west edge to the middle of the map.
  const hy = 22 + Math.floor(rng() * 4);
  const start = { x: 14, y: hy };
  for (let x = 0; x <= start.x; x++) {
    road[idx(x, hy)] = 1;
    if (terrain[idx(x, hy)] === T.TREE) terrain[idx(x, hy)] = T.GRASS;
  }
  // A clear meadow around where the town starts, so the first roads and zones need no bulldozing.
  for (let y = -7; y <= 7; y++) for (let x = -9; x <= 9; x++) {
    const tx = start.x + x; const ty = hy + y;
    if (inMap(tx, ty) && terrain[idx(tx, ty)] === T.TREE && Math.hypot(x * 0.8, y) < 7) terrain[idx(tx, ty)] = T.GRASS;
  }
  return { terrain, road, hy, start };
}

/** Breadth-first distance (4-way) over tiles where pass(i) is true, from the given source indexes. */
export function bfs(sources, pass, maxD = Infinity) {
  const dist = new Int32Array(W * H).fill(-1);
  const parent = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let qh = 0; let qt = 0;
  for (const s of sources) { if (dist[s] === -1) { dist[s] = 0; q[qt++] = s; } }
  while (qh < qt) {
    const i = q[qh++];
    if (dist[i] >= maxD) continue;
    const x = i % W; const y = (i - x) / W;
    for (const [dx, dy] of N4) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = ny * W + nx;
      if (dist[j] !== -1 || !pass(j)) continue;
      dist[j] = dist[i] + 1; parent[j] = i; q[qt++] = j;
    }
  }
  return { dist, parent };
}

/** An L-shaped path of tiles from a to b (goes along the longer leg first). */
export function lPath(a, b) {
  const out = [];
  const dx = Math.sign(b.x - a.x); const dy = Math.sign(b.y - a.y);
  const horizFirst = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  let x = a.x; let y = a.y;
  out.push({ x, y });
  if (horizFirst) {
    while (x !== b.x) { x += dx; out.push({ x, y }); }
    while (y !== b.y) { y += dy; out.push({ x, y }); }
  } else {
    while (y !== b.y) { y += dy; out.push({ x, y }); }
    while (x !== b.x) { x += dx; out.push({ x, y }); }
  }
  return out;
}

/** Tiles of the rectangle spanned by two corners, clipped to the map. */
export function rectTiles(a, b) {
  const x0 = Math.max(0, Math.min(a.x, b.x)); const x1 = Math.min(W - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y)); const y1 = Math.min(H - 1, Math.max(a.y, b.y));
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
  return out;
}
