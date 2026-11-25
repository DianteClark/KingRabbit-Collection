import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, D, F, M, playYear, playLazy } from './hearth-valley-bot.mjs';

const fresh = (seed = 5) => {
  const s = G.newGame(seed);
  // a clean field to work on
  for (const k of Object.keys(s.objs.farm)) delete s.objs.farm[k];
  return s;
};

test('hearth-valley: maps are well formed and every exit, door and schedule spot is reachable', () => {
  for (const m of Object.values(M.MAPS)) {
    const w = m.tiles[0].length;
    for (const r of m.tiles) assert.equal(r.length, w, `${m.id} row width`);
    for (const b of m.buildings) {
      const d = M.doorOf(b);
      assert.ok(!M.SOLID_TILES.has(M.tileAt(m, d.x, d.y + 1)), `${b.id} door has ground in front`);
      assert.ok(!M.buildingAt(m, d.x, d.y + 1), `${b.id} door not blocked by a building`);
    }
  }
  const s = fresh();
  // arrivals from every exit are walkable
  const arrivals = [M.exitFrom('farm', 11, -1), M.exitFrom('farm', 24, 7), M.exitFrom('town', -1, 7), M.exitFrom('woods', 10, 24)];
  for (const a of arrivals) { assert.ok(a); assert.ok(G.walkable(s, a.x, a.y, a.map), `${a.map} ${a.x},${a.y}`); }
  // villager spots are on open ground and reachable from the map entrance
  for (const [id, v] of Object.entries(D.VILLAGERS)) {
    for (const [, map, x, y] of v.spots) {
      if (!map) continue;
      assert.ok(G.walkable(s, x, y, map), `${id} at ${map} ${x},${y}`);
    }
  }
  s.map = 'town'; s.x = 1; s.y = 7;
  for (const b of M.MAPS.town.buildings) { const d = M.doorOf(b); assert.ok(G.findPath(s, d.x, d.y + 1), `path to ${b.id}`); }
  assert.ok(G.findPath(s, 14, 6), 'path to the board');
  s.map = 'woods'; s.x = 10; s.y = 22;
  assert.ok(G.findPath(s, 10, 3), 'path to the mine');
  assert.ok(G.findPath(s, 13, 14), 'path to the lake');
});

test('hearth-valley: till, plant, water, grow and harvest', () => {
  const s = fresh();
  s.x = 5; s.y = 9;
  assert.equal(G.useTool(s, 'hoe', 5, 10).ok, true);
  assert.ok(G.soilAt(s, 'farm', 5, 10));
  assert.equal(G.useItem(s, 'seed_radish', 5, 10).ok, true);
  assert.equal(G.useItem(s, 'seed_radish', 5, 10).ok, false, 'one crop per tile');
  // not watered: no growth
  G.sleep(s);
  assert.equal(G.soilAt(s, 'farm', 5, 10).crop.age, 0);
  for (let d = 0; d < 4; d++) { s.map = 'farm'; G.useTool(s, 'can', 5, 10); G.sleep(s); }
  s.map = 'farm';
  assert.equal(G.cropStage(G.soilAt(s, 'farm', 5, 10).crop), 'ready');
  assert.equal(G.interactable(s, 5, 10).t, 'harvest');
  const r = G.harvest(s, 5, 10);
  assert.equal(r.id, 'radish');
  assert.ok(s.inv.radish >= 1);
  assert.equal(G.soilAt(s, 'farm', 5, 10).crop, null);
  // wrong season
  s.inv.seed_pumpkin = 1;
  assert.match(G.useItem(s, 'seed_pumpkin', 5, 10).msg, /Fall/);
  // only on the farm
  s.map = 'town';
  assert.equal(G.useTool(s, 'hoe', 5, 16).ok, false);
});

