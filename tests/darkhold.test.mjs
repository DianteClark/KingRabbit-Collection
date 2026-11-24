// Darkhold: dungeon generation, light and sight, combat, items, monster behaviour, saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/darkhold/logic/', import.meta.url).href;
const G = await import(L + 'game.js');
const Gen = await import(L + 'gen.js');
const D = await import(L + 'data.js');
const F = await import(L + 'fov.js');

const { W, H } = Gen;
const idx = (x, y) => y * W + x;

function stepsFrom(f, sx, sy) {
  const d = new Map([[idx(sx, sy), 0]]);
  const q = [[sx, sy]];
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const i = idx(x + dx, y + dy);
      if (d.has(i) || !Gen.PASSABLE.has(f.t[i])) continue;
      d.set(i, d.get(idx(x, y)) + 1);
      q.push([x + dx, y + dy]);
    }
  }
  return d;
}

/** A run standing in a plain open floor (for behaviour tests). */
function arena({ cls = 'knight', mode = 'normal', size = 20 } = {}) {
  const st = G.newRun({ cls, mode, seed: 99 });
  const f = st.f;
  f.t = new Array(W * H).fill('#');
  for (let y = 1; y <= size; y++) for (let x = 1; x <= size; x++) f.t[idx(x, y)] = '.';
  f.items = []; f.traps = []; f.braziers = []; f.shop = null; f.lit = []; f.deco = [];
  f.rooms = [{ x: 1, y: 1, w: size, h: size }];
  f.seen = new Array(W * H).fill(0);
  st.mons = [];
  st.p.x = 5; st.p.y = 5;
  G.refresh(st);
  return st;
}

function addMon(st, kind, x, y, extra = {}) {
  const m = { id: st.nextId++, kind, x, y, hp: D.MONSTERS[kind].hp, maxHp: D.MONSTERS[kind].hp, st: 'hunt', tx: null, ty: null, lx: st.p.x, ly: st.p.y, chase: 20, energy: 0, fx: {}, gold: 0, disguised: false, cd: 0, vet: 0, ...extra };
  st.mons.push(m);
  G.refresh(st);
  return m;
}

test('every floor is connected and its stairs can be reached without secret doors', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let depth = 1; depth <= D.BOSS_DEPTH; depth++) {
      const f = Gen.generateFloor(seed, depth);
      const all = Gen.reachable(f, f.start.x, f.start.y, { secrets: true });
      const shopAt = f.shop ? idx(f.shop.x, f.shop.y) : -1;
      for (let i = 0; i < W * H; i++) {
        const c = f.t[i];
        if (i === shopAt) continue;
        if (Gen.PASSABLE.has(c) || c === 'S') assert.ok(all.has(i), `seed ${seed} depth ${depth}: cell ${i % W},${Math.floor(i / W)} is cut off`);
      }
      const open = Gen.reachable(f, f.start.x, f.start.y, { secrets: false });
      if (depth < D.BOSS_DEPTH) {
        assert.equal(f.t[idx(f.stairs.x, f.stairs.y)], '>');
        assert.ok(open.has(idx(f.stairs.x, f.stairs.y)), `seed ${seed} depth ${depth}: stairs need a secret door`);
      } else {
        assert.ok(f.boss);
        assert.ok(f.monsters.some((m) => m.kind === 'king'));
        const king = f.monsters.find((m) => m.kind === 'king');
        assert.ok([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => open.has(idx(king.x + dx, king.y + dy))), 'the hall can be reached');
      }
      // Things stand on open floor, and monsters never start next to you.
      for (const it of f.items) assert.ok(Gen.PASSABLE.has(f.t[idx(it.x, it.y)]), 'item on floor');
      const walk = stepsFrom(f, f.start.x, f.start.y);
      for (const m of f.monsters) {
        assert.ok(Gen.PASSABLE.has(f.t[idx(m.x, m.y)]));
        if (depth < D.BOSS_DEPTH) assert.ok((walk.get(idx(m.x, m.y)) ?? 99) >= 8, 'monster too close to the start');
      }
      for (const b of f.braziers) assert.equal(f.t[idx(b.x, b.y)], 'B');
      if (D.SHOP_DEPTHS.includes(depth)) {
        assert.ok(f.shop, `seed ${seed}: shop missing on floor ${depth}`);
        const s = f.shop;
        assert.ok([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => open.has(idx(s.x + dx, s.y + dy))), 'merchant can be reached');
      }
    }
  }
});

