// Hollow Crown: a bot finishes the whole adventure through the real simulation - walking with
// the stick, pushing blocks, unlocking doors by walking into them, throwing the boomerang at
// crystals, bombing walls and opening chests with the action button. Enemies are swept away
// as they appear (combat has its own tests), and bosses are finished off with the weapon each
// one needs, so this checks that every place the route needs can really be reached and used.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/hero-quest/logic/', import.meta.url).href;
const { ROOMS } = await import(base + 'data.js');
const C = await import(base + 'constants.js');
const W = await import(base + 'world.js');
const S = await import(base + 'solver.js');
const { Game } = await import(base + 'game.js');

const DT = 1 / 60;
const center = (t) => t * C.TILE + C.TILE / 2;
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

class Bot {
  constructor() {
    this.g = new Game({ instant: true, seed: 11 });
    this.frames = 0;
  }

  get cell() {
    const p = this.g.p;
    return [C.clamp(Math.floor(p.x / C.TILE), 0, C.COLS - 1), C.clamp(Math.floor(p.y / C.TILE), 0, C.ROWS - 1)];
  }

  /** One frame. Enemies vanish (except bosses), dialogs are read. */
  step(input = {}) {
    const g = this.g;
    for (const e of g.enemies) if (!e.boss && !e.dead) { e.dead = true; }
    g.shots = [];
    g.p.inv = 9; // the bot doesn't fight; bosses can't push it around
    g.update(DT, input);
    g.events.length = 0;
    this.frames++;
    if (this.frames > 60 * 60 * 30) throw new Error('bot ran too long');
  }

  readAll() {
    let n = 0;
    while (this.g.mode === 'dialog' && n++ < 20) this.g.closeDialog();
  }

  wait(sec) { for (let t = 0; t < sec; t += DT) { this.step(); this.readAll(); } }

  /** Can the player stand on this cell right now? (live room uses the real rules) */
  open(id, x, y) {
    const g = this.g;
    if (id === g.room.id) {
      if (x < 0 || y < 0 || x >= C.COLS || y >= C.ROWS) return false;
      if (g.blocks.some((b) => b.x === x && b.y === y)) return false;
      if (g.npcs.some((n) => n.x === x && n.y === y)) return false;
      return g.passable(x, y, 'player');
    }
    return S.walk(ROOMS[id], x, y, g.flags);
  }

