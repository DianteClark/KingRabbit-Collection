// Colony simulation: a new game, the tick, hourly and daily upkeep, the player's orders, the
// end of the game and saving. Pure logic (no Phaser, no DOM) so node tests can run it.
import {
  W, H, N, T, P, Z, TPD, TPH, ITEMS, BUILDS, PLANTS, WIN_DAYS, DAILY_DAYS, DAYS_PER_YEAR, FUEL_MAX, RECIPES, SEASONS,
} from './data.js';
import { generate, START, idx, tx, ty, inMap, near, dist } from './map.js';
import { next, rand, randInt, chance, pick } from './rng.js';
import {
  rt, markTile, markAll, note, log, settlers, hostiles, bAt, canPlace, placeBlueprint, removeBuilding, roomsChanged,
  outdoorTemp, tileTemp, isIndoors, season, seasonIdx, dayOf, calDay, yearOf, wealth, stock, foodCount, dropNear, takeAt,
  solidTerrain, isStore, builtOf, passSettler, rooms, mobById,
} from './world.js';
import { makeSettler, die, kill, hurt, dropJob, has } from './life.js';
import { settlerTick, settlerHour } from './ai.js';
import { animalTick, raiderTick, seedAnimals, spawnAnimal, setDef } from './mobs.js';
import { initStory, storyHour, resolvePending, trade, canTrade, forceEvent, homeTile } from './story.js';

export const VERSION = 1;

export const DAILY_SCENARIOS = [
  { id: 'late', name: 'Late Arrival', desc: 'You land near the end of fall. Winter comes fast: stock food and keep warm.', day0: 25 },
  { id: 'lone', name: 'Lone Survivor', desc: 'One settler and extra supplies. Wanderers come by more often.', settlers: 1, extra: { meal: 12, wood: 30 } },
  { id: 'lean', name: 'Lean Land', desc: 'Few berries and animals here, but you brought more meals.', food: 0.35, animals: 4, extra: { meal: 18 } },
  { id: 'bandit', name: 'Bandit Country', desc: 'Raiders find you early and hit harder. Everyone starts with a spear.', firstThreat: 3, weapons: true },
  { id: 'rich', name: 'Rich Hills', desc: 'The hills are full of iron. Extra metal to start.', ore: 2.2, extra: { metal: 30 } },
];

/**
 * mode: 'standard' | 'peaceful' | 'daily'. opts: { seed, skill (0..1), scenario (daily id) }.
 */
export function newGame(mode = 'standard', opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const sc = mode === 'daily' ? DAILY_SCENARIOS.find((d) => d.id === opts.scenario) || DAILY_SCENARIOS[seed % DAILY_SCENARIOS.length] : null;
  const map = generate(seed, { ore: sc?.ore, food: sc?.food });
  const s = {
    v: VERSION, mode, seed, rng: (seed ^ 0x9e3779b9) >>> 0, skill: mode === 'daily' ? 0.4 : Math.max(0, Math.min(1, opts.skill ?? 0.35)),
    scenario: sc?.id || null, day0: sc?.day0 || 0,
    t: 7 * TPH,
    ter: map.ter, plant: map.plant, pgrow: new Array(N).fill(0),
    bld: new Array(N).fill(0), blds: {}, nextId: 1,
    zone: new Array(N).fill(Z.NONE), crop: new Array(N).fill(-1),
    items: {}, des: {}, fire: {},
    mobs: [], nextMob: 1, res: {},
    bills: Object.fromEntries(Object.keys(RECIPES).map((k) => [k, 0])),
    log: [], alert: null, pending: null, raids: [],
    stats: { deaths: 0, meals: 0, harvests: 0, joined: 0, raidsWon: 0, maxPop: 0, fires: 0 },
    radio: { calling: false, hours: 0, called: false, rescueAt: null },
    result: null, tut: 0, seen: {},
  };
  initStory(s, { firstThreat: sc?.firstThreat ?? (mode === 'standard' ? 6 : 5) });
  const start = idx(START.x, START.y);
  const n = sc?.settlers ?? 3;
  const roles = ['build', 'cook', 'heal'];
  for (let k = 0; k < n; k++) {
    const at = idx(START.x - 1 + k, START.y);
    const p = makeSettler(s, at, { skill: roles[k], weapon: sc?.weapons ? 'spear' : null });
    if (n === 1) { p.skills.build = Math.max(p.skills.build, 5); p.skills.cook = Math.max(p.skills.cook, 4); p.skills.heal = Math.max(p.skills.heal, 3); }
    s.mobs.push(p);
  }
  // A starting relationship or two.
  const ps = settlers(s);
  if (ps.length >= 2) { ps[0].rel[ps[1].id] = 20; ps[1].rel[ps[0].id] = 20; }
  // Supplies from the landing.
  const kit = mode === 'peaceful' ? { meal: 30, wood: 60, metal: 20, medicine: 6, berries: 10 } : { meal: 20, wood: 40, metal: 12, medicine: 4, berries: 10 };
  for (const [k, v] of Object.entries(sc?.extra || {})) kit[k] = (kit[k] || 0) + v;
  let off = 0;
  for (const [k, v] of Object.entries(kit)) { dropNear(s, idx(START.x - 2 + off, START.y + 2), k, v); off++; }
  if (mode === 'peaceful') dropNear(s, idx(START.x + 3, START.y + 2), 'tools', 1);
  else dropNear(s, idx(START.x + 3, START.y + 2), 'bow', 1);
  seedAnimals(s, sc?.animals ?? 10);
  s.stats.maxPop = n;
  log(s, mode === 'daily' ? `Daily challenge: ${sc.name}. ${sc.desc}` : 'Your settlers have landed. Build a home and survive.', 'info', start);
  markAll(s);
  return s;
}

