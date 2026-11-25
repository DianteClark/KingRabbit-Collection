// Hearth Valley rules: the whole farm life as plain functions on a JSON state (no Phaser).
// The World scene, the tests and the year-one bot all drive the game through these.
import * as D from './data.js';
import { MAPS, exitFrom, SOLID_TILES, tileAt, buildingAt, doorOf, FARM_HOME, MINE_EXIT, mineFloor, ROCK_HP, SLIME, MINE_FLOORS, CHECKPOINTS } from './maps.js';
import { LETTERS, FESTIVAL_LETTER, BIRTHDAY_LETTER, CHAT, SEASON_CHAT, HEART_EVENTS, GIFT_REPLY } from './story.js';

const { ITEMS, CROPS, VILLAGERS, BUNDLES } = D;
export { MAPS };

// ---------------------------------------------------------------- random

export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function seeded(seed) {
  const o = { rng: seed >>> 0 };
  return () => rand(o);
}
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];

// ---------------------------------------------------------------- trophies (drained by the scene)
export const awards = [];
function earn(s, id) {
  s.trophies ||= {};
  if (s.trophies[id]) return;
  s.trophies[id] = true;
  awards.push(id);
}

// ---------------------------------------------------------------- new game

export function newGame(seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
  const s = {
    v: 1, seed, rng: seed >>> 0,
    year: 1, season: 0, day: 1, time: D.DAY_START,
    energy: D.MAX_ENERGY, hp: D.MAX_HP, gold: 500, earned: 0,
    map: 'farm', x: FARM_HOME.x, y: FARM_HOME.y, face: 'down',
    tools: { hoe: 0, can: 0, axe: 0, pick: 0, sword: 0, rod: 0 },
    water: D.CAN_SIZE[0],
    inv: { seed_radish: 15 },
    hand: ['seed_radish', null],
    slot: 0,
    soil: {},
    objs: { farm: {}, town: {}, woods: {} },
    animals: [], troughs: { coop: 0, barn: 0 }, nextAnimal: 0,
    friends: Object.fromEntries(D.VILLAGER_ORDER.map((id) => [id, { pts: 0, talk: -1, gift: -1, ev: 0 }])),
    mail: [{ id: 'welcome', read: false }],
    bundles: {}, bundlesDone: [], hallRestored: false, hallDay: null,
    bin: {}, recipes: [...D.START_RECIPES],
    weather: 'sun', tomorrow: 'sun',
    mineDeepest: 0, mine: null,
    stats: { harvested: 0, fish: {}, fishCaught: 0, shippedDays: 0, passOuts: 0, festivalsWon: 0, forage: 0, products: 0, slimes: 0 },
    tut: 0, tutCount: 0,
    fest: {}, flags: {},
    trophies: {},
    yearReview: null,
  };
  seedFarm(s);
  seedWild(s, 'woods', true);
  spawnForage(s, true);
  return s;
}

const key = (x, y) => `${x},${y}`;
const unkey = (k) => k.split(',').map(Number);

function seedFarm(s) {
  const m = MAPS.farm;
  const [ax, ay, aw, ah] = m.till;
  const objs = s.objs.farm;
  for (let y = ay; y < ay + ah; y++) {
    for (let x = ax; x < ax + aw; x++) {
      if (!isOpenGround(s, 'farm', x, y)) continue;
      // leave a clear patch right in front of the house for the first crops
      if (x >= 2 && x <= 9 && y >= 8 && y <= 11) continue;
      const r = rand(s);
      if (r < 0.07) objs[key(x, y)] = { k: 'weed' };
      else if (r < 0.12) objs[key(x, y)] = { k: 'rock', hp: 1 };
      else if (r < 0.17) objs[key(x, y)] = { k: 'twig', hp: 1 };
      else if (r < 0.2) objs[key(x, y)] = { k: 'tall' };
      else if (r < 0.215) objs[key(x, y)] = { k: 'stump', hp: 4 };
      else if (r < 0.225) objs[key(x, y)] = { k: 'bush', hp: 4 };
    }
  }
  // tall grass patch by the pen, for hay
  for (const [x, y] of [[14, 19], [15, 19], [14, 20], [15, 21], [14, 25], [15, 26], [14, 26], [12, 26]]) if (isOpenGround(s, 'farm', x, y)) objs[key(x, y)] = { k: 'tall' };
}

function seedWild(s, mapId, first) {
  const m = MAPS[mapId];
  const objs = s.objs[mapId];
  const count = (k) => Object.values(objs).filter((o) => o.k === k).length;
  const want = { bush: 14, rock: 8, twig: 6, weed: 6 };
  for (const [k, n] of Object.entries(want)) {
    let tries = 0;
    let have = count(k);
    const max = first ? n : Math.min(n, have + 2);
    while (have < max && tries++ < 200) {
      const x = 1 + Math.floor(rand(s) * (m.tiles[0].length - 2));
      const y = 3 + Math.floor(rand(s) * (m.tiles.length - 4));
      if (!isOpenGround(s, mapId, x, y) || tileAt(m, x, y) === '=' || nearTrail(mapId, x, y)) continue;
      objs[key(x, y)] = { k, hp: k === 'bush' ? 4 : 1 };
      have++;
    }
  }
}
const nearTrail = (mapId, x, y) => mapId === 'woods' && (x >= 9 && x <= 12);

// ---------------------------------------------------------------- calendar

