import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../games/colony/logic/sim.js');
const Wd = await import('../games/colony/logic/world.js');
const { generate, START, idx, tx, ty, reach } = await import('../games/colony/logic/map.js');
const { findPath, distanceMap } = await import('../games/colony/logic/path.js');
const { T, P, Z, N, W, TPD, TPH, BUILDS } = await import('../games/colony/logic/data.js');
const { forceEvent, canTrade } = await import('../games/colony/logic/story.js');

const settlers = Wd.settlers;
/** A quiet game: no storyteller events, settlers fed. */
function calm(seed = 5) {
  const s = S.newGame('peaceful', { seed });
  s.story.next = 1e12;
  return s;
}
const runHours = (s, h) => { for (let k = 0; k < h * TPH; k++) { S.tick(s); if (s.pending) S.resolve(s, s.pending.choices[0].id); } };
const near = (s, dx, dy) => idx(START.x + dx, START.y + dy);
const clearTile = (s, i) => { s.ter[i] = T.GRASS; s.plant[i] = P.NONE; delete s.items[i]; };

test('colony map: same seed gives the same map, landing spot open, all walkable land connected', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const a = generate(seed); const b = generate(seed);
    assert.deepEqual(a.ter, b.ter);
    assert.deepEqual(a.plant, b.plant);
    const start = idx(START.x, START.y);
    assert.ok(a.ter[start] <= T.DIRT, 'landing tile walkable');
    const seen = reach(a.ter, start);
    for (let i = 0; i < N; i++) if (a.ter[i] <= T.DIRT) assert.ok(seen[i], `tile ${i} cut off (seed ${seed})`);
    const count = (t) => a.ter.filter((v) => v === t).length;
    assert.ok(count(T.WATER) >= 20, 'water');
    assert.ok(count(T.ROCK) + count(T.ORE) >= 60, 'rock');
    assert.ok(count(T.ORE) >= 20, 'ore');
    assert.ok(a.plant.filter((p) => p === P.TREE || p === P.PINE).length > 100, 'trees');
    assert.ok(a.plant.filter((p) => p === P.BUSH).length >= 10, 'bushes');
  }
});

test('colony path: goes around walls, never cuts corners, reports unreachable', () => {
  const s = calm();
  for (let y = START.y - 6; y <= START.y + 6; y++) for (let x = START.x - 6; x <= START.x + 6; x++) clearTile(s, idx(x, y));
  // A wall from (x+2, y-3) to (x+2, y+3)
  for (let dy = -3; dy <= 3; dy++) { const r = S.build(s, 'wall', near(s, 2, dy)); assert.ok(r.ok); const b = s.blds[r.id]; Wd.completeBuilding(s, b); }
  const cost = Wd.costSettler(s);
  const path = findPath(near(s, 0, 0), near(s, 4, 0), cost);
  assert.ok(path && path.length >= 6, 'detour');
  for (const i of path) assert.ok(Wd.passSettler(s, i), 'only walkable tiles');
  let prev = near(s, 0, 0);
  for (const i of path) {
    const dx = tx(i) - tx(prev); const dy = ty(i) - ty(prev);
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
    if (dx && dy) assert.ok(Wd.passSettler(s, idx(tx(prev) + dx, ty(prev))) && Wd.passSettler(s, idx(tx(prev), ty(prev) + dy)), 'no corner cutting');
    prev = i;
  }
  // Box a tile in completely: unreachable.
  const box = near(s, -4, 0);
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const r = S.build(s, 'swall', idx(tx(box) + dx, ty(box) + dy)); if (r.ok) Wd.completeBuilding(s, s.blds[r.id]);
  }
  assert.equal(findPath(near(s, 0, 0), box, cost), null);
  const dm = distanceMap(near(s, 0, 0), (i) => Wd.passSettler(s, i));
  assert.equal(dm[box], -1);
  // A door lets settlers through but not animals.
  const door = idx(tx(box) + 1, ty(box));
  Wd.removeBuilding(s, Wd.bAt(s, door));
  const d = S.build(s, 'door', door); Wd.completeBuilding(s, s.blds[d.id]);
  assert.ok(findPath(near(s, 0, 0), box, cost));
  assert.equal(findPath(near(s, 0, 0), box, Wd.costAnimal(s)), null);
});