  /** Shortest route of cells (across rooms) from here to (id, x, y). */
  route(id, gx, gy) {
    const start = [this.g.room.id, ...this.cell];
    const key = (a) => a.join('|');
    const prev = new Map([[key(start), null]]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      const [rid, x, y] = cur;
      if (rid === id && x === gx && y === gy) {
        const path = [];
        for (let n = cur; n; n = prev.get(key(n))) path.unshift(n);
        return path;
      }
      const r = ROOMS[rid];
      const nexts = [];
      for (const [side, [dx, dy]] of Object.entries(C.SIDE_DELTA)) {
        const nx = x + dx; const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < C.COLS && ny < C.ROWS) nexts.push([rid, nx, ny]);
        else {
          const n = W.neighbour(r, side);
          if (n) nexts.push([n.id, (nx + C.COLS) % C.COLS, (ny + C.ROWS) % C.ROWS]);
          else if (r.exits[side]) nexts.push([r.exits[side].to, r.exits[side].tx, r.exits[side].ty]);
        }
      }
      const w = r.warps.find((o) => o.x === x && o.y === y);
      if (w) nexts.push([w.to, w.tx, w.ty]);
      for (const n of nexts) {
        if (prev.has(key(n)) || !this.open(...n)) continue;
        prev.set(key(n), cur); q.push(n);
      }
    }
    return null;
  }

  /** Walk to a cell, following the route and re-planning whenever the cell or room changes. */
  goto(id, gx, gy, until = null) {
    let path = null; let at = '';
    for (let guard = 0; guard < 60 * 90; guard++) {
      this.readAll();
      if (until?.()) return;
      const g = this.g; const p = g.p;
      const here = `${g.room.id}|${this.cell}`;
      if (g.room.id === id && this.cell[0] === gx && this.cell[1] === gy && Math.abs(p.x - center(gx)) < 1.5 && Math.abs(p.y - center(gy)) < 1.5) return;
      if (here !== at || !path) {
        at = here;
        path = this.route(id, gx, gy);
        assert.ok(path, `no route from ${here} to ${id} ${gx},${gy}`);
      }
      const next = path[1] || path[0];
      let tx; let ty;
      if (next[0] === g.room.id) { tx = center(next[1]); ty = center(next[2]); } else {
        // crossing an edge or a warp: keep walking the way we were going
        const [x, y] = this.cell;
        const w = g.room.warps.find((o) => o.x === x && o.y === y);
        const dir = w ? (g.cell(x, y) === 'D' && y === C.ROWS - 1 ? 'down' : 'up') : x === 0 ? 'left' : x === C.COLS - 1 ? 'right' : y === 0 ? 'up' : 'down';
        const [dx, dy] = DIRV[dir];
        tx = center(x) + dx * 40; ty = center(y) + dy * 40;
        if (!w) { // line up with the doorway first
          if (dx) ty = center(y); else tx = center(x);
        }
      }
      const dx = tx - p.x; const dy = ty - p.y;
      let mx = 0; let my = 0;
      if (Math.abs(dx) > 1) mx = Math.sign(dx) * Math.min(1, Math.abs(dx) / 4 + 0.3);
      else if (Math.abs(dy) > 1) my = Math.sign(dy) * Math.min(1, Math.abs(dy) / 4 + 0.3);
      else { p.x = tx; p.y = ty; }
      this.step({ mx, my });
    }
    assert.fail(`stuck walking to ${id} ${gx},${gy}, at ${this.g.room.id} ${this.cell}`);
  }

  face(dir, sec = 0.12) { const [mx, my] = DIRV[dir]; for (let t = 0; t < sec; t += DT) this.step({ mx: mx * 0.4, my: my * 0.4 }); this.g.p.dir = dir; }

  /** Stand on a cell, face something and press the action button. */
  act(id, x, y, dir) {
    this.goto(id, x, y);
    this.face(dir);
    this.g.p.dir = dir;
    this.step({ attack: true });
    this.readAll();
    this.wait(0.3);
  }

  /** Walk into a locked door until it opens. */
  unlock(id, x, y, dir) {
    this.goto(id, x, y);
    const [mx, my] = DIRV[dir];
    const [dx, dy] = DIRV[dir];
    const flag = W.cellFlag(ROOMS[id], x + dx, y + dy);
    for (let t = 0; t < 0.8 && !this.g.flags[flag]; t += DT) this.step({ mx, my });
    assert.ok(this.g.flags[flag], `door ${id} ${x + dx},${y + dy} did not open`);
  }

  use(item, id, x, y, dir) {
    this.goto(id, x, y);
    this.face(dir);
    this.g.s.selected = item;
    this.step({ item: true });
    if (item === 'bombs') { // step back out of the blast
      const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[dir];
      const [dx, dy] = DIRV[back];
      for (let t = 0; t < 0.6; t += DT) this.step({ mx: dx, my: dy });
      this.wait(1.6);
    } else this.wait(1.5);
  }

  /** Solve a push-block room with the solver's plan, pushing for real. */
  puzzle(id) {
    const r = ROOMS[id];
    const { results } = S.solvePuzzle(r);
    const { plan } = results[0];
    // enter the room first so the blocks exist
    const [sx, sy] = results[0].start;
    this.goto(id, sx === 0 ? 1 : sx === C.COLS - 1 ? C.COLS - 2 : sx, sy === 0 ? 1 : sy === C.ROWS - 1 ? C.ROWS - 2 : sy);
    for (const { block: [bx, by], dir: [dx, dy] } of plan) {
      const b = this.g.blocks.find((o) => o.x === bx && o.y === by);
      assert.ok(b, `${id}: no block at ${bx},${by}`);
      this.goto(id, bx - dx, by - dy);
      for (let t = 0; t < 1.5 && b.x === bx && b.y === by; t += DT) this.step({ mx: dx, my: dy });
      assert.deepEqual([b.x, b.y], [bx + dx, by + dy], `${id}: block did not move`);
      this.wait(0.25);
    }
    assert.ok(this.g.flags[W.trigFlag(r, 'switch')], `${id} switch puzzle not solved`);
  }

  boss(id) {
    this.goto(id, (C.COLS - 1) / 2, C.ROWS - 3);
    const g = this.g;
    const k = g.enemies.find((e) => e.boss);
    assert.ok(k, `no boss in ${id}`);
    if (k.kind === 'hollowKing') { k.inv = 0; assert.equal(g.hitEnemy(k, 0, 'boom', k.x, k.y), 'stun'); }
    k.hp = k.kind === 'golemKing' ? 2 : 1; k.inv = 0;
    const res = g.hitEnemy(k, 1, k.kind === 'golemKing' ? 'bomb' : 'sword', g.p.x, g.p.y);
    assert.equal(res, 'kill');
    this.wait(0.2);
    const hc = g.pickups.find((i) => i.kind === 'heartC');
    this.goto(id, Math.floor(hc.x / C.TILE), Math.floor(hc.y / C.TILE), () => hc.taken);
    this.wait(0.3);
    if (g.room.id !== id || g.mode === 'ending') return; // the prize was right there too
    const prize = g.pickups.find((i) => i.kind === 'orb' || i.kind === 'crown');
    assert.ok(prize);
    this.goto(id, Math.floor(prize.x / C.TILE), Math.floor(prize.y / C.TILE), () => prize.taken);
    this.readAll();
    this.wait(0.2);
  }
}


