// Tiny Town Builder simulation: the whole city as plain JSON plus derived maps kept off the save.
// Pure logic (no Phaser) so it runs and is tested under node.
import {
  TILE, WEEKS_PER_MONTH, MONTHS, T, ZONE_INFO, MILESTONES, MAX_TIER, GROW,
  PLACE, LINE_COST, CLEAR_COST, ECON, SCENARIOS, SANDBOX, TOOL_INFO, FUNDS,
} from './defs.js';
import { FRAMES } from './sprites.js';
import { generate, idx, inMap, N4, bfs, W, H } from './map.js';
import { mulberry } from './rng.js';
import { tips } from './advisors.js';

export { W, H, idx, inMap };

// ------------------------------------------------------------------ frames and footprints

export function frameRect(f) {
  const [sheet, n] = f.split(':');
  return FRAMES[sheet][+n];
}
export function frameSize(f) {
  const r = frameRect(f);
  return { w: r[2] / TILE, h: r[3] / TILE };
}
export const placeSize = (key) => frameSize(PLACE[key].frames[0]);

// Grow-building choices by zone and tier, grouped by footprint.
const SHAPES = {};
for (const z of Object.keys(GROW)) {
  SHAPES[z] = {};
  for (const tier of [1, 2, 3, 4]) {
    const m = new Map();
    for (const [f, n] of GROW[z][tier] || []) {
      const { w, h } = frameSize(f);
      const k = `${w}x${h}`;
      if (!m.has(k)) m.set(k, { w, h, list: [] });
      m.get(k).list.push([f, n]);
    }
    SHAPES[z][tier] = [...m.values()];
  }
}

// ------------------------------------------------------------------ runtime (not saved)

const RT = new WeakMap();
/** Derived data for a state: building lookup, utility and coverage maps, undo stack. */
export function rt(s) {
  let r = RT.get(s);
  if (!r) {
    r = {
      tileB: new Int32Array(W * H), byId: new Map(), undo: [], dirty: true,
      power: new Uint8Array(W * H), lotPower: new Uint8Array(W * H), water: new Float32Array(W * H),
      cov: {}, pol: new Float32Array(W * H), crime: new Float32Array(W * H), lv: new Float32Array(W * H),
      traffic: new Float32Array(W * H), roadDist: new Int8Array(W * H), access: new Map(),
      reach: new Set(), commute: new Map(), outside: new Uint8Array(W * H), supply: 0, need: 0,
      rng: mulberry(s.seed * 31 + Math.floor(s.t * 100)),
    };
    for (const k of ['police', 'fire', 'health', 'edu', 'park', 'transit']) r.cov[k] = new Float32Array(W * H);
    RT.set(s, r);
    for (const b of s.blds) indexBuilding(s, r, b);
    refresh(s);
  }
  return r;
}

function indexBuilding(s, r, b) {
  r.byId.set(b.id, b);
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) r.tileB[idx(x, y)] = b.id;
}

function rng(s) {
  const r = rt(s).rng;
  const v = r();
  s.rs = r.state();
  return v;
}

// ------------------------------------------------------------------ new game

const LAYOUT_FOR = { sandbox: 'river', first: 'river', debtfree: 'lakes', clean: 'forest' };

export function newGame(mode = 'sandbox', seedOverride) {
  const sc = mode === 'sandbox' ? SANDBOX : SCENARIOS[mode];
  const seed = seedOverride ?? sc.seed;
  const layout = LAYOUT_FOR[mode] || 'river';
  const map = generate(seed, layout);
  const fund = {};
  for (const [k] of FUNDS) fund[k] = 100;
  const s = {
    v: 1, mode, seed, layout, t: 0, weeks: 0,
    money: sc.money, tax: { R: ECON.defaultTax, C: ECON.defaultTax, I: ECON.defaultTax }, fund,
    loans: [], terrain: map.terrain, road: map.road, line: new Array(W * H).fill(0), zone: new Array(W * H).fill(''),
    blds: [], nextId: 1, pop: 0, jobs: { C: 0, I: 0, F: 0 }, workers: 0, happy: 60,
    demand: { R: 0.6, C: 0.2, I: 0.4, F: 0.3 }, ms: 0, hist: [], log: [], fires: [], active: [], rubble: [],
    dis: false, result: null, debtMonths: 0, report: null, hy: map.hy, start: map.start, rs: 0,
    tut: 0, seenTips: {}, stats: { maxPop: 0 }, landmarks: {},
  };
  s.tutRoads0 = s.road.reduce((a, v) => a + v, 0);
  rt(s);
  return s;
}

// Save format: layers as strings (a lot smaller than arrays in JSON).
export function serialize(s) {
  return {
    ...s,
    terrain: s.terrain.join(''), road: s.road.join(''), line: s.line.join(''),
    zone: s.zone.map((z) => z || '.').join(''),
  };
}
export function deserialize(o) {
  const s = { ...o };
  s.terrain = o.terrain.split('');
  s.road = o.road.split('').map(Number);
  s.line = o.line.split('').map(Number);
  s.zone = o.zone.split('').map((c) => (c === '.' ? '' : c));
  rt(s);
  rt(s).rng.setState(s.rs || s.seed);
  return s;
}

// ------------------------------------------------------------------ queries

export const bldAt = (s, x, y) => (inMap(x, y) ? rt(s).byId.get(rt(s).tileB[idx(x, y)]) || null : null);
export const date = (s) => {
  const m = Math.floor(s.t);
  return { month: m % 12, year: Math.floor(m / 12) + 1, label: `${MONTHS[m % 12]} Y${Math.floor(m / 12) + 1}` };
};
export const milestone = (s) => MILESTONES[s.ms];
export const nextMilestone = (s) => MILESTONES[s.ms + 1] || null;
export const scenario = (s) => (s.mode === 'sandbox' ? null : SCENARIOS[s.mode]);
export const toolUnlock = (key) => (PLACE[key] ? PLACE[key].unlock : TOOL_INFO[key]?.unlock || 0);
export const isLocked = (s, key) => toolUnlock(key) > s.ms;
export const isBanned = (s, key) => !!(scenario(s)?.noDirty && PLACE[key]?.dirty);
export function landmarkBuilt(s, key) { return s.blds.some((b) => b.k === key); }

function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
const ci = (b) => idx(Math.min(W - 1, Math.floor(b.x + b.w / 2)), Math.min(H - 1, Math.floor(b.y + b.h / 2)));

/** Power each building needs. */
function powerNeed(b) {
  if (b.k === 'grow') return b.z === 'R' ? b.n / 8 : b.z === 'C' ? b.n / 4 : b.z === 'I' ? b.n / 3 : 0;
  const p = PLACE[b.k];
  if (p.power || p.svc === 'park' && !p.landmark) return 0;
  return p.landmark ? 6 : 4;
}
const needsPower = (b) => powerNeed(b) > 0;

// ------------------------------------------------------------------ the derived maps