// ---------------------------------------------------------------- the clock

/** Advance one tick. Does nothing while a decision is waiting or the game is over. */
export function tick(s) {
  if (s.pending || s.result) return false;
  s.t++;
  for (let k = 0; k < s.mobs.length; k++) {
    const m = s.mobs[k];
    if (m.dead) continue;
    if (m.kind === 'settler') settlerTick(s, m);
    else if (m.kind === 'animal') animalTick(s, m);
    else raiderTick(s, m);
  }
  if (s.t % 5 === 0 && Object.keys(s.fire).length) fireTick(s);
  if (s.t % 10 === 0) {
    // Forget dead animals and raiders (settlers are kept for the memorial).
    if (s.mobs.some((m) => m.dead && m.kind !== 'settler')) s.mobs = s.mobs.filter((m) => !m.dead || m.kind === 'settler');
    checkRaids(s);
  }
  if (s.t % TPH === 0) hourly(s);
  if (s.t % TPD === 0) daily(s);
  return true;
}
export function run(s, ticks) { for (let k = 0; k < ticks; k++) if (!tick(s)) break; }

function hourly(s) {
  const out = outdoorTemp(s);
  for (const p of settlers(s)) settlerHour(s, p);
  // Fires burn wood.
  for (const b of Object.values(s.blds)) {
    if (!b.done || !BUILDS[b.k].fuel || b.fuel <= 0) continue;
    b.fuel = Math.max(0, b.fuel - 1 / BUILDS[b.k].fuel);
    if (b.fuel <= 0) { roomsChanged(s); markTile(s, b.i); }
  }
  // Plants and crops.
  const grow = season(s).grow && out > 3;
  let frost = 0;
  for (let i = 0; i < N; i++) {
    if (s.pgrow[i] > 0) { s.pgrow[i] = Math.max(0, s.pgrow[i] - TPH); if (!s.pgrow[i]) markTile(s, i); }
    const c = s.crop[i];
    if (c >= 0 && c < 1) {
      if (out < -1 && c > 0) { s.crop[i] = -1; frost++; markTile(s, i); continue; }
      if (grow) {
        const before = c < 0.33 ? 0 : c < 0.75 ? 1 : 2;
        s.crop[i] = Math.min(1, c + 1 / (5 * 24) * (out > 18 ? 1.15 : 1));
        const after = s.crop[i] < 0.33 ? 0 : s.crop[i] < 0.75 ? 1 : s.crop[i] >= 1 ? 3 : 2;
        if (after !== before) markTile(s, i);
      }
    }
  }
  if (frost) log(s, `Frost killed ${frost} growing crop${frost === 1 ? '' : 's'}. Plant earlier next year.`, 'bad');
  // Food rots.
  const r = rooms(s);
  let rotten = 0;
  for (const [key, it] of Object.entries(s.items)) {
    const def = ITEMS[it.k];
    if (!def.rot) continue;
    const i = +key;
    if (bAt(s, i)?.k === 'storage') continue;
    const temp = tileTemp(s, i, out);
    if (temp < 0) continue;
    const rate = 1 / (def.rot * 24) * (r.rooms[i] ? 0.35 : 1) * (temp > 28 ? 1.6 : 1);
    it.r += rate;
    if (it.r >= 1) { rotten += it.n; delete s.items[i]; markTile(s, i); }
  }
  if (rotten) {
    s.stats.rotted = (s.stats.rotted || 0) + rotten;
    if (s.t - (s.lastRotLog || -1e9) > 12 * TPH) { s.lastRotLog = s.t; log(s, `${rotten} food rotted. Store food indoors or in a Storage crate.`, 'bad'); }
    for (const p of settlers(s)) { p.thoughts = p.thoughts.filter((t) => t.k !== 'rotten'); p.thoughts.push({ k: 'rotten', v: -3, until: s.t + 24 * TPH }); }
  }
  if (!checkResult(s)) storyHour(s);
}

