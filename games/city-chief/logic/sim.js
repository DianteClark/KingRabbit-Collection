// City Chief simulation. Pure logic: the scene calls tick() with game minutes and draws the state.
// Everything in `state` is plain JSON so a whole career can be saved and resumed.
import { buildCity, findPath, nearestRoad, DISTRICTS, ROAD_X, ROAD_Y, districtAt } from './city.js';
import { mulberry, pick, between, chance } from './rng.js';
import { FIRST, LAST, RANKS, STREETS_H, STREETS_V, SHOPS, GROUP_TYPES, CALLS, CALL_WEIGHTS, MAYOR } from './data.js';
import { MAJORS } from './majors.js';

export const DAY_START = 6 * 60;      // the day (and the newspaper) turns over at 6:00
export const SPEED = { patrol: 0.55, respond: 1.25, chase: 1.5, truck: 1.1 };
export const CAREER_DAYS = 30;

let CITY = null;
export const city = () => (CITY ||= buildCity());

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const MODES = {
  career: { crime: 1, death: 1, budget: 1, floor: -Infinity, label: 'Career' },
  endless: { crime: 0.75, death: 0.4, budget: 1.2, floor: 10, label: 'Endless' },
};

// ---------------------------------------------------------------- setup

function newOfficer(s, rank, rng) {
  const skill = { rookie: 0.2, officer: 0.45 + rng() * 0.25, sergeant: 0.85, detective: 0.9 }[rank];
  const o = {
    id: s.seq++, name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`, rank, skill: +skill.toFixed(2), xp: rank === 'rookie' ? 0 : 40,
    morale: 70, years: rank === 'rookie' ? 0 : between(rng, 2, rank === 'sergeant' ? 22 : 18), status: 'active', injured: 0,
    calls: 0, solved: 0, caseId: null, rideAlong: null,
  };
  return o;
}

export function newGame(mode = 'career', seed = Date.now() % 2147483647) {
  const rng = mulberry(seed);
  const m = MODES[mode];
  const s = {
    version: 1, mode, seed, rng: 0, seq: 1,
    day: 1, minute: DAY_START, money: 2500, budget: Math.round(1100 * m.budget),
    trust: 60, safety: 60, payLevel: 0, carLevel: 0, gearLevel: 0, trainLevel: 0, fireLevel: 0,
    cars: 4, outreachDay: 0,
    districts: Object.fromEntries(DISTRICTS.map((d) => [d.id, { crime: d.id === 'harbor' || d.id === 'eastside' ? 38 : 24 }])),
    officers: [], units: [], incidents: [], fires: [], trucks: [], groups: [],
    log: [], today: null, pendingMajor: null, majorsToday: [], paper: null, briefing: [],
    nextMayor: 3, demand: null, over: null, won: false, stats: { calls: 0, solved: 0, deaths: 0, days: 0, groupsBusted: 0 },
  };
  s.officers.push(newOfficer(s, 'sergeant', rng));
  s.officers.push(newOfficer(s, 'detective', rng));
  for (let k = 0; k < 4; k++) s.officers.push(newOfficer(s, 'officer', rng));
  s.officers.push(newOfficer(s, 'rookie', rng));
  s.rng = rng.state();
  startDay(s, rng);
  s.rng = rng.state();
  return s;
}

const rngOf = (s) => { const r = mulberry(0); r.setState(s.rng); return r; };

function freshToday() {
  return { calls: 0, solved: 0, failed: 0, injuries: 0, deaths: 0, response: [], notable: [], fires: 0, firesLost: 0, trust0: 0, safety0: 0 };
}

// ---------------------------------------------------------------- officers and units

export const activeOfficers = (s) => s.officers.filter((o) => o.status === 'active' && !o.injured);
export const label = (o) => `${RANKS[o.rank].short} ${o.name.split(' ')[1]}`;

export function officerPower(o) {
  return (0.5 + o.skill) * (0.6 + 0.4 * o.morale / 100) * (o.rank === 'sergeant' ? 1.25 : 1);
}

export function unitPower(s, u) {
  const crew = u.crew.map((id) => s.officers.find((o) => o.id === id)).filter((o) => o && o.status === 'active' && !o.injured);
  if (!crew.length) return 0;
  const [lead, ...rest] = crew.sort((a, b) => officerPower(b) - officerPower(a));
  const p = officerPower(lead) + rest.reduce((a, o) => a + officerPower(o) * 0.5, 0);
  return p * (1 + 0.1 * s.carLevel) + 0.12 * s.gearLevel + 0.05 * s.trainLevel;
}

/** Put the best patrol officers in the cars (partners ride two-up), keeping units where they are. */
export function crewCars(s) {
  const pool = activeOfficers(s).filter((o) => o.rank !== 'detective' && !(o.rideAlong != null && o.rank === 'rookie'))
    .sort((a, b) => officerPower(b) - officerPower(a));
  const hq = city().landmark('hq').door;
  while (s.units.length < s.cars) {
    s.units.push({ id: s.seq++, x: hq.x, y: hq.y, dir: 'D', path: [], task: { type: 'patrol' }, zone: null, crew: [] });
  }
  while (s.units.length > s.cars) s.units.pop();
  // Only re-crew units that aren't busy on a call.
  const busy = new Set(s.units.filter((u) => u.task.type !== 'patrol' && u.task.type !== 'return').flatMap((u) => u.crew));
  const free = pool.filter((o) => !busy.has(o.id));
  const idle = s.units.filter((u) => u.task.type === 'patrol' || u.task.type === 'return');
  idle.forEach((u) => { u.crew = []; });
  idle.forEach((u) => { const o = free.shift(); if (o) u.crew.push(o.id); });
  idle.forEach((u) => { if (free.length && u.crew.length) u.crew.push(free.shift().id); });
  // A car with nobody to drive it stays parked at HQ.
}

const crewed = (u) => u.crew.length > 0;
export const freeUnits = (s) => s.units.filter((u) => crewed(u) && (u.task.type === 'patrol' || u.task.type === 'return'));

// ---------------------------------------------------------------- movement

function setRoute(u, to) {
  const from = { x: Math.round(u.x), y: Math.round(u.y) };
  const onRoad = city().roads.has(`${from.x},${from.y}`) ? from : nearestRoad(city().roads, u.x, u.y);
  const p = findPath(city().roads, onRoad, to) || [to];
  u.path = p.slice(1);
  if (!u.path.length) u.path = [];
}

/** Move along the path by `dist` tiles; returns true when the path is finished. */
function advance(u, dist) {
  while (dist > 0 && u.path.length) {
    const t = u.path[0];
    const dx = t.x - u.x; const dy = t.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) u.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
    if (d <= dist) { u.x = t.x; u.y = t.y; u.path.shift(); dist -= d; } else { u.x += (dx / d) * dist; u.y += (dy / d) * dist; dist = 0; }
  }
  return u.path.length === 0;
}

function randomRoadIn(s, rng, zone) {
  const pts = [...city().roads.values()].filter((p) => !zone || districtAt(p.y) === zone);
  const p = pick(rng, pts);
  return { x: p.x, y: p.y };
}

// ---------------------------------------------------------------- log and notables

function say(s, text, opts = {}) {
  s.log.push({ day: s.day, t: Math.floor(s.minute), text, inc: opts.inc ?? null, tone: opts.tone || 'info' });
  if (s.log.length > 80) s.log.shift();
}

function incLog(s, inc, text) { inc.log.push({ t: Math.floor(s.minute), text }); }

function notable(s, score, headline, sub) { s.today.notable.push({ score, headline, sub }); }

export const clock = (min) => {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function streetAt(p) {
  if (ROAD_Y.includes(p.y)) return STREETS_H[ROAD_Y.indexOf(p.y)];
  if (ROAD_X.includes(p.x)) return STREETS_V[ROAD_X.indexOf(p.x)];
  return 'a side street';
}

// ---------------------------------------------------------------- incidents

function groupIn(s, district) { return s.groups.filter((g) => g.district === district); }

function pickCallType(s, rng, district) {
  const groups = groupIn(s, district);
  const crime = s.districts[district].crime;
  const weights = Object.entries(CALL_WEIGHTS).map(([k, w]) => {
    const c = CALLS[k];
    let x = w;
    if (c.gang) x *= (0.4 + crime / 60) * (1 + groups.reduce((a, g) => a + g.strength / 40, 0));
    if (k === 'drugdeal' && groups.some((g) => g.type === 'drugs')) x *= 2.5;
    if ((k === 'shooting' || k === 'robbery') && groups.some((g) => g.type === 'mob' || g.type === 'mafia')) x *= 2;
    if (k === 'gangfight' && groups.some((g) => g.type === 'gang')) x *= 2.5;
    if (s.day <= 1 && (k === 'shooting' || k === 'gangfight')) x *= 0.2;
    return [k, x];
  });
  let r = rng() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of weights) { r -= w; if (r <= 0) return k; }
  return 'noise';
}

export function spawnIncident(s, rng, type, district, extra = {}) {
  const c = CALLS[type];
  const lots = city().lots.filter((l) => l.district === district && l.kind === 'building');
  const lot = pick(rng, lots);
  const n = c.n ? between(rng, c.n[0], c.n[1]) : 1;
  const group = groupIn(s, district)[0];
  const ctx = { street: streetAt(lot.door), shop: pick(rng, SHOPS), n, group: group?.name };
  const inc = {
    id: s.seq++, type, name: c.name, d: c.d(n), n, district, lot: lot.id, door: lot.door, text: c.text(ctx),
    t0: s.minute, expires: s.minute + c.patience, status: 'new', units: [], arrived: 0, sceneEnd: 0,
    autoAt: s.minute + (c.d(n) >= 2 ? 10 : 3), log: [], outcome: null, groupId: group?.id ?? null, ...extra,
  };
  incLog(s, inc, `Call: ${inc.text}`);
  s.incidents.push(inc);
  s.today.calls++;
  return inc;
}

/** Send `count` more of the nearest free units to an incident. Returns how many went. */
export function dispatch(s, incId, count, byChief = false) {
  const inc = s.incidents.find((i) => i.id === incId);
  if (!inc || inc.status === 'done') return 0;
  const free = freeUnits(s).sort((a, b) => Math.hypot(a.x - inc.door.x, a.y - inc.door.y) - Math.hypot(b.x - inc.door.x, b.y - inc.door.y));
  const go = free.slice(0, count);
  for (const u of go) {
    u.task = { type: 'respond', inc: inc.id };
    if (inc.status === 'chase' && inc.suspect) setRoute(u, { x: Math.round(inc.suspect.x), y: Math.round(inc.suspect.y) });
    else setRoute(u, inc.door);
    inc.units.push(u.id);
    const names = u.crew.map((id) => label(s.officers.find((o) => o.id === id))).join(' & ');
    incLog(s, inc, `Unit ${u.id} (${names}) responding.`);
  }
  if (go.length && (inc.status === 'new')) inc.status = 'enroute';
  if (go.length) inc.chosen = true;
  if (go.length && byChief) inc.chief = true;
  return go.length;
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const successChance = (power, d) => sigmoid((power - d) * 1.8 + 0.9);

function scenePower(s, inc) {
  return s.units.filter((u) => u.task.inc === inc.id && u.task.type === 'scene').reduce((a, u) => a + unitPower(s, u), 0);
}

function releaseUnits(s, inc) {
  for (const u of s.units) {
    if (u.task.inc === inc.id) { u.task = { type: 'return' }; u.path = []; }
  }
}

function crewOf(s, inc) {
  return s.units.filter((u) => u.task.inc === inc.id && (u.task.type === 'scene' || u.task.type === 'chase'))
    .flatMap((u) => u.crew).map((id) => s.officers.find((o) => o.id === id)).filter(Boolean);
}

function hurtOfficers(s, rng, inc, crew, risk, power) {
  const m = MODES[s.mode];
  const events = [];
  for (const o of crew) {
    const p = risk * 0.45 * (inc.outcome === 'solved' ? 0.5 : 1) * (inc.d / (power + inc.d)) * (1 - 0.22 * s.gearLevel);
    if (!chance(rng, p)) continue;
    if (chance(rng, 0.14 * m.death * (1 - 0.25 * s.gearLevel))) {
      o.status = 'dead'; s.today.deaths++; s.stats.deaths++;
      incLog(s, inc, `${label(o)} was killed in the line of duty.`);
      say(s, `OFFICER DOWN: ${label(o)} killed at the ${inc.name.toLowerCase()} call.`, { inc: inc.id, tone: 'bad' });
      notable(s, 14, `Officer ${o.name} killed in the line of duty`, `${o.name} died responding to a ${inc.name.toLowerCase()} in ${districtName(inc.district)}.`);
      for (const x of s.officers) if (x.status === 'active') x.morale = clamp(x.morale - 12, 0, 100);
      queueMajor(s, 'officerDown', { officer: o.id, inc: inc.id, district: inc.district, door: inc.door });
      events.push({ kind: 'death', inc: inc.id });
    } else {
      o.injured = between(rng, 1, 3); s.today.injuries++;
      incLog(s, inc, `${label(o)} was hurt and taken to Mercy Hospital.`);
      say(s, `${label(o)} injured at a ${inc.name.toLowerCase()}.`, { inc: inc.id, tone: 'bad' });
      events.push({ kind: 'ambulance', door: inc.door });
    }
  }
  return events;
}

export const districtName = (id) => DISTRICTS.find((d) => d.id === id)?.name || id;

function finish(s, rng, inc, ok, why) {
  const events = [];
  const crew = crewOf(s, inc);
  const power = scenePower(s, inc) || 0.5;
  inc.status = 'done'; inc.outcome = ok ? 'solved' : 'failed'; inc.doneAt = s.minute;
  const dist = s.districts[inc.district];
  const c = CALLS[inc.type];
  if (inc.special) {
    incLog(s, inc, why || (ok ? 'Caught.' : 'They got away.'));
    say(s, `${inc.name}: ${ok ? 'suspects caught!' : 'they got away.'}`, { inc: inc.id, tone: ok ? 'good' : 'bad' });
    releaseUnits(s, inc);
    return [{ kind: ok ? 'solved' : 'failed', inc: inc.id }];
  }
  if (c.risk) events.push(...hurtOfficers(s, rng, inc, crew, c.risk, power));
  if (ok) {
    s.today.solved++; s.stats.solved++;
    dist.crime = clamp(dist.crime - inc.d * 1.2, 0, 100);
    s.safety = clamp(s.safety + 0.2 * inc.d, 0, 100);
    s.trust = clamp(s.trust + 0.05 * inc.d, 0, 100);
    for (const o of crew) { o.xp += 6 * inc.d * (o.rank === 'rookie' ? 2 : 1) * (1 + 0.25 * s.trainLevel); o.skill = +Math.min(1.6, o.skill + 0.008 * inc.d).toFixed(3); o.solved++; o.morale = clamp(o.morale + 0.6, 0, 100); }
    const g = s.groups.find((x) => x.id === inc.groupId);
    if (g && c.gang) g.strength = Math.max(5, g.strength - inc.d);
    incLog(s, inc, why || 'Suspects in custody. Call closed.');
    // Sending a whole fleet to a noise complaint looks heavy-handed.
    if (inc.d <= 1 && inc.units.length >= 3) {
      s.trust = clamp(s.trust - 0.8, 0, 100);
      incLog(s, inc, 'Residents complained about the number of squad cars.');
      notable(s, 2, `${inc.units.length} squad cars for a ${inc.name.toLowerCase()}?`, 'Residents question whether the department is wasting resources.');
    }
    if (inc.d >= 3) notable(s, 4 + inc.d, `Police stop ${inc.name.toLowerCase()} in ${districtName(inc.district)}`, inc.text);
    events.push({ kind: 'solved', inc: inc.id });
  } else {
    s.today.failed++;
    dist.crime = clamp(dist.crime + inc.d * 1.5, 0, 100);
    s.safety = clamp(s.safety - 0.55 * inc.d, 0, 100);
    s.trust = clamp(s.trust - 0.15 * inc.d, 0, 100);
    for (const o of crew) o.morale = clamp(o.morale - 1, 0, 100);
    const g = s.groups.find((x) => x.id === inc.groupId);
    if (g) g.strength = Math.min(100, g.strength + 1.5);
    incLog(s, inc, why || 'Suspects escaped.');
    if (inc.d >= 3) notable(s, 3 + inc.d, `${inc.name} in ${districtName(inc.district)}: suspects still at large`, inc.text);
    events.push({ kind: 'failed', inc: inc.id });
  }
  for (const o of crew) o.calls++;
  if (c.ambulance && (inc.type === 'accident' || chance(rng, 0.5))) events.push({ kind: 'ambulance', door: inc.door });
  say(s, `${inc.name} (${districtName(inc.district)}): ${ok ? 'solved' : 'failed'}.`, { inc: inc.id, tone: ok ? 'good' : 'bad' });
  releaseUnits(s, inc);
  // Hurt officers leave their cars; spare officers take their place.
  if (events.some((e) => e.kind === 'death' || e.kind === 'ambulance')) {
    for (const u of s.units) u.crew = u.crew.filter((id) => { const o = s.officers.find((x) => x.id === id); return o && o.status === 'active' && !o.injured; });
    crewCars(s);
  }
  return events;
}

function startScene(s, rng, inc) {
  inc.status = 'scene';
  inc.arrived = s.minute;
  const c = CALLS[inc.type];
  inc.sceneEnd = s.minute + between(rng, c.dur[0], c.dur[1]);
  s.today.response.push(s.minute - inc.t0);
  incLog(s, inc, `First unit on scene after ${Math.round(s.minute - inc.t0)} minutes.`);
}

function startChase(s, rng, inc) {
  inc.status = 'chase';
  const units = s.units.filter((u) => u.task.inc === inc.id);
  const p = clamp(0.3 + 0.13 * units.length + 0.12 * s.carLevel - 0.06 * inc.d, 0.1, 0.92);
  inc.chase = { caught: chance(rng, p), end: s.minute + between(rng, 14, 30), p };
  const start = inc.door;
  inc.suspect = { x: start.x, y: start.y, dir: 'R', path: [], car: between(rng, 2, 13) };
  units.forEach((u) => { u.task = { type: 'chase', inc: inc.id }; });
  incLog(s, inc, 'Suspects fled in a car! Units in pursuit.');
  say(s, `Car chase in ${districtName(inc.district)}!`, { inc: inc.id, tone: 'alert' });
  return [{ kind: 'chase', inc: inc.id }];
}

function stepIncident(s, rng, inc) {
  const events = [];
  if (inc.status === 'done') return events;
  // The dispatcher handles calls the chief doesn't: one car, eventually.
  if (!inc.chosen && s.minute >= inc.autoAt && !inc.units.length) {
    if (dispatch(s, inc.id, 1)) incLog(s, inc, 'Dispatcher sent the nearest car.');
    else inc.autoAt = s.minute + 2;
    inc.chosen = inc.units.length > 0;
  }
  if ((inc.status === 'new' || inc.status === 'enroute') && s.minute > inc.expires) {
    events.push(...finish(s, rng, inc, false, inc.units.length ? 'Too late: suspects were gone when police arrived.' : 'No car was free in time. Suspects got away.'));
    return events;
  }
  if (inc.status === 'scene' && s.minute >= inc.sceneEnd) {
    const c = CALLS[inc.type];
    const power = scenePower(s, inc);
    const ok = chance(rng, successChance(power, inc.d));
    if (!ok && c.flee && chance(rng, c.flee * 1.4)) events.push(...startChase(s, rng, inc));
    else if (ok && c.flee && chance(rng, c.flee * 0.35)) events.push(...startChase(s, rng, inc));
    else events.push(...finish(s, rng, inc, ok));
  }
  if (inc.status === 'chase') {
    if (s.minute >= inc.chase.end) {
      events.push(...finish(s, rng, inc, inc.chase.caught, inc.chase.caught ? 'Suspect boxed in and arrested after the chase.' : 'The suspect lost the pursuit.'));
      if (inc.chase.caught && !inc.special) notable(s, 5, `Wild chase ends in arrest in ${districtName(inc.district)}`, `Officers ran down a fleeing ${inc.type === 'cartheft' ? 'car thief' : 'suspect'} after a pursuit through ${streetAt(inc.door)}.`);
      events.push({ kind: 'chaseEnd', inc: inc.id, caught: inc.chase.caught });
    }
  }
  return events;
}

// ---------------------------------------------------------------- fires

function spawnFire(s, rng) {
  const lot = pick(rng, city().lots.filter((l) => l.kind === 'building'));
  if (s.fires.some((f) => f.lot === lot.id)) return;
  const f = { id: s.seq++, lot: lot.id, door: lot.door, district: lot.district, t0: s.minute, sev: 10, status: 'burning', trucks: [], out: 0 };
  s.fires.push(f);
  s.today.fires++;
  say(s, `Fire reported on ${streetAt(lot.door)} (${districtName(lot.district)}). Fire department responding.`, { tone: 'alert' });
  const free = s.trucks.filter((t) => t.task.type === 'home' || t.task.type === 'return');
  const hq = city().landmark('fire').door;
  if (free.length < 1) {
    s.trucks.push({ id: s.seq++, x: hq.x, y: hq.y, dir: 'D', path: [], task: { type: 'home' } });
  }
  const t = s.trucks.find((x) => x.task.type === 'home' || x.task.type === 'return');
  if (t) { t.task = { type: 'fire', fire: f.id }; setRoute(t, f.door); f.trucks.push(t.id); }
}

function stepFire(s, rng, f, dt) {
  const events = [];
  if (f.status !== 'burning') return events;
  const onScene = s.trucks.filter((t) => t.task.type === 'fire' && t.task.fire === f.id && !t.path.length).length;
  if (onScene) f.sev -= dt * (2.2 + 1.2 * s.fireLevel) * onScene;
  else f.sev += dt * 0.9;
  if (f.sev >= 100) {
    f.status = 'lost'; f.out = s.minute;
    s.safety = clamp(s.safety - 4, 0, 100); s.trust = clamp(s.trust - 2, 0, 100); s.today.firesLost++;
    say(s, `A building on ${streetAt(f.door)} burned down.`, { tone: 'bad' });
    notable(s, 8, `Blaze destroys building on ${streetAt(f.door)}`, `Fire crews could not save the building in ${districtName(f.district)}.`);
    events.push({ kind: 'ambulance', door: f.door });
  } else if (f.sev <= 0) {
    f.status = 'out'; f.out = s.minute;
    say(s, `Firefighters put out the fire on ${streetAt(f.door)}.`, { tone: 'good' });
  }
  if (f.status !== 'burning') {
    for (const t of s.trucks) if (t.task.fire === f.id) { t.task = { type: 'return' }; setRoute(t, city().landmark('fire').door); }
  }
  return events;
}

// ---------------------------------------------------------------- crime groups

function spawnGroups(s, rng) {
  if (s.groups.length >= 4) return;
  for (const d of DISTRICTS) {
    if (s.groups.length >= 4) break;
    const crime = s.districts[d.id].crime;
    const patrol = s.units.filter((u) => u.zone === d.id).length;
    const p = (0.05 + crime / 260 - patrol * 0.03) * MODES[s.mode].crime;
    if (!chance(rng, p)) continue;
    const types = Object.entries(GROUP_TYPES).filter(([, t]) => s.day >= t.day);
    if (!types.length) continue;
    const [type, t] = chance(rng, 0.55) ? types.at(-1) : pick(rng, types);
    const used = new Set(s.groups.map((g) => g.name));
    const name = t.names.find((n) => !used.has(n)) || `${t.names[0]} II`;
    const g = { id: s.seq++, name, type, district: d.id, strength: t.strength, case: 0, detectives: [], since: s.day };
    s.groups.push(g);
    say(s, `${t.title} "${name}" moving into ${d.name}.`, { tone: 'bad' });
    notable(s, 9, `${name} move into ${d.name}`, `Residents report a new ${t.title.toLowerCase()} operating openly. Detectives can build a case against them.`);
  }
}

export function assignDetective(s, officerId, groupId) {
  const o = s.officers.find((x) => x.id === officerId);
  if (!o || o.rank !== 'detective') return;
  for (const g of s.groups) g.detectives = g.detectives.filter((id) => id !== officerId);
  o.caseId = groupId;
  const g = s.groups.find((x) => x.id === groupId);
  if (g) g.detectives.push(officerId);
}

/** Pair a rookie with a detective on a case (or null to end the ride-along). */
export function setRideAlong(s, rookieId, detectiveId) {
  const r = s.officers.find((x) => x.id === rookieId);
  if (!r) return;
  // One rookie per detective.
  if (detectiveId != null) for (const o of s.officers) if (o.rideAlong === detectiveId) o.rideAlong = null;
  r.rideAlong = detectiveId;
  crewCars(s);
}

// ---------------------------------------------------------------- majors

function queueMajor(s, kind, ctx = {}) {
  s.majorQueue ||= [];
  s.majorQueue.push({ kind, ctx });
}

function scheduleMajors(s, rng) {
  const m = MODES[s.mode];
  s.majorsToday = [];
  const at = () => s.dayStartedAt + between(rng, 90, 1200);
  const big = s.groups.some((g) => g.type === 'mob' || g.type === 'mafia');
  if (s.day >= 2 && chance(rng, (0.28 + (big ? 0.15 : 0)) * m.crime)) s.majorsToday.push({ kind: 'bank', at: at() });
  if (s.day >= 3 && chance(rng, 0.2 * m.crime)) s.majorsToday.push({ kind: 'hostage', at: at() });
  if (s.groups.length >= 2 && chance(rng, 0.35 * m.crime)) s.majorsToday.push({ kind: 'gangwar', at: at() });
  if (s.safety < 30 && chance(rng, 0.5)) s.majorsToday.push({ kind: 'riot', at: at() });
}

/** Units the chief can commit to a big event: everyone not already on a scene. */
export const committable = (s) => s.units.filter((u) => crewed(u) && !['scene', 'chase', 'event'].includes(u.task.type));

function openMajor(s, rng, kind, ctx) {
  const def = MAJORS[kind];
  const m = def.setup(s, rng, ctx, { city: city(), districtName, streetAt, pick, label });
  if (!m) return null;
  s.pendingMajor = { kind, ...m, id: s.seq++ };
  say(s, `${m.title}!`, { tone: 'alert' });
  return s.pendingMajor;
}

/** The chief picks an option for the pending big event. Returns the result to show. */
export function resolveMajor(s, choice) {
  const rng = rngOf(s);
  const pm = s.pendingMajor;
  if (!pm) return null;
  const def = MAJORS[pm.kind];
  const opt = pm.choices[choice];
  const units = committable(s).slice(0, opt.units || 0);
  const power = units.reduce((a, u) => a + unitPower(s, u), 0);
  const res = def.resolve(s, rng, pm, opt, { units, power, clamp, chance, notable: (...a) => notable(s, ...a), say: (t, o) => say(s, t, o), label, districtName });
  for (const u of units) {
    u.task = { type: 'event', until: s.minute + (opt.busy || 120) };
    setRoute(u, pm.door);
  }
  if (res.cost) s.money -= res.cost;
  if (res.hurt && units.length) {
    const o = s.officers.find((x) => x.id === units[Math.floor(rng() * units.length)].crew[0]);
    if (o && o.status === 'active') { o.injured = 2; say(s, `${label(o)} was hurt during the ${pm.title.toLowerCase()}.`, { tone: 'bad' }); }
  }
  if (res.chase) {
    const inc = spawnIncident(s, rng, 'cartheft', pm.district, {
      name: res.chase.name, text: res.chase.text, d: 3, chosen: true, special: true,
    });
    inc.status = 'scene'; inc.sceneEnd = s.minute;
    inc.units = units.map((u) => u.id);
    units.forEach((u) => { u.task = { type: 'chase', inc: inc.id }; });
    inc.status = 'chase';
    inc.chase = { caught: res.chase.caught, end: s.minute + between(rng, 15, 30) };
    inc.suspect = { x: pm.door.x, y: pm.door.y, dir: 'R', path: [], car: 7 };
  }
  s.pendingMajor = null;
  s.rng = rng.state();
  checkOver(s);
  return { ...res, title: pm.title };
}

// ---------------------------------------------------------------- the clock

/** Advance the city by dt game minutes. Returns events for the scene (sounds, ambulances...). */
export function tick(s, dt) {
  if (s.over || s.pendingMajor || s.dayOver) return [];
  const rng = rngOf(s);
  const events = [];
  let left = dt;
  while (left > 0 && !s.pendingMajor && !s.dayOver && !s.over) {
    const step = Math.min(1, left);
    left -= step;
    const before = s.minute;
    s.minute += step;
    events.push(...minute(s, rng, step, before));
  }
  s.rng = rng.state();
  return events;
}

const hourFactor = (min) => {
  const h = Math.floor((min % 1440) / 60);
  if (h >= 22 || h < 4) return 1.45;
  if (h >= 6 && h < 11) return 0.65;
  return 1;
};

function minute(s, rng, dt, before) {
  const events = [];
  const m = MODES[s.mode];
  // New calls
  for (const d of DISTRICTS) {
    const g = groupIn(s, d.id).reduce((a, x) => a + x.strength / 90, 0);
    const perHour = 0.33 * (0.6 + s.districts[d.id].crime / 60) * hourFactor(s.minute) * (1 + g) * m.crime * (1 + Math.min(0.6, (s.day - 1) * 0.03));
    if (chance(rng, (perHour / 60) * dt)) {
      const inc = spawnIncident(s, rng, pickCallType(s, rng, d.id), d.id);
      events.push({ kind: 'call', inc: inc.id, big: inc.d >= 2 });
    }
  }
  if (chance(rng, (1.3 / 1440) * dt * (1 + s.day * 0.02))) { spawnFire(s, rng); events.push({ kind: 'fire' }); }
  // Scheduled big events
  for (const mj of s.majorsToday) {
    if (!mj.done && s.minute >= mj.at) {
      mj.done = true;
      if (openMajor(s, rng, mj.kind, {})) { events.push({ kind: 'major' }); return events; }
    }
  }
  if (s.majorQueue?.length && !s.pendingMajor) {
    const q = s.majorQueue.shift();
    if (openMajor(s, rng, q.kind, q.ctx)) { events.push({ kind: 'major' }); return events; }
  }
  // Units
  for (const u of s.units) {
    if (!crewed(u)) continue;
    const t = u.task;
    if (t.type === 'patrol') {
      if (!u.path.length) setRoute(u, randomRoadIn(s, rng, u.zone));
      advance(u, SPEED.patrol * dt);
      const d = districtAt(u.y);
      s.districts[d].crime = clamp(s.districts[d].crime - 0.012 * dt, 0, 100);
    } else if (t.type === 'return') {
      t.type = 'patrol';
    } else if (t.type === 'respond') {
      const inc = s.incidents.find((i) => i.id === t.inc);
      if (!inc || inc.status === 'done') { u.task = { type: 'patrol' }; continue; }
      if (inc.status === 'chase') { u.task = { type: 'chase', inc: inc.id }; continue; }
      if (advance(u, SPEED.respond * (1 + 0.15 * s.carLevel) * dt)) {
        u.task = { type: 'scene', inc: inc.id };
        if (inc.status === 'new' || inc.status === 'enroute') startScene(s, rng, inc);
      }
    } else if (t.type === 'chase') {
      const inc = s.incidents.find((i) => i.id === t.inc);
      if (!inc || inc.status !== 'chase') { u.task = { type: 'return' }; continue; }
      if (!u.path.length || chance(rng, 0.3)) setRoute(u, { x: Math.round(inc.suspect.x), y: Math.round(inc.suspect.y) });
      advance(u, SPEED.chase * (1 + 0.15 * s.carLevel) * dt);
    } else if (t.type === 'event') {
      advance(u, SPEED.respond * dt);
      if (s.minute >= t.until) u.task = { type: 'patrol' };
    }
  }
  // Suspects in chases drive away from the police.
  for (const inc of s.incidents) {
    if (inc.status !== 'chase') continue;
    const sp = inc.suspect;
    const caughtSoon = inc.chase.caught && s.minute > inc.chase.end - 3;
    if (!caughtSoon) {
      if (!sp.path.length) setRoute(sp, randomRoadIn(s, rng));
      advance(sp, SPEED.chase * 1.05 * dt);
    }
  }
  for (const inc of s.incidents) events.push(...stepIncident(s, rng, inc));
  // Keep finished calls on the map for a short while, then drop them.
  s.incidents = s.incidents.filter((i) => i.status !== 'done' || s.minute - i.doneAt < 25);
  // Fire trucks
  for (const t of s.trucks) {
    if (t.task.type === 'fire' || t.task.type === 'return') {
      if (advance(t, SPEED.truck * dt) && t.task.type === 'return') t.task = { type: 'home' };
    }
  }
  for (const f of s.fires) events.push(...stepFire(s, rng, f, dt));
  s.fires = s.fires.filter((f) => f.status === 'burning' || s.minute - f.out < 30);
  // Day over at 6:00
  if (s.minute - s.dayStartedAt >= 1440) s.dayOver = true;
  if (s.dayOver) events.push({ kind: 'dayOver' });
  checkOver(s);
  return events;
}

// ---------------------------------------------------------------- day turnover

function startDay(s, rng) {
  s.today = freshToday();
  s.today.trust0 = s.trust; s.today.safety0 = s.safety;
  s.dayStartedAt = s.minute;
  s.dayOver = false;
  crewCars(s);
  scheduleMajors(s, rng);
}

export const salaryOf = (s, o) => Math.round(RANKS[o.rank].pay * (1 + 0.15 * s.payLevel));
export const payroll = (s) => s.officers.filter((o) => o.status === 'active').reduce((a, o) => a + salaryOf(s, o), 0) + s.cars * 30;

/**
 * End the day: pay everyone, age officers, grow gangs, write the newspaper.
 * Returns { paper, briefing, meeting } for the day-end screens.
 */
export function endDay(s) {
  const rng = rngOf(s);
  const m = MODES[s.mode];
  const t = s.today;
  // Money
  const pay = payroll(s);
  s.money += s.budget - pay;
  // Officers
  const briefing = [];
  for (const o of s.officers) {
    if (o.status !== 'active') continue;
    o.years = +(o.years + 0.25).toFixed(2);
    if (o.injured) { o.injured--; if (!o.injured) briefing.push({ kind: 'info', text: `${label(o)} is back on duty after recovering.` }); }
    if (o.rank === 'rookie' && o.xp >= 60) { o.rank = 'officer'; briefing.push({ kind: 'info', text: `${o.name} finished probation and is now a full officer.` }); }
    if (o.years >= 25) {
      o.status = 'retired';
      briefing.push({ kind: 'info', text: `${label(o)} retires after ${Math.floor(o.years)} years of service. The department throws a send-off.` });
      s.trust = clamp(s.trust + 1, 0, 100);
      continue;
    }
    if (o.morale < 22 && chance(rng, 0.25)) {
      o.status = 'retired';
      briefing.push({ kind: 'bad', text: `${label(o)} quit, saying the job isn't worth it any more.` });
      continue;
    }
    if (o.rank === 'officer' && o.xp >= 400 && o.years >= 3 && !o.offered) { o.offered = true; briefing.push({ kind: 'promote', officer: o.id, text: `${o.name} has earned a promotion (${o.solved} calls solved).` }); }
    // Morale drifts toward what pay, gear and workload support.
    const target = 55 + 7 * s.payLevel + 4 * s.gearLevel - (t.deaths ? 10 : 0) - Math.max(0, (t.calls / Math.max(1, s.units.length)) - 14) * 2;
    o.morale = clamp(o.morale + (target - o.morale) * 0.3, 0, 100);
    if (o.rank === 'detective' && o.caseId == null) o.xp += 5;
  }
  // Detectives and ride-alongs work their cases
  for (const g of s.groups) {
    const dets = g.detectives.map((id) => s.officers.find((o) => o.id === id)).filter((o) => o && o.status === 'active' && !o.injured);
    g.detectives = dets.map((o) => o.id);
    let progress = 0;
    for (const d of dets) {
      progress += 14 + d.skill * 18;
      const r = s.officers.find((x) => x.rideAlong === d.id && x.status === 'active' && !x.injured);
      if (r) {
        progress += 7;
        r.xp += 30; r.skill = +Math.min(1.4, r.skill + 0.04).toFixed(3);
        if (chance(rng, 0.05 * (g.strength / 50) * m.death)) {
          r.injured = 2;
          briefing.push({ kind: 'bad', text: `${label(r)} was hurt on a ride-along with ${label(d)} watching ${g.name}.` });
        }
      }
    }
    g.case = Math.min(100, g.case + progress / (1 + g.strength / 60));
    if (!dets.length) g.strength = Math.min(100, g.strength + 3 + s.districts[g.district].crime / 30);
    else g.strength = Math.min(100, g.strength + 1);
    if (g.case >= 100 && !g.raidReady) { g.raidReady = true; briefing.push({ kind: 'good', text: `The case against ${g.name} is ready. Plan a raid from the Cases screen.` }); }
  }
  // Districts drift: more crime where gangs are.
  for (const d of DISTRICTS) {
    const g = groupIn(s, d.id).reduce((a, x) => a + x.strength, 0);
    s.districts[d.id].crime = clamp(s.districts[d.id].crime + 2 + g / 40, 0, 100);
  }
  spawnGroups(s, rng);
  // People forget good days quickly: safety slips a little every day, more with gangs around.
  s.safety = clamp(s.safety - 3 - s.groups.length * 1.2 - (s.safety > 80 ? 3 : 0), 0, 100);
  // The mayor's view moves with the city's safety.
  s.trust = clamp(s.trust + (s.safety - 55) / 16 - (s.trust > 85 ? 2 : 0), 0, 100);
  if (m.floor > 0) { s.trust = Math.max(m.floor, s.trust); s.safety = Math.max(m.floor, s.safety); }
  // Newspaper
  const paper = writePaper(s, rng, pay);
  s.paper = paper;
  s.stats.days = s.day;
  const meeting = s.day + 1 >= s.nextMayor;
  s.briefing = briefing;
  s.day++;
  if (s.mode === 'career' && s.day > CAREER_DAYS && !s.won) { s.won = true; }
  startDay(s, rng);
  s.rng = rng.state();
  checkOver(s);
  return { paper, briefing, meeting };
}

