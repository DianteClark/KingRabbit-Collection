// Sand Siege: maps, path-finding and maze blocking, combat rules, waves, saving, daily maps and trophies.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/sand-siege/';
const S = await import(new URL(`${base}logic/sim.js`, import.meta.url).href);
const M = await import(new URL(`${base}logic/maps.js`, import.meta.url).href);
const D = await import(new URL(`${base}logic/data.js`, import.meta.url).href);
const A = await import(new URL(`${base}logic/awards.js`, import.meta.url).href);
const { makeRng } = await import(new URL(`${base}logic/rng.js`, import.meta.url).href);
const ADAPT = await import(new URL(`${base}adaptive.js`, import.meta.url).href);

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rich = (def, opts) => { const s = S.newGame(def, opts); s.funds = 1e6; return s; };

/** A small custom map for focused tests: a straight road down the middle. */
function lane(extra = {}) {
  const rows = M.buildRows({ paths: [[[5, 0], [5, 14]]] });
  return { id: 'lane', name: 'Lane', waves: 3, funds: 500, tier: 0, roster: { rifle: 0 }, rows, ...extra };
}
function enemy(s, type, x, y, over = {}) {
  const def = D.ENEMIES[type];
  const e = {
    id: s.nextId++, type, x, y, hp: def.hp, maxHp: def.hp, shield: def.shield || 0, maxShield: def.shield || 0, armor: def.armor || 0,
    speed: def.speed, air: !!def.air, boss: !!def.boss, reward: def.reward, tx: Math.floor(x), ty: Math.floor(y), hx: 0, hy: 1,
    prog: 99, slow: 0, slowT: 0, jamT: 0, lastHit: -9, healCd: 0.5, ...over,
  };
  s.enemies.push(e);
  return e;
}

test('maps: 15 campaign maps, 11x15, gates on top, base at the bottom, a few mazes', () => {
  assert.ok(M.CAMPAIGN.length >= 12 && M.CAMPAIGN.length <= 15);
  assert.ok(M.CAMPAIGN.filter((m) => m.kind === 'maze').length >= 2, 'at least two maze maps');
  assert.equal(new Set(M.CAMPAIGN.map((m) => m.id)).size, M.CAMPAIGN.length, 'unique ids');
  for (const m of M.CAMPAIGN) {
    assert.equal(m.rows.length, M.ROWS, m.id);
    for (const r of m.rows) assert.equal(r.length, M.COLS, m.id);
    assert.ok(m.rows[0].includes('S'), `${m.id} has a gate on the top row`);
    assert.ok(m.rows[M.ROWS - 1].includes('B'), `${m.id} has its base on the bottom row`);
    assert.equal(m.rows.join('').split('B').length - 1, 1, `${m.id} has one base`);
    assert.ok(m.brief && m.tip && m.waves >= 10, `${m.id} has text and waves`);
    const s = S.newGame(m);
    for (const sp of S.spawns(s)) assert.ok(S.distAt(s, ...sp) > 0, `${m.id}: gate ${sp} reaches the base`);
  }
});

test('maps: roads never touch themselves, so enemies follow the drawn road', () => {
  for (const m of M.CAMPAIGN.filter((x) => x.kind === 'path')) {
    let junctions = 0;
    for (let y = 0; y < M.ROWS; y++) {
      for (let x = 0; x < M.COLS; x++) {
        if (!'#SB'.includes(m.rows[y][x])) continue;
        const n = N4.filter(([dx, dy]) => '#SB'.includes(m.rows[y + dy]?.[x + dx] ?? '.')).length;
        if (n > 2) junctions++;
      }
    }
    assert.equal(junctions, m.merges || 0, `${m.id}: unexpected road junctions`);
    // The walked route covers every road cell of a single-road map.
    if (!m.merges) {
      const s = S.newGame(m);
      const road = m.rows.join('').split('').filter((c) => '#SB'.includes(c)).length;
      assert.equal(S.route(s, S.spawns(s)[0]).length, road, `${m.id}: route walks the whole road`);
    }
  }
});

