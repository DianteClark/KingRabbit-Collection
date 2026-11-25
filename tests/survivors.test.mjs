// Rabbit Survivors: wave scheduling, level-up offers, evolutions, damage math, the meta shop,
// the daily challenge and the collision grid, all in node.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/survivors/', import.meta.url).href;
const D = await import(base + 'logic/data.js');
const W = await import(base + 'logic/waves.js');
const B = await import(base + 'logic/build.js');
const Meta = await import(base + 'logic/meta.js');
const { makeRng } = await import(base + 'logic/rng.js');
const { Grid } = await import(base + 'logic/grid.js');

test('the run is 15 minutes with a wave row per minute, only known monsters, capped at 300', () => {
  assert.equal(D.RUN_SECONDS, 900);
  assert.equal(W.MINUTES.length, 15);
  for (const row of W.MINUTES) {
    for (const t of row.types) assert.ok(D.ENEMIES[t], t);
    assert.ok(row.cap <= D.MAX_ENEMIES);
  }
  assert.ok(Object.keys(D.ENEMIES).length >= 10);
});

test('difficulty only ramps up, and Easy ramps slower and hits softer', () => {
  let prev = W.waveAt(0);
  for (let t = 10; t <= 900; t += 10) {
    const w = W.waveAt(t);
    assert.ok(w.rate >= prev.rate && w.cap >= prev.cap && w.hpMul >= prev.hpMul, `t=${t}`);
    prev = w;
  }
  const n = W.waveAt(480); const e = W.waveAt(480, true);
  assert.ok(e.minute < n.minute && e.hpMul < n.hpMul && e.dmgMul < n.dmgMul && e.rate < n.rate);
  assert.equal(W.waveAt(899).cap, 300);
});

test('bosses at 5, 10 and 15 minutes, elites on the other minutes, swarms in between', () => {
  const ev = W.eventsBetween(0, 900);
  assert.deepEqual(ev.filter((e) => e.kind === 'boss').map((e) => e.at), [300, 600, 900]);
  assert.ok(ev.find((e) => e.at === 900).boss.final);
  const elites = ev.filter((e) => e.kind === 'elite').map((e) => e.at);
  assert.equal(elites.length, 12);
  assert.ok(!elites.includes(300) && elites.includes(60) && elites.includes(840));
  assert.equal(ev.filter((e) => e.kind === 'swarm').length, 3);
  // small steps see each event exactly once
  let count = 0;
  for (let t = 0; t < 900; t += 1 / 30) count += W.eventsBetween(t, t + 1 / 30).length;
  assert.equal(count, ev.length);
});

test('spawning keeps fractional spawns and never passes the cap', () => {
  let acc = 0; let total = 0;
  for (let k = 0; k < 60; k++) { const r = W.spawnCount(acc, 2, 1 / 60, 0, 300); acc = r.acc; total += r.n; }
  assert.ok(total === 2 || total === 1, String(total));
  assert.equal(W.spawnCount(0.5, 100, 1, 295, 300).n, 5);
  assert.equal(W.spawnCount(0.5, 100, 1, 300, 300).n, 0);
  assert.equal(W.fmtClock(905), '15:05');
});

test('level-up offers: 3 distinct cards, no maxed items, evolution first when ready', () => {
  const rng = makeRng(5);
  const b = B.newBuild('wanderer');
  assert.deepEqual(b.weapons, { dagger: 1 });
  for (let k = 0; k < 200; k++) {
    const offers = B.rollOffers(b, rng);
    assert.ok(offers.length === 3 || offers.every((o) => o.kind === 'gold' || o.kind === 'heal'));
    assert.equal(new Set(offers.map((o) => o.kind + o.id)).size, offers.length);
    B.applyOffer(b, offers[0]);
    for (const v of [...Object.values(b.weapons), ...Object.values(b.passives)]) assert.ok(v <= 5);
  }
  // everything maxed and evolved: gold or a snack
  const full = { weapons: {}, passives: {}, evolved: {} };
  D.WEAPON_IDS.forEach((id) => { full.weapons[id] = 5; full.evolved[id] = 'x'; });
  D.PASSIVE_IDS.forEach((id) => { full.passives[id] = 5; });
  assert.deepEqual(B.rollOffers(full, rng).map((o) => o.kind), ['gold', 'heal']);
});

test('evolutions need a maxed weapon plus its passive, and only happen once', () => {
  assert.ok(D.EVOLUTION_IDS.length >= 3);
  for (const id of D.EVOLUTION_IDS) {
    const e = D.EVOLUTIONS[id];
    assert.ok(D.WEAPONS[e.from] && D.PASSIVES[e.needs], id);
    const b = { weapons: { [e.from]: 4 }, passives: { [e.needs]: 1 }, evolved: {} };
    assert.deepEqual(B.readyEvolutions(b), []);
    b.weapons[e.from] = 5;
    assert.deepEqual(B.readyEvolutions(b), [id]);
    assert.deepEqual(B.rollOffers(b, makeRng(1))[0], { kind: 'evolve', id, level: 1 });
    B.applyOffer(b, { kind: 'evolve', id });
    assert.deepEqual(B.readyEvolutions(b), []);
    assert.ok(!B.rollOffers(b, makeRng(1)).some((o) => o.id === e.from));
    const s = B.weaponStats(e.from, 5, B.playerStats('wanderer'), id);
    assert.ok(s.dmg > D.WEAPONS[e.from].dmg[4], `${id} hits harder`);
  }
  const b = { weapons: { dagger: 5 }, passives: {}, evolved: {} };
  assert.deepEqual(B.readyEvolutions(b), [], 'no passive, no evolution');
});