export const dayIndex = (s) => (s.year - 1) * 4 * D.SEASON_DAYS + s.season * D.SEASON_DAYS + (s.day - 1);
export const weekday = (s) => dayIndex(s) % 7;
export const absMin = (s) => dayIndex(s) * 1440 + s.time;
export function clockText(t) {
  const h24 = Math.floor(t / 60) % 24; const m = t % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`;
}
export const dateText = (s) => `${D.SEASONS[s.season]} ${s.day}, ${D.WEEKDAYS[weekday(s)]}`;
export const festivalOn = (season, day) => D.FESTIVALS.find((f) => f.season === season && f.day === day) || null;
export const festivalToday = (s) => festivalOn(s.season, s.day);
export function festivalOpen(s) {
  const f = festivalToday(s);
  if (!f || s.fest[`${s.year}-${f.id}`]) return null;
  return s.time >= D.FESTIVAL_HOURS[0] && s.time < D.FESTIVAL_HOURS[1] ? f : null;
}

/** Let game minutes pass. Returns { midnight, passOut, done: [machine outputs ready] }. */
export function passTime(s, mins) {
  const before = s.time;
  s.time = Math.min(D.DAY_END, s.time + mins);
  return { midnight: before < D.MIDNIGHT && s.time >= D.MIDNIGHT, passOut: s.time >= D.DAY_END };
}

// ---------------------------------------------------------------- inventory

export const has = (s, id, n = 1) => (s.inv[id] || 0) >= n;
export function give(s, id, n = 1) {
  if (n <= 0) return;
  s.inv[id] = (s.inv[id] || 0) + n;
  if (s.hand.indexOf(id) < 0 && isHandy(id) && s.hand.some((h) => !h)) s.hand[s.hand.indexOf(null)] = id;
}
export function take(s, id, n = 1) {
  if (!has(s, id, n)) return false;
  s.inv[id] -= n;
  if (s.inv[id] <= 0) {
    delete s.inv[id];
    const i = s.hand.indexOf(id);
    if (i >= 0) s.hand[i] = null;
  }
  return true;
}
/** Things worth keeping in a hand slot (seeds, placeables, food). */
export const isHandy = (id) => ['seed', 'place', 'fertilizer', 'food', 'stair'].includes(ITEMS[id]?.kind);
export const edible = (id) => !!ITEMS[id]?.energy;

export function setHand(s, i, id) {
  if (id && !has(s, id)) return false;
  const other = s.hand.indexOf(id);
  if (other >= 0 && other !== i) s.hand[other] = s.hand[i];
  s.hand[i] = id;
  return true;
}

/** The thing in the selected slot: { tool } or { item } (slots 0-5 tools, 6-7 hands). */
export function selected(s) {
  if (s.slot < D.TOOLS.length) return { tool: D.TOOLS[s.slot] };
  const id = s.hand[s.slot - D.TOOLS.length];
  return id && has(s, id) ? { item: id } : {};
}

// ---------------------------------------------------------------- map queries

export const mapOf = (s, id = s.map) => (id === 'mine' ? s.mine : MAPS[id]);
export function inBounds(map, x, y) { return y >= 0 && y < map.tiles.length && x >= 0 && x < map.tiles[0].length; }
export function fixtureAt(mapId, x, y) {
  const m = MAPS[mapId];
  return m ? (m.fixtures || []).find((f) => f.x === x && f.y === y) || null : null;
}
export const objAt = (s, mapId, x, y) => (mapId === 'mine' ? null : s.objs[mapId]?.[key(x, y)] || null);
export const soilAt = (s, mapId, x, y) => (mapId === 'farm' ? s.soil[key(x, y)] || null : null);

// Tiles kept clear of spawned rocks, trees and forage: where villagers stand and in front of doors.
const RESERVED = new Set();
for (const v of Object.values(VILLAGERS)) for (const [, map, x, y] of v.spots) if (map) RESERVED.add(`${map}:${x},${y}`);
for (const [map, x, y] of [['woods', 10, 3], ['woods', 7, 12], ['woods', 13, 14], ['town', 12, 11], ['town', 15, 18], ['town', 8, 18], ['farm', 4, 6]]) RESERVED.add(`${map}:${x},${y}`);
for (const [mapId, m] of Object.entries(MAPS)) for (const b of m.buildings) { const d = doorOf(b); RESERVED.add(`${mapId}:${d.x},${d.y + 1}`); }

/** Plain ground with nothing on it (used for spawning things). */
function isOpenGround(s, mapId, x, y) {
  const m = MAPS[mapId];
  if (!inBounds(m, x, y)) return false;
  if (RESERVED.has(`${mapId}:${x},${y}`)) return false;
  const t = tileAt(m, x, y);
  if (t !== '.' && t !== ',' && t !== '=') return false;
  if (buildingAt(m, x, y) || fixtureAt(mapId, x, y) || objAt(s, mapId, x, y) || soilAt(s, mapId, x, y)) return false;
  if (mapId === 'farm' && inPen(x, y)) return false;
  return true;
}
function inPen(x, y) {
  return Object.values(MAPS.farm.pens).some(([px, py, pw, ph]) => x >= px && x < px + pw && y >= py && y < py + ph);
}

/** Can the farmer stand here? (people and animals are checked by the scene) */
export function walkable(s, x, y, mapId = s.map) {
  if (mapId === 'mine') {
    const m = s.mine;
    if (!m || !inBounds(m, x, y)) return false;
    if (m.tiles[y][x] === 'X') return false;
    if (m.rocks.some((r) => r.x === x && r.y === y)) return false;
    if (m.chest && m.chest.x === x && m.chest.y === y) return false;
    return true;
  }
  const m = MAPS[mapId];
  if (!inBounds(m, x, y)) return false;
  if (SOLID_TILES.has(tileAt(m, x, y))) return false;
  if (buildingAt(m, x, y) || fixtureAt(mapId, x, y)) return false;
  const o = objAt(s, mapId, x, y);
  if (o) return false;
  return true;
}

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function facing(s) { const [dx, dy] = DIRS[s.face]; return { x: s.x + dx, y: s.y + dy }; }
export function dirTo(x0, y0, x1, y1) {
  const dx = x1 - x0; const dy = y1 - y0;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Move one tile. Returns { moved, exit } where exit is a map change. */
export function step(s, dir, blocked = () => false) {
  s.face = dir;
  const [dx, dy] = DIRS[dir];
  const nx = s.x + dx; const ny = s.y + dy;
  const m = mapOf(s);
  if (s.map !== 'mine' && !inBounds(m, nx, ny)) {
    const ex = exitFrom(s.map, nx, ny);
    if (ex) { goTo(s, ex.map, ex.x, ex.y, ex.face); return { moved: true, exit: ex }; }
    return { moved: false };
  }
  if (!walkable(s, nx, ny) || blocked(nx, ny)) return { moved: false };
  s.x = nx; s.y = ny;
  return { moved: true };
}

export function goTo(s, map, x, y, face = s.face) {
  if (s.map === 'mine' && map !== 'mine') s.mine = null;
  s.map = map; s.x = x; s.y = y; s.face = face;
  if (map === 'town' && s.tut === 4) advanceTut(s, 4);
}

/** Shortest walk to (tx, ty) or next to it (adjacent). Returns [[x,y],...] or null. */
export function findPath(s, tx, ty, { adjacent = false, blocked = () => false } = {}) {
  const m = mapOf(s);
  if (!m) return null;
  const W = m.tiles[0].length; const H = m.tiles.length;
  const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  if (goal(s.x, s.y)) return [];
  const prev = new Map();
  const start = key(s.x, s.y);
  prev.set(start, null);
  const q = [[s.x, s.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!walkable(s, nx, ny) || blocked(nx, ny)) continue;
      prev.set(k, key(x, y));
      if (goal(nx, ny)) {
        const out = [];
        let c = k;
        while (c && c !== start) { out.unshift(unkey(c)); c = prev.get(c); }
        return out;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

// ---------------------------------------------------------------- tutorial

export const TUTORIAL = [
  { text: 'Check the mailbox by your house', target: { map: 'farm', x: 7, y: 5 } },
  { text: 'Pick the Hoe and till 3 grass tiles', n: 3 },
  { text: 'Pick the Radish Seeds and plant 3', n: 3 },
  { text: 'Pick the Watering Can and water them', n: 3 },
  { text: 'Walk east along the road to town', target: { map: 'farm', x: 23, y: 7 } },
  { text: 'Read the notice board by the hall', target: { map: 'town', x: 14, y: 5 } },
  { text: 'Sleep in your house to end the day', target: { map: 'farm', x: 4, y: 5 } },
];
export function tutorial(s) {
  if (s.tut >= TUTORIAL.length) return null;
  const t = TUTORIAL[s.tut];
  return { ...t, text: t.n ? `${t.text} (${s.tutCount}/${t.n})` : t.text, step: s.tut };
}
function advanceTut(s, step, n = 1) {
  if (s.tut !== step) return;
  const t = TUTORIAL[step];
  if (t.n) { s.tutCount += n; if (s.tutCount < t.n) return; }
  s.tut++; s.tutCount = 0;
}

// ---------------------------------------------------------------- tools

/** The tiles a hoe or watering can swing covers at this upgrade level. */
export function toolArea(s, tool, tx, ty) {
  const lv = s.tools[tool] || 0;
  if ((tool !== 'hoe' && tool !== 'can') || lv === 0) return [[tx, ty]];
  let [dx, dy] = [tx - s.x, ty - s.y];
  if (Math.abs(dx) + Math.abs(dy) !== 1) [dx, dy] = DIRS[s.face];
  const out = [];
  if (lv === 1) for (let k = 0; k < 3; k++) out.push([tx + dx * k, ty + dy * k]);
  else for (let k = 0; k < 3; k++) for (let m = -1; m <= 1; m++) out.push([tx + dx * k + dy * m, ty + dy * k + dx * m]);
  return out;
}

function tillable(s, x, y) {
  if (s.map !== 'farm') return false;
  const m = MAPS.farm;
  const t = tileAt(m, x, y);
  if (t !== '.' && t !== ',') return false;
  if (buildingAt(m, x, y) || fixtureAt('farm', x, y) || objAt(s, 'farm', x, y) || soilAt(s, 'farm', x, y)) return false;
  return !inPen(x, y);
}

const spend = (s, n) => { s.energy = Math.max(0, s.energy - n); };

/**
 * Use a tool on a tile. Returns { ok, msg?, fx?, got?: [[id, n]], fish?: where }.
 * fx tells the scene which little effect to show.
 */
export function useTool(s, tool, x, y) {
  const info = D.TOOL_INFO[tool];
  const lv = s.tools[tool] || 0;
  const cost = info.energy;
  if (cost && s.energy < cost) return { ok: false, msg: 'Too tired! Eat something or go to bed.' };
  const m = mapOf(s);
  if (!m || !inBounds(m, x, y)) return { ok: false };
  const o = objAt(s, s.map, x, y);
  const t = s.map === 'mine' ? m.tiles[y][x] : tileAt(m, x, y);
  const dead = soilAt(s, s.map, x, y);
  if (dead?.crop?.dead && tool !== 'can' && tool !== 'rod') { dead.crop = null; return { ok: true, fx: 'cut' }; }

  if (tool === 'can') {
    if (t === '~') {
      s.water = D.CAN_SIZE[lv];
      return { ok: true, fx: 'refill', msg: 'Watering can filled.' };
    }
    if (s.map !== 'farm') return { ok: false, msg: 'Nothing to water here.' };
    if (s.water <= 0) return { ok: false, msg: 'The can is empty. Fill it at the pond.' };
    let n = 0;
    for (const [ax, ay] of toolArea(s, tool, x, y)) {
      const so = soilAt(s, 'farm', ax, ay);
      if (so && !so.wet && s.water > 0) { so.wet = true; s.water--; n++; if (so.crop) advanceTut(s, 3); }
    }
    if (!n) return { ok: false, msg: soilAt(s, 'farm', x, y) ? 'Already watered.' : 'Water the tilled soil.' };
    spend(s, cost);
    return { ok: true, fx: 'water', n };
  }

  if (tool === 'hoe') {
    if (s.map !== 'farm') return { ok: false, msg: 'You can only till soil on your farm.' };
    let n = 0;
    for (const [ax, ay] of toolArea(s, tool, x, y)) {
      if (!tillable(s, ax, ay)) continue;
      s.soil[key(ax, ay)] = { wet: s.weather === 'rain' || s.weather === 'storm', crop: null };
      n++;
    }
    if (!n) {
      if (o) return { ok: false, msg: `Clear the ${objName(o)} first.` };
      return { ok: false, msg: soilAt(s, 'farm', x, y) ? 'This soil is already tilled.' : 'You can\'t till here.' };
    }
    spend(s, cost);
    advanceTut(s, 1, n);
    return { ok: true, fx: 'till', n };
  }

  if (tool === 'axe' || tool === 'pick' || tool === 'sword') {
    if (s.map === 'mine') return { ok: false };
    if (o && PLACEABLE.has(o.k) && tool === 'pick') {
      if (o.job) return { ok: false, msg: 'It\'s busy. Wait until it\'s done.' };
      delete s.objs[s.map][key(x, y)];
      give(s, o.k, 1);
      spend(s, cost);
      return { ok: true, fx: 'pickup', got: [[o.k, 1]] };
    }
    if (!o) {
      const so = soilAt(s, s.map, x, y);
      if (tool === 'pick' && so && !so.crop) { delete s.soil[key(x, y)]; spend(s, cost); return { ok: true, fx: 'smash' }; }
      if (tool === 'sword' && so?.crop?.dead) { so.crop = null; return { ok: true, fx: 'cut' }; }
      return { ok: false, msg: so?.crop ? 'Harvest crops when they are ready.' : '' };
    }
    const need = { rock: 'pick', twig: 'axe', stump: 'axe', bush: 'axe', weed: 'sword', tall: 'sword', forage: null }[o.k];
    if (o.k === 'forage') return pickForage(s, x, y);
    if (o.k === 'weed' && tool !== 'sword') {
      // any tool clears weeds
    } else if (need !== tool) {
      return { ok: false, msg: `Use the ${D.TOOL_INFO[need].name} on the ${objName(o)}.` };
    }
    spend(s, cost);
    const power = 1 + lv;
    if (o.hp && o.hp > power) { o.hp -= power; return { ok: true, fx: tool === 'pick' ? 'hitRock' : 'chop', hit: true }; }
    delete s.objs[s.map][key(x, y)];
    const got = [];
    if (o.k === 'rock') got.push(['stone', 1 + (rand(s) < 0.5 ? 1 : 0)]);
    if (o.k === 'twig') got.push(['wood', 1 + (rand(s) < 0.5 ? 1 : 0)]);
    if (o.k === 'stump') got.push(['wood', 4]);
    if (o.k === 'bush') { got.push(['wood', 4 + Math.floor(rand(s) * 3)]); if (s.season === 2 && rand(s) < 0.3) got.push(['hazelnut', 1]); }
    if (o.k === 'weed') { got.push(['fiber', 1 + (rand(s) < 0.4 ? 1 : 0)]); }
    if (o.k === 'tall') got.push(['hay', 1]);
    for (const [id, n] of got) give(s, id, n);
    return { ok: true, fx: o.k === 'rock' ? 'smash' : o.k === 'weed' || o.k === 'tall' ? 'cut' : 'chop', got };
  }

  if (tool === 'rod') {
    if (t !== '~') return { ok: false, msg: 'Face the water and cast.' };
    spend(s, cost);
    const where = s.map === 'farm' ? 'pond' : MAPS[s.map]?.fishing || 'pond';
    return { ok: true, fish: where };
  }
  return { ok: false };
}

export const PLACEABLE = new Set(['sprinkler', 'qsprinkler', 'furnace', 'mayojar', 'press']);
export function objName(o) {
  return { rock: 'rock', twig: 'branch', stump: 'stump', bush: 'tree', weed: 'weeds', tall: 'tall grass', forage: ITEMS[o.item]?.name || 'plant' }[o.k] || ITEMS[o.k]?.name || o.k;
}

// ---------------------------------------------------------------- items in hand

/** Use the held item on a tile (plant, fertilize, place, eat). */
export function useItem(s, id, x, y) {
  const it = ITEMS[id];
  if (!it || !has(s, id)) return { ok: false };
  const so = soilAt(s, s.map, x, y);
  if (it.kind === 'seed') {
    if (!so) return { ok: false, msg: s.map === 'farm' ? 'Till the soil with the Hoe first.' : 'Plant seeds on your farm.' };
    if (so.crop) return { ok: false, msg: so.crop.dead ? 'Clear the dead plant with a tool first.' : 'Something is already growing here.' };
    const c = CROPS[it.crop];
    if (!c.seasons.includes(s.season)) return { ok: false, msg: `${c.name} only grows in ${c.seasons.map((q) => D.SEASONS[q]).join(' and ')}.` };
    take(s, id);
    so.crop = { id: it.crop, age: 0 };
    advanceTut(s, 2);
    return { ok: true, fx: 'plant' };
  }
  if (it.kind === 'fertilizer') {
    if (!so) return { ok: false, msg: 'Spread compost on tilled soil.' };
    if (so.compost) return { ok: false, msg: 'This soil already has compost.' };
    if (so.crop && so.crop.age > 0) return { ok: false, msg: 'Add compost before planting.' };
    take(s, id); so.compost = true;
    return { ok: true, fx: 'plant' };
  }
  if (it.kind === 'place') {
    if (s.map !== 'farm') return { ok: false, msg: 'Place it on your farm.' };
    if (so || !isOpenGround(s, 'farm', x, y) || (x === s.x && y === s.y)) return { ok: false, msg: 'Place it on clear ground.' };
    take(s, id);
    s.objs.farm[key(x, y)] = { k: id };
    return { ok: true, fx: 'place' };
  }
  if (it.kind === 'food' || it.energy) return { ok: false, eat: true };
  return { ok: false, msg: `You can't use ${it.name} here.` };
}

