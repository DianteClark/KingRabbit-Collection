// Real-time ship combat. step(combat, seconds) advances the simulation in small fixed ticks.
// State is plain JSON (saved mid-fight). ships[0] is the player, ships[1] the enemy.
// Crew on a ship have side 'player' or 'enemy'; boarders are crew of the other side.
import { WEAPONS, DRONES, SPECIES, MAN_SKILL, SYSTEMS } from './data.js';
import { next, int, pick } from './rng.js';
import {
  eff, usable, shieldMax, clampPower, manning, skillLevel, gainXp, crewInRoom, sysRooms, roomOf, orderMove,
  occupancy, capacity, findPath, autoPower, restorePower,
} from './ship.js';
import { enemyThink, boarderThink, crewJobs } from './ai.js';

export const TICK = 0.1;
export const SHOT_TRAVEL = 1.3;
const SIDES = ['player', 'enemy'];

/**
 * opts: { rng, ai (tuned enemy params), canFlee (player may jump away), final (flagship),
 *         enemyMayFlee, kind }
 */
export function createCombat(player, enemy, opts = {}) {
  const c = {
    t: 0,
    rng: opts.rng || { s: 12345 },
    ships: [player, enemy],
    shots: [],
    fx: [],
    ftl: [0, 0],
    enemyFleeing: false,
    canFlee: opts.canFlee !== false,
    enemyMayFlee: opts.enemyMayFlee !== false,
    ai: opts.ai || { smart: 0.5, sync: 0.4, delay: 1, hold: 4 },
    aiT: 0,
    aiWait: 0,
    boardT: 0,
    boards: 0,
    maxBoards: opts.maxBoards ?? 2,
    autofire: true,
    autoCrew: opts.autoCrew !== false,
    result: null,
    hullStart: player.hull,
    stats: { dealt: 0, taken: 0, shots: 0, hits: 0 },
    kind: opts.kind || 'fight',
    nextShot: 1,
  };
  for (const s of c.ships) {
    clampPower(s);
    for (const r of s.rooms) { r.burn = r.burn || 0; }
    s.shield.layers = shieldMax(s);
    s.shield.charge = 0;
  }
  autoPower(enemy);
  enemy.shield.layers = shieldMax(enemy);
  return c;
}

/** Advance by dt seconds (in fixed ticks). Stops once there is a result. */
export function step(c, dt) {
  c._acc = (c._acc || 0) + dt;
  while (c._acc >= TICK - 1e-9 && !c.result) {
    c._acc -= TICK;
    tick(c, TICK);
  }
  if (c.result) c._acc = 0;
}

function fx(c, e) {
  c.fx.push(e);
  if (c.fx.length > 300) c.fx.splice(0, c.fx.length - 300);
}

function tick(c, dt) {
  c.t += dt;
  for (let i = 0; i < 2; i++) systemsTick(c, i, dt);
  for (let i = 0; i < 2; i++) weaponsTick(c, i, dt);
  for (let i = 0; i < 2; i++) dronesTick(c, i, dt);
  shotsTick(c, dt);
  for (let i = 0; i < 2; i++) crewTick(c, i, dt);
  for (let i = 0; i < 2; i++) roomsTick(c, i, dt);
  boardingTick(c, dt);
  c.aiT += dt;
  if (c.aiT >= 0.5) { c.aiT = 0; enemyThink(c); boarderThink(c); if (c.autoCrew) crewJobs(c, 0); }
  ftlTick(c, dt);
  checkEnd(c);
}

// ------------------------------------------------------------------ systems

function systemsTick(c, i, dt) {
  const s = c.ships[i];
  let changed = false;
  for (const sys of Object.values(s.sys)) {
    if (sys.ion > 0) {
      sys.ionT -= dt;
      if (sys.ionT <= 0) { sys.ion = 0; sys.ionT = 0; changed = true; }
    }
  }
  if (changed) clampPower(s);
  restorePower(s);
  // Shields
  const max = shieldMax(s);
  if (s.shield.layers > max) s.shield.layers = max;
  if (s.shield.layers < max) {
    const m = manning(s, 'shields', SIDES[i]);
    const bonus = m ? 1 + [0.1, 0.2, 0.3][skillLevel(m, 'shields')] : 1;
    s.shield.charge += (dt / 2.2) * bonus;
    if (s.shield.charge >= 1) { s.shield.charge = 0; s.shield.layers++; }
  } else s.shield.charge = 0;
}

