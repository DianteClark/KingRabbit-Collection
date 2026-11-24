// A whole run: the ship, resources, sector map, the fleet, and what screen you are on.
// Everything is plain JSON so it can be saved after every action (combat included).
//
// run.screen: 'map' | 'combat' | 'event' | 'store' | 'reward' | 'dead' | 'victory'

import { makeRng, next, int, pick, sample, weighted, shuffle } from './rng.js';
import { SHIPS, SYSTEMS, WEAPONS, DRONES, SPECIES, SECTOR_COUNT, SECTOR_NAMES, reactorCost, REACTOR_MAX } from './data.js';
import { makeShip, addCrew, autoPower, afterCombat, newWeapon, newDrone, roomOf, clampPower, aliveCrew, freeRoom } from './ship.js';
import { createCombat, hullLostFrac } from './combat.js';
import { makeEnemy, pickClass, bounty, POOLS } from './enemies.js';
import { generateSector, overrun, FLEET_SPEED, FLEET_START } from './sector.js';
import { EVENTS, EVENT_IDS, choiceBlock, getRes } from './events.js';
import { aiFor, adjust, afterLoss, START } from './adaptive.js';

export const VERSION = 1;
export const MAX_CREW = 6;
export const CARGO_MAX = 4;

// ------------------------------------------------------------------ setup

export function newRun({ ship = 'wayfarer', mode = 'normal', seed = Date.now(), skill = START } = {}) {
  const rng = makeRng(seed);
  const spec = SHIPS[ship];
  const s = makeShip(spec);
  for (const [species, sys] of spec.crew) addCrew(s, species, rng, { room: roomOf(s, sys)?.id ?? freeRoom(s) });
  const cruise = mode === 'cruise';
  if (cruise) { s.maxHull += 6; s.hull += 6; s.missiles += 2; }
  autoPower(s);
  s.shield.layers = Math.floor(s.sys.shields.power / 2);
  const run = {
    v: VERSION, seed, rng, mode, shipId: ship, ship: s,
    scrap: cruise ? 35 : 15, fuel: cruise ? 16 : 12,
    sector: 1, map: null, pos: 0, fleet: FLEET_START,
    screen: 'map', combat: null, fight: null, event: null, store: null, reward: null,
    cargo: [], seenEvents: [], note: null,
    skill, fightsReported: 0,
    stats: { jumps: 0, fights: 0, wins: 0, scrap: 0, crewLost: [], sectors: 1, crewKills: 0, fled: 0 },
  };
  startSector(run);
  return run;
}

function startSector(run) {
  run.map = generateSector(run.rng, run.sector);
  run.pos = 0;
  run.map.beacons[0].visited = true;
  run.fleet = FLEET_START;
  run.screen = 'map';
}

export const sectorName = (run) => SECTOR_NAMES[run.sector - 1];
export const beacon = (run) => run.map.beacons[run.pos];
export const isFinal = (run) => run.sector >= SECTOR_COUNT;
export const fleetSpeed = (run) => FLEET_SPEED[run.mode] ?? FLEET_SPEED.normal;

// ------------------------------------------------------------------ map

/** Can we jump to beacon id? '' or the reason. */
export function jumpBlock(run, id) {
  const b = beacon(run);
  if (!b.links.includes(id)) return 'Too far: jump to a linked beacon';
  if (run.fuel < 1) return 'Out of fuel';
  return '';
}

export function jump(run, id) {
  if (run.screen !== 'map' || jumpBlock(run, id)) return false;
  run.fuel--;
  run.fleet += fleetSpeed(run);
  run.pos = id;
  run.stats.jumps++;
  arrive(run);
  return true;
}