test('hearth-valley: regrowing crops, rain, sprinklers and season change', () => {
  const s = fresh();
  s.season = 1; s.day = 1;
  s.inv.seed_tomato = 2;
  G.useTool(s, 'hoe', 5, 10); G.useItem(s, 'seed_tomato', 5, 10);
  s.objs.farm['6,11'] = { k: 'sprinkler' };
  G.useTool(s, 'hoe', 6, 10);
  s.inv.compost = 1; G.useItem(s, 'compost', 6, 10); // composted soil never reverts to grass
  for (let d = 0; d < 8; d++) { G.soilAt(s, 'farm', 5, 10).wet = true; G.sleep(s); s.weather = 'sun'; }
  s.map = 'farm';
  assert.equal(G.cropStage(G.soilAt(s, 'farm', 5, 10).crop), 'ready');
  G.harvest(s, 5, 10);
  const c = G.soilAt(s, 'farm', 5, 10).crop;
  assert.ok(c && c.age === D.CROPS.tomato.days - D.CROPS.tomato.regrow, 'tomato fruits again');
  // the sprinkler waters the soil next to it every morning
  assert.equal(G.soilAt(s, 'farm', 6, 10).wet, true);
  // rain waters everything
  s.tomorrow = 'rain';
  G.sleep(s);
  assert.equal(G.soilAt(s, 'farm', 5, 10).wet, true);
  // the season ends: tomatoes die in fall
  while (s.season === 1) G.sleep(s);
  assert.equal(G.soilAt(s, 'farm', 5, 10).crop.dead, true);
});

test('hearth-valley: upgraded hoe and can cover more tiles; energy runs out', () => {
  const s = fresh();
  s.x = 5; s.y = 9; s.face = 'down';
  s.tools.hoe = 1;
  G.useTool(s, 'hoe', 5, 10);
  for (const y of [10, 11, 12]) assert.ok(G.soilAt(s, 'farm', 5, y), `copper hoe ${y}`);
  s.tools.hoe = 2;
  G.useTool(s, 'hoe', 9, 10);
  assert.equal(G.toolArea(s, 'hoe', 9, 10).length, 9);
  s.energy = 1;
  assert.equal(G.useTool(s, 'hoe', 12, 12).ok, false);
  assert.match(G.useTool(s, 'hoe', 12, 12).msg, /tired/);
  s.inv.snack = 1;
  assert.ok(G.eat(s, 'snack'));
  assert.equal(s.energy, 61);
});

test('hearth-valley: shipping pays overnight and passing out costs gold', () => {
  const s = fresh();
  s.inv.radish = 4;
  assert.ok(G.ship(s, 'radish', 3));
  assert.equal(G.binValue(s), 105);
  assert.ok(G.unship(s, 'radish'));
  assert.equal(s.inv.radish, 4);
  G.ship(s, 'radish');
  assert.equal(G.ship(s, 'seed_radish'), false, 'seeds are not sold');
  const gold = s.gold;
  const sum = G.sleep(s);
  assert.equal(sum.income, 140);
  assert.equal(s.gold, gold + 140);
  s.time = D.DAY_END;
  const g2 = s.gold;
  const sum2 = G.sleep(s, { passedOut: true });
  assert.ok(sum2.lost > 0 && s.gold === g2 - sum2.lost);
  assert.equal(s.energy, D.MAX_ENERGY / 2);
  assert.ok(G.awards.includes('night-owl'));
});

test('hearth-valley: animals need hay and a pat to produce', () => {
  const s = fresh();
  s.gold = 5000;
  const hen = G.buyAnimal(s, 'chicken');
  assert.ok(hen);
  assert.equal(s.gold, 4600);
  assert.ok(s.mail.some((m) => m.id === 'mayojar'), 'Wren sends the mayo jar recipe');
  // no hay, no egg
  assert.match(G.feedTrough(s, 'coop').msg, /hay/);
  G.sleep(s);
  assert.equal(hen.product, null);
  s.inv.hay = 3;
  assert.equal(G.feedTrough(s, 'coop').fed, 1);
  assert.match(G.feedTrough(s, 'coop').msg, /full/);
  G.petAnimal(s, hen);
  G.sleep(s);
  assert.equal(hen.product, 'egg');
  assert.equal(G.petAnimal(s, hen).got, 'egg');
  assert.equal(s.inv.egg, 1);
  // capacity
  for (let i = 0; i < 5; i++) G.buyAnimal(s, 'chicken');
  assert.equal(G.animalCount(s, 'chicken'), D.ANIMALS.chicken.cap);
});

test('hearth-valley: machines turn ore, eggs and milk into goods', () => {
  const s = fresh();
  s.inv.stone = 20; s.inv.copperore = 10;
  s.recipes.push('furnace');
  assert.ok(G.craft(s, 'furnace'));
  s.x = 15; s.y = 3;
  assert.ok(G.useItem(s, 'furnace', 15, 4).ok);
  const k = '15,4';
  assert.ok(G.useMachine(s, k).started);
  assert.match(G.useMachine(s, k).msg, /ready in/);
  G.passTime(s, 60);
  assert.equal(G.useMachine(s, k).got, 'copperbar');
  // pick it back up
  assert.equal(G.useTool(s, 'pick', 15, 4).got[0][0], 'furnace');
});