export function evasion(c, i) {
  const s = c.ships[i];
  if (!s.sys.piloting || usable(s, 'piloting') < 1) return 0;
  const en = eff(s, 'engines');
  if (en < 1) return 0;
  const side = SIDES[i];
  const pilot = manning(s, 'piloting', side);
  let ev = en * 5;
  if (pilot) ev += [5, 7, 10][skillLevel(pilot, 'pilot')];
  const eng = manning(s, 'engines', side);
  if (eng) ev += [5, 7, 10][skillLevel(eng, 'engines')];
  if (!pilot) {
    if (s.crewless || usable(s, 'piloting') >= 2) ev = Math.floor(ev / 2); else ev = 0;
  }
  return Math.min(60, ev);
}

// ------------------------------------------------------------------ weapons

export function weaponRate(c, i) {
  const s = c.ships[i];
  const m = manning(s, 'weapons', SIDES[i]);
  return m ? 1 + [0.1, 0.15, 0.2][skillLevel(m, 'weapons')] : 1;
}

function weaponsTick(c, i, dt) {
  const s = c.ships[i];
  const rate = weaponRate(c, i);
  s.weapons.forEach((w, wi) => {
    if (!w.on) { w.charge = Math.max(0, w.charge - dt / 3); return; }
    const d = WEAPONS[w.id];
    if (w.charge < 1) w.charge = Math.min(1, w.charge + (dt / d.cd) * rate);
    if (w.charge >= 1 && i === 0 && w.target !== null && w.target !== undefined) fireWeapon(c, 0, wi);
  });
}

/** Can this weapon fire now (charged and with ammo)? */
export function canFire(c, i, wi) {
  const s = c.ships[i];
  const w = s.weapons[wi];
  if (!w || !w.on || w.charge < 1) return false;
  if (WEAPONS[w.id].type === 'missile' && s.missiles < 1) return false;
  return true;
}

export function fireWeapon(c, i, wi, room) {
  const s = c.ships[i];
  const w = s.weapons[wi];
  const d = WEAPONS[w.id];
  const target = room ?? w.target;
  if (target === null || target === undefined || !canFire(c, i, wi)) return false;
  const foe = c.ships[1 - i];
  if (!foe.rooms[target]) return false;
  if (d.type === 'missile') s.missiles--;
  w.charge = 0;
  if (i === 0 && !c.autofire) w.target = null;
  c.stats.shots += i === 0 ? 1 : 0;
  for (let k = 0; k < d.shots; k++) {
    let r = target;
    if (d.type === 'flak') {
      const near = [target, ...foe.adj[target]];
      r = pick(c.rng, near);
    }
    c.shots.push({
      id: c.nextShot++, from: i, room: r, wid: w.id, type: d.type, dmg: d.dmg,
      t: -k * 0.28, travel: d.type === 'beam' ? 0.5 : SHOT_TRAVEL, slot: wi, drone: false,
    });
  }
  fx(c, { k: 'fire', ship: i, slot: wi, wid: w.id });
  return true;
}

// ------------------------------------------------------------------ drones

function dronesTick(c, i, dt) {
  const s = c.ships[i];
  const foe = c.ships[1 - i];
  s.drones.forEach((dr, di) => {
    if (!dr.on) return;
    if (!dr.launched) {
      if (s.droneParts < 1) { dr.on = false; return; }
      s.droneParts--;
      dr.launched = true;
      dr.t = 0;
      fx(c, { k: 'launch', ship: i, slot: di, id: dr.id });
    }
    const d = DRONES[dr.id];
    dr.t = Math.min(d.cd, dr.t + dt);
    if (dr.t < d.cd) return;
    if (dr.id === 'combat') {
      const rooms = foe.rooms;
      const r = int(c.rng, 0, rooms.length - 1);
      c.shots.push({ id: c.nextShot++, from: i, room: r, wid: 'drone', type: 'laser', dmg: 1, t: 0, travel: 1.0, drone: true, slot: di });
      dr.t = 0;
    } else if (dr.id === 'defense') {
      const target = c.shots.find((sh) => sh.from !== i && (sh.type === 'missile' || sh.type === 'flak') && sh.t > sh.travel * 0.2);
      if (target) {
        c.shots = c.shots.filter((sh) => sh !== target);
        fx(c, { k: 'intercept', ship: i, at: 1 - i, room: target.room, prog: target.t / target.travel });
        dr.t = 0;
      }
    } else if (dr.id === 'hull') {
      if (s.hull < s.maxHull && dr.used < 4) { s.hull++; dr.used++; fx(c, { k: 'patch', ship: i }); }
      dr.t = 0;
    }
  });
}