// ---- route helpers: find targets from the room data, so the bot works with any layout

const FLY = new Set(['.', ',', ':', '=', 'x', 'P', 'w', 'W', 'D', 'e']);
const OFFS = [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]]; // facing, where you stand

function cellsOf(id, ch) {
  const r = ROOMS[id]; const out = [];
  r.map.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
}

/** A cell next to (tx, ty), inside the room, that the bot can walk to, and the way to face. */
function standBy(b, id, tx, ty) {
  for (const [dir, ox, oy] of OFFS) {
    const sx = tx + ox; const sy = ty + oy;
    if (sx < 1 || sy < 1 || sx > C.COLS - 2 || sy > C.ROWS - 2) continue;
    if (!S.walk(ROOMS[id], sx, sy, b.g.flags)) continue;
    if (b.route(id, sx, sy)) return [sx, sy, dir];
  }
  throw new Error(`nowhere to stand next to ${id} ${tx},${ty}`);
}

function openChest(b, id) {
  const r = ROOMS[id];
  const [x, y] = cellsOf(id, 'C').find(([cx, cy]) => !b.g.flags[W.chestFlag(r, cx, cy)]);
  const [sx, sy, dir] = standBy(b, id, x, y);
  b.act(id, sx, sy, dir);
  assert.ok(b.g.flags[W.chestFlag(r, x, y)], `chest ${id} ${x},${y} opened`);
}

function talkTo(b, id, who) {
  const n = ROOMS[id].npcs.find((o) => o.who === who);
  const [sx, sy, dir] = standBy(b, id, n.x, n.y);
  b.act(id, sx, sy, dir);
}

function unlockSide(b, id, side) {
  const [x, y] = C.DOOR_CELL[side];
  const [dx, dy] = C.SIDE_DELTA[side];
  b.unlock(id, x - dx, y - dy, { top: 'up', bottom: 'down', left: 'left', right: 'right' }[side]);
}

function hitCrystal(b, id) {
  const r = ROOMS[id];
  const [cx, cy] = cellsOf(id, 'X')[0];
  for (const [dir, ox, oy] of OFFS) {
    for (let k = 1; k <= 5; k++) {
      const sx = cx + ox * k; const sy = cy + oy * k;
      if (sx < 1 || sy < 1 || sx > C.COLS - 2 || sy > C.ROWS - 2) break;
      let clear = true;
      for (let j = 1; j < k; j++) if (!FLY.has(r.map[cy + oy * j][cx + ox * j])) clear = false;
      if (!clear) break;
      if (!S.walk(r, sx, sy, b.g.flags) || !b.route(id, sx, sy)) continue;
      b.use('boomerang', id, sx, sy, dir);
      assert.ok(b.g.flags[W.trigFlag(r, 'crystal')], `crystal ${id}`);
      return;
    }
  }
  throw new Error(`no boomerang line to the crystal in ${id}`);
}

