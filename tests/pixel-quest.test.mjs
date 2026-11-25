import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../games/pixel-quest/logic/game.js';
import * as B from '../games/pixel-quest/logic/battle.js';
import { MAPS, LANDMARKS, GATES, tileDef, chestsOf, stairsOf, leversOf, locksOf, torchesOf, signsOf, npcSpots } from '../games/pixel-quest/logic/maps.js';
import { CLASSES, SKILLS, ITEMS, GEAR, MONSTERS, MSKILLS, AREAS, SHOPS, PALS, BIG_SPRITES, KEY_ITEMS, MAX_LEVEL } from '../games/pixel-quest/logic/data.js';
import { xpFor, levelFromXp, gainXp, statsOf, newMember, canEquip, skillsAt, monsterStats } from '../games/pixel-quest/logic/stats.js';
import { makeRng } from '../games/pixel-quest/logic/rng.js';
import { dailySetup, dailyScore, breather, WAVES } from '../games/pixel-quest/logic/daily.js';

const ATLAS = JSON.parse(readFileSync(new URL('../games/pixel-quest/assets/atlas.json', import.meta.url)));

// ------------------------------------------------------------------ data

test('data: every reference points at something real', () => {
  for (const [cls, c] of Object.entries(CLASSES)) {
    for (const [s, lv] of c.skills) { assert.ok(SKILLS[s], `${cls} skill ${s}`); assert.ok(lv >= 1 && lv <= MAX_LEVEL); }
    assert.ok(GEAR[c.gear.w] && GEAR[c.gear.a]);
    assert.ok(canEquip(cls, c.gear.w) && canEquip(cls, c.gear.a), `${cls} starting gear`);
    for (const f of [0, 1, 2, 5, 6, 7, 8, 9]) assert.ok(ATLAS[`c${c.ch}_${f}`], `frame c${c.ch}_${f}`);
  }
  for (const [id, m] of Object.entries(MONSTERS)) {
    if (typeof m.spr === 'string') assert.ok(BIG_SPRITES[m.spr], id); else assert.ok(m.spr[0] < 9 && m.spr[1] < 8, id);
    assert.ok(m.pal in PALS, `${id} palette`);
    for (const [s] of m.skills || []) assert.ok(MSKILLS[s], `${id} skill ${s}`);
    if (m.steal) assert.ok(ITEMS[m.steal], `${id} steal`);
    if (m.drop) assert.ok(ITEMS[m.drop[0]], `${id} drop`);
  }
  for (const a of Object.values(AREAS)) for (const [id] of a.mons) assert.ok(MONSTERS[id], id);
  for (const s of Object.values(SHOPS)) for (const id of s.items) assert.ok(ITEMS[id] || GEAR[id], id);
  for (const it of [...Object.values(ITEMS), ...Object.values(GEAR), ...Object.values(KEY_ITEMS)]) assert.ok(ATLAS[`i_${it.icon}`], `icon ${it.icon}`);
  for (const g of Object.values(GEAR)) assert.match(g.who, /^[WCTM]+$/);
});

test('data: every shop gear item is affordable in its town and beats what came before', () => {
  for (const id of SHOPS.bw_gear.items) assert.ok(GEAR[id].price <= 200, id);
  assert.ok(GEAR.iron.atk > GEAR.bronze.atk && GEAR.steel.atk > GEAR.iron.atk && GEAR.knight.atk > GEAR.steel.atk);
});

// ------------------------------------------------------------------ stats

test('stats: xp curve, levels and skills', () => {
  for (let lv = 2; lv <= MAX_LEVEL; lv++) assert.ok(xpFor(lv) > xpFor(lv - 1));
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(xpFor(10)), 10);
  assert.equal(levelFromXp(xpFor(10) - 1), 9);
  const m = newMember('mage');
  assert.deepEqual(skillsAt('mage', 1), ['fire']);
  const ups = gainXp(m, xpFor(6));
  assert.equal(m.lv, 6);
  assert.ok(ups.some((u) => u.learned.includes('Sleep')));
  assert.ok(ups.some((u) => u.learned.includes('Frost')));
  assert.equal(m.hp, statsOf(m).hp, 'level-ups add HP to a healthy hero');
  const capped = newMember('warrior', MAX_LEVEL);
  assert.deepEqual(gainXp(capped, 99999), []);
});