// ------------------------------------------------------------------ shots

function shotsTick(c, dt) {
  const landed = [];
  for (const sh of c.shots) {
    sh.t += dt;
    if (sh.t >= sh.travel) landed.push(sh);
  }
  if (!landed.length) return;
  c.shots = c.shots.filter((sh) => !landed.includes(sh));
  for (const sh of landed) land(c, sh);
}

function land(c, sh) {
  const ti = 1 - sh.from;
  const s = c.ships[ti];
  if (s.hull <= 0) return;
  const shooter = c.ships[sh.from];
  if (sh.type === 'beam') { beamHit(c, sh, ti); return; }
  let ev = evasion(c, ti) / 100;
  if (usable(shooter, 'sensors') >= 3) ev = Math.max(0, ev - 0.1);
  if (next(c.rng) < ev) { fx(c, { k: 'miss', ship: ti, room: sh.room }); return; }
  if (sh.type !== 'missile' && s.shield.layers > 0) {
    s.shield.layers--;
    s.shield.charge = 0;
    if (sh.type === 'ion' && s.sys.shields) { s.sys.shields.ion = Math.min(s.sys.shields.level, s.sys.shields.ion + 1); s.sys.shields.ionT = 5; clampPower(s); }
    fx(c, { k: 'shield', ship: ti, room: sh.room });
    return;
  }
  hitRoom(c, ti, sh.room, sh.dmg, WEAPONS[sh.wid] || { fire: 0, breach: 0.05 }, sh.type === 'ion');
}

function beamHit(c, sh, ti) {
  const s = c.ships[ti];
  const d = WEAPONS[sh.wid];
  const per = d.dmg - s.shield.layers;
  const rooms = [sh.room];
  // Extend through the neighbour with the lowest index, then its neighbour, etc.
  while (rooms.length < d.rooms) {
    const last = rooms[rooms.length - 1];
    const n = s.adj[last].filter((r) => !rooms.includes(r)).sort((a, b) => a - b)[0];
    if (n === undefined) break;
    rooms.push(n);
  }
  fx(c, { k: 'beam', ship: ti, rooms, blocked: per <= 0 });
  if (per <= 0) return;
  for (const r of rooms) hitRoom(c, ti, r, per, d, false);
}

export function hitRoom(c, ti, roomId, dmg, d, ion) {
  const s = c.ships[ti];
  const room = s.rooms[roomId];
  const sys = room.sys && s.sys[room.sys];
  if (ion) {
    if (sys) { sys.ion = Math.min(sys.level, sys.ion + dmg); sys.ionT = 6; clampPower(s); }
    fx(c, { k: 'ion', ship: ti, room: roomId });
    return;
  }
  s.hull = Math.max(0, s.hull - dmg);
  if (ti === 1) c.stats.dealt += dmg; else c.stats.taken += dmg;
  if (ti === 1) c.stats.hits++;
  if (sys) { sys.dmg = Math.min(sys.level, sys.dmg + dmg); sys.rep = 0; clampPower(s); }
  for (const cr of s.crew) if (cr.hp > 0 && cr.room === roomId && !cr.path.length) cr.hp -= 15 * dmg;
  if (d.fire && next(c.rng) < d.fire && !s.crewless) room.fire = Math.max(room.fire, 40);
  if (d.breach && next(c.rng) < d.breach && !s.crewless) room.breach = 100;
  fx(c, { k: 'hit', ship: ti, room: roomId, dmg });
}

// ------------------------------------------------------------------ crew

const HOP = 1.1; // seconds to walk one room at speed 1

