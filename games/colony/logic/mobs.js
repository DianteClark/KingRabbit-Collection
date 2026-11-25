// Moving around, fighting, wild animals and raiders.
import { W, H, N, ANIMALS, GAME_ANIMALS, RAIDER_LOOKS, TPH, TPD, BUILDS } from './data.js';
import { findPath } from './path.js';
import { next, rand, randInt, chance, pick } from './rng.js';
import {
  idx, tx, ty, inMap, near, costSettler, costAnimal, costRaider, passSettler, passAnimal, bAt, isWall, isDoor,
  settlers, hostiles, log, note, removeBuilding, walkable, season, mobById, markTile,
} from './world.js';
import { hurt, has, weaponOf, speedOf } from './life.js';
import { dist } from './map.js';

/** Step a creature toward tile dest. Returns 'arrived' | 'walking' | 'fail'. */
export function walk(s, m, dest, cost, speed) {
  if (dest == null || dest < 0) return 'fail';
  if (m.at === dest && !(m.path && m.path.length)) { center(m, speed); return 'arrived'; }
  if (!m.path || m.dest !== dest) {
    m.path = findPath(m.at, dest, cost);
    m.dest = dest;
    if (!m.path) { m.dest = null; return 'fail'; }
    if (!m.path.length) return 'arrived';
  }
  const nx = m.path[0];
  if (cost(nx) === Infinity) {
    m.path = null;
    m.stuck = (m.stuck || 0) + 1;
    return m.stuck > 30 ? 'fail' : 'walking';
  }
  const slow = cost(nx) >= 2 && cost(nx) < 4 ? 0.6 : 1;
  const step = speed * slow;
  const cx = tx(nx) + 0.5; const cy = ty(nx) + 0.5;
  const dx = cx - m.x; const dy = cy - m.y;
  const d = Math.hypot(dx, dy);
  if (dx) m.face = dx < 0 ? -1 : 1;
  m.moving = true;
  if (d <= step) {
    m.x = cx; m.y = cy; m.at = nx; m.path.shift(); m.stuck = 0;
    if (!m.path.length) { m.path = null; return 'arrived'; }
  } else { m.x += (dx / d) * step; m.y += (dy / d) * step; }
  return 'walking';
}
function center(m, speed) {
  const cx = tx(m.at) + 0.5; const cy = ty(m.at) + 0.5;
  const dx = cx - m.x; const dy = cy - m.y; const d = Math.hypot(dx, dy);
  if (d < 0.01) return;
  if (d <= speed) { m.x = cx; m.y = cy; } else { m.x += (dx / d) * speed; m.y += (dy / d) * speed; }
}

export const mobDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Try to hit target. Returns true when an attack happened. */
export function attack(s, a, b) {
  if ((a.cd || 0) > 0) return false;
  const w = weaponOf(a);
  const range = w ? w.range : 1.5;
  if (mobDist(a, b) > range + 0.2) return false;
  let skill = a.kind === 'settler' ? a.skills.fight : a.kind === 'raider' ? a.skill : 4;
  let hit = 0.45 + skill * 0.05;
  if (a.kind === 'settler' && has(a, 'brave')) hit += 0.1;
  if (w && w.range > 2) hit -= Math.max(0, mobDist(a, b) - 2) * 0.04;
  a.cd = w && w.range > 2 ? 16 : 12;
  const dmg = w ? w.dmg : a.kind === 'animal' ? a.def.dmg || 3 : 6;
  note(s, { type: w && w.range > 2 ? 'shot' : 'swing', from: a.id, to: b.id });
  if (next(s) < hit) {
    hurt(s, b, dmg * rand(s, 0.7, 1.3), a, a.kind === 'raider' ? 'killed by raiders' : a.kind === 'animal' ? `killed by a ${a.def.name.toLowerCase()}` : 'wounds');
    if (a.kind === 'settler') a.xpFight = (a.xpFight || 0) + 1;
    note(s, { type: 'sfx', name: 'hit' });
  }
  // A hunted animal may turn on its hunter, or run.
  if (b.kind === 'animal' && !b.dead && !b.hostile) {
    if (next(s) < b.def.fierce) { b.hostile = true; b.target = a.id; b.revenge = true; }
    else b.flee = 40;
  }
  return true;
}

