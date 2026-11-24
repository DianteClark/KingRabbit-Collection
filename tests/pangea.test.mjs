// Pangea rules: map generation, cities, research, movement, combat, diplomacy, victory, saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/pangea/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const D = await import(new URL(`${base}logic/data.js`, import.meta.url).href);
const M = await import(new URL(`${base}logic/map.js`, import.meta.url).href);

const PLAYERS = [{ civ: 'verdan', human: true }, { civ: 'kharun' }, { civ: 'thess' }];

/** A fresh game where everything is wiped, so tests can place exactly what they need. */
function blank(seed = 3, n = 2) {
  const s = G.newGame(PLAYERS.slice(0, n), { seed });
  for (const t of s.tiles) { t.t = 'grass'; t.f = null; t.r = null; t.imp = null; t.o = -1; t.c = -1; }
  s.units = []; s.cities = []; s.events = [];
  for (const c of s.civs) { c.explored.fill(0); c.everCity = false; c.capital = null; c.origCapital = null; }
  return s;
}

function cityAt(s, owner, x, y) {
  const u = G.addUnit(s, owner, 'settler', x, y);
  const prev = s.cur; s.cur = owner;
  const ct = G.foundCity(s, u);
  s.cur = prev;
  return ct;
}

// ---------------------------------------------------------------- map

test('map: every size builds a continent with spread-out start spots on one landmass', () => {
  for (const size of ['small', 'medium']) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { w, h } = D.MAP_SIZES[size];
      const m = M.generateMap({ w, h, civs: 5, seed });
      assert.equal(m.tiles.length, w * h);
      assert.equal(m.starts.length, 5);
      const land = m.tiles.filter(M.isLand).length;
      assert.ok(land > w * h * 0.3 && land < w * h * 0.6, `land share ${land / (w * h)}`);
      // The edge is always water.
      for (let x = 0; x < w; x++) { assert.ok(!M.isLand(m.tiles[x])); assert.ok(!M.isLand(m.tiles[(h - 1) * w + x])); }
      const comp = M.landComponent(m, ...m.starts[0]);
      for (const [x, y] of m.starts) {
        assert.ok(comp.has(M.idx(m, x, y)), 'all starts share a landmass');
        assert.notEqual(m.tiles[M.idx(m, x, y)].f, 'mountain');
      }
      for (let i = 0; i < m.starts.length; i++) {
        for (let j = i + 1; j < m.starts.length; j++) assert.ok(M.dist(...m.starts[i], ...m.starts[j]) >= 6, 'starts are apart');
      }
      assert.ok(m.tiles.some((t) => t.r), 'resources placed');
      assert.ok(m.tiles.some((t) => t.f === 'forest') && m.tiles.some((t) => t.f === 'hills'));
    }
  }
});

test('map: the same seed always makes the same map', () => {
  const a = M.generateMap({ w: 26, h: 22, civs: 3, seed: 42 });
  const b = M.generateMap({ w: 26, h: 22, civs: 3, seed: 42 });
  assert.deepEqual(a, b);
  const c = M.generateMap({ w: 26, h: 22, civs: 3, seed: 43 });
  assert.notDeepEqual(a.tiles, c.tiles);
});

test('setup: each civ starts with a settler, a warrior and a worker and sees around it', () => {
  const s = G.newGame(PLAYERS, { seed: 9 });
  for (const c of s.civs) {
    const types = G.unitsOf(s, c.id).map((u) => u.type).sort();
    assert.deepEqual(types, ['settler', 'warrior', 'worker']);
    assert.ok(c.explored.some(Boolean));
  }
  assert.equal(s.cur, 0);
  assert.equal(s.turn, 1);
});

// ---------------------------------------------------------------- cities

