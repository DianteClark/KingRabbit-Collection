// Pangea game rules: the whole game state is one plain JSON object, changed only through these
// functions, so the scenes, the AI and the node tests all play by exactly the same rules.
import { rngFrom } from './rng.js';
import {
  TERRAIN, FEATURES, RESOURCES, JOBS, TECHS, TECH_LIST, UNITS, OBSOLETE, UNIT_ORDER, BUILDINGS, BUILDING_ORDER,
  WONDERS, WONDER_ORDER, CIV_BY_ID, COLORS, MAP_SIZES, SCORE, LUXURY_JOY, MAX_SIZE_NO_AQUEDUCT, ERAS,
} from './data.js';
import {
  generateMap, idx, inMap, DIRS8, dist, isLand, tileYield,
} from './map.js';

export { idx, inMap, dist, DIRS8, isLand, tileYield };

export const SIGHT = 2;
export const CITY_RADIUS = 2;
export const MIN_CITY_DIST = 3;
export const BASE_JOY = 6;
export const DMG = 1;
export const MAX_HP = 10;
export const PEACE_LOCK = 8; // turns of war before peace can be signed
export const PACT_GOLD = 3;

// ---------------------------------------------------------------- setup

/**
 * players: [{ civ: 'verdan', human: true, skill?: 0..1 }] (first player is "you" in a solo game).
 * opts: { size: 'small'|'medium', seed, maxTurn, tutorial }
 */
export function newGame(players, { size = 'small', seed = 1, maxTurn = 150, tutorial = false } = {}) {
  const dims = MAP_SIZES[size] || MAP_SIZES.small;
  const map = generateMap({ w: dims.w, h: dims.h, civs: players.length, seed });
  const s = {
    v: 1, seed, rng: { s: seed ^ 0x5bd1e995 }, turn: 1, maxTurn, size, w: map.w, h: map.h,
    tiles: map.tiles.map((t) => ({ ...t, imp: null, o: -1, c: -1 })),
    civs: [], cities: [], units: [], wonders: {}, rel: {}, cur: 0, nextId: 1, over: null,
    events: [], tutorial: !!tutorial, hotseat: players.filter((p) => p.human).length > 1,
  };
  players.forEach((p, i) => {
    const def = CIV_BY_ID[p.civ];
    s.civs.push({
      id: i, key: def.id, name: def.name, leader: def.leader, avatar: def.avatar, color: i % COLORS.length,
      human: !!p.human, skill: p.skill ?? 0.5, alive: true, gold: 10, techs: [], research: null, progress: 0, goal: null,
      explored: new Array(map.w * map.h).fill(0), met: {}, mood: {}, capital: null, origCapital: null,
      nameIdx: 0, seenEv: 0, stats: { founded: 0, captured: 0, lost: 0, kills: 0, losses: 0 }, start: map.starts[i], startTurn: true,
    });
  });
  for (let a = 0; a < s.civs.length; a++) for (let b = a + 1; b < s.civs.length; b++) s.rel[`${a}-${b}`] = { war: false, since: 0, pact: false };
  s.civs.forEach((c, i) => {
    const [x, y] = map.starts[i];
    addUnit(s, i, 'settler', x, y);
    const near = DIRS8.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inMap(s, nx, ny) && canStand(s, nx, ny));
    const [wx, wy] = near[0] || [x, y];
    addUnit(s, i, 'warrior', wx, wy);
    addUnit(s, i, 'worker', x, y);
    reveal(s, i);
  });
  startTurn(s);
  return s;
}

export const rng = (s) => rngFrom(s.rng);
export const tileAt = (s, x, y) => s.tiles[idx(s, x, y)];
export const civ = (s, i) => s.civs[i];
export const cityById = (s, id) => s.cities.find((c) => c.id === id) || null;
export const unitById = (s, id) => s.units.find((u) => u.id === id) || null;
export const cityAt = (s, x, y) => s.cities.find((c) => c.x === x && c.y === y) || null;
export const unitsAt = (s, x, y) => s.units.filter((u) => u.x === x && u.y === y);
export const isCivilian = (u) => !!UNITS[u.type].civ;
export const militaryAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y && !isCivilian(u)) || null;
export const civilianAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y && isCivilian(u)) || null;
export const citiesOf = (s, c) => s.cities.filter((x) => x.owner === c);
export const unitsOf = (s, c) => s.units.filter((u) => u.owner === c);
export const hasTech = (s, c, t) => !t || s.civs[c].techs.includes(t);
export const relKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const rel = (s, a, b) => s.rel[relKey(a, b)];
export const atWar = (s, a, b) => a !== b && !!s.rel[relKey(a, b)]?.war;
export const eraOf = (s, c) => s.civs[c].techs.reduce((e, t) => Math.max(e, TECHS[t].era), 0);
export const eraName = (s, c) => ERAS[eraOf(s, c)];
export const humans = (s) => s.civs.filter((c) => c.human);

function canStand(s, x, y) {
  const t = tileAt(s, x, y);
  return isLand(t) && !(t.f && FEATURES[t.f].blocked);
}

function event(s, civIdx, text, extra = {}) {
  s.evId = (s.evId || 0) + 1;
  s.events.push({ id: s.evId, civ: civIdx, turn: s.turn, text, ...extra });
  if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
}

export function addUnit(s, owner, type, x, y, extra = {}) {
  const def = UNITS[type];
  const u = { id: s.nextId++, owner, type, x, y, hp: MAX_HP, moves: def.move, fort: false, job: null, goto: null, vet: false, rested: true, sleep: false, ...extra };
  s.units.push(u);
  return u;
}

function removeUnit(s, u) {
  const i = s.units.indexOf(u);
  if (i >= 0) s.units.splice(i, 1);
}

// ---------------------------------------------------------------- vision and contact

export function visibleSet(s, c) {
  const vis = new Uint8Array(s.w * s.h);
  const mark = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(s, x + dx, y + dy)) vis[idx(s, x + dx, y + dy)] = 1;
  };
  for (const u of s.units) if (u.owner === c) mark(u.x, u.y, SIGHT);
  for (const ct of s.cities) if (ct.owner === c) mark(ct.x, ct.y, SIGHT);
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i].o === c) vis[i] = 1;
  return vis;
}

/** Mark what civ c sees as explored and meet anyone it sees. */
export function reveal(s, c) {
  const vis = visibleSet(s, c);
  const ex = s.civs[c].explored;
  for (let i = 0; i < vis.length; i++) if (vis[i]) ex[i] = 1;
  const seeOther = (o) => { if (o !== c && o >= 0 && !s.civs[c].met[o] && s.civs[o].alive) meet(s, c, o); };
  for (const u of s.units) if (vis[idx(s, u.x, u.y)]) seeOther(u.owner);
  for (const ct of s.cities) if (vis[idx(s, ct.x, ct.y)]) seeOther(ct.owner);
  for (let i = 0; i < vis.length; i++) if (vis[i] && s.tiles[i].o >= 0) seeOther(s.tiles[i].o);
  return vis;
}

export function meet(s, a, b) {
  s.civs[a].met[b] = true;
  s.civs[b].met[a] = true;
  event(s, a, `You met ${s.civs[b].name}, led by ${s.civs[b].leader}.`, { kind: 'meet', other: b });
  event(s, b, `You met ${s.civs[a].name}, led by ${s.civs[a].leader}.`, { kind: 'meet', other: a });
}

