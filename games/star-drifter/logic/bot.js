// A simple but sensible captain used by the tests: picks beacons, shops, upgrades and fights.
// It proves runs can be completed and keeps the balance honest.
import { WEAPONS, SYSTEMS } from './data.js';
import { EVENTS, choiceBlock, visibleChoices } from './events.js';
import * as R from './run.js';
import { step, canFire, fireWeapon, jumpAway } from './combat.js';
import { autoPower, setWeapon, setDrone, roomOf, eff, aliveCrew, shieldMax } from './ship.js';
import { overrun, distance, exitBeacon } from './sector.js';

// ------------------------------------------------------------------ combat

/** One bot decision (call every ~0.5s of sim). */
export function combatThink(c, { final = false } = {}) {
  const p = c.ships[0];
  const e = c.ships[1];
  autoPower(p);
  p.drones.forEach((d, i) => setDrone(p, i, true));
  const shieldsRoom = roomOf(e, 'shields');
  const weaponsRoom = roomOf(e, 'weapons');
  const enemyShielded = e.shield.layers > 0;
  // Missiles are precious: save them for shielded ships and the flagship.
  const useMissiles = p.missiles > 0 && (final || (e.sys.shields && e.sys.shields.level >= 4 && p.missiles > 2));
  const armed = p.weapons.map((w, i) => i).filter((i) => p.weapons[i].on && (WEAPONS[p.weapons[i].id].type !== 'missile' || useMissiles));
  const ready = armed.filter((i) => canFire(c, 0, i));
  // Don't let an idle missile launcher eat reactor power... it simply stays charged.
  // Fire everything together so lasers overwhelm the shields.
  const waitedTooLong = (c.botWait || 0) > 6;
  if (ready.length && (ready.length === armed.length || waitedTooLong || !enemyShielded)) {
    for (const i of ready) {
      const d = WEAPONS[p.weapons[i].id];
      let room = (shieldsRoom && e.sys.shields.dmg < e.sys.shields.level ? shieldsRoom : weaponsRoom) || e.rooms[0];
      if (d.type === 'beam') room = weaponsRoom || shieldsRoom || e.rooms[0];
      fireWeapon(c, 0, i, room.id);
    }
    c.botWait = 0;
  } else if (ready.length) c.botWait = (c.botWait || 0) + 0.5;
  if (!final && p.hull <= p.maxHull * 0.25 && c.ftl[0] >= 1 && e.hull > e.maxHull * 0.3) jumpAway(c);
}

/** Play a combat to the end (or a time cap). */
export function playCombat(c, opts = {}) {
  c.autofire = false;
  while (!c.result && c.t < 600) {
    combatThink(c, opts);
    step(c, 0.5);
  }
  if (!c.result) c.result = { outcome: 'fled' };
  return c.result.outcome;
}

// ------------------------------------------------------------------ map