test('stats: gear changes stats, and only the right classes can use it', () => {
  const m = newMember('warrior');
  const before = statsOf(m).atk;
  m.eq.w = 'iron';
  assert.equal(statsOf(m).atk, before - GEAR.sword.atk + GEAR.iron.atk);
  assert.ok(!canEquip('mage', 'iron'));
  assert.ok(canEquip('cleric', 'mace'));
  assert.ok(!canEquip('warrior', 'robe'));
});

test('stats: story difficulty makes monsters weaker but not bosses trivial', () => {
  const n = monsterStats('wolf', 1); const s = monsterStats('wolf', 0.72);
  assert.ok(s.hp < n.hp && s.atk < n.atk);
  assert.ok(monsterStats('vesper', 0.72).hp > 1000);
});

// ------------------------------------------------------------------ battle

function party(classes = ['warrior', 'cleric', 'thief', 'mage'], lv = 10) {
  return classes.map((c) => newMember(c, lv));
}

test('battle: a strong party beats a weak group and gets rewards', () => {
  const p = party(['warrior', 'cleric'], 8);
  const bag = {};
  const b = B.createBattle({ party: p, enemies: ['ooze', 'ooze'], bag, rng: makeRng(3) });
  assert.equal(b.foes[0].name, 'Ooze A');
  let n = 0;
  while (!b.over && n++ < 50) B.runRound(b, B.autoCommands(b));
  assert.equal(b.over, 'win');
  const r = B.finish(b);
  assert.ok(r.xp > 0 && r.gold > 0);
});

test('battle: commands, guard, run, steal and items', () => {
  const p = party(['warrior', 'cleric', 'thief', 'mage'], 12);
  const bag = { herb: 2 };
  const b = B.createBattle({ party: p, enemies: ['wolf'], bag, rng: makeRng(9) });
  p[0].hp = 10; b.allies[0].hp = 10;
  const ev = B.runRound(b, [{ type: 'guard' }, { type: 'item', item: 'herb', target: { side: 'ally', idx: 0 } }, { type: 'skill', skill: 'steal', target: { side: 'foe', idx: 0 } }, { type: 'attack', target: { side: 'foe', idx: 0 } }]);
  assert.equal(bag.herb, 1, 'herb used up');
  assert.ok(ev.some((e) => e.t === 'heal' && e.idx === 0));
  assert.ok(ev.some((e) => e.t === 'fx' && e.kind === 'steal'));
  // Bosses can't be run from.
  const boss = B.createBattle({ party: party(), enemies: ['stonehide'], bag: {}, rng: makeRng(1), boss: true });
  assert.equal(boss.canRun, false);
  const ev2 = B.runRound(boss, boss.allies.map(() => ({ type: 'run' })));
  assert.ok(ev2.some((e) => e.t === 'msg' && /no escape/.test(e.text)));
  assert.notEqual(boss.over, 'fled');
});

test('battle: sleep skips turns, poison ticks and stays after battle', () => {
  const p = party(['warrior', 'mage'], 15);
  const b = B.createBattle({ party: p, enemies: ['ooze'], bag: {}, rng: makeRng(5) });
  b.allies[0].st.sleep = 2;
  b.allies[1].st.poison = 99;
  const hp = b.allies[1].hp;
  const ev = B.runRound(b, [null, { type: 'guard' }]);
  assert.ok(ev.some((e) => e.t === 'msg' && /asleep/.test(e.text)));
  assert.ok(b.allies[1].hp < hp, 'poison hurts');
  b.over = 'fled';
  B.finish(b);
  assert.equal(p[1].st, 'poison');
});

test('battle: silence blocks spells but not techniques', () => {
  const p = party(['warrior', 'mage'], 10);
  const b = B.createBattle({ party: p, enemies: ['crab'], bag: {}, rng: makeRng(2) });
  b.allies[1].st.silence = 3; b.allies[0].st.silence = 3;
  assert.equal(B.skillProblem(b, b.allies[1], 'fire'), 'Silenced');
  assert.equal(B.skillProblem(b, b.allies[0], 'slash'), null);
});

