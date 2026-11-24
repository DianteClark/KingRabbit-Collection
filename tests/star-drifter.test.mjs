// Star Drifter: ships and power, crew, combat, enemy AI, events, sectors, store, run flow, saving.
import test from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/star-drifter/logic/', import.meta.url).href;
const D = await import(L + 'data.js');
const S = await import(L + 'ship.js');
const C = await import(L + 'combat.js');
const E = await import(L + 'enemies.js');
const A = await import(L + 'adaptive.js');
const AI = await import(L + 'ai.js');
const SEC = await import(L + 'sector.js');
const EV = await import(L + 'events.js');
const R = await import(L + 'run.js');

const rng = (s = 1) => ({ s });

function playerShip(id = 'wayfarer', seed = 1) {
  const spec = D.SHIPS[id];
  const s = S.makeShip(spec);
  const r = rng(seed);
  for (const [sp, sys] of spec.crew) S.addCrew(s, sp, r, { room: S.roomOf(s, sys).id });
  S.autoPower(s);
  return s;
}

/** An enemy with no weapons (a target dummy). */
function dummy(opts = {}) {
  const e = S.makeShip({
    name: 'Dummy', layout: 'skiff', hull: opts.hull ?? 10, reactor: 10,
    systems: { shields: opts.shields ?? 0, engines: opts.engines ?? 0, oxygen: 1, piloting: 1, weapons: 1, sensors: 1 },
    weapons: [], drones: [], missiles: 0,
  });
  e.kind = 'raider'; e.level = 1;
  if (opts.crew !== false) S.addCrew(e, 'terran', rng(5), { room: S.roomOf(e, 'piloting').id, side: 'enemy' });
  return e;
}

// ------------------------------------------------------------------ ships & power

test('layouts: every room is connected and the doors make sense', () => {
  for (const [id, rooms] of Object.entries(D.LAYOUTS)) {
    const adj = S.adjacency(rooms.map((r, i) => ({ id: i, ...r })));
    const seen = new Set([0]); const q = [0];
    while (q.length) { const x = q.shift(); for (const y of adj[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } }
    assert.equal(seen.size, rooms.length, `${id}: all rooms reachable`);
    // No overlapping rooms.
    for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
      const r1 = rooms[a]; const r2 = rooms[b];
      const overlap = r1.x < r2.x + r2.w && r2.x < r1.x + r1.w && r1.y < r2.y + r2.h && r2.y < r1.y + r1.h;
      assert.ok(!overlap, `${id}: rooms ${a} and ${b} overlap`);
    }
  }
});

test('power: reactor budget, system caps, weapons need their own power', () => {
  const s = S.makeShip(D.SHIPS.wayfarer);
  assert.equal(S.freePower(s), 8);
  assert.ok(S.addPower(s, 'shields'));
  assert.ok(S.addPower(s, 'shields'));
  assert.ok(!S.addPower(s, 'shields'), 'shields are level 2');
  assert.equal(S.shieldMax(s), 1);
  assert.ok(S.setWeapon(s, 0, true));
  assert.ok(S.setWeapon(s, 1, true));
  assert.equal(S.power(s, 'weapons'), 2);
  assert.equal(S.freePower(s), 4);
  // Use up the reactor, then a weapon can't come on.
  S.setWeapon(s, 1, false);
  while (S.addPower(s, 'engines'));
  while (S.addPower(s, 'oxygen'));
  while (S.addPower(s, 'medbay'));
  assert.equal(S.freePower(s), 1);
  s.reactor = 5;
  S.clampPower(s);
  assert.ok(S.powerUsed(s) <= 5, 'reactor shrink trims power');
  assert.ok(!S.addPower(s, 'piloting'), 'subsystems take no power');
});

test('power: damage cuts power and repairs give it back automatically', () => {
  const s = playerShip();
  const before = S.power(s, 'shields');
  assert.equal(before, 2);
  s.sys.shields.dmg = 2;
  S.clampPower(s);
  assert.equal(S.power(s, 'shields'), 0);
  s.sys.shields.dmg = 0;
  S.restorePower(s);
  assert.equal(S.power(s, 'shields'), 2, 'power restored after repair');
  // Weapons too: a hit on the weapons room turns guns off, repair turns them back on.
  assert.ok(s.weapons.every((w) => w.on));
  s.sys.weapons.dmg = 3; S.clampPower(s);
  assert.ok(s.weapons.every((w) => !w.on));
  s.sys.weapons.dmg = 0; S.restorePower(s);
  assert.ok(s.weapons.every((w) => w.on));
  // A weapon switched off by hand stays off.
  S.setWeapon(s, 0, false);
  S.restorePower(s);
  assert.ok(!s.weapons[0].on);
});