// ---------------------------------------------------------------- cities: tiles and yields

export function cityRadiusTiles(s, ct, r = CITY_RADIUS) {
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (r >= 2 && Math.abs(dx) === r && Math.abs(dy) === r) continue;
      const x = ct.x + dx; const y = ct.y + dy;
      if (inMap(s, x, y)) out.push(idx(s, x, y));
    }
  }
  return out;
}

export function hasBuilding(ct, b) { return ct.blds.includes(b); }

function empireWonderFx(s, c) {
  const fx = { joy: 0, food: 0, prod: 0 };
  for (const [w, owner] of Object.entries(s.wonders)) {
    if (owner !== c) continue;
    const holder = s.cities.find((ct) => ct.wonders.includes(w));
    if (!holder || holder.owner !== c) continue;
    fx.joy += WONDERS[w].empireJoy || 0;
    fx.food += WONDERS[w].empireFood || 0;
    fx.prod += WONDERS[w].empireProd || 0;
  }
  return fx;
}

/** Yield of one tile for a city (improvements and the Lighthouse included). */
export function tileValue(s, ct, i) {
  const t = s.tiles[i];
  const y = tileYield(t);
  if (t.imp && JOBS[t.imp].y) JOBS[t.imp].y.forEach((v, k) => { y[k] += v; });
  if (ct && !isLand(t) && ct.wonders.includes('lighthouse')) y[0] += 1;
  return y;
}

const FOCUS_W = {
  balanced: [1.1, 1.3, 0.6],
  food: [2.2, 0.8, 0.5],
  prod: [0.9, 2.2, 0.5],
  gold: [0.9, 0.8, 2.2],
};
export const FOCUS = { balanced: 'Balanced', food: 'Food', prod: 'Production', gold: 'Gold' };

/** Tiles the city can work: inside its radius, owned by its civ and claimed by this city. */
export function workable(s, ct) {
  const enemy = new Set(s.units.filter((u) => u.owner !== ct.owner && atWar(s, u.owner, ct.owner)).map((u) => idx(s, u.x, u.y)));
  return cityRadiusTiles(s, ct).filter((i) => {
    const t = s.tiles[i];
    return t.c === ct.id && !(i === idx(s, ct.x, ct.y)) && !enemy.has(i);
  });
}

/** Pick the tiles the city's citizens work (by focus) and add everything up. */
export function cityYield(s, ct) {
  const w = FOCUS_W[ct.focus] || FOCUS_W.balanced;
  const center = tileValue(s, ct, idx(s, ct.x, ct.y));
  center[0] += 1; center[1] = Math.max(2, center[1] + 1); center[2] += 2;
  const opts = workable(s, ct).map((i) => ({ i, y: tileValue(s, ct, i) }));
  // Pick by focus; if that would starve the city, pick with food first instead.
  const pickBy = (wt) => [...opts].sort((a, b) => (b.y[0] * wt[0] + b.y[1] * wt[1] + b.y[2] * wt[2]) - (a.y[0] * wt[0] + a.y[1] * wt[1] + a.y[2] * wt[2])).slice(0, ct.pop);
  let chosen = pickBy(w);
  if (center[0] + chosen.reduce((a, o) => a + o.y[0], 0) < ct.pop * 2) chosen = pickBy([3, 1, 0.3]);
  const worked = chosen.map((o) => o.i);
  const tot = [...center];
  for (const i of worked) tileValue(s, ct, i).forEach((v, k) => { tot[k] += v; });
  const pct = { food: 0, prod: 0, gold: 0, sci: 0 };
  const add = { food: 0, prod: 0, gold: 0, sci: 0 };
  let culture = 1; let joy = 0;
  for (const b of ct.blds) {
    const d = BUILDINGS[b];
    if (d.pct) for (const k of Object.keys(d.pct)) pct[k] += d.pct[k];
    if (d.add) for (const k of Object.keys(d.add)) add[k] += d.add[k];
    culture += d.culture || 0; joy += d.joy || 0;
  }
  for (const wd of ct.wonders) {
    const d = WONDERS[wd];
    if (d.pct) for (const k of Object.keys(d.pct)) pct[k] += d.pct[k];
    if (d.add) for (const k of Object.keys(d.add)) add[k] += d.add[k];
    culture += 2 + (d.culture || 0);
  }
  const emp = empireWonderFx(s, ct.owner);
  add.food += emp.food; pct.prod += emp.prod;
  if (ct.capital) { add.gold += 2; add.sci += 2; culture += 1; }
  const mood = joyOf(s, ct.owner);
  let prodMul = 1 + pct.prod / 100;
  if (mood.net <= -5) prodMul *= 0.75;
  const food = tot[0] + add.food;
  const prod = Math.max(1, Math.round((tot[1] + add.prod + Math.floor(ct.pop / 2)) * prodMul));
  const gold = Math.round((tot[2] + add.gold + Math.floor(ct.pop / 2)) * (1 + pct.gold / 100));
  const sci = Math.round((ct.pop + 1 + add.sci) * (1 + pct.sci / 100));
  const eat = ct.pop * 2;
  let surplus = food - eat;
  if (surplus > 0 && mood.net < 0) surplus = 0; // unhappy people don't grow
  const capped = !ct.blds.includes('aqueduct') && ct.pop >= MAX_SIZE_NO_AQUEDUCT;
  if (surplus > 0 && capped) surplus = 0;
  return { food, prod, gold, sci, culture, joy, eat, surplus, worked, capped, unhappy: mood.net < 0 };
}

export const growNeed = (pop) => 8 + pop * 6;
export const borderNeed = (n) => 6 + n * 5;

// ---------------------------------------------------------------- empire totals

export function luxuriesOf(s, c) {
  const set = new Set();
  for (const t of s.tiles) if (t.o === c && t.r && RESOURCES[t.r].lux) set.add(t.r);
  return [...set];
}

/** Happiness: base + luxuries + buildings + wonders, minus 2 per city and 1 per citizen. */
export function joyOf(s, c) {
  const cs = s.cities.filter((ct) => ct.owner === c);
  let plus = BASE_JOY + luxuriesOf(s, c).length * LUXURY_JOY;
  for (const ct of cs) {
    for (const b of ct.blds) plus += BUILDINGS[b].joy || 0;
  }
  plus += empireWonderFx(s, c).joy;
  const minus = cs.length * 2 + cs.reduce((a, ct) => a + ct.pop, 0);
  return { plus, minus, net: plus - minus };
}

export function unitUpkeep(s, c) {
  const n = s.units.filter((u) => u.owner === c).length;
  const free = 3 + Math.floor(s.cities.filter((ct) => ct.owner === c).length * 1.5);
  return Math.max(0, n - free);
}

export function buildingUpkeep(s, c) {
  let g = 0;
  for (const ct of s.cities) if (ct.owner === c) for (const b of ct.blds) g += BUILDINGS[b].upkeep;
  return g;
}

export function pactGold(s, c) {
  let g = 0;
  for (const o of s.civs) if (o.id !== c && o.alive && rel(s, c, o.id)?.pact && !atWar(s, c, o.id)) g += PACT_GOLD;
  return g;
}