/** No fuel: drift in place, scrape up 1 fuel, and the fleet gets closer. */
export function drift(run) {
  if (run.screen !== 'map' || run.fuel > 0) return false;
  run.fuel = 1;
  run.fleet += fleetSpeed(run);
  run.note = 'You drift for a while and scrape together 1 fuel. The fleet closes in.';
  if (overrun(run.map, run.fleet, beacon(run)) && beacon(run).type !== 'flagship') {
    startFight(run, { kind: 'patrol', level: run.sector + 1, fleet: true });
  }
  return true;
}

const QUIET = [
  'Empty space. Your crew enjoys the quiet.',
  'A lonely beacon and nothing else.',
  'Just dust and distant stars here.',
  'Nothing on the scanners.',
];

function arrive(run) {
  const b = beacon(run);
  run.note = null;
  if (b.type !== 'flagship' && overrun(run.map, run.fleet, b)) {
    b.visited = true; b.known = true;
    startFight(run, { kind: 'patrol', level: run.sector + 1, fleet: true });
    return;
  }
  if (b.visited) {
    if (b.type === 'store') { openStore(run); return; }
    run.note = b.type === 'exit' ? 'The exit beacon. Jump to the next sector when you are ready.' : 'You have been here before. Nothing new.';
    run.screen = 'map';
    return;
  }
  b.visited = true; b.known = true;
  if (run.stats.jumps === 1 && run.sector === 1 && b.type !== 'store') {
    b.type = 'fight';
    startFight(run, { kind: 'raider', level: 1, tutorial: true });
    return;
  }
  switch (b.type) {
    case 'fight': startFight(run, { kind: pickClass(run.rng, run.sector), level: run.sector }); return;
    case 'event': startEvent(run, pickEvent(run)); return;
    case 'store': openStore(run); return;
    case 'flagship': startFight(run, { kind: 'flagship', level: 8, final: true }); return;
    case 'exit': run.note = 'The exit beacon! Jump to the next sector when you are ready, or keep exploring.'; break;
    default:
      if (next(run.rng) < 0.5) { run.fuel++; run.note = 'A drifting fuel canister! +1 fuel.'; } else run.note = pick(run.rng, QUIET);
  }
  run.screen = 'map';
}

export const canLeaveSector = (run) => run.screen === 'map' && beacon(run).type === 'exit' && !isFinal(run);

export function nextSector(run) {
  if (!canLeaveSector(run)) return false;
  run.sector++;
  run.stats.sectors = run.sector;
  startSector(run);
  run.fuel += 2;
  run.note = isFinal(run) ? 'The Throne Gate. The flagship waits at the top beacon. The relay gives you 2 fuel.' : `Welcome to ${sectorName(run)}. The relay beacon gives you 2 fuel.`;
  return true;
}

// ------------------------------------------------------------------ combat

export function startFight(run, { kind, level, tutorial = false, final = false, bonus = null, fleet = false }) {
  const enemy = makeEnemy(run.rng, { kind, level, mode: run.mode, tutorial });
  const crewBefore = aliveCrew(run.ship).map((c) => c.name);
  run.note = null;
  run.fight = { kind, level, tutorial, final, bonus, fleet, crewBefore };
  const crng = { s: (Math.floor(next(run.rng) * 4294967295) >>> 0) || 7 };
  run.combat = createCombat(run.ship, enemy, {
    rng: crng, ai: aiFor(run.skill), canFlee: !final, enemyMayFlee: !final && !tutorial && kind !== 'automaton',
    maxBoards: final ? 3 : 2,
  });
  run.stats.fights++;
  run.screen = 'combat';
}