// ------------------------------------------------------------------ crew

test('crew: paths, room capacity, placing outside combat', () => {
  const s = playerShip();
  const eng = S.roomOf(s, 'engines'); const pilot = S.roomOf(s, 'piloting');
  const path = S.findPath(s, eng.id, pilot.id);
  assert.ok(path.length >= 3 && path[path.length - 1] === pilot.id);
  // Piloting holds 2.
  const [a, b, c] = s.crew.filter((x) => x.room !== pilot.id);
  assert.ok(S.placeCrew(s, a, pilot.id));
  assert.ok(!S.placeCrew(s, b, pilot.id), 'room full');
  assert.ok(!S.orderMove(s, c, pilot.id), 'cannot order into a full room');
});

test('crew: walk, repair systems, put out fires, seal breaches, suffocate, heal', () => {
  const p = playerShip();
  const c = C.createCombat(p, dummy(), { rng: rng(3), canFlee: false, autoCrew: false });
  // Repair: break the shields (crewed by the Zephi).
  p.sys.shields.dmg = 2; S.clampPower(p);
  C.step(c, 10);
  assert.equal(p.sys.shields.dmg, 0, 'crew in the room repairs it');
  // Fire in an empty room spreads damage; send someone to put it out.
  const o2 = S.roomOf(p, 'oxygen');
  o2.fire = 60;
  const hero = p.crew.find((x) => x.room === S.roomOf(p, 'engines').id);
  assert.ok(S.orderMove(p, hero, o2.id));
  C.step(c, 12);
  assert.equal(hero.room, o2.id);
  assert.equal(o2.fire, 0, 'fire is out');
  // Breach drains air until sealed.
  o2.breach = 100;
  C.step(c, 8);
  assert.equal(o2.breach, 0, 'breach sealed');
  // No air: crew take damage (except Synth).
  for (const r of p.rooms) r.o2 = 0;
  p.sys.oxygen.dmg = 1; S.clampPower(p);
  const hp = p.crew[0].hp;
  C.step(c, 3);
  assert.ok(p.crew[0].hp < hp, 'suffocating');
  // Medbay heals.
  for (const r of p.rooms) r.o2 = 100;
  p.sys.oxygen.dmg = 0;
  const med = S.roomOf(p, 'medbay');
  const hurt = p.crew[1];
  hurt.hp = 20;
  S.placeCrew(p, hurt, med.id);
  C.step(c, 4);
  assert.ok(hurt.hp > 30, `healed to ${hurt.hp}`);
});

test('crew: skills grow with use and help', () => {
  const p = playerShip();
  const pilot = S.manning(p, 'piloting');
  assert.ok(pilot);
  const c = C.createCombat(p, dummy(), { rng: rng(3), canFlee: false });
  const ev0 = C.evasion(c, 0);
  C.step(c, 120);
  assert.ok(S.skillLevel(pilot, 'pilot') >= 1);
  assert.ok(C.evasion(c, 0) > ev0, 'a skilled pilot dodges more');
});

// ------------------------------------------------------------------ combat