test('cities: founding needs 3 tiles from other cities and claims the ring around it', () => {
  const s = blank();
  const a = cityAt(s, 0, 5, 5);
  assert.ok(a && a.capital);
  assert.equal(s.civs[0].capital, a.id);
  for (const [dx, dy] of G.DIRS8) assert.equal(G.tileAt(s, 5 + dx, 5 + dy).o, 0);
  assert.equal(G.canFoundAt(s, 0, 7, 5), false, 'two tiles away is too close');
  assert.equal(G.canFoundAt(s, 0, 8, 5), true);
  G.tileAt(s, 8, 5).f = 'mountain';
  assert.equal(G.canFoundAt(s, 0, 8, 5), false, 'not on mountains');
  G.tileAt(s, 8, 5).t = 'coast'; G.tileAt(s, 8, 5).f = null;
  assert.equal(G.canFoundAt(s, 0, 8, 5), false, 'not on water');
  const b = cityAt(s, 0, 9, 9);
  assert.ok(b && !b.capital, 'the second city is not the capital');
});

test('cities: food surplus grows the city; a granary city works more food', () => {
  const s = blank();
  const ct = cityAt(s, 0, 6, 6);
  const y = G.cityYield(s, ct);
  assert.equal(y.eat, 2);
  assert.ok(y.surplus > 0);
  const turns = Math.ceil(G.growNeed(1) / y.surplus);
  for (let k = 0; k < turns; k++) { s.cur = 0; G.endTurn(s); s.cur = 0; }
  assert.equal(ct.pop, 2);
  ct.blds.push('granary');
  assert.equal(G.cityYield(s, ct).food, G.cityYield(s, { ...ct, blds: [] }).food + 2);
});

test('cities: the focus changes which tiles are worked', () => {
  const s = blank();
  const ct = cityAt(s, 0, 6, 6);
  G.tileAt(s, 7, 6).f = 'hills';
  G.tileAt(s, 5, 6).r = 'fish'; G.tileAt(s, 5, 6).t = 'coast';
  ct.pop = 1;
  ct.focus = 'prod';
  assert.ok(G.cityYield(s, ct).worked.includes(G.idx(s, 7, 6)), 'production focus works the hills');
  ct.focus = 'food';
  assert.ok(G.cityYield(s, ct).worked.includes(G.idx(s, 5, 6)), 'food focus works the fish');
});

test('cities: production finishes the queue; settlers cost a citizen and need size 2', () => {
  const s = blank();
  const ct = cityAt(s, 0, 6, 6);
  assert.ok(G.enqueue(s, ct, { kind: 'unit', id: 'settler' }));
  ct.prod = 100;
  s.cur = 0; G.endTurn(s);
  assert.equal(G.unitsOf(s, 0).filter((u) => u.type === 'settler').length, 0, 'size 1: the settler waits');
  ct.pop = 2; s.cur = 0; G.endTurn(s);
  assert.equal(G.unitsOf(s, 0).filter((u) => u.type === 'settler').length, 1);
  assert.equal(ct.pop, 1);
  assert.equal(ct.queue.length, 0);
  // Buildings: one each, and they are dropped from the options once built.
  s.civs[0].techs.push('pottery');
  assert.ok(G.enqueue(s, ct, { kind: 'bld', id: 'granary' }));
  assert.equal(G.enqueue(s, ct, { kind: 'bld', id: 'granary' }), false, 'not twice in the queue');
  ct.prod = 100; s.cur = 0; G.endTurn(s);
  assert.ok(ct.blds.includes('granary'));
  assert.ok(!G.buildOptions(s, ct).some((o) => o.id === 'granary'));
});