test('battle: Vesper has a second form', () => {
  const p = party(undefined, 30);
  for (const m of p) m.eq = { w: m.cls === 'warrior' ? 'sunblade' : m.cls === 'thief' ? 'fang' : 'crystal', a: m.cls === 'mage' || m.cls === 'cleric' ? 'silk' : 'mithril', c: null };
  const b = B.createBattle({ party: p, enemies: ['vesper'], bag: { tonic: 9, ether: 9 }, rng: makeRng(4), boss: true, phase2: 'unbound' });
  b.foes[0].hp = 1;
  let phased = false;
  let n = 0;
  while (!b.over && n++ < 200) { const ev = B.runRound(b, B.autoCommands(b)); if (ev.some((e) => e.t === 'phase')) phased = true; }
  assert.ok(phased);
  assert.equal(b.foes[0].id, 'unbound');
});

test('battle: auto commands are always legal', () => {
  const rng = makeRng(7);
  for (let t = 0; t < 30; t++) {
    const p = party(undefined, 5 + (t % 20));
    const area = Object.keys(AREAS)[t % 8];
    const enemies = Array.from({ length: 1 + (t % 4) }, () => rng.weighted(AREAS[area].mons));
    const b = B.createBattle({ party: p, enemies, bag: { herb: 3, tonic: 2, ether: 1, lifeleaf: 1 }, rng });
    let n = 0;
    while (!b.over && n++ < 100) {
      const cmds = B.autoCommands(b);
      cmds.forEach((c, i) => {
        if (!c) return;
        if (c.type === 'skill') assert.equal(B.skillProblem(b, b.allies[i], c.skill), null, c.skill);
        if (c.type === 'item') assert.equal(B.itemProblem(b, c.item), null, c.item);
      });
      B.runRound(b, cmds);
    }
    assert.ok(b.over);
  }
});

// ------------------------------------------------------------------ maps

test('maps: rows line up and every object has data', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    const w = m.tiles[0].length;
    m.tiles.forEach((r, y) => assert.equal(r.length, w, `${id} row ${y}`));
    if (m.kind === 'world') continue;
    assert.equal(chestsOf(m).length, (m.chests || []).length, `${id} chests`);
    assert.equal(stairsOf(m).length, (m.stairs || []).length, `${id} stairs`);
    assert.equal(leversOf(m).length, (m.levers || []).length, `${id} levers`);
    assert.equal(locksOf(m).length, (m.locks || []).length, `${id} locks`);
    assert.ok(signsOf(m).length <= (m.signs || []).length, `${id} signs`);
    if (torchesOf(m).length) assert.ok(m.torches && m.red, `${id} torches`);
    for (const l of Object.keys(npcSpots(m))) assert.ok(m.npcs[l], `${id} npc ${l}`);
    for (const l of Object.keys(m.npcs || {})) assert.ok(npcSpots(m)[l], `${id} npc ${l} placed`);
    if (m.tiles.some((r) => /[RU]/.test(r))) assert.ok(m.bar || m.red, `${id} barrier flag`);
    for (const s of m.stairs || []) {
      const t = MAPS[s.to];
      assert.ok(t, `${id} stairs to ${s.to}`);
      assert.ok(tileDef(t, t.tiles[s.at[1]][s.at[0]]).walk, `${id} -> ${s.to} arrival ${s.at}`);
      assert.ok(!tileDef(t, t.tiles[s.at[1]][s.at[0]]).stairs, `${id} -> ${s.to} arrives on stairs`);
    }
    if (m.world) assert.ok(MAPS.world.tiles[m.world[1]][m.world[0]] !== '~', `${id} world exit`);
  }
  for (const [k, L] of Object.entries(LANDMARKS)) {
    const t = MAPS[L.to];
    assert.ok(tileDef(t, t.tiles[L.at[1]][L.at[0]]).walk, `landmark ${k} arrival`);
    assert.ok(MAPS.world.tiles.some((r) => r.includes(k)), `landmark ${k} on the world map`);
    assert.ok(ATLAS[L.ground] && (!L.over || ATLAS[L.over]), `landmark ${k} art`);
  }
});

test('maps: every tile frame exists in the atlas', () => {
  for (const m of Object.values(MAPS)) {
    for (const f of [m.wall, m.floor, m.door, m.door?.replace('door', 'lock')]) if (f) assert.ok(ATLAS[f], `${m.id} ${f}`);
    for (const row of m.tiles) for (const ch of row) {
      const d = tileDef(m, ch);
      for (const f of [d.g, d.o]) if (f && !f.startsWith('$') && !['water', 'dark', 'lava'].includes(f)) assert.ok(ATLAS[f], `${m.id} '${ch}' ${f}`);
    }
  }
});