test('combat: shields stop lasers, missiles fly through, ion pops a layer', () => {
  const p = playerShip();
  const e = dummy({ shields: 4, hull: 30 });
  const c = C.createCombat(p, e, { rng: rng(9), canFlee: false });
  assert.equal(e.shield.layers, 2);
  // Laser volley of 2 into 2 layers: both blocked (enemy can't dodge: no engines).
  p.weapons[0].charge = 1;
  C.fireWeapon(c, 0, 0, S.roomOf(e, 'weapons').id);
  C.step(c, 2.5);
  assert.equal(e.hull, 30);
  assert.equal(e.shield.layers, 0);
  // Missile ignores shields.
  e.shield.layers = 2;
  p.weapons[0] = S.newWeapon('arrow'); p.weapons[0].on = true; p.weapons[0].charge = 1;
  const m = p.missiles;
  C.fireWeapon(c, 0, 0, S.roomOf(e, 'weapons').id);
  assert.equal(p.missiles, m - 1, 'uses a missile');
  C.step(c, 2);
  assert.equal(e.hull, 27);
  assert.ok(e.sys.weapons.dmg >= 1, 'system in the room is damaged');
  // No missiles, no shot.
  p.missiles = 0; p.weapons[0].charge = 1;
  assert.ok(!C.fireWeapon(c, 0, 0, 0));
  // Ion on shields: knocks a layer and ion-locks the shield system.
  p.weapons[0] = S.newWeapon('ion1'); p.weapons[0].on = true; p.weapons[0].charge = 1;
  e.shield.layers = 2;
  C.fireWeapon(c, 0, 0, S.roomOf(e, 'shields').id);
  C.step(c, 1.5);
  assert.equal(e.shield.layers, 1);
  assert.ok(e.sys.shields.ion > 0);
  assert.equal(e.hull, 27, 'ion does no hull damage');
});

test('combat: beams never miss but lose damage to shields', () => {
  const p = playerShip();
  const e = dummy({ shields: 2, hull: 30, engines: 3 });
  const c = C.createCombat(p, e, { rng: rng(4), canFlee: false });
  p.weapons[0] = S.newWeapon('cutter'); p.weapons[0].on = true; p.weapons[0].charge = 1;
  C.fireWeapon(c, 0, 0, S.roomOf(e, 'weapons').id);
  C.step(c, 1);
  // 2 damage - 1 layer = 1 per room, 2 rooms.
  assert.equal(e.hull, 28);
});

test('combat: evasion needs engines and a pilot', () => {
  const p = playerShip();
  const c = C.createCombat(p, dummy(), { rng: rng(4), canFlee: false });
  assert.ok(C.evasion(c, 0) >= 15);
  const pilot = S.manning(p, 'piloting');
  S.orderMove(p, pilot, S.roomOf(p, 'sensors').id);
  C.step(c, 2);
  assert.equal(C.evasion(c, 0), 0, 'nobody at the helm, level 1 piloting');
  p.sys.piloting.level = 2;
  assert.ok(C.evasion(c, 0) > 0, 'autopilot at level 2');
});

test('combat: destroy the hull or kill the crew to win; lose the same way', () => {
  {
    const p = playerShip();
    const e = dummy({ hull: 4 });
    const c = C.createCombat(p, e, { rng: rng(2), canFlee: false });
    p.weapons.forEach((w) => { w.target = S.roomOf(e, 'weapons').id; });
    C.step(c, 60);
    assert.deepEqual(c.result, { outcome: 'win', how: 'destroyed' });
  }
  {
    const p = playerShip();
    const e = dummy({ hull: 40 });
    const c = C.createCombat(p, e, { rng: rng(2), canFlee: false });
    e.crew[0].hp = 1;
    // Suffocate the lone pilot.
    e.sys.oxygen.dmg = 1; S.clampPower(e);
    for (const r of e.rooms) r.o2 = 0;
    C.step(c, 3);
    assert.deepEqual(c.result, { outcome: 'win', how: 'crew' });
  }
  {
    const p = playerShip();
    const c = C.createCombat(p, dummy(), { rng: rng(2), canFlee: false });
    p.hull = 1;
    C.hitRoom(c, 0, 0, 2, { fire: 0, breach: 0 }, false);
    C.step(c, 0.2);
    assert.equal(c.result.outcome, 'lose');
  }
});

test('combat: the jump drive charges and lets you escape (not from the flagship)', () => {
  const p = playerShip();
  const c = C.createCombat(p, dummy({ hull: 99 }), { rng: rng(2), canFlee: true });
  p.weapons.forEach((w, i) => S.setWeapon(p, i, false));
  assert.ok(!C.jumpAway(c));
  C.step(c, 40);
  assert.equal(c.ftl[0], 1);
  assert.ok(C.jumpAway(c));
  assert.equal(c.result.outcome, 'fled');
  const c2 = C.createCombat(playerShip(), dummy(), { rng: rng(2), canFlee: false });
  C.step(c2, 60);
  assert.ok(!C.jumpAway(c2));
});

