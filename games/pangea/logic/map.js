// Map generation: one big continent (the "Pangea") with ragged coasts and bays, a few islands,
// climate bands, hills, mountains, forests and resources, plus fair start spots for every civ.
import { makeRng } from './rng.js';
import { TERRAIN, FEATURES, RESOURCES } from './data.js';

export const idx = (m, x, y) => y * m.w + x;
export const inMap = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export const DIRS8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
/** Distance in moves on a square grid with diagonals (Chebyshev). */
export const dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function isLand(tile) { return TERRAIN[tile.t].land; }
export function passableLand(tile) { return isLand(tile) && !(tile.f && FEATURES[tile.f].blocked); }

function noiseField(rng, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2; const gh = Math.ceil(h / cell) + 2;
  const g = Array.from({ length: gw * gh }, () => rng());
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell; const fy = y / cell;
    const x0 = Math.floor(fx); const y0 = Math.floor(fy);
    const tx = sm(fx - x0); const ty = sm(fy - y0);
    const v = (a, b) => g[b * gw + a];
    const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx;
    const bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    return top + (bot - top) * ty;
  };
}

function fractal(rng, w, h, cells) {
  const fields = cells.map((c) => noiseField(rng, w, h, c));
  return (x, y) => fields.reduce((a, f, i) => a + f(x, y) / (i + 1), 0) / fields.reduce((a, _f, i) => a + 1 / (i + 1), 0);
}

/** Flood-fill the passable land tiles connected to (x, y). Returns a Set of indices. */
export function landComponent(m, x, y, ok = passableLand) {
  const seen = new Set();
  const start = idx(m, x, y);
  if (!ok(m.tiles[start])) return seen;
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const i = stack.pop();
    const cx = i % m.w; const cy = Math.floor(i / m.w);
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx; const ny = cy + dy;
      if (!inMap(m, nx, ny)) continue;
      const j = idx(m, nx, ny);
      if (seen.has(j) || !ok(m.tiles[j])) continue;
      seen.add(j); stack.push(j);
    }
  }
  return seen;
}

export function tileYield(tile) {
  const base = tile.f ? FEATURES[tile.f].y : TERRAIN[tile.t].y;
  const out = [...base];
  if (tile.r) RESOURCES[tile.r].y.forEach((v, k) => { out[k] += v; });
  return out;
}

function siteScore(m, x, y) {
  let s = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
      if (!inMap(m, x + dx, y + dy)) continue;
      const t = m.tiles[idx(m, x + dx, y + dy)];
      const [f, p, g] = tileYield(t);
      const near = Math.max(Math.abs(dx), Math.abs(dy)) <= 1 ? 1.5 : 1;
      s += (f * 1.4 + p * 1.1 + g * 0.6) * near;
      if (t.f === 'mountain') s -= 1;
    }
  }
  const here = m.tiles[idx(m, x, y)];
  if (here.f === 'hills') s += 2;
  if (here.t === 'tundra' || here.t === 'snow' || here.t === 'desert') s -= 6;
  return s;
}
export { siteScore };

/**
 * Build a map. opts: { w, h, civs (number of start spots), seed }.
 * Returns { w, h, tiles: [{ t, f, r }], starts: [[x, y], ...] }.
 */
export function generateMap({ w, h, civs, seed }) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const m = tryMap(w, h, civs, (seed + attempt * 7919) >>> 0);
    if (m) return m;
  }
  throw new Error('map generation failed');
}