test('damage math: might scales hits, armor and Easy soften monster hits, never below 1', () => {
  assert.equal(B.hitDamage(10, 1.5), 15);
  assert.equal(B.hitDamage(0.2, 1), 1);
  assert.equal(B.hurtDamage(10, 1, 2), 8);
  assert.equal(B.hurtDamage(3, 1, 10), 1);
  assert.ok(B.hurtDamage(20, W.waveAt(300, true).dmgMul) < B.hurtDamage(20, W.waveAt(300).dmgMul));
  const lo = B.weaponStats('dagger', 1, B.playerStats('wanderer'));
  const hi = B.weaponStats('dagger', 5, B.playerStats('wanderer', {}, { ring: 5 }));
  assert.ok(hi.cd < lo.cd && hi.dmg > lo.dmg && hi.count > lo.count);
  const area = B.weaponStats('bomb', 1, B.playerStats('wanderer', {}, { tome: 5 }));
  assert.ok(Math.abs(area.radius - 40 * 1.5) < 1e-9);
});

test('stats: heroes differ, passives and shop stack, Easy adds health', () => {
  const w = B.playerStats('wanderer'); const r = B.playerStats('ranger'); const br = B.playerStats('brute');
  assert.ok(r.speed > w.speed && br.maxHp > w.maxHp && br.armor === 1);
  const up = B.playerStats('wanderer', { might: 2, vitality: 3, revival: 1 }, { heart: 2, might: 1 });
  assert.equal(up.maxHp, 100 + 30 + 30);
  assert.ok(Math.abs(up.might - 1.2) < 1e-9);
  assert.equal(up.revives, 1);
  assert.equal(B.playerStats('wanderer', {}, {}, true).maxHp, 150);
  assert.ok(B.xpToNext(10) > B.xpToNext(1));
  for (const id of D.CHARACTER_IDS) assert.equal(B.newBuild(id).weapons[D.CHARACTERS[id].weapon], 1);
});

test('meta: buying upgrades and heroes costs coins, maxes out, refunds in full', () => {
  const m = { ...Meta.META_DEFAULTS, coins: 1000, shop: {}, heroes: ['wanderer'] };
  assert.equal(Meta.shopCost('might', 0), 60);
  assert.ok(Meta.buyUpgrade(m, 'might'));
  assert.ok(Meta.buyUpgrade(m, 'might'));
  assert.equal(m.coins, 1000 - 60 - 120);
  assert.equal(m.shop.might, 2);
  assert.ok(!Meta.buyUpgrade({ ...m, coins: 0 }, 'might'));
  m.shop.revival = 1;
  assert.equal(Meta.shopCost('revival', 1), null);
  assert.ok(!Meta.buyUpgrade(m, 'revival'));
  delete m.shop.revival;
  assert.ok(Meta.unlockHero(m, 'ranger'));
  assert.ok(!Meta.unlockHero(m, 'ranger'), 'only once');
  assert.ok(!Meta.unlockHero({ ...m, coins: 10 }, 'brute'));
  assert.deepEqual(m.heroes, ['wanderer', 'ranger']);
  const before = m.coins;
  assert.equal(Meta.refundShop(m), 180);
  assert.equal(m.coins, before + 180);
  Meta.recordRun(m, { time: 123.7, kills: 40, coins: 12, won: false });
  assert.equal(m.bestTime, 123);
  assert.equal(m.runs, 1);
});

test('daily: same seed gives the same hero and run, score ranks time then kills', () => {
  const a = Meta.dailyConfig(12345); const b = Meta.dailyConfig(12345);
  assert.deepEqual(a, b);
  assert.ok(D.CHARACTERS[a.hero]);
  const heroes = new Set();
  for (let s = 1; s < 200; s++) heroes.add(Meta.dailyConfig(s * 7919).hero);
  assert.equal(heroes.size, D.CHARACTER_IDS.length, 'every hero comes up');
  assert.ok(Meta.dailyScore(301, 0) > Meta.dailyScore(300, 9));
  assert.equal(Meta.dailyScore(2000, 5), 9005);
  // the same seed gives the same offers
  const o1 = B.rollOffers(B.newBuild(a.hero), makeRng(a.seed)); const o2 = B.rollOffers(B.newBuild(a.hero), makeRng(a.seed));
  assert.deepEqual(o1, o2);
});

test('the grid finds neighbours and nothing far away', () => {
  const g = new Grid(2560, 2560, 32, 16);
  g.insert(0, 100, 100); g.insert(1, 120, 110); g.insert(2, 900, 900); g.insert(3, 2559, 2559);
  const seen = [];
  g.query(105, 105, 30, (i) => { seen.push(i); });
  assert.deepEqual(seen.sort(), [0, 1]);
  const edge = []; g.query(2550, 2550, 20, (i) => { edge.push(i); });
  assert.deepEqual(edge, [3]);
  g.clear(); const none = []; g.query(105, 105, 30, (i) => none.push(i)); assert.equal(none.length, 0);
});

test('every art frame the game names is in the atlas', async () => {
  const { readFileSync } = await import('node:fs');
  const atlas = JSON.parse(readFileSync(new URL('atlas/survivors.json', base), 'utf8'));
  const icons = [...Object.values(D.WEAPONS), ...Object.values(D.PASSIVES), ...Object.values(D.EVOLUTIONS), ...Object.values(D.SHOP)].map((x) => x.icon);
  for (const ic of icons) assert.ok(atlas[ic], ic);
  for (const t of Object.keys(D.ENEMIES)) for (let f = 0; f < 4; f++) assert.ok(atlas[`e_${t}_${f}`], t);
  for (const h of D.CHARACTER_IDS) assert.ok(atlas[`h_${h}_0`] && atlas[`h_${h}_dead`], h);
  for (const b of D.BOSSES) assert.ok(D.ENEMIES[b.type]);
});
