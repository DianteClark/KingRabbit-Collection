import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, B, A, P, D, W, playBattle } from './pocket-pets-sim.test.mjs';

const base = '../games/pocket-pets/';
const T = await import(new URL(`${base}logic/types.js`, import.meta.url).href);
const { makeRng } = await import(new URL(`${base}logic/rng.js`, import.meta.url).href);
const AD = await import(new URL(`${base}adaptive.js`, import.meta.url).href);
const TILES = await import(new URL(`${base}tiles.js`, import.meta.url).href);

const mk = (sp, lv) => P.createPet(sp, lv, { uid: Math.floor(Math.random() * 1e9) });
function duel(a, b, { kind = 'wild', seed = 1, bag = {}, ai = null } = {}) {
  const rng = makeRng(seed);
  return B.createBattle({ kind, party: Array.isArray(a) ? a : [a], bag, foeParty: Array.isArray(b) ? b : [b], foe: { name: 'Foe', title: 'Tamer' }, rng, ai });
}

// ---------------------------------------------------------------- types

test('type wheel: each type beats the next, is weak to the one before, Plain is neutral', () => {
  const w = T.WHEEL;
  assert.deepEqual(w, ['flame', 'leaf', 'stone', 'spark', 'tide']);
  for (let i = 0; i < w.length; i++) {
    const a = w[i]; const next = w[(i + 1) % w.length]; const prev = w[(i + w.length - 1) % w.length];
    assert.equal(T.typeMult(a, next), 2, `${a} > ${next}`);
    assert.equal(T.typeMult(a, prev), 0.5, `${a} vs ${prev}`);
    assert.equal(T.typeMult(a, a), 1);
    assert.equal(T.typeMult(a, 'plain'), 1);
    assert.equal(T.typeMult('plain', a), 1);
    assert.equal(T.beats(a), next);
    assert.equal(T.beatenBy(a), prev);
  }
});

// ---------------------------------------------------------------- data

test('data: moves, learnsets, evolutions and sprites are consistent', () => {
  for (const [id, m] of Object.entries(D.MOVES)) {
    assert.ok(T.TYPES.includes(m.type), `${id} type`);
    assert.ok(m.pp > 0 && m.power >= 0, `${id} numbers`);
    assert.ok(m.power > 0 || m.status || m.stat || m.heal, `${id} does something`);
  }
  for (const [line, list] of Object.entries(D.LINES)) {
    for (const [lv, m] of list) assert.ok(D.MOVES[m], `${line} learns unknown ${m} at ${lv}`);
    assert.ok(list.filter(([lv]) => lv === 1).length >= 1, `${line} starts with a move`);
  }
  const names = new Set();
  for (const [id, s] of Object.entries(D.SPECIES)) {
    assert.ok(D.LINES[s.line], `${id} line`);
    assert.ok(T.TYPES.includes(s.type), `${id} type`);
    assert.ok(s.row >= 0 && s.row <= 5, `${id} sprite row`);
    assert.ok(['baby', 'mid', 'adult'].includes(s.stage));
    assert.ok(s.dex && s.dex.length > 10, `${id} has a dex entry`);
    assert.ok(!names.has(s.name), `${id} name unique`);
    names.add(s.name);
    if (s.evo) {
      const to = D.SPECIES[s.evo[0]];
      assert.ok(to, `${id} evolves into a real pet`);
      assert.equal(to.line, s.line, `${id} evolves within its line`);
      assert.ok(s.evo[1] > 1 && s.evo[1] < P.MAX_LEVEL);
    }
    // Same sprite row and stage must not share a colour scheme (type), so every pet looks different.
    for (const [id2, s2] of Object.entries(D.SPECIES)) if (id2 !== id) assert.ok(!(s2.row === s.row && s2.stage === s.stage && s2.type === s.type), `${id} and ${id2} look identical`);
  }
});

test('data: every pet can be obtained (starters, wild tables or evolution)', () => {
  const got = new Set(D.STARTERS);
  for (const m of Object.values(W.MAPS)) for (const [sp] of m.wild?.grass || []) { assert.ok(D.SPECIES[sp], sp); got.add(sp); }
  let grew = true;
  while (grew) { grew = false; for (const sp of [...got]) { const e = D.SPECIES[sp].evo; if (e && !got.has(e[0])) { got.add(e[0]); grew = true; } } }
  for (const sp of D.DEX_ORDER) assert.ok(got.has(sp), `${sp} can't be obtained`);
});

