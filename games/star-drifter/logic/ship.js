// Ships: rooms, systems, reactor power, weapons, drones and crew. Plain JSON so it saves as-is.
import { SYSTEMS, POWER_ORDER, LAYOUTS, WEAPONS, DRONES, SPECIES, SKILLS, SKILL_XP, CREW_NAMES } from './data.js';
import { pick, next } from './rng.js';

// ------------------------------------------------------------------ build

/** Which rooms touch along an edge (a door between them). */
export function adjacency(rooms) {
  const adj = rooms.map(() => []);
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]; const b = rooms[j];
      const touchX = (a.x + a.w === b.x || b.x + b.w === a.x) && a.y < b.y + b.h && b.y < a.y + a.h;
      const touchY = (a.y + a.h === b.y || b.y + b.h === a.y) && a.x < b.x + b.w && b.x < a.x + a.w;
      if (touchX || touchY) { adj[i].push(j); adj[j].push(i); }
    }
  }
  return adj;
}

/**
 * Make a ship. spec: { name, layout, hull, reactor, systems: {id: level}, weapons: [ids], drones: [ids],
 * weaponSlots, droneSlots, missiles, droneParts }.
 */
export function makeShip(spec) {
  const rooms = LAYOUTS[spec.layout].map((r, id) => ({ id, ...r, o2: 100, fire: 0, breach: 0 }));
  const sys = {};
  for (const [id, level] of Object.entries(spec.systems)) {
    if (level > 0 && rooms.some((r) => r.sys === id)) sys[id] = { level, power: 0, dmg: 0, ion: 0, ionT: 0, rep: 0 };
  }
  const w = Math.max(...rooms.map((r) => r.x + r.w));
  const h = Math.max(...rooms.map((r) => r.y + r.h));
  const ship = {
    name: spec.name, layout: spec.layout, w, h,
    rooms, adj: adjacency(rooms),
    sys,
    reactor: spec.reactor, hull: spec.hull, maxHull: spec.hull,
    weapons: (spec.weapons || []).map((id) => newWeapon(id)),
    drones: (spec.drones || []).map((id) => newDrone(id)),
    weaponSlots: spec.weaponSlots ?? 4, droneSlots: spec.droneSlots ?? 2,
    missiles: spec.missiles ?? 0, droneParts: spec.droneParts ?? 0,
    crew: [],
    shield: { layers: 0, charge: 0 },
    crewless: !!spec.crewless,
    nextCrewId: 1,
  };
  return ship;
}

export const newWeapon = (id) => ({ id, on: false, want: false, charge: 0, target: null });
export const newDrone = (id) => ({ id, on: false, want: false, launched: false, t: 0, used: 0 });

export const roomOf = (ship, sysId) => ship.rooms.find((r) => r.sys === sysId && ship.sys[sysId]) || null;
export const roomBySys = (ship, sysId) => ship.rooms.find((r) => r.sys === sysId) || null;
export const hasSys = (ship, id) => !!ship.sys[id];

// ------------------------------------------------------------------ crew

export function makeCrew(ship, species, rng, { name, room = null, side = 'player', used = [] } = {}) {
  const sp = SPECIES[species];
  const taken = new Set([...ship.crew.map((c) => c.name), ...used]);
  const free = CREW_NAMES.filter((n) => !taken.has(n));
  const c = {
    id: ship.nextCrewId++,
    name: name || pick(rng, free.length ? free : CREW_NAMES),
    species,
    sprite: pick(rng, sp.sprites),
    hp: sp.hp, maxHp: sp.hp,
    room, station: room,
    xp: Object.fromEntries(SKILLS.map((s) => [s, 0])),
    path: [], prog: 0,
    side,
  };
  return c;
}

export function addCrew(ship, species, rng, opts = {}) {
  let room = opts.room;
  if (room === undefined || room === null) room = freeRoom(ship);
  const c = makeCrew(ship, species, rng, { ...opts, room });
  c.station = room;
  ship.crew.push(c);
  return c;
}