function writePaper(s, rng, pay) {
  const t = s.today;
  const top = [...t.notable].sort((a, b) => b.score - a.score);
  const resp = t.response.length ? Math.round(t.response.reduce((a, b) => a + b, 0) / t.response.length) : null;
  let headline; let sub;
  if (top.length) ({ headline, sub } = top[0]);
  else if (t.failed > t.solved) { headline = 'Crime wave leaves residents uneasy'; sub = `Police closed ${t.solved} of ${t.calls} calls yesterday.`; }
  else if (t.calls && t.solved >= t.calls * 0.8) { headline = 'Quiet streets as police keep a lid on crime'; sub = `Officers closed ${t.solved} of ${t.calls} calls.`; }
  else { headline = 'Another busy day for Tiny Town police'; sub = `${t.calls} calls, ${t.solved} solved.`; }
  const stories = top.slice(1, 4);
  const dTrust = s.trust - t.trust0; const dSafety = s.safety - t.safety0;
  const mood = s.trust > 70 ? `"The chief is doing a fine job," said ${MAYOR}.` : s.trust > 40 ? `${MAYOR} says he is "watching the numbers closely."` : `${MAYOR}'s office hints that "changes may be needed at the top."`;
  return {
    day: s.day, headline, sub, stories, mood,
    stats: { calls: t.calls, solved: t.solved, failed: t.failed, injuries: t.injuries, deaths: t.deaths, resp, fires: t.fires, firesLost: t.firesLost },
    money: { budget: s.budget, pay },
    dTrust, dSafety,
  };
}

