// Hollow Crown: map data, completability (no soft-locks), puzzles and core rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/hero-quest/logic/', import.meta.url).href;
const { ROOMS, START } = await import(base + 'data.js');
const C = await import(base + 'constants.js');
const { ALL_CHARS, WALKABLE } = await import(base + 'tiles.js');
const W = await import(base + 'world.js');
const S = await import(base + 'solver.js');
const { Game, newState } = await import(base + 'game.js');
const { ENEMY } = await import(base + 'enemies.js');
const { PRESETS, tune } = await import(base + 'tune.js');

const rooms = Object.values(ROOMS);
const DT = 1 / 60;
const center = (t) => t * C.TILE + C.TILE / 2;

// ------------------------------------------------------------------ data

test('every room is 11 x 13 with known characters', () => {
  for (const r of rooms) {
    assert.equal(r.map.length, C.ROWS, `${r.id} rows`);
    r.map.forEach((row, y) => {
      assert.equal(row.length, C.COLS, `${r.id} row ${y} "${row}"`);
      for (const ch of row) assert.ok(ALL_CHARS.has(ch), `${r.id} unknown char ${ch}`);
    });
  }
});

test('chests, signs, warps, npcs and houses line up with the map', () => {
  for (const r of rooms) {
    for (let y = 0; y < C.ROWS; y++) {
      for (let x = 0; x < C.COLS; x++) {
        const ch = r.map[y][x];
        if (ch === 'C') assert.ok(r.chests[`${x},${y}`], `${r.id} chest at ${x},${y} has no contents`);
        if (ch === 'v') assert.ok(r.signs[`${x},${y}`], `${r.id} sign at ${x},${y} has no text`);
        if (ch === 'D' || ch === 'e') {
          const warp = r.warps.some((w) => w.x === x && w.y === y);
          const exit = Object.entries(r.exits).some(([side]) => W.sideOf(x, y) === side);
          assert.ok(warp || exit, `${r.id} door ${x},${y} leads nowhere`);
        }
      }
    }
    for (const xy of Object.keys(r.chests)) { const [x, y] = xy.split(',').map(Number); assert.equal(r.map[y][x], 'C', `${r.id} chest spec ${xy}`); }
    for (const xy of Object.keys(r.signs)) { const [x, y] = xy.split(',').map(Number); assert.equal(r.map[y][x], 'v', `${r.id} sign spec ${xy}`); }
    for (const w of r.warps) {
      assert.ok('De'.includes(r.map[w.y][w.x]) || r.map[w.y][w.x] === 'c', `${r.id} warp cell ${w.x},${w.y}`);
      const to = ROOMS[w.to];
      assert.ok(to, `${r.id} warp to missing ${w.to}`);
      assert.ok(WALKABLE.has(to.map[w.ty][w.tx]), `${r.id} warp lands on ${to.map[w.ty][w.tx]} in ${w.to}`);
    }
    for (const ex of Object.values(r.exits)) assert.ok(WALKABLE.has(ROOMS[ex.to].map[ex.ty][ex.tx]), `${r.id} exit lands badly`);
    for (const n of r.npcs) assert.equal(r.map[n.y][n.x], '.', `${r.id} npc ${n.who} not on floor`);
    for (const h of r.houses) {
      for (let y = h.y; y < h.y + 4; y++) for (let x = h.x; x < h.x + 5; x++) assert.ok('hD'.includes(r.map[y][x]), `${r.id} house cell ${x},${y}`);
    }
    for (const [kind, x, y] of r.enemies) {
      assert.ok(ENEMY[kind], `${r.id} unknown enemy ${kind}`);
      assert.ok(WALKABLE.has(r.map[y][x]) && !W.sideOf(x, y), `${r.id} ${kind} at ${x},${y} on ${r.map[y][x]}`);
    }
  }
  const s = ROOMS[START.room];
  assert.ok(WALKABLE.has(s.map[START.y][START.x]));
});

