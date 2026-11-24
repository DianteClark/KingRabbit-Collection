import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, D, B, combos, playGood, playBad, playLazy } from './alchemist-bots.mjs';

const T = await import('../games/alchemist/logic/tune.js');

test('alchemist: mixing rules (pure, pair, sludge, legendary)', () => {
  assert.equal(B.mix(['rose', 'rose']).potion, 'life');
  assert.equal(B.mix(['mint', 'mint']).potion, 'air');
  assert.equal(B.mix(['pepper', 'bluebell']).potion, 'steam');
  assert.equal(B.mix(['sunwater', 'sunwater']).potion, 'steam');
  assert.equal(B.mix(['marigold', 'marigold']).potion, 'vigor');
  assert.equal(B.mix(['wheat', 'rose']).potion, 'growth');
  assert.equal(B.mix(['bluebell', 'marigold']).potion, 'water', 'twice as strong = pure');
  assert.equal(B.mix(['rose', 'mint', 'bluebell']).potion, 'sludge', '2nd and 3rd tied = sludge');
  assert.equal(B.mix(['plume', 'heart']).potion, 'phoenix');
  assert.equal(B.mix(['plume', 'heart', 'rose']).potion, 'phoenix');
  assert.equal(B.mix(['heart', 'moonsilver', 'plume']).potion, 'philosopher');
  assert.equal(B.mix(['rose']).potion, null);
  assert.equal(B.mix(['rose', 'rose', 'rose', 'rose']).potion, null);
  assert.ok(B.mix(['cinnabar', 'cinnabar', 'ember']).potent);
  assert.ok(!B.mix(['rose', 'rose', 'rose']).potent);
});

test('alchemist: every everyday potion can be made from the garden and market alone', () => {
  const inv = {};
  for (const [id, ing] of Object.entries(D.INGREDIENTS)) if (ing.area === 'garden' || ing.area === 'market') inv[id] = 3;
  const made = new Set(combos(inv).map((c) => B.mix(c).potion));
  for (const [id, p] of Object.entries(D.POTIONS)) {
    if (p.legendary || id === 'sludge') continue;
    assert.ok(made.has(id), `${id} not reachable`);
  }
  // and every recipe in the book exists
  for (const id of D.RECIPE_ORDER) assert.ok(D.POTIONS[id], id);
});

test('alchemist: stirring gives 1-3 stars and potent brews get a bonus', () => {
  assert.equal(B.needleAt(0, 1), 0);
  assert.equal(B.needleAt(1, 1), 1);
  assert.equal(B.needleAt(1.5, 1), 0.5);
  const z = B.stirZone(0, 1);
  assert.equal(B.stirHit(z.centre, z), 2);
  assert.equal(B.stirHit(z.centre + z.good * 0.9, z), 1);
  assert.equal(B.stirHit(z.centre + z.good * 1.1, z), 0);
  assert.equal(B.starsFor(0), 1);
  assert.equal(B.starsFor(3), 2);
  assert.equal(B.starsFor(6), 3);
  assert.equal(B.starsFor(0, true), 2);
  assert.equal(B.starsFor(6, true), 3);
  // upgraded cauldrons widen the zone
  assert.ok(B.stirZone(0, 1.65).good > z.good);
});

test('alchemist: gathering uses picks, empties spots and respects guards', () => {
  const s = G.newGame(3);
  assert.equal(s.stamina, 6);
  assert.equal(G.gather(s, 'g4').ok, true);
  assert.equal(G.gather(s, 'g4').ok, true);
  assert.equal(G.gather(s, 'g4').why, 'empty');
  assert.equal(s.inv.wheat, 2);
  assert.equal(G.gather(s, 'f1').why, 'locked');
  s.coins = 100; s.day = 2;
  assert.equal(G.unlockArea(s, 'forest').ok, true);
  assert.equal(G.gather(s, 'f6').why, 'guarded');
  assert.equal(G.shoo(s, 'f6').fled, false);
  assert.equal(G.shoo(s, 'f6').fled, true);
  assert.equal(G.gather(s, 'f6').ok, true);
  assert.equal(s.inv.plume, 1);
  assert.equal(s.stamina, 1);
  assert.equal(G.gather(s, 'g1').ok, true);
  assert.equal(G.gather(s, 'g1').why, 'tired');
  // the cave needs reputation
  s.coins = 500;
  assert.equal(G.unlockArea(s, 'cave').ok, false);
  s.rep = 20;
  assert.equal(G.unlockArea(s, 'cave').ok, true);
});