export function civTotals(s, c) {
  let gold = 0; let sci = 0; let food = 0; let prod = 0;
  for (const ct of s.cities) {
    if (ct.owner !== c) continue;
    const y = cityYield(s, ct);
    gold += y.gold; sci += y.sci; food += y.surplus; prod += y.prod;
  }
  const upkeep = unitUpkeep(s, c) + buildingUpkeep(s, c);
  const pact = pactGold(s, c);
  return { gold, sci, food, prod, upkeep, pact, net: gold + pact - upkeep, joy: joyOf(s, c) };
}

// ---------------------------------------------------------------- research

/** Research cost; shorter games (fewer turns) have cheaper techs. */
export const techCost = (s, t) => Math.round(TECHS[t].cost * Math.max(0.6, Math.min(1, (s.maxTurn || 150) / 150)));

export function techAvailable(s, c, t) {
  const cv = s.civs[c];
  return !cv.techs.includes(t) && TECHS[t].req.every((r) => cv.techs.includes(r));
}
export const availableTechs = (s, c) => TECH_LIST.filter((t) => techAvailable(s, c, t.id)).map((t) => t.id);

/** Every tech still needed to reach goal (in a valid order), goal last. */
export function techPath(s, c, goal) {
  const have = new Set(s.civs[c].techs);
  const out = [];
  const visit = (t) => {
    if (have.has(t) || out.includes(t)) return;
    for (const r of TECHS[t].req) visit(r);
    out.push(t);
  };
  visit(goal);
  return out;
}

/** Research t (or work toward it through its prerequisites). */
export function setResearch(s, c, t) {
  const cv = s.civs[c];
  if (cv.techs.includes(t)) return false;
  const path = techPath(s, c, t);
  const next = path.find((x) => techAvailable(s, c, x));
  if (!next) return false;
  cv.goal = path.length > 1 ? t : null;
  if (cv.research !== next) cv.research = next; // progress is kept: beakers carry over between choices
  return true;
}

export function grantTech(s, c, t) {
  const cv = s.civs[c];
  if (cv.techs.includes(t)) return;
  cv.techs.push(t);
  if (cv.research === t) cv.research = null;
  if (cv.goal === t) cv.goal = null;
  if (!cv.research && cv.goal) setResearch(s, c, cv.goal);
  event(s, c, `Discovered ${TECHS[t].name}: ${TECHS[t].blurb}.`, { kind: 'tech', tech: t });
}

export function turnsToResearch(s, c) {
  const cv = s.civs[c];
  if (!cv.research) return null;
  const sci = Math.max(1, civTotals(s, c).sci);
  return Math.max(1, Math.ceil((techCost(s, cv.research) - cv.progress) / sci));
}

// ---------------------------------------------------------------- what cities can build

export function unitAvailable(s, c, type) {
  const d = UNITS[type];
  if (!hasTech(s, c, d.tech)) return false;
  const newer = OBSOLETE[type];
  if (newer && hasTech(s, c, UNITS[newer].tech)) return false;
  return true;
}

export function canBuild(s, ct, item) {
  const c = ct.owner;
  if (item.kind === 'unit') return !!UNITS[item.id] && unitAvailable(s, c, item.id);
  if (item.kind === 'bld') return !!BUILDINGS[item.id] && hasTech(s, c, BUILDINGS[item.id].tech) && !ct.blds.includes(item.id) && !ct.queue.some((q) => q.kind === 'bld' && q.id === item.id);
  if (item.kind === 'wonder') {
    const d = WONDERS[item.id];
    if (!d || !hasTech(s, c, d.tech) || s.wonders[item.id] !== undefined) return false;
    // One city per civ works on a given wonder at a time.
    return !s.cities.some((o) => o.owner === c && o.queue.some((q) => q.kind === 'wonder' && q.id === item.id));
  }
  return false;
}

export function itemDef(item) {
  if (item.kind === 'unit') return UNITS[item.id];
  if (item.kind === 'bld') return BUILDINGS[item.id];
  return WONDERS[item.id];
}
export const itemCost = (item) => itemDef(item).cost;

export function buildOptions(s, ct) {
  const out = [];
  for (const id of UNIT_ORDER) if (canBuild(s, ct, { kind: 'unit', id })) out.push({ kind: 'unit', id });
  for (const id of BUILDING_ORDER) if (canBuild(s, ct, { kind: 'bld', id })) out.push({ kind: 'bld', id });
  for (const id of WONDER_ORDER) if (canBuild(s, ct, { kind: 'wonder', id })) out.push({ kind: 'wonder', id });
  return out;
}

export function enqueue(s, ct, item) {
  if (!canBuild(s, ct, item)) return false;
  if (ct.queue.length >= 6) return false;
  ct.queue.push({ kind: item.kind, id: item.id });
  return true;
}

export function dequeue(s, ct, i) {
  if (i < 0 || i >= ct.queue.length) return false;
  ct.queue.splice(i, 1);
  return true;
}

export function turnsToBuild(s, ct, item = ct.queue[0], first = true) {
  if (!item) return null;
  const y = cityYield(s, ct);
  const have = first ? ct.prod : 0;
  return Math.max(1, Math.ceil((itemCost(item) - have) / Math.max(1, y.prod)));
}

export function buyCost(s, ct) {
  const item = ct.queue[0];
  if (!item || item.kind === 'wonder') return null;
  const left = Math.max(0, itemCost(item) - ct.prod);
  if (left <= 0) return null;
  return Math.ceil(left * 2 + left * left / 40 + 8);
}

export function buy(s, ct) {
  const cost = buyCost(s, ct);
  const cv = s.civs[ct.owner];
  if (cost == null || cv.gold < cost) return false;
  cv.gold -= cost;
  ct.prod = itemCost(ct.queue[0]);
  ct.bought = true;
  return true;
}

// ---------------------------------------------------------------- founding and borders

export function canFoundAt(s, c, x, y) {
  if (!inMap(s, x, y)) return false;
  const t = tileAt(s, x, y);
  if (!isLand(t) || (t.f && FEATURES[t.f].blocked)) return false;
  if (t.o >= 0 && t.o !== c) return false;
  return !s.cities.some((ct) => dist(ct.x, ct.y, x, y) < MIN_CITY_DIST);
}

export function foundCity(s, unit) {
  if (unit.type !== 'settler' || !canFoundAt(s, unit.owner, unit.x, unit.y)) return null;
  const c = unit.owner; const cv = s.civs[c];
  const names = CIV_BY_ID[cv.key].cities;
  const name = cv.nameIdx < names.length ? names[cv.nameIdx] : `New ${names[cv.nameIdx % names.length]}`;
  cv.nameIdx++;
  const first = !s.cities.some((ct) => ct.owner === c);
  const ct = {
    id: s.nextId++, owner: c, founder: c, name, x: unit.x, y: unit.y, pop: 1, food: 0, prod: 0, queue: [], blds: [], wonders: [],
    culture: 0, claims: 0, focus: 'balanced', capital: first && cv.capital == null, born: s.turn,
  };
  s.cities.push(ct);
  if (ct.capital) { cv.capital = ct.id; if (cv.origCapital == null) cv.origCapital = ct.id; }
  removeUnit(s, unit);
  // Claim the ring around the city (tiles nobody owns yet; your own unclaimed land too).
  for (const i of cityRadiusTiles(s, ct, 1)) {
    const t = s.tiles[i];
    if (t.o === -1 || (t.o === c && t.c === -1)) { t.o = c; t.c = ct.id; }
  }
  const ci = idx(s, ct.x, ct.y);
  s.tiles[ci].o = c; s.tiles[ci].c = ct.id;
  if (s.tiles[ci].f === 'forest') s.tiles[ci].f = null;
  cv.stats.founded++;
  cv.everCity = true;
  reveal(s, c);
  event(s, c, `${name} was founded.`, { kind: 'found', x: ct.x, y: ct.y });
  return ct;
}