/** Number of crew (of a side) in or heading to a room. */
export function occupancy(ship, roomId, side = 'player') {
  return ship.crew.filter((c) => c.side === side && c.hp > 0 && dest(c) === roomId).length;
}

export const dest = (c) => (c.path.length ? c.path[c.path.length - 1] : c.room);
export const capacity = (room) => room.w * room.h;

/** A room with space, preferring system rooms that nobody mans. */
export function freeRoom(ship, side = 'player') {
  const order = [...ship.rooms].sort((a, b) => (b.sys && ship.sys[b.sys] ? 1 : 0) - (a.sys && ship.sys[a.sys] ? 1 : 0));
  for (const r of order) if (occupancy(ship, r.id, side) === 0) return r.id;
  for (const r of order) if (occupancy(ship, r.id, side) < capacity(r)) return r.id;
  return 0;
}

export function skillLevel(c, skill) {
  const xp = c.xp[skill] || 0;
  return xp >= SKILL_XP[2] ? 2 : xp >= SKILL_XP[1] ? 1 : 0;
}

export function gainXp(c, skill, amount) {
  const mult = c.species === 'terran' ? 1.5 : 1;
  c.xp[skill] = Math.min(SKILL_XP[2], (c.xp[skill] || 0) + amount * mult);
}

/** Shortest path of room ids from a to b (excluding a). */
export function findPath(ship, a, b) {
  if (a === b) return [];
  const prev = new Map([[a, -1]]);
  const q = [a];
  while (q.length) {
    const x = q.shift();
    if (x === b) break;
    for (const y of ship.adj[x]) if (!prev.has(y)) { prev.set(y, x); q.push(y); }
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let x = b; x !== a; x = prev.get(x)) path.unshift(x);
  return path;
}

/** Order a crew member to a room. Returns false if the room is full or unreachable. */
export function orderMove(ship, c, roomId) {
  if (c.hp <= 0) return false;
  if (dest(c) === roomId) return true;
  const room = ship.rooms[roomId];
  if (!room) return false;
  if (occupancy(ship, roomId, c.side) >= capacity(room)) return false;
  const from = c.room;
  const p = findPath(ship, from, roomId);
  if (!p) return false;
  // Already walking: keep going from the room we're in.
  c.path = p;
  c.prog = 0;
  return true;
}

/** Outside combat crew just appear where they are told. */
export function placeCrew(ship, c, roomId) {
  const room = ship.rooms[roomId];
  if (!room || c.hp <= 0) return false;
  if (c.room === roomId) return true;
  if (occupancy(ship, roomId, c.side) >= capacity(room)) return false;
  c.room = roomId; c.station = roomId; c.path = []; c.prog = 0;
  return true;
}

export const aliveCrew = (ship, side = 'player') => ship.crew.filter((c) => c.side === side && c.hp > 0);

// ------------------------------------------------------------------ power

/** Bars a system can use right now (level minus damage minus ion lock). */
export function usable(ship, id) {
  const s = ship.sys[id];
  if (!s) return 0;
  return Math.max(0, s.level - s.dmg - s.ion);
}

/** Power actually feeding the system (for weapons/drones: the sum of what is switched on). */
export function power(ship, id) {
  const s = ship.sys[id];
  if (!s) return 0;
  if (id === 'weapons') return ship.weapons.reduce((a, w) => a + (w.on ? WEAPONS[w.id].power : 0), 0);
  if (id === 'drones') return ship.drones.reduce((a, d) => a + (d.on ? DRONES[d.id].power : 0), 0);
  if (!SYSTEMS[id].power) return 0;
  return s.power;
}

export function powerUsed(ship) {
  return POWER_ORDER.reduce((a, id) => a + power(ship, id), 0);
}

export const freePower = (ship) => ship.reactor - powerUsed(ship);

/** Effective level for gameplay: power for power systems, usable bars for subsystems. */
export function eff(ship, id) {
  const s = ship.sys[id];
  if (!s) return 0;
  if (SYSTEMS[id].power) return Math.min(power(ship, id), usable(ship, id));
  return usable(ship, id);
}