test('alchemist: market and upgrades cost coins and never go below zero', () => {
  const s = G.newGame(4);
  s.coins = 5;
  assert.equal(G.buy(s, 'pepper').why, 'coins');
  assert.equal(G.buy(s, 'sunwater').ok, true);
  assert.equal(s.coins, 0);
  assert.equal(G.buyUpgrade(s, 'basket').ok, false);
  s.coins = 100;
  for (let i = 0; i < 4; i++) G.buy(s, 'pepper');
  assert.equal(G.buy(s, 'pepper').why, 'sold out');
  assert.equal(G.buyUpgrade(s, 'basket').ok, true);
  assert.equal(s.stamina, 8, 'a bigger basket helps the same morning');
  assert.equal(G.buyUpgrade(s, 'apprentice').why, 'From day 5');
});

test('alchemist: brewing uses ingredients, fills the shelf and records the recipe', () => {
  const s = G.newGame(5);
  assert.equal(G.canBrew(s, ['rose']).ok, false);
  const r = G.brew(s, ['rose', 'rose'], 6);
  assert.equal(r.potion, 'life');
  assert.equal(r.stars, 3);
  assert.equal(r.n, 2);
  assert.ok(r.isNew);
  assert.ok(!s.inv.rose);
  assert.equal(s.shelf['life|3'], 2);
  assert.equal(G.canBrew(s, ['rose', 'rose']).ok, false);
  assert.equal(G.brew(s, ['mint', 'mint'], 0).isNew, true);
  assert.equal(G.preview(s, ['mint', 'mint']).known, true);
  // a full shelf refuses more brews
  s.inv.rose = 40;
  while (G.canBrew(s, ['rose', 'rose']).ok) G.brew(s, ['rose', 'rose'], 6);
  assert.equal(G.shelfCount(s), G.shelfCap(s));
  assert.match(G.canBrew(s, ['rose', 'rose']).why, /shelves are full/);
  assert.ok(G.pourOut(s, 'life|3'));
  assert.equal(G.shelfCount(s), G.shelfCap(s) - 1);
});

test('alchemist: selling, haggling and overcharging', () => {
  const s = G.newGame(6);
  G.brew(s, ['rose', 'rose'], 6);
  G.brew(s, ['mint', 'mint'], 3);
  assert.ok(G.openShop(s));
  assert.equal(s.queue.length, 2);
  const mira = G.current(s);
  assert.equal(mira.name, 'Mira');
  // wrong potion: she declines and stays
  assert.equal(G.offer(s, 'air|2', 5).outcome, 'wrong');
  assert.equal(G.current(s), mira);
  // way too expensive: counter-offer
  const fair = G.fairPrice('life', 3);
  const c = G.offer(s, 'life|3', fair * 4);
  assert.equal(c.outcome, 'counter');
  assert.ok(c.counter > fair && c.counter < fair * 4);
  const coins = s.coins; const rep = s.rep;
  const sold = G.acceptCounter(s);
  assert.equal(sold.outcome, 'sold');
  assert.equal(s.coins, coins + c.counter + 5, 'price plus her story gift');
  assert.ok(s.rep > rep);
  assert.equal(s.storyLog[1], true);
  // second customer: insisting on a silly price makes them storm out
  const kid = G.current(s);
  assert.deepEqual(kid.req, { potion: 'air', stars: 1 });
  assert.equal(G.offer(s, 'air|2', 200).outcome, 'counter');
  const before = s.rep;
  assert.equal(G.insist(s).outcome, 'left');
  assert.equal(s.rep, Math.max(0, before - 3));
  assert.ok(G.shopDone(s));
  const report = G.closeShop(s);
  assert.equal(report.sold, 1);
  assert.equal(report.rent, 6);
  assert.equal(s.phase, 'night');
  assert.ok(G.sleep(s));
  assert.equal(s.day, 2);
});

test('alchemist: a fair price makes customers happier than a steep one', () => {
  const run = (mult) => {
    const s = G.newGame(7);
    G.brew(s, ['rose', 'rose'], 3);
    G.openShop(s);
    const rep = s.rep;
    const r = G.offer(s, 'life|2', Math.round(G.fairPrice('life', 2) * mult));
    if (r.outcome === 'counter') G.insist(s);
    return s.rep - rep;
  };
  assert.ok(run(1) > run(1.3));
  assert.ok(run(1.3) >= run(3));
  assert.ok(run(3) < 0);
});

test('alchemist: a saved game survives JSON mid-shop and keeps going', () => {
  const s = G.newGame(8);
  G.brew(s, ['rose', 'rose'], 6);
  G.openShop(s);
  const copy = G.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(G.current(copy).name, 'Mira');
  assert.equal(G.offer(copy, 'life|3', 10).outcome, 'sold');
  assert.equal(G.migrate(null), null);
  assert.equal(G.migrate({ junk: 1 }), null);
});

test('alchemist: customers adapt to skill (pickier and thriftier when you do well)', () => {
  const easy = T.customerTune(0); const hard = T.customerTune(1);
  assert.ok(hard.tol < easy.tol);
  assert.ok(hard.starsChance > easy.starsChance);
  assert.ok(hard.rival > easy.rival);
  const s0 = G.newGame(9); s0.skill = 0; const s1 = G.newGame(9); s1.skill = 1;
  assert.ok(G.rivalScores(s1).reduce((a, b) => a + b) > G.rivalScores(s0).reduce((a, b) => a + b));
});

