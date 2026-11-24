// The map of Tiny Town: a grid of two-lane roads with city blocks between them.
// Units are tiles of 8x8 pixels (the BAS Town art grid). Pure logic, no Phaser.
import { BUILDINGS, RES, COM, IND } from './buildings.js';
import { mulberry } from './rng.js';

export const TILE = 8;
// Road centre lines. A road at line c covers tiles c-1 and c (one lane each way).
export const ROAD_X = [2, 12, 22, 32];
export const ROAD_Y = [2, 11, 20, 29, 38];
export const W = 34;
export const H = 40;

export const DISTRICTS = [
  { id: 'uptown', name: 'Uptown', rows: [0], color: '#8a8fc4', pool: 'res' },
  { id: 'downtown', name: 'Downtown', rows: [1], color: '#e3d245', pool: 'com' },
  { id: 'eastside', name: 'Eastside', rows: [2], color: '#d88038', pool: 'mix' },
  { id: 'harbor', name: 'Harbor', rows: [3], color: '#6c8c50', pool: 'ind' },
];

// Landmarks: [blockCol, blockRow, building key, label]
const LANDMARKS = [
  [1, 1, 'PoliceStation', 'Police HQ', 'hq'],
  [0, 1, 'C13', 'First City Bank', 'bank'],
  [2, 2, 'FireStation', 'Fire Station', 'fire'],
  [2, 0, 'Hospital', 'Mercy Hospital', 'hospital'],
  [1, 3, 'Prison', 'County Jail', 'jail'],
  [0, 0, 'Library', 'Library', 'library'],
  [1, 2, 'HighSchool', 'High School', 'school'],
  [0, 2, 'GasStation1', 'Gas Station', 'gas'],
  [2, 3, 'TankReservoir', 'Docks', 'docks'],
];

const key = (x, y) => `${x},${y}`;

/** Road graph: points on centre lines, each linked to its neighbours one tile away. */
export function buildRoads() {
  const nodes = new Map();
  const add = (x, y) => { if (!nodes.has(key(x, y))) nodes.set(key(x, y), { x, y, n: [] }); return nodes.get(key(x, y)); };
  const x0 = ROAD_X[0]; const x1 = ROAD_X.at(-1); const y0 = ROAD_Y[0]; const y1 = ROAD_Y.at(-1);
  for (const y of ROAD_Y) for (let x = x0; x <= x1; x++) add(x, y);
  for (const x of ROAD_X) for (let y = y0; y <= y1; y++) add(x, y);
  for (const p of nodes.values()) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = nodes.get(key(p.x + dx, p.y + dy));
      // Only link along a road (both points on the same horizontal or vertical road).
      if (!q) continue;
      const along = (dy === 0 && ROAD_Y.includes(p.y)) || (dx === 0 && ROAD_X.includes(p.x));
      if (along) p.n.push(key(q.x, q.y));
    }
  }
  return nodes;
}

/** Shortest path between two road points (inclusive), as [{x,y}...]. */
export function findPath(roads, from, to) {
  const s = key(from.x, from.y); const t = key(to.x, to.y);
  if (s === t) return [{ x: from.x, y: from.y }];
  const prev = new Map([[s, null]]);
  const q = [s];
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    if (k === t) break;
    for (const n of roads.get(k).n) if (!prev.has(n)) { prev.set(n, k); q.push(n); }
  }
  if (!prev.has(t)) return null;
  const path = [];
  for (let k = t; k; k = prev.get(k)) { const p = roads.get(k); path.push({ x: p.x, y: p.y }); }
  return path.reverse();
}

export const pathLength = (path) => Math.max(0, path.length - 1);

/** Nearest road point to a tile position. */
export function nearestRoad(roads, x, y) {
  let best = null; let bd = Infinity;
  for (const p of roads.values()) {
    const d = Math.abs(p.x - x) + Math.abs(p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return { x: best.x, y: best.y };
}

/** Tile rectangle of a block (inside the roads). */
export function blockRect(col, row) {
  const x = ROAD_X[col] + 1; const y = ROAD_Y[row] + 1;
  return { x, y, w: ROAD_X[col + 1] - 1 - x, h: ROAD_Y[row + 1] - 1 - y };
}

export const districtOfRow = (row) => DISTRICTS.find((d) => d.rows.includes(row));

/** Districts by tile position (for incidents and patrols). */
export function districtAt(y) {
  for (let r = 0; r < ROAD_Y.length - 1; r++) if (y < ROAD_Y[r + 1]) return districtOfRow(r).id;
  return DISTRICTS.at(-1).id;
}

function poolFor(d, rng) {
  if (d.pool === 'res') return RES;
  if (d.pool === 'com') return COM;
  if (d.pool === 'ind') return IND;
  return rng() < 0.5 ? RES : COM;
}

/**
 * Fill every block with buildings. The layout is fixed (same seed every game) so saves and
 * addresses stay valid. Returns { lots: [{id, key, x, y, w, h, district, label, kind, door}] }.
 */
export function buildCity() {
  const rng = mulberry(20261124);
  const roads = buildRoads();
  const lots = [];
  for (let row = 0; row < ROAD_Y.length - 1; row++) {
    for (let col = 0; col < ROAD_X.length - 1; col++) {
      const r = blockRect(col, row);
      const d = districtOfRow(row);
      const used = new Set();
      const free = (x, y, w, h) => {
        if (x + w > r.x + r.w || y + h > r.y + r.h) return false;
        for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) if (used.has(key(i, j))) return false;
        return true;
      };
      const place = (bk, x, y, label, kind) => {
        const [pw, ph] = BUILDINGS[bk];
        const w = Math.ceil(pw / TILE); const h = Math.ceil(ph / TILE);
        for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) used.add(key(i, j));
        const lot = { id: lots.length, key: bk, x, y, w, h, district: d.id, label: label || null, kind: kind || 'building' };
        lot.door = nearestRoad(roads, x + w / 2, y + h / 2);
        lots.push(lot);
        return lot;
      };
      for (const [c, rr, bk, label, kind] of LANDMARKS) {
        if (c !== col || rr !== row) continue;
        const [pw, ph] = BUILDINGS[bk];
        const w = Math.ceil(pw / TILE); const h = Math.ceil(ph / TILE);
        // Landmarks sit on the block's front (top) edge, centred.
        place(bk, r.x + Math.floor((r.w - w) / 2), r.y, label, kind);
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (used.has(key(x, y))) continue;
          const pool = poolFor(d, rng);
          // Try a few random buildings that fit here, biggest first.
          const tries = Array.from({ length: 12 }, () => pool[Math.floor(rng() * pool.length)])
            .sort((a, b) => BUILDINGS[b][0] * BUILDINGS[b][1] - BUILDINGS[a][0] * BUILDINGS[a][1]);
          const fit = tries.find((bk) => free(x, y, Math.ceil(BUILDINGS[bk][0] / TILE), Math.ceil(BUILDINGS[bk][1] / TILE)));
          if (fit) place(fit, x, y);
          else used.add(key(x, y)); // a small yard
        }
      }
    }
  }
  return { roads, lots, landmark: (kind) => lots.find((l) => l.kind === kind) };
}