function crewTick(c, i, dt) {
  const s = c.ships[i];
  const owner = SIDES[i];
  const medbay = roomOf(s, 'medbay');
  const heal = medbay ? eff(s, 'medbay') : 0;
  for (const cr of s.crew) {
    if (cr.hp <= 0) continue;
    const sp = SPECIES[cr.species];
    if (cr.path.length) {
      // Can't walk into a room that filled up meanwhile: stop where we are.
      cr.prog += (dt * sp.speed) / HOP;
      if (cr.prog >= 1) { cr.room = cr.path.shift(); cr.prog = 0; }
      continue;
    }
    const room = s.rooms[cr.room];
    const foes = s.crew.filter((o) => o.hp > 0 && o.side !== cr.side && o.room === cr.room && !o.path.length);
    if (foes.length) {
      const t = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
      // Defenders fight a little harder on their own ship.
      const home = cr.side === owner ? 1.2 : 1;
      t.hp -= dt * 6 * sp.combat * home * (1 + 0.15 * skillLevel(cr, 'combat'));
      gainXp(cr, 'combat', dt * 0.4);
      continue;
    }
    const repairMult = sp.repair * (1 + 0.15 * skillLevel(cr, 'repair'));
    if (room.fire > 0) {
      room.fire -= dt * 16 * (sp.fireproof ? 1.5 : 1);
      if (room.fire <= 0) { room.fire = 0; room.burn = 0; fx(c, { k: 'out', ship: i, room: room.id }); }
      continue;
    }
    if (cr.side !== owner) {
      // Boarder: wreck the system here.
      const sys = room.sys && s.sys[room.sys];
      if (sys && sys.dmg < sys.level) {
        sys.sab = (sys.sab || 0) + dt / 4;
        if (sys.sab >= 1) { sys.sab = 0; sys.dmg++; sys.rep = 0; clampPower(s); fx(c, { k: 'sabotage', ship: i, room: room.id }); }
      }
      continue;
    }
    if (room.breach > 0) {
      room.breach -= dt * 14 * repairMult;
      gainXp(cr, 'repair', dt * 0.3);
      if (room.breach <= 0) { room.breach = 0; fx(c, { k: 'sealed', ship: i, room: room.id }); }
      continue;
    }
    const sys = room.sys && s.sys[room.sys];
    if (sys && sys.dmg > 0) {
      sys.rep += (dt / 4) * repairMult;
      gainXp(cr, 'repair', dt * 0.3);
      if (sys.rep >= 1) { sys.rep = 0; sys.dmg--; fx(c, { k: 'fixed', ship: i, room: room.id }); }
      continue;
    }
    const skill = room.sys && MAN_SKILL[room.sys];
    if (skill && sys && manning(s, room.sys, owner) === cr) gainXp(cr, skill, dt * 0.3);
  }
  // Health effects
  for (const cr of s.crew) {
    if (cr.hp <= 0) continue;
    const sp = SPECIES[cr.species];
    const room = s.rooms[cr.room];
    if (!sp.noAir && room.o2 < 5 && !s.crewless) cr.hp -= dt * 6;
    if (room.fire > 0 && !sp.fireproof && !cr.path.length) cr.hp -= dt * 5;
    if (heal > 0 && cr.room === medbay.id && cr.side === owner && !cr.path.length) {
      const fighting = s.crew.some((o) => o.hp > 0 && o.side !== cr.side && o.room === cr.room);
      if (!fighting) cr.hp = Math.min(cr.maxHp, cr.hp + dt * 6 * heal);
    }
  }
  // Deaths
  for (const cr of s.crew) {
    if (cr.hp <= 0 && !cr.dead) {
      cr.dead = true; cr.hp = 0;
      fx(c, { k: 'death', ship: i, side: cr.side, name: cr.name, room: cr.room });
    }
  }
  if (s.crew.some((x) => x.dead)) s.crew = s.crew.filter((x) => !x.dead);
}

// ------------------------------------------------------------------ rooms

function roomsTick(c, i, dt) {
  const s = c.ships[i];
  if (s.crewless) return;
  const ox = eff(s, 'oxygen');
  for (const r of s.rooms) {
    if (ox > 0) r.o2 += dt * 2.2 * ox; else r.o2 -= dt * 0.9;
    if (r.breach > 0) r.o2 -= dt * 18;
    if (r.fire > 0) {
      r.o2 -= dt * 3;
      if (r.o2 < 12) r.fire -= dt * 25;
      else r.fire = Math.min(100, r.fire + dt * 6);
      r.burn = (r.burn || 0) + dt / 7;
      const sys = r.sys && s.sys[r.sys];
      if (r.burn >= 1) {
        r.burn = 0;
        if (sys && sys.dmg < sys.level) { sys.dmg++; sys.rep = 0; clampPower(s); }
      }
      if (r.fire >= 100) {
        for (const n of s.adj[r.id]) if (s.rooms[n].fire <= 0 && next(c.rng) < dt * 0.05) s.rooms[n].fire = 25;
      }
      if (r.fire <= 0) { r.fire = 0; r.burn = 0; }
    }
  }
  // Air flows between neighbouring rooms.
  const k = Math.min(0.5, dt * 0.6);
  for (let a = 0; a < s.rooms.length; a++) {
    for (const b of s.adj[a]) {
      if (b < a) continue;
      const d = (s.rooms[a].o2 - s.rooms[b].o2) * k * 0.5;
      s.rooms[a].o2 -= d; s.rooms[b].o2 += d;
    }
  }
  for (const r of s.rooms) r.o2 = Math.max(0, Math.min(100, r.o2));
}