/** Recompute power, water, coverage, traffic, pollution, crime, land value and demand. */
export function refresh(s) {
  const r = rt(s);
  r.dirty = false;
  const { tileB, byId } = r;
  const N = W * H;

  // Road distance (Chebyshev, up to 4) for road access.
  r.roadDist.fill(9);
  for (let i = 0; i < N; i++) {
    if (!s.road[i]) continue;
    const x = i % W; const y = (i - x) / W;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const j = ny * W + nx;
      if (d < r.roadDist[j]) r.roadDist[j] = d;
    }
  }
  // Each building's nearest road tile (within 3), used for trips.
  r.access.clear();
  for (const b of s.blds) {
    let best = -1; let bd = 99;
    for (let y = b.y - 3; y < b.y + b.h + 3; y++) for (let x = b.x - 3; x < b.x + b.w + 3; x++) {
      if (!inMap(x, y) || !s.road[idx(x, y)]) continue;
      const d = Math.max(b.x - x, x - (b.x + b.w - 1), 0) + Math.max(b.y - y, y - (b.y + b.h - 1), 0);
      if (d < bd) { bd = d; best = idx(x, y); }
    }
    if (best >= 0) r.access.set(b.id, best);
  }
  // Roads linked to the outside world (a road on the map edge).
  const edge = [];
  for (let i = 0; i < N; i++) {
    if (!s.road[i]) continue;
    const x = i % W; const y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge.push(i);
  }
  const out = bfs(edge, (j) => s.road[j] === 1);
  for (let i = 0; i < N; i++) r.outside[i] = out.dist[i] >= 0 ? 1 : 0;

  // ---- power
  const cond = (j) => s.road[j] === 1 || s.line[j] === 1 || s.zone[j] !== '' || tileB[j] > 0;
  const comp = new Int32Array(N).fill(-1);
  let nc = 0;
  for (let i = 0; i < N; i++) {
    if (comp[i] !== -1 || !cond(i)) continue;
    const st = [i]; comp[i] = nc;
    while (st.length) {
      const k = st.pop(); const x = k % W; const y = (k - x) / W;
      for (const [dx, dy] of N4) {
        const nx = x + dx; const ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const j = ny * W + nx;
        if (comp[j] === -1 && cond(j)) { comp[j] = nc; st.push(j); }
      }
    }
    nc++;
  }
  const supply = new Float32Array(nc);
  const plantTiles = [];
  const fundK = (k) => Math.max(0, Math.min(1.5, (s.fund[k] ?? 100) / 100));
  let totalSupply = 0;
  for (const b of s.blds) {
    const p = PLACE[b.k];
    if (!p?.power) continue;
    const out2 = p.power * Math.min(1.2, Math.max(0.5, fundK('power')));
    supply[comp[idx(b.x, b.y)]] += out2;
    totalSupply += out2;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) plantTiles.push(idx(x, y));
  }
  const pd = bfs(plantTiles, cond);
  const consumers = s.blds.filter((b) => needsPower(b)).map((b) => {
    let d = 1e9;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const v = pd.dist[idx(x, y)]; if (v >= 0 && v < d) d = v; }
    return { b, d };
  }).sort((a, b) => a.d - b.d);
  r.power.fill(0);
  let totalNeed = 0;
  for (const b of s.blds) if (PLACE[b.k]?.power || !needsPower(b)) b.pw = 1;
  for (const { b, d } of consumers) {
    const need = powerNeed(b);
    totalNeed += need;
    const c = comp[idx(b.x, b.y)];
    if (d < 1e9 && supply[c] >= need) { supply[c] -= need; b.pw = 1; } else b.pw = 0;
  }
  for (const b of s.blds) if (b.pw) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) r.power[idx(x, y)] = 1;
  for (let i = 0; i < N; i++) r.lotPower[i] = pd.dist[i] >= 0 && comp[i] >= 0 && supply[comp[i]] > 0.5 ? 1 : 0;
  r.supply = totalSupply; r.need = totalNeed;

  // ---- coverage (services, water, parks, transit)
  for (const k of Object.keys(r.cov)) r.cov[k].fill(0);
  r.water.fill(0);
  const stamp = (map, b, rad, eff) => {
    const c = center(b);
    const x0 = Math.max(0, Math.floor(c.x - rad)); const x1 = Math.min(W - 1, Math.ceil(c.x + rad));
    const y0 = Math.max(0, Math.floor(c.y - rad)); const y1 = Math.min(H - 1, Math.ceil(c.y + rad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
      if (d > rad) continue;
      const v = eff * Math.min(1, 1.25 - d / rad);
      const j = y * W + x;
      if (v > map[j]) map[j] = v;
    }
  };
  for (const b of s.blds) {
    const p = PLACE[b.k];
    if (!p?.svc) continue;
    let eff = p.fund ? fundK(p.fund) : 1;
    if (p.svc === 'water') { if (!b.pw) continue; stamp(r.water, b, p.r * Math.min(1.2, Math.max(0.6, eff)), 1); continue; }
    if (needsPower(b) && !b.pw) eff *= 0.3;
    stamp(r.cov[p.svc], b, p.r, eff);
  }

  // ---- traffic: every home sends commuters along the road to the nearest jobs.
  r.traffic.fill(0);
  r.reach.clear(); r.commute.clear();
  const isRoad = (j) => s.road[j] === 1;
  const jobSrc = []; const homeSrc = [];
  for (const b of s.blds) {
    if (b.k !== 'grow') continue;
    const a = r.access.get(b.id);
    if (a === undefined) continue;
    (b.z === 'R' ? homeSrc : jobSrc).push(a);
  }
  const toJobs = bfs(jobSrc, isRoad);
  const toHomes = bfs(homeSrc, isRoad);
  const roadCap = Math.max(0.4, fundK('roads'));
  for (const b of s.blds) {
    if (b.k !== 'grow') continue;
    const a = r.access.get(b.id);
    if (a === undefined) continue;
    if (b.z === 'R') {
      const d = toJobs.dist[a];
      if (d < 0) continue;
      r.reach.add(b.id); r.commute.set(b.id, d);
      const vol = b.n * 0.5 * (1 - 0.6 * r.cov.transit[a]);
      let k = a; let n = 0;
      while (k >= 0 && n++ < 80) { r.traffic[k] += vol; k = toJobs.parent[k]; }
    } else if (toHomes.dist[a] >= 0) r.reach.add(b.id);
  }
  for (let i = 0; i < N; i++) if (r.traffic[i]) r.traffic[i] = Math.min(1.5, r.traffic[i] / (160 * roadCap));

  // ---- pollution
  r.pol.fill(0);
  const smoke = (cx, cy, str, rad) => {
    const x0 = Math.max(0, Math.floor(cx - rad)); const x1 = Math.min(W - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)); const y1 = Math.min(H - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rad) r.pol[y * W + x] += str * (1 - d / (rad + 1));
    }
  };
  for (const b of s.blds) {
    const c = center(b);
    if (b.k === 'grow' && b.z === 'I') smoke(c.x, c.y, 12 + b.n * 0.5, 3 + b.tier);
    else if (PLACE[b.k]?.smoke) smoke(c.x, c.y, PLACE[b.k].smoke, PLACE[b.k].smokeR);
  }
  for (let i = 0; i < N; i++) {
    if (r.traffic[i] > 0.4) smoke((i % W) + 0.5, Math.floor(i / W) + 0.5, r.traffic[i] * 14, 1.5);
  }
  for (let i = 0; i < N; i++) r.pol[i] = Math.max(0, Math.min(100, r.pol[i] - r.cov.park[i] * 14));

  // ---- land value and crime (crime uses the land value from before, which is fine week to week)
  if (!r.nearWater) {
    const wet = [];
    for (let i = 0; i < N; i++) if (s.terrain[i] === T.WATER) wet.push(i);
    r.nearWater = bfs(wet, () => true, 3).dist; // water never moves, so work this out once
  }
  const nearWater = r.nearWater;
  const lmBoost = new Float32Array(N);
  for (const b of s.blds) {
    const p = PLACE[b.k];
    if (p?.landmark) { const c = center(b); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y); if (d < 12) lmBoost[y * W + x] += 10 * (1 - d / 12); } }
  }
  for (let i = 0; i < N; i++) {
    const wf = nearWater[i] >= 1 && nearWater[i] <= 3 ? 12 - nearWater[i] * 2 : 0;
    const v = 36 + 18 * r.cov.park[i] + 10 * r.cov.edu[i] + 6 * r.cov.health[i] + 8 * r.cov.police[i] + wf + lmBoost[i]
      - 0.45 * r.pol[i] - 0.2 * r.crime[i] - 8 * Math.min(1, r.traffic[i]);
    r.lv[i] = Math.max(0, Math.min(100, v));
  }
  r.crime.fill(0);
  for (const b of s.blds) {
    if (b.k !== 'grow' || b.z === 'F') continue;
    const dens = b.n / (b.w * b.h);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const i = idx(x, y);
      r.crime[i] = Math.max(0, Math.min(100, 6 + dens * 1.3 + (45 - r.lv[i]) * 0.4 - r.cov.police[i] * 55));
    }
  }

  // ---- totals and demand
  let pop = 0; const jobs = { C: 0, I: 0, F: 0 };
  for (const b of s.blds) {
    if (b.k !== 'grow') continue;
    if (b.z === 'R') pop += b.n; else jobs[b.z] += b.n;
  }
  s.pop = pop; s.jobs = jobs; s.workers = Math.round(pop * ECON.workerRatio);
  s.demand = demand(s);
}

