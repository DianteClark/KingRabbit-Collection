import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/heroes-lite/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const C = await import(new URL(`${base}logic/combat.js`, import.meta.url).href);
const D = await import(new URL(`${base}logic/data.js`, import.meta.url).href);
const P = await import(new URL(`${base}logic/path.js`, import.meta.url).href);
const { SCENARIOS, scenarioById } = await import(new URL(`${base}logic/scenarios.js`, import.meta.url).href);
const A = await import(new URL(`${base}adaptive.js`, import.meta.url).href);

const hero0 = { name: 'H', atk: 0, def: 0, pow: 1, know: 1, mana: 0, spells: [], skills: {} };

// ---------- Scenarios ----------

test('scenarios: maps are rectangular, use known letters and keep town footprints clear', () => {
  for (const s of SCENARIOS) {
    const w = s.map[0].length;
    assert.ok(s.map.every((r) => r.length === w), `${s.id} rows differ in width`);
    const st = G.newGame(s, { seed: 3 });
    for (const o of st.objects) {
      for (const [x, y] of G.footprint(o)) {
        assert.ok(G.inMap(st, x, y), `${s.id}: ${o.kind} at ${o.x},${o.y} sticks out of the map`);
        assert.ok(!'TM~'.includes(st.terrain[y][x]), `${s.id}: ${o.kind} at ${o.x},${o.y} overlaps terrain`);
      }
    }
    assert.ok(G.townsOf(st, 0).length >= 1, `${s.id}: player has a town`);
    assert.equal(G.heroesOf(st, 0).length, 1, `${s.id}: player starts with one hero`);
    if (s.endless) assert.ok(st.endless.spawns.length >= 4);
    else assert.ok(st.objects.some((o) => o.kind === 'town' && o.owner === 1), `${s.id}: enemy has a town`);
  }
});

test('scenarios: every object can be reached from the start (monsters aside)', () => {
  for (const s of SCENARIOS) {
    const st = G.newGame(s, { seed: 1 });
    const h = G.heroesOf(st, 0)[0];
    st.players[0].explored.fill(1);
    st.objects = st.objects.filter((o) => o.kind !== 'monster');
    const res = P.dijkstra(G.heroGrid(st, h), h.x, h.y);
    for (const o of st.objects) {
      assert.ok(Number.isFinite(res.dist[G.idx(st, o.x, o.y)]), `${s.id}: ${o.kind} at ${o.x},${o.y} unreachable`);
    }
  }
});