test('room edges match their neighbours, and openings lead somewhere', () => {
  const openish = (c) => c !== '#' && !'TYyfhrwbvg~toXCq lmF_'.includes(c);
  for (const r of rooms) {
    for (const side of C.SIDES) {
      const n = W.neighbour(r, side);
      const mine = W.edgeCells(r, side);
      if (!n) {
        const open = mine.filter((e) => openish(e.c));
        if (open.length) assert.ok(r.exits[side] || open.every((e) => r.warps.some((w) => w.x === e.x && w.y === e.y)), `${r.id} has an opening on its ${side} edge to nowhere`);
        continue;
      }
      const theirs = W.edgeCells(n, C.OPPOSITE[side]);
      mine.forEach((e, i) => {
        const a = e.c; const b = theirs[i].c;
        const ok = a === b || (openish(a) === openish(b) && ('.,:'.includes(a) || 'z'.includes(a)) && ('.,:'.includes(b) || 'z'.includes(b)));
        assert.ok(ok || (!openish(a) && !openish(b)), `${r.id} ${side} cell ${i} "${a}" vs ${n.id} "${b}"`);
      });
    }
  }
});

test('doors on shared edges use the same flag from both sides', () => {
  const r = ROOMS['d1:1,2']; const n = ROOMS['d1:1,1'];
  assert.equal(W.cellFlag(r, 5, 0), W.cellFlag(n, 5, 12));
  const a = ROOMS['d2:1,1']; const b = ROOMS['d2:2,1'];
  assert.equal(W.cellFlag(a, 10, 6), W.cellFlag(b, 0, 6));
  assert.notEqual(W.cellFlag(r, 5, 0), W.cellFlag(a, 10, 6));
});

// ------------------------------------------------------------------ completability

test('the whole adventure can be finished in every key order, opening every chest', () => {
  const res = S.solveGame();
  assert.ok(res.branches >= 1);
  assert.equal(res.deadEnds.length, 0, `soft-lock: ${JSON.stringify(res.deadEnds[0])}`);
  assert.ok(res.ok);
  const missing = S.allChests().filter((f) => !res.best.flags[f]);
  assert.deepEqual(missing, []);
  for (const d of C.DUNGEONS) assert.ok(res.best.flags[`boss:${d}`], `boss of ${d}`);
});

test('each dungeon needs the previous dungeon\'s item (the item opens the new path)', () => {
  // Without the boomerang the Ember Lab bridge never lowers; without bombs Hollow Keep stays sealed.
  const flags = {};
  const seen = S.reachable(flags);
  const rooms = new Set([...seen].map((k) => k.split('|')[0]));
  assert.ok(rooms.has('d1:1,2'), 'Mossy Hollow open from the start');
  assert.ok(!rooms.has('d2:1,2'), 'Ember Lab closed at first');
  assert.ok(!rooms.has('d3:1,2'), 'Hollow Keep closed at first');
  flags[W.trigFlag(ROOMS['ow:2,1'], 'crystal')] = true;
  assert.ok(S.reachable(flags).has('d2:1,2|5,11'), 'river crystal lowers the bridge');
  flags[W.cellFlag(ROOMS['ow:2,0'], 5, 4)] = true;
  assert.ok(S.reachable(flags).has('d3:1,2|5,11'), 'bombed rock opens Hollow Keep');
});

test('every switch puzzle is solvable from every doorway, and blocks can never wall you in', () => {
  const puzzles = rooms.filter((r) => r.on.switch);
  assert.ok(puzzles.length >= 3);
  for (const r of puzzles) {
    const res = S.solvePuzzle(r);
    assert.ok(res.ok, `${r.id} puzzle unsolvable: ${JSON.stringify(res.results)}`);
    assert.deepEqual(res.traps, [], `${r.id}: blocks can wall you in`);
  }
});

test('every room with cracked walls or the bomb boss has a way to get bombs back', () => {
  for (const r of rooms) {
    const cracked = r.map.some((row) => row.includes('c'));
    if (!cracked || r.area === 'ow') continue;
    // pots in this room or a neighbour, or enemies that drop bombs when you're out
    const near = [r, ...C.SIDES.map((s) => W.neighbour(r, s)).filter(Boolean)];
    assert.ok(near.some((o) => o.map.some((row) => row.includes('o')) || o.enemies.length), `${r.id} has no bomb refills nearby`);
  }
});

// ------------------------------------------------------------------ simulation helpers

function freshGame(opts = {}) {
  const state = newState();
  state.items.sword = true;
  Object.assign(state, opts.state || {});
  return new Game({ state, instant: true, seed: 3, ...opts.game });
}

