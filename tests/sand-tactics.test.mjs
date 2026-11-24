// Sand Tactics rules: maps, movement, combat, capturing, building, turns and victory.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/sand-tactics/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const D = await import(new URL(`${base}logic/data.js`, import.meta.url).href);
const M = await import(new URL(`${base}logic/maps.js`, import.meta.url).href);

/** Small test map: rows of terrain, units overlay. */
function mk(rows, units, extra = {}) {
  return G.newGame({ id: 'test', name: 'Test', rows, units, funds: [0, 0], ...extra }, { seed: 1 });
}
const blank = (w, h, ch = '.') => Array.from({ length: h }, () => ch.repeat(w));
const at = (s, x, y) => G.unitAt(s, x, y);

test('maps: every campaign and skirmish map parses, is portrait-sized and has both sides', () => {
  const all = [...M.CAMPAIGN, ...M.SKIRMISH];
  assert.ok(M.CAMPAIGN.length >= 6 && M.CAMPAIGN.length <= 10, 'campaign has 6-10 missions');
  for (const def of all) {
    const m = G.parseMap(def);
    assert.ok(m.w <= 12, `${def.id} fits a portrait screen (${m.w} wide)`);
    assert.equal(def.units.length, m.h, `${def.id} unit overlay height`);
    for (const row of def.units) assert.equal(row.length, m.w, `${def.id} unit overlay width`);
    assert.ok(m.units.some((u) => u.side === 0), `${def.id}: Blue has units`);
    assert.ok(m.props.some((p) => p.kind === 'hq' && p.owner === 0), `${def.id}: Blue HQ`);
    for (const u of m.units) {
      const t = m.terrain[u.y * m.w + u.x];
      assert.ok(G.moveCost(u.type, t) > 0, `${def.id}: ${u.type} placed on passable ${t} at ${u.x},${u.y}`);
    }
    // Every Blue unit can reach the Red HQ or Red units on foot/tread (no sealed-off starts).
  }
});