function daily(s) {
  const d = dayOf(s);
  const se = season(s);
  note(s, { type: 'day', day: d });
  if ((calDay(s)) % 10 === 0) {
    log(s, `${se.name} has arrived.${se.id === 'wi' ? ' Crops will not grow. Stay warm and fed.' : se.id === 'fa' ? ' Harvest and store food before winter.' : ''}`, 'info');
    note(s, { type: 'season', id: se.id });
    markAll(s);
    if (se.id === 'sp' && d > 1) note(s, { type: 'winterOver' });
  }
  if (d > 1 && (d - 1) % DAYS_PER_YEAR === 0) note(s, { type: 'year', n: (d - 1) / DAYS_PER_YEAR });
  // Wild animals wander in to keep numbers up; trees spread slowly.
  const wild = s.mobs.filter((m) => m.kind === 'animal' && !m.dead && !m.hostile).length;
  if (wild < 8 && se.id !== 'wi') for (let k = 0; k < 2; k++) spawnAnimal(s, pick(s, ['hen', 'duck', 'sheep', 'boar', 'goose', 'fox']));
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(next(s) * N);
    if (s.ter[i] > T.DIRT || s.plant[i] || s.bld[i] || s.zone[i] || s.items[i]) continue;
    let trees = 0;
    near(i, (j) => { if (s.plant[j] === P.TREE || s.plant[j] === P.PINE) trees++; });
    if (trees >= 2) { s.plant[i] = chance(s, 0.5) ? P.TREE : P.PINE; markTile(s, i); }
  }
  s.stats.maxPop = Math.max(s.stats.maxPop, settlers(s).length);
}

// ---------------------------------------------------------------- fire

function flammable(s, i) {
  if (s.plant[i] === P.TREE || s.plant[i] === P.PINE || s.plant[i] === P.BUSH) return true;
  const b = bAt(s, i);
  if (b && BUILDS[b.k].flam) return true;
  const it = s.items[i];
  return !!(it && (it.k === 'wood' || ITEMS[it.k].food || it.k === 'leather' || it.k === 'herbs'));
}
function fireTick(s) {
  const winter = season(s).id === 'wi';
  for (const [key, f] of Object.entries(s.fire)) {
    const i = +key;
    const fuel = flammable(s, i);
    let v = f + (fuel ? 0.012 : -0.05) - (winter ? 0.01 : 0);
    const b = bAt(s, i);
    if (b && BUILDS[b.k].flam) {
      b.hp -= 3;
      if (b.hp <= 0) { log(s, `A ${BUILDS[b.k].name.toLowerCase()} burned down.`, 'bad', i); removeBuilding(s, b, 0); }
    }
    if (v > 0.8 && (s.plant[i] === P.TREE || s.plant[i] === P.PINE || s.plant[i] === P.BUSH) && chance(s, 0.03)) { s.plant[i] = P.NONE; markTile(s, i); }
    const it = s.items[i];
    if (it && v > 0.5 && flammable(s, i) && chance(s, 0.05)) { takeAt(s, i, Math.ceil(it.n / 3)); }
    if (v > 0.3) {
      near(i, (j) => {
        if (s.fire[j] || !flammable(s, j)) return;
        if (chance(s, 0.006 * v * (winter ? 0.3 : 1) * (s.mode === 'peaceful' ? 0.6 : 1))) { s.fire[j] = 0.15; markTile(s, j); }
      }, false);
    }
    for (const m of s.mobs) if (!m.dead && m.at === i && (m.kind !== 'settler' || !m.downed)) hurt(s, m, 0.8, null, 'burned');
    if (v <= 0) { delete s.fire[i]; markTile(s, i); } else s.fire[i] = Math.min(1, v);
  }
}