function growBorders(s, ct, y) {
  ct.culture += y.culture;
  while (ct.culture >= borderNeed(ct.claims)) {
    ct.culture -= borderNeed(ct.claims);
    ct.claims++;
    // Best unowned tile within 3 that touches this civ's land.
    let best = -1; let bs = -1;
    for (const i of cityRadiusTiles(s, ct, 3)) {
      const t = s.tiles[i];
      if (t.o !== -1) continue;
      const x = i % s.w; const yy = Math.floor(i / s.w);
      if (!DIRS8.some(([dx, dy]) => inMap(s, x + dx, yy + dy) && s.tiles[idx(s, x + dx, yy + dy)].c === ct.id)) continue;
      const v = tileYield(t);
      const sc = v[0] * 2 + v[1] * 1.5 + v[2] + (t.r ? 3 : 0) + (RESOURCES[t.r]?.lux ? 4 : 0) - dist(ct.x, ct.y, x, yy) * 1.2;
      if (sc > bs) { bs = sc; best = i; }
    }
    if (best < 0) break;
    s.tiles[best].o = ct.owner; s.tiles[best].c = ct.id;
  }
}

// ---------------------------------------------------------------- movement

const MOVE_INF = 99;

/** Cost for unit u to enter (x, y), or MOVE_INF. Ignores other units. */
export function stepCost(s, u, x, y) {
  const t = tileAt(s, x, y);
  if (!isLand(t)) return hasTech(s, u.owner, 'mapmaking') ? 1 : MOVE_INF; // embark after Map Making
  if (t.f) return FEATURES[t.f].blocked ? MOVE_INF : FEATURES[t.f].move;
  return 1;
}

/** Occupancy index for fast lookups during path searches. */
export function occupancy(s) {
  const m = new Map();
  for (const u of s.units) {
    const k = idx(s, u.x, u.y);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(u);
  }
  const cities = new Map(s.cities.map((ct) => [idx(s, ct.x, ct.y), ct]));
  return { units: m, cities };
}

/** Can unit u end a step on tile i (no fighting)? */
function canEnterIdx(s, u, i, occ) {
  const here = occ.units.get(i) || [];
  if (here.some((o) => o.owner !== u.owner)) return false;
  const civ1 = isCivilian(u);
  if (here.some((o) => o !== u && isCivilian(o) === civ1)) return false;
  const ct = occ.cities.get(i);
  if (ct && ct.owner !== u.owner) return false;
  return true;
}

/** Can unit pass through tile i (may share with own units while moving through)? */
function canPassIdx(s, u, i, occ) {
  const here = occ.units.get(i) || [];
  if (here.some((o) => o.owner !== u.owner)) return false;
  const ct = occ.cities.get(i);
  if (ct && ct.owner !== u.owner) return false;
  return true;
}

class Heap {
  constructor() { this.a = []; }
  push(k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1; const r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

/**
 * Tiles the unit can reach this turn: Map idx -> { left, prev }. A unit with any moves left can
 * always enter a tile, even an expensive one (it then has no moves left).
 */
export function reachable(s, u, occ = occupancy(s)) {
  const start = idx(s, u.x, u.y);
  const best = new Map([[start, { left: u.moves, prev: -1 }]]);
  const h = new Heap();
  h.push(-u.moves, start);
  while (h.size) {
    const [negLeft, i] = h.pop();
    const left = -negLeft;
    if (best.get(i).left !== left || left <= 0) continue;
    const x = i % s.w; const y = Math.floor(i / s.w);
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(s, nx, ny)) continue;
      const j = idx(s, nx, ny);
      const c = stepCost(s, u, nx, ny);
      if (c >= MOVE_INF) continue;
      if (!canPassIdx(s, u, j, occ)) continue;
      const nl = Math.max(0, left - c);
      const cur = best.get(j);
      if (cur && cur.left >= nl) continue;
      best.set(j, { left: nl, prev: i });
      h.push(-nl, j);
    }
  }
  // Only tiles where the unit may stop.
  for (const k of [...best.keys()]) if (k !== start && !canEnterIdx(s, u, k, occ)) best.get(k).passOnly = true;
  return best;
}

/**
 * Shortest multi-turn path (list of [x, y] steps, start excluded) or null. Own units are ignored
 * except at the goal; foreign units and cities block. opts.attack lets the goal hold an enemy.
 */
export function findPath(s, u, tx, ty, { occ = occupancy(s), attack = false, maxCost = 400 } = {}) {
  if (!inMap(s, tx, ty)) return null;
  const goal = idx(s, tx, ty);
  const start = idx(s, u.x, u.y);
  if (goal === start) return [];
  if (stepCost(s, u, tx, ty) >= MOVE_INF) return null;
  const g = new Map([[start, 0]]);
  const prev = new Map();
  const h = new Heap();
  h.push(dist(u.x, u.y, tx, ty), start);
  while (h.size) {
    const [, i] = h.pop();
    if (i === goal) break;
    const gi = g.get(i);
    if (gi > maxCost) return null;
    const x = i % s.w; const y = Math.floor(i / s.w);
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(s, nx, ny)) continue;
      const j = idx(s, nx, ny);
      const c = stepCost(s, u, nx, ny);
      if (c >= MOVE_INF) continue;
      if (j === goal) { if (!attack && !canEnterIdx(s, u, j, occ)) continue; } else if (!canPassIdx(s, u, j, occ)) continue;
      const ng = gi + Math.min(c, u.moves || 1) + 0.001 * (dx && dy ? 1 : 0);
      if (g.has(j) && g.get(j) <= ng) continue;
      g.set(j, ng); prev.set(j, i);
      h.push(ng + dist(nx, ny, tx, ty), j);
    }
  }
  if (!prev.has(goal)) return null;
  const out = [];
  for (let i = goal; i !== start; i = prev.get(i)) out.push([i % s.w, Math.floor(i / s.w)]);
  return out.reverse();
}

/**
 * Move a unit toward (tx, ty) as far as it can this turn. Long trips are remembered (u.goto) and
 * carried on next turn. Returns the steps actually taken ([x, y] list).
 */