test('scenarios: the same seed builds the same game', () => {
  const a = G.newGame(scenarioById('desert'), { seed: 42 });
  const b = G.newGame(scenarioById('desert'), { seed: 42 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ---------- Path finding ----------

function openState(w = 8, h = 6) {
  const scn = { id: 't', name: 't', biome: 'grass', players: [{ faction: 'castle' }, { faction: 'enemy' }], map: Array.from({ length: h }, () => '.'.repeat(w)) };
  const st = G.newGame(scn, { seed: 1 });
  const hero = G.createHero(st, 0, 1, 1);
  st.players[0].explored.fill(1);
  return { st, hero };
}

test('path: straight steps cost 10, diagonals 14, and the route avoids blocked tiles', () => {
  const { st, hero } = openState();
  let p = G.findPath(st, hero, 4, 1);
  assert.equal(p.length, 3);
  assert.equal(p.at(-1).cost, 30);
  p = G.findPath(st, hero, 3, 3);
  assert.equal(p.at(-1).cost, 28);
  st.terrain = ['..T.....', '..T.....', '..T.....', '........', '........', '........'];
  p = G.findPath(st, hero, 3, 1);
  assert.ok(p.every((t) => st.terrain[t.y][t.x] !== 'T'));
  assert.ok(p.at(-1).cost > 20);
});

test('path: pickups are destinations, not stepping stones; monsters ambush neighbours', () => {
  const { st, hero } = openState();
  st.terrain = ['TTTTTTTT', '........', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT'];
  st.objects.push({ id: 900, kind: 'pile', res: 'gold', amount: 500, x: 3, y: 1 });
  assert.ok(G.findPath(st, hero, 3, 1));
  assert.equal(G.findPath(st, hero, 5, 1), null, 'cannot walk through the pile');
  st.objects = [{ id: 901, kind: 'monster', type: 'goblin', count: 5, x: 5, y: 1 }];
  const p = G.findPath(st, hero, 5, 1);
  assert.ok(p, 'can attack the monster');
  const plan = G.planMove(st, hero, p);
  assert.equal(plan.trigger.type, 'monster');
  assert.equal(plan.trigger.ambush, false, 'walking up on purpose is an attack, not an ambush');
  assert.equal(plan.steps.at(-1).x, 4);
  assert.equal(G.findPath(st, hero, 7, 1), null, 'cannot slip past the monster');
});

test('path: movement points limit how far a hero walks today', () => {
  const { st, hero } = openState(20, 3);
  hero.mp = 35;
  const plan = G.planMove(st, hero, G.findPath(st, hero, 10, 1));
  assert.equal(plan.steps.length, 3);
  G.applySteps(st, hero, plan.steps);
  assert.equal(hero.x, 4);
  assert.equal(hero.mp, 5);
});

// ---------- Economy and towns ----------

test('towns: build once per day, needs prerequisites and resources', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 5 });
  const t = G.townsOf(st, 0)[0];
  assert.equal(G.buildStatus(st, t, 'dw3').reason, 'Needs');
  assert.ok(G.build(st, t, 'dw1'));
  assert.equal(st.players[0].res.gold, 6500);
  assert.equal(G.buildStatus(st, t, 'dw2').reason, 'Built today');
  G.newDay(st);
  assert.ok(G.build(st, t, 'dw2'));
  st.players[0].res.gold = 0;
  G.newDay(st);
  assert.equal(G.buildStatus(st, t, 'hall2').reason, 'Cost');
});

test('towns: income, weekly growth with Citadel, recruiting and hiring', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 5 });
  const t = G.townsOf(st, 0)[0];
  const p = st.players[0];
  const g0 = p.res.gold;
  G.newDay(st);
  assert.equal(p.res.gold, g0 + 500);
  const h = G.heroesOf(st, 0)[0];
  assert.equal(G.visitingHero(st, t), h);
  const pikes = h.army.find((s) => s?.type === 'pikeman').count;
  assert.equal(G.recruit(st, t, 0, 5), 5);
  assert.equal(h.army.find((s) => s?.type === 'pikeman').count, pikes + 5);
  assert.equal(t.stock[0], 12 - 5);
  t.built.fort = true;
  while (st.day % 7 !== 0) G.newDay(st);
  G.newDay(st); // day 8: new week
  assert.equal(t.stock[0], 7 + 18);
  // Hiring needs an empty gate.
  assert.equal(G.canHire(st, t).ok, false);
  h.x += 1; h.y += 1;
  p.res.gold = 10000;
  const h2 = G.hireHero(st, t);
  assert.ok(h2);
  assert.equal(p.res.gold, 7500);
  assert.equal(G.heroesOf(st, 0).length, 2);
});

test('towns: moving stacks between hero and garrison, hero keeps one stack', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 5 });
  const t = G.townsOf(st, 0)[0];
  const h = G.visitingHero(st, t);
  h.army = [{ type: 'pikeman', count: 5 }, null, null, null, null];
  t.garrison = [{ type: 'pikeman', count: 3 }, { type: 'archer', count: 2 }, null, null, null];
  assert.equal(G.transfer(st, t, 'hero', 0), false);
  assert.ok(G.transfer(st, t, 'garrison', 0));
  assert.equal(h.army[0].count, 8);
  assert.ok(G.transfer(st, t, 'garrison', 1));
  assert.ok(G.transfer(st, t, 'hero', 0));
  assert.equal(t.garrison[0].count, 8);
});