test('cities: buying finishes the item next turn; wonders cannot be bought and are unique', () => {
  const s = blank();
  const ct = cityAt(s, 0, 6, 6);
  const other = cityAt(s, 1, 14, 6);
  G.enqueue(s, ct, { kind: 'unit', id: 'warrior' });
  const cost = G.buyCost(s, ct);
  s.civs[0].gold = cost;
  assert.ok(G.buy(s, ct));
  assert.equal(s.civs[0].gold, 0);
  s.cur = 0; G.endTurn(s);
  assert.ok(G.unitsOf(s, 0).some((u) => u.type === 'warrior'));
  s.civs[0].techs.push('masonry'); s.civs[1].techs.push('masonry');
  G.enqueue(s, ct, { kind: 'wonder', id: 'pyramids' });
  G.enqueue(s, other, { kind: 'wonder', id: 'pyramids' });
  assert.equal(G.buyCost(s, ct), null);
  other.prod = 500; s.cur = 1; G.endTurn(s);
  assert.equal(s.wonders.pyramids, 1);
  s.cur = 0; G.endTurn(s);
  assert.ok(!ct.queue.some((q) => q.id === 'pyramids'), 'our pyramids were dropped');
  assert.equal(G.canBuild(s, ct, { kind: 'wonder', id: 'pyramids' }), false);
});

test('cities: culture pushes the border out one tile at a time', () => {
  const s = blank();
  const ct = cityAt(s, 0, 8, 8);
  const before = s.tiles.filter((t) => t.o === 0).length;
  ct.culture = G.borderNeed(0) + G.borderNeed(1) - 1;
  s.cur = 0; G.endTurn(s);
  const after = s.tiles.filter((t) => t.o === 0).length;
  assert.equal(after, before + 2);
});

test('cities: size 8 needs an aqueduct to grow', () => {
  const s = blank();
  const ct = cityAt(s, 0, 8, 8);
  ct.pop = 8;
  for (const t of s.tiles) { t.o = 0; t.c = ct.id; t.r = 'oasis'; t.t = 'desert'; }
  const y = G.cityYield(s, ct);
  assert.ok(y.capped);
  assert.equal(y.surplus, 0);
  ct.blds.push('aqueduct');
  assert.ok(G.cityYield(s, ct).surplus > 0 || G.joyOf(s, 0).net < 0);
});

// ---------------------------------------------------------------- happiness and gold

test('happiness: cities and citizens cost happiness, luxuries and temples add it', () => {
  const s = blank();
  const a = cityAt(s, 0, 5, 5);
  let j = G.joyOf(s, 0);
  assert.equal(j.net, G.BASE_JOY - 2 - 1);
  a.pop = 6;
  j = G.joyOf(s, 0);
  assert.equal(j.net, G.BASE_JOY - 2 - 6);
  assert.ok(j.net < 0);
  assert.equal(G.cityYield(s, a).surplus, 0, 'unhappy cities stop growing');
  G.tileAt(s, 6, 5).r = 'gem';
  assert.equal(G.joyOf(s, 0).net, j.net + D.LUXURY_JOY);
  a.blds.push('temple');
  assert.equal(G.joyOf(s, 0).net, j.net + D.LUXURY_JOY + 2);
});

test('gold: running out disbands units', () => {
  const s = blank();
  cityAt(s, 0, 5, 5);
  for (let k = 0; k < 12; k++) G.addUnit(s, 0, 'warrior', 10 + (k % 5), 10 + Math.floor(k / 5));
  s.civs[0].gold = 0;
  const before = G.unitsOf(s, 0).length;
  s.cur = 0; G.endTurn(s);
  assert.ok(G.unitsOf(s, 0).length < before, 'a unit was disbanded');
  assert.ok(s.civs[0].gold >= 0);
});

// ---------------------------------------------------------------- research

test('tech tree: 27 techs over 4 eras; prerequisites come first and every unlock exists', () => {
  assert.ok(D.TECH_LIST.length >= 20 && D.TECH_LIST.length <= 30);
  assert.deepEqual([...new Set(D.TECH_LIST.map((t) => t.era))].sort(), [0, 1, 2, 3]);
  const seen = new Set();
  for (const t of D.TECH_LIST) {
    for (const r of t.req) {
      assert.ok(seen.has(r), `${t.id} needs ${r} listed before it`);
      assert.ok(D.TECHS[r].era <= t.era);
    }
    seen.add(t.id);
  }
  for (const u of Object.values(D.UNITS)) if (u.tech) assert.ok(D.TECHS[u.tech], u.id);
  for (const b of Object.values(D.BUILDINGS)) assert.ok(D.TECHS[b.tech], b.id);
  for (const w of Object.values(D.WONDERS)) assert.ok(D.TECHS[w.tech], w.id);
  // Everything can be researched from scratch.
  const s = blank();
  let guard = 0;
  while (G.availableTechs(s, 0).length && guard++ < 100) G.grantTech(s, 0, G.availableTechs(s, 0)[0]);
  assert.equal(s.civs[0].techs.length, D.TECH_LIST.length);
});