export function moveUnit(s, u, tx, ty, { keepGoto = true } = {}) {
  if (u.owner !== s.cur || u.moves <= 0) return [];
  const occ = occupancy(s);
  const reach = reachable(s, u, occ);
  const goal = idx(s, tx, ty);
  let steps = [];
  if (reach.has(goal) && !reach.get(goal).passOnly && goal !== idx(s, u.x, u.y)) {
    for (let i = goal; i !== idx(s, u.x, u.y); i = reach.get(i).prev) steps.push([i % s.w, Math.floor(i / s.w)]);
    steps.reverse();
    u.goto = null;
  } else {
    const path = findPath(s, u, tx, ty, { occ });
    if (!path || !path.length) { u.goto = null; return []; }
    // Walk the path while there are moves; stop before a tile we can only pass through.
    let k = 0;
    for (let left = u.moves; k < path.length && left > 0; k++) {
      const [x, y] = path[k];
      const i = idx(s, x, y);
      const r = reach.get(i);
      if (!r) break;
      left = r.left;
    }
    steps = path.slice(0, k);
    while (steps.length && reach.get(idx(s, ...steps[steps.length - 1]))?.passOnly) steps.pop();
    u.goto = keepGoto && steps.length < path.length ? [tx, ty] : null;
  }
  if (!steps.length) return [];
  const last = steps[steps.length - 1];
  u.moves = reach.get(idx(s, last[0], last[1]))?.left ?? 0;
  u.x = last[0]; u.y = last[1];
  u.fort = false; u.sleep = false; u.job = null; u.rested = false;
  reveal(s, u.owner);
  return steps;
}

/** Carry on with remembered long trips. Returns [{ unit, steps }]. */
export function runGotos(s, c) {
  const out = [];
  for (const u of s.units.filter((x) => x.owner === c && x.goto && x.moves > 0)) {
    const [tx, ty] = u.goto;
    if (u.x === tx && u.y === ty) { u.goto = null; continue; }
    const steps = moveUnit(s, u, tx, ty);
    if (!steps.length) u.goto = null;
    else out.push({ unit: u, steps });
    // Stop the trip when an enemy shows up next to the unit.
    if (s.units.some((o) => o.owner !== c && atWar(s, o.owner, c) && !isCivilian(o) && dist(o.x, o.y, u.x, u.y) <= 1)) u.goto = null;
  }
  return out;
}

// ---------------------------------------------------------------- combat

export function isMounted(type) { return !!UNITS[type].mounted || UNITS[type].line === 'mounted'; }

function strengthMods(s, u, role, other, tile, city) {
  const mods = [];
  const d = UNITS[u.type];
  if (u.vet) mods.push(['Veteran', 25]);
  if (role === 'att') {
    if (d.vsMounted && isMounted(other.type)) mods.push(['vs mounted', d.vsMounted]);
    if (d.vsCity && city) mods.push(['vs city', d.vsCity]);
  } else {
    if (city) {
      mods.push(['In city', 25]);
      if (city.blds.includes('walls')) mods.push(['Walls', BUILDINGS.walls.walls]);
    } else if (tile.f && FEATURES[tile.f].def) mods.push([FEATURES[tile.f].name, FEATURES[tile.f].def]);
    if (u.fort) mods.push(['Fortified', 25]);
    if (d.vsMounted && isMounted(other.type)) mods.push(['vs mounted', d.vsMounted]);
    if (!isLand(tile)) mods.push(['At sea', -50]);
  }
  if (joyOf(s, u.owner).net <= -10) mods.push(['Unhappy', -25]);
  return mods;
}

/** Chance the attacker wins: rounds of A/(A+D); the loser of a round takes DMG damage. */
export function winChance(A, D, ahp, dhp) {
  const p = A / (A + D);
  const memo = new Map();
  const f = (a, d) => {
    if (d <= 0) return 1;
    if (a <= 0) return 0;
    const k = a * 100 + d;
    if (memo.has(k)) return memo.get(k);
    const v = p * f(a, d - DMG) + (1 - p) * f(a - DMG, d);
    memo.set(k, v);
    return v;
  };
  return f(ahp, dhp);
}

/**
 * What happens if unit u moves onto (x, y): null (can't), { kind: 'move' }, { kind: 'capture' }
 * (enemy civilians or an empty enemy city), or { kind: 'attack', ...odds }.
 * needsWar is set when the target belongs to a civ you are at peace with.
 */
export function targetInfo(s, u, x, y) {
  if (!inMap(s, x, y) || dist(u.x, u.y, x, y) !== 1) return null;
  const tile = tileAt(s, x, y);
  const def = militaryAt(s, x, y);
  const civil = civilianAt(s, x, y);
  const city = cityAt(s, x, y);
  const owner = def?.owner ?? civil?.owner ?? city?.owner;
  if (owner == null || owner === u.owner) return null;
  const base = { owner, needsWar: !atWar(s, u.owner, owner) };
  if (isCivilian(u)) return null;
  if (!isLand(tileAt(s, u.x, u.y))) return null; // no attacking from boats
  if (stepCost(s, u, x, y) >= MOVE_INF) return null;
  if (!def) return { ...base, kind: 'capture', city, civil };
  const am = strengthMods(s, u, 'att', def, tile, city);
  const dm = strengthMods(s, def, 'def', u, tile, city);
  const A = UNITS[u.type].str * (1 + am.reduce((a, m) => a + m[1], 0) / 100);
  const D = Math.max(0.5, UNITS[def.type].str * (1 + dm.reduce((a, m) => a + m[1], 0) / 100));
  return { ...base, kind: 'attack', def, city, A, D, aMods: am, dMods: dm, win: winChance(A, D, u.hp, def.hp) };
}

export function declareWar(s, a, b) {
  const r = rel(s, a, b);
  if (!r || r.war) return false;
  r.war = true; r.since = s.turn; r.pact = false;
  s.civs[b].mood[a] = (s.civs[b].mood[a] || 0) - 6;
  for (const o of s.civs) if (o.id !== a && o.id !== b && o.met[a]) o.mood[a] = (o.mood[a] || 0) - 1;
  event(s, -1, `${s.civs[a].name} declared war on ${s.civs[b].name}!`, { kind: 'war', a, b });
  return true;
}

export function canMakePeace(s, a, b) { const r = rel(s, a, b); return !!r?.war && s.turn - r.since >= PEACE_LOCK; }

export function makePeace(s, a, b) {
  if (!canMakePeace(s, a, b)) return false;
  const r = rel(s, a, b);
  r.war = false; r.since = s.turn;
  event(s, -1, `${s.civs[a].name} and ${s.civs[b].name} made peace.`, { kind: 'peace', a, b });
  return true;
}

/**
 * Attack or capture at (x, y). Returns { kind, won, info, ... } or null. War must already be
 * declared (the UI asks first; the AI declares before attacking).
 */