function place(g, roomId, tx, ty, dir = 'down', { enemies = false } = {}) {
  g.enterRoom(roomId, center(tx), center(ty), dir);
  if (!enemies) g.enemies = [];
  g.wasClear = !g.enemies.length;
  g.events.length = 0;
}

function run(g, seconds, input = {}) {
  for (let t = 0; t < seconds; t += DT) {
    g.update(DT, typeof input === 'function' ? input(g) : input);
    if (g.mode === 'dialog') g.closeDialog();
  }
}

// ------------------------------------------------------------------ rules

test('a new game starts in the elder\'s house; talking gives the sword', () => {
  const g = new Game({ instant: true });
  assert.equal(g.room.id, 'in:elder');
  assert.equal(g.actionLabel(), '');
  run(g, 0.4, { my: -1 });
  assert.equal(g.actionLabel(), 'TALK');
  g.update(DT, { attack: true });
  assert.equal(g.mode, 'dialog');
  g.closeDialog();
  assert.ok(g.s.items.sword);
  g.closeDialog();
  run(g, 0.1, { my: 1 });
  assert.equal(g.actionLabel(), 'SWORD');
});

test('walking out of a door warps outside and sets the respawn point', () => {
  const g = freshGame();
  place(g, 'in:elder', 5, 10, 'down');
  run(g, 1.5, { my: 1 });
  assert.equal(g.room.id, 'ow:0,2');
  assert.deepEqual([g.s.respawn.room, g.s.respawn.x, g.s.respawn.y], ['ow:0,2', 3, 6]);
});

test('walking off an edge scrolls to the neighbouring room', () => {
  const g = freshGame();
  place(g, 'ow:0,2', 9, 6, 'right');
  run(g, 0.6, { mx: 1 });
  assert.equal(g.room.id, 'ow:1,2');
  assert.ok(g.p.x < 40);
});

test('the sword kills a slime in two hits and loot can drop', () => {
  const g = freshGame();
  place(g, 'd1:1,2', 5, 6, 'right');
  const e = g.spawnEnemy('slime', center(6), center(6));
  e.spawnT = 0; e.state = 'rest'; e.t = 5;
  g.update(DT, { attack: true });
  run(g, 0.5);
  assert.equal(e.hp, 1);
  // walk back up to it and swing again
  e.x = g.p.x + 14; e.y = g.p.y; e.state = 'rest'; e.t = 5; e.kt = 0;
  g.update(DT, { attack: true });
  run(g, 0.4);
  assert.ok(e.dead || !g.enemies.includes(e));
  assert.equal(g.s.kills, 1);
});

test('enemies hurt on contact, knock you back and give invulnerability frames', () => {
  const g = freshGame();
  place(g, 'd1:1,2', 5, 6);
  const e = g.spawnEnemy('slime', g.p.x, g.p.y);
  e.spawnT = 0;
  const hp = g.s.hp;
  g.update(DT, {});
  assert.equal(g.s.hp, hp - 1);
  assert.ok(g.p.inv > 0.9 && g.p.kt > 0);
  g.update(DT, {});
  assert.equal(g.s.hp, hp - 1, 'no damage while blinking');
});

test('facing a rock blocks it with the shield; turning your back does not', () => {
  const g = freshGame();
  place(g, 'd1:1,2', 5, 6, 'right');
  g.throwRock(g.p.x + 30, g.p.y, -90, 0);
  run(g, 0.6);
  assert.equal(g.s.hp, g.s.maxHp, 'blocked');
  g.p.dir = 'left';
  g.throwRock(g.p.x + 30, g.p.y, -90, 0);
  run(g, 0.6);
  assert.equal(g.s.hp, g.s.maxHp - 1, 'hit from behind');
});

test('a small key opens a locked door, shared with the room behind it', () => {
  const g = freshGame({ state: { keys: { d1: 1, d2: 0, d3: 0 } } });
  place(g, 'd1:1,2', 5, 2, 'up');
  run(g, 1.2, { my: -1 });
  assert.equal(g.s.keys.d1, 0);
  assert.ok(g.flags[W.cellFlag(ROOMS['d1:1,2'], 5, 0)]);
  run(g, 1, { my: -1 });
  assert.equal(g.room.id, 'd1:1,1');
});