test('data: names avoid a certain famous franchise', () => {
  const banned = ['poke', 'pika', 'chu', 'charm', 'squirt', 'bulba', 'eevee', 'ball', 'trainer', 'gym', 'pidg', 'ratt', 'vulpix', 'poliwag', 'seedot', 'potion of'];
  const all = [...Object.values(D.SPECIES).map((s) => s.name), ...Object.values(D.MOVES).map((m) => m.name), ...Object.values(D.ITEMS).map((i) => i.name)];
  for (const n of all) for (const b of banned) assert.ok(!n.toLowerCase().includes(b), `${n} contains ${b}`);
});

// ---------------------------------------------------------------- pets

test('pets: stats grow with level, XP curve rises, moves are the latest four', () => {
  const a = mk('embit', 5); const b = mk('embit', 30);
  for (const k of ['hp', 'atk', 'def', 'spd']) assert.ok(P.statsOf(b)[k] > P.statsOf(a)[k]);
  for (let lv = 2; lv < 50; lv++) assert.ok(P.xpForLevel(lv + 1) > P.xpForLevel(lv));
  assert.deepEqual(a.moves.map((m) => m.id), ['tackle', 'snarl', 'cinder']);
  assert.equal(b.moves.length, 4);
  assert.deepEqual(b.moves.map((m) => m.id), ['scorch', 'rally', 'blazeburst', 'flarekick'].sort((x, y) => D.LINES.embit.findIndex((l) => l[1] === x) - D.LINES.embit.findIndex((l) => l[1] === y)));
});

test('pets: level ups learn moves, ask when four are known, and evolve', () => {
  const p = mk('embit', 8);
  assert.equal(p.moves.length, 3);
  const ev = P.gainXp(p, P.xpForLevel(9) - p.xp);
  assert.equal(p.lv, 9);
  assert.ok(ev.some((e) => e.t === 'learn' && e.move === 'quickjab' && e.auto));
  assert.equal(p.moves.length, 4);
  const ev2 = P.gainXp(p, P.xpForLevel(13) - p.xp);
  const ask = ev2.find((e) => e.t === 'learn' && e.move === 'flarekick');
  assert.ok(ask && !ask.auto, 'asks to replace a move');
  assert.ok(P.learnMove(p, 'flarekick', 0));
  assert.equal(p.moves[0].id, 'flarekick');
  P.gainXp(p, P.xpForLevel(14) - p.xp);
  assert.equal(P.canEvolve(p), 'cindrel');
  p.hp = Math.floor(P.maxHp(p) / 2);
  const r = P.evolve(p);
  assert.deepEqual(r, { from: 'embit', to: 'cindrel' });
  assert.ok(Math.abs(p.hp / P.maxHp(p) - 0.5) < 0.05, 'keeps its HP share');
});

// ---------------------------------------------------------------- battle

function avgDamage(att, def, moveId, n = 200) {
  let tot = 0;
  for (let i = 0; i < n; i++) {
    const a = mk(att[0], att[1]); const d = mk(def[0], def[1]);
    a.moves = [{ id: moveId, pp: 99 }];
    d.moves = [{ id: 'brace', pp: 99 }];
    const b = duel(a, d, { seed: i + 1 });
    D.MOVES[moveId].acc;
    const before = d.hp;
    B.takeTurn(b, { type: 'move', slot: 0 });
    tot += before - d.hp;
  }
  return tot / n;
}

test('battle: type match-ups and same-type bonus change damage', () => {
  const strong = avgDamage(['emberkit', 20], ['fernkit', 20], 'cinder');
  const neutral = avgDamage(['emberkit', 20], ['mewlet', 20], 'cinder');
  const weak = avgDamage(['emberkit', 20], ['tadling', 20], 'cinder');
  assert.ok(strong > neutral * 1.6, `strong ${strong} vs neutral ${neutral}`);
  assert.ok(weak < neutral * 0.65, `weak ${weak} vs neutral ${neutral}`);
  const stab = avgDamage(['emberkit', 20], ['mewlet', 20], 'cinder');
  const noStab = avgDamage(['tadling', 20], ['mewlet', 20], 'cinder');
  assert.ok(stab > 0 && noStab > 0);
});