test('colony jobs: chopped wood ends up on the stockpile', () => {
  const s = calm(7);
  const stockTiles = [];
  for (let x = -2; x <= 2; x++) for (let y = 3; y <= 5; y++) stockTiles.push(near(s, x, y));
  S.zone(s, 'stock', stockTiles);
  const tree = near(s, 4, -3); clearTile(s, tree); s.plant[tree] = P.TREE;
  S.designate(s, 'chop', [tree]);
  runHours(s, 14);
  assert.equal(s.plant[tree], P.NONE, 'tree chopped');
  const loose = Object.entries(s.items).filter(([i]) => !Wd.isStore(s, +i));
  assert.equal(loose.length, 0, `everything hauled (${JSON.stringify(loose)})`);
  assert.ok(Wd.stock(s).wood >= 40 + 9, 'wood counted');
});

test('colony jobs: a bed gets built from a blueprint and uses wood', () => {
  const s = calm(8);
  const before = Wd.stock(s).wood;
  const at = near(s, 0, -3); clearTile(s, at);
  const r = S.build(s, 'bed', at);
  assert.ok(r.ok);
  runHours(s, 10);
  assert.ok(s.blds[r.id].done, 'bed done');
  assert.equal(Wd.stock(s).wood, before - BUILDS.bed.cost.wood);
});

test('colony jobs: a campfire cooks raw food into meals', () => {
  const s = calm(9);
  for (const [k, it] of Object.entries(s.items)) if (it.k === 'meal') delete s.items[k];
  const fire = near(s, 0, -3); clearTile(s, fire);
  const r = S.build(s, 'campfire', fire);
  runHours(s, 12);
  assert.ok(s.blds[r.id].done);
  assert.ok(s.stats.meals > 0, 'meals cooked');
});

test('colony jobs: farm plots get sown, grow and are harvested', () => {
  const s = calm(10);
  s.day0 = 2; // warm spring days
  const plot = [];
  for (let x = 3; x <= 5; x++) for (let y = -2; y <= 0; y++) { const i = near(s, x, y); clearTile(s, i); plot.push(i); }
  S.zone(s, 'farm', plot);
  runHours(s, 8);
  assert.ok(plot.every((i) => s.crop[i] >= 0), 'all sown');
  runHours(s, 24 * 6);
  assert.ok(s.stats.harvests >= 5, `harvested (${s.stats.harvests})`);
  assert.ok((Wd.stock(s).crop || 0) > 0);
});

test('colony needs: hunger hurts, sleep restores, eating fixes hunger', () => {
  const s = calm(11);
  const p = settlers(s)[0];
  for (const k of Object.keys(s.items)) delete s.items[k];
  for (let i = 0; i < N; i++) if (s.plant[i] === P.BUSH) s.plant[i] = P.NONE;
  p.food = 0; p.hp = 100;
  runHours(s, 6);
  assert.ok(p.hp < 100, 'starving hurts');
  assert.ok(p.sit.includes('starving'));
  Wd.dropNear(s, p.at, 'meal', 5);
  runHours(s, 3);
  assert.ok(p.food > 0.4, 'ate');
  p.rest = 0.05;
  runHours(s, 10);
  assert.ok(p.rest > 0.6, `slept (${p.rest})`);
});