// ---------------------------------------------------------------- animals

function edgeTile(s, pass) {
  for (let k = 0; k < 200; k++) {
    const side = randInt(s, 0, 3);
    const x = side === 0 ? 0 : side === 1 ? W - 1 : randInt(s, 0, W - 1);
    const y = side === 2 ? 0 : side === 3 ? H - 1 : randInt(s, 0, H - 1);
    const i = idx(x, y);
    if (pass(i)) return i;
  }
  return -1;
}
export function randomWalkable(s, pass, around = null, rad = 0) {
  for (let k = 0; k < 300; k++) {
    let i;
    if (around != null) {
      const x = tx(around) + randInt(s, -rad, rad); const y = ty(around) + randInt(s, -rad, rad);
      if (!inMap(x, y)) continue;
      i = idx(x, y);
    } else i = Math.floor(next(s) * N);
    if (pass(i)) return i;
  }
  return around;
}

export function spawnAnimal(s, sp, at = null, hostile = false) {
  const def = ANIMALS[sp];
  const pass = (i) => passAnimal(s, i);
  const i = at ?? edgeTile(s, pass);
  if (i < 0) return null;
  const m = { id: s.nextMob++, kind: 'animal', sp, x: tx(i) + 0.5, y: ty(i) + 0.5, at: i, hp: def.hp, hostile, path: null, wait: randInt(s, 10, 80), home: i, leaveAt: hostile ? s.t + TPD * 1.5 : null };
  setDef(m);
  s.mobs.push(m);
  return m;
}
/** The species data rides along without being saved. */
export function setDef(m) { Object.defineProperty(m, 'def', { value: ANIMALS[m.sp], enumerable: false, writable: true, configurable: true }); }
export function seedAnimals(s, n) {
  for (let k = 0; k < n; k++) {
    const i = randomWalkable(s, (j) => passAnimal(s, j) && dist(j, idx(24, 32)) > 10);
    spawnAnimal(s, pick(s, GAME_ANIMALS), i);
  }
}

export function animalTick(s, m) {
  if (m.cd > 0) m.cd--;
  m.moving = false;
  const cost = costAnimal(s);
  const sp = m.def.speed * (m.hostile ? 1 : m.flee ? 1.8 : 1);
  if (m.hostile) {
    let t = m.target != null ? mobById(s, m.target) : null;
    if (!t || t.dead || t.downed) {
      t = nearestSettler(s, m);
      m.target = t ? t.id : null;
      if (!t && m.revenge) { m.hostile = false; m.revenge = false; }
    }
    if (m.leaveAt && s.t > m.leaveAt) { m.hostile = false; m.leaving = true; }
    if (t) {
      if (mobDist(m, t) <= 1.5) { attack(s, m, t); return; }
      if ((m.repath = (m.repath || 0) - 1) <= 0) { m.path = null; m.repath = 20; }
      const r = walk(s, m, t.at, cost, sp);
      if (r === 'fail') { m.target = null; m.wait = 20; }
      return;
    }
  }
  if (m.leaving) {
    const x = tx(m.at); const y = ty(m.at);
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { m.dead = true; m.gone = true; return; }
    if (!m.exit) m.exit = edgeTile(s, (i) => passAnimal(s, i));
    if (walk(s, m, m.exit, cost, sp) === 'fail') m.exit = null;
    return;
  }
  if (m.flee > 0) {
    m.flee--;
    if (!m.fleeTo || m.at === m.fleeTo) m.fleeTo = randomWalkable(s, (i) => passAnimal(s, i), m.at, 8);
    if (walk(s, m, m.fleeTo, cost, sp) === 'fail') m.fleeTo = null;
    return;
  }
  if (m.wait > 0) { m.wait--; return; }
  if (m.dest == null || m.at === m.dest) {
    m.goal = randomWalkable(s, (i) => passAnimal(s, i), m.home, 6);
  }
  const r = walk(s, m, m.goal, cost, sp * 0.6);
  if (r !== 'walking') { m.wait = randInt(s, 40, 160); m.goal = null; m.dest = null; m.path = null; }
}