export function eat(s, id) {
  const it = ITEMS[id];
  if (!it?.energy || !take(s, id)) return false;
  s.energy = Math.min(D.MAX_ENERGY, s.energy + it.energy);
  s.hp = Math.min(D.MAX_HP, s.hp + Math.ceil(it.energy / 2));
  return true;
}

// ---------------------------------------------------------------- crops

export function cropStage(c) {
  const def = CROPS[c.id];
  if (c.dead) return 'dead';
  if (c.age >= def.days) return 'ready';
  const f = c.age / def.days;
  if (c.regrown) return 'grown';
  if (f === 0) return 'seed';
  if (f < 0.34) return 'sprout';
  if (f < 0.67) return 'young';
  return def.tall ? 'tall' : 'grown';
}

export function harvest(s, x, y) {
  const so = soilAt(s, s.map, x, y);
  if (!so?.crop || cropStage(so.crop) !== 'ready') return null;
  const id = so.crop.id;
  const def = CROPS[id];
  const n = def.yield + (def.yield === 1 && rand(s) < 0.1 ? 1 : 0);
  give(s, id, n);
  s.stats.harvested += n;
  earn(s, 'first-harvest');
  if (def.regrow) { so.crop.age = def.days - def.regrow; so.crop.regrown = true; } else so.crop = null;
  return { id, n };
}