/** Every (x, y, switch) a party can reach on one map from a start, with the given flags. */
function reach(mapId, start, flags, party = ['warrior', 'cleric', 'thief', 'mage']) {
  const base = G.newGame({ seed: 1 });
  base.party = party.map((c) => newMember(c));
  base.flags = { ...flags };
  const m = MAPS[mapId];
  const seen = new Set();
  const out = [];
  const q = [{ x: start[0], y: start[1], sw: !!flags.tw_sw }];
  const key = (n) => `${n.x},${n.y},${n.sw ? 1 : 0}`;
  seen.add(key(q[0]));
  while (q.length) {
    const n = q.shift();
    out.push(n);
    for (const [dx, dy] of Object.values(G.DIRS)) {
      const st = { ...base, map: mapId, x: n.x, y: n.y, flags: { ...base.flags, tw_sw: n.sw }, repel: 1e9, grace: 1e9 };
      const r = G.step(st, dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', () => 1);
      if (!r.moved || st.map !== mapId) continue;
      const nn = { x: st.x, y: st.y, sw: n.sw };
      if (!seen.has(key(nn))) { seen.add(key(nn)); q.push(nn); }
      // The crystal can be used from any neighbouring tile.
    }
    if (m.bar) for (const [dx, dy] of Object.values(G.DIRS)) if (m.tiles[n.y + dy]?.[n.x + dx] === 'Z') { const nn = { ...n, sw: !n.sw }; if (!seen.has(key(nn))) { seen.add(key(nn)); q.push(nn); } }
  }
  return out;
}
const near = (nodes, x, y) => nodes.some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) === 1);
const on = (nodes, x, y) => nodes.some((n) => n.x === x && n.y === y);
const ALL_FLAGS = { quest: true, stonehide: true, galewing: true, pyrescorp: true, barrier: true, mc_lever: true, mc_door: true, mc_cell: true, ec1_torches: true, cs_door: true, cs_l0: true, cs_l1: true, wyvern: true, hive: true };

test('reachability: with the story done, everything on every map can be reached', () => {
  const entries = { mc1: [8, 14], tw1: [7, 7], ec1: [10, 10], cs1: [9, 12], bw: [9, 18], fe: [9, 1], em: [9, 16], fr: [9, 16] };
  for (const [id, m] of Object.entries(MAPS)) {
    if (m.kind === 'world') continue;
    // Arrive from the world, or by any staircase leading here.
    const starts = [];
    if (entries[id]) starts.push(entries[id]);
    for (const other of Object.values(MAPS)) for (const s of other.stairs || []) if (s.to === id) starts.push(s.at);
    const nodes = starts.flatMap((s) => [...reach(id, s, ALL_FLAGS), ...reach(id, s, { ...ALL_FLAGS, tw_sw: true })]);
    chestsOf(m).forEach((c) => assert.ok(near(nodes, c.x, c.y), `${id} chest at ${c.x},${c.y}`));
    for (const [l, p] of Object.entries(npcSpots(m))) assert.ok(near(nodes, p.x, p.y) || near(nodes, p.x, p.y + 2), `${id} npc ${l}`);
    stairsOf(m).forEach((s) => assert.ok(near(nodes, s.x, s.y), `${id} stairs at ${s.x},${s.y}`));
    leversOf(m).forEach((s) => assert.ok(near(nodes, s.x, s.y), `${id} lever`));
    torchesOf(m).forEach((s) => assert.ok(near(nodes, s.x, s.y), `${id} brazier`));
    m.tiles.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'E') assert.ok(near(nodes, x, y), `${id} exit`); }));
  }
});

/** Every (map, x, y, switch) reachable across several maps (stairs included). */
function reachAll(start, flags, maps) {
  const base = G.newGame({ seed: 1 });
  base.party = ['warrior', 'cleric', 'thief', 'mage'].map((c) => newMember(c));
  const key = (n) => `${n.map},${n.x},${n.y},${n.sw ? 1 : 0}`;
  const seen = new Set([key(start)]);
  const q = [start]; const out = [];
  while (q.length) {
    const n = q.shift();
    out.push(n);
    const next = [];
    for (const dir of Object.keys(G.DIRS)) {
      const st = { ...base, map: n.map, x: n.x, y: n.y, flags: { ...flags, tw_sw: n.sw }, repel: 1e9, grace: 1e9 };
      const r = G.step(st, dir, () => 1);
      if (r.moved && maps.includes(st.map)) next.push({ map: st.map, x: st.x, y: st.y, sw: n.sw });
    }
    const m = MAPS[n.map];
    if (m.bar) for (const [dx, dy] of Object.values(G.DIRS)) if (m.tiles[n.y + dy]?.[n.x + dx] === 'Z') next.push({ ...n, sw: !n.sw });
    for (const nn of next) if (!seen.has(key(nn))) { seen.add(key(nn)); q.push(nn); }
  }
  return out;
}