test('market: buy and sell resources', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 5 });
  const t = G.townsOf(st, 0)[0];
  assert.equal(G.trade(st, 0, 'wood', 1), false);
  t.built.market = true;
  const g = st.players[0].res.gold;
  assert.ok(G.trade(st, 0, 'ore', 2));
  assert.equal(st.players[0].res.gold, g - 600);
  assert.ok(G.trade(st, 0, 'gems', -1));
  assert.equal(st.players[0].res.gold, g - 600 + 250);
});

test('visiting: piles, mines, chests and boosts', () => {
  const { st, hero } = openState();
  const p = st.players[0];
  const gold = p.res.gold;
  st.objects.push({ id: 801, kind: 'pile', res: 'gold', amount: 700, x: 2, y: 1 });
  G.visit(st, hero, G.getObj(st, 801));
  assert.equal(p.res.gold, gold + 700);
  assert.equal(G.getObj(st, 801), undefined);
  const mine = { id: 802, kind: 'mine', res: 'ore', owner: null, x: 3, y: 1 };
  st.objects.push(mine);
  G.visit(st, hero, mine);
  assert.equal(mine.owner, 0);
  assert.equal(G.dailyIncome(st, 0).ore, 2);
  const boost = { id: 803, kind: 'boost', boost: 'ruby', visited: [], x: 4, y: 1 };
  st.objects.push(boost);
  const atk = hero.atk;
  G.visit(st, hero, boost); G.visit(st, hero, boost);
  assert.equal(hero.atk, atk + 1, 'a hero can use a shrine once');
  const chest = { id: 804, kind: 'chest', gold: 1500, x: 5, y: 1 };
  st.objects.push(chest);
  assert.equal(G.visit(st, hero, chest).choice.kind, 'chest');
  G.takeChest(st, hero, chest, 'exp');
  assert.equal(hero.exp, 1000);
  assert.equal(hero.level, 2);
  assert.equal(hero.pendingLevels, 1);
});

// ---------- Levels ----------

test('levels: offers survive a save/load and give a stat plus a skill', () => {
  const { st, hero } = openState();
  G.gainExp(st, hero, D.expForLevel(3));
  assert.equal(hero.level, 3);
  assert.equal(hero.pendingLevels, 2);
  const offer = JSON.stringify(hero.levelUp);
  const copy = G.deserialize(G.serialize(st));
  assert.equal(JSON.stringify(copy.heroes.find((h) => h.id === hero.id).levelUp), offer);
  const stat = hero.levelUp.stat; const before = hero[stat];
  const skill = hero.levelUp.skills[1];
  const lv = hero.skills[skill] || 0;
  G.applyLevelUp(st, hero, 1);
  assert.equal(hero[stat], before + 1);
  assert.equal(hero.skills[skill], lv + 1);
  assert.equal(hero.pendingLevels, 1);
  G.autoLevelUps(st, hero);
  assert.equal(hero.pendingLevels, 0);
  assert.ok(D.expForLevel(2) < D.expForLevel(3) && D.expForLevel(10) > 10000);
});

// ---------- Combat ----------

function battle(a, b, opts = {}) {
  return C.createBattle({ hero: opts.h0 ?? null, army: a }, { hero: opts.h1 ?? null, army: b }, { seed: opts.seed ?? 7, obstacles: false, ...opts });
}

test('combat: stacks deploy on their own sides and act fastest first', () => {
  const b = battle([{ type: 'pikeman', count: 10 }, { type: 'griffin', count: 2 }], [{ type: 'wolfrider', count: 5 }]);
  assert.ok(b.stacks.filter((s) => s.side === 0).every((s) => s.x === 0));
  assert.ok(b.stacks.filter((s) => s.side === 1).every((s) => s.x === C.GRID_W - 1));
  const order = [b.activeId, ...b.queue].map((id) => C.getStack(b, id).type);
  assert.deepEqual(order, ['griffin', 'wolfrider', 'pikeman']);
});