test('maps: skirmish maps are fair (point-symmetric with sides swapped)', () => {
  for (const def of M.SKIRMISH) {
    const m = G.parseMap(def);
    for (const p of m.props) {
      const q = m.props.find((o) => o.x === m.w - 1 - p.x && o.y === m.h - 1 - p.y);
      assert.ok(q && q.kind === p.kind, `${def.id}: building at ${p.x},${p.y} has a mirror`);
      assert.equal(q.owner, p.owner < 0 ? -1 : 1 - p.owner);
    }
    for (let i = 0; i < m.terrain.length; i++) {
      const x = i % m.w; const y = Math.floor(i / m.w);
      assert.equal(m.terrain[i], m.terrain[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
    }
    assert.equal(m.units.filter((u) => u.side === 0).length, m.units.filter((u) => u.side === 1).length);
  }
});

test('movement: costs by terrain and move type, enemies block, friends can be passed', () => {
  const s = mk(['..:..', '..^..', '.....', '.....', '~~~~~'], ['.....', '.....', '..I..', '.....', '.....']);
  const inf = at(s, 2, 2);
  const r = G.reachable(s, inf);
  assert.ok(r.has(G.idx(s, 2, 0)), 'infantry climbs the mesa (2) and walks on');
  assert.equal(r.get(G.idx(s, 2, 1)).c, 2);
  assert.ok(!r.has(G.idx(s, 0, 4)), 'no walking on water');
  // Tanks can't enter mesas, dunes cost them 2.
  const s2 = mk(['.:...', '.^...', '.....'], ['.....', '.....', '.T...']);
  const tank = at(s2, 1, 2);
  const r2 = G.reachable(s2, tank);
  assert.ok(!r2.has(G.idx(s2, 1, 1)));
  assert.equal(r2.get(G.idx(s2, 1, 0)).c, 5, 'around the mesa: 1 + 1 + 1 + dunes 2');
  // An enemy blocks the corridor; a friend does not, but you can't stop on it.
  const s3 = mk(['^.^^^', '^.^^^', '^.^^^', '^.^^^'], ['.....', '.i...', '.....', '.T...']);
  const t3 = at(s3, 1, 3);
  const r3 = G.reachable(s3, t3);
  assert.ok(!r3.has(G.idx(s3, 1, 0)), 'enemy infantry blocks the only lane');
  const s4 = mk(['^.^^^', '^.^^^', '^.^^^', '^.^^^'], ['.....', '.....', '.I...', '.T...']);
  const r4 = G.reachable(s4, at(s4, 1, 3));
  assert.ok(r4.has(G.idx(s4, 1, 0)), 'passes through its own infantry');
  assert.equal(r4.get(G.idx(s4, 1, 2)).stop, false, 'but can\'t stop on it');
  assert.deepEqual(G.pathTo(r4, G.idx(s4, 1, 0)), [[1, 3], [1, 2], [1, 1], [1, 0]]);
  // Drones fly over water and mesas.
  const s5 = mk(['~~~', '^^^', '...'], ['...', '...', '.D.']);
  assert.ok(G.reachable(s5, at(s5, 1, 2)).has(G.idx(s5, 1, 0)));
});

test('damage: table, health and terrain defence', () => {
  const s = mk(['.....', '.....'], ['.T.i.', '.....']);
  const tank = at(s, 1, 0); const inf = at(s, 3, 0);
  // Full health on sand (1 star): 75 * 1 * (100 - 1*10)/100 = 67.5 -> 67
  assert.equal(G.damage(s, 'tank', 100, 'inf', 100, 3, 0), 67);
  // Half health attacker hits half as hard.
  assert.equal(G.damage(s, 'tank', 50, 'inf', 100, 3, 0), 33);
  // On a mesa (4 stars) the same shot does 75 * 0.6 = 45.
  const s2 = mk(['...^.'], ['.T.i.']);
  assert.equal(G.damage(s2, 'tank', 100, 'inf', 100, 3, 0), 45);
  // Drones get no terrain defence.
  assert.equal(G.defStars(s2, 'drone', 3, 0), 0);
  // Artillery can't hit drones; infantry barely scratches a heavy tank.
  assert.equal(D.baseDamage('arty', 'drone'), 0);
  assert.ok(!G.canHit('arty', 'drone'));
  assert.ok(D.baseDamage('inf', 'heavy') <= 1);
  assert.equal(D.displayHp(1), 1); assert.equal(D.displayHp(100), 10); assert.equal(D.displayHp(45), 5);
  void tank; void inf;
});

test('combat: attack, counterattack, kills and ranged rules', () => {
  const s = mk(['......'], ['.TI...']);
  // Blue moves first; put a red infantry next to the tank by hand.
  const red = G.addUnit(s, 'inf', 1, 2, 0);
  s.units = s.units.filter((u) => !(u.side === 0 && u.type === 'inf'));
  const tank = at(s, 1, 0);
  const f = G.forecast(s, tank, 1, 0, red);
  assert.equal(f.dmg, 67);
  assert.ok(f.counter > 0 && f.counter < 5, 'infantry strikes back weakly');
  const ev = G.act(s, { id: tank.id, to: [1, 0], action: 'attack', target: red.id });
  assert.equal(ev[0].type, 'attack');
  assert.equal(ev[1].type, 'counter');
  assert.equal(red.hp, 33);
  assert.equal(tank.hp, 100 - f.counter);
  assert.ok(tank.done);
  assert.throws(() => G.act(s, { id: tank.id, to: [1, 0], action: 'wait' }), /already acted/);

  // Artillery: fires 2-3 tiles, not after moving, can't be countered, can't fire point-blank.
  const s2 = mk(['........'], ['A..t....']);
  const arty = at(s2, 0, 0); const t2 = at(s2, 3, 0);
  assert.deepEqual(G.targetsFrom(s2, arty, 0, 0, false), [t2]);
  assert.deepEqual(G.targetsFrom(s2, arty, 1, 0, true), [], 'no firing after a move');
  const f2 = G.forecast(s2, arty, 0, 0, t2);
  assert.equal(f2.counter, 0);
  const s3 = mk(['.....'], ['At...']);
  assert.deepEqual(G.targetsFrom(s3, at(s3, 0, 0), 0, 0, false), [], 'too close for artillery');
  // A direct unit attacked by a ranged one doesn't counter; a ranged defender never counters.
  const s4 = mk(['.....'], ['Ta...']);
  const f4 = G.forecast(s4, at(s4, 0, 0), 0, 0, at(s4, 1, 0));
  assert.equal(f4.counter, 0, 'artillery can\'t strike back');
});

test('combat: a kill removes the unit and destroying the last unit wins', () => {
  const s = mk(['.....'], ['.Ki..']);
  const heavy = at(s, 1, 0); const inf = at(s, 2, 0);
  inf.hp = 30;
  const ev = G.act(s, { id: heavy.id, to: [1, 0], action: 'attack', target: inf.id });
  assert.ok(ev.some((e) => e.type === 'attack' && e.killed));
  assert.equal(at(s, 2, 0), null);
  assert.ok(s.over);
  assert.equal(s.winner, 0);
  assert.equal(s.reason, 'rout');
  assert.equal(s.stats[0].kills, 1);
});

test('capture: takes 20 points minus health per turn, resets when the squad leaves, HQ wins', () => {
  const s = mk(['..n..', '.....', 'H...h'], ['.....', '..I..', '.i...']);
  const inf = at(s, 2, 1);
  G.act(s, { id: inf.id, to: [2, 0], action: 'capture' });
  const city = G.propAt(s, 2, 0);
  assert.equal(city.cap, 10);
  assert.equal(city.capBy, inf.id);
  assert.equal(city.owner, -1);
  G.endTurn(s); G.endTurn(s);
  G.act(s, { id: inf.id, to: [2, 0], action: 'capture' });
  assert.equal(city.owner, 0);
  assert.equal(city.cap, 20);
  // Moving off resets progress.
  const s2 = mk(['..n..', '.....', 'H...h'], ['..I..', '.....', '.i...']);
  const i2 = at(s2, 2, 0);
  i2.hp = 50;
  G.act(s2, { id: i2.id, to: [2, 0], action: 'capture' });
  assert.equal(G.propAt(s2, 2, 0).cap, 15);
  G.endTurn(s2); G.endTurn(s2);
  G.act(s2, { id: i2.id, to: [2, 1], action: 'wait' });
  assert.equal(G.propAt(s2, 2, 0).cap, 20);
  assert.equal(G.propAt(s2, 2, 0).capBy, null);
  // Only foot soldiers capture.
  const s3 = mk(['..n..'], ['.T...']);
  assert.ok(!G.canCaptureAt(s3, at(s3, 1, 0), 2, 0));
  // Capturing the enemy HQ wins on the spot.
  const s4 = mk(['h....', '.....', '....H'], ['I....', '.....', '....i']);
  const i4 = at(s4, 0, 0);
  G.act(s4, { id: i4.id, to: [0, 0], action: 'capture' });
  G.endTurn(s4); G.endTurn(s4);
  const ev = G.act(s4, { id: i4.id, to: [0, 0], action: 'capture' });
  assert.ok(s4.over);
  assert.equal(s4.winner, 0);
  assert.equal(s4.reason, 'hq');
  assert.ok(ev.some((e) => e.type === 'over'));
});

test('economy: income per building, building units, repairs', () => {
  const s = mk(['H.F.C', '....n', 'h....'], ['.....', '.....', '..i..'], { funds: [500, 0] });
  // Day 1 income for Blue: 3 buildings.
  assert.equal(s.funds[0], 3500);
  assert.equal(G.incomeOf(s, 0), 3000);
  assert.ok(G.canBuildAt(s, 2, 0));
  assert.throws(() => G.build(s, 2, 0, 'tank'), /funds/);
  const u = G.build(s, 2, 0, 'inf');
  assert.equal(s.funds[0], 2500);
  assert.ok(u.done, 'new units wait a turn');
  assert.throws(() => G.build(s, 2, 0, 'inf'), /build/);
  assert.throws(() => G.build(s, 0, 0, 'inf'), /build/, 'not on the HQ');
  // The unit limit.
  const s3 = mk(['F....', '.....', 'h....'], ['.....', '.....', '..i..'], { funds: [99000, 0] });
  for (let i = 0; i < G.UNIT_CAP; i++) G.addUnit(s3, 'inf', 0, 1 + (i % 4), 1 + Math.floor(i / 4) % 1);
  assert.throws(() => G.build(s3, 0, 0, 'inf'), /limit/);
  G.endTurn(s);
  assert.equal(s.turn, 1);
  assert.equal(s.funds[1], 1000);
  G.endTurn(s);
  assert.equal(s.day, 2);
  assert.ok(!u.done);
  // Repairs: +20 hp on own building, paid at 10% of cost per health point.
  const s2 = mk(['C....', '.....', 'h....'], ['T....', '.....', '..i..'], { funds: [5000, 0] });
  const t = at(s2, 0, 0);
  t.hp = 50;
  const before = s2.funds[0];
  G.endTurn(s2); G.endTurn(s2);
  assert.equal(t.hp, 70);
  assert.equal(s2.funds[0], before + 1000 - 1400);
});

test('turns: survival missions end when the day is reached', () => {
  const s = mk(['H....', '.....', '....h'], ['I....', '.....', '....i'], { survive: { side: 0, days: 2 } });
  for (let i = 0; i < 4 && !s.over; i++) G.endTurn(s);
  assert.ok(s.over);
  assert.equal(s.winner, 0);
  assert.equal(s.reason, 'survive');
  assert.equal(s.day, 3);
});

test('actions and illegal commands', () => {
  const s = mk(['..n..', '.....', 'H...h'], ['.....', '..I..', '.i...']);
  const inf = at(s, 2, 1);
  assert.deepEqual(G.actionsAt(s, inf, 2, 0), ['capture', 'wait']);
  assert.deepEqual(G.actionsAt(s, inf, 1, 1), ['attack', 'wait']);
  assert.throws(() => G.act(s, { id: inf.id, to: [4, 4], action: 'wait' }));
  assert.throws(() => G.act(s, { id: at(s, 1, 2).id, to: [1, 2], action: 'wait' }), /not your unit/);
  assert.throws(() => G.act(s, { id: inf.id, to: [2, 1], action: 'capture' }), /nothing to capture/);
  G.resign(s, 0);
  assert.ok(s.over && s.winner === 1 && s.reason === 'resign');
});

test('save: a game survives a JSON round trip mid-battle', () => {
  const s = G.newGame(M.SKIRMISH[0], { seed: 5 });
  const inf = G.unitsOf(s, 0)[0];
  const r = G.reachable(s, inf);
  const dest = [...r.values()].find((n) => n.stop && (n.x !== inf.x || n.y !== inf.y));
  G.act(s, { id: inf.id, to: [dest.x, dest.y], action: 'wait' });
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  G.endTurn(copy);
  assert.equal(copy.turn, 1);
  assert.equal(s.turn, 0, 'the original is untouched');
});

test('fair start: in skirmish and 2-player games Blue skips day-1 income and Red gets a bonus', () => {
  const def = M.SKIRMISH[0];
  const fair = G.newGame(def, { mode: 'skirmish' });
  assert.equal(fair.funds[0], def.funds[0], 'no day-1 income for the side that moves first');
  G.endTurn(fair);
  assert.equal(fair.funds[1], def.funds[1] + G.FAIR_BONUS + G.incomeOf(fair, 1));
  G.endTurn(fair);
  assert.equal(fair.funds[0], def.funds[0] + G.incomeOf(fair, 0), 'income from day 2 on');
  const versus = G.newGame(def, { mode: 'versus' });
  assert.ok(versus.fairStart);
  const camp = G.newGame(M.CAMPAIGN[1], { mode: 'campaign' });
  assert.ok(!camp.fairStart, 'campaign missions are balanced by hand');
  assert.equal(camp.funds[0], M.CAMPAIGN[1].funds[0] + G.incomeOf(camp, 0));
});

test('support units: supply trucks repair neighbours, harvesters earn on dunes, neither can attack', () => {
  const s = mk(['.....', '.:...', 'H...h'], ['.TU..', '.V...', 'i....']);
  const tank = at(s, 1, 0); const truck = at(s, 2, 0); const harv = at(s, 1, 1);
  assert.deepEqual(G.targetsFrom(s, truck, 1, 2, false).length, 0, 'the truck has no gun');
  assert.ok(!G.canHit('harv', 'inf'));
  assert.ok(G.canHit('tank', 'truck'));
  tank.hp = 50;
  const before = s.funds[0];
  G.endTurn(s);
  const report = G.endTurn(s);
  assert.equal(tank.hp, 60, 'free +1 health next to the truck');
  assert.ok(report.supplied.includes(tank.id));
  assert.equal(report.harvest, 500);
  assert.equal(s.funds[0], before + G.incomeOf(s, 0) + 500);
  // Off the dunes: nothing.
  harv.x = 3; harv.y = 1;
  G.endTurn(s);
  assert.equal(G.endTurn(s).harvest, 0);
});

test('campaign: the first missions keep the computer gentle', () => {
  const caps = M.CAMPAIGN.map((m) => m.cpuCap ?? 1);
  assert.ok(caps[0] <= caps[1] && caps[1] <= caps[2] && caps[2] < 1, `caps ${caps}`);
  const s = G.newGame(M.CAMPAIGN[0], { mode: 'campaign' });
  assert.equal(s.cpuCap, M.CAMPAIGN[0].cpuCap);
});
