// Settler brains: needs, choosing what to do next, and doing it. Each job is a small step
// machine stored on the settler (plain JSON, so it saves and resumes).
import {
  TPH, TPD, P, T, Z, ITEMS, BUILDS, PLANTS, ROCKS, RECIPES, WORK, FOODS, RAW, FUEL_MAX, RADIO_HOURS, RESCUE_DAYS,
} from './data.js';
import { distanceMap, standFor } from './path.js';
import { next, rand, randInt, chance, pick } from './rng.js';
import {
  passSettler, costSettler, bAt, isStore, roomFor, addAt, takeAt, dropNear, stock, reserved, reserve, unreserve,
  settlers, hostiles, log, note, isNight, season, outdoorTemp, tileTemp, rooms, missing, completeBuilding, removeBuilding,
  markTile, mobById, tx, ty, near, roomsChanged, builtOf, hour, dayOf, dayInSeason, passGrid,
} from './world.js';
import { walk, attack, mobDist } from './mobs.js';
import {
  addThought, moodTarget, has, hurt, die, dropJob, gainXp, workRate, speedOf, canFight, weaponOf, comfortMin,
} from './life.js';

const FOOD_RATE = 1.2 / TPD;
const REST_RATE = 1 / (0.75 * TPD);
const SLEEP_RATE = 1 / (0.34 * TPD);
const CARRY = 30;

const pass = (s) => { const g = passGrid(s); return (i) => g[i] === 1; };

// ---------------------------------------------------------------- every tick

export function settlerTick(s, p) {
  if (p.cd > 0) p.cd--;
  p.moving = false;
  p.food = Math.max(0, p.food - FOOD_RATE * (has(p, 'glutton') ? 1.3 : 1));
  if (p.sleeping) p.rest = Math.min(1, p.rest + SLEEP_RATE * (p.job?.bed ? 1.15 : 0.9));
  else p.rest = Math.max(0, p.rest - REST_RATE * (has(p, 'nightowl') ? 0.8 : 1));
  p.mood += (moodTarget(p) - p.mood) * 0.003;
  if (p.downed) { p.status = p.bleed ? 'Down and bleeding' : 'Down, recovering'; return; }

  // Fight back when something is right on top of us.
  if (!p.job || p.job.type !== 'fight') {
    const h = hostiles(s).find((o) => mobDist(o, p) < 1.6 && o.target === p.id);
    if (h) { dropJob(s, p); p.job = { type: 'fight', target: h.id, defend: true }; }
  }
  if (p.brk) { breakTick(s, p); return; }
  if (p.job && (s.t + p.id) % 10 === 0 && interrupt(s, p)) dropJob(s, p);
  if (!p.job) think(s, p);
  if (p.job) {
    const ok = RUN[p.job.type](s, p, p.job);
    if (ok !== true && ok !== false) return; // still going
    if (p.job) { if (p.job.res) unreserve(s, p.job.res, p.id); }
    if (ok === false) { p.failCount = (p.failCount || 0) + 1; }
    if (p.carry && ok === true && !p.job?.keepCarry) { dropNear(s, p.at, p.carry.k, p.carry.n, p.carry.r || 0); p.carry = null; }
    dropJob(s, p);
  }
}

function interrupt(s, p) {
  const j = p.job;
  const combat = j.type === 'fight' || j.type === 'hide';
  const hs = hostiles(s);
  if (s.alert && hs.length && !combat && j.type !== 'eat') return true;
  if (!hs.length && j.type === 'hide' && !s.alert) return true;
  if (j.type !== 'eat' && j.type !== 'sleep' && p.food < 0.1 && !combat) return true;
  if (j.type !== 'sleep' && j.type !== 'eat' && p.rest < 0.04 && !combat) return true;
  if (p.cold > 0.6 && !combat && !j.warm && j.type !== 'sleep' && j.type !== 'eat') return true;
  if (j.type === 'wander' && (p.food < 0.3 || (isNight(s) && p.rest < 0.75))) return true;
  return false;
}

// ---------------------------------------------------------------- hourly upkeep

export function settlerHour(s, p) {
  if (p.dead) return;
  const out = outdoorTemp(s);
  const temp = tileTemp(s, p.at, out);
  // Cold
  const cmin = comfortMin(p);
  if (temp < cmin) p.cold = Math.min(1.5, p.cold + (cmin - temp) / 30);
  else p.cold = Math.max(0, p.cold - 0.25);
  if (p.cold > 1) hurt(s, p, 2, null, 'froze to death');
  if (p.dead) return;
  // Hunger
  if (p.food <= 0) { hurt(s, p, 1.2, null, 'starved'); if (p.dead) return; }
  // Healing and bleeding
  if (p.downed) {
    if (p.bleed) {
      hurt(s, p, s.mode === 'peaceful' ? 0.6 : 1, null, 'bled out');
      if (!p.dead && chance(s, 0.1)) { p.bleed = false; log(s, `${p.name}'s bleeding has stopped on its own.`, 'info'); }
    }
    else p.hp = Math.min(100, p.hp + 1.5 + (p.tendQ || 0) * 2);
    if (p.dead) return;
    if (p.hp >= 35) { p.downed = false; p.sleeping = false; log(s, `${p.name} is back on their feet.`, 'good', p.at); note(s, { type: 'recovered', id: p.id }); }
  } else if (p.food > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + (p.sleeping ? 3 : 1.5));
  // Sickness
  if (p.sick) {
    const sk = p.sick;
    const tended = s.t - p.tendAt < 10 * TPH;
    if (sk.kind === 'poison') {
      sk.sev = Math.max(0, sk.sev - 0.03);
      if (sk.sev <= 0) p.sick = null;
    } else {
      sk.sev += (tended ? 0.012 - (p.tendQ || 0) * 0.012 : 0.03) * (s.mode === 'peaceful' ? 0.6 : 1);
      sk.imm += 0.032 + (p.sleeping ? 0.02 : 0);
      if (sk.imm >= 1) { p.sick = null; addThought(s, p, 'cured'); log(s, `${p.name} has fought off the ${sk.name}.`, 'good'); }
      else if (sk.sev >= 1) { die(s, p, sk.name); return; }
    }
  }
  // Situational mood
  const sit = [];
  if (p.food <= 0) sit.push('starving'); else if (p.food < 0.25) sit.push('hungry');
  if (p.rest < 0.05) sit.push('exhausted'); else if (p.rest < 0.2) sit.push('tired');
  if (p.cold > 0.3) sit.push('cold');
  if (temp > 34) sit.push('hot');
  if (p.sick) sit.push('sick');
  if (p.downed) sit.push('downed'); else if (p.hp < 60) sit.push('injured');
  if (season(s).id === 'wi') sit.push('winter');
  for (const t of ['optimist', 'pessimist', 'lazy']) if (has(p, t)) sit.push(t);
  const others = settlers(s).filter((o) => o !== p);
  if (others.some((o) => (p.rel[o.id] || 0) >= 30)) sit.push('friends');
  if (others.some((o) => (p.rel[o.id] || 0) <= -30)) sit.push('rival');
  if (p.mood > 0.85) sit.push('inspired');
  p.sit = sit;
  p.thoughts = p.thoughts.filter((t) => t.until > s.t);
  // Breakdowns
  if (!p.brk && !p.downed && p.mood < 0.2 && chance(s, p.mood < 0.1 ? 0.25 : 0.1)) startBreak(s, p);
  if (p.brk && s.t >= p.brk.until) { p.brk = null; addThought(s, p, 'vent'); log(s, `${p.name} has calmed down.`, 'info'); }
}