test('combat: attack bonus, retaliation once per round, griffins twice, vampires none', () => {
  const b = battle([{ type: 'swordsman', count: 10 }], [{ type: 'pikeman', count: 10 }]);
  const [s, t] = b.stacks;
  const hi = C.calcDamage(b, s, t, { avg: true });
  b.sides[0].hero = { ...hero0, atk: 10 };
  assert.ok(C.calcDamage(b, s, t, { avg: true }) > hi, 'hero attack raises damage');
  b.sides[0].hero = null;
  // Walk next to each other then attack.
  s.x = 2; t.x = 3; s.y = t.y = 3;
  b.activeId = s.id; b.queue = [t.id];
  const ev = C.act(b, { type: 'attack', target: t.id, x: 2, y: 3 });
  assert.deepEqual(ev.map((e) => e.type), ['attack', 'retaliate']);
  assert.equal(t.retals, 0);

  const b2 = battle([{ type: 'pikeman', count: 30 }, { type: 'pikeman', count: 30 }], [{ type: 'griffin', count: 8 }]);
  const [p1, p2, g] = b2.stacks;
  p1.x = 2; p2.x = 2; p1.y = 2; p2.y = 4; g.x = 3; g.y = 3;
  b2.activeId = p1.id; b2.queue = [p2.id, g.id];
  assert.ok(C.act(b2, { type: 'attack', target: g.id, x: 2, y: 2 }).some((e) => e.type === 'retaliate'));
  assert.equal(b2.activeId, p2.id);
  assert.ok(C.act(b2, { type: 'attack', target: g.id, x: 2, y: 4 }).some((e) => e.type === 'retaliate'), 'griffins strike back twice');

  const b3 = battle([{ type: 'vampire', count: 5 }], [{ type: 'pikeman', count: 10 }]);
  const [v, pk] = b3.stacks;
  v.x = 2; pk.x = 3; v.y = pk.y = 3;
  b3.activeId = v.id; b3.queue = [pk.id];
  const ev3 = C.act(b3, { type: 'attack', target: pk.id, x: 2, y: 3 });
  assert.ok(!ev3.some((e) => e.type === 'retaliate'));
});

test('combat: shooters fire unless an enemy stands next to them', () => {
  const b = battle([{ type: 'archer', count: 10 }], [{ type: 'pikeman', count: 10 }]);
  const [ar, pk] = b.stacks;
  b.activeId = ar.id; b.queue = [pk.id];
  assert.ok(C.canShoot(b, ar));
  const ev = C.act(b, { type: 'shoot', target: pk.id });
  assert.equal(ev[0].type, 'shoot');
  assert.equal(ar.shots, 11);
  pk.x = 1; pk.y = ar.y;
  assert.equal(C.canShoot(b, ar), false);
});

test('combat: waiting moves a stack to the end of the round; defending adds defense', () => {
  const b = battle([{ type: 'griffin', count: 2 }, { type: 'pikeman', count: 50 }], [{ type: 'zombie', count: 5 }]);
  const g = b.stacks[0];
  assert.equal(b.activeId, g.id);
  C.act(b, { type: 'wait' });
  assert.notEqual(b.activeId, g.id);
  assert.deepEqual(b.waitQueue, [g.id]);
  const z = b.stacks[2];
  const p = b.stacks[1];
  const before = C.calcDamage(b, p, z, { avg: true });
  z.defending = true;
  assert.ok(C.calcDamage(b, p, z, { avg: true }) < before);
});