function pickForage(s, x, y) {
  const o = objAt(s, s.map, x, y);
  if (!o || o.k !== 'forage') return { ok: false };
  delete s.objs[s.map][key(x, y)];
  give(s, o.item, 1);
  s.stats.forage++;
  return { ok: true, fx: 'pick', got: [[o.item, 1]] };
}

// ---------------------------------------------------------------- what's on a tile (A button / tap)

/**
 * What tapping or pressing A on this tile does before any tool:
 * door, bin, mail, board, trough, machine, harvest, forage, cave, animal, npc (people and animals
 * are passed in by the scene since they move). Returns null when the selected tool should be used.
 */
export function interactable(s, x, y, { npc, animal } = {}) {
  if (npc) return { t: 'npc', id: npc };
  if (animal) return { t: 'animal', a: animal };
  if (s.map === 'mine') {
    const m = s.mine;
    if (m.ladderOpen && m.ladder.x === x && m.ladder.y === y) return { t: 'down' };
    if (m.up.x === x && m.up.y === y) return { t: 'up' };
    if (m.chest && m.chest.x === x && m.chest.y === y) return { t: 'chest' };
    return null;
  }
  const m = MAPS[s.map];
  const b = buildingAt(m, x, y);
  if (b) return { t: 'door', b };
  const f = fixtureAt(s.map, x, y);
  if (f) {
    if (f.id === 'mailbox') return { t: 'mail' };
    if (f.id === 'bin') return { t: 'bin' };
    if (f.id === 'board') return { t: 'board' };
    if (f.id === 'cave') return { t: 'cave' };
    if (f.id.startsWith('trough')) return { t: 'trough', home: f.home };
  }
  const o = objAt(s, s.map, x, y);
  if (o?.k === 'forage') return { t: 'forage' };
  if (o && D.MACHINES[o.k]) return { t: 'machine', k: key(x, y) };
  const so = soilAt(s, s.map, x, y);
  if (so?.crop && cropStage(so.crop) === 'ready') return { t: 'harvest' };
  return null;
}

export const forage = pickForage;

/** The board was read (tutorial step). */
export function boardSeen(s) { if (s.tut === 5) advanceTut(s, 5); }

// ---------------------------------------------------------------- machines

export function machineInfo(s, k) {
  const o = s.objs.farm[k];
  if (!o) return null;
  const def = D.MACHINES[o.k];
  const ready = o.job && absMin(s) >= o.job.ready;
  return { o, def, ready, busy: !!o.job && !ready, left: o.job ? Math.max(0, o.job.ready - absMin(s)) : 0 };
}
/** Collect finished goods, or start a job with what's in the bag. Returns { got } | { started } | { msg }. */
export function useMachine(s, k) {
  const mi = machineInfo(s, k);
  if (!mi) return { msg: '' };
  if (mi.ready) {
    give(s, mi.o.job.out, 1);
    const got = mi.o.job.out;
    delete mi.o.job;
    if (got === 'ironbar' && !s.flags.sprinklerMail) { s.flags.sprinklerMail = true; queueMail(s, 'sprinkler'); }
    if (got === 'goldbar' && !s.flags.qsprinklerMail) { s.flags.qsprinklerMail = true; queueMail(s, 'qsprinkler'); }
    return { got };
  }
  if (mi.busy) return { msg: `${mi.def.name}: ready in ${Math.ceil(mi.left / 60 * 10) / 10} hours.` };
  const job = mi.def.jobs.find((j) => has(s, j.in, j.n));
  if (!job) return { msg: `${mi.def.name} needs ${mi.def.jobs.map((j) => `${j.n} ${ITEMS[j.in].name}`).join(' or ')}.` };
  take(s, job.in, job.n);
  mi.o.job = { out: job.out, ready: absMin(s) + job.mins };
  return { started: job };
}

// ---------------------------------------------------------------- shipping, shops, crafting

export const sellable = (id) => ITEMS[id]?.price > 0 && !['seed', 'place', 'stair', 'tackle', 'fertilizer'].includes(ITEMS[id].kind);
export function ship(s, id, n = s.inv[id] || 0) {
  if (!sellable(id) || !n || !take(s, id, n)) return false;
  s.bin[id] = (s.bin[id] || 0) + n;
  return true;
}
export function unship(s, id) {
  const n = s.bin[id] || 0;
  if (!n) return false;
  delete s.bin[id];
  give(s, id, n);
  return true;
}
export const binValue = (s) => Object.entries(s.bin).reduce((a, [id, n]) => a + ITEMS[id].price * n, 0);

export function shopOpen(s, id) {
  const sh = D.SHOPS[id];
  if (weekday(s) === sh.closed) return { open: false, why: `${sh.name} is closed on ${['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][sh.closed]}.` };
  if (s.time < sh.open[0] || s.time >= sh.open[1]) return { open: false, why: `${sh.name} is open ${clockText(sh.open[0])} to ${clockText(sh.open[1])}.` };
  return { open: true };
}

export function buy(s, shopId, id, n = 1) {
  const line = D.SHOPS[shopId].stock(s).find((l) => l.id === id);
  if (!line) return false;
  const cost = line.price * n;
  if (s.gold < cost) return false;
  s.gold -= cost;
  give(s, id, n);
  return true;
}

export function upgradeInfo(s, tool) {
  const lv = s.tools[tool];
  const next = D.UPGRADE_COST[lv + 1];
  if (!next) return { max: true };
  const can = s.gold >= next.gold && has(s, next.bar, next.n);
  return { level: lv + 1, ...next, can };
}
export function upgrade(s, tool) {
  const u = upgradeInfo(s, tool);
  if (u.max || !u.can) return false;
  s.gold -= u.gold; take(s, u.bar, u.n);
  s.tools[tool]++;
  if (tool === 'can') s.water = D.CAN_SIZE[s.tools.can];
  return true;
}