/** Bomb the cracked wall in the room (or the one on `side`). */
function bombWall(b, id, side = null) {
  const r = ROOMS[id];
  const [x, y] = side ? C.DOOR_CELL[side] : cellsOf(id, 'c')[0];
  const [sx, sy, dir] = standBy(b, id, x, y);
  b.use('bombs', id, sx, sy, dir);
  assert.ok(b.g.flags[W.cellFlag(r, x, y)], `wall ${id} ${x},${y} bombed`);
}

test('a bot can play Hollow Crown from the first line to the ending', () => {
  const b = new Bot(); const g = b.g;

  talkTo(b, 'in:elder', 'elder');
  assert.ok(g.s.items.sword, 'got the sword');

  // ---- Mossy Hollow
  openChest(b, 'd1:0,2');
  assert.equal(g.s.keys.d1, 1);
  unlockSide(b, 'd1:1,2', 'top');
  b.puzzle('d1:2,2');
  openChest(b, 'd1:2,1');
  assert.ok(g.s.items.boomerang, 'boomerang');
  hitCrystal(b, 'd1:0,1');
  openChest(b, 'd1:0,1');
  assert.ok(g.s.bigKeys.d1);
  openChest(b, 'd1:1,1');
  unlockSide(b, 'd1:1,1', 'top');
  b.boss('d1:1,0');
  assert.equal(g.room.id, 'ow:0,0', 'warped out of Mossy Hollow');
  assert.equal(g.s.maxHp, 8);
  openChest(b, 'ow:1,0');

  // ---- Ember Lab
  hitCrystal(b, 'ow:2,1');
  b.puzzle('d2:0,2');
  openChest(b, 'd2:0,2');
  unlockSide(b, 'd2:1,2', 'top');
  openChest(b, 'd2:0,1');
  assert.ok(g.s.items.bombs, 'bombs');
  bombWall(b, 'd2:1,1', 'right');
  hitCrystal(b, 'd2:2,1');
  openChest(b, 'd2:2,1');
  assert.equal(g.s.keys.d2, 1);
  unlockSide(b, 'd2:2,1', 'bottom');
  openChest(b, 'd2:2,2');
  assert.ok(g.s.bigKeys.d2);
  unlockSide(b, 'd2:1,1', 'top');
  b.boss('d2:1,0');
  assert.equal(g.room.id, 'ow:2,1');

  // ---- the hidden cave by the lake
  bombWall(b, 'ow:2,2');
  openChest(b, 'in:cave');
  assert.equal(g.s.maxHp, 12);

  // ---- Hollow Keep
  if (g.s.bombs < 4) g.s.bombs = 6; // (bombs come from drops and the shop in a real game)
  bombWall(b, 'ow:2,0');
  b.puzzle('d3:0,2');
  openChest(b, 'd3:0,2');
  bombWall(b, 'd3:1,2', 'right');
  hitCrystal(b, 'd3:2,2');
  openChest(b, 'd3:2,2');
  assert.equal(g.s.keys.d3, 2);
  unlockSide(b, 'd3:1,2', 'top');
  unlockSide(b, 'd3:1,1', 'left');
  openChest(b, 'd3:0,1');
  assert.ok(g.s.bigKeys.d3);
  bombWall(b, 'd3:2,1');
  openChest(b, 'd3:2,1');
  unlockSide(b, 'd3:1,1', 'top');
  b.boss('d3:1,0');

  assert.ok(g.s.done, 'carried the Crown home');
  assert.equal(g.mode, 'ending');
  assert.equal(g.s.maxHp, 14);
  const missing = S.allChests().filter((f) => !g.flags[f]);
  assert.deepEqual(missing, [], 'every chest opened');
});