// ---------------------------------------------------------------- mayor, money, promotions

export const MAYOR_OPTIONS = [
  { id: 'none', label: 'Ask for nothing', detail: 'Builds trust.' },
  { id: 'modest', label: 'Ask for a little more', detail: '+$150/day if he trusts you.' },
  { id: 'big', label: 'Push for a big increase', detail: '+$400/day, risky.' },
];

export function mayorMeeting(s, optionId) {
  const rng = rngOf(s);
  const out = [];
  // First, last meeting's demand.
  if (s.demand) {
    const now = s.districts[s.demand.district].crime;
    if (now <= s.demand.target) { s.trust = clamp(s.trust + 8, 0, 100); s.budget += 100; out.push(`"You did what I asked in ${districtName(s.demand.district)}. Good work." Trust up, +$100/day.`); }
    else { s.trust = clamp(s.trust - 8, 0, 100); out.push(`"I asked you to clean up ${districtName(s.demand.district)}. You didn't." Trust down.`); }
  }
  if (optionId === 'none') { s.trust = clamp(s.trust + 4, 0, 100); out.push('"I appreciate a chief who works with what they have."'); }
  if (optionId === 'modest') {
    if (s.trust >= 45 && s.budget < 3000) { s.budget += 150; s.trust = clamp(s.trust - 1, 0, 100); out.push('"Fine. A little more, but I want results." Budget +$150/day.'); }
    else { s.trust = clamp(s.trust - 3, 0, 100); out.push('"More money? Show me results first." Request denied.'); }
  }
  if (optionId === 'big') {
    if (s.budget < 3000 && chance(rng, s.trust / 160)) { s.budget += 400; s.trust = clamp(s.trust - 3, 0, 100); out.push('"This is a lot of money, Chief. Don\'t make me regret it." Budget +$400/day!'); }
    else { s.trust = clamp(s.trust - 9, 0, 100); out.push('The mayor storms out: "Absolutely not!" Trust down.'); }
  }
  // New demand: the worst district.
  const worst = DISTRICTS.map((d) => d.id).sort((a, b) => s.districts[b].crime - s.districts[a].crime)[0];
  const target = Math.max(10, Math.round(s.districts[worst].crime - 12));
  s.demand = { district: worst, target };
  out.push(`"Before we meet again, get crime in ${districtName(worst)} down to ${target}."`);
  s.nextMayor = s.day + 3;
  s.rng = rng.state();
  checkOver(s);
  return out;
}

