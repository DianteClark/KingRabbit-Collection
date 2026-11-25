// Shared state helpers: tiles, items, stockpiles, buildings, rooms and temperature, reservations,
// the colony log and notes for the screen. Everything here works on the plain-JSON game object.
import { W, H, N, T, P, Z, TPD, TPH, ITEMS, BUILDS, SEASONS, DAYS_PER_SEASON, STACK_CAP, FOODS, FUEL_MAX, buildValue } from './data.js';
import { idx, tx, ty, inMap, near, N4 } from './map.js';

// ---------------------------------------------------------------- runtime cache (never saved)
const RT = new WeakMap();
export function rt(s) {
  let r = RT.get(s);
  if (!r) {
    r = { dirty: new Set(), all: true, notes: [], rooms: null, heat: null, roomsDirty: true, dmCache: new Map() };
    RT.set(s, r);
  }
  return r;
}
export const markTile = (s, i) => rt(s).dirty.add(i);
export const markAll = (s) => { rt(s).all = true; };
export const roomsChanged = (s) => { const r = rt(s); r.roomsDirty = true; r.passGrid = null; };
/** A note for the screen: { type: 'toast'|'sfx'|'trophy'|'adapt'|'popup', ... }. */
export const note = (s, n) => { const r = rt(s); r.notes.push(n); if (r.notes.length > 60) r.notes.shift(); };