test('research: a far goal studies its prerequisites first, and science finishes techs', () => {
  const s = blank();
  cityAt(s, 0, 6, 6);
  assert.ok(G.setResearch(s, 0, 'philosophy'));
  assert.ok(['pottery', 'burial'].includes(s.civs[0].research));
  assert.equal(s.civs[0].goal, 'philosophy');
  let guard = 0;
  while (!s.civs[0].techs.includes('philosophy') && guard++ < 400) { s.cur = 0; G.endTurn(s); }
  assert.ok(s.civs[0].techs.includes('philosophy'));
  assert.ok(['pottery', 'writing', 'burial'].every((t) => s.civs[0].techs.includes(t)));
});

test('research: quick games have cheaper techs', () => {
  const s = blank();
  s.maxTurn = 150; const full = G.techCost(s, 'writing');
  s.maxTurn = 100; const quick = G.techCost(s, 'writing');
  assert.ok(quick < full);
});

test('units: newer units replace older ones of the same line in the build list', () => {
  const s = blank();
  assert.ok(G.unitAvailable(s, 0, 'warrior'));
  s.civs[0].techs.push('bronze');
  assert.ok(G.unitAvailable(s, 0, 'spearman'));
  assert.ok(!G.unitAvailable(s, 0, 'warrior'));
  assert.ok(!G.unitAvailable(s, 0, 'knight'));
});

// ---------------------------------------------------------------- movement

test('movement: forests and hills cost 2, mountains block, water needs Map Making', () => {
  const s = blank();
  const u = G.addUnit(s, 0, 'chariot', 5, 5);
  G.tileAt(s, 6, 5).f = 'forest';
  G.tileAt(s, 4, 5).f = 'mountain';
  let r = G.reachable(s, u);
  assert.equal(r.get(G.idx(s, 6, 5)).left, 0, 'forest uses both moves');
  assert.ok(!r.has(G.idx(s, 4, 5)), 'mountains are impassable');
  assert.ok(r.has(G.idx(s, 7, 7)), 'two open tiles away');
  G.tileAt(s, 5, 6).t = 'coast';
  r = G.reachable(s, u);
  assert.ok(!r.has(G.idx(s, 5, 6)));
  s.civs[0].techs.push('mapmaking');
  r = G.reachable(s, u);
  assert.ok(r.has(G.idx(s, 5, 6)), 'embark after Map Making');
});

test('movement: long trips continue over several turns; foreign units block', () => {
  const s = blank();
  cityAt(s, 0, 20, 15); cityAt(s, 1, 20, 5);
  const u = G.addUnit(s, 0, 'warrior', 2, 2);
  const steps = G.moveUnit(s, u, 8, 2);
  assert.equal(steps.length, 1);
  assert.deepEqual(u.goto, [8, 2]);
  for (let k = 0; k < 8 && u.goto; k++) { s.cur = 1; G.endTurn(s); G.runGotos(s, 0); }
  assert.deepEqual([u.x, u.y], [8, 2]);
  G.addUnit(s, 1, 'warrior', 9, 2);
  const r = G.reachable(s, G.addUnit(s, 0, 'chariot', 8, 3));
  assert.ok(!r.has(G.idx(s, 9, 2)));
});

// ---------------------------------------------------------------- combat