/** Called once the combat has a result (after the explosion plays). */
export function finishCombat(run) {
  const c = run.combat;
  if (!c || !c.result) return false;
  const out = c.result.outcome;
  const f = run.fight;
  const ship = run.ship;
  const enemy = c.ships[1];
  run.stats.crewKills += 0;
  // Who did we lose?
  const alive = new Set(aliveCrew(ship).map((x) => x.name));
  for (const n of f.crewBefore) if (!alive.has(n) && !run.stats.crewLost.includes(n)) run.stats.crewLost.push(n);
  if (out === 'lose') {
    run.deathCause = c.result.how === 'crew' ? 'Your whole crew was lost.' : `Destroyed by the ${enemy.name}.`;
    run.screen = 'dead';
    run.skill = afterLoss(run.skill);
    run.combat = null;
    return true;
  }
  run.skill = adjust(run.skill, hullLostFrac(c), ++run.fightsReported);
  afterCombat(ship);
  for (const x of ship.crew) x.hp = x.maxHp;
  clampPower(ship);
  run.combat = null;
  if (out === 'win' && f.final) { run.screen = 'victory'; run.stats.wins++; return true; }
  if (out === 'fled') {
    run.stats.fled++;
    run.note = 'You jumped away safely. Pick your next beacon.';
    run.screen = 'map';
    return true;
  }
  if (out === 'escaped') {
    run.reward = { title: 'They got away', text: `The ${enemy.name} jumped away before you could finish it.`, lines: [] };
    run.screen = 'reward';
    return true;
  }
  run.stats.wins++;
  const how = c.result.how;
  const r = bounty(run.rng, enemy, run.sector, how);
  if (f.fleet) { r.scrap = Math.round(r.scrap * 0.5); r.weapon = null; }
  if (f.tutorial) { r.scrap = 18; r.fuel = 2; r.missiles = 1; r.weapon = null; r.droneParts = 0; }
  const lines = applyGain(run, { scrap: r.scrap, fuel: r.fuel, missiles: r.missiles, droneParts: r.droneParts, weapon: r.weapon, noScale: true });
  if (f.bonus) lines.push(...applyGain(run, f.bonus));
  run.reward = {
    title: how === 'crew' ? 'Crew defeated!' : 'Enemy destroyed!',
    text: how === 'crew' ? `With the crew of the ${enemy.name} gone, you strip the ship bare.` : `The ${enemy.name} breaks apart. You collect what is left.`,
    lines,
  };
  run.screen = 'reward';
  return true;
}

export function closeReward(run) {
  if (run.screen !== 'reward') return false;
  run.reward = null;
  run.screen = 'map';
  return true;
}

// ------------------------------------------------------------------ gains

const scaleScrap = (run, n) => Math.round(n * (1 + 0.15 * (run.sector - 1)));