// ------------------------------------------------------------------ boarding

function boardingTick(c, dt) {
  const e = c.ships[1];
  const p = c.ships[0];
  if (!e.sys.teleporter || c.boards >= c.maxBoards) return;
  const tp = eff(e, 'teleporter');
  if (tp < 1) return;
  c.boardT += dt * (0.6 + 0.2 * tp);
  if (c.boardT < 28) return;
  const home = e.crew.filter((x) => x.side === 'enemy' && x.hp > 40 && !x.path.length);
  if (home.length < 3) return;
  c.boardT = -12; // the teleporter needs longer to recharge after a jump
  c.boards++;
  // Send the two best fighters, keep a pilot at home.
  const team = home.sort((a, b) => SPECIES[b.species].combat - SPECIES[a.species].combat).slice(0, 2);
  const targets = sysRooms(p).filter((r) => occupancy(p, r.id, 'enemy') + 2 <= capacity(r));
  const room = targets.length ? pick(c.rng, targets).id : p.rooms.find((r) => capacity(r) >= 2)?.id ?? 0;
  for (const cr of team) {
    e.crew = e.crew.filter((x) => x !== cr);
    cr.room = room; cr.path = []; cr.prog = 0;
    p.crew.push(cr);
  }
  fx(c, { k: 'board', ship: 0, room, n: team.length });
}

// ------------------------------------------------------------------ jump drives

export function ftlRate(c, i) {
  const s = c.ships[i];
  const en = eff(s, 'engines');
  if (en < 1 || usable(s, 'piloting') < 1) return 0;
  if (!manning(s, 'piloting', SIDES[i]) && !s.crewless && usable(s, 'piloting') < 2) return 0;
  return 1 / Math.max(14, 34 - 2.5 * en);
}

function ftlTick(c, dt) {
  if (c.canFlee) c.ftl[0] = Math.min(1, c.ftl[0] + dt * ftlRate(c, 0));
  if (c.enemyFleeing) {
    c.ftl[1] = Math.min(1, c.ftl[1] + dt * ftlRate(c, 1) * 1.3);
    if (c.ftl[1] >= 1) { c.result = { outcome: 'escaped' }; fx(c, { k: 'escaped' }); }
  }
}

/** Player jumps away (drive charged). */
export function jumpAway(c) {
  if (!c.canFlee || c.ftl[0] < 1 || c.result) return false;
  c.result = { outcome: 'fled' };
  return true;
}

// ------------------------------------------------------------------ end

export const ownCrew = (c, side) => {
  let n = 0;
  for (const s of c.ships) for (const cr of s.crew) if (cr.side === side && cr.hp > 0) n++;
  return n;
};

function checkEnd(c) {
  if (c.result) return;
  const [p, e] = c.ships;
  if (p.hull <= 0) { c.result = { outcome: 'lose', how: 'hull' }; return; }
  if (e.hull <= 0) {
    // Boarders die with their ship.
    p.crew = p.crew.filter((x) => x.side === 'player');
    c.result = { outcome: 'win', how: 'destroyed' };
    fx(c, { k: 'explode', ship: 1 });
    return;
  }
  if (ownCrew(c, 'player') === 0) { c.result = { outcome: 'lose', how: 'crew' }; return; }
  if (!e.crewless && ownCrew(c, 'enemy') === 0) { c.result = { outcome: 'win', how: 'crew' }; }
}

/** Hull lost this fight as a share of max hull. */
export const hullLostFrac = (c) => Math.max(0, c.hullStart - c.ships[0].hull) / c.ships[0].maxHull;

export { SYSTEMS };