export const SHOP = [
  { id: 'hire', label: 'Hire a rookie', detail: '+1 officer, $80/day', cost: () => 500 },
  { id: 'car', label: 'Buy a squad car', detail: '+1 car, $30/day', cost: () => 1000 },
  { id: 'cars', label: 'Interceptor upgrade', detail: 'Faster response, better chases', cost: (s) => (s.carLevel < 3 ? [1500, 2500, 3500][s.carLevel] : null), level: 'carLevel' },
  { id: 'gear', label: 'Vests and radios', detail: 'Fewer injuries, stronger units', cost: (s) => (s.gearLevel < 3 ? [1200, 2200, 3200][s.gearLevel] : null), level: 'gearLevel' },
  { id: 'train', label: 'Training program', detail: 'Everyone gains skill', cost: (s) => (s.trainLevel < 3 ? [1000, 2000, 3000][s.trainLevel] : null), level: 'trainLevel' },
  { id: 'pay', label: 'Pay raise', detail: 'Morale up, salaries +15%', cost: (s) => (s.payLevel < 3 ? 300 : null), level: 'payLevel' },
  { id: 'fire', label: 'Fire dept. equipment', detail: 'Fires put out faster', cost: (s) => (s.fireLevel < 3 ? [1000, 2000, 3000][s.fireLevel] : null), level: 'fireLevel' },
  { id: 'outreach', label: 'Community outreach', detail: 'Safety and trust up (daily)', cost: (s) => (s.outreachDay === s.day ? null : 600) },
];