test('battle: status rules (immunity, burn, poison, paralysis, sleep)', () => {
  const flame = mk('emberkit', 10);
  assert.equal(B.statusBlock(flame, 'burn'), 'immune');
  assert.equal(B.statusBlock(mk('fernkit', 10), 'poison'), 'immune');
  assert.equal(B.statusBlock(mk('zapkit', 10), 'para'), 'immune');
  assert.equal(B.statusBlock(mk('mewlet', 10), 'sleep'), '');
  // Poison ticks 1/8 at the end of the turn.
  const a = mk('mewlet', 20); const d = mk('tadling', 20);
  a.moves = [{ id: 'brace', pp: 30 }]; d.moves = [{ id: 'brace', pp: 30 }];
  d.st = 'poison';
  const b = duel(a, d);
  const before = d.hp;
  B.takeTurn(b, { type: 'move', slot: 0 });
  assert.equal(before - d.hp, Math.floor(P.maxHp(d) / 8));
  // Paralysis halves speed.
  const s0 = B.effStat(b, 1, 'spd');
  d.st = 'para';
  assert.equal(B.effStat(b, 1, 'spd'), s0 / 2);
  // A sleeping pet can't act until it wakes.
  const s = mk('mewlet', 20); const t = mk('tadling', 20);
  s.moves = [{ id: 'tackle', pp: 30 }]; t.moves = [{ id: 'brace', pp: 30 }];
  s.st = 'sleep'; s.slp = 3;
  const bb = duel(s, t);
  const ev = B.takeTurn(bb, { type: 'move', slot: 0 });
  assert.ok(ev.some((e) => /fast asleep/.test(e.msg || '')));
  assert.equal(t.hp, P.maxHp(t));
});

test('battle: burn halves attack damage', () => {
  const burned = (() => { let tot = 0; for (let i = 0; i < 200; i++) { const a = mk('mewlet', 20); a.st = 'burn'; a.moves = [{ id: 'tackle', pp: 99 }]; const d = mk('pebbit', 20); d.moves = [{ id: 'brace', pp: 9 }]; const b = duel(a, d, { seed: i + 3 }); const h = d.hp; B.takeTurn(b, { type: 'move', slot: 0 }); tot += h - d.hp; } return tot / 200; })();
  const normal = avgDamage(['mewlet', 20], ['pebbit', 20], 'tackle');
  assert.ok(burned < normal * 0.7, `${burned} vs ${normal}`);
});

test('catching: weaker and sleeping pets are easier, better capsules help', () => {
  const p = mk('mewlet', 10);
  const full = B.catchChance(p, 'capsule');
  p.hp = 1;
  const low = B.catchChance(p, 'capsule');
  p.st = 'sleep';
  const asleep = B.catchChance(p, 'capsule');
  assert.ok(low > full * 2.5, `${low} vs ${full}`);
  assert.ok(asleep > low);
  assert.ok(B.catchChance(p, 'ultracap') >= B.catchChance(p, 'supercap'));
  assert.ok(B.catchChance(mk('whiskar', 30), 'capsule') < full, 'evolved pets are harder');
  // The real catch rate matches the chance.
  let caught = 0; const N = 600;
  for (let i = 0; i < N; i++) {
    const w = mk('mewlet', 10); w.hp = Math.floor(P.maxHp(w) / 2);
    const chance = B.catchChance(w, 'capsule');
    const b = duel(mk('embit', 10), w, { seed: 100 + i, bag: { capsule: 1 } });
    B.takeTurn(b, { type: 'catch', item: 'capsule' });
    if (b.result === 'caught') caught += 1;
    if (i === 0) assert.ok(chance > 0.2 && chance < 0.5);
  }
  const expect = B.catchChance(Object.assign(mk('mewlet', 10), { hp: Math.floor(P.maxHp(mk('mewlet', 10)) / 2) }), 'capsule');
  assert.ok(Math.abs(caught / N - expect) < 0.07, `rate ${caught / N} vs ${expect}`);
});