/** RCI(+F) demand, each from -1 (too much) to 1 (wanted). */
export function demand(s) {
  const r = rt(s);
  const pop = s.pop; const J = s.jobs;
  const allJobs = J.C + J.I + J.F;
  const WR = ECON.workerRatio;
  const workers = pop * WR;
  const cs = 0.45 + 0.15 * Math.min(1, pop / 8000);
  const outside = s.road.some((v, i) => v && r.outside[i]);
  let lm = 0; let lmC = 0;
  for (const b of s.blds) { const p = PLACE[b.k]; if (p?.landmark) lm++; if (p?.demandC) lmC += p.demandC; }
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const taxAdj = (z) => (ECON.defaultTax - s.tax[z]) * 0.05;
  const R = clamp((allJobs / WR + 60 - pop) / Math.max(60, pop * 0.3) + taxAdj('R') + (s.happy - 50) / 120 + lm * 0.03);
  const C = clamp((workers * cs + 8 - J.C) / Math.max(15, workers * 0.25) + taxAdj('C') + (outside ? 0.05 : 0) + lmC);
  const I = clamp((workers * (1 - cs) + 24 - J.I - J.F) / Math.max(15, workers * 0.25) + taxAdj('I') + (outside ? 0.1 : -0.1));
  const F = clamp(I * 0.8 + 0.1 - J.F / Math.max(40, pop * 0.08));
  return { R, C, I, F };
}

// ------------------------------------------------------------------ desirability and growth

/** How much a zone building (or lot) wants to grow here, 0..1, with the reasons it's held back. */
export function desire(s, z, x, y, w = 1, h = 1, id = 0) {
  const r = rt(s);
  const i = idx(Math.min(W - 1, Math.floor(x + w / 2)), Math.min(H - 1, Math.floor(y + h / 2)));
  const lv = r.lv[i] / 100; const pol = r.pol[i] / 100; const crime = r.crime[i] / 100;
  const why = [];
  let v;
  if (z === 'R') {
    v = 0.22 + 0.6 * lv - 0.55 * pol - 0.3 * crime + 0.08 * r.cov.health[i] + 0.06 * r.cov.edu[i];
    if (pol > 0.35) why.push('smoky air');
    if (crime > 0.4) why.push('crime');
    if (id) {
      if (!r.reach.has(id)) { v -= 0.35; why.push('no jobs reachable by road'); } else if ((r.commute.get(id) || 0) > 30) { v -= 0.12; why.push('long commute'); }
    }
  } else if (z === 'C') {
    v = 0.3 + 0.5 * lv - 0.25 * crime + 0.08 * r.cov.police[i];
    if (crime > 0.4) why.push('crime');
    if (id && !r.reach.has(id)) { v -= 0.35; why.push('no homes reachable by road'); }
  } else if (z === 'I') {
    v = 0.6 + 0.12 * r.cov.fire[i] - 0.2 * crime;
    if (id && !r.reach.has(id)) { v -= 0.35; why.push('no workers reachable by road'); }
  } else v = 0.65;
  return { v: Math.max(0, Math.min(1, v)), why };
}

const TIER_NEED = { 1: 0, 2: 0.25, 3: 0.42, 4: 0.55 };

/** Can a zone tile (empty) take a first building? Returns null if fine, else the reason. */
export function lotBlocker(s, i) {
  const r = rt(s);
  const z = s.zone[i];
  if (!z) return 'not zoned';
  if (s.terrain[i] === T.WATER) return 'water';
  if (s.terrain[i] === T.RUBBLE) return 'rubble';
  if (r.roadDist[i] > 3) return 'no road within 3 tiles';
  if (z !== 'F' && !r.lotPower[i]) return 'no power';
  return null;
}

function addBuilding(s, b) {
  const r = rt(s);
  b.id = s.nextId++;
  s.blds.push(b);
  indexBuilding(s, r, b);
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const i = idx(x, y);
    if (s.terrain[i] === T.TREE) s.terrain[i] = T.GRASS;
  }
  r.dirty = true;
  return b;
}

function removeBuilding(s, b) {
  const r = rt(s);
  s.blds.splice(s.blds.indexOf(b), 1);
  r.byId.delete(b.id);
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const i = idx(x, y);
    if (r.tileB[i] === b.id) r.tileB[i] = 0;
  }
  s.fires = s.fires.filter((f) => r.tileB[f.i]);
  r.dirty = true;
}

const pickR = (s, list) => list[Math.floor(rng(s) * list.length)];

/** Try to grow building b (or an empty lot at tile i when b is null) to the given tier. */
export function tryGrow(s, z, tier, b, i) {
  const r = rt(s);
  const shapes = SHAPES[z][tier].slice().sort(() => rng(s) - 0.5);
  const ox = b ? b.x : i % W; const oy = b ? b.y : Math.floor(i / W);
  const ow = b ? b.w : 1; const oh = b ? b.h : 1;
  for (const sh of shapes) {
    if (sh.w < ow || sh.h < oh) continue;
    const opts = [];
    for (let ax = ox + ow - sh.w; ax <= ox; ax++) for (let ay = oy + oh - sh.h; ay <= oy; ay++) {
      let ok = true; const eat = new Set();
      for (let y = ay; y < ay + sh.h && ok; y++) for (let x = ax; x < ax + sh.w && ok; x++) {
        if (!inMap(x, y)) { ok = false; break; }
        const j = idx(x, y);
        if (s.zone[j] !== z || s.road[j] || s.terrain[j] === T.WATER || s.terrain[j] === T.RUBBLE) { ok = false; break; }
        const o = r.byId.get(r.tileB[j]);
        if (o) {
          if (o.k !== 'grow' || o.tier > tier - (o === b ? 1 : 0) || o.x < ax || o.y < ay || o.x + o.w > ax + sh.w || o.y + o.h > ay + sh.h) { ok = false; break; }
          if (o !== b && o.tier >= tier) ok = false;
          eat.add(o);
        }
      }
      if (ok && (tier === 1 || !s.fires.some((f) => f.i >= 0 && eat.has(r.byId.get(r.tileB[f.i]))))) opts.push({ ax, ay, eat });
    }
    if (!opts.length) continue;
    const o = opts[Math.floor(rng(s) * opts.length)];
    for (const e of o.eat) removeBuilding(s, e);
    const [f, n] = pickR(s, sh.list);
    return addBuilding(s, { k: 'grow', z, tier, x: o.ax, y: o.ay, w: sh.w, h: sh.h, f, n, pw: 1, np: 0 });
  }
  return null;
}