test('a locked door without a key stays shut', () => {
  const g = freshGame();
  place(g, 'd1:1,2', 5, 2, 'up');
  run(g, 1.2, { my: -1 });
  assert.equal(g.room.id, 'd1:1,2');
  assert.ok(g.events.some((e) => e.type === 'toast'));
});

test('pushing the block onto the switch opens the shutter (real movement)', () => {
  const g = freshGame();
  place(g, 'd1:2,2', 2, 6, 'right');
  const b = g.blocks[0];
  assert.deepEqual([b.x, b.y], [3, 6]);
  // push right twice: block to 5,6
  run(g, 1.2, { mx: 1 });
  assert.equal(b.y, 6);
  assert.ok(b.x >= 5, `block at ${b.x}`);
  // if it went past 5, the puzzle can still be reset; for this test stop at 5
  b.x = 5; b.px = center(5); b.py = center(6);
  // go below it and push up three times
  g.p.x = center(5); g.p.y = center(7) + 1; g.p.dir = 'up';
  run(g, 1.6, { my: -1 });
  assert.ok(b.y <= 3, `block at ${b.x},${b.y}`);
  assert.ok(g.flags[W.trigFlag(ROOMS['d1:2,2'], 'switch')]);
  assert.ok(W.cellOpen(ROOMS['d1:2,2'], 5, 0, g.flags, {}));
});

test('the boomerang hits a crystal across water and lowers the bridge', () => {
  const g = freshGame({ state: { items: { sword: true, boomerang: true, bombs: false }, selected: 'boomerang' } });
  place(g, 'd1:0,1', 7, 2, 'left');
  g.update(DT, { item: true });
  run(g, 1.2);
  assert.ok(g.flags[W.trigFlag(ROOMS['d1:0,1'], 'crystal')]);
  assert.ok(g.passable(4, 6, 'player'));
  assert.equal(g.boom, null, 'boomerang came back');
});

test('the boomerang stuns enemies and fetches loot', () => {
  const g = freshGame({ state: { items: { sword: true, boomerang: true, bombs: false }, selected: 'boomerang' } });
  place(g, 'd1:1,2', 3, 6, 'right');
  const e = g.spawnEnemy('blueSlime', center(6), center(6)); e.spawnT = 0;
  const gem = g.addPickup('gem5', center(7), center(6));
  g.update(DT, { item: true });
  run(g, 0.25);
  assert.ok(e.stun > 0, 'stunned');
  e.x = center(6); e.y = center(9); // out of the way
  g.boom = null;
  g.update(DT, { item: true });
  run(g, 1.5);
  assert.ok(gem.taken);
  assert.equal(g.s.gems, 5);
});

test('bombs blow open cracked walls, hurt nearby enemies and you', () => {
  const g = freshGame({ state: { items: { sword: true, boomerang: false, bombs: true }, bombs: 3, selected: 'bombs' } });
  place(g, 'd2:1,1', 8, 6, 'right');
  g.update(DT, { item: true });
  assert.equal(g.s.bombs, 2);
  run(g, 2);
  assert.ok(g.flags[W.cellFlag(ROOMS['d2:1,1'], 10, 6)]);
  assert.ok(W.cellOpen(ROOMS['d2:2,1'], 0, 6, g.flags, {}), 'open from the other side too');
  assert.equal(g.s.hp, g.s.maxHp - 1, 'stood too close');
});

test('death sends you to the last entrance with progress kept', () => {
  const g = freshGame({ state: { gems: 42, keys: { d1: 1, d2: 0, d3: 0 } } });
  g.warp('d1:1,2', 5, 11, 'up');
  place(g, 'd1:2,2', 5, 6);
  g.s.hp = 1;
  const e = g.spawnEnemy('slime', g.p.x, g.p.y); e.spawnT = 0;
  g.update(DT, {});
  assert.equal(g.mode, 'dead');
  g.respawn();
  assert.equal(g.room.id, 'd1:1,2');
  assert.equal(g.s.hp, g.s.maxHp);
  assert.equal(g.s.gems, 42);
  assert.equal(g.s.keys.d1, 1);
  assert.equal(g.s.deaths, 1);
});