/** Apply an outcome. Returns lines describing what changed. */
export function applyGain(run, g) {
  const lines = [];
  const ship = run.ship;
  if (g.scrap) {
    const n = g.noScale || g.scrap < 0 ? g.scrap : scaleScrap(run, g.scrap);
    const before = run.scrap;
    run.scrap = Math.max(0, run.scrap + n);
    if (n > 0) run.stats.scrap += n;
    lines.push(n > 0 ? `+${n} scrap` : `-${before - run.scrap} scrap`);
  }
  if (g.fuel) { const b = run.fuel; run.fuel = Math.max(0, run.fuel + g.fuel); lines.push(g.fuel > 0 ? `+${g.fuel} fuel` : `-${b - run.fuel} fuel`); }
  if (g.missiles) { ship.missiles = Math.max(0, ship.missiles + g.missiles); lines.push(`${g.missiles > 0 ? '+' : ''}${g.missiles} missile${Math.abs(g.missiles) > 1 ? 's' : ''}`); }
  if (g.droneParts) { ship.droneParts = Math.max(0, ship.droneParts + g.droneParts); lines.push(`${g.droneParts > 0 ? '+' : ''}${g.droneParts} drone part${Math.abs(g.droneParts) > 1 ? 's' : ''}`); }
  if (g.hull) {
    const b = ship.hull;
    ship.hull = Math.max(1, Math.min(ship.maxHull, ship.hull + g.hull));
    const d = ship.hull - b;
    if (d) lines.push(d > 0 ? `+${d} hull repaired` : `${d} hull`);
  }
  if (g.crewHurt) {
    const crew = aliveCrew(ship);
    if (crew.length) {
      const who = g.crewHurt >= 40 ? crew.reduce((a, b) => (b.hp > a.hp ? b : a)) : pick(run.rng, crew);
      const d = Math.min(who.hp - 1, g.crewHurt);
      who.hp -= d;
      lines.push(`${who.name} is hurt (-${d} health)`);
    }
  }
  if (g.crewLose) {
    const crew = aliveCrew(ship);
    if (crew.length > 1) {
      const who = pick(run.rng, crew);
      ship.crew = ship.crew.filter((x) => x !== who);
      run.stats.crewLost.push(who.name);
      lines.push(`${who.name} is gone`);
    }
  }
  if (g.crewGain) {
    if (aliveCrew(ship).length >= MAX_CREW) {
      run.scrap += 15; run.stats.scrap += 15;
      lines.push('No bunk free, so they pay you instead: +15 scrap');
    } else {
      const sp = g.crewGain === 'random' ? pick(run.rng, ['terran', 'terran', 'rokkan', 'zephi', 'synth', 'kesh']) : g.crewGain;
      const c = addCrew(ship, sp, run.rng, {});
      lines.push(`${c.name} the ${SPECIES[sp].name} joins your crew`);
    }
  }
  if (g.weapon) {
    const id = g.weapon === 'random' ? pick(run.rng, POOLS[Math.min(2, Math.floor((run.sector - 1) / 2))]) : g.weapon;
    lines.push(gainItem(run, 'weapon', id));
  }
  if (g.drone) {
    const id = g.drone === 'random' ? pick(run.rng, Object.keys(DRONES)) : g.drone;
    lines.push(gainItem(run, 'drone', id));
  }
  if (g.upgrade) {
    const opts = Object.keys(ship.sys).filter((id) => ship.sys[id].level < SYSTEMS[id].max && id !== 'teleporter');
    if (opts.length) {
      const id = pick(run.rng, opts);
      ship.sys[id].level++;
      lines.push(`${SYSTEMS[id].name} upgraded to level ${ship.sys[id].level}`);
    } else { run.scrap += 20; lines.push('+20 scrap'); }
  }
  if (g.reactor) {
    ship.reactor = Math.min(REACTOR_MAX, ship.reactor + g.reactor);
    lines.push(`+${g.reactor} reactor power`);
  }
  if (g.reveal) {
    for (const b of run.map.beacons) b.known = true;
    lines.push('Every beacon in this sector is revealed');
  }
  return lines;
}

/** Put a weapon/drone on the ship if a slot is free, else in the cargo hold. */
export function gainItem(run, kind, id) {
  const ship = run.ship;
  const def = kind === 'weapon' ? WEAPONS[id] : DRONES[id];
  if (kind === 'weapon' && ship.weapons.length < ship.weaponSlots) { ship.weapons.push(newWeapon(id)); return `New weapon: ${def.name}`; }
  if (kind === 'drone' && ship.sys.drones && ship.drones.length < ship.droneSlots) { ship.drones.push(newDrone(id)); return `New drone: ${def.name}`; }
  if (run.cargo.length < CARGO_MAX) { run.cargo.push({ kind, id }); return `${def.name} (in the cargo hold)`; }
  const v = Math.round(def.cost / 2);
  run.scrap += v; run.stats.scrap += v;
  return `${def.name}: no room, sold for ${v} scrap`;
}

// ------------------------------------------------------------------ events

function pickEvent(run) {
  let pool = EVENT_IDS.filter((id) => !run.seenEvents.includes(id) && id !== 'quiet');
  if (run.sector <= 1) pool = pool.filter((id) => !['hegemony', 'kesh', 'slavers'].includes(id));
  if (!pool.length) { run.seenEvents = []; pool = EVENT_IDS.filter((id) => id !== 'quiet'); }
  const id = pick(run.rng, pool);
  run.seenEvents.push(id);
  return id;
}