test('combat: hero spells cost mana, once per round; Cure can revive up to the start count', () => {
  const h = { ...hero0, pow: 2, mana: 30, spells: ['arrow', 'cure'] };
  const b = battle([{ type: 'pikeman', count: 10 }], [{ type: 'goblin', count: 20 }], { h0: h });
  const gob = b.stacks[1];
  b.activeId = b.stacks[0].id;
  const ev = C.act(b, { type: 'cast', spell: 'arrow', target: { id: gob.id } });
  assert.equal(ev[0].hits[0].dmg, 30);
  assert.equal(gob.count, 14);
  assert.equal(b.sides[0].hero.mana, 25);
  assert.deepEqual(C.castable(b, 0), [], 'one spell per round');
  const pk = b.stacks[0];
  pk.count = 5; pk.hp = 10;
  b.sides[0].cast = false;
  C.act(b, { type: 'cast', spell: 'cure', target: { id: pk.id } });
  assert.equal(pk.count, 9);
  b.sides[0].cast = false; b.sides[0].hero.mana = 30;
  C.act(b, { type: 'cast', spell: 'cure', target: { id: pk.id } });
  assert.equal(pk.count, 10, 'never above the starting count');
});

test('combat: auto-resolve always finishes and maps survivors back to army slots', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const types = Object.keys(D.CREATURES);
    const pick = (i) => types[(seed * 7 + i * 13) % types.length];
    const a = [{ type: pick(1), count: 3 + seed % 9 }, null, { type: pick(2), count: 2 + seed % 5 }];
    const d = [{ type: pick(3), count: 4 + seed % 7 }, { type: pick(4), count: 1 + seed % 4 }];
    const b = C.createBattle({ hero: { ...hero0, mana: 20, spells: ['arrow', 'fireball', 'bless'] }, army: a }, { hero: null, army: d }, { seed });
    const r = C.autoResolve(b);
    assert.ok(b.over && (r.winner === 0 || r.winner === 1));
    assert.deepEqual(r.sides[0].survivors.map((s) => s.slot), [0, 2]);
    const loser = r.sides[1 - r.winner];
    assert.ok(loser.survivors.every((s) => s.count === 0) || b.round > 40);
  }
});

test('combat: the stronger army usually wins, and harder tactics beat easy ones', () => {
  let strongWins = 0; let hardWins = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const b = battle([{ type: 'swordsman', count: 12 }, { type: 'archer', count: 10 }], [{ type: 'skeleton', count: 25 }, { type: 'zombie', count: 8 }], { seed, obstacles: true });
    if (C.autoResolve(b).winner === 0) strongWins++;
    const even = battle([{ type: 'pikeman', count: 20 }, { type: 'archer', count: 10 }, { type: 'griffin', count: 4 }],
      [{ type: 'pikeman', count: 20 }, { type: 'archer', count: 10 }, { type: 'griffin', count: 4 }], { seed, obstacles: true });
    if (C.autoResolve(even, C.TACTIC_PRESETS.hard, C.TACTIC_PRESETS.easy).winner === 0) hardWins++;
  }
  assert.ok(strongWins >= 27, `strong side won ${strongWins}/30`);
  assert.ok(hardWins >= 18, `hard tactics won ${hardWins}/30`);
});

// ---------- Map battles ----------

test('map battles: beaten heroes vanish and hand over artifacts; necromancy raises skeletons', () => {
  const { st, hero } = openState();
  st.players[1].faction = 'necro';
  const foe = G.createHero(st, 1, 2, 1, undefined, { army: [{ type: 'pikeman', count: 30 }, null, null, null, null] });
  foe.artifacts = ['sword'];
  hero.faction = 'necro';
  hero.skills = { necromancy: 3 };
  hero.army = [{ type: 'vampire', count: 20 }, null, null, null, null];
  const setup = G.battleSetup(st, hero, { type: 'hero', heroId: foe.id, cost: 10 });
  const b = G.makeBattle(st, setup);
  const res = C.autoResolve(b);
  assert.equal(res.winner, 0);
  const out = G.applyBattle(st, setup, res);
  assert.ok(out.won);
  assert.equal(G.getHero(st, foe.id), undefined);
  assert.deepEqual(hero.artifacts, ['sword']);
  assert.ok(hero.army.some((s) => s?.type === 'skeleton'), 'raised skeletons');
});