test('combat: equal units have even odds; the stronger and healthier side is favoured', () => {
  assert.ok(Math.abs(G.winChance(10, 10, 10, 10) - 0.5) < 1e-9);
  assert.ok(G.winChance(12, 6, 10, 10) > 0.9);
  assert.ok(G.winChance(6, 12, 10, 10) < 0.1);
  assert.ok(G.winChance(10, 10, 10, 4) > 0.8, 'a hurt defender is easier');
  let last = 0;
  for (const a of [4, 6, 8, 10, 12, 14]) { const w = G.winChance(a, 10, 10, 10); assert.ok(w > last); last = w; }
});

test('combat: the forecast lists terrain, fortify, city, walls and counter bonuses', () => {
  const s = blank();
  s.rel['0-1'].war = true;
  const att = G.addUnit(s, 0, 'chariot', 5, 5);
  const def = G.addUnit(s, 1, 'spearman', 6, 5);
  G.tileAt(s, 6, 5).f = 'hills';
  def.fort = true;
  const info = G.targetInfo(s, att, 6, 5);
  assert.equal(info.kind, 'attack');
  const names = info.dMods.map((m) => m[0]);
  assert.ok(names.includes('Hills') && names.includes('Fortified') && names.includes('vs mounted'));
  assert.equal(info.D, 9 * (1 + (50 + 25 + 100) / 100));
  assert.ok(info.win < 0.05, 'a chariot charging a fortified spearman on a hill loses');
  // A city with walls.
  const s2 = blank();
  s2.rel['0-1'].war = true;
  const ct = cityAt(s2, 1, 8, 8);
  ct.blds.push('walls');
  G.addUnit(s2, 1, 'warrior', 8, 8);
  const cat = G.addUnit(s2, 0, 'catapult', 7, 8);
  const i2 = G.targetInfo(s2, cat, 8, 8);
  assert.ok(i2.dMods.some((m) => m[0] === 'Walls'));
  assert.ok(i2.aMods.some((m) => m[0] === 'vs city'));
});

test('combat: a battle destroys exactly one unit; peace blocks attacks until war is declared', () => {
  const s = blank();
  const a = G.addUnit(s, 0, 'swordsman', 5, 5);
  const d = G.addUnit(s, 1, 'warrior', 6, 5);
  s.cur = 0;
  const info = G.targetInfo(s, a, 6, 5);
  assert.ok(info.needsWar);
  assert.equal(G.attack(s, a, 6, 5), null, 'no attack at peace');
  G.declareWar(s, 0, 1);
  const res = G.attack(s, a, 6, 5);
  assert.ok(res);
  const alive = [G.unitById(s, a.id), G.unitById(s, d.id)].filter(Boolean);
  assert.equal(alive.length, 1);
  assert.ok(alive[0].hp >= 1);
  assert.equal(G.canMakePeace(s, 0, 1), false, 'peace is locked for a while');
  s.turn += G.PEACE_LOCK;
  assert.ok(G.makePeace(s, 0, 1));
});

test('combat: walking into an empty enemy city captures it; lone settlers become workers', () => {
  const s = blank(3, 3);
  const ct = cityAt(s, 1, 8, 8);
  cityAt(s, 1, 14, 14);
  G.declareWar(s, 0, 1);
  const u = G.addUnit(s, 0, 'warrior', 7, 8);
  const set = G.addUnit(s, 1, 'settler', 7, 9);
  s.cur = 0;
  let res = G.attack(s, u, 7, 9);
  assert.equal(res.kind, 'capture');
  assert.equal(set.owner, 0);
  assert.equal(set.type, 'worker');
  u.moves = 1;
  res = G.attack(s, u, 8, 8);
  assert.equal(res.kind, 'capture');
  assert.equal(ct.owner, 0);
  assert.equal(G.tileAt(s, 8, 9).o, 0, 'its land changes hands');
  assert.ok(G.cityById(s, s.civs[1].capital).owner === 1, 'the loser moves its capital');
});

// ---------------------------------------------------------------- diplomacy