function startBreak(s, p) {
  const kind = pick(s, ['sulk', 'binge', 'hide']);
  dropJob(s, p);
  p.brk = { kind, until: s.t + randInt(s, 4, 8) * TPH };
  const what = { sulk: 'is wandering off to sulk', binge: 'is binge eating', hide: 'is hiding in bed' }[kind];
  log(s, `${p.name} ${what}. They need a happier life.`, 'bad', p.at);
  note(s, { type: 'sfx', name: 'error' });
}

function breakTick(s, p) {
  const b = p.brk;
  p.status = { sulk: 'Sulking (breakdown)', binge: 'Binge eating (breakdown)', hide: 'Hiding (breakdown)' }[b.kind];
  if (!p.job) {
    if (b.kind === 'binge' && p.food < 0.95) { const j = findEat(s, p, distanceMap(p.at, pass(s)), true); if (j) p.job = j; }
    if (!p.job && b.kind === 'hide') { const spot = safeSpot(s, p); p.job = { type: 'hide', spot, wait: 120 }; }
    if (!p.job) p.job = { type: 'wander', spot: randomNear(s, p.at, 8), wait: randInt(s, 30, 90) };
  }
  const r = RUN[p.job.type](s, p, p.job);
  if (r === true || r === false) dropJob(s, p);
}

// ---------------------------------------------------------------- choosing

function think(s, p) {
  const dm = distanceMap(p.at, pass(s));
  const hs = hostiles(s);
  if (hs.length) {
    const close = hs.some((h) => mobDist(h, p) < 7);
    if ((s.alert === 'fight' || (close && !s.alert)) && canFight(p)) {
      const t = nearestHostile(s, p, hs, dm);
      if (t) { p.job = { type: 'fight', target: t.id }; p.status = 'Fighting'; return; }
    }
    if (s.alert || close) { p.job = { type: 'hide', spot: safeSpot(s, p), wait: 160 }; return; }
  }
  const tries = [
    () => p.food < 0.25 && findEat(s, p, dm),
    () => p.rest < 0.15 && findSleep(s, p, dm),
    () => p.cold > 0.35 && findWarm(s, p, dm),
    () => p.sick && p.sick.kind !== 'poison' && p.sick.sev > 0.4 && findSleep(s, p, dm, true),
    () => isNight(s) && p.rest < 0.8 && findSleep(s, p, dm),
    () => p.food < 0.45 && findEat(s, p, dm),
    () => findEquip(s, p, dm),
  ];
  for (const f of tries) { const j = f(); if (j) { p.job = j; return; } }
  const order = WORK.map((w) => w.id);
  if (p.focus && order.includes(p.focus)) { order.splice(order.indexOf(p.focus), 1); order.unshift(p.focus); }
  for (const w of order) {
    if (p.off[w]) continue;
    const j = FIND[w](s, p, dm);
    if (j) { p.job = j; return; }
  }
  // Nothing to do: hang around the fire, or anywhere nearby.
  const fire = builtOf(s, 'campfire')[0] || builtOf(s, 'stove')[0];
  const base = fire && dm[fire.i] >= 0 ? fire.i : p.at;
  p.job = { type: 'wander', spot: randomNear(s, base, 4, dm), wait: randInt(s, 30, 90) };
  p.status = 'Idle';
}

function randomNear(s, at, r, dm = null) {
  for (let k = 0; k < 30; k++) {
    const x = tx(at) + randInt(s, -r, r); const y = ty(at) + randInt(s, -r, r);
    if (x < 0 || y < 0 || x >= 48 || y >= 64) continue;
    const i = y * 48 + x;
    if (passSettler(s, i) && (!dm || dm[i] >= 0)) return i;
  }
  return at;
}

function nearestHostile(s, p, hs, dm) {
  let best = null; let bd = 1e9;
  for (const h of hs) {
    const st = standFor(h.at, dm, pass(s));
    const d = st ? st.d : mobDist(h, p) < 2 ? 0 : -1;
    if (d >= 0 && d < bd) { bd = d; best = h; }
  }
  return best;
}

function safeSpot(s, p) {
  const bed = p.bed && s.blds[p.bed]?.done ? s.blds[p.bed] : null;
  if (bed) return bed.i;
  const r = rooms(s).rooms;
  const dm = distanceMap(p.at, pass(s));
  let best = -1; let bd = 1e9;
  for (let i = 0; i < r.length; i++) if (r[i] && dm[i] >= 0 && dm[i] < bd) { bd = dm[i]; best = i; }
  if (best >= 0) return best;
  const fire = builtOf(s, 'campfire')[0];
  return fire && dm[fire.i] >= 0 ? fire.i : p.at;
}