test('reachability: the tower switches never trap you', () => {
  const maps = ['tw1', 'tw2', 'tw3', 'tw4'];
  const all = reachAll({ map: 'tw1', x: 7, y: 7, sw: false }, {}, maps);
  assert.ok(all.some((n) => n.map === 'tw4'), 'the roof can be reached');
  const exit = { map: 'tw1', x: 7, y: 8 };
  // From every state you can get into, the way out is still open.
  const seenOk = new Set();
  for (const n of all) {
    const k = `${n.map},${n.sw}`;
    const from = reachAll(n, {}, maps);
    assert.ok(from.some((f) => f.map === exit.map && Math.abs(f.x - exit.x) + Math.abs(f.y - exit.y) <= 1), `trapped at ${n.map} ${n.x},${n.y} sw=${n.sw}`);
    seenOk.add(k);
  }
  assert.ok(seenOk.size >= 6);
});

test('reachability: gates hold until their story moment, the world opens in order', () => {
  const worldReach = (flags, party) => reach('world', [8, 29], flags, party);
  const at = (k) => { for (let y = 0; y < MAPS.world.tiles.length; y++) { const x = MAPS.world.tiles[y].indexOf(String(k)); if (x >= 0) return [x, y]; } return null; };
  const canEnter = (nodes, k) => { const [x, y] = at(k); return near(nodes, x, y); };
  let n = worldReach({});
  assert.ok(canEnter(n, 1) && canEnter(n, 5));
  assert.ok(!canEnter(n, 2) && !canEnter(n, 6) && !canEnter(n, 3), 'east locked until Stonehide');
  n = worldReach({ stonehide: true });
  assert.ok(canEnter(n, 2) && canEnter(n, 6));
  assert.ok(!canEnter(n, 3), 'desert locked until Galewing');
  n = worldReach({ stonehide: true, galewing: true });
  assert.ok(canEnter(n, 3) && canEnter(n, 7));
  assert.ok(!canEnter(n, 4), 'snow locked until Pyrescorp');
  n = worldReach({ stonehide: true, galewing: true, pyrescorp: true });
  assert.ok(canEnter(n, 4));
  assert.ok(!canEnter(n, 8), 'castle locked until the barrier falls');
  n = worldReach({ stonehide: true, galewing: true, pyrescorp: true, barrier: true });
  assert.ok(canEnter(n, 8));
});

test('reachability: puzzles must be solved to go on', () => {
  // Mole Cave: the stairs need the lever.
  const mc = MAPS.mc1; const sd = stairsOf(mc)[0];
  assert.ok(!near(reach('mc1', [8, 14], { quest: true }), sd.x, sd.y));
  assert.ok(near(reach('mc1', [8, 14], { mc_lever: true }), sd.x, sd.y));
  // Ember Cave: the stairs need the braziers.
  const ec = MAPS.ec1; const es = stairsOf(ec)[0];
  assert.ok(!near(reach('ec1', [10, 10], {}), es.x, es.y));
  assert.ok(near(reach('ec1', [10, 10], { ec1_torches: true }), es.x, es.y));
  // Nightspire: the stairs need the Spire Key door, then both levers.
  const cs = MAPS.cs1; const cst = stairsOf(cs)[0];
  assert.ok(!near(reach('cs1', [9, 12], {}), cst.x, cst.y));
  assert.ok(near(reach('cs1', [9, 12], { cs_door: true }), cst.x, cst.y));
  const n2 = reach('cs2', [10, 7], { cs_l0: true });
  assert.ok(!on(n2, 10, 2) && !near(n2, 10, 2), 'one lever is not enough');
  assert.ok(near(reach('cs2', [10, 7], { cs_l0: true, cs_l1: true }), 10, 2));
});

// ------------------------------------------------------------------ game