test('combat: boarders teleport over, wreck systems and fight the crew', () => {
  let boarded = 0; let wins = 0;
  for (let k = 0; k < 6; k++) {
    const p = playerShip('wayfarer', k + 1);
    p.sys.shields.level = 4; p.reactor = 12; S.autoPower(p);
    const e = E.makeEnemy(rng(100 + k), { kind: 'boarder', level: 3 });
    const c = C.createCombat(p, e, { rng: rng(200 + k), canFlee: false, enemyMayFlee: false });
    const tgt = S.roomOf(e, 'shields').id;
    p.weapons.forEach((w) => { w.target = tgt; });
    while (!c.result && c.t < 400) C.step(c, 1);
    if (c.boards) boarded++;
    if (c.result?.outcome === 'win') wins++;
    // Boarders never outlive the fight on our ship.
    if (c.result?.outcome === 'win') assert.ok(!p.crew.some((x) => x.side === 'enemy' && x.hp > 0) || c.result.how === 'crew');
  }
  assert.ok(boarded >= 4, `boarding happens (${boarded}/6)`);
  assert.ok(wins >= 3, `boarding fights are winnable (${wins}/6)`);
});

test('combat: drones launch with a part; defense drones stop missiles', () => {
  const p = playerShip();
  p.sys.drones = { level: 4, power: 0, dmg: 0, ion: 0, ionT: 0, rep: 0 };
  p.drones = [S.newDrone('defense')];
  p.reactor = 14;
  p.droneParts = 1;
  const e = dummy({ hull: 40 });
  e.weapons = [S.newWeapon('arrow')]; e.missiles = 10; e.sys.weapons.level = 2;
  const c = C.createCombat(p, e, { rng: rng(6), canFlee: false, enemyMayFlee: false });
  assert.ok(S.setDrone(p, 0, true));
  C.step(c, 1);
  assert.equal(p.droneParts, 0, 'launching used a part');
  const hull = p.hull;
  C.step(c, 40);
  assert.ok(e.missiles < 10, 'enemy fired missiles');
  assert.ok(hull - p.hull <= 3, `defense drone shot most down (lost ${hull - p.hull})`);
});

test('combat: plain-JSON state resumes exactly (save mid-fight)', () => {
  const run = R.newRun({ seed: 42 });
  R.startFight(run, { kind: 'hunter', level: 3 });
  const tgt = S.roomOf(run.combat.ships[1], 'weapons').id;
  run.ship.weapons.forEach((w) => { w.target = tgt; });
  C.step(run.combat, 7.3);
  const copy = R.fromJSON(R.toJSON(run));
  assert.equal(copy.combat.ships[0], copy.ship, 'player ship is shared again after loading');
  C.step(run.combat, 20);
  C.step(copy.combat, 20);
  assert.equal(copy.ship.hull, run.ship.hull);
  assert.equal(copy.combat.ships[1].hull, run.combat.ships[1].hull);
  assert.equal(copy.combat.t.toFixed(2), run.combat.t.toFixed(2));
});

// ------------------------------------------------------------------ enemies & AI

test('enemies: every class and level builds a sane, powered ship', () => {
  for (const kind of Object.keys(D.ENEMY_CLASSES)) {
    for (let level = 1; level <= 8; level++) {
      for (const mode of ['normal', 'cruise']) {
        const e = E.makeEnemy(rng(level * 31 + kind.length), { kind, level, mode });
        assert.ok(e.weapons.length >= 1, `${kind} L${level} has weapons`);
        assert.ok(e.hull > 0);
        S.autoPower(e);
        assert.ok(e.weapons.every((w) => w.on), `${kind} L${level} powers all weapons`);
        if (D.ENEMY_CLASSES[kind].crewless) assert.equal(e.crew.length, 0);
        else assert.ok(e.crew.length >= 2);
        for (const c of e.crew) assert.ok(c.room >= 0 && c.room < e.rooms.length);
      }
    }
  }
  const t = E.makeEnemy(rng(1), { kind: 'raider', level: 1, tutorial: true });
  assert.ok(!t.sys.shields && t.weapons.length === 1, 'the tutorial ship is gentle');
});

test('ai: smart enemies aim at key systems, simple ones scatter', () => {
  const count = (skill) => {
    let key = 0;
    for (let k = 0; k < 200; k++) {
      const p = playerShip();
      const e = E.makeEnemy(rng(k + 1), { kind: 'raider', level: 2 });
      const c = C.createCombat(p, e, { rng: rng(k + 7), ai: A.aiFor(skill) });
      const r = AI.chooseTarget(c, 0);
      if (['shields', 'weapons', 'piloting'].includes(p.rooms[r].sys)) key++;
    }
    return key / 200;
  };
  const easy = count(0); const hard = count(1);
  assert.ok(hard > easy + 0.3, `hard ${hard} vs easy ${easy}`);
});