function growWeek(s, events) {
  const r = rt(s);
  const d = s.demand;
  const maxTier = MAX_TIER[s.ms];
  // New buildings on empty lots.
  const order = [];
  for (let i = 0; i < W * H; i++) if (s.zone[i] && !r.tileB[i]) order.push(i);
  for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rng(s) * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  let built = 0;
  for (const i of order) {
    const z = s.zone[i];
    if (d[z] <= 0 || r.tileB[i] || lotBlocker(s, i)) continue;
    const de = desire(s, z, i % W, Math.floor(i / W)).v;
    if (rng(s) > 0.06 + 0.4 * d[z] * de) continue;
    let b = null;
    if (z === 'F') b = tryGrow(s, 'F', 3, null, i) || tryGrow(s, 'F', 2, null, i);
    else b = tryGrow(s, z, 1, null, i);
    if (b) { built++; events.push({ kind: 'grow', id: b.id }); }
    if (built > 24) break; // a few per week keeps growth gentle and readable
  }
  // Upgrades and decline.
  const list = s.blds.filter((b) => b.k === 'grow');
  for (const b of list) {
    if (!r.byId.has(b.id)) continue;
    const z = b.z;
    b.np = b.pw ? 0 : (b.np || 0) + 1;
    const de = desire(s, z, b.x, b.y, b.w, b.h, b.id).v;
    const watered = r.water[ci(b)] > 0;
    if (z !== 'F' && b.tier < maxTier && d[z] > 0.05 && b.pw && watered && de >= TIER_NEED[b.tier + 1] && (SHAPES[z][b.tier + 1] || []).length) {
      if (rng(s) < 0.03 + 0.2 * d[z] * de) {
        const nb = tryGrow(s, z, b.tier + 1, b, -1);
        if (nb) { events.push({ kind: 'grow', id: nb.id, up: true }); continue; }
      }
    }
    // Decline: no power for a month, nobody wants this zone, or the spot got really bad.
    const bad = (b.np >= 4 && z !== 'F') || (d[z] < -0.4 && rng(s) < 0.05) || (de < 0.08 && rng(s) < 0.04)
      || (b.tier >= 2 && z !== 'F' && !watered && rng(s) < 0.03);
    if (bad && rng(s) < 0.35) {
      if (b.tier > 1 && z !== 'F') {
        // Shrink back to a single small building on one of its tiles.
        removeBuilding(s, b);
        const [f, n] = pickR(s, SHAPES[z][1][0].list);
        addBuilding(s, { k: 'grow', z, tier: 1, x: b.x, y: b.y + b.h - 1, w: 1, h: 1, f, n, pw: b.pw, np: b.np });
      } else removeBuilding(s, b);
      events.push({ kind: 'decline', x: b.x, y: b.y });
    }
  }
}

// ------------------------------------------------------------------ player actions (all undoable)

function startAct(s, label) { return { label, tiles: [], seen: new Set(), removed: [], cost: 0, t: s.t }; }
function snap(s, act, i) {
  if (act.seen.has(i)) return;
  act.seen.add(i);
  act.tiles.push([i, s.terrain[i], s.road[i], s.line[i], s.zone[i]]);
}
function snapBld(s, act, b) {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) snap(s, act, idx(x, y));
  act.removed.push({ ...b });
}
function commit(s, act) {
  if (!act.tiles.length) return null;
  delete act.seen;
  s.money -= act.cost;
  const r = rt(s);
  r.undo.push(act);
  if (r.undo.length > 30) r.undo.shift();
  if (r.batch) r.dirty = true; else refresh(s);
  return act;
}

/** Run several actions and work out the city's maps once at the end (used by the bot). */
export function batch(s, fn) {
  const r = rt(s);
  r.batch = true;
  try { return fn(); } finally { r.batch = false; refresh(s); }
}

export const UNDO_MONTHS = 3; // builds older than this can no longer be taken back
function pruneUndo(s) { const r = rt(s); r.undo = r.undo.filter((a) => s.t - a.t <= UNDO_MONTHS); return r.undo; }
export const canUndo = (s) => pruneUndo(s).length > 0;
export const undoLabel = (s) => pruneUndo(s).at(-1)?.label || '';

/** Put things back exactly as they were before the last action, and refund what it cost. */
export function undo(s) {
  const r = rt(s);
  pruneUndo(s);
  const act = r.undo.pop();
  if (!act) return null;
  for (const [i] of act.tiles) { const b = r.byId.get(r.tileB[i]); if (b) removeBuilding(s, b); }
  for (const [i, t, rd, ln, z] of act.tiles) { s.terrain[i] = t; s.road[i] = rd; s.line[i] = ln; s.zone[i] = z; }
  for (const b of act.removed) {
    let free = true;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (r.tileB[idx(x, y)]) free = false;
    if (free) { s.blds.push(b); indexBuilding(s, r, b); s.nextId = Math.max(s.nextId, b.id + 1); }
  }
  s.rubble = s.rubble.filter((x) => s.terrain[x.i] === T.RUBBLE);
  s.money += act.cost;
  refresh(s);
  return act;
}

/** What a line tool (road, power line) would do along a path. tiles: [{x, y, ok, cost}]. */
export function planLine(s, tool, path) {
  const r = rt(s);
  let cost = 0; const tiles = [];
  for (const p of path) {
    if (!inMap(p.x, p.y)) continue;
    const i = idx(p.x, p.y);
    let ok = true; let c = 0;
    const b = r.byId.get(r.tileB[i]);
    if (tool === 'road') {
      if (s.road[i]) c = 0;
      else if (b) ok = false;
      else {
        c = s.terrain[i] === T.WATER ? LINE_COST.bridge : LINE_COST.road;
        if (s.terrain[i] === T.TREE || s.terrain[i] === T.RUBBLE) c += CLEAR_COST.tree;
      }
    } else {
      if (s.line[i] || s.road[i] || (b && b.k !== 'grow' && PLACE[b.k])) c = 0;
      else if (b) c = 0; // buildings and zones already carry power
      else c = LINE_COST.line + (s.terrain[i] === T.TREE ? CLEAR_COST.tree : 0);
    }
    tiles.push({ x: p.x, y: p.y, ok, cost: c });
    if (ok) cost += c;
  }
  return { tiles, cost };
}

export function buildLine(s, tool, path) {
  const plan = planLine(s, tool, path);
  if (plan.cost > s.money) return { ok: false, reason: 'Not enough money' };
  const act = startAct(s, tool === 'road' ? 'road' : 'power line');
  let n = 0;
  for (const t of plan.tiles) {
    if (!t.ok || t.cost === 0) continue;
    const i = idx(t.x, t.y);
    snap(s, act, i);
    if (tool === 'road') { s.road[i] = 1; s.zone[i] = ''; s.line[i] = 0; } else s.line[i] = 1;
    if (s.terrain[i] === T.TREE || s.terrain[i] === T.RUBBLE) s.terrain[i] = T.GRASS;
    act.cost += t.cost; n++;
  }
  if (!n) return { ok: false, reason: tool === 'road' ? 'Nothing to build here' : 'Already has power here' };
  commit(s, act);
  return { ok: true, n, cost: act.cost };
}