function pickJump(run) {
  const b = R.beacon(run);
  const map = run.map;
  const exit = exitBeacon(map);
  let best = null; let bestScore = -1e9;
  const hullFrac = run.ship.hull / run.ship.maxHull;
  for (const id of b.links) {
    const n = map.beacons[id];
    let s = 0;
    const dExit = distance(map, id, exit.id);
    s -= dExit * 1.5;
    if (!n.visited) s += 3; else s -= 3;
    if (n.type === 'store') s += (run.scrap >= 40 || hullFrac < 0.6) ? 6 : 1;
    if (n.type === 'store' && R.isFinal(run) && !n.visited && (hullFrac < 0.9 || run.scrap > 30)) s += 25;
    if (n.type === 'flagship') s += hullFrac > 0.7 || run.scrap < 15 ? 20 : -3;
    if (overrun(map, run.fleet + R.fleetSpeed(run), n)) s -= 12;
    else if (n.row < run.fleet + 1.2) s -= 2;
    if (run.fuel <= 2) s -= dExit * 3;
    s += (n.row - b.row) * 0.5;
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

function mapTurn(run) {
  spend(run);
  const b = R.beacon(run);
  if (R.canLeaveSector(run)) {
    const unvisited = b.links.map((id) => run.map.beacons[id]).filter((n) => !n.visited && !overrun(run.map, run.fleet + R.fleetSpeed(run) * 2, n));
    if (!unvisited.length || run.fuel <= 6 || run.fleet > run.map.rows - 3) { R.nextSector(run); return; }
    R.jump(run, unvisited[0].id);
    return;
  }
  if (run.fuel < 1) { R.drift(run); return; }
  const id = pickJump(run);
  if (id === null || !R.jump(run, id)) R.drift(run);
}

// ------------------------------------------------------------------ spending

const PLAN = [
  ['shields', 4], ['weapons', 4], ['engines', 3], ['piloting', 2], ['weapons', 5], ['shields', 6], ['engines', 4],
  ['weapons', 6], ['oxygen', 2], ['medbay', 2], ['engines', 5], ['sensors', 2], ['weapons', 7], ['shields', 8], ['engines', 6], ['weapons', 8], ['drones', 4],
];

/** Rough damage per second per power, with a bonus for shots that beat shields. */
export function weaponValue(id) {
  const w = WEAPONS[id];
  let v = (w.shots * w.dmg) / w.cd;
  if (w.type === 'missile') v *= 1.5;
  if (w.type === 'ion') v *= 0.9;
  if (w.type === 'beam') v = (w.dmg * w.rooms * 0.5) / w.cd;
  if (w.type === 'flak') v *= 1.2;
  return v * (1 + 0.15 * (w.shots - 1));
}

function powerNeed(ship) {
  let n = 0;
  for (const id of ['shields', 'engines', 'oxygen', 'medbay']) n += ship.sys[id]?.level || 0;
  n += Math.min(ship.sys.weapons?.level || 0, ship.weapons.reduce((a, w) => a + WEAPONS[w.id].power, 0));
  return n;
}

/** Upgrades between fights. Keeps some scrap for hull repairs and fuel. */
function spend(run) {
  const ship = run.ship;
  // Keep enough for fuel and some hull repairs.
  const reserve = 12 + 3 * Math.max(0, 7 - run.fuel) + Math.max(0, ship.maxHull * 0.7 - ship.hull);
  for (let guard = 0; guard < 20; guard++) {
    if (powerNeed(ship) > ship.reactor && R.upgradeCost(run, 'reactor') !== null && run.scrap - R.upgradeCost(run, 'reactor') >= reserve) { R.upgrade(run, 'reactor'); continue; }
    const wNeed = ship.weapons.reduce((a, w) => a + WEAPONS[w.id].power, 0);
    if (wNeed > ship.sys.weapons.level && R.upgradeCost(run, 'weapons') !== null && run.scrap - R.upgradeCost(run, 'weapons') >= reserve) { R.upgrade(run, 'weapons'); continue; }
    const next = PLAN.find(([id, lvl]) => ship.sys[id] && ship.sys[id].level < lvl && ship.sys[id].level < SYSTEMS[id].max);
    if (!next) break;
    const cost = R.upgradeCost(run, next[0]);
    if (cost === null || run.scrap - cost < reserve) break;
    R.upgrade(run, next[0]);
  }
  // Equip anything sitting in cargo.
  for (let i = run.cargo.length - 1; i >= 0; i--) R.equip(run, i);
}

function shop(run) {
  const ship = run.ship;
  const st = run.store;
  while (run.fuel < 4 && R.buyRes(run, 'fuel'));
  while (ship.hull < ship.maxHull * 0.7 && R.buyRes(run, 'hull'));
  while (run.fuel < 8 && R.buyRes(run, 'fuel'));
  const hasMissile = ship.weapons.some((w) => WEAPONS[w.id].type === 'missile');
  while (hasMissile && ship.missiles < 8 && R.buyRes(run, 'missiles'));
  while (ship.drones.length && ship.droneParts < 3 && R.buyRes(run, 'droneParts'));
  st.items.forEach((it, i) => {
    if (it.kind === 'weapon' && !it.sold) {
      // Swap out the weakest gun if this one is clearly better.
      const worst = ship.weapons.reduce((a, w, k) => (weaponValue(w.id) < weaponValue(ship.weapons[a].id) ? k : a), 0);
      const better = weaponValue(it.id) > weaponValue(ship.weapons[worst].id) * 1.25;
      const full = ship.weapons.length >= ship.weaponSlots;
      const worth = full ? better : (better || ship.weapons.length < 3);
      const sellBack = full ? R.sellValue('weapon', ship.weapons[worst].id) : 0;
      if (worth && run.scrap + sellBack - it.price >= 25) {
        if (full) R.sell(run, 'weapon', worst);
        if (!R.buyBlock(run, i)) R.buyItem(run, i);
      }
    } else if (it.kind === 'crew' && !R.buyBlock(run, i) && aliveCrew(ship).length < 4 && run.scrap - it.price >= 20) R.buyItem(run, i);
    else if (it.kind === 'drone' && it.id !== 'hull' && !R.buyBlock(run, i) && ship.drones.length < 1 && run.scrap - it.price >= 40) R.buyItem(run, i);
  });
  // Spare cargo goes for scrap.
  for (let i = run.cargo.length - 1; i >= 0; i--) if (R.equipBlock(run, i)) R.sell(run, 'cargo', i);
  spend(run);
  while (ship.hull < ship.maxHull && R.buyRes(run, 'hull'));
  R.closeStore(run);
}

function eventTurn(run) {
  const e = run.event;
  if (e.stage === 'result') { R.continueEvent(run); return; }
  const ev = EVENTS[e.id];
  const vis = visibleChoices(run, ev).filter((x) => !x.block);
  const hullOk = run.ship.hull > run.ship.maxHull * 0.45;
  // Blue options first, then the first choice that isn't a fight when hurt.
  let pickC = vis.find((x) => x.c.req);
  if (!pickC) pickC = vis.find((x) => hullOk || !(x.c.outcome && x.c.outcome.fight));
  if (!pickC) pickC = vis[vis.length - 1];
  R.chooseEvent(run, pickC.i);
}

// ------------------------------------------------------------------ whole run

export function playRun(run, { maxSteps = 3000 } = {}) {
  for (let n = 0; n < maxSteps; n++) {
    switch (run.screen) {
      case 'map': mapTurn(run); break;
      case 'combat': playCombat(run.combat, { final: run.fight.final }); R.finishCombat(run); break;
      case 'event': eventTurn(run); break;
      case 'store': shop(run); break;
      case 'reward': R.closeReward(run); break;
      default: return run.screen;
    }
  }
  return run.screen;
}

export { shieldMax, eff };