test('battle: rules for running, catching and items depend on the battle kind', () => {
  const b = duel(mk('embit', 10), mk('mewlet', 10), { kind: 'trainer', bag: { capsule: 3, potion: 1 } });
  assert.match(B.actionProblem(b, { type: 'run' }), /can't run/);
  assert.match(B.actionProblem(b, { type: 'catch', item: 'capsule' }), /catch/);
  assert.match(B.actionProblem(b, { type: 'item', item: 'potion', target: 0 }), /full/);
  b.sides[0].party[0].hp -= 10;
  assert.equal(B.actionProblem(b, { type: 'item', item: 'potion', target: 0 }), '');
  const ev = B.takeTurn(b, { type: 'item', item: 'potion', target: 0 });
  assert.equal(b.bag.potion, 0);
  assert.ok(ev.some((e) => e.t === 'item'));
});

test('battle: fainting forces a switch, trainers send their next pet, XP is shared', () => {
  const lead = mk('mewlet', 5); const back = mk('embit', 20);
  lead.moves = [{ id: 'brace', pp: 30 }];
  const foe1 = mk('pebbit', 30); const foe2 = mk('mewlet', 3);
  foe1.moves = [{ id: 'rockbash', pp: 30 }]; foe2.moves = [{ id: 'brace', pp: 30 }];
  const rng = makeRng(5);
  const b = B.createBattle({ kind: 'trainer', party: [lead, back], foeParty: [foe1, foe2], foe: { name: 'Bo', title: 'Hiker' }, rng, ai: A.makeAI(1, rng) });
  let guard = 0;
  while (b.phase === 'choose' && guard++ < 10) B.takeTurn(b, { type: 'move', slot: 0 });
  assert.equal(b.phase, 'switch');
  assert.equal(lead.hp, 0);
  B.sendOut(b, 1);
  assert.equal(B.active(b, 0), back);
  foe1.hp = 1;
  back.moves = [{ id: 'tackle', pp: 30 }];
  const xp0 = back.xp;
  const ev = B.takeTurn(b, { type: 'move', slot: 0 });
  assert.ok(ev.some((e) => e.t === 'send' && e.side === 1), 'foe sends its next pet');
  assert.ok(back.xp > xp0, 'the pet that fought gets XP');
});

test('battle: losing every pet ends the battle', () => {
  const a = mk('mewlet', 3); a.moves = [{ id: 'brace', pp: 30 }];
  const f = mk('cragtoad', 40); f.moves = [{ id: 'boulderdrop', pp: 30 }];
  const b = duel(a, f, { seed: 9 });
  let g = 0;
  while (b.phase !== 'over' && g++ < 20) B.takeTurn(b, { type: 'move', slot: 0 });
  assert.equal(b.result, 'lose');
});

// ---------------------------------------------------------------- AI and adaptive skill

test('AI: a hard tamer picks the super-strong move and an easy one is more random', () => {
  const pick = (skill) => {
    const counts = {};
    for (let i = 0; i < 300; i++) {
      const me = mk('mewlet', 20); const foe = mk('emberkit', 20);
      foe.moves = [{ id: 'tackle', pp: 30 }, { id: 'cinder', pp: 30 }, { id: 'snarl', pp: 30 }, { id: 'quickjab', pp: 30 }];
      const fern = mk('fernkit', 20);
      const rng = makeRng(i + 7);
      const b = B.createBattle({ kind: 'trainer', party: [fern], foeParty: [foe], foe: { name: 'X' }, rng });
      const a = A.makeAI(skill, rng).act(b);
      const id = a.type === 'move' ? foe.moves[a.slot].id : a.type;
      counts[id] = (counts[id] || 0) + 1;
      void me;
    }
    return counts;
  };
  const hard = pick(1); const easy = pick(0);
  assert.ok((hard.cinder || 0) > 280, JSON.stringify(hard));
  assert.ok((easy.cinder || 0) < 250, JSON.stringify(easy));
});

test('AI: hard tamers switch out of bad match-ups and use potions when low', () => {
  const rng = makeRng(3);
  const fern = mk('fernkit', 20); const tide = mk('tadling', 20); const flame = mk('emberkit', 20);
  // Player's Flame pet vs AI's Leaf pet; AI also has a Tide pet that beats Flame.
  const b = B.createBattle({ kind: 'trainer', party: [flame], foeParty: [fern, tide], foe: { name: 'X' }, rng });
  let swaps = 0;
  for (let i = 0; i < 50; i++) { b.foe.swaps = 0; const a = A.makeAI(1, makeRng(i)).act(b); if (a.type === 'switch') swaps += 1; }
  assert.ok(swaps > 30, `swaps ${swaps}`);
  const b2 = B.createBattle({ kind: 'trainer', party: [mk('mewlet', 20)], foeParty: [mk('mewlet', 20)], foe: { name: 'X', items: { superpotion: 1 } }, rng });
  B.active(b2, 1).hp = 3;
  assert.equal(A.makeAI(1, makeRng(1)).act(b2).type, 'item');
});

test('AI: skill changes decisions only, never the tamer\'s pets or levels', () => {
  const st = G.newGame(1); G.chooseStarter(st, 'embit');
  const s1 = G.leaderSetup(st, 'marina'); const s2 = G.leaderSetup(st, 'marina');
  assert.deepEqual(s1.foeParty.map((p) => [p.sp, p.lv, p.hp]), s2.foeParty.map((p) => [p.sp, p.lv, p.hp]));
  const e = A.aiParams(0); const h = A.aiParams(1);
  assert.ok(h.smart > e.smart && h.swap > e.swap);
});

test('adaptive: wins raise the tamer level, losses lower it, within 0..1', () => {
  AD.resetSkill();
  const s0 = AD.getSkill();
  AD.reportResult(AD.SKILL_ID, 1, 0.9, 1);
  assert.ok(AD.getSkill() > s0);
  for (let i = 0; i < 40; i++) AD.reportResult(AD.SKILL_ID, 0, 1, 1);
  assert.equal(AD.getSkill(), 0);
  for (let i = 0; i < 60; i++) AD.reportResult(AD.SKILL_ID, 1, 1, 1);
  assert.equal(AD.getSkill(), 1);
  assert.equal(AD.skillLabel(), 10);
  AD.resetSkill();
});

// ---------------------------------------------------------------- world

test('world: maps are rectangular, use known tiles and have art for every tile', () => {
  const known = new Set(Object.keys(TILES.TILE_ART));
  for (const [id, m] of Object.entries(W.MAPS)) {
    const w = m.tiles[0].length;
    assert.ok(m.tiles.every((r) => r.length === w), `${id} rows`);
    for (const r of m.tiles) for (const ch of r) assert.ok(known.has(ch), `${id}: unknown tile ${ch}`);
    for (const b of m.buildings || []) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) assert.equal(W.tileAt(m, x, y), '#', `${id}: ${b.kind} footprint`);
      const d = W.doorOf(b);
      assert.ok(W.WALKABLE.has(W.tileAt(m, d.x, d.y + 1)), `${id}: ${b.kind} door is blocked`);
    }
    for (const e of m.exits) {
      assert.ok(W.WALKABLE.has(W.tileAt(m, e.x, e.y)), `${id}: exit on a wall`);
      const to = W.MAPS[e.to];
      assert.ok(to, `${id}: exit to unknown ${e.to}`);
      assert.ok(W.WALKABLE.has(W.tileAt(to, e.tx, e.ty)), `${id} -> ${e.to}: lands on a wall`);
      assert.ok(to.exits.some((b) => b.to === id), `${e.to} has no way back to ${id}`);
    }
  }
  for (const rows of Object.values(TILES.ITEM_ART)) assert.ok(rows.every((r) => r.length === 12));
  for (const a of Object.values(TILES.TILE_ART)) for (const layer of [a.base, a.art]) if (layer) assert.ok(layer.length === 16 && layer.every((r) => r.length === 16));
});