export function animalCount(s, kind) { return s.animals.filter((a) => a.kind === kind).length; }
export function buyAnimal(s, kind) {
  const def = D.ANIMALS[kind];
  if (s.gold < def.price || animalCount(s, kind) >= def.cap) return null;
  s.gold -= def.price;
  const [px, py, pw, ph] = MAPS.farm.pens[def.home];
  const i = s.nextAnimal++;
  let spot = [px, py];
  for (let k = 0; k < pw * ph; k++) {
    const x = px + ((i + k) % pw); const y = py + Math.floor((i + k) / pw) % ph;
    if (walkable(s, x, y, 'farm') && !s.animals.some((b) => b.x === x && b.y === y)) { spot = [x, y]; break; }
  }
  const a = { id: i, kind, name: D.ANIMAL_NAMES[i % D.ANIMAL_NAMES.length], mood: 60, fed: false, petted: false, product: null, x: spot[0], y: spot[1], brown: rand(s) < 0.5 };
  s.animals.push(a);
  if (kind === 'chicken' && !s.flags.mayoMail) { s.flags.mayoMail = true; queueMail(s, 'mayojar'); }
  if (kind === 'cow' && !s.flags.pressMail) { s.flags.pressMail = true; queueMail(s, 'press'); }
  return a;
}

export function canCraft(s, rid) {
  const r = D.RECIPES[rid];
  if (!s.recipes.includes(rid)) return null;
  for (const needs of [r.needs, r.alt].filter(Boolean)) if (Object.entries(needs).every(([id, n]) => has(s, id, n))) return needs;
  return null;
}
export function craft(s, rid) {
  const needs = canCraft(s, rid);
  if (!needs) return false;
  for (const [id, n] of Object.entries(needs)) take(s, id, n);
  give(s, rid, D.RECIPES[rid].makes);
  return true;
}

// ---------------------------------------------------------------- animals

export function feedTrough(s, home) {
  const want = s.animals.filter((a) => D.ANIMALS[a.kind].home === home).length;
  if (!want) return { msg: `You don't have any ${home === 'coop' ? 'chickens' : 'cows'} yet. Granny Wren sells them.` };
  const need = want - s.troughs[home];
  if (need <= 0) return { msg: 'The trough is full for today.' };
  const n = Math.min(need, s.inv.hay || 0);
  if (!n) return { msg: 'You need hay. Cut tall grass with your sword, or buy it at the ranch.' };
  take(s, 'hay', n);
  s.troughs[home] += n;
  return { fed: n, full: s.troughs[home] >= want };
}

export function petAnimal(s, a) {
  if (a.product) {
    give(s, a.product, 1);
    const got = a.product;
    a.product = null;
    s.stats.products++;
    earn(s, 'rancher');
    return { got };
  }
  if (a.petted) return { msg: `${a.name} is happy.` };
  a.petted = true;
  a.mood = Math.min(100, a.mood + 8);
  return { petted: true };
}

// ---------------------------------------------------------------- villagers

export const hearts = (s, id) => Math.min(D.MAX_HEARTS, Math.floor(s.friends[id].pts / D.HEART_PTS));
function addPts(s, id, n) {
  const f = s.friends[id];
  f.pts = Math.max(0, Math.min(D.MAX_HEARTS * D.HEART_PTS, f.pts + n));
  if (hearts(s, id) >= 2) earn(s, 'friend');
  if (hearts(s, id) >= 6) earn(s, 'best-friend');
}

/** Where a villager is right now: { map, x, y } or null (home). */
export function villagerAt(s, id) {
  const v = VILLAGERS[id];
  if (festivalOpen(s)) return festivalSpot(id);
  if (s.weather === 'rain' || s.weather === 'storm' || s.weather === 'snow') {
    // bad weather: everyone stays in town
    let spot = null;
    for (const sp of v.spots) if (s.time >= sp[0]) spot = sp;
    if (!spot || !spot[1]) return null;
    if (spot[1] !== 'town') return { map: 'town', ...TOWN_RAIN[id] };
    return { map: spot[1], x: spot[2], y: spot[3] };
  }
  let spot = null;
  for (const sp of v.spots) if (s.time >= sp[0]) spot = sp;
  if (!spot || !spot[1]) return null;
  return { map: spot[1], x: spot[2], y: spot[3] };
}
const TOWN_RAIN = { pip: { x: 12, y: 11 }, mira: { x: 15, y: 18 } };
const FEST_SPOTS = { bram: [9, 10], tess: [11, 9], alder: [13, 9], wren: [15, 10], pip: [10, 13], mira: [15, 13] };
const festivalSpot = (id) => ({ map: 'town', x: FEST_SPOTS[id][0], y: FEST_SPOTS[id][1] });

export function villagersOn(s, map = s.map) {
  const out = [];
  for (const id of D.VILLAGER_ORDER) {
    const p = villagerAt(s, id);
    if (p && p.map === map) out.push({ id, ...p });
  }
  return out;
}

/** Talk to a villager. Returns { lines, event?: bool, reward?: [[id,n]] }. */
export function talk(s, id) {
  const f = s.friends[id];
  const v = VILLAGERS[id];
  const today = dayIndex(s);
  const first = f.talk !== today;
  if (first) { f.talk = today; addPts(s, id, 20); }
  const h = hearts(s, id);
  const evs = HEART_EVENTS[id];
  if (f.ev < evs.length && h >= (f.ev + 1) * 2) {
    const ev = evs[f.ev];
    f.ev++;
    const reward = [];
    for (const [rid, n] of Object.entries(ev.reward)) {
      if (rid === 'gold') s.gold += n; else give(s, rid, n);
      reward.push([rid, n]);
    }
    return { lines: [...ev.lines], event: true, reward };
  }
  const pool = CHAT[id][h >= 5 ? 'high' : h >= 2 ? 'mid' : 'low'];
  const r = seeded((today * 31 + id.length * 7 + (first ? 0 : 3)) >>> 0);
  let line = pool[Math.floor(r() * pool.length)];
  if (r() < 0.3) line = SEASON_CHAT[s.season][Math.floor(r() * 2)];
  if (isBirthday(s, id)) line = 'It\'s my birthday today!';
  if (!s.flags[`met_${id}`]) { s.flags[`met_${id}`] = true; return { lines: [`${v.name}: Hello! I'm ${v.name}, ${v.job}.`, `${v.name}: ${line}`] }; }
  return { lines: [`${v.name}: ${line}`] };
}

export const isBirthday = (s, id) => VILLAGERS[id].birthday[0] === s.season && VILLAGERS[id].birthday[1] === s.day;
export function taste(id, item) {
  const v = VILLAGERS[id];
  if (v.loves.includes(item)) return 'love';
  if (v.likes.includes(item)) return 'like';
  if (v.hates.includes(item)) return 'hate';
  const k = ITEMS[item]?.kind;
  if (k === 'gem') return 'like';
  if (k === 'resource' || k === 'mineral') return 'hate';
  return 'neutral';
}
export const giftable = (item) => !!ITEMS[item] && !['seed', 'place', 'stair', 'tackle'].includes(ITEMS[item].kind);
export const canGift = (s, id) => s.friends[id].gift !== dayIndex(s);