function nearestSettler(s, m) {
  let best = null; let bd = 1e9;
  for (const p of settlers(s)) {
    if (p.downed) continue;
    const d = mobDist(m, p);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ---------------------------------------------------------------- raiders

export function spawnRaid(s, n, opts = {}) {
  const cost = costRaider(s);
  const anchor = edgeTile(s, (i) => cost(i) < Infinity);
  if (anchor < 0) return 0;
  const raid = { id: s.nextMob, n, started: s.t, fled: false };
  for (let k = 0; k < n; k++) {
    const i = randomWalkable(s, (j) => cost(j) < Infinity && walkable(s, j), anchor, 2);
    const weapon = chance(s, opts.bows ?? 0.35) ? 'bow' : chance(s, 0.25) ? 'spear' : 'club';
    s.mobs.push({
      id: s.nextMob++, kind: 'raider', look: pick(s, RAIDER_LOOKS), x: tx(i) + 0.5, y: ty(i) + 0.5, at: i, hp: randInt(s, 55, 80),
      weapon, skill: randInt(s, 2, 6), path: null, gather: 40 + k * 4, raid: raid.id, leaveAt: s.t + TPD,
    });
  }
  s.raids = s.raids || [];
  s.raids.push(raid);
  return n;
}

export function raiderTick(s, m) {
  if (m.cd > 0) m.cd--;
  m.moving = false;
  const cost = costRaider(s);
  if (m.gather > 0) { m.gather--; return; }
  const raid = (s.raids || []).find((r) => r.id === m.raid);
  if (!m.fleeing) {
    const alive = s.mobs.filter((o) => o.raid === m.raid && !o.dead && !o.fleeing).length;
    if (m.hp < 18 || s.t > m.leaveAt || (raid && alive <= raid.n / 2 - 0.01 && raid.n > 1) || !settlers(s).some((p) => !p.downed)) {
      m.fleeing = true; m.path = null;
    }
  }
  if (m.fleeing) {
    const x = tx(m.at); const y = ty(m.at);
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { m.dead = true; m.gone = true; return; }
    if (!m.exit) m.exit = edgeTile(s, (i) => cost(i) < Infinity);
    if (bashAhead(s, m)) return;
    if (walk(s, m, m.exit, cost, 0.13) === 'fail') m.exit = null;
    return;
  }
  let t = m.target != null ? mobById(s, m.target) : null;
  if (!t || t.dead || t.downed || (m.retarget = (m.retarget || 0) - 1) <= 0) {
    t = nearestSettler(s, m); m.target = t ? t.id : null; m.retarget = 40; m.path = null;
  }
  if (!t) return;
  if (attack(s, m, t)) return;
  const w = weaponOf(m);
  if (mobDist(m, t) <= (w ? w.range : 1.5)) return; // waiting for the next swing
  if (bashAhead(s, m)) return;
  if ((m.repath = (m.repath || 0) - 1) <= 0) { m.path = null; m.repath = 25; }
  walk(s, m, t.at, cost, 0.13);
}

/** If the next step is a wall or door, hit it instead of walking. */
function bashAhead(s, m) {
  const nx = m.path?.[0];
  if (nx == null) return false;
  const b = bAt(s, nx);
  if (!b || !(isWall(b) || isDoor(b))) return false;
  if ((m.cd || 0) > 0) return true;
  m.cd = 12;
  b.hp -= 8 + randInt(s, 0, 6);
  note(s, { type: 'bash', at: nx });
  if (b.hp <= 0) {
    log(s, `Raiders broke down a ${BUILDS[b.k].name.toLowerCase()}.`, 'bad', b.i);
    removeBuilding(s, b, 0.3);
  }
  markTile(s, nx);
  return true;
}

export { passSettler, costSettler };