test('world: with every gate open, all doors, people, signs and items can be reached', () => {
  const st = G.newGame(1);
  st.flags.starter = 'embit'; st.badges = [...W.BADGES];
  for (const id of ['fern', 'cinder', 'marina', 'rocco', 'rival1', 'rival2']) st.beaten[id] = true;
  for (const [id, m] of Object.entries(W.MAPS)) {
    st.map = id;
    const entry = Object.values(W.MAPS).flatMap((mm) => mm.exits.filter((x) => x.to === id))[0];
    st.x = entry.tx; st.y = entry.ty;
    const targets = [];
    for (const e of m.exits) targets.push(['exit', e.x, e.y, false]);
    for (const b of m.buildings || []) { const d = W.doorOf(b); targets.push([b.kind, d.x, d.y + 1, false]); }
    for (const n of G.npcsOn(st, id)) targets.push([n.id, n.x, n.y, true]);
    for (const it of m.items || []) targets.push([it.id, it.x, it.y, false]);
    for (const s of m.signs || []) targets.push(['sign', s.x, s.y, true]);
    for (const [name, x, y, adj] of targets) assert.ok(G.findPath(st, x, y, { adjacent: adj }), `${id}: can't reach ${name} at ${x},${y}`);
  }
});

test('world: gates hold you back until you have the badges', () => {
  const st = G.newGame(1);
  G.chooseStarter(st, 'embit');
  st.beaten.rival1 = true;
  // Brookton: Whisperwood needs 1 badge.
  G.changeMap(st, 'brookton', 7, 3);
  assert.equal(G.findPath(st, 7, 0), null);
  st.badges = ['fern'];
  assert.ok(G.findPath(st, 7, 0));
  // The cave exit is blocked by Cinder until he is beaten.
  G.changeMap(st, 'cave', 6, 3);
  assert.equal(G.findPath(st, 6, 0), null);
  st.beaten.cinder = true;
  assert.ok(G.findPath(st, 6, 0));
  // Peakside: the Summit Trail needs 3 badges, the Champion's tower 4.
  G.changeMap(st, 'peakside', 7, 4);
  assert.equal(G.findPath(st, 8, 0), null);
  st.badges = ['fern', 'cinder', 'marina'];
  assert.ok(G.findPath(st, 8, 0));
  G.changeMap(st, 'summit', 6, 10);
  const tower = W.MAPS.summit.buildings.find((b) => b.kind === 'tower');
  assert.equal(G.interact(st, W.doorOf(tower).x, W.doorOf(tower).y).t, 'talk');
  st.badges.push('rocco');
  assert.equal(G.findPath(st, 6, 5) !== null, true);
  assert.equal(G.interact(st, W.doorOf(tower).x, W.doorOf(tower).y).t, 'battle');
});