test('map battles: attacking a defended town fights the hero, then the garrison, then captures', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 9 });
  const town = st.objects.find((o) => o.kind === 'town' && o.owner === 1);
  const def = G.visitingHero(st, town);
  assert.ok(def);
  const h = G.heroesOf(st, 0)[0];
  h.army = [{ type: 'cavalier', count: 40 }, { type: 'monk', count: 40 }, null, null, null];
  h.x = town.x; h.y = town.y + 1;
  let setup = G.battleSetup(st, h, { type: 'town', objId: town.id, cost: 10 });
  assert.equal(setup.kind, 'hero');
  assert.equal(setup.defBonus, 2);
  let out = G.applyBattle(st, setup, C.autoResolve(G.makeBattle(st, setup)));
  assert.ok(out.won);
  assert.equal(out.next.type, 'town');
  setup = G.battleSetup(st, h, out.next);
  assert.equal(setup.kind, 'garrison');
  out = G.applyBattle(st, setup, C.autoResolve(G.makeBattle(st, setup)));
  assert.equal(town.owner, 0);
  assert.equal(h.x, town.x);
  assert.equal(st.over?.winner, 'human', 'the only enemy town is taken: victory');
});

test('game over: no towns and no heroes, or a week without a town', () => {
  const st = G.newGame(scenarioById('valley'), { seed: 2 });
  const t = G.townsOf(st, 0)[0];
  t.owner = 1;
  for (let d = 0; d < 6; d++) { G.newDay(st); assert.equal(st.over, null); }
  G.newDay(st);
  assert.equal(st.over.winner, 'ai');
  assert.match(st.over.reason, /week/);
});

test('endless: waves arrive weekly and get stronger', () => {
  const st = G.newGame(scenarioById('endless'), { seed: 4 });
  const enemy = st.players.findIndex((p) => p.waves);
  const values = [];
  while (st.day < 30) {
    const before = G.heroesOf(st, enemy).length;
    G.newDay(st);
    if (G.heroesOf(st, enemy).length > before) values.push(G.heroArmyValue(G.heroesOf(st, enemy).at(-1)));
  }
  assert.equal(st.endless.wave, values.length);
  assert.ok(values.length >= 3, `waves so far: ${values.length}`);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  assert.equal(st.over, null, 'the wave player never "loses" for having no town');
});

// ---------- Adaptive ----------

test('adaptive: battle results move the level a little, whole games a lot', () => {
  A.resetSkill('t');
  const s0 = A.getSkill('t');
  A.reportResult('t', 1, 0.5, 0.25);
  const s1 = A.getSkill('t');
  A.reportResult('t', 1, 0.5, 1);
  const s2 = A.getSkill('t');
  assert.ok(s1 > s0 && s2 - s1 > (s1 - s0) * 3);
  assert.deepEqual(A.tune({ easy: { a: 0 }, normal: { a: 1 }, hard: { a: 3 } }, 0.75), { a: 2 });
});

test('heroes next to each other can swap stacks', () => {
  const { st, hero } = openState();
  const other = G.createHero(st, 0, 2, 2);
  hero.army = [{ type: 'pikeman', count: 5 }, { type: 'archer', count: 3 }, null, null, null];
  other.army = [{ type: 'griffin', count: 2 }, null, null, null, null];
  assert.ok(G.exchange(st, hero, other, 1));
  assert.equal(other.army[1].type, 'archer');
  assert.equal(G.exchange(st, hero, other, 0), false, 'keeps its last stack');
  other.x = 5;
  assert.equal(G.exchange(st, other, hero, 0), false, 'too far apart');
});