function checkRaids(s) {
  for (const r of s.raids || []) {
    if (r.over) continue;
    const left = s.mobs.some((m) => m.raid === r.id && !m.dead);
    if (!left) {
      r.over = true;
      s.stats.raidsWon++;
      log(s, 'The raid is over. The raiders are gone.', 'good');
      note(s, { type: 'raidWon' }); note(s, { type: 'adapt', kind: 'raidWon' });
      for (const p of settlers(s)) { p.thoughts = p.thoughts.filter((t) => t.k !== 'raidWon'); p.thoughts.push({ k: 'raidWon', v: 7, until: s.t + 48 * TPH }); }
    }
  }
  if (s.alert && !hostiles(s).length) { s.alert = null; note(s, { type: 'music', name: 'calm' }); }
}

// ---------------------------------------------------------------- end of the game

export function checkResult(s) {
  if (s.result) return s.result;
  const alive = settlers(s).length;
  const d = dayOf(s);
  if (!alive) return end(s, false, 'Everyone in the colony has died.');
  if (s.mode === 'daily' && d > DAILY_DAYS) return end(s, true, `Your colony made it through ${DAILY_DAYS} days.`);
  if (s.radio.called && s.radio.rescueAt && s.t >= s.radio.rescueAt) return end(s, true, 'The rescue ship has landed. Your settlers are going home!', 'rescued');
  if (s.mode !== 'daily' && d > WIN_DAYS) return end(s, true, 'Two whole years in the wild. Your colony is here to stay.', 'survived');
  return null;
}
function end(s, won, reason, how = null) {
  s.pending = null;
  s.result = { won, reason, how, day: dayOf(s), score: dailyScore(s, won), alive: settlers(s).length, deaths: s.stats.deaths };
  log(s, reason, won ? 'good' : 'bad');
  note(s, { type: 'end', won });
  note(s, { type: 'adapt', kind: won ? 'win' : 'lose' });
  return s.result;
}
/** Daily score: colony wealth at the end, or 10 points per day survived if everyone died. */
export function dailyScore(s, won = settlers(s).length > 0) {
  return won ? wealth(s) : Math.min(dayOf(s) - 1, DAILY_DAYS) * 10;
}

// ---------------------------------------------------------------- the player's orders

export const ORDERS = ['chop', 'mine', 'harvest', 'hunt', 'cancel'];

/** Orders over a list of tiles. Returns how many tiles changed. */
export function designate(s, kind, tiles) {
  let n = 0;
  for (const i of tiles) {
    if (i < 0 || i >= N) continue;
    if (kind === 'cancel') {
      if (s.des[i]) { delete s.des[i]; markTile(s, i); n++; }
      const b = bAt(s, i);
      if (b && !b.done) { removeBuilding(s, b); n++; }
      for (const m of s.mobs) if (m.kind === 'animal' && m.hunt && m.at === i) { m.hunt = false; n++; }
      continue;
    }
    if (kind === 'hunt') {
      for (const m of s.mobs) if (m.kind === 'animal' && !m.dead && !m.hunt && m.at === i) { m.hunt = true; n++; }
      continue;
    }
    const ok = kind === 'chop' ? s.plant[i] === P.TREE || s.plant[i] === P.PINE
      : kind === 'harvest' ? s.plant[i] === P.BUSH || s.plant[i] === P.HERB
        : kind === 'mine' ? s.ter[i] === T.ROCK || s.ter[i] === T.ORE
          : kind === 'remove' ? !!bAt(s, i)?.done : false;
    if (ok && s.des[i] !== kind) { s.des[i] = kind; markTile(s, i); n++; }
  }
  return n;
}
export function huntAnimal(s, id, on = true) { const m = mobById(s, id); if (m && m.kind === 'animal' && !m.dead) { m.hunt = on; return true; } return false; }