/** Zone (or dezone with zone = '') a rectangle. */
export function planZone(s, zone, tiles) {
  const r = rt(s);
  let cost = 0; const out = [];
  const per = zone ? ZONE_INFO[zone].cost : 0;
  for (const p of tiles) {
    const i = idx(p.x, p.y);
    const b = r.byId.get(r.tileB[i]);
    let ok = true;
    if (zone) ok = !s.road[i] && s.terrain[i] !== T.WATER && (!b || (b.k === 'grow' && b.z === zone)) && s.zone[i] !== zone;
    else ok = !!s.zone[i];
    if (b && b.k !== 'grow') ok = false;
    const c = ok ? per : 0;
    out.push({ x: p.x, y: p.y, ok, cost: c });
    cost += c;
  }
  return { tiles: out, cost };
}

export function zoneArea(s, zone, tiles) {
  const plan = planZone(s, zone, tiles);
  if (plan.cost > s.money) return { ok: false, reason: 'Not enough money' };
  const r = rt(s);
  const act = startAct(s, zone ? `${ZONE_INFO[zone].name} zone` : 'dezone');
  let n = 0;
  for (const t of plan.tiles) {
    if (!t.ok) continue;
    const i = idx(t.x, t.y);
    const b = r.byId.get(r.tileB[i]);
    if (!zone && b) { snapBld(s, act, b); removeBuilding(s, b); }
    snap(s, act, i);
    s.zone[i] = zone;
    act.cost += t.cost; n++;
  }
  if (!n) return { ok: false, reason: zone ? 'Already zoned, or no room here' : 'Nothing zoned here' };
  commit(s, act);
  return { ok: true, n, cost: act.cost };
}

/** Bulldoze a rectangle: buildings (whole), roads, lines, trees and rubble. Zoning stays. */
export function planBulldoze(s, tiles) {
  const r = rt(s);
  const seen = new Set(); let cost = 0; const out = [];
  for (const p of tiles) {
    const i = idx(p.x, p.y);
    const b = r.byId.get(r.tileB[i]);
    let c = 0;
    if (b) { if (!seen.has(b.id)) { seen.add(b.id); c = CLEAR_COST.building * b.w * b.h; } } else if (s.road[i]) c = 2;
    else if (s.line[i]) c = 1;
    else if (s.terrain[i] === T.TREE || s.terrain[i] === T.RUBBLE) c = CLEAR_COST.tree;
    out.push({ x: p.x, y: p.y, ok: !!(b || s.road[i] || s.line[i] || s.terrain[i] === T.TREE || s.terrain[i] === T.RUBBLE), cost: c });
    cost += c;
  }
  return { tiles: out, cost };
}

export function bulldoze(s, tiles) {
  const plan = planBulldoze(s, tiles);
  if (plan.cost > s.money) return { ok: false, reason: 'Not enough money' };
  const r = rt(s);
  const act = startAct(s, 'bulldoze');
  let n = 0;
  for (const t of plan.tiles) {
    if (!t.ok) continue;
    const i = idx(t.x, t.y);
    const b = r.byId.get(r.tileB[i]);
    if (b) { snapBld(s, act, b); removeBuilding(s, b); n++; continue; }
    snap(s, act, i);
    if (s.road[i]) s.road[i] = 0;
    else if (s.line[i]) s.line[i] = 0;
    else s.terrain[i] = T.GRASS;
    n++;
  }
  if (!n) return { ok: false, reason: 'Nothing to clear here' };
  act.cost = plan.cost;
  s.rubble = s.rubble.filter((x) => s.terrain[x.i] === T.RUBBLE);
  commit(s, act);
  return { ok: true, n, cost: act.cost };
}

/** Can building `key` go with its top-left at x, y? Returns { ok, reason, cost, w, h }. */
export function checkPlace(s, key, x, y) {
  const p = PLACE[key];
  const { w, h } = placeSize(key);
  const r = rt(s);
  const res = { ok: false, reason: '', cost: p.cost, w, h };
  if (isBanned(s, key)) { res.reason = 'Banned in this scenario'; return res; }
  if (isLocked(s, key)) { res.reason = `Unlocks at ${MILESTONES[p.unlock].name} (${MILESTONES[p.unlock].pop.toLocaleString('en-US')} people)`; return res; }
  if (p.landmark && landmarkBuilt(s, key)) { res.reason = 'You can only build one'; return res; }
  let touchesRoad = false; let wet = false;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    if (!inMap(tx, ty)) { res.reason = 'Off the map'; return res; }
    const i = idx(tx, ty);
    if (s.terrain[i] === T.WATER) { res.reason = 'Can\'t build on water'; return res; }
    if (s.road[i]) { res.reason = 'A road is in the way'; return res; }
    if (r.tileB[i]) { res.reason = 'Something is in the way (bulldoze it first)'; return res; }
    if (s.terrain[i] === T.TREE || s.terrain[i] === T.RUBBLE) res.cost += CLEAR_COST.tree;
  }
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (!inMap(tx, ty)) continue;
    const edgeTile = (ty === y - 1 || ty === y + h) !== (tx === x - 1 || tx === x + w);
    if (edgeTile && s.road[idx(tx, ty)]) touchesRoad = true;
  }
  for (let ty = y - 2; ty < y + h + 2; ty++) for (let tx = x - 2; tx < x + w + 2; tx++) if (inMap(tx, ty) && s.terrain[idx(tx, ty)] === T.WATER) wet = true;
  if (p.roadside && !touchesRoad) { res.reason = 'Must be next to a road'; return res; }
  if (p.nearWater && !wet) { res.reason = 'Must be next to water'; return res; }
  if (res.cost > s.money) { res.reason = 'Not enough money'; return res; }
  res.ok = true;
  return res;
}

export function place(s, key, x, y) {
  const c = checkPlace(s, key, x, y);
  if (!c.ok) return c;
  const p = PLACE[key];
  const act = startAct(s, p.name);
  for (let ty = y; ty < y + c.h; ty++) for (let tx = x; tx < x + c.w; tx++) {
    const i = idx(tx, ty);
    snap(s, act, i);
    s.zone[i] = ''; s.line[i] = 0;
    if (s.terrain[i] !== T.WATER) s.terrain[i] = T.GRASS;
  }
  s.rubble = s.rubble.filter((q) => s.terrain[q.i] === T.RUBBLE);
  const f = p.frames[Math.floor(rng(s) * p.frames.length)];
  const b = addBuilding(s, { k: key, x, y, w: c.w, h: c.h, f, tier: 0, n: 0, pw: 1 });
  act.cost = c.cost;
  commit(s, act);
  return { ok: true, b, cost: c.cost };
}

// ------------------------------------------------------------------ budget

export function budget(s) {
  const f = (k) => Math.max(0, (s.fund[k] ?? 100) / 100);
  const fill = Math.min(1, s.workers / Math.max(1, s.jobs.C + s.jobs.I + s.jobs.F));
  const income = [
    ['Residential tax', s.pop * (s.tax.R / 100) * ECON.taxPerResident],
    ['Commercial tax', s.jobs.C * fill * (s.tax.C / 100) * ECON.taxPerJob],
    ['Industrial tax', (s.jobs.I + s.jobs.F) * fill * (s.tax.I / 100) * ECON.taxPerJob],
  ];
  let tour = 0;
  for (const b of s.blds) if (PLACE[b.k]?.income && b.pw) tour += PLACE[b.k].income;
  if (tour) income.push(['Visitors', tour]);
  const byFund = {};
  for (const b of s.blds) {
    const p = PLACE[b.k];
    if (!p) continue;
    const k = p.fund || 'parks';
    byFund[k] = (byFund[k] || 0) + p.upkeep * f(k);
  }
  let roads = 0; let lines = 0;
  for (let i = 0; i < W * H; i++) { roads += s.road[i]; lines += s.line[i]; }
  byFund.roads = (byFund.roads || 0) + roads * ECON.roadUpkeep * f('roads');
  byFund.power = (byFund.power || 0) + lines * ECON.lineUpkeep;
  const expense = FUNDS.map(([k, label]) => [label, byFund[k] || 0, k]);
  const loanPay = s.loans.reduce((a, l) => a + l.pay, 0);
  if (loanPay) expense.push(['Loan payments', loanPay, 'loan']);
  const tin = income.reduce((a, x) => a + x[1], 0);
  const tout = expense.reduce((a, x) => a + x[1], 0);
  return { income, expense, tin, tout, net: tin - tout };
}