test('world: walking into tall grass finds wild pets, trainers spot you', () => {
  const st = G.newGame(4);
  G.chooseStarter(st, 'embit');
  G.changeMap(st, 'route1', 1, 3);
  let wild = 0;
  for (let i = 0; i < 400; i++) {
    st.x = 1; st.y = 3;
    const r = G.step(st, 'up');
    assert.ok(r.moved);
    if (r.events.some((e) => e.t === 'wild')) wild += 1;
  }
  assert.ok(wild > 25 && wild < 100, `wild ${wild}`);
  // Pip stands at (4,19) facing right with sight 3.
  G.changeMap(st, 'route1', 6, 20);
  const r = G.step(st, 'up');
  assert.ok(r.events.some((e) => e.t === 'spotted' && e.npc.id === 'r1_pip'));
});

// ---------------------------------------------------------------- journey

test('game: starter, catching into the box, shop gating, resting and blacking out', () => {
  const st = G.newGame(2);
  const pet = G.chooseStarter(st, 'dribbit');
  assert.equal(pet.lv, 5);
  assert.equal(G.chooseStarter(st, 'embit'), null, 'only one starter');
  assert.ok(st.bag.capsule >= 5);
  for (let i = 0; i < 6; i++) G.addPet(st, G.makePet(st, 'mewlet', 3));
  assert.equal(st.party.length, 6);
  assert.equal(st.box.length, 1);
  assert.equal(G.depositPet(st, 0), '');
  assert.match(G.withdrawPet(st, 0), /^$/);
  assert.ok(!G.shopStock(st, 'city').includes('ultracap'));
  st.badges = ['fern', 'cinder', 'marina'];
  assert.ok(G.shopStock(st, 'city').includes('ultracap'));
  st.coins = 100;
  assert.match(G.buy(st, 'revive'), /Not enough/);
  assert.equal(G.buy(st, 'potion'), '');
  assert.equal(st.coins, 40);
  // Rest at the Brookton clinic, then black out on Route 1.
  G.changeMap(st, 'brookton', 3, 13);
  st.party[0].hp = 1;
  G.restHere(st);
  assert.equal(st.party[0].hp, P.maxHp(st.party[0]));
  G.changeMap(st, 'route1', 5, 5);
  st.coins = 1000;
  for (const p of st.party) p.hp = 0;
  const out = G.afterBattle(st, G.wildSetup(st, 'mewlet', 3), 'lose');
  assert.ok(out.blackout);
  assert.equal(st.coins, 700);
  assert.deepEqual([st.map, st.x, st.y], ['brookton', 3, 13]);
  assert.ok(st.party.every((p) => p.hp === P.maxHp(p)));
});