test('floors depend only on the seed and depth (daily runs match)', () => {
  const a = Gen.generateFloor(G.dailySeed('2026-11-24'), 4);
  const b = Gen.generateFloor(G.dailySeed('2026-11-24'), 4);
  assert.deepEqual(a, b);
  const c = Gen.generateFloor(G.dailySeed('2026-11-25'), 4);
  assert.notDeepEqual(a.t, c.t);
  // Difficulty never changes the dungeon or the loot.
  const easy = G.newRun({ seed: 5, skill: 0 });
  const hard = G.newRun({ seed: 5, skill: 1 });
  assert.deepEqual(easy.f.t, hard.f.t);
  assert.deepEqual(easy.f.items, hard.f.items);
  assert.deepEqual(easy.mons.map((m) => [m.kind, m.x, m.y, m.hp]), hard.mons.map((m) => [m.kind, m.x, m.y, m.hp]));
  assert.ok(G.tuneFor(1).wake > G.tuneFor(0).wake && G.tuneFor(1).hesitate < G.tuneFor(0).hesitate);
});

test('field of view: walls block sight, open ground does not', () => {
  const grid = (x, y) => x === 5 && y >= 0 && y <= 9; // a wall at x = 5
  const seen = F.fov(12, 10, grid, 2, 5, 8, () => {});
  assert.ok(seen.has(5 * 12 + 4), 'next to the wall');
  assert.ok(seen.has(5 * 12 + 5), 'the wall itself');
  assert.ok(!seen.has(5 * 12 + 7), 'behind the wall');
  assert.ok(F.los(() => false, 0, 0, 7, 3));
  assert.ok(!F.los(grid, 2, 5, 8, 5));
});

test('the torch shrinks as it burns, and darkness hides monsters until they are close', () => {
  const st = arena();
  st.p.fuel = D.MAX_FUEL;
  assert.equal(G.torchRadius(st), 5);
  st.p.fuel = D.MAX_FUEL * 0.3;
  assert.equal(G.torchRadius(st), 3);
  st.p.fuel = 0;
  assert.equal(G.torchRadius(st), 1);
  const lantern = arena({ mode: 'lantern' });
  lantern.p.fuel = 0;
  assert.equal(G.torchRadius(lantern), 3, 'Lantern mode gives more light');

  st.p.fuel = D.MAX_FUEL * 0.3; // radius 3
  const far = addMon(st, 'rat', 5, 11, { st: 'wander' });
  assert.ok(!G.canSeeMon(st, far), 'a monster out in the dark is hidden');
  far.y = 7; G.refresh(st);
  assert.ok(G.canSeeMon(st, far), 'inside the torchlight it shows');
  // Burning down over time.
  const before = st.p.fuel;
  for (let i = 0; i < 20; i++) G.act(st, { type: 'wait' });
  assert.ok(st.p.fuel < before);
});

test('a lit brazier lights its area from afar and feeds the torch once', () => {
  const st = arena();
  st.f.t[idx(15, 15)] = 'B';
  st.f.braziers.push({ x: 15, y: 15, lit: false, fed: false });
  st.p.x = 14; st.p.y = 15; st.p.fuel = 100;
  G.refresh(st);
  G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(st.f.braziers[0].lit);
  assert.ok(st.p.fuel >= 200, 'fed the torch');
  assert.equal(st.p.x, 14, 'braziers block the way');
  st.p.x = 5; st.p.y = 15; st.p.fuel = 30; // torch radius 2: (17,15) is far outside it
  G.refresh(st);
  assert.ok(G.view(st).vis[idx(17, 15)], 'brazier light is visible from across the room');
});

test('combat: bumping attacks, kills give XP, a level up offers three perks', () => {
  const st = arena();
  const m = addMon(st, 'rat', 6, 5);
  let guard = 0;
  while (m.hp > 0 && guard++ < 30) G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(m.hp <= 0, 'the rat dies');
  assert.equal(st.p.x, 5, 'attacking does not move you');
  assert.equal(st.stats.kills, 1);
  assert.ok(st.p.xp > 0);
  st.p.xp = D.XP_FOR[2] - 1;
  const m2 = addMon(st, 'rat', 6, 5);
  guard = 0;
  while (m2.hp > 0 && guard++ < 30) G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.equal(st.p.lvl, 2);
  assert.equal(st.levelUp.choices.length, 3);
  // Nothing else happens until a perk is chosen.
  const turn = st.turn;
  G.act(st, { type: 'wait' });
  assert.equal(st.turn, turn);
  const hp = G.maxHp(st);
  st.levelUp.choices = ['tough', 'brawler', 'stalwart'];
  G.act(st, { type: 'perk', id: 'tough' });
  assert.equal(st.levelUp, null);
  assert.equal(G.maxHp(st), hp + 8);
});

test('sneak attacks: sleeping monsters take extra damage, rogues triple', () => {
  const st = arena({ cls: 'rogue' });
  st.p.eq.melee = { k: 'melee', id: 'dagger', e: 0 };
  const m = addMon(st, 'ogre', 6, 5, { st: 'sleep', hp: 200, maxHp: 200 });
  G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(200 - m.hp >= 4, 'a sneak attack always hits hard');
  assert.equal(m.st, 'hunt', 'and wakes it up');
});

