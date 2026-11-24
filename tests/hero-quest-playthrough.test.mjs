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
    this.goto(id, 5, 10);
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

test('a bot can play Hollow Crown from the first line to the ending', () => {
  const b = new Bot(); const g = b.g;
  const has = (f) => !!g.flags[f];

  b.act('in:elder', 5, 6, 'up');
  assert.ok(g.s.items.sword, 'got the sword');

  // ---- Mossy Hollow
  b.act('d1:0,2', 5, 6, 'up');
  assert.equal(g.s.keys.d1, 1);
  b.unlock('d1:1,2', 5, 1, 'up');
  b.puzzle('d1:2,2');
  b.act('d1:2,1', 5, 6, 'up');
  assert.ok(g.s.items.boomerang, 'boomerang');
  b.use('boomerang', 'd1:0,1', 6, 2, 'left');
  assert.ok(has(W.trigFlag(ROOMS['d1:0,1'], 'crystal')), 'bridge lowered');
  b.act('d1:0,1', 3, 5, 'left');
  assert.ok(g.s.bigKeys.d1);
  b.unlock('d1:1,1', 5, 1, 'up');
  b.boss('d1:1,0');
  assert.equal(g.room.id, 'ow:0,0', 'warped out of Mossy Hollow');
  assert.equal(g.s.maxHp, 8);

  // ---- Ember Lab
  b.use('boomerang', 'ow:2,1', 6, 8, 'right');
  assert.ok(has(W.trigFlag(ROOMS['ow:2,1'], 'crystal')), 'river bridge');
  b.puzzle('d2:0,2');
  b.act('d2:0,2', 5, 7, 'up');
  b.unlock('d2:1,2', 5, 1, 'up');
  b.act('d2:0,1', 5, 6, 'up');
  assert.ok(g.s.items.bombs, 'bombs');
  b.use('bombs', 'd2:1,1', 9, 6, 'right');
  b.use('boomerang', 'd2:2,1', 9, 4, 'left');
  b.act('d2:2,1', 5, 5, 'down');
  assert.equal(g.s.keys.d2, 1);
  b.unlock('d2:2,1', 5, 11, 'down');
  b.act('d2:2,2', 5, 7, 'up');
  assert.ok(g.s.bigKeys.d2);
  b.unlock('d2:1,1', 5, 1, 'up');
  b.boss('d2:1,0');
  assert.equal(g.room.id, 'ow:2,1');

  // ---- the hidden cave by the lake
  b.use('bombs', 'ow:2,2', 4, 11, 'up');
  b.act('in:cave', 5, 6, 'up');
  assert.equal(g.s.maxHp, 12);

  // ---- Hollow Keep
  if (g.s.bombs < 4) g.s.bombs = 6; // (bombs come from drops and the shop in a real game)
  b.use('bombs', 'ow:2,0', 5, 5, 'up');
  b.puzzle('d3:0,2');
  b.act('d3:0,2', 5, 7, 'up');
  b.use('bombs', 'd3:1,2', 9, 6, 'right');
  b.use('boomerang', 'd3:2,2', 8, 5, 'up');
  b.act('d3:2,2', 5, 3, 'up');
  assert.equal(g.s.keys.d3, 2);
  b.unlock('d3:1,2', 5, 1, 'up');
  b.unlock('d3:1,1', 1, 6, 'left');
  b.act('d3:0,1', 5, 7, 'up');
  assert.ok(g.s.bigKeys.d3);
  b.use('bombs', 'd3:2,1', 3, 5, 'up');
  b.act('d3:2,1', 3, 4, 'up');
  b.unlock('d3:1,1', 5, 1, 'up');
  b.boss('d3:1,0');

  assert.ok(g.s.done, 'carried the Crown home');
  assert.equal(g.mode, 'ending');
  assert.equal(g.s.maxHp, 14);
  const missing = S.allChests().filter((f) => !g.flags[f]);
  assert.deepEqual(missing, [], 'every chest opened');
});