/** Add one bar. By hand (the default) this also becomes the power the system asks for back after repairs. */
export function addPower(ship, id, byHand = true) {
  const s = ship.sys[id];
  if (!s || !SYSTEMS[id].power || id === 'weapons' || id === 'drones') return false;
  if (s.power >= usable(ship, id) || freePower(ship) < 1) return false;
  s.power++;
  if (byHand) s.want = s.power;
  return true;
}

export function removePower(ship, id) {
  const s = ship.sys[id];
  if (!s || id === 'weapons' || id === 'drones' || s.power <= 0) return false;
  s.power--;
  s.want = s.power;
  return true;
}

/**
 * Give back power that damage or ion took away, once the system works again
 * (only up to what the player last asked for).
 */
export function restorePower(ship) {
  for (const id of ['shields', 'engines', 'oxygen', 'medbay', 'teleporter']) {
    const s = ship.sys[id];
    if (!s) continue;
    const want = s.want ?? s.power;
    while (s.power < want && addPower(ship, id, false));
  }
  ship.weapons.forEach((w, i) => { if (w.want && !w.on) setWeapon(ship, i, true, false); });
  ship.drones.forEach((d, i) => { if (d.want && !d.on && d.launched) setDrone(ship, i, true, false); });
}

/** Can weapon i be switched on now? Returns '' if yes or a reason. */
export function weaponBlock(ship, i) {
  const w = ship.weapons[i];
  if (!w) return 'No weapon';
  if (!ship.sys.weapons) return 'No weapons system';
  const need = WEAPONS[w.id].power;
  if (power(ship, 'weapons') + need > usable(ship, 'weapons')) return ship.sys.weapons.dmg || ship.sys.weapons.ion ? 'Weapons system damaged' : 'Upgrade the weapons system';
  if (freePower(ship) < need) return 'Not enough reactor power';
  return '';
}

export function setWeapon(ship, i, on, byHand = true) {
  const w = ship.weapons[i];
  if (!w) return false;
  if (!on) {
    if (byHand) w.want = false;
    if (!w.on) return false;
    w.on = false; w.charge = 0;
    if (byHand) w.target = null;
    return true;
  }
  if (w.on || weaponBlock(ship, i)) return false;
  w.on = true;
  if (byHand) w.want = true;
  return true;
}

export function droneBlock(ship, i) {
  const d = ship.drones[i];
  if (!d) return 'No drone';
  if (!ship.sys.drones) return 'No drone bay';
  const need = DRONES[d.id].power;
  if (power(ship, 'drones') + need > usable(ship, 'drones')) return ship.sys.drones.dmg || ship.sys.drones.ion ? 'Drone bay damaged' : 'Upgrade the drone bay';
  if (freePower(ship) < need) return 'Not enough reactor power';
  if (!d.launched && ship.droneParts < 1) return 'No drone parts';
  return '';
}

export function setDrone(ship, i, on, byHand = true) {
  const d = ship.drones[i];
  if (!d) return false;
  if (!on) { if (byHand) d.want = false; if (!d.on) return false; d.on = false; return true; }
  if (d.on || droneBlock(ship, i)) return false;
  d.on = true;
  if (byHand) d.want = true;
  return true;
}