export function startEvent(run, id) {
  run.event = { id, stage: 'choose', text: null, lines: [], fight: null, store: false };
  run.screen = 'event';
}

export function chooseEvent(run, idx) {
  const e = run.event;
  if (!e || e.stage !== 'choose' || run.screen !== 'event') return false;
  const ch = EVENTS[e.id].choices[idx];
  if (!ch || choiceBlock(run, ch)) return false;
  const lines = [];
  for (const [k, v] of Object.entries(ch.cost || {})) {
    if (k === 'scrap') run.scrap -= v; else if (k === 'fuel') run.fuel -= v; else run.ship[k] -= v;
    lines.push(`-${v} ${k === 'droneParts' ? 'drone parts' : k}`);
  }
  const out = ch.outcome || weighted(run.rng, ch.outcomes.map(([w, o]) => [o, w]));
  const { fight, store, text, ...gain } = out;
  lines.push(...applyGain(run, gain));
  e.stage = 'result';
  e.choice = idx;
  e.text = text;
  e.lines = lines;
  e.fight = fight || null;
  e.store = !!store;
  return true;
}

/** After reading the result: start the fight / open the store / back to the map. */
export function continueEvent(run) {
  const e = run.event;
  if (!e || e.stage !== 'result' || run.screen !== 'event') return false;
  run.event = null;
  if (e.fight) {
    startFight(run, { kind: e.fight.kind || pickClass(run.rng, run.sector), level: run.sector + (e.fight.level || 0), bonus: e.fight.bonus || null });
    return true;
  }
  if (e.store) { openStore(run, true); return true; }
  run.screen = 'map';
  return true;
}

// ------------------------------------------------------------------ store

export const PRICES = { fuel: 3, missiles: 6, droneParts: 8, hull: 2 };

function genStore(run) {
  const rng = run.rng;
  const tier = Math.min(2, Math.floor((run.sector - 1) / 2));
  const disc = run.mode === 'cruise' ? 0.85 : 1;
  const price = (n) => Math.max(1, Math.round(n * disc * (0.9 + next(rng) * 0.2)));
  const items = [];
  const pool = [...new Set([...POOLS[tier], ...(tier > 0 ? POOLS[tier - 1] : [])])];
  for (const id of sample(rng, pool, 2)) items.push({ kind: 'weapon', id, price: price(WEAPONS[id].cost), sold: false });
  if (!run.ship.sys.drones) items.push({ kind: 'system', id: 'drones', price: price(55), sold: false });
  else items.push({ kind: 'drone', id: pick(rng, Object.keys(DRONES)), price: price(DRONES.combat.cost), sold: false });
  if (!run.ship.sys.medbay) items.push({ kind: 'system', id: 'medbay', price: price(45), sold: false });
  const sp = pick(rng, ['terran', 'rokkan', 'zephi', 'synth', 'kesh']);
  items.push({ kind: 'crew', id: sp, price: price(45 + (sp === 'terran' ? 0 : 8)), sold: false });
  return {
    items,
    stock: { fuel: int(rng, 6, 10), missiles: int(rng, 3, 6), droneParts: int(rng, 1, 4) },
    prices: { fuel: Math.round(3 * disc) || 3, missiles: Math.round(6 * disc), droneParts: Math.round(8 * disc), hull: 2 },
  };
}

export function openStore(run, temp = false) {
  const b = beacon(run);
  if (temp) run.store = genStore(run);
  else { if (!b.store) b.store = genStore(run); run.store = b.store; }
  run.screen = 'store';
}

export function closeStore(run) {
  if (run.screen !== 'store') return false;
  run.store = null;
  run.screen = 'map';
  return true;
}