test('potions and scrolls are unknown until used, then known for the run', () => {
  const st = arena();
  st.known.potion = {};
  st.p.inv = [{ k: 'potion', id: 'healing', n: 2 }, { k: 'scroll', id: 'mapping', n: 1 }];
  const name = G.itemName(st, st.p.inv[0]);
  assert.ok(!name.includes('Healing'), `unknown potion shows its colour (${name})`);
  st.p.hp = 5;
  G.act(st, { type: 'use', i: 0 });
  assert.ok(st.p.hp > 5);
  assert.ok(st.known.potion.healing);
  assert.equal(G.itemName(st, st.p.inv[0]), 'Potion of Healing');
  // Scroll of Mapping reveals the floor, its secret doors and traps.
  st.f.t[idx(20, 21)] = 'S';
  st.f.traps.push({ x: 10, y: 10, type: 'spike', found: false });
  G.act(st, { type: 'use', i: 1 });
  assert.equal(st.f.t[idx(20, 21)], '+');
  assert.ok(st.f.traps[0].found);
  assert.ok(st.f.seen[idx(18, 18)]);
});

test('equipment swaps in and out of the bag; the bag holds twelve things', () => {
  const st = arena();
  st.p.inv = [{ k: 'melee', id: 'axe', e: 1 }];
  G.act(st, { type: 'use', i: 0 });
  assert.equal(st.p.eq.melee.id, 'axe');
  assert.equal(st.p.inv[0].id, 'longsword');
  st.p.inv = [];
  for (let i = 0; i < D.BAG_SIZE; i++) assert.ok(G.addToBag(st, { k: 'ring', id: 'light' }));
  assert.ok(!G.addToBag(st, { k: 'ring', id: 'might' }), 'bag full');
  assert.ok(G.addToBag(st, { k: 'gold', id: 'gold', n: 10 }), 'gold always fits');
  // Potions stack.
  st.p.inv = [{ k: 'potion', id: 'sight', n: 1 }];
  G.addToBag(st, { k: 'potion', id: 'sight', n: 1 });
  assert.equal(st.p.inv.length, 1);
  assert.equal(st.p.inv[0].n, 2);
});

test('ghosts drift through walls; shades will not step into bright light', () => {
  const st = arena();
  for (let y = 1; y <= 20; y++) st.f.t[idx(8, y)] = '#'; // a solid wall between
  const ghost = addMon(st, 'ghost', 10, 5);
  st.tune = { ...st.tune, hesitate: 0 };
  for (let i = 0; i < 4; i++) G.act(st, { type: 'wait' });
  assert.ok(ghost.x < 10, `the ghost came through the wall (x=${ghost.x})`);

  const st2 = arena();
  st2.p.fuel = D.MAX_FUEL; // bright core radius 3
  st2.tune = { ...st2.tune, hesitate: 0 };
  const shade = addMon(st2, 'shade', 5, 12);
  for (let i = 0; i < 12; i++) {
    G.act(st2, { type: 'wait' });
    st2.p.fuel = D.MAX_FUEL;
    G.refresh(st2);
    assert.ok(!G.view(st2).bright[idx(shade.x, shade.y)] || i === 0, 'stays out of the bright light');
  }
  assert.ok(Math.hypot(shade.x - 5, shade.y - 5) > 3, 'keeps its distance');
  // With the torch out it closes in and attacks.
  st2.p.fuel = 0;
  const hp = st2.p.hp;
  for (let i = 0; i < 30 && st2.p.hp === hp; i++) { G.act(st2, { type: 'wait' }); st2.p.fuel = 0; }
  assert.ok(st2.p.hp < hp, 'in the dark the shade attacks');
});

test('slimes split, archers shoot from range, imps steal gold, mimics hide', () => {
  const st = arena();
  const slime = addMon(st, 'slime', 6, 5, { hp: 30, maxHp: 30 });
  let guard = 0;
  while (st.mons.length === 1 && guard++ < 20) G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(st.mons.length >= 2, 'the slime split');
  assert.ok(st.mons.every((m) => m.kind === 'slime'));
  void slime;

  const st2 = arena();
  st2.tune = { ...st2.tune, fire: 1, hesitate: 0 };
  addMon(st2, 'archer', 5, 9);
  const hp = st2.p.hp;
  let shots = 0;
  for (let i = 0; i < 12; i++) { const ev = G.act(st2, { type: 'wait' }); shots += ev.filter((e) => e.t === 'shot' && e.hostile).length; st2.p.hp = hp; }
  assert.ok(shots >= 3, `archer shot ${shots} times`);

  const st3 = arena();
  st3.p.gold = 100;
  st3.p.eq.armor = null;
  const imp = addMon(st3, 'imp', 6, 5);
  for (let i = 0; i < 40 && !imp.gold; i++) { G.act(st3, { type: 'wait' }); st3.p.hp = 30; if (imp.hp <= 0) break; }
  assert.ok(imp.gold > 0 && st3.p.gold < 100, 'the imp stole gold');
  assert.ok(Math.abs(imp.x - st3.p.x) + Math.abs(imp.y - st3.p.y) >= 8, 'and blinked away');

  const st4 = arena();
  const mimic = addMon(st4, 'mimic', 6, 5, { disguised: true, st: 'wander' });
  for (let i = 0; i < 5; i++) G.act(st4, { type: 'wait' });
  assert.equal(st4.p.hp, G.maxHp(st4), 'a disguised mimic waits');
  assert.equal(G.monsterInfo(st4, mimic).name, 'Chest');
  G.act(st4, { type: 'move', dx: 1, dy: 0 });
  assert.ok(!mimic.disguised);
});

