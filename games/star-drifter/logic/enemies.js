// Enemy ship generation, scaled by sector and mode.
import { ENEMY_CLASSES, WEAPONS, SPECIES } from './data.js';
import { pick, int, next, weighted } from './rng.js';
import { makeShip, addCrew, roomOf, capacity, occupancy } from './ship.js';

const POOLS = [
  ['pulse1', 'heavy1', 'ion1', 'arrow'],
  ['pulse1', 'pulse2', 'heavy1', 'ion1', 'arrow', 'flak', 'cutter'],
  ['pulse2', 'heavy1', 'heavy2', 'ion2', 'breacher', 'flak', 'cutter', 'searing', 'swarm', 'arrow'],
];

/** Table per level 1..8: [shield layers min, max], weapon power, engine power, hull bonus. */
const LEVELS = [
  null,
  { sh: [0, 1], wp: 2, en: 1, hull: 0 },
  { sh: [1, 1], wp: 2, en: 2, hull: 2 },
  { sh: [1, 2], wp: 3, en: 2, hull: 4 },
  { sh: [1, 2], wp: 3, en: 2, hull: 5 },
  { sh: [2, 2], wp: 4, en: 3, hull: 7 },
  { sh: [2, 2], wp: 4, en: 3, hull: 8 },
  { sh: [2, 3], wp: 5, en: 4, hull: 10 },
  { sh: [2, 3], wp: 5, en: 4, hull: 12 },
];

const BASE_HULL = { raider: 8, hunter: 10, automaton: 8, boarder: 11, patrol: 12, flagship: 34 };

/** Which class shows up for a normal fight in this sector. */
export function pickClass(rng, sector) {
  const table = sector <= 1 ? [['raider', 6], ['automaton', 3]]
    : sector === 2 ? [['raider', 5], ['automaton', 3], ['hunter', 3]]
      : [['raider', 3], ['automaton', 3], ['hunter', 4], ['boarder', 3]];
  return weighted(rng, table);
}

/**
 * Build an enemy ship. kind: class id. level: difficulty 1..8 (sector, plus 1 for fleet ships).
 * mode 'cruise' makes enemies a little gentler. tutorial: the very first fight.
 */