/** Why an item can't be bought ('' = it can). */
export function buyBlock(run, i) {
  const it = run.store?.items[i];
  if (!it || it.sold) return 'Sold out';
  if (run.scrap < it.price) return 'Not enough scrap';
  if (it.kind === 'crew' && aliveCrew(run.ship).length >= MAX_CREW) return 'Crew is full';
  if (it.kind === 'system' && run.ship.sys[it.id]) return 'Already installed';
  if (it.kind === 'drone' && !run.ship.sys.drones) return 'Needs a drone bay';
  if ((it.kind === 'weapon' && run.ship.weapons.length >= run.ship.weaponSlots) || (it.kind === 'drone' && run.ship.drones.length >= run.ship.droneSlots)) {
    if (run.cargo.length >= CARGO_MAX) return 'No room';
  }
  return '';
}

export function buyItem(run, i) {
  if (run.screen !== 'store' || buyBlock(run, i)) return null;
  const it = run.store.items[i];
  run.scrap -= it.price;
  it.sold = true;
  if (it.kind === 'weapon' || it.kind === 'drone') return gainItem(run, it.kind, it.id);
  if (it.kind === 'crew') { const c = addCrew(run.ship, it.id, run.rng, {}); return `${c.name} the ${SPECIES[it.id].name} joins your crew`; }
  if (it.kind === 'system') {
    run.ship.sys[it.id] = { level: 1, power: 0, dmg: 0, ion: 0, ionT: 0, rep: 0 };
    return `${SYSTEMS[it.id].name} installed`;
  }
  return null;
}

export function buyBlockRes(run, k) {
  if (run.screen !== 'store') return 'Closed';
  if (k === 'hull') {
    if (run.ship.hull >= run.ship.maxHull) return 'Hull is full';
    return run.scrap < run.store.prices.hull ? 'Not enough scrap' : '';
  }
  if (run.store.stock[k] < 1) return 'Sold out';
  return run.scrap < run.store.prices[k] ? 'Not enough scrap' : '';
}

/** Buy one fuel / missile / drone part / hull point. */
export function buyRes(run, k) {
  if (buyBlockRes(run, k)) return false;
  run.scrap -= run.store.prices[k];
  if (k === 'hull') { run.ship.hull++; return true; }
  run.store.stock[k]--;
  if (k === 'fuel') run.fuel++; else run.ship[k]++;
  return true;
}

/** Repair as much hull as you can afford. Returns hull repaired. */
export function repairAll(run) {
  let n = 0;
  while (buyRes(run, 'hull')) n++;
  return n;
}

export const sellValue = (kind, id) => Math.round((kind === 'weapon' ? WEAPONS[id] : DRONES[id]).cost / 2);

/** Sell from 'cargo' or the ship ('weapon' / 'drone'). You must keep at least one weapon. */
export function sellBlock(run, where, i) {
  if (run.screen !== 'store') return 'Only at a store';
  if (where === 'weapon' && run.ship.weapons.length <= 1) return 'Keep at least one weapon';
  const list = where === 'cargo' ? run.cargo : where === 'weapon' ? run.ship.weapons : run.ship.drones;
  return list[i] ? '' : 'Nothing there';
}

export function sell(run, where, i) {
  if (sellBlock(run, where, i)) return 0;
  let kind; let id;
  if (where === 'cargo') { ({ kind, id } = run.cargo[i]); run.cargo.splice(i, 1); } else if (where === 'weapon') { kind = 'weapon'; id = run.ship.weapons[i].id; run.ship.weapons.splice(i, 1); } else { kind = 'drone'; id = run.ship.drones[i].id; run.ship.drones.splice(i, 1); }
  const v = sellValue(kind, id);
  run.scrap += v;
  clampPower(run.ship);
  return v;
}

// ------------------------------------------------------------------ upgrades & loadout

export function upgradeCost(run, id) {
  if (id === 'reactor') return run.ship.reactor >= REACTOR_MAX ? null : reactorCost(run.ship.reactor);
  const s = run.ship.sys[id];
  if (!s || s.level >= SYSTEMS[id].max) return null;
  return SYSTEMS[id].up[s.level];
}