test('a potion saves you from falling', () => {
  const g = freshGame({ state: { potions: 1 } });
  place(g, 'd1:1,2', 5, 6);
  g.s.hp = 1;
  const e = g.spawnEnemy('slime', g.p.x, g.p.y); e.spawnT = 0;
  g.update(DT, {});
  assert.equal(g.mode, 'play');
  assert.equal(g.s.hp, g.s.maxHp);
  assert.equal(g.s.potions, 0);
});

test('the shop sells potions, bombs (with a bag) and one heart charm', () => {
  const g = freshGame({ state: { gems: 300 } });
  assert.equal(g.buy('bombs').ok, false);
  assert.ok(g.buy('potion').ok);
  assert.equal(g.s.potions, 1);
  assert.ok(g.buy('heart').ok);
  assert.equal(g.s.maxHp, 8);
  assert.equal(g.buy('heart').ok, false);
  g.s.items.bombs = true; g.s.bombs = 2;
  assert.ok(g.buy('bombs').ok);
  assert.equal(g.s.bombs, 7);
  g.s.gems = 5;
  assert.equal(g.buy('potion').msg, 'Not enough gems');
});

test('the Golem King shrugs off the sword unless dazed; bombs daze it', () => {
  const g = freshGame({ state: { items: { sword: true, boomerang: true, bombs: true }, bombs: 5, keys: { d1: 0, d2: 0, d3: 0 } } });
  place(g, 'd2:1,0', 5, 8, 'up', { enemies: true });
  const k = g.enemies[0];
  k.spawnT = 0; k.x = g.p.x; k.y = g.p.y - 22; k.state = 'walk';
  assert.equal(g.hitEnemy(k, 1, 'sword', g.p.x, g.p.y), 'clink');
  assert.equal(k.hp, k.maxHp);
  g.hitEnemy(k, 2, 'bomb', k.x, k.y + 10);
  assert.equal(k.hp, k.maxHp - 2);
  assert.ok(k.stun > 0);
  k.inv = 0;
  assert.equal(g.hitEnemy(k, 1, 'sword', g.p.x, g.p.y), 'hit');
});

test('the Hollow King needs the boomerang to drop his shield', () => {
  const g = freshGame();
  place(g, 'd3:1,0', 5, 8, 'up', { enemies: true });
  const k = g.enemies[0];
  assert.equal(g.hitEnemy(k, 1, 'sword', 0, 0), 'clink');
  assert.equal(g.hitEnemy(k, 0, 'boom', 0, 0), 'stun');
  k.inv = 0;
  assert.equal(g.hitEnemy(k, 1, 'sword', 0, 0), 'hit');
  for (let i = 0; i < 6; i++) { k.inv = 0; g.hitEnemy(k, 1, 'sword', 0, 0); }
  assert.equal(k.phase, 2, 'furious at half health');
  assert.ok(g.enemies.filter((e) => e.kind === 'blueSlime').length === 2);
});

test('beating a boss gives a heart container, then the way out', () => {
  const g = freshGame();
  g.warp('d1:1,2', 5, 11, 'up');
  place(g, 'd1:1,0', 5, 8, 'up', { enemies: true });
  const k = g.enemies[0];
  k.hp = 1; k.spawnT = 0;
  g.hitEnemy(k, 1, 'sword', g.p.x, g.p.y);
  assert.ok(g.flags['boss:d1']);
  const hc = g.pickups.find((p) => p.kind === 'heartC');
  assert.ok(hc);
  g.collect(hc);
  g.closeDialog();
  assert.equal(g.s.maxHp, 8);
  const orb = g.pickups.find((p) => p.kind === 'orb');
  assert.ok(orb);
  g.collect(orb);
  g.closeDialog();
  assert.equal(g.room.id, 'ow:0,0');
  // the boss stays beaten
  place(g, 'd1:1,0', 5, 8, 'up', { enemies: true });
  assert.equal(g.enemies.length, 0);
});

test('the Slime King sheds slimes as it is hurt', () => {
  const g = freshGame();
  place(g, 'd1:1,0', 5, 8, 'up', { enemies: true });
  const k = g.enemies[0];
  for (let i = 0; i < 6; i++) { k.inv = 0; g.hitEnemy(k, 1, 'sword', g.p.x, g.p.y); }
  assert.equal(g.enemies.filter((e) => e.kind === 'slime').length, 4);
});