export function attack(s, u, x, y) {
  const info = targetInfo(s, u, x, y);
  if (!info || info.needsWar || u.moves <= 0 || u.owner !== s.cur) return null;
  u.fort = false; u.sleep = false; u.job = null; u.goto = null; u.rested = false;
  if (info.kind === 'capture') {
    const res = { kind: 'capture', won: true, info, captured: [] };
    if (info.civil) {
      const cv = info.civil;
      const old = cv.owner;
      cv.owner = u.owner; cv.type = 'worker'; cv.moves = 0; cv.goto = null; cv.job = null;
      res.captured.push(cv.id);
      event(s, old, `${s.civs[u.owner].name} captured your ${UNITS[info.civil.type].name}.`, { kind: 'lost', x, y });
    }
    u.x = x; u.y = y; u.moves = Math.max(0, u.moves - stepCost(s, u, x, y));
    if (info.city) { captureCity(s, info.city, u.owner); res.city = info.city.id; }
    reveal(s, u.owner);
    checkVictory(s);
    return res;
  }
  const def = info.def;
  const r = rng(s);
  const p = info.A / (info.A + info.D);
  while (u.hp > 0 && def.hp > 0) { if (r() < p) def.hp -= DMG; else u.hp -= DMG; }
  u.moves = Math.max(0, u.moves - 1);
  const won = def.hp <= 0;
  const res = { kind: 'attack', won, info, attacker: u.id, defender: def.id, defOwner: def.owner, defType: def.type, attType: u.type };
  const A = s.civs[u.owner]; const D = s.civs[def.owner];
  if (won) {
    removeUnit(s, def);
    u.hp = Math.max(1, u.hp);
    A.stats.kills++; D.stats.losses++;
    if (r() < 0.35) u.vet = true;
    event(s, def.owner, `Your ${UNITS[def.type].name} was destroyed by a ${A.name} ${UNITS[u.type].name}.`, { kind: 'lost', x, y });
  } else {
    removeUnit(s, u);
    def.hp = Math.max(1, def.hp);
    D.stats.kills++; A.stats.losses++;
    if (r() < 0.35) def.vet = true;
    event(s, def.owner, `Your ${UNITS[def.type].name} beat off a ${A.name} ${UNITS[u.type].name}.`, { kind: 'held', x, y });
  }
  reveal(s, u.owner);
  return res;
}

export function captureCity(s, ct, by) {
  const old = ct.owner;
  const r = rng(s);
  const oldCiv = s.civs[old];
  const loot = Math.min(oldCiv.gold, Math.floor(oldCiv.gold / 3)) + ct.pop * 5;
  oldCiv.gold = Math.max(0, oldCiv.gold - Math.floor(oldCiv.gold / 3));
  s.civs[by].gold += loot;
  ct.owner = by;
  ct.pop = Math.max(1, ct.pop - 1);
  ct.queue = []; ct.prod = 0; ct.food = Math.floor(ct.food / 2);
  ct.blds = ct.blds.filter((b) => b !== 'walls' && r() < 0.6);
  const wasCap = ct.capital;
  ct.capital = false;
  for (const t of s.tiles) if (t.c === ct.id) t.o = by;
  for (const u of s.units.filter((x) => x.x === ct.x && x.y === ct.y && x.owner === old)) { u.owner = by; u.type = isCivilian(u) ? 'worker' : u.type; }
  s.civs[by].stats.captured++; oldCiv.stats.lost++;
  for (const w of ct.wonders) s.wonders[w] = by;
  event(s, old, `${s.civs[by].name} captured ${ct.name}!`, { kind: 'cityLost', x: ct.x, y: ct.y });
  event(s, by, `You captured ${ct.name} and took ${loot} gold.`, { kind: 'cityWon', x: ct.x, y: ct.y });
  if (wasCap) {
    oldCiv.capital = null;
    const next = s.cities.filter((c) => c.owner === old).sort((a, b) => b.pop - a.pop)[0];
    if (next) { next.capital = true; oldCiv.capital = next.id; }
  }
  // Retake your own original capital: it is your capital again.
  if (s.civs[by].origCapital === ct.id) {
    const cur = cityById(s, s.civs[by].capital);
    if (cur) cur.capital = false;
    ct.capital = true; s.civs[by].capital = ct.id;
  }
  checkElimination(s, old);
}

function checkElimination(s, c) {
  const cv = s.civs[c];
  if (!cv.alive) return;
  const hasCity = s.cities.some((ct) => ct.owner === c);
  const hasSettler = s.units.some((u) => u.owner === c && u.type === 'settler');
  // A civ lives while it has a city, or (before its first city) a settler.
  if (hasCity || (hasSettler && !cv.everCity)) return;
  cv.alive = false;
  s.units = s.units.filter((u) => u.owner !== c);
  for (const t of s.tiles) if (t.o === c) { t.o = -1; t.c = -1; }
  for (const k of Object.keys(s.rel)) if (k.split('-').map(Number).includes(c)) { s.rel[k].war = false; s.rel[k].pact = false; }
  event(s, -1, `${cv.name} has been destroyed.`, { kind: 'dead', civ: c });
}

// ---------------------------------------------------------------- workers and other orders

export function jobOptions(s, u) {
  if (u.type !== 'worker') return [];
  const t = tileAt(s, u.x, u.y);
  if (t.o !== u.owner) return [];
  if (cityAt(s, u.x, u.y)) return [];
  return Object.entries(JOBS).filter(([k, j]) => j.ok(t.t, t.f) && t.imp !== k).map(([k]) => k);
}

export function startJob(s, u, kind) {
  if (!jobOptions(s, u).includes(kind) || u.owner !== s.cur) return false;
  u.job = { kind, left: JOBS[kind].turns };
  u.moves = 0; u.goto = null; u.fort = false; u.sleep = false;
  return true;
}

function nearestCity(s, c, x, y, maxD = 3) {
  let best = null; let bd = 99;
  for (const ct of s.cities) if (ct.owner === c) { const d = dist(ct.x, ct.y, x, y); if (d < bd && d <= maxD) { bd = d; best = ct; } }
  return best;
}

function progressJobs(s, c) {
  for (const u of s.units) {
    if (u.owner !== c || !u.job) continue;
    u.job.left--;
    if (u.job.left > 0) continue;
    const t = tileAt(s, u.x, u.y);
    const kind = u.job.kind;
    u.job = null;
    if (kind === 'chop') {
      t.f = null;
      const ct = nearestCity(s, c, u.x, u.y);
      if (ct) { ct.prod += JOBS.chop.chop; event(s, c, `Chopped forest: +${JOBS.chop.chop} production in ${ct.name}.`, { kind: 'job', x: u.x, y: u.y }); }
    } else {
      t.imp = kind;
      event(s, c, `A worker finished a ${JOBS[kind].name}.`, { kind: 'job', x: u.x, y: u.y });
    }
  }
}

export function fortify(s, u) { if (isCivilian(u)) { u.sleep = true; } else { u.fort = true; } u.goto = null; u.job = null; return true; }
export function skip(s, u) { u.skipped = s.turn; return true; }
export function disband(s, u) { removeUnit(s, u); checkElimination(s, u.owner); return true; }

/** Units that still want orders this turn. */
export function idleUnits(s, c) {
  return s.units.filter((u) => u.owner === c && u.moves > 0 && !u.fort && !u.sleep && !u.job && !u.goto && u.skipped !== s.turn);
}

// ---------------------------------------------------------------- diplomacy

export function borderTension(s, a, b) {
  let n = 0;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i].o !== a) continue;
    const x = i % s.w; const y = Math.floor(i / s.w);
    if (DIRS8.some(([dx, dy]) => inMap(s, x + dx, y + dy) && s.tiles[idx(s, x + dx, y + dy)].o === b)) n++;
  }
  return n;
}

export function militaryPower(s, c) {
  return s.units.filter((u) => u.owner === c && !isCivilian(u)).reduce((a, u) => a + UNITS[u.type].str * (u.hp / MAX_HP), 0);
}