/** Nearest item stack of the given kinds. */
function nearestItem(s, p, dm, kinds, { reserveCheck = true, score } = {}) {
  let best = null;
  for (const [key, it] of Object.entries(s.items)) {
    if (!kinds.includes(it.k)) continue;
    const i = +key;
    if (reserveCheck && reserved(s, `i${i}`, p.id)) continue;
    const st = standFor(i, dm, pass(s));
    if (!st) continue;
    const sc = st.d + (score ? score(it, i) : 0);
    if (!best || sc < best.sc) best = { i, at: st.at, sc, it };
  }
  return best;
}

function findEat(s, p, dm, any = false) {
  const st = nearestItem(s, p, dm, FOODS, { reserveCheck: false, score: (it) => (ITEMS[it.k].food === 'meal' ? 0 : any ? 2 : 14) });
  let bush = null;
  if (season(s).id !== 'wi') {
    for (let i = 0; i < s.plant.length; i++) {
      if (s.plant[i] !== P.BUSH || s.pgrow[i] > 0) continue;
      const d = dm[i];
      if (d >= 0 && (!bush || d < bush.d) && !reserved(s, `t${i}`, p.id)) bush = { i, d };
    }
  }
  if (st && (!bush || st.sc <= bush.d + 20)) { p.status = 'Going to eat'; return { type: 'eat', src: st.i, at: st.at }; }
  if (bush) { p.status = 'Picking berries to eat'; return { type: 'eat', bush: bush.i, at: bush.i }; }
  return null;
}

function findSleep(s, p, dm, sickRest = false) {
  let bed = p.bed && s.blds[p.bed]?.done && dm[s.blds[p.bed].i] >= 0 ? s.blds[p.bed] : null;
  if (!bed) {
    const owned = new Set(settlers(s).filter((o) => o !== p && o.bed).map((o) => o.bed));
    let bd = 1e9;
    for (const b of builtOf(s, 'bed')) if (!owned.has(b.id) && dm[b.i] >= 0 && dm[b.i] < bd) { bd = dm[b.i]; bed = b; }
    if (bed) p.bed = bed.id;
  }
  p.status = sickRest ? 'Resting in bed' : 'Going to sleep';
  if (bed) return { type: 'sleep', at: bed.i, bed: bed.id, sickRest };
  const warm = warmTile(s, p, dm);
  return { type: 'sleep', at: warm ?? p.at, bed: null, sickRest };
}

function warmTile(s, p, dm) {
  const out = outdoorTemp(s);
  const need = comfortMin(p) + 4;
  if (tileTemp(s, p.at, out) >= need) return null;
  let best = null; let bd = 1e9;
  for (let i = 0; i < dm.length; i++) {
    if (dm[i] < 0 || dm[i] >= bd) continue;
    if (tileTemp(s, i, out) >= need && passSettler(s, i) && !bAt(s, i)?.done) { bd = dm[i]; best = i; }
  }
  return best;
}

function findWarm(s, p, dm) {
  const t = warmTile(s, p, dm);
  if (t == null) return null;
  p.status = 'Getting warm';
  return { type: 'wander', spot: t, wait: 90, warm: true };
}

function findEquip(s, p, dm) {
  const want = [];
  if (!p.gear.weapon && !has(p, 'wimp')) want.push(['weapon', ['spear', 'bow', 'club']]);
  if (!p.gear.tool) want.push(['tool', ['tools']]);
  if (!p.gear.coat) want.push(['coat', ['parka']]);
  for (const [slot, kinds] of want) {
    const it = nearestItem(s, p, dm, kinds, { score: (x) => kinds.indexOf(x.k) * 6 });
    if (it && it.sc < 80) {
      reserve(s, `i${it.i}`, p.id);
      p.status = `Picking up ${ITEMS[it.it.k].name.toLowerCase()}`;
      return { type: 'equip', src: it.i, at: it.at, slot, res: `i${it.i}` };
    }
  }
  return null;
}

// ---------------------------------------------------------------- work finders