export function setTax(s, z, v) { s.tax[z] = Math.max(0, Math.min(20, v)); s.demand = demand(s); }
export function setFund(s, k, v) { s.fund[k] = Math.max(0, Math.min(150, v)); rt(s).dirty = true; }
export function takeLoan(s) {
  if (s.loans.length >= ECON.maxLoans) return false;
  s.loans.push({ left: ECON.loanMonths, pay: (ECON.loanAmount * (1 + ECON.loanRate)) / ECON.loanMonths });
  s.money += ECON.loanAmount;
  s.everLoan = true;
  return true;
}
export const loanPayoff = (l) => Math.round((ECON.loanAmount * l.left) / ECON.loanMonths * 1.05);
export function repayLoan(s, k) {
  const l = s.loans[k];
  if (!l) return false;
  const c = loanPayoff(l);
  if (s.money < c) return false;
  s.money -= c;
  s.loans.splice(k, 1);
  return true;
}

// ------------------------------------------------------------------ happiness

export function happiness(s) {
  const r = rt(s);
  let w = 0; let cov = 0; let pol = 0; let crime = 0; let unpow = 0; let dry = 0; let traf = 0;
  for (const b of s.blds) {
    if (b.k !== 'grow' || b.z !== 'R') continue;
    const i = ci(b); const n = b.n;
    w += n;
    cov += n * (Math.min(1, r.cov.police[i]) + Math.min(1, r.cov.fire[i]) + Math.min(1, r.cov.health[i]) + Math.min(1, r.cov.edu[i]) + Math.min(1, r.cov.park[i])) / 5;
    pol += n * r.pol[i] / 100; crime += n * r.crime[i] / 100;
    if (!b.pw) unpow += n;
    if (b.tier >= 2 && !(r.water[i] > 0)) dry += n;
    const a = r.access.get(b.id);
    if (a !== undefined) traf += n * Math.min(1, r.traffic[a]);
  }
  const parts = {};
  if (!w) return { value: 60, parts };
  const jobs = s.jobs.C + s.jobs.I + s.jobs.F;
  const unemp = Math.max(0, s.workers - jobs) / Math.max(1, s.workers);
  const avgTax = (s.tax.R + s.tax.C + s.tax.I) / 3;
  let lm = 0;
  for (const b of s.blds) if (PLACE[b.k]?.happy) lm += PLACE[b.k].happy;
  parts.services = (cov / w) * 32;
  parts.pollution = -(pol / w) * 35;
  parts.crime = -(crime / w) * 25;
  parts.taxes = -(avgTax - ECON.defaultTax) * 3;
  parts.jobs = -unemp * 25;
  parts.power = -(unpow / w) * 30;
  parts.water = -(dry / w) * 12;
  parts.traffic = -(traf / w) * 10;
  parts.landmarks = Math.min(15, lm);
  const v = 55 + Object.values(parts).reduce((a, x) => a + x, 0);
  return { value: Math.max(0, Math.min(100, v)), parts };
}

// ------------------------------------------------------------------ disasters

export function startFire(s, i) {
  if (!rt(s).tileB[i] || s.fires.some((f) => f.i === i)) return false;
  s.fires.push({ i, age: 0 });
  return true;
}

function wreck(s, b, events) {
  removeBuilding(s, b);
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const i = idx(x, y);
    s.terrain[i] = T.RUBBLE;
    s.rubble.push({ i, m: 4 });
  }
  events.push({ kind: 'wreck', x: b.x, y: b.y, w: b.w, h: b.h });
}

const randomBuilding = (s, filter = () => true) => {
  const list = s.blds.filter(filter);
  return list.length ? list[Math.floor(rng(s) * list.length)] : null;
};

/** Start a disaster now (random disasters, or the sandbox buttons). */
export function trigger(s, kind, events = []) {
  const tgt = randomBuilding(s, (b) => b.k === 'grow') || randomBuilding(s);
  const cx = tgt ? tgt.x : Math.floor(W / 2); const cy = tgt ? tgt.y : Math.floor(H / 2);
  if (kind === 'fire') {
    if (!tgt) return false;
    startFire(s, idx(tgt.x, tgt.y));
    events.push({ kind: 'disaster', what: 'fire', x: cx, y: cy, text: 'A fire broke out!' });
  } else if (kind === 'quake') {
    events.push({ kind: 'disaster', what: 'quake', x: cx, y: cy, text: 'Earthquake!' });
    for (const b of s.blds.slice()) {
      const c = center(b); const d = Math.hypot(c.x - cx, c.y - cy);
      if (d < 9 && rng(s) < 0.3 * (1 - d / 9)) wreck(s, b, events);
    }
    for (let k = 0; k < 2; k++) { const b = randomBuilding(s); if (b) startFire(s, idx(b.x, b.y)); }
  } else if (kind === 'meteor') {
    s.active.push({ kind: 'meteor', x: cx + 0.5, y: cy + 0.5, left: 0.12 });
    events.push({ kind: 'disaster', what: 'meteor', x: cx, y: cy, text: 'A meteor is falling!' });
  } else if (kind === 'tornado') {
    const side = Math.floor(rng(s) * 4);
    const x = side === 0 ? 0.5 : side === 1 ? W - 0.5 : 4 + rng(s) * (W - 8);
    const y = side === 2 ? 0.5 : side === 3 ? H - 0.5 : 4 + rng(s) * (H - 8);
    const a = Math.atan2(cy - y, cx - x);
    s.active.push({ kind: 'tornado', x, y, a, left: 1.1, last: -1 });
    events.push({ kind: 'disaster', what: 'tornado', x: Math.floor(x), y: Math.floor(y), text: 'Tornado!' });
  } else if (kind === 'ufo') {
    s.active.push({ kind: 'ufo', x: rng(s) < 0.5 ? -1 : W + 1, y: cy, tx: cx + 0.5, ty: cy + 0.5, left: 1.4, zap: 0.15, hp: 1, state: 'fly' });
    events.push({ kind: 'disaster', what: 'ufo', x: cx, y: cy, text: 'A UFO is attacking!' });
  } else return false;
  return true;
}