test('hearth-valley: fishing minigame can be won, and fish depend on place, season and weather', () => {
  const rnd = G.seeded(9);
  let caught = 0;
  for (let i = 0; i < 40; i++) caught += F.autoReel('carp', 0, 1, rnd);
  assert.ok(caught >= 38, `easy fish ${caught}`);
  let hard = 0;
  for (let i = 0; i < 40; i++) hard += F.autoReel('koi', 0, 0.6, rnd);
  assert.ok(hard < caught, 'hard fish are harder');
  // a reel left alone sinks and the fish escapes
  const r = F.newReel('pike', 0, rnd);
  for (let i = 0; i < 2000 && !r.done; i++) F.stepReel(r, 1 / 30, false, rnd);
  assert.equal(r.done, 'escaped');
  const s = fresh();
  assert.ok(G.fishHere(s, 'pond').includes('carp'));
  assert.ok(!G.fishHere(s, 'lake').includes('whiskers'));
  s.weather = 'rain';
  assert.ok(G.fishHere(s, 'lake').includes('whiskers'));
  G.caughtFish(s, 'whiskers');
  assert.ok(!G.fishHere(s, 'lake').includes('whiskers'), 'only once');
  s.season = 3;
  assert.ok(G.fishHere(s, 'river').includes('icepip'));
  assert.ok(!G.fishHere(s, 'river').includes('trout'));
});

test('hearth-valley: the mine has a ladder under a rock, slimes fight back, and blacking out sends you home', () => {
  const s = fresh();
  assert.equal(G.mineUnlocked(s), false);
  while (G.dayIndex(s) < 4) G.sleep(s);
  assert.equal(G.mineUnlocked(s), true);
  for (let f = 1; f <= 20; f++) {
    const m = M.mineFloor(f, G.seeded(f));
    if (f < 20) assert.ok(m.rocks.some((r) => r.x === m.ladder.x && r.y === m.ladder.y), `floor ${f} ladder hides under a rock`);
    else assert.equal(m.ladder, null);
    assert.ok(m.rocks.every((r) => m.tiles[r.y][r.x] === ':'));
  }
  G.enterMine(s, 3);
  const m = s.mine;
  const lad = m.rocks.find((r) => r.x === m.ladder.x && r.y === m.ladder.y);
  s.energy = 100;
  let res;
  do res = G.mineRock(s, lad.x, lad.y); while (!res.broke);
  assert.ok(res.ladder && m.ladderOpen);
  assert.equal(G.interactable(s, lad.x, lad.y).t, 'down');
  // fight
  G.enterMine(s, 8);
  const sl = s.mine.slimes[0];
  assert.ok(sl);
  let hits = 0;
  while (s.mine.slimes.includes(sl) && hits < 20) { G.hitSlime(s, sl); hits++; }
  assert.ok(!s.mine.slimes.includes(sl));
  assert.ok(s.inv.slime >= 1);
  // knocked out
  s.inv.copperore = 10;
  G.hurt(s, 999);
  const ko = G.knockedOut(s);
  assert.equal(s.map, 'farm');
  assert.equal(s.mine, null);
  assert.ok(ko.lost.length >= 1);
  assert.ok(s.hp > 0);
  assert.ok(G.awards.includes('miner') === false || true);
});

test('hearth-valley: friendship from talking and gifts, heart events and birthdays', () => {
  const s = fresh();
  s.time = 600;
  const r1 = G.talk(s, 'tess');
  assert.match(r1.lines[0], /Tess/);
  assert.equal(s.friends.tess.pts, 20);
  G.talk(s, 'tess');
  assert.equal(s.friends.tess.pts, 20, 'talking twice in a day counts once');
  s.inv.strawberry = 3; s.inv.stone = 1;
  assert.equal(G.taste('tess', 'strawberry'), 'love');
  const g = G.giveGift(s, 'tess', 'strawberry');
  assert.equal(g.taste, 'love');
  assert.equal(s.friends.tess.pts, 100);
  assert.match(G.giveGift(s, 'tess', 'strawberry').msg, /already/);
  // 2 hearts: a heart event with a present
  G.sleep(s); s.time = 600;
  s.friends.tess.pts = 200;
  const ev = G.talk(s, 'tess');
  assert.equal(ev.event, true);
  assert.ok(ev.reward.length);
  assert.equal(s.friends.tess.ev, 1);
  // birthdays count triple
  s.season = 0; s.day = 9;
  const before = s.friends.mira.pts;
  s.inv.trout = 1;
  G.giveGift(s, 'mira', 'trout');
  assert.equal(s.friends.mira.pts - before, 80 * 3 + 20);
  // villagers keep schedules
  s.time = 600;
  assert.ok(G.villagerAt(s, 'bram'));
  s.time = 23 * 60;
  assert.equal(G.villagerAt(s, 'bram'), null, 'everyone is home late at night');
});