test('ai: volley timing waits for every gun at high skill', () => {
  const p = playerShip();
  const e = E.makeEnemy(rng(3), { kind: 'raider', level: 1 });
  e.weapons = [S.newWeapon('pulse1'), S.newWeapon('heavy1')];
  e.sys.weapons.level = 2;
  const c = C.createCombat(p, e, { rng: rng(4), ai: { smart: 1, sync: 1, delay: 0, hold: 30 } });
  e.weapons[0].charge = 1; e.weapons[1].charge = 0.5;
  AI.enemyThink(c);
  assert.equal(e.weapons[0].charge, 1, 'holds fire for the volley');
  e.weapons[1].charge = 1;
  AI.enemyThink(c);
  assert.equal(e.weapons[0].charge, 0);
  assert.equal(e.weapons[1].charge, 0, 'fires together');
});

test('adaptive: skill rises on clean wins, falls on bruising ones, stays 0..1', () => {
  let s = A.START;
  for (let i = 0; i < 30; i++) s = A.adjust(s, 0.02, i + 1);
  assert.ok(s > 0.9);
  for (let i = 0; i < 30; i++) s = A.adjust(s, 0.4, i + 1);
  assert.ok(s < 0.1);
  assert.ok(A.afterLoss(0.05) === 0);
  const t = A.aiFor(0.5);
  for (const [k, v] of Object.entries(A.AI_PRESETS.normal)) assert.ok(Math.abs(t[k] - v) < 1e-9, k);
  assert.ok(A.aiFor(1).smart > A.aiFor(0).smart && A.aiFor(1).delay < A.aiFor(0).delay);
  assert.equal(A.skillLabel(0), 1);
  assert.equal(A.skillLabel(1), 10);
});

// ------------------------------------------------------------------ sectors

test('sectors: connected maps with a store, an exit, and the flagship at the end', () => {
  for (let sector = 1; sector <= D.SECTOR_COUNT; sector++) {
    for (let seed = 1; seed <= 25; seed++) {
      const m = SEC.generateSector(rng(seed * 97 + sector), sector);
      const exit = SEC.exitBeacon(m);
      assert.ok(exit, 'has an exit');
      assert.ok(SEC.distance(m, 0, exit.id) < Infinity, 'exit reachable');
      assert.ok(SEC.distance(m, 0, exit.id) >= m.rows - 1);
      assert.ok(m.beacons.some((b) => b.type === 'store'), 'has a store');
      for (const b of m.beacons) for (const l of b.links) assert.ok(m.beacons[l].links.includes(b.id), 'links go both ways');
      if (sector === D.SECTOR_COUNT) assert.equal(exit.type, 'flagship');
    }
  }
});

test('fleet: sweeps up a row at a time and catches slow captains', () => {
  const run = R.newRun({ seed: 5 });
  assert.equal(run.fleet, SEC.FLEET_START);
  const m = run.map;
  assert.ok(!SEC.overrun(m, run.fleet, m.beacons[0]));
  run.fleet = 0.5;
  assert.ok(SEC.overrun(m, run.fleet, m.beacons[0]));
  // Arriving at an overrun beacon starts a fleet fight.
  run.stats.jumps = 5;
  const next = m.beacons[0].links[0];
  run.fleet = 5;
  assert.ok(R.jump(run, next));
  assert.equal(run.screen, 'combat');
  assert.ok(run.fight.fleet);
});

test('fuel: jumps cost fuel; out of fuel you can drift (no soft lock)', () => {
  const run = R.newRun({ seed: 9 });
  const f = run.fuel;
  const to = run.map.beacons[0].links[0];
  assert.ok(R.jump(run, to));
  assert.equal(run.fuel, f - 1);
  // Clear whatever we found.
  run.screen = 'map'; run.combat = null; run.event = null;
  run.fuel = 0;
  assert.equal(R.jumpBlock(run, R.beacon(run).links[0]), 'Out of fuel');
  assert.ok(R.drift(run));
  assert.ok(run.fuel >= 1 || run.screen === 'combat');
});