/** Move tornadoes, UFOs and meteors (continuous time, dm months). */
function stepActive(s, dm, events) {
  const r = rt(s);
  for (const a of s.active) {
    a.left -= dm;
    if (a.kind === 'meteor') {
      if (a.left <= 0 && !a.done) {
        a.done = true;
        events.push({ kind: 'impact', x: a.x, y: a.y });
        for (const b of s.blds.slice()) {
          const c = center(b);
          if (Math.hypot(c.x - a.x, c.y - a.y) < 2 + Math.max(b.w, b.h) / 2) wreck(s, b, events);
        }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = Math.floor(a.x) + dx; const y = Math.floor(a.y) + dy;
          if (inMap(x, y) && s.terrain[idx(x, y)] !== T.WATER && !s.road[idx(x, y)]) { s.terrain[idx(x, y)] = T.RUBBLE; s.rubble.push({ i: idx(x, y), m: 4 }); }
        }
        const nb = s.blds.find((b) => Math.hypot(center(b).x - a.x, center(b).y - a.y) < 5);
        if (nb) startFire(s, idx(nb.x, nb.y));
      }
    } else if (a.kind === 'tornado') {
      a.a += (rng(s) - 0.5) * 0.6;
      a.x += Math.cos(a.a) * dm * 14; a.y += Math.sin(a.a) * dm * 14;
      if (!inMap(Math.floor(a.x), Math.floor(a.y))) { if (a.left < 0.9) a.left = 0; continue; }
      const i = idx(Math.floor(a.x), Math.floor(a.y));
      if (i !== a.last) {
        a.last = i;
        const b = r.byId.get(r.tileB[i]);
        if (b && rng(s) < 0.75) wreck(s, b, events);
        else if (s.terrain[i] === T.TREE) s.terrain[i] = T.GRASS;
      }
    } else if (a.kind === 'ufo') {
      const dx = a.tx - a.x; const dy = a.ty - a.y; const d = Math.hypot(dx, dy);
      const sp = dm * 18;
      if (d > 0.3) { a.x += (dx / d) * Math.min(d, sp); a.y += (dy / d) * Math.min(d, sp); a.state = 'fly'; } else {
        a.state = 'zap';
        a.zap -= dm;
        if (a.zap <= 0) {
          a.zap = 0.18;
          const b = r.byId.get(r.tileB[idx(Math.max(0, Math.min(W - 1, Math.floor(a.x))), Math.max(0, Math.min(H - 1, Math.floor(a.y))))]);
          if (b) wreck(s, b, events);
          const nb = randomBuilding(s, (q) => Math.hypot(center(q).x - a.x, center(q).y - a.y) < 10) || randomBuilding(s);
          if (nb) { a.tx = nb.x + 0.5; a.ty = nb.y + 0.5; }
        }
      }
      if (inMap(Math.floor(a.x), Math.floor(a.y))) {
        const pol = r.cov.police[idx(Math.floor(a.x), Math.floor(a.y))];
        if (pol > 0.15) a.hp -= dm * pol * 6;
      }
      if (a.hp <= 0 && !a.down) { a.down = true; a.left = 0; events.push({ kind: 'ufoDown', x: a.x, y: a.y, text: 'Police drove off the UFO!' }); }
    }
  }
  const before = s.active.length;
  s.active = s.active.filter((a) => a.left > 0);
  if (s.active.length < before) events.push({ kind: 'disasterOver' });
}

function fireWeek(s, events) {
  const r = rt(s);
  const next = [];
  for (const f of s.fires) {
    const b = r.byId.get(r.tileB[f.i]);
    if (!b) continue;
    f.age++;
    const fc = Math.min(1, r.cov.fire[f.i]);
    if (rng(s) < 0.15 + 0.7 * fc && f.age > 0) { events.push({ kind: 'fireOut', i: f.i }); continue; }
    const x = f.i % W; const y = Math.floor(f.i / W);
    for (const [dx, dy] of N4) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (r.tileB[j] && rng(s) < 0.2 * (1 - fc) && !s.fires.some((q) => q.i === j) && !next.some((q) => q.i === j)) next.push({ i: j, age: 0 });
    }
    if (f.age >= 4) { wreck(s, b, events); continue; }
    next.push(f);
  }
  s.fires = next.filter((f) => r.tileB[f.i]);
}

// ------------------------------------------------------------------ the clock

/** Advance the city by dm months (fractions fine). Returns events for the scene. */
export function advance(s, dm) {
  const events = [];
  if (s.result?.over && !s.result.keepGoing) return events;
  const r = rt(s);
  if (r.dirty) refresh(s);
  stepActive(s, dm, events);
  s.t += dm;
  while (s.t * WEEKS_PER_MONTH >= s.weeks + 1) {
    s.weeks++;
    refresh(s);
    growWeek(s, events);
    fireWeek(s, events);
    if (s.weeks % WEEKS_PER_MONTH === 0) monthEnd(s, events);
  }
  if (r.dirty) refresh(s);
  return events;
}

function log(s, text, tone = '', who = '') {
  s.log.push({ t: Math.floor(s.t), text, tone, who });
  if (s.log.length > 40) s.log.shift();
}

function monthEnd(s, events) {
  if (rt(s).dirty) refresh(s);
  const b = budget(s);
  s.money += b.net;
  s.report = { tin: Math.round(b.tin), tout: Math.round(b.tout), net: Math.round(b.net) };
  for (const l of s.loans) l.left--;
  s.loans = s.loans.filter((l) => l.left > 0);
  const h = happiness(s);
  s.happy += (h.value - s.happy) * 0.35;
  s.stats.maxPop = Math.max(s.stats.maxPop, s.pop);
  // Rubble gets cleared up after a few months.
  for (const q of s.rubble) q.m--;
  for (const q of s.rubble) if (q.m <= 0 && s.terrain[q.i] === T.RUBBLE) s.terrain[q.i] = T.GRASS;
  s.rubble = s.rubble.filter((q) => q.m > 0 && s.terrain[q.i] === T.RUBBLE);
  s.hist.push({ t: Math.floor(s.t), pop: s.pop, money: Math.round(s.money), happy: Math.round(s.happy), jobs: s.jobs.C + s.jobs.I + s.jobs.F });
  if (s.hist.length > 240) s.hist.shift();
  events.push({ kind: 'month', net: b.net });
  // Milestones
  while (MILESTONES[s.ms + 1] && s.pop >= MILESTONES[s.ms + 1].pop) {
    s.ms++;
    const m = MILESTONES[s.ms];
    log(s, `Your town is now a ${m.name}!`, 'good');
    events.push({ kind: 'milestone', ms: s.ms, unlocks: unlocksAt(s.ms) });
  }
  // Money troubles
  if (s.money < 0) {
    s.debtMonths++;
    if (s.debtMonths === 1) log(s, 'We are in the red! Raise taxes, cut funding or take a loan.', 'bad', 'Treasurer');
  } else s.debtMonths = 0;
  // Random disasters (only if switched on, and never in the first year).
  if (s.dis && s.t > 12 && s.pop > 150 && !s.active.length && rng(s) < 0.05) {
    const kinds = ['fire', 'fire', 'fire', 'quake', 'meteor', 'tornado', 'ufo'];
    trigger(s, kinds[Math.floor(rng(s) * kinds.length)], events);
  } else if (s.dis && s.pop > 300 && rng(s) < 0.03 * (1 - avgCov(s, 'fire'))) {
    // With disasters on, small fires also break out now and then where there's no fire service.
    const b = randomBuilding(s, (q) => q.k === 'grow' && rt(s).cov.fire[idx(q.x, q.y)] < 0.3);
    if (b && startFire(s, idx(b.x, b.y))) events.push({ kind: 'disaster', what: 'fire', x: b.x, y: b.y, text: 'A fire broke out!' });
  }
  // An advisor speaks up now and then.
  if (s.weeks % (WEEKS_PER_MONTH * 2) === 0) {
    const t = tips(s).find((x) => !s.seenTips[x.id] || s.t - s.seenTips[x.id] > 12);
    if (t) { s.seenTips[t.id] = s.t; log(s, t.text, t.tone, t.who); events.push({ kind: 'advice', tip: t }); }
  }
  checkGoal(s, events);
  s.demand = demand(s);
}