const FIND = {
  heal(s, p, dm) {
    let best = null;
    for (const q of settlers(s)) {
      if (q === p) continue;
      if (!(q.downed || (q.sick && q.sick.kind !== 'poison') || q.hp < 60)) continue;
      if (s.t - q.tendAt < 8 * TPH && !(q.downed && (q.bleed || q.food < 0.25 || (q.cold > 0.4 && bAt(s, q.at)?.k !== 'bed')))) continue;
      if (reserved(s, `m${q.id}`, p.id)) continue;
      const st = standFor(q.at, dm, pass(s));
      if (!st) continue;
      const sc = st.d - (q.downed ? 60 : 0);
      if (!best || sc < best.sc) best = { q, sc };
    }
    if (!best) return null;
    reserve(s, `m${best.q.id}`, p.id);
    const med = nearestItem(s, p, dm, ['medicine']);
    p.status = `Tending ${best.q.name}`;
    return { type: 'heal', patient: best.q.id, med: med && med.sc < 50 ? med.i : null, medAt: med?.at, step: med && med.sc < 50 ? 'med' : 'go', res: `m${best.q.id}` };
  },
  fire(s, p, dm) {
    let best = null;
    for (const key of Object.keys(s.fire)) {
      const i = +key;
      if (reserved(s, `f${i}`, p.id)) continue;
      const st = standFor(i, dm, pass(s), false);
      if (st && (!best || st.d < best.d)) best = { i, ...st };
    }
    if (!best) return null;
    reserve(s, `f${best.i}`, p.id);
    p.status = 'Fighting a fire';
    return { type: 'fire', tile: best.i, at: best.at, res: `f${best.i}` };
  },
  cook(s, p, dm) {
    const st = stock(s);
    const want = Math.max(5, settlers(s).length * 3);
    if ((st.meal || 0) >= want) return null;
    const stations = Object.values(s.blds).filter((b) => b.done && BUILDS[b.k].cook && b.fuel > 0 && !reserved(s, `b${b.id}`, p.id) && dm[b.i] >= 0);
    if (!stations.length) return findRefuel(s, p, dm, 0.2);
    stations.sort((a, b) => BUILDS[a.k].cook - BUILDS[b.k].cook || dm[a.i] - dm[b.i]);
    const raw = nearestItem(s, p, dm, RAW, { score: (it) => -it.r * 30 });
    if (!raw) return null;
    const stn = stations[0];
    reserve(s, `b${stn.id}`, p.id); reserve(s, `i${raw.i}`, p.id);
    p.status = 'Cooking';
    return { type: 'cook', src: raw.i, at: raw.at, station: stn.id, step: 'fetch', res: `b${stn.id}`, res2: `i${raw.i}` };
  },
  hunt(s, p, dm) {
    let best = null;
    for (const a of s.mobs) {
      if (a.dead || a.kind !== 'animal' || !a.hunt) continue;
      if (!p.gear.weapon && a.def.fierce >= 0.3) continue;
      if (reserved(s, `m${a.id}`, p.id)) continue;
      const st = standFor(a.at, dm, pass(s));
      if (st && (!best || st.d < best.d)) best = { a, d: st.d };
    }
    if (!best) return null;
    reserve(s, `m${best.a.id}`, p.id);
    p.status = `Hunting a ${best.a.def.name.toLowerCase()}`;
    return { type: 'fight', target: best.a.id, hunt: true, res: `m${best.a.id}` };
  },
  build(s, p, dm) {
    let best = null;
    for (const b of Object.values(s.blds)) {
      if (b.done || reserved(s, `b${b.id}`, p.id)) continue;
      if (s.fire[b.i]) continue;
      const st = standFor(b.i, dm, pass(s), !BUILDS[b.k].block && !BUILDS[b.k].door);
      if (!st) continue;
      if (s.mobs.some((m) => !m.dead && m.at === b.i && m !== p && BUILDS[b.k].block)) continue;
      const miss = missing(b);
      const kinds = Object.keys(miss);
      let src = null;
      if (kinds.length) {
        for (const k of kinds) { src = nearestItem(s, p, dm, [k]); if (src) { src.k = k; break; } }
        if (!src) continue;
      }
      const sc = st.d + (src ? src.sc : 0);
      if (!best || sc < best.sc) best = { b, st, src, sc };
    }
    const des = FIND.remove(s, p, dm);
    if (!best) return des;
    reserve(s, `b${best.b.id}`, p.id);
    p.status = `Building a ${BUILDS[best.b.k].name.toLowerCase()}`;
    if (best.src) {
      reserve(s, `i${best.src.i}`, p.id);
      return { type: 'build', b: best.b.id, step: 'fetch', src: best.src.i, at: best.src.at, k: best.src.k, res: `b${best.b.id}`, res2: `i${best.src.i}` };
    }
    return { type: 'build', b: best.b.id, step: 'work', at: best.st.at, res: `b${best.b.id}` };
  },
  remove(s, p, dm) {
    let best = null;
    for (const [key, d] of Object.entries(s.des)) {
      if (d !== 'remove') continue;
      const i = +key;
      const b = bAt(s, i);
      if (!b) { delete s.des[i]; continue; }
      if (reserved(s, `t${i}`, p.id)) continue;
      const st = standFor(i, dm, pass(s), false);
      if (st && (!best || st.d < best.d)) best = { i, ...st, b };
    }
    if (!best) return null;
    reserve(s, `t${best.i}`, p.id);
    p.status = 'Taking something down';
    return { type: 'remove', tile: best.i, at: best.at, work: 0, res: `t${best.i}` };
  },
  farm(s, p, dm) {
    const canSow = season(s).grow && outdoorTemp(s) > 3 && !(season(s).id === 'fa' && dayInSeason(s) > 7);
    let best = null;
    for (let i = 0; i < s.zone.length; i++) {
      if (s.zone[i] !== Z.FARM || dm[i] < 0) continue;
      const ripe = s.crop[i] >= 1;
      const sow = s.crop[i] < 0 && canSow && !s.bld[i];
      if (!ripe && !sow) continue;
      if (reserved(s, `t${i}`, p.id)) continue;
      const sc = dm[i] - (ripe ? 10 : 0);
      if (!best || sc < best.sc) best = { i, sc, ripe };
    }
    if (!best) return null;
    reserve(s, `t${best.i}`, p.id);
    p.status = best.ripe ? 'Harvesting corn' : 'Sowing corn';
    return { type: best.ripe ? 'reap' : 'sow', tile: best.i, at: best.i, work: 0, res: `t${best.i}` };
  },
  chop(s, p, dm) { return findCut(s, p, dm, ['chop', 'harvest']); },
  mine(s, p, dm) { return findCut(s, p, dm, ['mine']); },
  craft(s, p, dm) {
    const radio = builtOf(s, 'radio')[0];
    if (radio && s.radio.calling && !s.radio.called && !reserved(s, `b${radio.id}`, p.id) && dm[radio.i] >= 0) {
      reserve(s, `b${radio.id}`, p.id);
      p.status = 'Calling for rescue';
      return { type: 'radio', b: radio.id, at: radio.i, res: `b${radio.id}` };
    }
    const bench = builtOf(s, 'workbench').find((b) => !reserved(s, `b${b.id}`, p.id) && dm[b.i] >= 0);
    if (!bench) return null;
    const st = stock(s);
    for (const [k, n] of Object.entries(s.bills)) {
      if (n <= 0) continue;
      const need = RECIPES[k].need;
      if (Object.entries(need).every(([m, c]) => (st[m] || 0) >= c)) {
        // all the parts must be reachable
        if (Object.keys(need).some((m) => !nearestItem(s, p, dm, [m]))) continue;
        reserve(s, `b${bench.id}`, p.id);
        p.status = `Making ${RECIPES[k].name.toLowerCase()}`;
        return { type: 'craft', rec: k, bench: bench.id, have: {}, step: 'next', res: `b${bench.id}` };
      }
    }
    return null;
  },
  haul(s, p, dm) {
    // Keep the fires fed first.
    const fuel = findRefuel(s, p, dm, 0.45);
    if (fuel) return fuel;
    const stores = storeTiles(s);
    if (!stores.length) return null;
    let best = null;
    for (const [key, it] of Object.entries(s.items)) {
      const i = +key;
      if (isStore(s, i) || reserved(s, `i${i}`, p.id)) continue;
      const st = standFor(i, dm, pass(s));
      if (!st) continue;
      if (best && st.d >= best.d) continue;
      const dst = storeFor(s, stores, i, it.k, dm, p);
      if (dst != null) best = { i, at: st.at, d: st.d, dst };
    }
    if (!best) return null;
    reserve(s, `i${best.i}`, p.id); reserve(s, `d${best.dst}`, p.id);
    p.status = 'Hauling';
    return { type: 'haul', src: best.i, at: best.at, dst: best.dst, step: 'fetch', res: `i${best.i}`, res2: `d${best.dst}` };
  },
};