export function makeEnemy(rng, { kind, level, mode = 'normal', tutorial = false }) {
  const cls = ENEMY_CLASSES[kind];
  let L = Math.max(1, Math.min(8, Math.round(level)));
  if (mode === 'cruise' && L > 1 && kind !== 'flagship') L -= 1;
  const T = LEVELS[L];
  const final = kind === 'flagship';
  let layers = int(rng, T.sh[0], T.sh[1]);
  let wp = T.wp;
  if (tutorial) { layers = 0; wp = 1; }
  if (final) { layers = 2; wp = 6; }
  if (kind === 'boarder') wp = Math.max(1, wp - 1);
  if (kind === 'patrol') wp += 1;
  const tier = L <= 2 ? 0 : L <= 4 ? 1 : 2;
  const pool = kind === 'automaton' ? POOLS[tier].filter((w) => WEAPONS[w].type !== 'missile') : POOLS[tier];
  const weapons = [];
  let budget = wp;
  const maxSlots = final ? 5 : 4;
  if (tutorial) weapons.push('pulse1');
  else if (final) weapons.push(...(mode === 'cruise' ? ['heavy1', 'pulse2', 'arrow', 'ion1'] : ['heavy1', 'pulse2', 'breacher', 'ion1']));
  else {
    let guard = 0;
    while (budget > 0 && weapons.length < maxSlots && guard++ < 30) {
      const opts = pool.filter((w) => WEAPONS[w].power <= budget);
      if (!opts.length) break;
      const w = pick(rng, opts);
      weapons.push(w);
      budget -= WEAPONS[w].power;
    }
  }
  const wPower = weapons.reduce((a, w) => a + WEAPONS[w].power, 0);
  const drones = [];
  if (kind === 'automaton' && L >= 2) drones.push('combat');
  if (kind === 'hunter' && L >= 3) drones.push(next(rng) < 0.5 ? 'defense' : 'combat');
  if (kind === 'patrol' && L >= 4) drones.push('defense');
  if (final) drones.push('defense', 'combat');
  const dPower = drones.length * 2;
  const en = tutorial ? 1 : final ? 4 : T.en;
  const systems = {
    shields: layers * 2,
    engines: en,
    weapons: Math.max(1, wPower),
    oxygen: cls.crewless ? 0 : 1,
    medbay: cls.crewless ? 0 : 1 + (L >= 5 ? 1 : 0),
    drones: dPower,
    piloting: 1 + (L >= 4 ? 1 : 0),
    sensors: 1,
    teleporter: cls.boards ? 2 : 0,
  };
  const reactor = systems.shields + systems.engines + wPower + systems.oxygen + systems.medbay + dPower + systems.teleporter;
  let hull = BASE_HULL[kind] + T.hull;
  if (final) hull = mode === 'cruise' ? 26 : 34;
  if (mode === 'cruise' && !final) hull = Math.round(hull * 0.85);
  if (tutorial) hull = 6;
  const ship = makeShip({
    name: pick(rng, cls.names), layout: cls.layout, hull, reactor, systems, weapons, drones,
    weaponSlots: maxSlots, droneSlots: 2,
    missiles: weapons.some((w) => WEAPONS[w].type === 'missile') ? 4 + L : 0,
    droneParts: drones.length ? 3 + Math.floor(L / 2) : 0, crewless: cls.crewless,
  });
  ship.kind = kind;
  ship.faction = cls.faction;
  ship.level = L;
  // Crew: pilot first, then weapons, shields, engines, others.
  if (!cls.crewless) {
    let n = cls.crew + (L >= 5 && !final ? 1 : 0);
    if (tutorial) n = 2;
    const order = ['piloting', 'weapons', 'shields', 'engines', 'teleporter', 'medbay', 'oxygen', 'sensors', 'drones'];
    const stations = [];
    for (const id of order) { const r = roomOf(ship, id); if (r) stations.push(r.id); }
    for (let k = 0; k < n; k++) {
      let room = stations[k % stations.length];
      if (occupancy(ship, room, 'enemy') >= capacity(ship.rooms[room])) room = ship.rooms.find((r) => occupancy(ship, r.id, 'enemy') < capacity(r))?.id ?? 0;
      const sp = pick(rng, cls.species);
      addCrew(ship, sp, rng, { room, side: 'enemy' });
    }
  }
  return ship;
}

/** Scrap and goods for beating a ship. how: 'destroyed' | 'crew' (crew kills pay more). */
export function bounty(rng, ship, sector, how = 'destroyed') {
  const L = ship.level || sector;
  const base = { raider: 12, hunter: 16, automaton: 11, boarder: 16, patrol: 10, flagship: 0 }[ship.kind] ?? 12;
  let scrap = base + 6 * sector + int(rng, 0, 8 + sector);
  if (how === 'crew') scrap = Math.round(scrap * 1.4);
  const r = {
    scrap,
    fuel: next(rng) < 0.85 ? int(rng, 1, 3) : 0,
    missiles: next(rng) < 0.5 ? int(rng, 1, 3) : 0,
    droneParts: next(rng) < 0.25 ? 1 : 0,
    weapon: null,
    crew: null,
  };
  if (how === 'crew' && next(rng) < 0.6) r.weapon = pick(rng, ship.weapons).id;
  else if (next(rng) < 0.1 + L * 0.01) r.weapon = pick(rng, POOLS[Math.min(2, Math.floor((sector - 1) / 2))]);
  if (ship.kind === 'patrol') { r.fuel = Math.min(r.fuel, 1); }
  return r;
}

export { POOLS, SPECIES };