test('path finding: ground units walk the road to the base and cost lives', () => {
  const s = S.newGame(lane());
  enemy(s, 'rifle', 5.5, 0.5, { speed: 3 });
  for (let i = 0; i < 400 && s.enemies.length; i++) S.step(s);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.lives, D.START_LIVES - 1);
  assert.equal(s.stats.leaks, 1);
});

test('maze: you can never place a tower that blocks every route', () => {
  for (const m of M.CAMPAIGN.filter((x) => x.kind === 'maze')) {
    const rng = makeRng(42);
    const s = rich(m);
    let refused = 0;
    // Try every cell in a random order; whatever gets built, the gates must still reach the base.
    const cells = [];
    for (let y = 0; y < M.ROWS; y++) for (let x = 0; x < M.COLS; x++) cells.push([x, y]);
    for (let i = cells.length - 1; i > 0; i--) { const j = rng.int(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (const [x, y] of cells) {
      const r = S.build(s, 'mg', x, y);
      if (!r.ok && /block/.test(r.reason || '')) refused++;
      for (const sp of S.spawns(s)) assert.ok(S.distAt(s, ...sp) > 0, `${m.id}: gate blocked after building at ${x},${y}`);
    }
    assert.ok(refused > 0, `${m.id}: some blocking spots were refused`);
    assert.ok(s.towers.length > 60, `${m.id}: the field filled up (${s.towers.length})`);
    // With the field full, ground units can still walk to the base.
    s.wave = 0;
    S.callWave(s);
    for (let i = 0; i < 30 * 400 && !s.over; i++) { S.step(s); s.events.length = 0; }
    assert.ok(s.stats.leaks > 0 || s.stats.kills > 0, `${m.id}: enemies got somewhere`);
  }
});

test('maze: a tower can\'t trap an enemy or go on top of one', () => {
  const def = M.mapById('flats');
  const s = rich(def);
  const e = enemy(s, 'rifle', 3.5, 6.5);
  assert.equal(S.canPlace(s, 3, 6).ok, false, 'not on the enemy');
  // Wall the enemy in on three sides: the fourth is refused.
  assert.ok(S.build(s, 'mg', 2, 6).ok);
  assert.ok(S.build(s, 'mg', 4, 6).ok);
  assert.ok(S.build(s, 'mg', 3, 5).ok);
  e.tx = 3; e.ty = 6;
  const r = S.canPlace(s, 3, 7);
  assert.equal(r.ok, false);
  assert.match(r.reason, /trap|block/);
});

test('maze: building lengthens the route and the bot plan makes a serpentine', async () => {
  const B = await import(new URL(`${base}logic/bot.js`, import.meta.url).href);
  const s = rich(M.mapById('flats'));
  const before = S.longestRoute(s);
  for (const [x, y] of B.mazePlan(s)) S.build(s, 'mg', x, y);
  assert.ok(S.longestRoute(s) > before + 20, `route grew from ${before} to ${S.longestRoute(s)}`);
});

test('combat: armour, shields, armour piercing', () => {
  const tank = { armor: 4, shield: 0 };
  assert.equal(D.damageSplit(tank, 5).hp, 1.25, 'small bullets do a quarter');
  assert.equal(D.damageSplit(tank, 22).hp, 18);
  assert.equal(D.damageSplit(tank, 22, { pierce: true }).hp, 22);
  const sh = { armor: 0, shield: 10 };
  assert.deepEqual(D.damageSplit(sh, 25), { shield: 10, hp: 15 });
  assert.deepEqual(D.damageSplit(sh, 25, { shieldMul: 2 }), { shield: 10, hp: 20 });
});

test('towers: only hit what they can (ground/air), artillery has a blind spot', () => {
  const s = S.newGame(lane());
  s.towers.push({ id: 900, type: 'aa', x: 4, y: 7, level: 0, branch: null, spent: 70, cd: 0, prio: 'first', dir: 'u', kills: 0 });
  const g = enemy(s, 'rifle', 5.5, 7.5, { speed: 0 });
  S.step(s);
  assert.equal(g.hp, g.maxHp, 'anti-air ignores ground');
  const a = enemy(s, 'drone', 4.5, 6.5, { speed: 0 });
  S.step(s);
  assert.ok(a.hp < a.maxHp, 'anti-air hits flyers');
  const s2 = S.newGame(lane());
  s2.towers.push({ id: 901, type: 'arty', x: 4, y: 7, level: 0, branch: null, spent: 130, cd: 0, prio: 'first', dir: 'u', kills: 0 });
  enemy(s2, 'rifle', 5.5, 7.5, { speed: 0 });
  S.step(s2);
  assert.equal(s2.shells.length, 0, 'too close for artillery');
});

test('towers: target priority first / last / strong / close', () => {
  const s = S.newGame(lane());
  const t = { id: 900, type: 'sniper', x: 4, y: 7, level: 0, branch: null, spent: 100, cd: 0, prio: 'first', dir: 'u', kills: 0 };
  s.towers.push(t);
  const tough = { speed: 0, hp: 1000, maxHp: 1000 };
  const near = enemy(s, 'rifle', 5.5, 7.5, tough);
  const front = enemy(s, 'rifle', 5.5, 10.5, tough);
  const back = enemy(s, 'rifle', 5.5, 4.5, tough);
  const big = enemy(s, 'rifle', 5.5, 5.5, { speed: 0, hp: 3000, maxHp: 3000 });
  const fire = (prio) => {
    t.prio = prio; t.cd = 0;
    for (const e of s.enemies) e.hp = e.maxHp;
    S.step(s);
    return s.enemies.find((e) => e.hp < e.maxHp);
  };
  assert.equal(fire('first'), front);
  assert.equal(fire('last'), back);
  assert.equal(fire('strong'), big);
  assert.equal(fire('close'), near);
});

test('towers: slow, splash, healing and the jammer', () => {
  const s = S.newGame(lane());
  s.towers.push({ id: 900, type: 'slow', x: 4, y: 7, level: 0, branch: null, spent: 60, cd: 0, prio: 'first', dir: 'u', kills: 0 });
  const e = enemy(s, 'rifle', 5.5, 7.5, { speed: 0 });
  S.step(s);
  assert.equal(e.slow, D.TOWERS.slow.levels[0].slow);
  // A medic heals a hurt friend; a jammed medic doesn't.
  const s2 = S.newGame(lane());
  const medic = enemy(s2, 'medic', 5.5, 3.5, { speed: 0, healCd: 0 });
  const hurtE = enemy(s2, 'rifle', 5.5, 4.5, { speed: 0, hp: 10 });
  S.step(s2);
  assert.ok(hurtE.hp > 10, 'healed');
  const h = hurtE.hp;
  medic.jamT = 5; medic.healCd = 0;
  S.step(s2);
  assert.equal(hurtE.hp, h, 'jammed medic cannot heal');
  // Cannon splash hits a whole group.
  const s3 = S.newGame(lane());
  s3.towers.push({ id: 900, type: 'cannon', x: 4, y: 7, level: 0, branch: null, spent: 80, cd: 0, prio: 'first', dir: 'u', kills: 0 });
  const grp = [enemy(s3, 'rifle', 5.5, 7.5, { speed: 0 }), enemy(s3, 'rifle', 5.5, 7.9, { speed: 0 }), enemy(s3, 'rifle', 5.5, 7.1, { speed: 0 })];
  for (let i = 0; i < 12; i++) S.step(s3);
  assert.ok(grp.every((g) => g.hp < g.maxHp), 'all three were hit');
});

test('economy: build, upgrade, specialties, selling, early waves', () => {
  const s = S.newGame(lane());
  const r = S.build(s, 'mg', 4, 4);
  assert.ok(r.ok);
  assert.equal(s.funds, 500 - 50);
  assert.equal(S.build(s, 'mg', 5, 4).ok, false, 'not on the road');
  assert.equal(S.build(s, 'mg', 4, 4).ok, false, 'not on another tower');
  const t = r.tower;
  assert.ok(S.upgrade(s, t.id).ok); assert.ok(S.upgrade(s, t.id).ok);
  assert.equal(t.level, 2);
  assert.ok(S.upgrade(s, t.id, 1).ok, 'specialty');
  assert.equal(t.level, 3); assert.equal(t.branch, 1);
  assert.equal(S.upgrade(s, t.id).ok, false, 'maxed');
  assert.equal(D.towerStats('mg', 3, 1).pierce, true);
  // Full refund before the first wave, 70% after.
  const spent = t.spent;
  const f = s.funds;
  assert.equal(S.sellValue(s, t), spent);
  S.callWave(s);
  assert.equal(S.sellValue(s, t), Math.floor(spent * 0.7));
  assert.ok(S.sell(s, t.id).ok);
  assert.equal(s.funds, f + Math.floor(spent * 0.7));
  // Every tower type has 2 upgrades and 2 specialties; costs go up.
  for (const k of D.TOWER_ORDER) {
    assert.equal(D.TOWERS[k].levels.length, 3, k);
    assert.equal(D.TOWERS[k].branches.length, 2, k);
  }
  assert.ok(D.TOWER_ORDER.length >= 6 && D.TOWER_ORDER.length <= 8);
});

test('waves: countdown, calling early pays a bonus, the last wave wins', () => {
  const s = S.newGame(lane({ waves: 2 }));
  S.build(s, 'sniper', 4, 10); S.build(s, 'mg', 6, 10); S.build(s, 'mg', 4, 6);
  assert.ok(S.canCall(s));
  assert.equal(S.earlyBonus(s), 0);
  S.callWave(s);
  assert.equal(S.canCall(s), false, 'not while the wave is still coming');
  while (s.nextIn == null) S.step(s);
  for (let i = 0; i < 60; i++) S.step(s);
  const bonus = S.earlyBonus(s);
  assert.ok(bonus > 10);
  const f = s.funds;
  const r = S.callWave(s);
  assert.equal(r.bonus, bonus);
  assert.ok(s.funds >= f + bonus);
  assert.equal(s.stats.early, 1);
  S.runUntilOver(s, { maxT: 600 });
  assert.equal(s.over, 'win');
});

test('powers: airstrike, sandstorm, repair', () => {
  const s = S.newGame(lane(), { powers: ['airstrike', 'sandstorm', 'repair'] });
  assert.equal(S.canUsePower(s, 'airstrike'), false, 'not before the first wave');
  S.callWave(s);
  const e = enemy(s, 'rifle', 5.5, 5.5, { speed: 0 });
  assert.ok(S.usePower(s, 'airstrike', 5.5, 5.5).ok);
  assert.equal(S.usePower(s, 'airstrike', 5.5, 5.5).ok, false, 'cooling down');
  for (let i = 0; i < 30; i++) S.step(s);
  assert.ok(!s.enemies.includes(e), 'the strike killed it');
  assert.equal(S.canUsePower(s, 'repair'), false, 'base not damaged');
  s.lives = 15;
  assert.ok(S.usePower(s, 'repair').ok);
  assert.equal(s.lives, 18);
  assert.ok(S.usePower(s, 'sandstorm').ok);
  assert.ok(s.storm > 0);
});

test('saving: a game saved mid-wave resumes exactly the same', () => {
  const def = M.mapById('labyrinth');
  const a = S.newGame(def, { powers: ['airstrike'] });
  S.build(a, 'mg', 5, 11); S.build(a, 'cannon', 4, 11); S.build(a, 'slow', 6, 11);
  S.callWave(a);
  for (let i = 0; i < 30 * 14; i++) S.step(a);
  assert.ok(a.enemies.length > 0, 'mid-wave');
  const b = S.deserialize(S.serialize(a));
  for (let i = 0; i < 30 * 40; i++) { S.step(a); S.step(b); }
  a.events = []; b.events = [];
  assert.equal(S.serialize(a), S.serialize(b));
  assert.equal(S.deserialize('{"v":0}'), null, 'old or broken saves are ignored');
});

test('waves: health grows, bosses appear where planned, endless keeps going', () => {
  const m = M.mapById('behemoth');
  const g0 = M.waveGroups(m, 0); const g10 = M.waveGroups(m, 10);
  assert.ok(g10[0].hp > g0[0].hp * 1.5 || g10.some((g) => g.hp > 200));
  assert.ok(M.waveGroups(m, 14).some((g) => g.type === 'behemoth'));
  assert.ok(M.waveGroups(m, 29, { endless: true }).some((g) => D.ENEMIES[g.type].boss), 'endless bosses every 10 waves');
  for (const def of M.CAMPAIGN) {
    for (let w = 0; w < def.waves; w++) {
      const gs = M.waveGroups(def, w);
      assert.ok(gs.length >= 1 && gs.every((g) => g.n >= 1 && g.hp > 0), `${def.id} wave ${w}`);
    }
  }
  const s = S.newGame(lane(), { mode: 'endless' });
  assert.equal(s.totalWaves, 0);
  s.wave = 50;
  assert.ok(S.moreWaves(s));
});

test('daily: the same seed gives the same map; every day is playable', () => {
  const a = M.dailyMap(123456); const b = M.dailyMap(123456);
  assert.deepEqual(a.rows, b.rows);
  assert.deepEqual(a.mods, b.mods);
  for (let seed = 1; seed < 200; seed++) {
    const d = M.dailyMap(seed * 7919);
    assert.equal(d.mods.length, 2);
    assert.notEqual(d.mods[0], d.mods[1]);
    const s = S.newGame(d, { mode: 'daily' });
    for (const sp of S.spawns(s)) assert.ok(S.distAt(s, ...sp) > 0, `seed ${seed}: gate reaches base`);
    if (d.kind === 'path') {
      // The road never touches itself, so the walked route is the whole road.
      const road = d.rows.join('').split('').filter((c) => '#SB'.includes(c)).length;
      assert.equal(S.route(s, S.spawns(s)[0]).length, road, `seed ${seed}: road has no shortcuts`);
    }
    assert.equal(d.rows.length, M.ROWS);
  }
  const s = S.newGame(M.dailyMap(5), { mode: 'daily' });
  s.over = 'win'; s.lives = 12;
  assert.equal(S.dailyScore(s), 15 * 100 + 12 * 25);
});

test('trophies: 10-15 with all three tiers, secrets, awarded at the right moments', () => {
  assert.ok(A.TROPHIES.length >= 10 && A.TROPHIES.length <= 15);
  for (const tier of ['bronze', 'silver', 'gold']) assert.ok(A.TROPHIES.some((t) => t.tier === tier));
  assert.ok(A.TROPHIES.filter((t) => t.secret).length >= 2);
  const ids = new Set(A.TROPHIES.map((t) => t.id));
  const s = S.newGame(M.CAMPAIGN[0]);
  assert.deepEqual(A.liveTrophies(s), []);
  s.over = 'win'; s.lives = 20;
  const got = A.endTrophies(s, { outpost: 3 });
  assert.ok(got.includes('first-win') && got.includes('three-stars'));
  assert.ok(!got.includes('campaign'));
  const all = Object.fromEntries(M.CAMPAIGN.map((m) => [m.id, 3]));
  const done = A.endTrophies(s, all);
  assert.ok(done.includes('campaign') && done.includes('all-stars') && done.includes('halfway'));
  s.hard = true;
  assert.ok(A.endTrophies(s, all).includes('flawless'));
  s.stats.bossKills = 1; s.stats.strikeBest = 5;
  assert.ok(A.liveTrophies(s).includes('boss') && A.liveTrophies(s).includes('airstrike'));
  for (const id of [...A.endTrophies(s, all), ...A.liveTrophies(s)]) assert.ok(ids.has(id), id);
});

test('adaptive: changes only enemy health, gently (88-112%)', () => {
  assert.equal(ADAPT.hpScale(0), 0.88);
  assert.equal(ADAPT.hpScale(1), 1.12);
  assert.equal(ADAPT.hpScale(0.5), 1);
  const lo = S.newGame(M.CAMPAIGN[3], { hpScale: 0.88 }); const hi = S.newGame(M.CAMPAIGN[3], { hpScale: 1.12 });
  assert.equal(lo.funds, hi.funds);
  const gl = S.groupsFor(lo, 5); const gh = S.groupsFor(hi, 5);
  assert.deepEqual(gl.map((g) => [g.type, g.n]), gh.map((g) => [g.type, g.n]), 'same enemies');
  assert.ok(gh[0].hp > gl[0].hp, 'only health differs');
});