/** Give a gift. Returns { taste, line, pts } or { msg }. */
export function giveGift(s, id, item) {
  const f = s.friends[id];
  if (!canGift(s, id)) return { msg: `You already gave ${VILLAGERS[id].name} a gift today.` };
  if (!giftable(item) || !take(s, item)) return { msg: 'You can\'t give that.' };
  const t = taste(id, item);
  let pts = { love: 80, like: 45, neutral: 20, hate: -40 }[t];
  if (isBirthday(s, id) && pts > 0) pts *= 3;
  f.gift = dayIndex(s);
  if (f.talk !== dayIndex(s)) { f.talk = dayIndex(s); pts += 20; }
  addPts(s, id, pts);
  const r = seeded(dayIndex(s) + item.length);
  return { taste: t, line: `${VILLAGERS[id].name}: ${GIFT_REPLY[t][Math.floor(r() * 2)]}`, pts };
}

// ---------------------------------------------------------------- community board

export function bundleProgress(s, b) {
  const got = s.bundles[b.id] || {};
  const parts = Object.entries(b.needs).map(([id, n]) => ({ id, n, have: got[id] || 0 }));
  return { parts, done: s.bundlesDone.includes(b.id) };
}
/** Put items (or gold) toward a bundle. Returns { added, done, reward, hall } or { msg }. */
export function contribute(s, bundleId, id) {
  const b = BUNDLES.find((x) => x.id === bundleId);
  if (!b || s.bundlesDone.includes(b.id)) return { msg: '' };
  const need = b.needs[id];
  if (!need) return { msg: '' };
  const got = (s.bundles[b.id] ||= {});
  const left = need - (got[id] || 0);
  if (left <= 0) return { msg: 'That part is done.' };
  let n;
  if (id === 'gold') { n = Math.min(left, s.gold); if (n <= 0) return { msg: 'You need gold for the vault.' }; s.gold -= n; } else {
    n = Math.min(left, s.inv[id] || 0);
    if (!n) return { msg: `You need ${ITEMS[id].name}.` };
    take(s, id, n);
  }
  got[id] = (got[id] || 0) + n;
  const done = Object.entries(b.needs).every(([k, q]) => (got[k] || 0) >= q);
  const out = { added: n, done: false };
  if (done) {
    s.bundlesDone.push(b.id);
    for (const [rid, q] of Object.entries(b.reward)) { if (rid === 'gold') s.gold += q; else give(s, rid, q); }
    out.done = true; out.reward = b.rewardText;
    earn(s, 'bundle');
    if (s.bundlesDone.length === BUNDLES.length) {
      s.hallRestored = true; s.hallDay = { year: s.year, season: s.season, day: s.day };
      out.hall = true;
      earn(s, 'hall');
      if (s.year === 1) earn(s, 'hall-y1');
      queueMail(s, 'hall');
    }
  }
  return out;
}

// ---------------------------------------------------------------- mail

export function queueMail(s, id, letter) {
  if (s.mail.some((m) => m.id === id)) return;
  s.mail.push(letter ? { id, read: false, letter, pending: true } : { id, read: false, pending: true });
}
export const unread = (s) => s.mail.filter((m) => !m.read && !m.pending).length;
export function letterOf(m) { return m.letter || LETTERS[m.id]; }
/** Read the oldest unread letter (and learn any recipe in it). */
export function readMail(s) {
  const m = s.mail.find((x) => !x.read && !x.pending);
  if (!m) return null;
  m.read = true;
  const l = letterOf(m);
  if (l.recipe && !s.recipes.includes(l.recipe)) s.recipes.push(l.recipe);
  if (s.tut === 0) advanceTut(s, 0);
  // keep the mailbox history short
  if (s.mail.length > 30) s.mail = s.mail.filter((x) => !x.read).concat(s.mail.filter((x) => x.read).slice(-20));
  return l;
}

// ---------------------------------------------------------------- fishing