// ------------------------------------------------------------------ events

test('events: every outcome is well formed, every choice can be taken somehow', () => {
  const keys = new Set(['text', 'scrap', 'fuel', 'missiles', 'droneParts', 'hull', 'crewHurt', 'crewLose', 'crewGain', 'weapon', 'drone', 'upgrade', 'reactor', 'fight', 'store', 'reveal', 'noScale']);
  for (const [id, ev] of Object.entries(EV.EVENTS)) {
    assert.ok(ev.title && ev.text && ev.choices.length >= 2, id);
    assert.ok(ev.choices.some((c) => !c.req && !c.cost), `${id}: always has a free choice`);
    for (const ch of ev.choices) {
      const outs = ch.outcome ? [ch.outcome] : ch.outcomes.map(([w, o]) => { assert.ok(w > 0); return o; });
      for (const o of outs) {
        for (const k of Object.keys(o)) assert.ok(keys.has(k), `${id}: unknown key ${k}`);
        assert.ok(o.text, `${id}: outcome text`);
        if (o.weapon && o.weapon !== 'random') assert.ok(D.WEAPONS[o.weapon]);
        if (o.fight?.kind) assert.ok(D.ENEMY_CLASSES[o.fight.kind]);
        if (o.crewGain && o.crewGain !== 'random') assert.ok(D.SPECIES[o.crewGain]);
      }
    }
  }
});

test('events: requirements and costs gate choices; outcomes apply', () => {
  const run = R.newRun({ seed: 11 });
  R.startEvent(run, 'merchant');
  run.scrap = 5;
  const vis = EV.visibleChoices(run, EV.EVENTS.merchant);
  assert.ok(vis.find((x) => x.i === 0).block, 'cannot afford fuel');
  assert.ok(!R.chooseEvent(run, 0));
  run.scrap = 40;
  const fuel = run.fuel;
  assert.ok(R.chooseEvent(run, 0));
  assert.equal(run.fuel, fuel + 3);
  assert.equal(run.scrap, 28);
  assert.equal(run.event.stage, 'result');
  assert.ok(R.continueEvent(run));
  assert.equal(run.screen, 'map');
  // Species choices only show with that crew aboard.
  R.startEvent(run, 'asteroid');
  const hasRokkan = run.ship.crew.some((c) => c.species === 'rokkan');
  assert.equal(EV.visibleChoices(run, EV.EVENTS.asteroid).some((x) => x.c.req?.species === 'rokkan'), hasRokkan);
  // A fight outcome starts a fight after the text.
  R.startEvent(run, 'pirates');
  assert.ok(R.chooseEvent(run, 1));
  assert.ok(R.continueEvent(run));
  assert.equal(run.screen, 'combat');
  assert.deepEqual(run.fight.bonus, { scrap: 8 });
});

test('events: events never destroy the ship or the last crew member', () => {
  const run = R.newRun({ seed: 3 });
  run.ship.hull = 2;
  R.applyGain(run, { hull: -10, crewHurt: 500 });
  assert.equal(run.ship.hull, 1);
  assert.ok(run.ship.crew.every((c) => c.hp >= 1));
  run.ship.crew = run.ship.crew.slice(0, 1);
  R.applyGain(run, { crewLose: true });
  assert.equal(run.ship.crew.length, 1);
});

// ------------------------------------------------------------------ store & upgrades

test('store: buy goods, items, crew and systems; sell; keep a weapon', () => {
  const run = R.newRun({ seed: 21 });
  run.scrap = 500;
  R.openStore(run, true);
  const st = run.store;
  const fuel = run.fuel;
  assert.ok(R.buyRes(run, 'fuel'));
  assert.equal(run.fuel, fuel + 1);
  run.ship.hull = 20;
  assert.equal(R.repairAll(run), 10);
  assert.equal(R.buyBlockRes(run, 'hull'), 'Hull is full');
  st.items.forEach((it, i) => { if (!R.buyBlock(run, i)) assert.ok(R.buyItem(run, i), `bought ${it.kind}`); });
  assert.ok(st.items.every((it, i) => it.sold || R.buyBlock(run, i)));
  assert.ok(run.ship.sys.drones, 'drone bay installed');
  assert.equal(R.buyBlock(run, 0), 'Sold out');
  // Sell down to one weapon.
  while (run.ship.weapons.length > 1) assert.ok(R.sell(run, 'weapon', 0) > 0);
  assert.equal(R.sellBlock(run, 'weapon', 0), 'Keep at least one weapon');
  R.closeStore(run);
  assert.equal(run.screen, 'map');
});