/** After damage or ion: drop power that no longer fits (weapons/drones from the end). */
export function clampPower(ship) {
  for (const id of Object.keys(ship.sys)) {
    const s = ship.sys[id];
    const cap = usable(ship, id);
    if (id === 'weapons') {
      for (let i = ship.weapons.length - 1; i >= 0 && power(ship, 'weapons') > cap; i--) if (ship.weapons[i].on) setWeapon(ship, i, false, false);
    } else if (id === 'drones') {
      for (let i = ship.drones.length - 1; i >= 0 && power(ship, 'drones') > cap; i--) if (ship.drones[i].on) setDrone(ship, i, false, false);
    } else if (SYSTEMS[id].power && s.power > cap) s.power = cap;
  }
  // Reactor can only shrink through events; trim from the bottom of the list.
  while (powerUsed(ship) > ship.reactor) {
    const id = [...['drones', 'medbay', 'oxygen', 'weapons', 'engines', 'shields']].find((x) => power(ship, x) > 0);
    if (!id) break;
    if (id === 'weapons') { const i = ship.weapons.map((w) => w.on).lastIndexOf(true); setWeapon(ship, i, false); } else if (id === 'drones') { const i = ship.drones.map((d) => d.on).lastIndexOf(true); setDrone(ship, i, false); } else { ship.sys[id].power--; ship.sys[id].want = ship.sys[id].power; }
  }
}

/** Sensible default power: shields, engines, weapons, oxygen, then the rest. */
export function autoPower(ship, { keepWeapons = true } = {}) {
  const order = ['shields', 'shields', 'engines', 'oxygen', 'weapons', 'shields', 'shields', 'engines', 'medbay', 'drones', 'engines', 'shields', 'shields', 'engines', 'engines', 'medbay', 'oxygen', 'engines', 'shields', 'shields', 'engines', 'engines', 'oxygen', 'medbay', 'teleporter', 'teleporter', 'teleporter'];
  for (const id of order) {
    if (id === 'weapons') {
      if (!keepWeapons) continue;
      ship.weapons.forEach((w, i) => setWeapon(ship, i, true));
    } else if (id === 'drones') {
      ship.drones.forEach((d, i) => setDrone(ship, i, true));
    } else addPower(ship, id);
  }
  // Leftover power goes anywhere it fits.
  for (const id of POWER_ORDER) while (addPower(ship, id));
  ship.weapons.forEach((w, i) => setWeapon(ship, i, true));
}

// ------------------------------------------------------------------ queries

export const shieldMax = (ship) => Math.floor(eff(ship, 'shields') / 2);

/** Rooms that hold a system (for targeting priorities). */
export const sysRooms = (ship) => ship.rooms.filter((r) => r.sys && ship.sys[r.sys]);

export function crewInRoom(ship, roomId, side) {
  return ship.crew.filter((c) => c.hp > 0 && c.room === roomId && !c.path.length && (side === undefined || c.side === side));
}

/** Who mans a system room right now (first own crew standing still, not fighting). */
export function manning(ship, sysId, owner = 'player') {
  const r = roomOf(ship, sysId);
  if (!r) return null;
  const here = ship.crew.filter((c) => c.hp > 0 && c.room === r.id && !c.path.length);
  if (here.some((c) => c.side !== owner)) return null; // busy fighting boarders
  return here.find((c) => c.side === owner) || null;
}

export function systemSummary(ship) {
  return Object.fromEntries(Object.entries(ship.sys).map(([k, s]) => [k, `${eff(ship, k)}/${s.level}${s.dmg ? ` (-${s.dmg})` : ''}`]));
}

/** Restore after a fight: systems repaired, fires out, breaches sealed, air back, ion cleared. */
export function afterCombat(ship) {
  for (const s of Object.values(ship.sys)) { s.dmg = 0; s.ion = 0; s.ionT = 0; s.rep = 0; }
  for (const r of ship.rooms) { r.fire = 0; r.breach = 0; r.o2 = 100; }
  ship.crew = ship.crew.filter((c) => c.side === 'player' && c.hp > 0);
  for (const c of ship.crew) {
    c.path = []; c.prog = 0;
    if (c.station !== null && c.station !== undefined && ship.rooms[c.station]) c.room = c.station;
  }
  for (const w of ship.weapons) { w.charge = 0; w.target = null; }
  for (const d of ship.drones) { d.launched = false; d.t = 0; d.used = 0; }
  ship.shield.charge = 0;
  ship.shield.layers = shieldMax(ship);
}

/** Random crew-ish chance helper used by events. */
export const roll = (rng, p) => next(rng) < p;