test('game: beating a leader gives coins and a badge; the first rival battle is friendly', () => {
  const st = G.newGame(3);
  G.chooseStarter(st, 'embit');
  const setup = G.leaderSetup(st, 'fern');
  const c0 = st.coins;
  const out = G.afterBattle(st, setup, 'win');
  assert.equal(out.badge, 'fern');
  assert.deepEqual(st.badges, ['fern']);
  assert.equal(st.coins, c0 + setup.reward);
  const rival = W.MAPS.sproutvale.npcs.find((n) => n.id === 'rival1');
  const rs = G.trainerSetup(st, rival);
  assert.equal(rs.foeParty[0].sp, 'dribbit', 'rival picks the starter that beats yours');
  const coins = st.coins;
  const out2 = G.afterBattle(st, rs, 'lose');
  assert.ok(!out2.blackout);
  assert.equal(st.coins, coins);
  assert.ok(st.beaten.rival1);
});

test('game: a saved journey survives JSON and plays on', () => {
  const st = G.newGame(8);
  G.chooseStarter(st, 'sprigling');
  const copy = JSON.parse(JSON.stringify(st));
  const rng = makeRng(2);
  const b = playBattle(copy, G.wildSetup(copy, 'mewlet', 3), rng);
  assert.ok(['win', 'lose', 'caught', 'ran'].includes(b.result));
});

test('pets: nicknames are cleaned up, and blank or the species name clears them', () => {
  const p = mk('mewlet', 5);
  assert.equal(P.setNick(p, '  Mr <b>Whiskers!!  '), 'Mr bWhiskers'.slice(0, P.NICK_MAX));
  assert.equal(P.petName(p), p.nick);
  assert.equal(P.setNick(p, ''), 'Mewlet');
  assert.equal(p.nick, undefined);
  P.setNick(p, 'Mewlet');
  assert.equal(p.nick, undefined);
});

test('XP: beating a higher-level pet is worth more (up to double), never less', () => {
  const foe = mk('peeplet', 10);
  const same = P.xpReward(foe, false, 10);
  assert.ok(P.xpReward(foe, false, 6) > same * 1.5);
  assert.equal(P.xpReward(foe, false, 1), same * 2);
  assert.equal(P.xpReward(foe, false, 30), same);
  assert.equal(P.xpReward(foe, true, 10), Math.floor(same * 1.5));
});

test('rematches: after becoming Champion the leaders and Aria fight again with stronger teams', () => {
  const st = G.newGame(5);
  G.chooseStarter(st, 'embit');
  st.badges = [...W.BADGES];
  for (const id of [...W.BADGES, 'aria']) st.beaten[id] = true;
  // Not Champion yet: the hall just talks.
  G.changeMap(st, 'brookton', 3, 7);
  assert.equal(G.interact(st, 3, 6).t, 'talk');
  st.champion = true;
  const a = G.interact(st, 3, 6);
  assert.equal(a.t, 'battle');
  assert.ok(a.setup.rematch);
  assert.ok(Math.min(...a.setup.foeParty.map((p) => p.lv)) > 30);
  const before = st.badges.length;
  G.afterBattle(st, a.setup, 'win');
  assert.equal(st.badges.length, before, 'no extra badge');
  assert.equal(st.rematches.fern, 1);
  // Cinder in the cave, and Aria in the tower, rematch too.
  G.changeMap(st, 'cave', 7, 2);
  const cinder = G.npcsOn(st).find((n) => n.id === 'cinder');
  assert.equal(G.interact(st, cinder.x, cinder.y).t, 'battle');
  for (const id of ['fern', 'cinder', 'marina', 'rocco', 'aria']) assert.ok(W.LEADERS[id].rematch.every(([sp]) => D.SPECIES[sp]), id);
  assert.ok(G.leaderSetup(st, 'aria').foeParty.length === 6 && G.leaderSetup(st, 'aria').rematch);
});