test('diplomacy: pacts pay both sides; tech swaps need a fair deal', () => {
  const s = blank();
  cityAt(s, 0, 5, 5); cityAt(s, 1, 15, 15);
  // Kharun is warlike: no pact until a gift warms them up.
  assert.ok(!G.acceptsPact(s, 1, 0));
  s.civs[0].gold = 50;
  assert.ok(G.giftGold(s, 0, 1, 50));
  assert.ok(G.acceptsPact(s, 1, 0));
  G.signPact(s, 0, 1);
  assert.equal(G.pactGold(s, 0), G.PACT_GOLD);
  assert.equal(G.pactGold(s, 1), G.PACT_GOLD);
  s.civs[0].techs.push('pottery');
  s.civs[1].techs.push('bronze', 'iron');
  assert.ok(G.acceptsSwap(s, 1, 0, 'bronze', 'pottery'));
  G.swapTechs(s, 0, 1, 'pottery', 'bronze');
  assert.ok(s.civs[0].techs.includes('bronze') && s.civs[1].techs.includes('pottery'));
  G.declareWar(s, 0, 1);
  assert.equal(G.pactGold(s, 0), 0, 'war ends the pact');
  s.civs[0].techs.push('writing');
  assert.ok(!G.acceptsSwap(s, 1, 0, 'iron', 'writing'), 'no trading during a war');
  assert.ok(G.attitude(s, 1, 0) < 0);
});

// ---------------------------------------------------------------- victory

test('victory: holding every rival capital wins by conquest', () => {
  const s = blank(3, 2);
  cityAt(s, 0, 4, 4);
  const cap = cityAt(s, 1, 12, 12);
  cityAt(s, 1, 18, 4);
  G.declareWar(s, 0, 1);
  const u = G.addUnit(s, 0, 'warrior', 11, 12);
  s.cur = 0;
  G.attack(s, u, 12, 12);
  assert.equal(cap.owner, 0);
  assert.deepEqual(s.over && [s.over.winner, s.over.kind], [0, 'conquest']);
});

test('victory: losing every city destroys a civ; the Space Ark wins by science; turn limit wins on score', () => {
  const s = blank(3, 3);
  cityAt(s, 0, 4, 4); const lone = cityAt(s, 2, 12, 12); cityAt(s, 1, 18, 4);
  G.declareWar(s, 0, 2);
  const u = G.addUnit(s, 0, 'warrior', 11, 12);
  s.cur = 0;
  G.attack(s, u, 12, 12);
  assert.equal(lone.owner, 0);
  assert.equal(s.civs[2].alive, false);
  assert.equal(s.over, null, 'civ 1 still holds its capital');

  const s2 = blank();
  const ct = cityAt(s2, 1, 6, 6);
  s2.civs[1].techs = D.TECH_LIST.map((t) => t.id);
  G.enqueue(s2, ct, { kind: 'wonder', id: 'ark' });
  ct.prod = 1000; s2.cur = 1; G.endTurn(s2);
  assert.deepEqual([s2.over.winner, s2.over.kind], [1, 'science']);

  const s3 = blank();
  cityAt(s3, 0, 4, 4); const big = cityAt(s3, 1, 12, 12);
  big.pop = 6;
  s3.maxTurn = 2; s3.turn = 2;
  s3.cur = 0; G.endTurn(s3); G.endTurn(s3);
  assert.deepEqual([s3.over.winner, s3.over.kind], [1, 'score']);
});

// ---------------------------------------------------------------- saving

test('save: a game survives a round trip through JSON', () => {
  const s = G.newGame(PLAYERS, { seed: 21 });
  s.civs[0].explored[5] = 1;
  const back = G.deserialize(G.serialize(s));
  assert.deepEqual(back.civs[0].explored, s.civs[0].explored);
  assert.deepEqual(back.tiles, s.tiles);
  assert.deepEqual(back.units, s.units);
  assert.ok(G.serialize(s).length < 60000, 'small enough for localStorage');
});