test('sleepers stay asleep far away; a watcher shrieks and wakes the floor', () => {
  const st = arena();
  const sk = addMon(st, 'skeleton', 5, 15, { st: 'sleep' });
  for (let i = 0; i < 30; i++) G.act(st, { type: 'wait' });
  assert.equal(sk.st, 'sleep');
  addMon(st, 'watcher', 5, 9, { st: 'wander' });
  const ev = G.act(st, { type: 'wait' });
  assert.ok(ev.some((e) => e.t === 'shriek'));
  assert.equal(sk.st, 'hunt');
});

test('traps: hidden until found, spikes hurt, searching finds secret doors', () => {
  const st = arena();
  st.f.traps.push({ x: 6, y: 5, type: 'spike', found: false });
  const hp = st.p.hp;
  G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(st.p.hp < hp);
  assert.ok(st.f.traps[0].found);
  st.f.t[idx(6, 4)] = '#';
  st.f.t[idx(6, 3)] = '.';
  st.f.t[idx(7, 4)] = 'S';
  let found = false;
  for (let i = 0; i < 25 && !found; i++) { G.act(st, { type: 'search' }); found = st.f.t[idx(7, 4)] === '+'; }
  assert.ok(found, 'searching finds the secret door');
});

test('the shop sells (and names) things; selling gives gold back', () => {
  const st = arena();
  st.f.shop = { x: 6, y: 5, room: 0, stock: [{ item: { k: 'potion', id: 'haste', n: 1 }, sold: false }] };
  st.p.gold = 100;
  const ev = G.act(st, { type: 'move', dx: 1, dy: 0 });
  assert.ok(ev.some((e) => e.t === 'shop'));
  assert.equal(st.turn, 0, 'talking to the merchant takes no time');
  G.act(st, { type: 'buy', i: 0 });
  assert.equal(st.p.gold, 100 - D.POTIONS.haste.price);
  assert.ok(st.known.potion.haste);
  assert.ok(st.f.shop.stock[0].sold);
  const i = st.p.inv.findIndex((it) => it.id === 'haste');
  G.act(st, { type: 'sell', i });
  assert.ok(st.p.gold > 100 - D.POTIONS.haste.price);
});

test('saving: a run survives JSON and plays on exactly the same', () => {
  const a = G.newRun({ cls: 'mage', seed: 1234 });
  const moves = [];
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let i = 0; i < 60; i++) moves.push({ type: 'move', dx: dirs[i % 4][0], dy: dirs[(i >> 2) % 4][1] || dirs[i % 4][1] });
  for (const m of moves.slice(0, 30)) G.act(a, m);
  const b = JSON.parse(JSON.stringify(a));
  for (const m of moves.slice(30)) { G.act(a, m); G.act(b, m); }
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('the Hollow King is only really hurt in brazier light', () => {
  const st = G.newRun({ seed: 7 });
  G.enterFloor(st, D.BOSS_DEPTH);
  const king = st.mons.find((m) => m.kind === 'king');
  st.mons = [king];
  king.st = 'hunt';
  st.p.x = king.x; st.p.y = king.y + 1;
  G.refresh(st);
  assert.ok(!G.kingLit(st, king));
  const hp0 = king.hp;
  st.p.fx.blaze = 0;
  for (let i = 0; i < 6; i++) { G.act(st, { type: 'move', dx: 0, dy: -1 }); st.p.hp = 99; }
  const dark = hp0 - king.hp;
  st.f.lit.push(idx(king.x, king.y));
  const hp1 = king.hp;
  for (let i = 0; i < 6; i++) { G.act(st, { type: 'move', dx: 0, dy: -1 }); st.p.hp = 99; if (st.over) break; }
  const lit = hp1 - king.hp;
  assert.ok(lit > dark * 2, `lit ${lit} vs dark ${dark}`);
});