export function upgradeBlock(run, id) {
  if (run.screen === 'combat') return 'Not during a fight';
  const cost = upgradeCost(run, id);
  if (cost === null) return id !== 'reactor' && !run.ship.sys[id] ? 'Not installed' : 'Maxed out';
  return run.scrap < cost ? 'Not enough scrap' : '';
}

export function upgrade(run, id) {
  if (upgradeBlock(run, id)) return false;
  run.scrap -= upgradeCost(run, id);
  if (id === 'reactor') run.ship.reactor++;
  else run.ship.sys[id].level++;
  return true;
}

/** Move a weapon/drone from the cargo hold onto the ship. */
export function equipBlock(run, i) {
  if (run.screen === 'combat') return 'Not during a fight';
  const it = run.cargo[i];
  if (!it) return 'Nothing there';
  if (it.kind === 'weapon' && run.ship.weapons.length >= run.ship.weaponSlots) return 'Weapon slots full';
  if (it.kind === 'drone' && !run.ship.sys.drones) return 'Needs a drone bay';
  if (it.kind === 'drone' && run.ship.drones.length >= run.ship.droneSlots) return 'Drone slots full';
  return '';
}

export function equip(run, i) {
  if (equipBlock(run, i)) return false;
  const it = run.cargo.splice(i, 1)[0];
  if (it.kind === 'weapon') run.ship.weapons.push(newWeapon(it.id)); else run.ship.drones.push(newDrone(it.id));
  return true;
}

export function unequipBlock(run, kind, i) {
  if (run.screen === 'combat') return 'Not during a fight';
  if (run.cargo.length >= CARGO_MAX) return 'Cargo hold is full';
  if (kind === 'weapon' && run.ship.weapons.length <= 1) return 'Keep at least one weapon';
  return '';
}

export function unequip(run, kind, i) {
  if (unequipBlock(run, kind, i)) return false;
  const list = kind === 'weapon' ? run.ship.weapons : run.ship.drones;
  const it = list.splice(i, 1)[0];
  if (!it) return false;
  run.cargo.push({ kind, id: it.id });
  clampPower(run.ship);
  return true;
}

/** Reorder weapons (the order decides which lose power first when the system is hit). */
export function moveWeapon(run, i, dir) {
  const w = run.ship.weapons;
  const j = i + dir;
  if (run.screen === 'combat' || j < 0 || j >= w.length) return false;
  [w[i], w[j]] = [w[j], w[i]];
  return true;
}

// ------------------------------------------------------------------ summary

export function summary(run) {
  const won = run.screen === 'victory';
  const score = (run.sector - 1) * 100 + run.stats.wins * 15 + Math.round(run.stats.scrap / 2) + (won ? 1000 : 0);
  return {
    won, mode: run.mode, ship: run.shipId, sector: run.sector, score: run.mode === 'cruise' ? Math.round(score * 0.6) : score,
    wins: run.stats.wins, jumps: run.stats.jumps, scrap: run.stats.scrap, crewLost: run.stats.crewLost.length,
  };
}

export { getRes, SHIPS };

// ------------------------------------------------------------------ saving

/** JSON for storage. In a fight the player ship is shared with the combat, so store it once. */
export function toJSON(run) {
  if (!run.combat) return JSON.stringify(run);
  const ships = run.combat.ships;
  const fx = run.combat.fx;
  run.combat.ships = [null, ships[1]];
  run.combat.fx = [];
  try { return JSON.stringify(run); } finally { run.combat.ships = ships; run.combat.fx = fx; }
}

export function fromJSON(str) {
  const run = typeof str === 'string' ? JSON.parse(str) : str;
  if (run && run.combat) run.combat.ships[0] = run.ship;
  return run;
}