test('colony events: raids come in standard mode and settlers fight them off', () => {
  const s = S.newGame('standard', { seed: 21, skill: 0.4 });
  for (const p of settlers(s)) p.gear.weapon = 'spear';
  s.story.firstThreat = 1; s.story.lastThreat = -1e9; s.story.next = s.t + 1;
  forceEvent(s, 'raid');
  assert.equal(s.pending?.kind, 'raid');
  S.resolve(s, 'fight');
  assert.ok(Wd.hostiles(s).length > 0);
  assert.equal(s.alert, 'fight');
  s.story.next = 1e12;
  for (let k = 0; k < TPD && s.mobs.some((m) => m.kind === 'raider' && !m.dead); k++) S.tick(s);
  assert.equal(Wd.hostiles(s).length, 0, 'raid over');
  for (let k = 0; k < 20; k++) S.tick(s);
  assert.equal(s.alert, null);
  assert.ok(s.stats.raidsWon >= 1);
});

test('colony events: peaceful mode never sends raids or wolves', () => {
  const s = S.newGame('peaceful', { seed: 22 });
  for (let d = 0; d < 30; d++) {
    for (let k = 0; k < TPD; k++) {
      S.tick(s);
      if (s.pending) { assert.ok(!['raid', 'wolves'].includes(s.pending.kind), s.pending.kind); S.resolve(s, s.pending.choices[s.pending.choices.length - 1].id); }
    }
  }
  assert.equal(s.mobs.filter((m) => m.kind === 'raider').length, 0);
});

test('colony events: refugees join, traders swap goods', () => {
  const s = calm(23);
  const before = settlers(s).length;
  forceEvent(s, 'refugees');
  assert.equal(s.pending.kind, 'refugees');
  S.resolve(s, 'yes');
  assert.equal(settlers(s).length, before + 2);
  forceEvent(s, 'trader');
  const deals = s.pending.deals;
  const i = deals.findIndex((d) => canTrade(s, d));
  if (i >= 0) {
    const [k, n] = Object.entries(deals[i].give)[0];
    const had = Wd.stock(s)[k];
    assert.ok(S.trade(s, i));
    assert.equal(Wd.stock(s)[k] || 0, had - n);
    assert.ok(!S.trade(s, i), 'a deal works once');
  }
  S.resolve(s, 'leave');
  assert.equal(s.pending, null);
});

test('colony save: a game survives JSON and keeps running the same way', () => {
  const s = S.newGame('standard', { seed: 31 });
  runHours(s, 30);
  const raw = S.serialize(s);
  const json = JSON.parse(JSON.stringify(raw));
  const a = S.deserialize(json);
  assert.ok(a);
  assert.equal(a.t, s.t);
  runHours(a, 24);
  assert.ok(a.t > s.t);
  assert.equal(S.deserialize({ v: 0 }), null, 'old or broken saves are refused');
  assert.equal(S.deserialize(null), null);
});

test('colony daily: same seed, same scenario and map; score is wealth or days', () => {
  const a = S.newGame('daily', { seed: 777 }); const b = S.newGame('daily', { seed: 777 });
  assert.equal(a.scenario, b.scenario);
  assert.deepEqual(a.ter, b.ter);
  assert.equal(a.skill, 0.4);
  assert.ok(S.dailyScore(a, true) > 0);
  assert.equal(S.dailyScore(a, false), 0);
});

test('colony orders: designations only stick to the right things; zones skip rock and buildings', () => {
  const s = calm(41);
  const rock = s.ter.findIndex((t) => t === T.ROCK);
  const grass = near(s, 0, 2); clearTile(s, grass);
  assert.equal(S.designate(s, 'mine', [rock, grass]), 1);
  assert.equal(S.designate(s, 'chop', [grass]), 0);
  assert.equal(S.zone(s, 'farm', [rock]), 0);
  S.build(s, 'bed', grass);
  assert.equal(S.zone(s, 'stock', [grass]), 0);
  assert.equal(S.designate(s, 'cancel', [grass, rock]), 2, 'cancel removes the blueprint and the order');
  assert.ok(!s.bld[grass]);
});