export function buy(s, id) {
  const item = SHOP.find((x) => x.id === id);
  const cost = item?.cost(s);
  if (cost == null || s.money < cost) return false;
  s.money -= cost;
  const rng = rngOf(s);
  if (id === 'hire') { const o = newOfficer(s, 'rookie', rng); s.officers.push(o); say(s, `Welcome to the force, rookie ${o.name}.`, { tone: 'good' }); }
  if (id === 'car') s.cars++;
  if (id === 'cars') s.carLevel++;
  if (id === 'gear') s.gearLevel++;
  if (id === 'train') { s.trainLevel++; for (const o of s.officers) o.skill = +Math.min(1.6, o.skill + 0.1).toFixed(3); }
  if (id === 'pay') { s.payLevel++; for (const o of s.officers) o.morale = clamp(o.morale + 10, 0, 100); }
  if (id === 'fire') s.fireLevel++;
  if (id === 'outreach') { s.outreachDay = s.day; s.safety = clamp(s.safety + 4, 0, 100); s.trust = clamp(s.trust + 2, 0, 100); }
  s.rng = rng.state();
  crewCars(s);
  return true;
}

export function promote(s, officerId, rank) {
  const o = s.officers.find((x) => x.id === officerId);
  if (!o || o.status !== 'active') return;
  o.rank = rank;
  o.morale = clamp(o.morale + 10, 0, 100);
  if (rank === 'detective') o.skill = +Math.max(o.skill, 0.8).toFixed(3);
  say(s, `${o.name} promoted to ${RANKS[rank].title}.`, { tone: 'good' });
  crewCars(s);
}