test('alchemist: requests stay gentle early and legendary ones only come late', () => {
  for (const seed of [1, 2, 3]) {
    const s = G.newGame(seed);
    s.rep = 0;
    for (let d = 2; d <= 17; d++) {
      s.day = d; s.phase = 'prep'; s.today = { ...s.today, log: [] };
      G.openShop(s);
      for (const c of s.queue) {
        if (c.talk) continue;
        if (c.req.potion) assert.ok(!D.POTIONS[c.req.potion].legendary, `day ${d}`);
        if (d <= 3 && c.req.potion && !c.story) assert.ok(D.REQUEST_TIERS[0].potions.includes(c.req.potion), `day ${d} ${c.req.potion}`);
        if (d <= 3) assert.equal(c.req.stars, 1);
      }
      s.phase = 'prep';
    }
  }
});

test('alchemist: the festival scores match, stars and value; Vex sets the bar', () => {
  assert.equal(G.festivalScore(0, 'fire', 3).score, 10 + 15 + 3);
  assert.equal(G.festivalScore(0, 'life', 3).match, false);
  assert.equal(G.festivalScore(1, 'life', 2).score, 10 + 10 + 2);
  assert.equal(G.festivalScore(2, 'philosopher', 3).score, 10 + 15 + 30);
  const s = G.newGame(10);
  s.day = 30;
  s.shelf = { 'forge|3': 1, 'life|3': 1, 'phoenix|3': 1 };
  assert.equal(G.openShop(s), false, 'no shop on festival day');
  assert.ok(G.startFestival(s));
  G.enterFestival(s, 'forge|3');
  G.enterFestival(s, 'life|3');
  const last = G.enterFestival(s, 'phoenix|3');
  assert.ok(last.done);
  assert.equal(s.result.kind, 'win');
  assert.equal(s.phase, 'over');
  assert.ok(G.goEndless(s));
  assert.equal(s.day, 31);
  assert.equal(s.mode, 'endless');
  assert.equal(s.phase, 'prep');
  assert.ok(G.openShop(s));
});

test('alchemist: entering nothing at the festival loses to Vex', () => {
  const s = G.newGame(11);
  s.day = 30;
  G.startFestival(s);
  for (let i = 0; i < 3; i++) G.enterFestival(s, null);
  assert.equal(s.result.kind, 'second');
});

test('alchemist: three nights in debt closes the shop (with warnings first)', () => {
  const s = G.newGame(12);
  s.coins = 0;
  const nights = [];
  while (s.phase !== 'over' && s.day < 10) {
    G.openShop(s);
    while (!G.shopDone(s)) { const c = G.current(s); if (c.talk) G.goodbye(s); else G.sorry(s); }
    const r = G.closeShop(s);
    nights.push(r);
    if (s.phase === 'night') G.sleep(s);
  }
  assert.equal(nights.length, 3);
  assert.ok(nights[0].debt && !nights[0].closed);
  assert.ok(nights[2].closed);
  assert.equal(s.result.kind, 'broke');
});

test('alchemist: story beats run (gifts, the Dragon Heart, festival themes)', () => {
  const s = playGood(21, { skill: 0.5 });
  assert.equal(s.result.kind, 'win');
  for (const b of D.STORY) if (!b.talk) assert.ok(b.day in s.storyLog, `beat day ${b.day} happened`);
  const days = D.STORY.map((b) => b.day);
  assert.equal(new Set(days).size, days.length, 'one beat a day');
  assert.ok(days.every((d) => d < 30));
});

test('alchemist: a careful bot plays all 30 days and wins the festival', () => {
  for (const skill of [0, 0.5, 1]) {
    for (const seed of [1, 2, 3]) {
      const s = playGood(seed, { skill });
      assert.equal(s.result?.kind, 'win', `skill ${skill} seed ${seed}: ${JSON.stringify(s.result)}`);
      assert.equal(s.day, 30);
      assert.ok(s.areas.cave, 'reached the cave');
      assert.ok(Object.keys(s.known).length >= 12, 'found most recipes');
    }
  }
});

test('alchemist: a reckless bot goes broke before day 30', () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = playBad(seed);
    assert.equal(s.result?.kind, 'broke', `seed ${seed}`);
    assert.ok(s.day < 30);
  }
});

test('alchemist: a casual garden-only player survives a while but does not walk the festival', () => {
  let wins = 0; let longest = 0;
  for (const seed of [2, 3, 4, 5]) {
    const s = playLazy(seed);
    longest = Math.max(longest, s.day);
    if (s.result?.kind === 'win') wins++;
  }
  assert.ok(longest >= 20, 'not punished early');
  assert.ok(wins <= 1, 'preparation matters');
});