export function fishHere(s, where) {
  return D.FISH_ORDER.filter((id) => {
    const f = D.FISH[id];
    if (!f.where.includes(where) || !f.seasons.includes(s.season)) return false;
    if (f.hours && (s.time < f.hours[0] || s.time >= f.hours[1])) return false;
    if (f.weather === 'sun' && s.weather !== 'sun') return false;
    if (f.weather === 'rain' && s.weather !== 'rain' && s.weather !== 'storm') return false;
    if (f.legendary && s.stats.fish.whiskers) return false;
    return true;
  });
}
/** Which fish bites (rare and legendary fish are rarer). */
export function rollFish(s, where, rnd = () => rand(s)) {
  const list = fishHere(s, where);
  if (!list.length) return 'perch';
  const w = list.map((id) => (D.FISH[id].legendary ? 0.08 : D.FISH[id].rare ? 0.35 : 1));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
export function caughtFish(s, id) {
  give(s, id, 1);
  s.stats.fish[id] = (s.stats.fish[id] || 0) + 1;
  s.stats.fishCaught++;
  earn(s, 'first-fish');
  if (Object.keys(s.stats.fish).length >= 8) earn(s, 'angler');
  if (id === 'whiskers') earn(s, 'whiskers');
}

// ---------------------------------------------------------------- the mine

export const mineUnlocked = (s) => dayIndex(s) >= 4;
export const checkpoints = (s) => CHECKPOINTS.filter((c) => c === 1 || s.mineDeepest >= c);

export function enterMine(s, floor) {
  const rnd = seeded((s.seed ^ (floor * 7919) ^ (dayIndex(s) * 104729) ^ (s.time * 13)) >>> 0);
  s.mine = { ...mineFloor(floor, rnd), ladderOpen: false };
  s.map = 'mine';
  s.x = s.mine.up.x; s.y = s.mine.up.y + 1; s.face = 'down';
  if (floor > s.mineDeepest) s.mineDeepest = floor;
  if (floor >= 10) earn(s, 'miner');
  if (floor >= MINE_FLOORS) earn(s, 'deep');
  return s.mine;
}
export function leaveMine(s) { s.mine = null; goTo(s, MINE_EXIT.map, MINE_EXIT.x, MINE_EXIT.y, MINE_EXIT.face); }

const ROCK_DROP = { stone: ['stone', 1, 2], copper: ['copperore', 1, 3], iron: ['ironore', 1, 3], gold: ['goldore', 1, 2] };
/** Swing the pickaxe at a mine rock. Returns { ok, broke, got, ladder } */
export function mineRock(s, x, y) {
  const m = s.mine;
  if (!m) return { ok: false };
  if (s.energy < 1) return { ok: false, msg: 'Too tired! Eat something.' };
  const i = m.rocks.findIndex((r) => r.x === x && r.y === y);
  if (i < 0) return { ok: false };
  const r = m.rocks[i];
  spend(s, 1);
  r.hp -= 1 + s.tools.pick;
  if (r.hp > 0) return { ok: true, broke: false };
  m.rocks.splice(i, 1);
  const got = [];
  if (r.kind === 'gem') {
    const roll = rand(s);
    got.push([m.floor >= 15 && roll < 0.2 ? 'diamond' : roll < 0.5 ? 'jade' : roll < 0.8 ? 'aquamarine' : 'ruby', 1]);
  } else {
    const [id, lo, hi] = ROCK_DROP[r.kind];
    got.push([id, lo + Math.floor(rand(s) * (hi - lo + 1))]);
    if (r.kind !== 'stone' && rand(s) < 0.5) got.push(['stone', 1]);
  }
  for (const [id, n] of got) give(s, id, n);
  let ladder = false;
  if (m.ladder && m.ladder.x === x && m.ladder.y === y) { m.ladderOpen = true; ladder = true; }
  return { ok: true, broke: true, got, ladder };
}

/** Hit a slime with the sword (or pick). Returns { hit, dead, got }. */
export function hitSlime(s, sl, weapon = 'sword') {
  const dmg = weapon === 'sword' ? 2 + s.tools.sword * 2 : 1;
  sl.hp -= dmg;
  if (sl.hp > 0) return { hit: true, dead: false };
  s.mine.slimes = s.mine.slimes.filter((x) => x !== sl);
  const got = [['slime', 1 + (rand(s) < 0.4 ? 1 : 0)]];
  for (const [id, n] of got) give(s, id, n);
  s.stats.slimes++;
  // the last slime on a floor drops the ladder where it fell if it's still hidden
  if (!s.mine.slimes.length && s.mine.ladder && !s.mine.ladderOpen && s.mine.floor < MINE_FLOORS) {
    const lr = s.mine.rocks.find((r) => r.x === s.mine.ladder.x && r.y === s.mine.ladder.y);
    if (lr) { s.mine.ladder = { x: sl.x, y: sl.y }; }
    s.mine.ladderOpen = true;
    return { hit: true, dead: true, got, ladder: true };
  }
  return { hit: true, dead: true, got };
}

/** Where a slime wants to step (towards the farmer when close, else a random wander). */
export function slimeStep(s, sl, rnd = () => rand(s), occupied = () => false) {
  const d = Math.abs(sl.x - s.x) + Math.abs(sl.y - s.y);
  let dirs = Object.values(DIRS);
  if (d <= 6) {
    dirs = [...dirs].sort((a, b) => (Math.abs(sl.x + a[0] - s.x) + Math.abs(sl.y + a[1] - s.y)) - (Math.abs(sl.x + b[0] - s.x) + Math.abs(sl.y + b[1] - s.y)));
  } else if (rnd() < 0.5) return null;
  else dirs = [dirs[Math.floor(rnd() * 4)]];
  for (const [dx, dy] of dirs) {
    const nx = sl.x + dx; const ny = sl.y + dy;
    if (nx === s.x && ny === s.y) return null; // adjacent already: attacks instead
    if (!walkable(s, nx, ny, 'mine') || occupied(nx, ny)) continue;
    if (d <= 6 && Math.abs(nx - s.x) + Math.abs(ny - s.y) > d) continue;
    return { x: nx, y: ny };
  }
  return null;
}
export const slimeDamage = (sl) => SLIME[sl.kind].dmg;
export function hurt(s, n) { s.hp = Math.max(0, s.hp - n); return s.hp <= 0; }

/** Knocked out in the mine: carried home, lose some loot and time. */
export function knockedOut(s) {
  const lost = [];
  const loot = Object.keys(s.inv).filter((id) => ['mineral', 'gem', 'resource'].includes(ITEMS[id].kind) && id !== 'hay');
  for (let i = 0; i < 3 && loot.length; i++) {
    const id = loot.splice(Math.floor(rand(s) * loot.length), 1)[0];
    const n = Math.ceil(s.inv[id] / 2);
    take(s, id, n);
    lost.push([id, n]);
  }
  s.mine = null;
  goTo(s, 'farm', FARM_HOME.x, FARM_HOME.y, 'down');
  s.hp = Math.round(D.MAX_HP / 3);
  s.energy = Math.max(10, Math.round(s.energy / 2));
  passTime(s, 120);
  return { lost };
}

export const ROCK_KINDS = ROCK_HP;

// ---------------------------------------------------------------- the night

function rollWeather(s, season, day) {
  if (festivalOn(season, day) || (season === 0 && day === 1)) return 'sun';
  const r = rand(s);
  if (season === 3) return r < 0.35 ? 'snow' : 'sun';
  if (season === 1 && r < 0.05) return 'storm';
  return r < (season === 1 ? 0.15 : 0.25) ? 'rain' : 'sun';
}

function spawnForage(s, first = false) {
  for (const mapId of ['woods', 'farm', 'town']) {
    const pool = D.FORAGE[mapId][s.season];
    const objs = s.objs[mapId];
    const have = Object.values(objs).filter((o) => o.k === 'forage').length;
    const max = { woods: 9, farm: 3, town: 2 }[mapId];
    let add = Math.min(max - have, mapId === 'woods' ? 4 + Math.floor(rand(s) * 3) : 1);
    if (first) add = max;
    let tries = 0;
    const m = MAPS[mapId];
    while (add > 0 && tries++ < 300) {
      const x = 1 + Math.floor(rand(s) * (m.tiles[0].length - 2));
      const y = 1 + Math.floor(rand(s) * (m.tiles.length - 2));
      if (!isOpenGround(s, mapId, x, y) || tileAt(m, x, y) === '=') continue;
      if (mapId === 'farm' && !(y <= 5 && x >= 14) && !(x >= 14 && y >= 18)) continue; // farm edges only
      if (mapId === 'town' && !(y >= 16)) continue;
      objs[key(x, y)] = { k: 'forage', item: pick(s, pool) };
      add--;
    }
  }
}

function growTallGrass(s) {
  if (s.season === 3) return;
  const objs = s.objs.farm;
  const tall = Object.entries(objs).filter(([, o]) => o.k === 'tall');
  if (tall.length >= 30) return;
  for (let i = 0; i < 3 && tall.length; i++) {
    const [k] = pick(s, tall);
    const [x, y] = unkey(k);
    const [dx, dy] = pick(s, Object.values(DIRS));
    if (isOpenGround(s, 'farm', x + dx, y + dy) && tileAt(MAPS.farm, x + dx, y + dy) !== '=') objs[key(x + dx, y + dy)] = { k: 'tall' };
  }
}

/** Water around each sprinkler. */
function runSprinklers(s) {
  for (const [k, o] of Object.entries(s.objs.farm)) {
    if (o.k !== 'sprinkler' && o.k !== 'qsprinkler') continue;
    const [x, y] = unkey(k);
    const around = o.k === 'sprinkler' ? Object.values(DIRS) : [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (const [dx, dy] of around) { const so = s.soil[key(x + dx, y + dy)]; if (so) so.wet = true; }
  }
}

/**
 * Go to bed (or pass out). Everything that happens overnight:
 * shipping income, crops, animals, weather, mail, forage. Returns a summary for the scene.
 */
export function sleep(s, { passedOut = false } = {}) {
  const sum = { shipped: Object.entries(s.bin).map(([id, n]) => [id, n, ITEMS[id].price * n]), income: binValue(s), passedOut, lost: 0, products: 0, grown: 0, events: [] };
  // money
  s.gold += sum.income;
  s.earned += sum.income;
  if (sum.income) s.stats.shippedDays++;
  s.bin = {};
  if (s.earned >= 10000) earn(s, 'rich');
  if (passedOut) {
    sum.lost = Math.min(500, Math.floor(s.gold * 0.1));
    s.gold -= sum.lost;
    s.stats.passOuts++;
    if (s.time >= D.DAY_END) earn(s, 'night-owl');
  }
  const late = s.time > D.MIDNIGHT;
  s.energy = passedOut ? Math.round(D.MAX_ENERGY / 2) : late ? Math.round(D.MAX_ENERGY * 0.75) : D.MAX_ENERGY;
  s.hp = D.MAX_HP;
  s.water = D.CAN_SIZE[s.tools.can];
  if (s.tut === 6) advanceTut(s, 6);

  // crops grow if they were watered today
  const oldSeason = s.season;
  for (const so of Object.values(s.soil)) {
    if (so.crop && !so.crop.dead && so.wet) {
      const def = CROPS[so.crop.id];
      if (so.crop.age < def.days) { so.crop.age = Math.min(def.days, so.crop.age + (so.compost ? 1.5 : 1)); if (so.crop.age >= def.days) sum.grown++; }
    }
  }
  // animals
  for (const home of ['coop', 'barn']) {
    const herd = s.animals.filter((a) => D.ANIMALS[a.kind].home === home);
    for (const a of herd) {
      const fed = s.troughs[home] > 0;
      if (fed) s.troughs[home]--;
      a.mood = Math.max(0, Math.min(100, a.mood + (fed ? 6 : -25) + (a.petted ? 6 : -8)));
      if (fed && a.mood >= 30 && !a.product) { a.product = D.ANIMALS[a.kind].product; sum.products++; }
      a.petted = false;
    }
    s.troughs[home] = 0;
  }

  // calendar
  const wasYear = s.year;
  s.day++;
  if (s.day > D.SEASON_DAYS) { s.day = 1; s.season++; if (s.season > 3) { s.season = 0; s.year++; } }
  s.weather = s.tomorrow;
  s.tomorrow = rollWeather(s, ...nextDate(s));
  s.time = D.DAY_START;
  s.mine = null;
  goTo(s, FARM_HOME.map, FARM_HOME.x, FARM_HOME.y, 'down');

  // soil: dries out, rain and sprinklers water it, season change kills crops out of season
  for (const [k, so] of Object.entries(s.soil)) {
    so.wet = false;
    if (so.crop && !so.crop.dead && !CROPS[so.crop.id].seasons.includes(s.season)) so.crop.dead = true;
    if (!so.crop && !so.compost && rand(s) < (s.season !== oldSeason ? 0.6 : 0.08)) delete s.soil[k];
  }
  if (s.season !== oldSeason) {
    sum.events.push(`${D.SEASONS[s.season]} has begun!`);
    for (const objs of Object.values(s.objs)) for (const [k, o] of Object.entries(objs)) if (o.k === 'forage') delete objs[k];
    if (s.season === 1) queueMail(s, `summer`);
    if (s.season === 2) queueMail(s, `fall`);
    if (s.season === 3) queueMail(s, `winter`);
    if (s.season === 0) for (const id of ['summer', 'fall', 'winter']) { s.mail = s.mail.filter((m) => m.id !== id || !m.read); }
  }
  if (['rain', 'storm'].includes(s.weather)) for (const so of Object.values(s.soil)) so.wet = true;
  runSprinklers(s);
  spawnForage(s);
  growTallGrass(s);
  seedWild(s, 'woods', false);

  // mail for tomorrow-ish
  const di = dayIndex(s);
  if (s.year === 1 && s.season === 0 && s.day === 2) queueMail(s, 'tess');
  if (di === 4) queueMail(s, 'mine');
  const [ns, nd] = nextDate(s);
  const f = festivalOn(ns, nd);
  if (f) queueMail(s, `fest-${s.year}-${f.id}`, FESTIVAL_LETTER(f));
  for (const id of D.VILLAGER_ORDER) {
    const [bs, bd] = VILLAGERS[id].birthday;
    if (bs === ns && bd === nd) queueMail(s, `bday-${s.year}-${id}`, BIRTHDAY_LETTER(VILLAGERS[id]));
  }
  for (const m of s.mail) delete m.pending;

  // the end of year one
  if (s.year !== wasYear && !s.yearReview) {
    s.yearReview = { year: wasYear, restored: s.hallRestored, bundles: s.bundlesDone.length, earned: s.earned };
    sum.yearReview = s.yearReview;
  }
  sum.date = dateText(s);
  sum.weather = s.weather;
  sum.tomorrow = s.tomorrow;
  return sum;
}

function nextDate(s) {
  let d = s.day + 1; let q = s.season;
  if (d > D.SEASON_DAYS) { d = 1; q = (q + 1) % 4; }
  return [q, d];
}

// ---------------------------------------------------------------- festivals

export function markFestival(s, f, won) {
  s.fest[`${s.year}-${f.id}`] = true;
  if (won) { s.stats.festivalsWon++; earn(s, 'festival'); }
  for (const id of D.VILLAGER_ORDER) addPts(s, id, 15);
  s.time = Math.max(s.time, 22 * 60);
  goTo(s, FARM_HOME.map, FARM_HOME.x, FARM_HOME.y, 'down');
}

/** Harvest Fair judging: score is the value of the shown item. */
export function fairJudge(s, item) {
  const v = ITEMS[item]?.price || 0;
  const place = v >= 200 ? 1 : v >= 90 ? 2 : 3;
  const prize = [0, 1000, 400, 150][place];
  s.gold += prize;
  return { place, prize, won: place === 1 };
}

/** Winter Star: who your secret friend is this year. */
export const secretFriend = (s) => D.VILLAGER_ORDER[(s.seed + s.year * 3) % D.VILLAGER_ORDER.length];
export function starExchange(s, item) {
  const id = secretFriend(s);
  const t = taste(id, item);
  take(s, item);
  addPts(s, id, { love: 120, like: 70, neutral: 30, hate: -20 }[t]);
  const gifts = { bram: ['ironbar', 3], tess: ['salad', 3], alder: ['goldbar', 1], wren: ['hay', 25], pip: ['slime', 5], mira: ['bait', 25] };
  const [gid, n] = gifts[id];
  give(s, gid, n);
  return { id, taste: t, gift: [gid, n] };
}

// ---------------------------------------------------------------- summaries for the UI

/** A short, useful nudge for the task line once the tutorial is done (or null). */
export function hint(s) {
  if (s.map === 'farm') {
    const dry = Object.values(s.soil).filter((so) => so.crop && !so.crop.dead && !so.wet && cropStage(so.crop) !== 'ready').length;
    const ripe = Object.values(s.soil).filter((so) => so.crop && cropStage(so.crop) === 'ready').length;
    if (ripe) return `${ripe} crop${ripe > 1 ? 's are' : ' is'} ready to harvest`;
    if (dry && s.time < 20 * 60) return `${dry} crop${dry > 1 ? 's need' : ' needs'} water today`;
    if (unread(s)) return 'You have mail!';
    const hungry = s.animals.filter((a) => s.troughs[D.ANIMALS[a.kind].home] < s.animals.filter((b) => b.kind === a.kind).length).length;
    if (hungry) return 'Put hay in the trough for your animals';
    const pat = s.animals.filter((a) => !a.petted || a.product).length;
    if (pat) return 'Your animals would love a pat';
  }
  if (mineUnlocked(s) && !s.mineDeepest && dayIndex(s) < 14) return 'The old mine in Whisperwood is open';
  if (dayIndex(s) < 3 && s.map === 'farm') return 'Goal: fill the bundles on the town board';
  return null;
}

export function goalText(s) {
  if (s.hallRestored) return 'The town hall is restored!';
  return `Town hall: ${s.bundlesDone.length} of ${BUNDLES.length} bundles done`;
}

export function animalAt(s, x, y) { return s.map === 'farm' ? s.animals.find((a) => a.x === x && a.y === y) || null : null; }

/** Let animals amble about their pen (called by the scene every couple of seconds). */
export function wanderAnimals(s, rnd = Math.random) {
  for (const a of s.animals) {
    if (rnd() < 0.5) continue;
    const [px, py, pw, ph] = MAPS.farm.pens[D.ANIMALS[a.kind].home];
    const [dx, dy] = Object.values(DIRS)[Math.floor(rnd() * 4)];
    const nx = a.x + dx; const ny = a.y + dy;
    if (nx < px || ny < py || nx >= px + pw || ny >= py + ph) continue;
    if (!walkable(s, nx, ny, 'farm') || s.animals.some((b) => b !== a && b.x === nx && b.y === ny) || (s.map === 'farm' && s.x === nx && s.y === ny)) continue;
    a.x = nx; a.y = ny; a.dir = dx < 0 ? -1 : dx > 0 ? 1 : a.dir;
  }
}

export { ITEMS, CROPS, BUNDLES, VILLAGERS, doorOf, buildingAt, tileAt, FARM_HOME, MINE_EXIT, MINE_FLOORS, CHECKPOINTS };