function findRefuel(s, p, dm, below) {
  for (const b of Object.values(s.blds)) {
    if (!b.done || !BUILDS[b.k].fuel || b.fuel > FUEL_MAX * below || reserved(s, `r${b.id}`, p.id) || dm[b.i] < 0) continue;
    const w = nearestItem(s, p, dm, ['wood']);
    if (!w) return null;
    reserve(s, `r${b.id}`, p.id); reserve(s, `i${w.i}`, p.id);
    p.status = 'Adding wood to the fire';
    return { type: 'refuel', station: b.id, src: w.i, at: w.at, step: 'fetch', res: `r${b.id}`, res2: `i${w.i}` };
  }
  return null;
}

function storeTiles(s) {
  const out = [];
  for (let i = 0; i < s.zone.length; i++) if (s.zone[i] === Z.STOCK && !s.bld[i]) out.push(i);
  for (const b of builtOf(s, 'storage')) out.push(b.i);
  return out;
}
function storeFor(s, stores, from, k, dm, p) {
  let best = null; let bs = 1e9;
  const fx = tx(from); const fy = ty(from);
  for (const i of stores) {
    const room = roomFor(s, i, k);
    if (room <= 0 || dm[i] < 0 || reserved(s, `d${i}`, p.id)) continue;
    const st = bAt(s, i)?.k === 'storage';
    const sc = Math.abs(tx(i) - fx) + Math.abs(ty(i) - fy) - (s.items[i] ? 6 : 0) - (st && ITEMS[k].food ? 8 : 0);
    if (sc < bs) { bs = sc; best = i; }
  }
  return best;
}

function findCut(s, p, dm, kinds) {
  let best = null;
  const winter = season(s).id === 'wi';
  for (const [key, d] of Object.entries(s.des)) {
    if (!kinds.includes(d)) continue;
    const i = +key;
    if (d === 'chop' && !(s.plant[i] === P.TREE || s.plant[i] === P.PINE)) { delete s.des[i]; markTile(s, i); continue; }
    if (d === 'harvest') {
      if (!(s.plant[i] === P.BUSH || s.plant[i] === P.HERB)) { delete s.des[i]; markTile(s, i); continue; }
      if (s.pgrow[i] > 0 || (winter && s.plant[i] === P.BUSH)) continue;
    }
    if (d === 'mine' && !(s.ter[i] === T.ROCK || s.ter[i] === T.ORE)) { delete s.des[i]; markTile(s, i); continue; }
    if (reserved(s, `t${i}`, p.id) || s.fire[i]) continue;
    const st = standFor(i, dm, pass(s), d !== 'mine');
    if (st && (!best || st.d < best.d)) best = { i, ...st, d0: d };
  }
  if (!best) return null;
  reserve(s, `t${best.i}`, p.id);
  p.status = { chop: 'Chopping a tree', harvest: 'Harvesting', mine: 'Mining' }[best.d0];
  return { type: 'cut', tile: best.i, at: best.at, work: 0, res: `t${best.i}` };
}

// ---------------------------------------------------------------- doing

const go = (s, p, at) => walk(s, p, at, costSettler(s), speedOf(p));

/** Walk to j.at; returns undefined while walking, false when it can't get there, or 'here'. */
function travel(s, p, j) {
  const r = go(s, p, j.at);
  if (r === 'fail') return false;
  if (r === 'walking') return undefined;
  return 'here';
}