/** How civ a feels about civ b, -10..10. */
export function attitude(s, a, b) {
  const A = s.civs[a];
  const d = CIV_BY_ID[A.key];
  let v = (A.mood[b] || 0) - Math.round(d.war * 2);
  const border = borderTension(s, a, b);
  if (border > 0) v -= Math.min(3, 1 + Math.floor(border / 4));
  if (rel(s, a, b)?.pact) v += 2;
  if (atWar(s, a, b)) v -= 3;
  // Common enemies bring civs together.
  for (const o of s.civs) if (o.alive && o.id !== a && o.id !== b && atWar(s, a, o.id) && atWar(s, b, o.id)) v += 2;
  return Math.max(-10, Math.min(10, v));
}

export function attitudeLabel(v) { return v >= 3 ? 'Friendly' : v <= -4 ? 'Hostile' : v <= -1 ? 'Wary' : 'Neutral'; }

/** Would AI civ ai accept peace with other? */
export function acceptsPeace(s, ai, other) {
  if (!canMakePeace(s, ai, other)) return false;
  const mine = militaryPower(s, ai); const theirs = militaryPower(s, other);
  const losing = theirs > mine * 1.2;
  const lost = s.civs[ai].stats.lost;
  const long = s.turn - rel(s, ai, other).since > 25;
  const war = CIV_BY_ID[s.civs[ai].key].war;
  return losing || long || lost > 0 || (attitude(s, ai, other) > -4 && war < 0.6) || mine < 8;
}

export function acceptsPact(s, ai, other) {
  const r = rel(s, ai, other);
  return !!r && !r.war && !r.pact && attitude(s, ai, other) >= -1;
}

export function signPact(s, a, b) {
  const r = rel(s, a, b);
  if (!r || r.war || r.pact) return false;
  r.pact = true;
  s.civs[a].mood[b] = (s.civs[a].mood[b] || 0) + 1;
  s.civs[b].mood[a] = (s.civs[b].mood[a] || 0) + 1;
  event(s, -1, `${s.civs[a].name} and ${s.civs[b].name} signed a trade pact.`, { kind: 'pact', a, b });
  return true;
}

export function cancelPact(s, a, b) { const r = rel(s, a, b); if (!r?.pact) return false; r.pact = false; s.civs[b].mood[a] = (s.civs[b].mood[a] || 0) - 2; return true; }

/** Techs a has that b doesn't (and b could research now or soon). */
export const tradeableTechs = (s, a, b) => s.civs[a].techs.filter((t) => !s.civs[b].techs.includes(t));

/** Would AI civ ai swap its tech `give` for `get` from other? */
export function acceptsSwap(s, ai, other, give, get) {
  if (atWar(s, ai, other)) return false;
  if (!s.civs[ai].techs.includes(give) || s.civs[ai].techs.includes(get)) return false;
  if (!s.civs[other].techs.includes(get) || s.civs[other].techs.includes(give)) return false;
  const att = attitude(s, ai, other);
  if (att <= -4) return false;
  const ratio = TECHS[get].cost / TECHS[give].cost;
  return ratio >= (att >= 3 ? 0.8 : 1.0);
}

export function swapTechs(s, a, b, aGives, bGives) {
  grantTech(s, b, aGives);
  grantTech(s, a, bGives);
  event(s, -1, `${s.civs[a].name} and ${s.civs[b].name} traded technologies.`, { kind: 'trade', a, b });
  return true;
}

export function giftGold(s, a, b, amount) {
  if (s.civs[a].gold < amount || amount <= 0) return false;
  s.civs[a].gold -= amount; s.civs[b].gold += amount;
  s.civs[b].mood[a] = Math.min(6, (s.civs[b].mood[a] || 0) + Math.floor(amount / 25));
  return true;
}

// ---------------------------------------------------------------- turns

/** Things that happen when civ s.cur starts its turn: fresh moves and healing. */
export function startTurn(s) {
  const c = s.cur;
  for (const u of s.units) {
    if (u.owner !== c) continue;
    if (u.rested && u.hp < MAX_HP && !u.job) {
      const t = tileAt(s, u.x, u.y);
      const heal = cityAt(s, u.x, u.y)?.owner === c ? 4 : t.o === c ? 2 : 1;
      u.hp = Math.min(MAX_HP, u.hp + heal);
    }
    u.moves = u.job ? 0 : UNITS[u.type].move;
    u.rested = true;
  }
  reveal(s, c);
}

function finishBuild(s, ct, item) {
  const c = ct.owner;
  if (item.kind === 'unit') {
    const d = UNITS[item.id];
    if (d.pop && ct.pop < 2) return false;
    const spot = [[ct.x, ct.y], ...DIRS8.map(([dx, dy]) => [ct.x + dx, ct.y + dy])].find(([x, y]) => {
      if (!inMap(s, x, y) || !canStand(s, x, y)) return false;
      const here = unitsAt(s, x, y);
      if (here.some((o) => o.owner !== c)) return false;
      if (cityAt(s, x, y) && cityAt(s, x, y).owner !== c) return false;
      return !here.some((o) => isCivilian(o) === !!d.civ);
    });
    if (!spot) return false;
    const u = addUnit(s, c, item.id, spot[0], spot[1], { vet: !d.civ && ct.blds.includes('barracks') });
    u.moves = 0;
    if (d.pop) ct.pop -= 1;
    event(s, c, `${ct.name} trained a ${d.name}.`, { kind: 'built', x: ct.x, y: ct.y, unit: u.id });
    return true;
  }
  if (item.kind === 'bld') {
    ct.blds.push(item.id);
    event(s, c, `${ct.name} built a ${BUILDINGS[item.id].name}.`, { kind: 'built', x: ct.x, y: ct.y });
    return true;
  }
  if (s.wonders[item.id] !== undefined) return true; // someone beat us to it (handled before)
  s.wonders[item.id] = c;
  ct.wonders.push(item.id);
  event(s, -1, `${s.civs[c].name} completed the ${WONDERS[item.id].name} in ${ct.name}!`, { kind: 'wonder', x: ct.x, y: ct.y, wonder: item.id, civ: c });
  if (WONDERS[item.id].victory) { s.over = { winner: c, kind: 'science', turn: s.turn }; event(s, -1, `${s.civs[c].name} launched the Space Ark!`, { kind: 'over' }); }
  return true;
}