test('upgrades: systems and reactor cost scrap and respect max levels', () => {
  const run = R.newRun({ seed: 2 });
  run.scrap = 1000;
  const cost = R.upgradeCost(run, 'shields');
  assert.equal(cost, D.SYSTEMS.shields.up[2]);
  assert.ok(R.upgrade(run, 'shields'));
  assert.equal(run.ship.sys.shields.level, 3);
  assert.equal(run.scrap, 1000 - cost);
  while (R.upgrade(run, 'oxygen'));
  assert.equal(run.ship.sys.oxygen.level, 3);
  assert.equal(R.upgradeBlock(run, 'oxygen'), 'Maxed out');
  assert.equal(R.upgradeBlock(run, 'drones'), 'Not installed');
  const r = run.ship.reactor;
  assert.ok(R.upgrade(run, 'reactor'));
  assert.equal(run.ship.reactor, r + 1);
  run.scrap = 0;
  assert.equal(R.upgradeBlock(run, 'engines'), 'Not enough scrap');
});

test('cargo: extra weapons go to the hold and can be equipped', () => {
  const run = R.newRun({ seed: 2 });
  while (run.ship.weapons.length < run.ship.weaponSlots) R.gainItem(run, 'weapon', 'pulse1');
  const msg = R.gainItem(run, 'weapon', 'heavy2');
  assert.match(msg, /cargo/);
  assert.equal(R.equipBlock(run, 0), 'Weapon slots full');
  assert.ok(R.unequip(run, 'weapon', 0));
  assert.ok(R.equip(run, 0));
  assert.ok(run.ship.weapons.some((w) => w.id === 'heavy2'));
});

// ------------------------------------------------------------------ run flow

test('run: first jump is a gentle tutorial fight, rewards, then the map', () => {
  const run = R.newRun({ seed: 77 });
  const to = run.map.beacons[0].links[0];
  R.jump(run, to);
  assert.equal(run.screen, 'combat');
  assert.ok(run.fight.tutorial);
  const c = run.combat;
  const tgt = S.roomOf(c.ships[1], 'weapons').id;
  run.ship.weapons.forEach((w) => { w.target = tgt; });
  while (!c.result) C.step(c, 1);
  assert.equal(c.result.outcome, 'win');
  const scrap = run.scrap;
  assert.ok(R.finishCombat(run));
  assert.equal(run.screen, 'reward');
  assert.ok(run.scrap > scrap);
  assert.ok(run.reward.lines.length > 0);
  assert.ok(run.ship.crew.every((x) => x.hp === x.maxHp), 'crew healed after the fight');
  R.closeReward(run);
  assert.equal(run.screen, 'map');
});

test('run: sector exits lead on, and the flagship ends it', () => {
  const run = R.newRun({ seed: 8 });
  run.pos = SEC.exitBeacon(run.map).id;
  assert.ok(R.canLeaveSector(run));
  const fuel = run.fuel;
  assert.ok(R.nextSector(run));
  assert.equal(run.sector, 2);
  assert.equal(run.fuel, fuel + 2);
  run.sector = D.SECTOR_COUNT - 1;
  run.pos = SEC.exitBeacon(run.map).id;
  R.nextSector(run);
  assert.ok(R.isFinal(run));
  const flag = SEC.exitBeacon(run.map);
  assert.equal(flag.type, 'flagship');
  R.startFight(run, { kind: 'flagship', level: 8, final: true });
  assert.ok(!run.combat.canFlee, 'no running from the flagship');
  run.combat.ships[1].hull = 0;
  C.step(run.combat, 0.2);
  R.finishCombat(run);
  assert.equal(run.screen, 'victory');
  assert.ok(R.summary(run).won);
});

test('run: losing the ship ends the run and eases the enemy skill', () => {
  const run = R.newRun({ seed: 8, skill: 0.6 });
  R.startFight(run, { kind: 'raider', level: 1 });
  run.ship.hull = 0;
  C.step(run.combat, 0.2);
  R.finishCombat(run);
  assert.equal(run.screen, 'dead');
  assert.ok(run.skill < 0.6);
  assert.ok(run.deathCause);
});