test('game: a new game starts in Brightwater and the Elder gives the quest', () => {
  const st = G.newGame({ seed: 5 });
  assert.equal(st.map, 'bw');
  assert.equal(st.party.length, 2);
  // You can't leave before talking to the Elder.
  st.x = 9; st.y = 19; st.face = 'down';
  const r = G.step(st, 'down');
  assert.ok(r.events.some((e) => e.t === 'blocked'));
  const p = npcSpots(MAPS.bw).r;
  st.x = p.x + 1; st.y = p.y; st.face = 'left';
  const a = G.interact(st, p.x, p.y);
  assert.equal(a.do, 'quest');
  const gold = st.gold;
  G.runDo(st, a.do);
  assert.ok(st.flags.quest && st.gold === gold + 100);
  st.x = 9; st.y = 19;
  const r2 = G.step(st, 'down');
  assert.equal(st.map, 'world');
  assert.ok(r2.moved);
});

test('game: talking across a shop counter', () => {
  const st = G.newGame({ seed: 5 });
  const a = npcSpots(MAPS.bw).a;
  st.x = a.x; st.y = a.y + 2; st.face = 'up';
  const act = G.interact(st, a.x, a.y + 1);
  assert.equal(act.t, 'talk');
  assert.equal(act.do, 'inn:bw');
});

test('game: inn, shop, equip and sell', () => {
  const st = G.newGame({ seed: 5 });
  st.gold = 200;
  st.party[0].hp = 1;
  assert.ok(G.rest(st, 6));
  assert.equal(st.party[0].hp, statsOf(st.party[0]).hp);
  assert.ok(G.buy(st, 'bronze'));
  assert.ok(G.equip(st, 0, 'bronze'));
  assert.equal(st.party[0].eq.w, 'bronze');
  assert.equal(st.gear.sword, 1);
  assert.ok(!G.equip(st, 1, 'sword'), 'a cleric cannot use a sword');
  const before = st.gold;
  assert.ok(G.sell(st, 'sword'));
  assert.equal(st.gold, before + 5);
  st.gold = 0;
  assert.ok(!G.buy(st, 'tonic'));
  assert.ok(!G.rest(st, 6));
});

test('game: chests, mimics, levers, locks, braziers and crystals', () => {
  const st = G.newGame({ seed: 5 });
  st.map = 'mc1';
  const before = st.gold;
  assert.equal(G.openChest(st, 0).gold, 80);
  assert.equal(st.gold, before + 80);
  assert.equal(G.openChest(st, 0).text, 'The chest is empty.');
  const mim = G.openChest(st, 3);
  assert.equal(mim.mimic, 'mimic');
  assert.ok(!st.opened['mc1:3'], 'a mimic chest stays shut until beaten');
  G.pullLever(st, 0);
  assert.ok(st.flags.mc_lever);
  st.map = 'ec1';
  G.toggleTorch(st, 0);
  assert.ok(!st.flags.ec1_torches);
  G.toggleTorch(st, 3);
  assert.ok(st.flags.ec1_torches, 'pressing both ends lights all four');
  st.map = 'tw1';
  assert.ok(!G.barOpen(st, MAPS.tw1, 'R') && G.barOpen(st, MAPS.tw1, 'U'));
  G.toggleCrystal(st);
  assert.ok(G.barOpen(st, MAPS.tw1, 'R') && !G.barOpen(st, MAPS.tw1, 'U'));
  // Locks: the thief lock needs Kit, the cell needs the key.
  st.map = 'mc2';
  const [k0, k1] = locksOf(MAPS.mc2);
  assert.equal(G.interact(st, k0.x, k0.y).t, 'msg');
  G.join(st, 'thief');
  assert.equal(G.interact(st, k0.x, k0.y).t, 'unlock');
  assert.equal(G.interact(st, k1.x, k1.y).t, 'msg');
  st.keys.cellkey = true;
  assert.equal(G.interact(st, k1.x, k1.y).t, 'unlock');
});