/** Place a building blueprint at tile i. */
export function build(s, k, i) {
  const r = placeBlueprint(s, k, i);
  return r;
}
export function buildLine(s, k, tiles) {
  let n = 0; let last = null;
  for (const i of tiles) { const r = placeBlueprint(s, k, i); if (r.ok) n++; else last = r.reason; }
  return { ok: n > 0, n, reason: last };
}
export function planLine(s, k, tiles) { return tiles.map((i) => ({ i, ok: canPlace(s, k, i).ok })); }

/** Zone a list of tiles ('stock' | 'farm' | 'clear'). */
export function zone(s, kind, tiles) {
  let n = 0;
  const z = kind === 'stock' ? Z.STOCK : kind === 'farm' ? Z.FARM : Z.NONE;
  for (const i of tiles) {
    if (!zoneOk(s, kind, i)) continue;
    if (s.zone[i] === z) continue;
    if (s.zone[i] === Z.FARM && z !== Z.FARM) s.crop[i] = -1;
    s.zone[i] = z; markTile(s, i); n++;
  }
  return n;
}
export function zoneOk(s, kind, i) {
  if (i < 0 || i >= N || solidTerrain(s, i)) return false;
  if (kind === 'clear') return s.zone[i] !== Z.NONE;
  const b = bAt(s, i);
  if (b) return false;
  return true;
}

export function setBill(s, k, n) { if (k in s.bills) s.bills[k] = Math.max(0, Math.min(20, n)); }
export function setAlert(s, a) { s.alert = a; for (const p of settlers(s)) if (p.job && (p.job.type === 'hide' || p.job.type === 'fight' || a)) dropJob(s, p); }
export function toggleWork(s, id, work) { const p = mobById(s, id); if (p) { p.off[work] = !p.off[work]; if (p.off[work] && p.job) dropJob(s, p); } }
export function setFocus(s, id, work) { const p = mobById(s, id); if (p) { p.focus = p.focus === work ? null : work; dropJob(s, p); } }
export function callRescue(s) {
  if (!builtOf(s, 'radio').length || s.radio.calling) return false;
  s.radio.calling = true;
  log(s, 'A settler will man the radio until someone answers.', 'info');
  if (s.mode !== 'peaceful') s.story.finalRaid = s.t + Math.round(2.5 * TPD);
  return true;
}
export const resolve = (s, choice) => resolvePending(s, choice);
export { trade, canTrade, forceEvent, homeTile };

// ---------------------------------------------------------------- saving

export function serialize(s) { return JSON.parse(JSON.stringify(s)); }
export function deserialize(raw) {
  if (!raw || raw.v !== VERSION || !Array.isArray(raw.ter) || raw.ter.length !== N) return null;
  const s = JSON.parse(JSON.stringify(raw));
  for (const m of s.mobs) if (m.kind === 'animal') setDef(m);
  // Reservations are rebuilt by the settlers as they pick jobs again.
  s.res = {};
  for (const m of s.mobs) { if (m.kind === 'settler' && !m.dead) { m.job = null; m.path = null; m.dest = null; m.sleeping = false; } else { m.path = null; m.dest = null; } }
  return s;
}

// ---------------------------------------------------------------- summaries for the screen

export function summary(s) {
  return {
    day: dayOf(s), year: yearOf(s), season: season(s), temp: outdoorTemp(s), pop: settlers(s).length,
    stock: stock(s), food: foodCount(s), wealth: wealth(s), hostiles: hostiles(s).length,
  };
}