/** The chief starts a raid on a group whose case is ready. */
export function planRaid(s, groupId) {
  const g = s.groups.find((x) => x.id === groupId);
  if (!g || !g.raidReady || s.pendingMajor) return null;
  const rng = rngOf(s);
  const m = openMajor(s, rng, 'raid', { group: g.id });
  s.rng = rng.state();
  return m;
}

export function removeGroup(s, id) { s.groups = s.groups.filter((g) => g.id !== id); s.officers.forEach((o) => { if (o.caseId === id) o.caseId = null; }); }

// ---------------------------------------------------------------- game over

export function checkOver(s) {
  if (s.mode !== 'career') { s.trust = Math.max(MODES.endless.floor, s.trust); s.safety = Math.max(MODES.endless.floor, s.safety); return null; }
  if (s.over) return s.over;
  if (s.trust <= 0) s.over = { reason: `${MAYOR} has lost all confidence in you. You're fired.` };
  else if (s.safety <= 0) s.over = { reason: 'Riots in the streets. The city council removed you as chief.' };
  else if (s.money < -2500) s.over = { reason: 'The department is broke and the council has taken over. You are out.' };
  else if (!activeOfficers(s).length && !s.officers.some((o) => o.status === 'active')) s.over = { reason: 'There is no one left on the force.' };
  return s.over;
}

export { MAJORS };