// ---------------------------------------------------------------- time
export const dayOf = (s) => Math.floor(s.t / TPD) + 1; // days since landing, from 1
export const calDay = (s) => dayOf(s) - 1 + (s.day0 || 0); // calendar day from 0
export const seasonIdx = (s) => Math.floor(calDay(s) / DAYS_PER_SEASON) % 4;
export const season = (s) => SEASONS[seasonIdx(s)];
export const yearOf = (s) => Math.floor(calDay(s) / (DAYS_PER_SEASON * 4)) + 1;
export const dayInSeason = (s) => (calDay(s) % DAYS_PER_SEASON) + 1;
// s.t counts from midnight of day 1 (a new game starts at 07:00).
export const hour = (s) => (s.t % TPD) / TPH;
export const isNight = (s) => { const h = hour(s); return h >= 21.5 || h < 5.5; };
export function clock(s) {
  const h = hour(s);
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, '0')}`;
}
export const hash = (n) => { let h = Math.imul(n + 1, 2654435761) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

/** Outdoor temperature in degrees C. */
export function outdoorTemp(s) {
  const d = calDay(s);
  const si = Math.floor(d / DAYS_PER_SEASON) % 4;
  const k = (d % DAYS_PER_SEASON) / DAYS_PER_SEASON;
  const prev = SEASONS[(si + 3) % 4].temp; const cur = SEASONS[si].temp;
  const base = k < 0.3 ? prev + (cur - prev) * (0.7 + k) : cur;
  const swing = -5 * Math.cos(((hour(s) - 3) / 24) * Math.PI * 2);
  const daily = (hash(d * 7 + (s.seed % 997)) - 0.5) * 6;
  return Math.round((base + swing + daily + (s.story?.tempMod || 0)) * 10) / 10;
}

// ---------------------------------------------------------------- tiles and passability
export const bAt = (s, i) => (s.bld[i] ? s.blds[s.bld[i]] : null);
export const isWall = (b) => b && b.done && BUILDS[b.k].block;
export const isDoor = (b) => b && b.done && BUILDS[b.k].door;
export const solidTerrain = (s, i) => s.ter[i] === T.WATER || s.ter[i] === T.ROCK || s.ter[i] === T.ORE;

export function passSettler(s, i) {
  if (solidTerrain(s, i)) return false;
  const b = bAt(s, i);
  return !isWall(b);
}
export function passAnimal(s, i) {
  if (solidTerrain(s, i)) return false;
  const b = bAt(s, i);
  return !isWall(b) && !isDoor(b);
}
/** Walkable-for-settlers grid (1/0), cached until buildings or terrain change. */
export function passGrid(s) {
  const r = rt(s);
  if (r.passGrid) return r.passGrid;
  const g = new Uint8Array(N);
  for (let i = 0; i < N; i++) g[i] = passSettler(s, i) ? 1 : 0;
  r.passGrid = g;
  return g;
}
export function costSettler(s) {
  return (i) => (passSettler(s, i) ? (s.plant[i] === P.TREE || s.plant[i] === P.PINE ? 2 : 1) : Infinity);
}
export function costAnimal(s) {
  return (i) => (passAnimal(s, i) ? (s.plant[i] === P.TREE || s.plant[i] === P.PINE ? 2 : 1) : Infinity);
}
export function costRaider(s) {
  return (i) => {
    if (solidTerrain(s, i)) return Infinity;
    const b = bAt(s, i);
    if (isWall(b) || isDoor(b)) return 4 + b.hp / 15;
    return s.plant[i] === P.TREE || s.plant[i] === P.PINE ? 2 : 1;
  };
}
export const walkable = (s, i) => !solidTerrain(s, i);

// ---------------------------------------------------------------- items
export const itemAt = (s, i) => s.items[i] || null;
export function isStore(s, i) {
  const b = bAt(s, i);
  if (b && b.k === 'storage' && b.done) return true;
  return s.zone[i] === Z.STOCK && !b;
}
export const capAt = (s, i) => { const b = bAt(s, i); return b && b.k === 'storage' ? 80 : STACK_CAP; };
/** Can n of kind k be put on tile i (as a store tile), and how many. */
export function roomFor(s, i, k) {
  if (!isStore(s, i)) return 0;
  const it = s.items[i];
  if (it && it.k !== k) return 0;
  return capAt(s, i) - (it ? it.n : 0);
}
/** Can a loose item lie on this tile? */
function canLie(s, i, k) {
  if (solidTerrain(s, i)) return false;
  const b = bAt(s, i);
  if (b && (BUILDS[b.k].block || BUILDS[b.k].door) && b.done) return false;
  const it = s.items[i];
  if (it && it.k !== k) return false;
  return !it || it.n < Math.max(ITEMS[k].stack, capAt(s, i));
}
export function addAt(s, i, k, n, r = 0) {
  if (n <= 0) return 0;
  const it = s.items[i];
  if (it) {
    if (it.k !== k) return 0;
    it.r = (it.r * it.n + r * n) / (it.n + n);
    it.n += n;
  } else s.items[i] = { k, n, r };
  markTile(s, i);
  return n;
}
/** Drop items on or near tile i (spreading over neighbours when full). Returns what could not be placed. */
export function dropNear(s, i, k, n, r = 0) {
  let left = n;
  const seen = new Set([i]); const q = [i];
  while (q.length && left > 0 && seen.size < 200) {
    const j = q.shift();
    if (canLie(s, j, k)) {
      const it = s.items[j];
      const cap = Math.max(ITEMS[k].stack, isStore(s, j) ? capAt(s, j) : 0);
      const put = Math.min(left, cap - (it ? it.n : 0));
      if (put > 0) { addAt(s, j, k, put, r); left -= put; }
    }
    near(j, (m) => { if (!seen.has(m) && !solidTerrain(s, m)) { seen.add(m); q.push(m); } }, false);
  }
  return left;
}
export function takeAt(s, i, n) {
  const it = s.items[i];
  if (!it) return null;
  const got = Math.min(n, it.n);
  it.n -= got;
  if (it.n <= 0) delete s.items[i];
  markTile(s, i);
  return { k: it.k, n: got, r: it.r };
}
/** Totals of every item on the map. */
export function stock(s) {
  const out = {};
  for (const it of Object.values(s.items)) out[it.k] = (out[it.k] || 0) + it.n;
  return out;
}
export const foodCount = (s) => { const st = stock(s); return FOODS.reduce((a, k) => a + (st[k] || 0), 0); };

// ---------------------------------------------------------------- reservations
export const reserved = (s, key, by) => s.res[key] != null && s.res[key] !== by && aliveId(s, s.res[key]);
export const reserve = (s, key, by) => { s.res[key] = by; };
export const unreserve = (s, key, by) => { if (s.res[key] === by) delete s.res[key]; };
function aliveId(s, id) { return s.mobs.some((m) => m.id === id && !m.dead); }
export function clearReservations(s, by) { for (const k of Object.keys(s.res)) if (s.res[k] === by) delete s.res[k]; }

// ---------------------------------------------------------------- mobs
export const settlers = (s) => s.mobs.filter((m) => m.kind === 'settler' && !m.dead);
export function hostiles(s) {
  const r = rt(s);
  if (r.hT === s.t && r.hN === s.mobs.length && r.hList.every((m) => !m.dead && !m.fleeing && (m.kind === 'raider' || m.hostile))) return r.hList;
  r.hT = s.t; r.hN = s.mobs.length;
  r.hList = s.mobs.filter((m) => !m.dead && (m.kind === 'raider' || (m.kind === 'animal' && m.hostile)) && !m.fleeing);
  return r.hList;
}
export const mobById = (s, id) => s.mobs.find((m) => m.id === id);

// ---------------------------------------------------------------- log
export function log(s, text, kind = 'info', at = null) {
  s.log.push({ t: s.t, text, kind, at });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
  note(s, { type: 'log', text, kind, at });
}

// ---------------------------------------------------------------- buildings
export function canPlace(s, k, i) {
  const def = BUILDS[k];
  if (!def) return { ok: false, reason: 'Unknown building' };
  if (i < 0 || i >= N) return { ok: false, reason: 'Off the map' };
  if (solidTerrain(s, i)) return { ok: false, reason: s.ter[i] === T.WATER ? 'Cannot build on water' : 'Mine the rock first' };
  if (s.bld[i]) return { ok: false, reason: 'Something is already here' };
  if (def.req && !Object.values(s.blds).some((b) => b.k === def.req && b.done)) return { ok: false, reason: `Build a ${BUILDS[def.req].name.toLowerCase()} first` };
  if (k === 'radio' && Object.values(s.blds).some((b) => b.k === 'radio')) return { ok: false, reason: 'You only need one radio' };
  return { ok: true };
}
export function placeBlueprint(s, k, i) {
  const c = canPlace(s, k, i);
  if (!c.ok) return c;
  const id = s.nextId++;
  s.blds[id] = { id, k, i, hp: BUILDS[k].hp, done: false, work: 0, have: {}, fuel: 0 };
  s.bld[i] = id;
  if (s.zone[i] === Z.FARM) { s.zone[i] = Z.NONE; s.crop[i] = -1; }
  delete s.des[i];
  markTile(s, i);
  return { ok: true, id };
}
/** Materials still to bring to a blueprint. */
export function missing(b) {
  const out = {};
  for (const [k, n] of Object.entries(BUILDS[b.k].cost)) { const m = n - (b.have[k] || 0); if (m > 0) out[k] = m; }
  return out;
}
export function completeBuilding(s, b) {
  b.done = true;
  b.hp = BUILDS[b.k].hp;
  const def = BUILDS[b.k];
  if (def.fuel) b.fuel = FUEL_MAX * 0.5;
  if (def.block || def.door) {
    if (s.zone[b.i] === Z.STOCK) s.zone[b.i] = Z.NONE;
    const it = s.items[b.i];
    if (it && def.block) { delete s.items[b.i]; dropNear(s, b.i, it.k, it.n, it.r); }
    if (def.block) for (const m of s.mobs) if (!m.dead && m.at === b.i) nudge(s, m);
    roomsChanged(s);
  }
  if (def.heat) roomsChanged(s);
  if (s.zone[b.i] === Z.STOCK && b.k !== 'storage') s.zone[b.i] = Z.NONE;
  markTile(s, b.i);
  near(b.i, (j) => markTile(s, j));
}
/** Move a creature off a tile that just became solid. */
export function nudge(s, m) {
  const q = [m.at]; const seen = new Set(q);
  while (q.length) {
    const j = q.shift();
    if (passSettler(s, j) && !solidTerrain(s, j)) { m.at = j; m.x = tx(j) + 0.5; m.y = ty(j) + 0.5; m.path = null; return; }
    near(j, (n) => { if (!seen.has(n)) { seen.add(n); q.push(n); } }, false);
  }
}
export function removeBuilding(s, b, refund = 0) {
  if (!b) return;
  const got = b.done ? BUILDS[b.k].cost : b.have;
  for (const [k, n] of Object.entries(got)) { const back = Math.floor(n * (b.done ? refund : 1)); if (back) dropNear(s, b.i, k, back); }
  if (s.bld[b.i] === b.id) s.bld[b.i] = 0;
  delete s.blds[b.id];
  for (const m of s.mobs) if (m.bed === b.id) m.bed = null;
  delete s.res[`b${b.id}`];
  markTile(s, b.i);
  near(b.i, (j) => markTile(s, j));
  roomsChanged(s);
}
export const builtOf = (s, k) => Object.values(s.blds).filter((b) => b.k === k && b.done);

// ---------------------------------------------------------------- rooms and warmth
/** Recompute rooms: rt.rooms[i] = room number (>0) or 0 for outdoors; rt.heat[i] = degrees added. */
export function rooms(s) {
  const r = rt(s);
  if (!r.roomsDirty && r.rooms) return r;
  r.roomsDirty = false;
  const room = new Int32Array(N);
  const boundary = (i) => { const b = bAt(s, i); return solidTerrain(s, i) || isWall(b) || isDoor(b); };
  let next = 1;
  const info = [null];
  for (let i = 0; i < N; i++) {
    if (room[i] || boundary(i)) continue;
    const id = next++;
    const tiles = [i]; room[i] = id;
    let open = false;
    for (let q = 0; q < tiles.length; q++) {
      const j = tiles[q];
      const x = tx(j); const y = ty(j);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) open = true;
      for (const [dx, dy] of N4) {
        const nx = x + dx; const ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const k = idx(nx, ny);
        if (!room[k] && !boundary(k)) { room[k] = id; tiles.push(k); }
      }
    }
    info.push({ id, size: tiles.length, open: open || tiles.length > 160 });
  }
  // Outdoor regions become 0.
  for (let i = 0; i < N; i++) if (room[i] && info[room[i]].open) room[i] = 0;
  // Heat: lit fires warm their room, or tiles within 3 steps when outdoors.
  const heat = new Float32Array(N);
  const heated = new Set();
  for (const b of Object.values(s.blds)) {
    if (!b.done || !BUILDS[b.k].heat || b.fuel <= 0) continue;
    const rm = room[b.i];
    if (rm) heated.add(rm);
    else {
      const rad = BUILDS[b.k].heat;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const x = tx(b.i) + dx; const y = ty(b.i) + dy;
          if (!inMap(x, y) || Math.hypot(dx, dy) > rad + 0.5) continue;
          const j = idx(x, y);
          if (!room[j]) heat[j] = Math.max(heat[j], Math.hypot(dx, dy) <= 2 ? 16 : 11);
        }
      }
    }
  }
  r.rooms = room; r.heat = heat; r.heated = heated; r.roomInfo = info;
  return r;
}
export const isIndoors = (s, i) => rooms(s).rooms[i] > 0;
export function tileTemp(s, i, out = outdoorTemp(s)) {
  const r = rooms(s);
  const rm = r.rooms[i];
  if (rm) return r.heated.has(rm) ? Math.max(out + 8, 19) : Math.min(out + 8, Math.max(out, 22));
  // Walls (or the tile itself) in a room: use the outdoor value plus any fire nearby.
  return out + r.heat[i];
}

// ---------------------------------------------------------------- value
export function wealth(s) {
  let v = 0;
  for (const it of Object.values(s.items)) v += ITEMS[it.k].value * it.n;
  for (const b of Object.values(s.blds)) if (b.done) v += buildValue(b.k);
  for (const m of settlers(s)) for (const g of Object.values(m.gear || {})) if (g) v += ITEMS[g].value;
  return Math.round(v);
}

export { idx, tx, ty, near, inMap, N4 };