const RUN = {
  wander(s, p, j) {
    const r = travel(s, p, { at: j.spot });
    if (r === false) return false;
    if (r === undefined) return undefined;
    if (--j.wait <= 0) return true;
    if (!j.warm && j.wait % 30 === 0) chat(s, p);
    return undefined;
  },
  hide(s, p, j) {
    p.status = 'Taking cover';
    const r = travel(s, p, { at: j.spot });
    if (r === false) { j.spot = p.at; return undefined; }
    if (r === undefined) return undefined;
    if (--j.wait <= 0) return true;
    return undefined;
  },
  eat(s, p, j) {
    if (j.step !== 'eating') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      if (j.bush != null) {
        if (s.plant[j.bush] !== P.BUSH || s.pgrow[j.bush] > 0) return false;
        s.pgrow[j.bush] = PLANTS[P.BUSH].regrow * TPD;
        markTile(s, j.bush);
        dropNear(s, j.bush, 'berries', PLANTS[P.BUSH].n - 1);
        j.food = { k: 'berries', r: 0 };
      } else {
        const it = s.items[j.src];
        if (!it || !ITEMS[it.k].food) return false;
        j.food = takeAt(s, j.src, 1);
      }
      j.step = 'eating'; j.timer = 24;
      p.status = 'Eating';
    }
    if (--j.timer > 0) return undefined;
    const def = ITEMS[j.food.k];
    p.food = Math.min(1, p.food + def.nut);
    if (def.food === 'meal') addThought(s, p, has(p, 'glutton') ? 'feast' : 'meal');
    else if (!has(p, 'ironstomach')) {
      addThought(s, p, 'raw');
      if (chance(s, j.food.k === 'meat' ? 0.08 : 0.03) && !p.sick) {
        p.sick = { kind: 'poison', name: 'food poisoning', sev: 0.3, imm: 0 };
        log(s, `${p.name} has food poisoning from raw ${def.name.toLowerCase()}. Cook your food!`, 'bad');
      }
    }
    if (p.brk?.kind === 'binge') p.food = Math.min(1, p.food + 0.2);
    return true;
  },
  sleep(s, p, j) {
    if (!p.sleeping) {
      if (j.bed && !s.blds[j.bed]?.done) return false;
      const r = travel(s, p, j);
      if (r === false) { j.at = p.at; j.bed = null; return undefined; }
      if (r === undefined) return undefined;
      p.sleeping = true;
      j.slept = 0;
    }
    j.slept++;
    p.status = j.sickRest ? 'Resting in bed' : 'Sleeping';
    const h = hour(s);
    const day = h >= 6 && h < 21;
    const hs = hostiles(s);
    if (hs.some((o) => mobDist(o, p) < 8)) { p.sleeping = false; return true; }
    const done = j.sickRest ? !p.sick || p.sick.sev < 0.25 || p.food < 0.2 : (p.rest >= 0.99 && (day || j.slept > 9 * TPH)) || (p.food < 0.12 && p.rest > 0.3);
    if (!done) return undefined;
    p.sleeping = false;
    if (!j.sickRest) {
      const temp = tileTemp(s, p.at);
      if (temp < comfortMin(p) - 2) addThought(s, p, 'coldsleep');
      else if (j.bed) addThought(s, p, 'bed');
      else addThought(s, p, 'ground');
    }
    return true;
  },
  equip(s, p, j) {
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    const it = s.items[j.src];
    const ok = { weapon: ['spear', 'bow', 'club'], tool: ['tools'], coat: ['parka'] }[j.slot];
    if (!it || !ok.includes(it.k)) return false;
    takeAt(s, j.src, 1);
    p.gear[j.slot] = it.k;
    log(s, `${p.name} picked up ${it.k === 'tools' ? 'some tools' : `a ${ITEMS[it.k].name.toLowerCase()}`}.`, 'info');
    return true;
  },
  fight(s, p, j) {
    const t = mobById(s, j.target);
    if (!t || t.dead || t.gone || (t.kind === 'settler') || (t.kind === 'raider' && t.fleeing && !j.hunt) || (t.downed)) {
      if (t?.dead && j.hunt) { log(s, `${p.name} hunted a ${t.def.name.toLowerCase()}.`, 'good', t.at); gainXp(s, p, 'fight', 20); }
      return true;
    }
    if (t.kind === 'animal' && !t.hostile && !j.hunt) return true;
    p.status = j.hunt ? `Hunting a ${t.def.name.toLowerCase()}` : 'Fighting';
    if (attack(s, p, t)) { gainXp(s, p, 'fight', 2); return undefined; }
    const w = weaponOf(p);
    if (mobDist(p, t) <= (w ? w.range : 1.5)) return undefined;
    if ((j.repath = (j.repath || 0) - 1) <= 0 || p.dest !== t.at) { p.path = null; j.repath = 15; }
    const r = go(s, p, t.at);
    if (r === 'fail') { j.fails = (j.fails || 0) + 1; if (j.fails > 3) return false; }
    return undefined;
  },
  heal(s, p, j) {
    const q = mobById(s, j.patient);
    if (!q || q.dead) return true;
    if (j.step === 'med') {
      const r = travel(s, p, { at: j.medAt });
      if (r === false) { j.step = 'go'; return undefined; }
      if (r === undefined) return undefined;
      const it = s.items[j.med];
      if (it && it.k === 'medicine') { takeAt(s, j.med, 1); j.hasMed = true; }
      j.step = 'go';
      return undefined;
    }
    if (j.step === 'go') {
      if (mobDist(p, q) > 1.5) {
        if (p.dest !== q.at) p.path = null;
        const r = go(s, p, q.at);
        if (r === 'fail') return false;
        if (r === 'walking') return undefined;
        if (mobDist(p, q) > 1.5) return undefined;
      }
      j.step = 'work'; j.work = 0;
    }
    p.status = `Tending ${q.name}`;
    if (j.step === 'work') {
      j.work += workRate(p, 'heal');
      gainXp(s, p, 'heal');
      if (j.work < 40) return undefined;
      q.tendAt = s.t; q.bleed = false;
      q.tendQ = Math.min(0.9, 0.3 + p.skills.heal * 0.05 + (j.hasMed ? 0.3 : 0));
      log(s, `${p.name} tended ${q.name}${j.hasMed ? ' with medicine' : ''}.`, 'good');
      if (q.downed && q.food < 0.5) {
        const f = nearestItem(s, q, distanceMap(p.at, pass(s)), FOODS, { reserveCheck: false, score: (it) => (ITEMS[it.k].food === 'meal' ? 0 : 10) });
        if (f) { const got = takeAt(s, f.i, 1); q.food = Math.min(1, q.food + ITEMS[got.k].nut); }
      }
      // Carry someone who is down to a bed.
      if (!q.downed || bAt(s, q.at)?.k === 'bed') return true;
      const bed = bedFor(s, q);
      if (!bed) return true;
      const st = standFor(bed.i, distanceMap(p.at, pass(s)), pass(s));
      if (!st) return true;
      q.carriedBy = p.id; q.bed = bed.id;
      j.step = 'carry'; j.at = bed.i;
      return undefined;
    }
    // carry
    p.status = `Carrying ${q.name} to bed`;
    if (!q.downed) { q.carriedBy = null; return true; }
    const r = travel(s, p, j);
    q.x = p.x; q.y = p.y - 0.3; q.at = p.at;
    if (r === false) { q.carriedBy = null; q.y = p.y; return false; }
    if (r === undefined) return undefined;
    q.carriedBy = null; q.x = p.x; q.y = p.y; q.at = p.at;
    q.sleeping = true;
    return true;
  },
  fire(s, p, j) {
    if (!s.fire[j.tile]) return true;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    p.status = 'Beating out a fire';
    s.fire[j.tile] -= 0.03 * workRate(p, null);
    if (s.fire[j.tile] <= 0) {
      delete s.fire[j.tile]; markTile(s, j.tile);
      note(s, { type: 'fireOut', by: p.id });
      return true;
    }
    return undefined;
  },
  cook(s, p, j) {
    const stn = s.blds[j.station];
    if (!stn || !stn.done || stn.fuel <= 0) return false;
    if (j.step === 'fetch') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      const it = s.items[j.src];
      if (!it || ITEMS[it.k].food !== 'raw') return false;
      p.carry = takeAt(s, j.src, 4);
      unreserve(s, j.res2, p.id);
      j.step = 'go'; j.at = stn.i; j.work = 0;
    }
    if (j.step === 'go') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      j.step = 'work';
    }
    p.status = 'Cooking';
    j.work += workRate(p, 'cook');
    gainXp(s, p, 'cook');
    if (j.work < BUILDS[stn.k].cook * Math.max(1, p.carry.n) * 0.6) return undefined;
    const n = p.carry.n;
    p.carry = null;
    dropNear(s, stn.i, 'meal', n);
    s.stats.meals += n;
    note(s, { type: 'cooked', n });
    return true;
  },
  build(s, p, j) {
    const b = s.blds[j.b];
    if (!b || b.done) return true;
    if (j.step === 'fetch') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      const it = s.items[j.src];
      if (!it || it.k !== j.k) return false;
      p.carry = takeAt(s, j.src, Math.min(CARRY, missing(b)[j.k] || 0));
      unreserve(s, j.res2, p.id);
      if (!p.carry || !p.carry.n) { p.carry = null; return false; }
      const st = standFor(b.i, distanceMap(p.at, pass(s)), pass(s), !BUILDS[b.k].block && !BUILDS[b.k].door);
      if (!st) return false;
      j.step = 'deliver'; j.at = st.at;
    }
    if (j.step === 'deliver') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      b.have[p.carry.k] = (b.have[p.carry.k] || 0) + p.carry.n;
      p.carry = null;
      markTile(s, b.i);
      if (Object.keys(missing(b)).length) return true; // more to fetch: think again
      j.step = 'work';
    }
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    if (BUILDS[b.k].block && s.mobs.some((m) => !m.dead && m.at === b.i && m !== p)) { j.wait = (j.wait || 0) + 1; return j.wait > 200 ? false : undefined; }
    if (s.plant[b.i]) {
      const pl = PLANTS[s.plant[b.i]];
      if (pl.item === 'wood') dropNear(s, b.i, 'wood', pl.n - 2);
      s.plant[b.i] = P.NONE; markTile(s, b.i);
    }
    p.status = `Building a ${BUILDS[b.k].name.toLowerCase()}`;
    b.work += workRate(p, 'build');
    gainXp(s, p, 'build');
    if (b.work < BUILDS[b.k].work) return undefined;
    completeBuilding(s, b);
    note(s, { type: 'built', k: b.k, i: b.i });
    if (BUILDS[b.k].block && p.at === b.i) { /* nudged by completeBuilding */ }
    return true;
  },
  remove(s, p, j) {
    const b = bAt(s, j.tile);
    if (!b || s.des[j.tile] !== 'remove') return true;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    j.work += workRate(p, 'build');
    if (j.work < BUILDS[b.k].work * 0.5) return undefined;
    delete s.des[j.tile];
    removeBuilding(s, b, 0.75);
    return true;
  },
  sow(s, p, j) {
    if (s.zone[j.tile] !== Z.FARM || s.crop[j.tile] >= 0 || s.bld[j.tile]) return false;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    if (s.plant[j.tile]) { j.work += workRate(p, null) * 0.5; if (j.work < 30) return undefined; const pl = PLANTS[s.plant[j.tile]]; if (pl.item === 'wood') dropNear(s, j.tile, 'wood', 3); s.plant[j.tile] = P.NONE; j.work = 0; markTile(s, j.tile); }
    j.work += workRate(p, 'farm');
    gainXp(s, p, 'farm');
    if (j.work < 16) return undefined;
    s.crop[j.tile] = 0; markTile(s, j.tile);
    return true;
  },
  reap(s, p, j) {
    if (s.crop[j.tile] < 1) return false;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    j.work += workRate(p, 'farm');
    gainXp(s, p, 'farm');
    if (j.work < 22) return undefined;
    s.crop[j.tile] = -1; markTile(s, j.tile);
    dropNear(s, j.tile, 'crop', 5 + (p.skills.farm >= 6 ? 1 : 0));
    s.stats.harvests++;
    note(s, { type: 'harvest' });
    return true;
  },
  cut(s, p, j) {
    const d = s.des[j.tile];
    if (!d) return true;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    const i = j.tile;
    let work; let item; let n;
    if (d === 'mine') {
      const rk = ROCKS[s.ter[i]];
      if (!rk) { delete s.des[i]; return true; }
      work = rk.work; item = rk.item; n = rk.n;
    } else {
      const pl = PLANTS[s.plant[i]];
      if (!pl) { delete s.des[i]; return true; }
      work = pl.work; item = pl.item; n = pl.n;
    }
    p.status = d === 'mine' ? 'Mining' : d === 'chop' ? 'Chopping a tree' : 'Harvesting';
    j.work += workRate(p, d === 'harvest' ? 'farm' : null);
    if (d === 'harvest') gainXp(s, p, 'farm', 0.5);
    if (j.work < work) return undefined;
    if (d === 'mine') { s.ter[i] = T.DIRT; delete s.des[i]; roomsChanged(s); near(i, (k) => markTile(s, k)); }
    else if (d === 'chop') { s.plant[i] = P.NONE; delete s.des[i]; }
    else { s.pgrow[i] = PLANTS[s.plant[i]].regrow * TPD; }
    markTile(s, i);
    dropNear(s, i, item, n);
    return true;
  },
  craft(s, p, j) {
    const bench = s.blds[j.bench];
    if (!bench || !bench.done || !(s.bills[j.rec] > 0)) { dropHave(s, p, j); return false; }
    const need = RECIPES[j.rec].need;
    if (j.step === 'next') {
      const k = Object.keys(need).find((m) => (j.have[m] || 0) < need[m]);
      if (!k) { j.step = 'work'; j.at = bench.i; j.work = 0; }
      else {
        const src = nearestItem(s, p, distanceMap(p.at, pass(s)), [k]);
        if (!src) { dropHave(s, p, j); return false; }
        j.step = 'fetch'; j.k = k; j.src = src.i; j.at = src.at;
      }
    }
    if (j.step === 'fetch') {
      const r = travel(s, p, j);
      if (r === false) { dropHave(s, p, j); return false; }
      if (r === undefined) return undefined;
      const it = s.items[j.src];
      if (!it || it.k !== j.k) { j.step = 'next'; return undefined; }
      const got = takeAt(s, j.src, need[j.k] - (j.have[j.k] || 0));
      j.have[j.k] = (j.have[j.k] || 0) + got.n;
      j.step = 'next';
      return undefined;
    }
    const r = travel(s, p, j);
    if (r === false) { dropHave(s, p, j); return false; }
    if (r === undefined) return undefined;
    p.status = `Making ${RECIPES[j.rec].name.toLowerCase()}`;
    j.work += workRate(p, 'craft');
    gainXp(s, p, 'craft');
    if (j.work < RECIPES[j.rec].work) return undefined;
    s.bills[j.rec]--;
    j.have = {};
    dropNear(s, bench.i, j.rec, 1);
    log(s, `${p.name} made ${j.rec === 'tools' ? 'a set of tools' : `a ${RECIPES[j.rec].name.toLowerCase()}`}.`, 'good', bench.i);
    note(s, { type: 'crafted', k: j.rec });
    return true;
  },
  radio(s, p, j) {
    const b = s.blds[j.b];
    if (!b || !b.done || s.radio.called) return true;
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    p.status = 'Calling for rescue';
    s.radio.hours += workRate(p, 'craft') / TPH;
    gainXp(s, p, 'craft', 0.3);
    if (s.radio.hours < RADIO_HOURS) return undefined;
    s.radio.called = true;
    s.radio.rescueAt = s.t + RESCUE_DAYS * TPD;
    log(s, `Contact! A ship will land in ${RESCUE_DAYS} days. Hold on until then.`, 'good', b.i);
    note(s, { type: 'radioCalled' });
    for (const q of settlers(s)) addThought(s, q, 'rescued');
    return true;
  },
  refuel(s, p, j) {
    const b = s.blds[j.station];
    if (!b || !b.done) return false;
    if (j.step === 'fetch') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      const it = s.items[j.src];
      if (!it || it.k !== 'wood') return false;
      p.carry = takeAt(s, j.src, Math.ceil(FUEL_MAX - b.fuel));
      unreserve(s, j.res2, p.id);
      j.step = 'go'; j.at = b.i;
    }
    const r = travel(s, p, j);
    if (r !== 'here') return r;
    const add = Math.min(p.carry.n, Math.ceil(FUEL_MAX - b.fuel));
    const wasOut = b.fuel <= 0;
    b.fuel = Math.min(FUEL_MAX, b.fuel + add);
    p.carry.n -= add;
    if (p.carry.n <= 0) p.carry = null;
    if (wasOut) roomsChanged(s);
    markTile(s, b.i);
    return true;
  },
  haul(s, p, j) {
    if (j.step === 'fetch') {
      const r = travel(s, p, j);
      if (r !== 'here') return r;
      const it = s.items[j.src];
      if (!it) return false;
      const room = roomFor(s, j.dst, it.k);
      if (room <= 0) return false;
      p.carry = takeAt(s, j.src, Math.min(CARRY, room));
      unreserve(s, j.res, p.id);
      j.step = 'go'; j.at = j.dst;
    }
    const r = travel(s, p, j);
    if (r === false) return false;
    if (r === undefined) return undefined;
    const room = roomFor(s, j.dst, p.carry.k);
    const put = Math.min(room, p.carry.n);
    if (put > 0) addAt(s, j.dst, p.carry.k, put, p.carry.r || 0);
    p.carry.n -= put;
    if (p.carry.n <= 0) p.carry = null;
    return true;
  },
};