function tryMap(w, h, nCivs, seed) {
  const rng = makeRng(seed);
  const elev = fractal(rng, w, h, [7, 4, 2]);
  const wet = fractal(rng, w, h, [6, 3]);
  const rough = fractal(rng, w, h, [2.2, 1.3]);
  const m = { w, h, tiles: [] };
  const cx = (w - 1) / 2; const cy = (h - 1) / 2;
  const vals = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w / 2); const dy = (y - cy) / (h / 2);
      const fall = Math.pow(Math.min(1, Math.sqrt(dx * dx * 0.9 + dy * dy * 1.1)), 2.2);
      const v = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? -9 : elev(x, y) * 1.15 - fall * 0.95;
      vals.push(v);
    }
  }
  const sorted = [...vals].sort((a, b) => b - a);
  const landFrac = 0.46;
  const cut = sorted[Math.floor(vals.length * landFrac)];
  const landVals = sorted.slice(0, Math.floor(vals.length * landFrac));
  const mountCut = landVals[Math.floor(landVals.length * 0.07)];
  const landIdx = [];
  for (let i = 0; i < vals.length; i++) if (vals[i] > cut) landIdx.push(i);
  const q = (arr, f) => { const v = [...arr].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * f))]; };
  const roughOf = (i) => rough(i % w, Math.floor(i / w));
  const wetOf = (i) => wet(i % w, Math.floor(i / w));
  const roughVals = landIdx.map(roughOf);
  const wetVals = landIdx.map(wetOf);
  const hillCut = q(roughVals, 0.8);
  const roughMid = q(roughVals, 0.5);
  const dryCut = q(wetVals, 0.17);
  const plainsCut = q(wetVals, 0.5);
  const forestCut = q(wetVals, 0.72);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = vals[i];
      const tile = { t: 'ocean', f: null, r: null };
      if (v > cut) {
        const lat = Math.abs(y - cy) / (h / 2);
        const moist = wetOf(i);
        let t = 'grass';
        if (lat > 0.84) t = 'snow';
        else if (lat > 0.68) t = 'tundra';
        else if (moist < dryCut && lat < 0.62) t = 'desert';
        else if (moist < plainsCut) t = 'plains';
        tile.t = t;
        const r = roughOf(i);
        if (v > mountCut && r > roughMid) tile.f = 'mountain';
        else if (r > hillCut) tile.f = 'hills';
        else if (moist > forestCut && t !== 'desert' && t !== 'snow' && rng() < 0.7) tile.f = 'forest';
        else if (t !== 'desert' && t !== 'snow' && rng() < 0.06) tile.f = 'forest';
      }
      m.tiles.push(tile);
    }
  }
  // Centre the land on the map (noise can push it to one side).
  {
    let x0 = w; let x1 = 0; let y0 = h; let y1 = 0;
    m.tiles.forEach((t, i) => { if (isLand(t)) { const x = i % w; const y = Math.floor(i / w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
    const sx = Math.round((w - 1 - x1 - x0) / 2); const sy = Math.round((h - 1 - y1 - y0) / 2);
    if (sx || sy) {
      const old = m.tiles;
      m.tiles = old.map((_, i) => {
        const x = i % w - sx; const y = Math.floor(i / w) - sy;
        return x >= 0 && y >= 0 && x < w && y < h ? old[y * w + x] : { t: 'ocean', f: null, r: null };
      });
    }
  }
  // Water next to land is shallow coast.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = m.tiles[idx(m, x, y)];
      if (isLand(t)) continue;
      if (DIRS8.some(([dx, dy]) => inMap(m, x + dx, y + dy) && isLand(m.tiles[idx(m, x + dx, y + dy)]))) t.t = 'coast';
    }
  }
  // Largest passable landmass: everyone starts there so conquest never needs boats.
  let best = new Set();
  const seen = new Set();
  for (let i = 0; i < m.tiles.length; i++) {
    if (seen.has(i) || !passableLand(m.tiles[i])) continue;
    const c = landComponent(m, i % w, Math.floor(i / w));
    c.forEach((j) => seen.add(j));
    if (c.size > best.size) best = c;
  }
  const landCount = m.tiles.filter(isLand).length;
  if (best.size < landCount * 0.6 || best.size < nCivs * 30) return null;

  // Resources.
  for (let i = 0; i < m.tiles.length; i++) {
    const t = m.tiles[i];
    if (t.f === 'mountain' || t.t === 'snow' || t.t === 'ocean') continue;
    const chance = isLand(t) ? 0.075 : 0.06;
    if (rng() > chance) continue;
    const opts = Object.entries(RESOURCES).filter(([, r]) => r.on.includes(t.t) || (t.f && r.on.includes(t.f)));
    if (!opts.length) continue;
    // Forest/hills resources only where the feature is.
    const fit = opts.filter(([, r]) => (t.f ? r.on.includes(t.f) : r.on.includes(t.t)));
    if (!fit.length) continue;
    t.r = rng.pick(fit)[0];
  }

  // Start spots: spread out over the big landmass.
  const cand = [...best].map((i) => ({ i, x: i % w, y: Math.floor(i / w) }))
    .filter((c) => { const t = m.tiles[c.i]; return t.t !== 'snow' && t.t !== 'tundra' && t.t !== 'desert' && t.f !== 'mountain'; })
    .map((c) => ({ ...c, s: siteScore(m, c.x, c.y) + rng() * 2 }));
  if (cand.length < nCivs * 4) return null;
  cand.sort((a, b) => b.s - a.s);
  const good = cand.slice(0, Math.max(nCivs * 6, Math.floor(cand.length * 0.5)));
  const starts = [];
  const minD = Math.max(6, Math.floor(Math.sqrt((best.size) / nCivs) * 0.9));
  starts.push(good[Math.floor(rng() * Math.min(8, good.length))]);
  while (starts.length < nCivs) {
    let pick = null; let pd = -1;
    for (const c of good) {
      const d = Math.min(...starts.map((s) => dist(s.x, s.y, c.x, c.y)));
      const val = d + c.s * 0.05;
      if (d >= minD && val > pd) { pd = val; pick = c; }
    }
    if (!pick) return null;
    starts.push(pick);
  }
  // Every start gets a food resource nearby so no one has a miserable opening.
  for (const s of starts) {
    m.tiles[s.i].f = m.tiles[s.i].f === 'mountain' ? null : m.tiles[s.i].f;
    m.tiles[s.i].r = null;
    const near = [];
    for (const [dx, dy] of DIRS8) {
      const x = s.x + dx; const y = s.y + dy;
      if (inMap(m, x, y)) near.push(m.tiles[idx(m, x, y)]);
    }
    if (!near.some((t) => t.r && (RESOURCES[t.r].y[0] >= 1))) {
      const t = near.find((n) => n.t === 'coast') || near.find((n) => n.t === 'grass' && !n.f) || near.find((n) => (n.t === 'plains' || n.t === 'grass'));
      if (t) {
        if (t.t === 'coast') t.r = 'fish';
        else { t.f = null; t.r = 'horses'; }
      }
    }
    // No mountains right next to the capital.
    for (const t of near) if (t.f === 'mountain') t.f = 'hills';
  }
  m.starts = starts.map((s) => [s.x, s.y]);
  return m;
}