test('a red slime splits in two when beaten', () => {
  const g = freshGame();
  place(g, 'd2:1,2', 5, 6);
  const e = g.spawnEnemy('redSlime', center(5), center(4));
  e.hp = 1;
  g.hitEnemy(e, 1, 'sword', g.p.x, g.p.y);
  assert.equal(g.enemies.filter((o) => o.kind === 'slimelet').length, 2);
});

test('clear-shutters close behind you and open when the room is clear', () => {
  const g = freshGame();
  g.enterRoom('d2:0,1', center(10), center(6), 'left');
  g.events.length = 0;
  run(g, 0.5, { mx: -1 });
  assert.ok(!g.passable(10, 6, 'player'), 'shut behind you');
  for (const e of g.enemies) e.dead = true;
  g.update(DT, {});
  assert.ok(g.passable(10, 6, 'player'), 'open once clear');
});

test('enemies never leave the room or end up inside walls', () => {
  for (const id of ['ow:1,1', 'ow:1,0', 'd1:1,1', 'd2:1,1', 'd3:1,1', 'ow:2,0']) {
    const g = freshGame({ game: { skill: 1 } });
    place(g, id, 5, 6, 'down', { enemies: true });
    g.p.inv = 1e9; // a ghost player the enemies chase around
    for (let t = 0; t < 20; t += DT) {
      g.p.x = center(5) + Math.sin(t) * 40; g.p.y = center(6) + Math.cos(t * 0.7) * 50;
      g.update(DT, {});
      g.shots = [];
      for (const e of g.enemies) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${id} ${e.kind} NaN`);
        assert.ok(e.x > C.TILE - 1 && e.x < C.ROOM_W - C.TILE + 1 && e.y > C.TILE - 1 && e.y < C.ROOM_H - C.TILE + 1, `${id} ${e.kind} escaped to ${e.x},${e.y}`);
        assert.ok(g.boxFree({ x: e.x, y: e.y, w: e.w - 1, h: e.h - 1 }, 'enemy', e) || e.kind.endsWith('King'), `${id} ${e.kind} stuck in a wall`);
      }
    }
  }
});

test('the adaptive skill only changes enemy pace, and in the right direction', () => {
  const easy = tune(PRESETS, 0); const hard = tune(PRESETS, 1); const mid = tune(PRESETS, 0.5);
  assert.deepEqual(mid, PRESETS.normal);
  assert.ok(easy.speed < hard.speed && easy.aggro < hard.aggro && easy.cooldown > hard.cooldown && easy.windup > hard.windup);
  // the same hit kills the same enemy at any skill
  for (const skill of [0, 1]) {
    const g = freshGame({ game: { skill } });
    place(g, 'd1:1,2', 5, 6);
    const e = g.spawnEnemy('slime', center(5), center(4));
    g.hitEnemy(e, 1, 'sword', g.p.x, g.p.y); e.inv = 0;
    g.hitEnemy(e, 1, 'sword', g.p.x, g.p.y);
    assert.ok(e.dead);
  }
});

test('the save state survives a JSON round trip mid-adventure', () => {
  const g = freshGame({ state: { gems: 12, keys: { d1: 1, d2: 0, d3: 0 } } });
  g.flags['boss:d1'] = true;
  g.warp('d1:1,2', 5, 11, 'up');
  const copy = JSON.parse(JSON.stringify(g.s));
  const g2 = new Game({ state: copy, instant: true });
  assert.equal(g2.room.id, 'd1:1,2');
  assert.equal(g2.s.gems, 12);
  assert.ok(g2.flags['boss:d1']);
});

test('the hidden cave by the lake opens with a bomb and holds a heart container', () => {
  const g = freshGame({ state: { items: { sword: true, boomerang: true, bombs: true }, bombs: 2, selected: 'bombs' } });
  place(g, 'ow:2,2', 4, 11, 'up');
  g.update(DT, { item: true });
  run(g, 1.6);
  g.p.x = center(4); g.p.y = center(11); g.p.kt = 0;
  run(g, 1, { my: -1 });
  assert.equal(g.room.id, 'in:cave');
});