function avgCov(s, k) {
  const r = rt(s);
  let n = 0; let v = 0;
  for (const b of s.blds) if (b.k === 'grow') { n++; v += Math.min(1, r.cov[k][ci(b)]); }
  return n ? v / n : 0;
}

export function unlocksAt(ms) {
  const out = [];
  for (const [k, p] of Object.entries(PLACE)) if (p.unlock === ms) out.push(p.name);
  if (MAX_TIER[ms] > MAX_TIER[ms - 1]) out.push(ms === 2 ? 'Apartments, offices and big factories' : 'Tower blocks');
  return out;
}

/** Scenario goal progress: [{ label, done }], plus the result once decided. */
export function goalStatus(s) {
  const sc = scenario(s);
  if (!sc) return null;
  const items = [{ label: `${sc.pop.toLocaleString('en-US')} people (now ${s.pop.toLocaleString('en-US')})`, done: s.pop >= sc.pop }];
  if (sc.noDebt) items.push({ label: `No loans and no debt${s.loans.length ? ` (${s.loans.length} loan${s.loans.length > 1 ? 's' : ''})` : ''}`, done: !s.loans.length && s.money >= 0 });
  if (sc.happy) items.push({ label: `Happiness ${sc.happy}%+ (now ${Math.round(s.happy)}%)`, done: s.happy >= sc.happy });
  const monthsLeft = sc.years * 12 - Math.floor(s.t);
  return { sc, items, monthsLeft, all: items.every((x) => x.done) };
}

function checkGoal(s, events) {
  const g = goalStatus(s);
  if (!g || s.result) return;
  if (!g.all && (g.monthsLeft === 12 || g.monthsLeft === 3)) log(s, `${g.monthsLeft === 12 ? 'One year' : 'Three months'} left to reach the goal! Check More, then Goal.`, 'bad', 'Planner');
  if (g.all) {
    s.result = { over: true, won: true, t: Math.floor(s.t) };
    events.push({ kind: 'win' });
  } else if (g.monthsLeft <= 0) {
    s.result = { over: true, won: false, reason: 'time' };
    events.push({ kind: 'lose', reason: 'time' });
  } else if (s.debtMonths >= 12) {
    s.result = { over: true, won: false, reason: 'debt' };
    events.push({ kind: 'lose', reason: 'debt' });
  }
}

/** After a scenario ends, keep playing the same city with no goal. */
export function keepGoing(s) { if (s.result) s.result.keepGoing = true; }

// ------------------------------------------------------------------ inspect

export function info(s, x, y) {
  const r = rt(s);
  if (!inMap(x, y)) return null;
  const i = idx(x, y);
  const b = bldAt(s, x, y);
  const pct = (v) => `${Math.round(Math.min(1, v) * 100)}%`;
  const stats = [
    ['Land value', Math.round(r.lv[i])], ['Pollution', Math.round(r.pol[i])], ['Crime', Math.round(r.crime[i])],
    ['Police', pct(r.cov.police[i])], ['Fire', pct(r.cov.fire[i])], ['Health', pct(r.cov.health[i])], ['Schools', pct(r.cov.edu[i])],
  ];
  const warn = [];
  if (b) {
    const p = PLACE[b.k];
    if (b.k === 'grow') {
      const z = ZONE_INFO[b.z];
      const d = desire(s, b.z, b.x, b.y, b.w, b.h, b.id);
      if (!b.pw && b.z !== 'F') warn.push('No power! It will empty out soon.');
      if (b.tier >= 2 && !(r.water[ci(b)] > 0) && b.z !== 'F') warn.push('No water: it can\'t stay this big.');
      for (const w of d.why) warn.push(`Held back by ${w}.`);
      if (b.tier < MAX_TIER[s.ms] && b.z !== 'F' && (SHAPES[b.z][b.tier + 1] || []).length) {
        if (!(r.water[ci(b)] > 0)) warn.push('Needs water to grow bigger.');
        else if (d.v < TIER_NEED[b.tier + 1]) warn.push('Needs higher land value to grow bigger.');
      } else if (b.tier >= MAX_TIER[s.ms] && b.z !== 'F' && MAX_TIER[s.ms] < 4 && SHAPES[b.z][b.tier + 1]?.length) {
        warn.push('Bigger buildings unlock as the town grows.');
      }
      const title = b.z === 'R' ? ['House', 'House', 'Apartments', 'Tower'][b.tier - 1] : b.z === 'C' ? ['Shop', 'Shops', 'Offices', 'Offices'][b.tier - 1] : b.z === 'I' ? ['Workshop', 'Factory', 'Big factory', 'Big factory'][b.tier - 1] : 'Farm';
      return {
        title: `${title} (${z.name})`, b, stats,
        main: b.z === 'R' ? `${b.n} residents` : `${b.n} jobs`, appeal: Math.round(d.v * 100), warn,
        fire: s.fires.some((f) => r.tileB[f.i] === b.id),
      };
    }
    if (p.power) warn.push(`Makes ${p.power} power. City uses ${Math.round(r.need)} of ${Math.round(r.supply)}.`);
    if (needsPower(b) && !b.pw) warn.push('No power! It barely works.');
    return { title: p.name, b, stats, main: p.desc, warn, removable: true, fire: s.fires.some((f) => r.tileB[f.i] === b.id) };
  }
  if (s.zone[i]) {
    const blk = lotBlocker(s, i);
    const z = s.zone[i];
    if (blk) warn.push(`Can't grow: ${blk}.`);
    else if (s.demand[z] <= 0) warn.push(`Nobody wants more ${ZONE_INFO[z].short.toLowerCase()} right now (see the RCI meter).`);
    else warn.push('Ready to grow.');
    return { title: `Empty ${ZONE_INFO[z].name} lot`, stats, main: '', warn };
  }
  const t = s.terrain[i];
  if (s.road[i]) return { title: s.terrain[i] === T.WATER ? 'Bridge' : 'Road', stats: [['Traffic', pct(r.traffic[i])]], main: r.outside[i] ? 'Linked to the highway.' : 'Not linked to the highway.', warn };
  if (s.line[i]) return { title: 'Power line', stats, main: r.lotPower[i] ? 'Carrying power.' : 'No power yet: connect it to a plant.', warn };
  const names = { [T.GRASS]: 'Grass', [T.WATER]: 'Water', [T.TREE]: 'Trees', [T.RUBBLE]: 'Rubble' };
  return { title: names[t], stats, main: t === T.RUBBLE ? 'Bulldoze it, or wait and it gets cleared.' : t === T.TREE ? 'Trees raise nearby land value a little. Bulldoze to clear.' : '', warn };
}

// ------------------------------------------------------------------ for overlays

export const OVERLAYS = {
  power: 'Power', water: 'Water', lv: 'Land value', pol: 'Pollution', crime: 'Crime', traffic: 'Traffic',
  police: 'Police', fire: 'Fire', health: 'Health', edu: 'Schools',
};
/** Value 0..1 for each tile under an overlay (null = draw nothing). */
export function overlayValue(s, kind, i) {
  const r = rt(s);
  switch (kind) {
    case 'power': if (!s.zone[i] && !r.tileB[i] && !s.line[i]) return null; return r.tileB[i] ? (r.power[i] ? 1 : 0) : r.lotPower[i];
    case 'water': return Math.min(1, r.water[i]);
    case 'lv': return r.lv[i] / 100;
    case 'pol': return r.pol[i] / 100;
    case 'crime': return r.tileB[i] ? r.crime[i] / 100 : null;
    case 'traffic': return s.road[i] ? Math.min(1, r.traffic[i]) : null;
    default: return Math.min(1, r.cov[kind]?.[i] || 0);
  }
}