test('game: joining heroes, wiping and Home Wing', () => {
  const st = G.newGame({ seed: 5 });
  st.party.forEach((m) => gainXp(m, xpFor(8)));
  const m = G.join(st, 'mage');
  assert.equal(m.lv, 8);
  assert.deepEqual(st.party.map((x) => x.cls), ['warrior', 'cleric', 'mage']);
  assert.equal(G.join(st, 'mage'), null);
  st.gold = 101; st.map = 'world'; st.x = 20; st.y = 20;
  st.party.forEach((x) => { x.hp = 0; });
  const r = G.applyWipe(st);
  assert.equal(r.lost, 50);
  assert.equal(st.map, st.lastInn.map);
  assert.ok(st.party.every((x) => x.hp > 0));
  st.difficulty = 'story'; st.gold = 100;
  assert.equal(G.applyWipe(st).lost, 0);
  st.map = 'world'; st.bag.wing = 1;
  assert.ok(G.useItemField(st, 'wing', 0).ok);
  assert.equal(st.map, 'bw');
});

test('game: encounters respect grace steps, repel and party size', () => {
  const st = G.newGame({ seed: 11 });
  st.flags.quest = true; st.map = 'world'; st.x = 8; st.y = 25; st.grace = 0;
  const rng = makeRng(1);
  let battles = 0;
  for (let i = 0; i < 400; i++) {
    const r = G.step(st, i % 2 ? 'up' : 'down', rng);
    for (const e of r.events) if (e.t === 'battle') { battles++; assert.ok(e.enemies.length <= 2, 'two heroes meet small groups'); }
  }
  assert.ok(battles > 5 && battles < 60, `battles ${battles}`);
  st.repel = 300;
  let during = 0;
  for (let i = 0; i < 200; i++) for (const e of G.step(st, i % 2 ? 'up' : 'down', rng).events) if (e.t === 'battle') during++;
  assert.equal(during, 0);
});

test('game: winning a boss sets its flag and gives the Chime', () => {
  const st = G.newGame({ seed: 5 });
  st.map = 'mc2';
  const r = G.applyWin(st, { xp: 100, gold: 50, drops: [] }, { boss: 'stonehide' });
  assert.ok(st.flags.stonehide && st.keys.chime1);
  assert.ok(r.lines.length);
  assert.equal(G.chimesHeld(st), 1);
});

test('game: field spells and items', () => {
  const st = G.newGame({ seed: 5 });
  st.party[0].hp = 5;
  assert.ok(G.castField(st, 1, 'heal', 0).ok);
  assert.ok(st.party[0].hp > 5);
  assert.ok(!G.castField(st, 0, 'heal', 0).ok, 'the warrior has no Heal');
  st.party[0].hp = 0;
  assert.ok(!G.useItemField(st, 'herb', 0).ok, 'herbs do not revive');
  st.bag.lifeleaf = 1;
  assert.ok(G.useItemField(st, 'lifeleaf', 0).ok);
  assert.ok(st.party[0].hp > 0);
});

test('game: the save is plain JSON and round-trips', () => {
  const st = G.newGame({ seed: 5 });
  G.runDo(st, 'quest');
  const copy = JSON.parse(JSON.stringify(st));
  assert.deepEqual(copy, st);
  assert.match(G.goal(copy), /Mole Cave/);
});

// ------------------------------------------------------------------ daily

test('daily: the same seed gives the same arena, scores add up', () => {
  const a = dailySetup(1234); const b = dailySetup(1234); const c = dailySetup(999);
  assert.deepEqual(a.waves, b.waves);
  assert.equal(a.waves.length, WAVES);
  assert.ok(JSON.stringify(a) !== JSON.stringify(c));
  assert.ok(MONSTERS[a.waves[2][0]].boss && MONSTERS[a.waves[4][0]].boss);
  const p = a.party;
  p[0].hp = 1;
  breather(p);
  assert.ok(p[0].hp > 1);
  assert.equal(dailyScore({ cleared: 2, party: p, rounds: 10 }), 2000);
  assert.ok(dailyScore({ cleared: 5, party: p, rounds: 10 }) > 5000);
});

test('daily: the auto battler can clear the arena most days', () => {
  let cleared = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const d = dailySetup(seed);
    const rng = makeRng(seed);
    let wave = 0;
    for (; wave < WAVES; wave++) {
      const b = B.createBattle({ party: d.party, enemies: d.waves[wave], bag: d.bag, rng, boss: true });
      let n = 0;
      while (!b.over && n++ < 300) B.runRound(b, B.autoCommands(b));
      B.finish(b);
      if (b.over !== 'win') break;
      breather(d.party);
    }
    if (wave === WAVES) cleared++;
  }
  assert.ok(cleared >= 4 && cleared <= 12, `cleared ${cleared}/12`);
});
