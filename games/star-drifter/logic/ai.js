// Enemy ship brain: power, crew jobs, when to fire and what to aim at. Boarders' brain too.
// The adaptive parameters (c.ai) only change targeting and timing; see adaptive.js.
import { WEAPONS } from './data.js';
import { next, pick } from './rng.js';
import { autoPower, orderMove, findPath, eff, roomOf, occupancy, capacity, sysRooms } from './ship.js';
import { canFire, fireWeapon } from './combat.js';

const PRIORITY = ['shields', 'weapons', 'piloting', 'engines', 'oxygen', 'teleporter', 'drones', 'medbay', 'sensors'];

export function enemyThink(c) {
  const e = c.ships[1];
  if (e.hull <= 0) return;
  autoPower(e);
  // Running away when badly hurt (decided once, the first time hull drops below 30%).
  if (c.enemyMayFlee && !c.fleeRolled && e.hull <= e.maxHull * 0.3) {
    c.fleeRolled = true;
    if (next(c.rng) < 0.45 && e.sys.piloting && e.sys.engines) {
      c.enemyFleeing = true;
      c.fx.push({ k: 'fleeing' });
    }
  }
  crewJobs(c, 1);
  weaponsThink(c);
}

// ------------------------------------------------------------------ weapons

function weaponsThink(c) {
  const e = c.ships[1];
  const ai = c.ai;
  const ready = [];
  e.weapons.forEach((w, wi) => {
    if (!w.on) { w.readyAt = null; return; }
    if (canFire(c, 1, wi)) { if (w.readyAt === null || w.readyAt === undefined) w.readyAt = c.t; ready.push(wi); } else w.readyAt = null;
  });
  if (!ready.length) { c.volley = null; return; }
  // Decide once per volley whether to wait for every gun.
  if (c.volley === null || c.volley === undefined) c.volley = next(c.rng) < ai.sync;
  const armed = e.weapons.map((w, wi) => wi).filter((wi) => e.weapons[wi].on && (WEAPONS[e.weapons[wi].id].type !== 'missile' || e.missiles > 0));
  const allReady = armed.every((wi) => ready.includes(wi));
  for (const wi of ready) {
    const w = e.weapons[wi];
    const waited = c.t - w.readyAt;
    if (waited < ai.delay) continue;
    if (c.volley && !allReady && waited < ai.delay + ai.hold) continue;
    fireWeapon(c, 1, wi, chooseTarget(c, wi));
    w.readyAt = null;
  }
  if (!e.weapons.some((w, wi) => canFire(c, 1, wi))) c.volley = null;
}

/** Room on the player ship to shoot at. Smart picks go for key systems. */
export function chooseTarget(c, wi) {
  const p = c.ships[0];
  const d = WEAPONS[c.ships[1].weapons[wi].id];
  if (next(c.rng) < c.ai.smart) {
    let order;
    if (d.type === 'ion') order = ['shields', 'weapons'];
    else if (d.type === 'missile') order = p.shield.layers > 0 || eff(p, 'shields') > 0 ? ['shields', 'weapons', 'piloting'] : ['weapons', 'piloting', 'engines'];
    else order = ['weapons', 'shields', 'piloting', 'engines', 'oxygen'];
    for (const id of order) {
      const s = p.sys[id];
      const r = roomOf(p, id);
      if (s && r && s.dmg < s.level) return r.id;
    }
  }
  return pick(c.rng, p.rooms).id;
}

// ------------------------------------------------------------------ crew

/** Send crew to fight intruders, put out fires, seal breaches, fix systems; otherwise man stations. */
export function crewJobs(c, i) {
  const s = c.ships[i];
  const side = i === 0 ? 'player' : 'enemy';
  const mine = s.crew.filter((x) => x.side === side && x.hp > 0);
  if (!mine.length) return;
  const busy = new Set();
  const jobs = [];
  for (const r of s.rooms) {
    const intruders = s.crew.filter((x) => x.side !== side && x.hp > 0 && x.room === r.id).length;
    const sys = r.sys && s.sys[r.sys];
    let pri = 0;
    if (intruders) pri = 5 + intruders;
    else if (r.fire > 0) pri = 4;
    else if (r.breach > 0) pri = 3;
    else if (sys && sys.dmg > 0) pri = 2 + (PRIORITY.length - PRIORITY.indexOf(r.sys)) / 20;
    if (pri) jobs.push({ room: r.id, pri, need: intruders ? Math.min(3, intruders + 1) : 1 });
  }
  jobs.sort((a, b) => b.pri - a.pri);
  // Hurt crew head to the medbay if it works.
  const med = roomOf(s, 'medbay');
  const medOk = med && eff(s, 'medbay') > 0;
  for (const cr of mine) {
    if (medOk && cr.hp < cr.maxHp * 0.35 && !s.crew.some((x) => x.side !== side && x.hp > 0 && x.room === med.id)) {
      if (cr.room !== med.id && !(cr.path.length && cr.path[cr.path.length - 1] === med.id)) orderMove(s, cr, med.id);
      busy.add(cr);
    }
  }
  for (const job of jobs) {
    let have = mine.filter((x) => (x.path.length ? x.path[x.path.length - 1] : x.room) === job.room).length;
    have = Math.min(have, job.need);
    for (const x of mine) if ((x.path.length ? x.path[x.path.length - 1] : x.room) === job.room) busy.add(x);
    while (have < job.need) {
      const free = mine.filter((x) => !busy.has(x) && !isPilotNeeded(s, x));
      if (!free.length) break;
      let best = null; let bestD = 99;
      for (const x of free) {
        const p = findPath(s, x.room, job.room);
        if (p && p.length < bestD) { best = x; bestD = p.length; }
      }
      if (!best || !orderMove(s, best, job.room)) break;
      busy.add(best);
      have++;
    }
  }
  // Everyone else goes back to their station.
  for (const x of mine) {
    if (busy.has(x) || x.path.length) continue;
    if (x.station !== null && x.station !== undefined && x.room !== x.station) {
      if (!orderMove(s, x, x.station)) {
        // Station full: man any empty system room instead.
        const alt = sysRooms(s).find((r) => occupancy(s, r.id, side) === 0);
        if (alt) { x.station = alt.id; orderMove(s, x, alt.id); }
      }
    }
  }
}

function isPilotNeeded(s, x) {
  const r = roomOf(s, 'piloting');
  if (!r || x.room !== r.id || x.path.length) return false;
  return s.crew.filter((o) => o.side === x.side && o.hp > 0 && o.room === r.id && !o.path.length).length <= 1;
}

// ------------------------------------------------------------------ boarders

export function boarderThink(c) {
  const p = c.ships[0];
  for (const b of p.crew) {
    if (b.side !== 'enemy' || b.hp <= 0 || b.path.length) continue;
    const room = p.rooms[b.room];
    const defenders = p.crew.some((x) => x.side === 'player' && x.hp > 0 && x.room === b.room);
    if (defenders) continue;
    const sys = room.sys && p.sys[room.sys];
    if (sys && sys.dmg < sys.level) continue;
    // Find the nearest system that still works.
    let best = null; let bestD = 99;
    for (const r of sysRooms(p)) {
      const s = p.sys[r.sys];
      if (s.dmg >= s.level || occupancy(p, r.id, 'enemy') >= capacity(r)) continue;
      const path = findPath(p, b.room, r.id);
      if (path && path.length < bestD) { best = r; bestD = path.length; }
    }
    if (best) orderMove(p, b, best.id);
  }
}