function processCities(s, c) {
  for (const ct of s.cities.filter((x) => x.owner === c)) {
    const y = cityYield(s, ct);
    // Food and growth.
    ct.food += y.surplus;
    if (ct.food >= growNeed(ct.pop)) {
      ct.food -= growNeed(ct.pop);
      ct.food += ct.blds.includes('granary') ? Math.floor(growNeed(ct.pop + 1) * 0.25) : 0;
      ct.pop++;
      event(s, c, `${ct.name} grew to size ${ct.pop}.`, { kind: 'grow', x: ct.x, y: ct.y, quiet: true });
    } else if (ct.food < 0) {
      if (ct.pop > 1) { ct.pop--; event(s, c, `${ct.name} is starving and shrank.`, { kind: 'starve', x: ct.x, y: ct.y }); }
      ct.food = 0;
    }
    // Drop wonders someone else finished.
    const lost = ct.queue.filter((q) => q.kind === 'wonder' && s.wonders[q.id] !== undefined && s.wonders[q.id] !== c);
    if (lost.length) {
      ct.queue = ct.queue.filter((q) => !lost.includes(q));
      for (const q of lost) event(s, c, `${ct.name} stopped work on the ${WONDERS[q.id].name}: another civ finished it first.`, { kind: 'idle', x: ct.x, y: ct.y });
    }
    // Production.
    if (!ct.bought) ct.prod += y.prod;
    ct.bought = false;
    let guard = 0;
    while (ct.queue.length && guard++ < 3) {
      const item = ct.queue[0];
      if (!canBuildQueued(s, ct, item)) { ct.queue.shift(); continue; }
      const cost = itemCost(item);
      if (ct.prod < cost) break;
      if (!finishBuild(s, ct, item)) break;
      ct.prod -= cost;
      ct.queue.shift();
      if (s.over) return;
      if (item.kind === 'unit') break; // one unit per turn
    }
    if (!ct.queue.length) {
      ct.prod = Math.min(ct.prod, 60);
      event(s, c, `${ct.name} needs something to build.`, { kind: 'idle', x: ct.x, y: ct.y, city: ct.id });
    }
    growBorders(s, ct, y);
  }
}

function canBuildQueued(s, ct, item) {
  if (item.kind === 'unit') return unitAvailable(s, ct.owner, item.id) || hasTech(s, ct.owner, UNITS[item.id].tech);
  if (item.kind === 'bld') return !ct.blds.includes(item.id);
  return s.wonders[item.id] === undefined;
}

function processResearch(s, c) {
  const cv = s.civs[c];
  const t = civTotals(s, c);
  if (!cv.research) {
    if (cv.goal) setResearch(s, c, cv.goal);
    if (!cv.research) { cv.progress += t.sci; cv.progress = Math.min(cv.progress, 400); return t; }
  }
  cv.progress += t.sci;
  let guard = 0;
  while (cv.research && cv.progress >= techCost(s, cv.research) && guard++ < 3) {
    cv.progress -= techCost(s, cv.research);
    grantTech(s, c, cv.research);
  }
  return t;
}

function processGold(s, c, t) {
  const cv = s.civs[c];
  cv.gold += t.net;
  let guard = 0;
  while (cv.gold < 0 && guard++ < 10) {
    // Broke: disband a unit (the one farthest from home first), then sell a building.
    const mil = s.units.filter((u) => u.owner === c && !isCivilian(u) && !cityAt(s, u.x, u.y));
    const pool = mil.length ? mil : s.units.filter((u) => u.owner === c && u.type !== 'settler');
    if (pool.length && unitUpkeep(s, c) > 0) {
      const u = pool[pool.length - 1];
      removeUnit(s, u);
      cv.gold += 5;
      event(s, c, `Out of gold: a ${UNITS[u.type].name} was disbanded.`, { kind: 'broke' });
      continue;
    }
    const ct = s.cities.find((x) => x.owner === c && x.blds.length);
    if (!ct) { cv.gold = 0; break; }
    const b = ct.blds.pop();
    cv.gold += BUILDINGS[b].cost;
    event(s, c, `Out of gold: the ${BUILDINGS[b].name} in ${ct.name} was sold.`, { kind: 'broke' });
  }
}

/** End the current civ's turn: its cities, research and treasury, then hand over to the next civ. */
export function endTurn(s) {
  if (s.over) return;
  const c = s.cur;
  progressJobs(s, c);
  processCities(s, c);
  if (s.over) return;
  const t = processResearch(s, c);
  processGold(s, c, t);
  // Moods drift back toward zero.
  const cv = s.civs[c];
  for (const k of Object.keys(cv.mood)) { if (cv.mood[k] > 0 && s.turn % 6 === 0) cv.mood[k]--; else if (cv.mood[k] < 0 && s.turn % 10 === 0) cv.mood[k]++; }
  cv.startTurn = false;
  checkElimination(s, c);
  checkVictory(s);
  if (s.over) return;
  // Next living civ.
  let n = s.cur; let wrapped = false;
  for (let k = 0; k < s.civs.length; k++) {
    n = (n + 1) % s.civs.length;
    if (n === 0) wrapped = true;
    if (s.civs[n].alive) break;
  }
  if (wrapped) {
    s.turn++;
    if (s.turn > s.maxTurn) { finishOnScore(s); return; }
  }
  s.cur = n;
  s.civs[n].startTurn = true;
  startTurn(s);
}

export function score(s, c) {
  const cs = s.cities.filter((ct) => ct.owner === c);
  const pop = cs.reduce((a, ct) => a + ct.pop, 0);
  const land = s.tiles.filter((t) => t.o === c).length;
  const wonders = Object.values(s.wonders).filter((o) => o === c).length;
  return Math.round(pop * SCORE.pop + cs.length * SCORE.city + s.civs[c].techs.length * SCORE.tech + wonders * SCORE.wonder + land * SCORE.land);
}

export function scoreBreakdown(s, c) {
  const cs = s.cities.filter((ct) => ct.owner === c);
  return {
    pop: cs.reduce((a, ct) => a + ct.pop, 0), cities: cs.length, techs: s.civs[c].techs.length,
    wonders: Object.values(s.wonders).filter((o) => o === c).length, land: s.tiles.filter((t) => t.o === c).length, total: score(s, c),
  };
}

function finishOnScore(s) {
  s.turn = s.maxTurn;
  let best = -1; let bs = -1;
  for (const cv of s.civs) if (cv.alive) { const v = score(s, cv.id); if (v > bs) { bs = v; best = cv.id; } }
  s.over = { winner: best, kind: 'score', turn: s.turn };
}

/** Conquest: you hold every rival's original capital (or they are gone). */
export function conquestProgress(s, c) {
  const rivals = s.civs.filter((o) => o.id !== c);
  const done = rivals.filter((o) => !o.alive || (o.origCapital != null && cityById(s, o.origCapital)?.owner === c));
  return { done: done.length, of: rivals.length };
}

export function checkVictory(s) {
  if (s.over) return s.over;
  for (const cv of s.civs) {
    if (!cv.alive) continue;
    const p = conquestProgress(s, cv.id);
    if (p.of > 0 && p.done === p.of && s.civs.filter((o) => o.id !== cv.id).every((o) => !o.alive || o.origCapital != null)) {
      s.over = { winner: cv.id, kind: 'conquest', turn: s.turn };
      return s.over;
    }
  }
  const alive = s.civs.filter((x) => x.alive);
  if (alive.length === 1) { s.over = { winner: alive[0].id, kind: 'conquest', turn: s.turn }; return s.over; }
  if (!s.civs.some((x) => x.alive && x.human) && s.civs.some((x) => x.human)) {
    const best = alive.sort((a, b) => score(s, b.id) - score(s, a.id))[0];
    s.over = { winner: best.id, kind: 'defeat', turn: s.turn };
  }
  return s.over;
}

// ---------------------------------------------------------------- saving

export function serialize(s) {
  return JSON.stringify(s, (k, v) => {
    if (k.startsWith('_')) return undefined;
    if (k === 'explored' && Array.isArray(v)) return v.join('');
    return v;
  });
}

export function deserialize(str) {
  const s = JSON.parse(str);
  for (const c of s.civs) if (typeof c.explored === 'string') c.explored = c.explored.split('').map(Number);
  return s;
}