function bedFor(s, q) {
  const own = q.bed && s.blds[q.bed]?.done ? s.blds[q.bed] : null;
  if (own) return own;
  const owned = new Set(settlers(s).filter((o) => o !== q && o.bed).map((o) => o.bed));
  return builtOf(s, 'bed').find((b) => !owned.has(b.id)) || null;
}

function dropHave(s, p, j) {
  for (const [k, n] of Object.entries(j.have || {})) if (n > 0) dropNear(s, p.at, k, n);
  j.have = {};
}

function chat(s, p) {
  const o = settlers(s).find((q) => q !== p && !q.downed && !q.sleeping && mobDist(p, q) < 2.5);
  if (!o || !chance(s, 0.35)) return;
  let d = rand(s, -1, 6);
  if (has(o, 'kind') || has(p, 'kind')) d += 3;
  if (has(o, 'abrasive') || has(p, 'abrasive')) d -= 6;
  const before = p.rel[o.id] || 0;
  for (const [a, b] of [[p, o], [o, p]]) a.rel[b.id] = Math.max(-100, Math.min(100, (a.rel[b.id] || 0) + d));
  if (d < -2) { addThought(s, p, 'argue'); addThought(s, o, 'argue'); }
  else { addThought(s, p, 'chat'); addThought(s, o, 'chat'); }
  const after = p.rel[o.id];
  if (before < 30 && after >= 30) { log(s, `${p.name} and ${o.name} are now friends.`, 'good'); addThought(s, p, 'friend'); addThought(s, o, 'friend'); }
  if (before > -30 && after <= -30) log(s, `${p.name} and ${o.name} can't stand each other.`, 'bad');
  if (before < 75 && after >= 75) { log(s, `${p.name} and ${o.name} are best friends.`, 'good'); note(s, { type: 'bestFriends' }); }
  note(s, { type: 'chat', a: p.id, b: o.id, good: d >= -2 });
}

export { FIND, RUN };