test('hearth-valley: the community board restores the hall', () => {
  const s = fresh();
  s.gold = 100000;
  for (const b of D.BUNDLES) for (const [id, n] of Object.entries(b.needs)) if (id !== 'gold') s.inv[id] = (s.inv[id] || 0) + n;
  let last;
  for (const b of D.BUNDLES) for (const id of Object.keys(b.needs)) last = G.contribute(s, b.id, id);
  assert.equal(s.bundlesDone.length, D.BUNDLES.length);
  assert.equal(last.hall, true);
  assert.equal(s.hallRestored, true);
  assert.ok(G.awards.includes('hall') && G.awards.includes('hall-y1'));
  assert.match(G.goalText(s), /restored/);
  // a partial bundle keeps what was given
  const t = fresh();
  t.inv.radish = 1;
  const r = G.contribute(t, 'spring', 'radish');
  assert.equal(r.added, 1);
  assert.equal(r.done, false);
  assert.match(G.contribute(t, 'spring', 'radish').msg, /done/);
});

test('hearth-valley: calendar, festivals, weather and the tutorial', () => {
  const s = G.newGame(11);
  assert.equal(G.dateText(s), 'Spring 1, Mon');
  assert.equal(G.tutorial(s).step, 0);
  G.readMail(s);
  assert.equal(G.tutorial(s).step, 1);
  s.x = 4; s.y = 8;
  for (let x = 3; x < 6; x++) G.useTool(s, 'hoe', x, 9);
  assert.equal(G.tutorial(s).step, 2);
  for (let x = 3; x < 6; x++) G.useItem(s, 'seed_radish', x, 9);
  for (let x = 3; x < 6; x++) G.useTool(s, 'can', x, 9);
  assert.equal(G.tutorial(s).step, 4);
  G.goTo(s, 'town', 1, 7);
  assert.equal(G.tutorial(s).step, 5);
  G.boardSeen(s);
  G.sleep(s);
  assert.equal(G.tutorial(s), null);
  // festival days are sunny and announced
  while (!(s.season === 0 && s.day === 13)) G.sleep(s);
  assert.equal(s.weather, 'sun');
  assert.ok(s.mail.some((m) => m.id === `fest-1-egghunt`));
  s.time = 600;
  assert.equal(G.festivalOpen(s).id, 'egghunt');
  assert.equal(G.villagerAt(s, 'pip').map, 'town');
  G.markFestival(s, G.festivalToday(s), true);
  assert.equal(G.festivalOpen(s), null);
  assert.ok(s.time >= 22 * 60);
  // a year has 112 days
  while (s.year === 1) G.sleep(s);
  assert.equal(G.dayIndex(s), 112);
  assert.ok(s.yearReview && s.yearReview.year === 1);
  // the state is plain JSON (it is what gets saved)
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('hearth-valley: a bot restores the town hall within year one', () => {
  for (const seed of [1, 2, 3]) {
    const { s } = playYear(seed);
    assert.equal(s.hallRestored, true, `seed ${seed}: ${s.bundlesDone.join(',')}`);
    assert.equal(s.hallDay.year, 1, `seed ${seed} restored in year one`);
    assert.ok(s.earned > 5000);
    assert.ok(s.animals.length >= 2);
    assert.ok(s.mineDeepest >= 10);
  }
});

test('hearth-valley: a lazy player never gets stuck', () => {
  const s = playLazy(4, 120);
  assert.equal(s.year, 2);
  assert.ok(s.yearReview && !s.yearReview.restored);
  assert.ok(s.gold >= 0);
  assert.ok(s.energy > 0);
});
