// The whole adventure as a plain simulation: one room is live at a time. The Phaser scene feeds
// it input every frame, draws what it holds, and plays the events it emits (sounds, dialogs,
// room changes). Node tests drive it the same way with scripted input.
import {
  TILE, COLS, ROWS, ROOM_W, ROOM_H, DIR_VEC, PLAYER, BOOMERANG, BOMB, OPPOSITE, DOOR_CELL, clamp,
} from './constants.js';
import { ROOMS, START } from './data.js';
import { FLYOVER, BREAKABLE } from './tiles.js';
import { neighbour, cellFlag, chestFlag, trigFlag, charAt, cellOpen, sideOf } from './world.js';
import { makeEnemy, updateEnemy, hurtEnemy, harmful } from './enemies.js';
import { PRESETS, tune, makeRng } from './tune.js';
import { ITEM_TEXT, talk, shopStock } from './story.js';

export const VERSION = 1;

export function newState() {
  return {
    v: VERSION,
    maxHp: 6, hp: 6,              // half-hearts
    gems: 0, potions: 0, bombs: 0,
    items: { sword: false, boomerang: false, bombs: false },
    keys: { d1: 0, d2: 0, d3: 0 },
    bigKeys: { d1: false, d2: false, d3: false },
    flags: {},
    respawn: { ...START },
    selected: null,
    deaths: 0, time: 0, kills: 0,
    done: false,
  };
}

const center = (t) => t * TILE + TILE / 2;
const overlap = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

export class Game {
  /**
   * opts.state: saved state (or a fresh one). opts.skill 0..1 (adaptive). opts.seed.
   * opts.instant: finish room scrolls/fades at once (tests).
   */
  constructor({ state = null, skill = 0.35, seed = 7, instant = false } = {}) {
    this.s = state || newState();
    this.skill = skill;
    this.tune = tune(PRESETS, skill);
    this.rng = makeRng(seed);
    this.instant = instant;
    this.events = [];
    this.nextId = 1;
    this.visitCleared = {};
    this.mode = 'play';
    this.p = {
      x: 0, y: 0, w: PLAYER.w, h: PLAYER.h, dir: 'down', moving: false,
      inv: 0, kt: 0, kx: 0, ky: 0, attackT: 0, pushT: 0, pushing: false, itemT: 0, hits: null,
    };
    const r = this.s.respawn;
    this.enterRoom(r.room, center(r.x), center(r.y), r.dir);
  }

  emit(ev) { this.events.push(ev); }
  get flags() { return this.s.flags; }
  setSkill(skill) { this.skill = skill; this.tune = tune(PRESETS, skill); }

  // ------------------------------------------------------------------ rooms

  enterRoom(id, px, py, dir) {
    const r = ROOMS[id];
    if (!r) throw new Error(`No room ${id}`);
    const prevArea = this.room?.area;
    this.room = r;
    this.flags[`seen:${id}`] = true;
    if (prevArea && prevArea !== r.area) this.visitCleared = {};
    const p = this.p;
    p.x = px; p.y = py; if (dir) p.dir = dir;
    p.kt = 0; p.attackT = 0; p.pushT = 0; p.pushing = false;
    this.enemies = []; this.shots = []; this.pickups = []; this.blocks = []; this.bombs = [];
    this.boom = null; this.broken = {}; this.npcs = [];
    this.roomHurt = false;
    this.bombSupplyT = 4;
    // Cells the player stands on when arriving stay passable until they step off (shutters close behind).
    this.entryCells = this.cellsUnder(p);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (r.map[y][x] === 'P') this.blocks.push({ id: this.nextId++, x, y, px: center(x), py: center(y), w: TILE, h: TILE, slide: 0 });
      }
    }
    for (const n of r.npcs) this.npcs.push({ id: this.nextId++, ...n, px: center(n.x), py: center(n.y), w: 14, h: 14 });
    const bossDone = r.boss && this.flags[`boss:${r.area}`];
    const sealDone = r.seal && !r.boss && this.flags[trigFlag(r, 'clear')];
    if (!bossDone && !sealDone && !this.visitCleared[id]) {
      for (const [kind, x, y, o] of r.enemies) this.spawnEnemy(kind, center(x), center(y), o);
    }
    if (bossDone) this.spawnBossRewards();
    this.wasClear = this.enemies.length === 0;
    if (!this.s.selected) this.autoSelect();
    this.emit({ type: 'room', id });
  }

  spawnEnemy(kind, x, y, o) {
    const e = makeEnemy(this.nextId++, kind, x, y, o);
    this.enemies.push(e);
    return e;
  }

  /** Room-wide state the door rules need. */
  roomCtx() {
    const alive = this.enemies.some((e) => !e.dead);
    return { clear: !alive, sealed: !!this.room.seal && alive };
  }

  cellsUnder(b) {
    const out = new Set();
    const x0 = Math.floor((b.x - b.w / 2) / TILE); const x1 = Math.floor((b.x + b.w / 2 - 0.01) / TILE);
    const y0 = Math.floor((b.y - b.h / 2) / TILE); const y1 = Math.floor((b.y + b.h / 2 - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.add(`${x},${y}`);
    return out;
  }

  /** Current character of a cell after sword damage this visit. */
  cell(x, y) {
    if (this.broken[`${x},${y}`]) return '.';
    return charAt(this.room, x, y);
  }

  /** Can `who` ('player' | 'enemy' | 'fly' | 'block') pass through cell x,y? */
  passable(x, y, who, ctx = this.roomCtx()) {
    const r = this.room;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
      if (who !== 'player') return false;
      return this.passable(clamp(x, 0, COLS - 1), clamp(y, 0, ROWS - 1), who, ctx);
    }
    const c = this.cell(x, y);
    if (who === 'enemy' || who === 'block') {
      if (sideOf(x, y)) return false; // enemies and blocks stay inside the room
    }
    if (who === 'fly') {
      if (FLYOVER.has(c)) return true;
      if (c === 'k' || c === 'K' || c === 's' || c === 'z' || c === 'c') return cellOpen(r, x, y, this.flags, ctx) && !sideOf(x, y);
    }
    if (c === '.' || c === ',' || c === ':' || c === 'x' || c === 'P' || c === '=') return true;
    if (who === 'player' && this.entryCells.has(`${x},${y}`)) return true;
    return cellOpen(r, x, y, this.flags, ctx);
  }

  /** Blocks, NPCs and chests count as solid things too. */
  solidThingAt(box, who, self) {
    for (const b of this.blocks) if (b !== self && overlap(box, { x: b.px, y: b.py, w: TILE, h: TILE })) return b;
    if (who !== 'fly') for (const n of this.npcs) if (overlap(box, { x: n.px, y: n.py, w: n.w, h: n.h })) return n;
    return null;
  }

  boxFree(box, who, self) {
    const ctx = this.roomCtx();
    const x0 = Math.floor((box.x - box.w / 2) / TILE); const x1 = Math.floor((box.x + box.w / 2 - 0.01) / TILE);
    const y0 = Math.floor((box.y - box.h / 2) / TILE); const y1 = Math.floor((box.y + box.h / 2 - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.passable(x, y, who, ctx)) return false;
    return !this.solidThingAt(box, who, self);
  }

  /** Move an entity by dx, dy with tile collision (axis by axis). Returns { blocked }. */
  move(e, dx, dy, who = 'enemy') {
    let blocked = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps; const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) {
        const nb = { x: e.x + sx, y: e.y, w: e.w, h: e.h };
        if (this.boxFree(nb, who, e)) e.x = nb.x; else { blocked = true; if (who === 'player') this.slide(e, 'x', sx); }
      }
      if (sy) {
        const nb = { x: e.x, y: e.y + sy, w: e.w, h: e.h };
        if (this.boxFree(nb, who, e)) e.y = nb.y; else { blocked = true; if (who === 'player') this.slide(e, 'y', sy); }
      }
    }
    return { blocked };
  }

  /** Corner help: if you're a few pixels off a doorway, nudge sideways into it. */
  slide(e, axis, d) {
    const other = axis === 'x' ? 'y' : 'x';
    for (const off of [1, -1]) {
      for (let k = 1; k <= 7; k++) {
        const probe = { x: e.x, y: e.y, w: e.w, h: e.h };
        probe[other] += off * k;
        probe[axis] += Math.sign(d) * 2;
        if (this.boxFree(probe, 'player', e)) {
          const side = { x: e.x, y: e.y, w: e.w, h: e.h };
          side[other] += off;
          if (this.boxFree(side, 'player', e)) { e[other] += off; return; }
        }
      }
    }
  }

  /** Straight line between two points crosses no walls (for chargers). */
  lineClear(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
    const ctx = this.roomCtx();
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n; const y = y0 + ((y1 - y0) * i) / n;
      if (!this.passable(Math.floor(x / TILE), Math.floor(y / TILE), 'enemy', ctx)) return false;
    }
    return true;
  }

  randomSpot(e = null) {
    for (let k = 0; k < 60; k++) {
      const x = 2 + Math.floor(this.rng() * (COLS - 4)); const y = 2 + Math.floor(this.rng() * (ROWS - 4));
      if (!this.passable(x, y, 'enemy')) continue;
      if (e && !this.boxFree({ x: center(x), y: center(y), w: e.w, h: e.h }, 'enemy', e)) continue;
      return [center(x), center(y)];
    }
    return [ROOM_W / 2, ROOM_H / 2];
  }

  farSpot(e, minDist) {
    for (let k = 0; k < 40; k++) {
      const s = this.randomSpot(e);
      if (Math.hypot(s[0] - this.p.x, s[1] - this.p.y) >= minDist) return s;
    }
    return [e.x, e.y];
  }

  throwRock(x, y, vx, vy) {
    this.shots.push({ id: this.nextId++, x, y, vx, vy, w: 6, h: 6, t: 4 });
    this.emit({ type: 'sfx', name: 'shoot' });
  }

  // ------------------------------------------------------------------ main loop

  /** input: { mx, my, attack, item, cycle } (attack/item/cycle are "pressed this frame") */
  update(dt, input = {}) {
    dt = Math.min(dt, 1 / 20);
    if (this.mode !== 'play') {
      if ((this.mode === 'scroll' || this.mode === 'fade') && this.instant) this.endTransition();
      return;
    }
    this.s.time += dt;
    this.updatePlayer(dt, input);
    if (this.mode !== 'play') return;
    this.updateBoomerang(dt);
    this.updateBombs(dt);
    for (const e of this.enemies) if (!e.dead) updateEnemy(e, this, dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateBlocks(dt);
    this.contactDamage();
    this.checkClear();
    if (this.mode === 'play') this.checkEdges();
  }

  updatePlayer(dt, input) {
    const p = this.p;
    p.inv = Math.max(0, p.inv - dt);
    p.itemT = Math.max(0, p.itemT - dt);
    // Step off the arrival cells and they behave normally again.
    if (this.entryCells.size) {
      const under = this.cellsUnder(p);
      for (const c of [...this.entryCells]) if (!under.has(c)) this.entryCells.delete(c);
    }
    if (input.cycle) this.cycleItem();
    if (p.kt > 0) {
      p.kt -= dt;
      this.move(p, p.kx * dt, p.ky * dt, 'player');
      p.moving = false;
      return;
    }
    if (p.attackT > 0) {
      p.attackT -= dt;
      this.swordHits();
      p.moving = false;
      return;
    }
    const mx = input.mx || 0; const my = input.my || 0;
    const mag = Math.hypot(mx, my);
    p.moving = false;
    p.pushing = false;
    if (mag > 0.25) {
      // Facing follows the stronger axis, with a little stickiness on diagonals.
      const ax = Math.abs(mx); const ay = Math.abs(my);
      const horiz = p.dir === 'left' || p.dir === 'right';
      const wantH = horiz ? ax > ay * 0.8 : ax > ay * 1.25;
      p.dir = wantH ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
      const k = Math.min(1, mag) * PLAYER.speed * dt / mag;
      const x0 = p.x; const y0 = p.y;
      this.move(p, mx * k, my * k, 'player');
      p.moving = Math.hypot(p.x - x0, p.y - y0) > 0.01;
      // Leaning into something along the facing axis?
      const [fx, fy] = DIR_VEC[p.dir];
      const along = fx ? Math.abs(p.x - x0) : Math.abs(p.y - y0);
      if (along < 0.05) this.lean(dt); else { p.pushT = 0; p.lockMsg = false; }
    } else { p.pushT = 0; p.lockMsg = false; }

    if (input.attack) {
      const t = this.interactTarget();
      if (t) this.interact(t);
      else if (this.s.items.sword) this.swing();
    }
    if (input.item && this.mode === 'play') this.useItem(input);
  }

  frontPoint(dist = 10) {
    const [fx, fy] = DIR_VEC[this.p.dir];
    return [this.p.x + fx * dist, this.p.y + fy * dist];
  }

  /** Pushing against a block, a locked door, or a shutter. */
  lean(dt) {
    const p = this.p;
    p.pushT += dt;
    const [x, y] = this.frontPoint(9);
    const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
    const probe = { x, y, w: 4, h: 4 };
    const block = this.blocks.find((b) => overlap(probe, { x: b.px, y: b.py, w: TILE, h: TILE }));
    if (block) {
      p.pushing = true;
      if (p.pushT >= PLAYER.pushDelay && !block.slide) { this.pushBlock(block); p.pushT = 0; }
      return;
    }
    const c = this.cell(tx, ty);
    const r = this.room;
    if ((c === 'k' || c === 'K') && !this.flags[cellFlag(r, tx, ty)] && p.pushT > 0.12) {
      const area = r.area;
      if (c === 'k' && this.s.keys[area] > 0) {
        this.s.keys[area]--;
        this.openCell(tx, ty, 'Unlocked!');
      } else if (c === 'K' && this.s.bigKeys[area]) {
        this.openCell(tx, ty, 'The great door opens.');
      } else if (!p.lockMsg) {
        p.lockMsg = true;
        this.emit({ type: 'toast', text: c === 'k' ? 'Locked. You need a small key.' : 'This door needs the Boss Key.' });
        this.emit({ type: 'sfx', name: 'error' });
      }
      p.pushT = 0;
    } else if ((c === 's' || c === 'z') && p.pushT > 0.4 && !p.lockMsg) {
      p.lockMsg = true;
      this.emit({ type: 'toast', text: c === 'z' ? 'Shut tight. Beat the enemies here.' : (r.hint || 'Shut tight. Solve the room.') });
    }
  }

  openCell(x, y, text) {
    this.flags[cellFlag(this.room, x, y)] = true;
    this.emit({ type: 'sfx', name: 'power' });
    this.emit({ type: 'cells' });
    if (text) this.emit({ type: 'toast', text });
    this.dirty = true;
  }

  pushBlock(b) {
    const [dx, dy] = DIR_VEC[this.p.dir];
    const nx = b.x + dx; const ny = b.y + dy;
    const c = this.cell(nx, ny);
    const ok = this.passable(nx, ny, 'block') && (c === '.' || c === ',' || c === ':' || c === 'x' || c === 'P')
      && !this.blocks.some((o) => o !== b && o.x === nx && o.y === ny)
      && !this.enemies.some((e) => !e.dead && Math.floor(e.x / TILE) === nx && Math.floor(e.y / TILE) === ny);
    if (!ok) return;
    b.x = nx; b.y = ny; b.slide = 0.2;
    this.emit({ type: 'sfx', name: 'move' });
  }

  updateBlocks(dt) {
    for (const b of this.blocks) {
      const tx = center(b.x); const ty = center(b.y);
      if (b.slide > 0) {
        b.slide = Math.max(0, b.slide - dt);
        const k = b.slide > 0 ? Math.min(1, (TILE / 0.2) * dt / Math.max(1, Math.hypot(tx - b.px, ty - b.py))) : 1;
        b.px += (tx - b.px) * k; b.py += (ty - b.py) * k;
        if (b.slide === 0) { b.px = tx; b.py = ty; this.checkSwitches(); }
      }
    }
  }

  /** All floor switches covered by blocks -> the room's switch trigger fires (latched for good). */
  checkSwitches() {
    const r = this.room;
    if (!r.on.switch || this.flags[trigFlag(r, 'switch')]) return;
    const sw = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (r.map[y][x] === 'x') sw.push([x, y]);
    const covered = sw.filter(([x, y]) => this.blocks.some((b) => b.x === x && b.y === y));
    if (covered.length) this.emit({ type: 'sfx', name: 'place' });
    if (sw.length && covered.length === sw.length) this.fireTrigger('switch');
  }

  fireTrigger(kind) {
    const r = this.room;
    if (this.flags[trigFlag(r, kind)]) return;
    this.flags[trigFlag(r, kind)] = true;
    this.dirty = true;
    const act = r.on[kind] || {};
    let text = '';
    if (act.door) {
      const [x, y] = DOOR_CELL[act.door];
      this.flags[cellFlag(r, x, y)] = true;
      text = 'A door opened!';
    }
    if (act.chest) text = 'A chest appeared!';
    if (act.bridge) text = 'A bridge appeared!';
    this.emit({ type: 'sfx', name: 'goal' });
    this.emit({ type: 'cells' });
    if (text) this.emit({ type: 'toast', text });
  }

  chestAt(x, y) {
    const r = this.room;
    if (r.map[y]?.[x] !== 'C') return null;
    const spec = r.chests[`${x},${y}`];
    if (!spec) return null;
    const visible = !spec.hidden || this.flags[trigFlag(r, spec.hidden)];
    return { x, y, spec, visible, open: !!this.flags[chestFlag(r, x, y)] };
  }

  // ------------------------------------------------------------------ talking, chests, signs

  /** What the action button would do right now: { kind, ... } or null. */
  interactTarget() {
    const p = this.p;
    if (p.attackT > 0) return null;
    const [x, y] = this.frontPoint(10);
    const probe = { x, y, w: 8, h: 8 };
    for (const n of this.npcs) if (overlap(probe, { x: n.px, y: n.py, w: n.w, h: n.h })) return { kind: 'talk', npc: n };
    const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
    const c = this.cell(tx, ty);
    if (c === '_') { // talk over a counter
      const [fx, fy] = DIR_VEC[p.dir];
      const far = { x: x + fx * TILE, y: y + fy * TILE, w: 8, h: 8 };
      for (const n of this.npcs) if (overlap(far, { x: n.px, y: n.py, w: n.w, h: n.h })) return { kind: 'talk', npc: n };
    }
    if (c === 'v' && this.room.signs[`${tx},${ty}`]) return { kind: 'read', lines: this.room.signs[`${tx},${ty}`] };
    if (c === 'C') {
      const ch = this.chestAt(tx, ty);
      if (ch && ch.visible && !ch.open) return { kind: 'open', chest: ch };
    }
    return null;
  }

  /** Label for the action button: 'TALK' | 'READ' | 'OPEN' | 'SWORD' | '' */
  actionLabel() {
    const t = this.interactTarget();
    if (t) return { talk: 'TALK', read: 'READ', open: 'OPEN' }[t.kind];
    return this.s.items.sword ? 'SWORD' : '';
  }

  interact(t) {
    if (t.kind === 'read') return this.say(t.lines);
    if (t.kind === 'talk') {
      const n = t.npc;
      // face the player
      const dx = this.p.x - n.px; const dy = this.p.y - n.py;
      n.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      const { lines, then } = talk(n.who, this.s);
      return this.say(lines, then);
    }
    if (t.kind === 'open') {
      const { x, y, spec } = t.chest;
      this.flags[chestFlag(this.room, x, y)] = true;
      this.emit({ type: 'sfx', name: 'coin' });
      this.emit({ type: 'cells' });
      this.give(spec.item);
    }
  }

  say(lines, then = null, extra = {}) {
    this.mode = 'dialog';
    this.dialog = { lines, then };
    this.p.attackT = 0;
    this.emit({ type: 'dialog', lines, ...extra });
  }

  /** The scene calls this when the player has read the last line. */
  closeDialog() {
    if (this.mode !== 'dialog') return;
    const then = this.dialog?.then;
    this.dialog = null;
    this.mode = 'play';
    this.p.showing = null;
    if (then === 'giveSword') this.give('sword');
    else if (then === 'shop') { this.mode = 'shop'; this.emit({ type: 'shop' }); } else if (then === 'orb') this.exitDungeon();
    else if (then === 'ending') { this.mode = 'ending'; this.emit({ type: 'ending' }); }
  }

  give(item) {
    const s = this.s;
    const area = this.room.area;
    switch (item) {
      case 'sword': s.items.sword = true; break;
      case 'boomerang': s.items.boomerang = true; s.selected = 'boomerang'; break;
      case 'bombs': s.items.bombs = true; s.bombs = Math.max(s.bombs, BOMB.start); s.selected = 'bombs'; break;
      case 'key': s.keys[area] = (s.keys[area] || 0) + 1; break;
      case 'bigkey': s.bigKeys[area] = true; break;
      case 'heart': s.maxHp += 2; s.hp = s.maxHp; break;
      case 'gems20': s.gems = Math.min(999, s.gems + 20); break;
      case 'gems50': s.gems = Math.min(999, s.gems + 50); break;
      case 'potion': s.potions = Math.min(3, s.potions + 1); break;
      default: break;
    }
    this.dirty = true;
    this.p.showing = item;
    this.emit({ type: 'get', item });
    this.emit({ type: 'sfx', name: item.startsWith('gems') ? 'coin' : 'win' });
    this.say(ITEM_TEXT[item] || ['You found something.'], null, { item });
  }

  // ------------------------------------------------------------------ shop

  shopStock() { return shopStock(this.s); }

  buy(id) {
    const s = this.s;
    const it = this.shopStock().find((i) => i.id === id);
    if (!it) return { ok: false, msg: '?' };
    if (it.why) return { ok: false, msg: it.why };
    if (s.gems < it.price) return { ok: false, msg: 'Not enough gems' };
    s.gems -= it.price;
    if (id === 'potion') s.potions++;
    if (id === 'bombs') s.bombs = Math.min(BOMB.max, s.bombs + 5);
    if (id === 'heart') { s.flags['bought:heart'] = true; s.maxHp += 2; s.hp = s.maxHp; }
    if (!s.selected) this.autoSelect();
    this.dirty = true;
    return { ok: true, msg: `Bought ${it.name}!` };
  }

  closeShop() { if (this.mode === 'shop') this.mode = 'play'; }

  // ------------------------------------------------------------------ sword

  swing() {
    const p = this.p;
    if (p.attackT > 0) return;
    p.attackT = PLAYER.swing;
    p.hits = new Set();
    p.crystalHit = false;
    this.emit({ type: 'swing', dir: p.dir });
    this.emit({ type: 'sfx', name: 'flip' });
  }

  swordBox() {
    const p = this.p;
    switch (p.dir) {
      case 'down': return { x: p.x, y: p.y + 11, w: 20, h: 16 };
      case 'up': return { x: p.x, y: p.y - 12, w: 20, h: 16 };
      case 'left': return { x: p.x - 12, y: p.y - 1, w: 16, h: 18 };
      default: return { x: p.x + 12, y: p.y - 1, w: 16, h: 18 };
    }
  }

  swordHits() {
    const p = this.p;
    const t = PLAYER.swing - p.attackT;
    if (t < 0.04 || t > 0.2) return;
    const box = this.swordBox();
    for (const e of this.enemies) {
      if (e.dead || p.hits.has(e.id) || !overlap(box, e)) continue;
      p.hits.add(e.id);
      this.hitEnemy(e, 1, 'sword', p.x, p.y);
    }
    // cells: bushes, pots, crystals
    const x0 = Math.floor((box.x - box.w / 2) / TILE); const x1 = Math.floor((box.x + box.w / 2 - 0.01) / TILE);
    const y0 = Math.floor((box.y - box.h / 2) / TILE); const y1 = Math.floor((box.y + box.h / 2 - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = this.cell(x, y);
        // only the cell mostly in front counts for breakables (no cutting through walls diagonally)
        const cx = center(x); const cy = center(y);
        if (Math.abs(cx - box.x) > 14 || Math.abs(cy - box.y) > 14) continue;
        if (BREAKABLE[c]) this.breakCell(x, y);
        if (c === 'X' && !p.crystalHit) { p.crystalHit = true; this.hitCrystal(); }
      }
    }
  }

  breakCell(x, y) {
    const c = this.cell(x, y);
    this.broken[`${x},${y}`] = true;
    this.emit({ type: 'break', x, y, what: c });
    this.emit({ type: 'sfx', name: c === 'o' ? 'smallBoom' : 'card' });
    this.emit({ type: 'cells' });
    this.dropLoot(center(x), center(y), 0.55);
  }

  hitCrystal() {
    const r = this.room;
    this.emit({ type: 'sfx', name: 'select' });
    if (r.on.crystal && !this.flags[trigFlag(r, 'crystal')]) this.fireTrigger('crystal');
  }

  hitEnemy(e, dmg, src, fx, fy) {
    const res = hurtEnemy(e, dmg, src, fx, fy);
    if (res === 'clink') {
      this.emit({ type: 'sfx', name: 'bounce' });
      this.emit({ type: 'clink', x: e.x, y: e.y });
      if (src === 'sword') { // recoil
        const p = this.p;
        const ax = p.x - e.x; const ay = p.y - e.y; const d = Math.hypot(ax, ay) || 1;
        p.kx = (ax / d) * 120; p.ky = (ay / d) * 120; p.kt = 0.12; p.attackT = 0;
      }
    } else if (res === 'stun') this.emit({ type: 'sfx', name: 'bounce' });
    else if (res === 'hit') { this.emit({ type: 'sfx', name: 'hit' }); this.emit({ type: 'ehit', id: e.id }); this.bossHitEffects(e); } else if (res === 'kill') this.killEnemy(e);
    return res;
  }

  /** The Slime King sheds slimes as it is hurt; the Hollow King calls help at half health. */
  bossHitEffects(e) {
    const alive = () => this.enemies.filter((o) => !o.dead).length;
    if (e.kind === 'slimeKing') {
      const want = Math.floor((e.maxHp - e.hp) / 3);
      while ((e.shed || 0) < want) {
        e.shed = (e.shed || 0) + 1;
        if (alive() >= 5) continue;
        for (const o of [-14, 14]) {
          const s = this.spawnEnemy('slime', e.x + o, e.y + 4, {});
          s.spawnT = 0.4;
          if (!this.boxFree(s, 'enemy', s)) { s.x = e.x; s.y = e.y; }
        }
      }
    }
    if (e.kind === 'hollowKing' && e.phase === 1 && e.hp <= e.maxHp / 2) {
      e.phase = 2;
      this.emit({ type: 'toast', text: 'The Hollow King is furious!' });
      for (let k = 0; k < 2; k++) {
        const [x, y] = this.farSpot(e, 48);
        this.spawnEnemy('blueSlime', x, y, {}).spawnT = 0.6;
      }
    }
  }

  killEnemy(e) {
    this.s.kills++;
    this.emit({ type: 'die', id: e.id, x: e.x, y: e.y, kind: e.kind, boss: e.boss });
    this.emit({ type: 'sfx', name: e.boss ? 'boom' : 'capture' });
    if (e.kind === 'redSlime') {
      for (const o of [-6, 6]) {
        const s = this.spawnEnemy('slimelet', e.x + o, e.y, {});
        s.spawnT = 0.25;
        if (!this.boxFree(s, 'enemy', s)) { s.x = e.x; }
      }
    }
    if (e.boss) {
      this.flags[`boss:${this.room.area}`] = true;
      this.dirty = true;
      for (const o of this.enemies) if (!o.dead) { o.dead = true; this.emit({ type: 'die', id: o.id, x: o.x, y: o.y, kind: o.kind }); }
      this.shots = [];
      this.emit({ type: 'bossDown', area: this.room.area, hpFrac: this.s.hp / this.s.maxHp });
      this.spawnBossRewards(e.x, e.y);
      return;
    }
    if (!e.mini) this.dropLoot(e.x, e.y, 0.5);
  }

  /** Heart container where the boss fell, then the way out once it's taken. */
  spawnBossRewards(x = ROOM_W / 2, y = ROOM_H / 2 - 16) {
    const area = this.room.area;
    const [cx, cy] = this.clampInside(x, y);
    if (!this.flags[`hc:${area}`]) this.addPickup('heartC', cx, cy, { keep: true });
    else this.addPickup(this.finalPrize(), ROOM_W / 2, ROOM_H / 2, { keep: true });
  }

  /** The Crown waits in the keep until you've carried it home once; after that it's the way out. */
  finalPrize() { return this.room.area === 'd3' && !this.s.done ? 'crown' : 'orb'; }

  clampInside(x, y) {
    let tx = clamp(Math.floor(x / TILE), 1, COLS - 2); let ty = clamp(Math.floor(y / TILE), 1, ROWS - 2);
    if (!this.passable(tx, ty, 'enemy')) [tx, ty] = [5, 5];
    return [center(tx), center(ty)];
  }

  // ------------------------------------------------------------------ items

  ownedItems() {
    const s = this.s; const out = [];
    if (s.items.boomerang) out.push('boomerang');
    if (s.items.bombs) out.push('bombs');
    if (s.potions > 0) out.push('potion');
    return out;
  }

  autoSelect() {
    const own = this.ownedItems();
    this.s.selected = own.includes(this.s.selected) ? this.s.selected : (own[0] || null);
  }

  cycleItem() {
    const own = this.ownedItems();
    if (!own.length) return;
    const i = own.indexOf(this.s.selected);
    this.s.selected = own[(i + 1) % own.length];
    this.emit({ type: 'sfx', name: 'select' });
    this.dirty = true;
  }

  useItem(input) {
    const s = this.s; const p = this.p;
    this.autoSelect();
    if (p.attackT > 0 || p.itemT > 0) return;
    const it = s.selected;
    if (it === 'boomerang') {
      if (this.boom) return;
      let vx; let vy;
      const mag = Math.hypot(input.mx || 0, input.my || 0);
      if (mag > 0.3) {
        // 8 directions
        const a = Math.round(Math.atan2(input.my, input.mx) / (Math.PI / 4)) * (Math.PI / 4);
        vx = Math.cos(a); vy = Math.sin(a);
        if (Math.abs(vx) < 1e-6) vx = 0; if (Math.abs(vy) < 1e-6) vy = 0;
      } else [vx, vy] = DIR_VEC[p.dir];
      this.boom = { id: this.nextId++, x: p.x, y: p.y - 2, vx, vy, w: 8, h: 8, dist: 0, back: false, carry: [] };
      p.itemT = 0.2;
      this.emit({ type: 'sfx', name: 'shoot' });
    } else if (it === 'bombs') {
      if (s.bombs <= 0) { this.emit({ type: 'toast', text: 'Out of bombs.' }); this.emit({ type: 'sfx', name: 'error' }); return; }
      if (this.bombs.length >= 2) return;
      const [x, y] = this.frontPoint(12);
      const bx = Math.floor(x / TILE); const by = Math.floor(y / TILE);
      const spot = this.passable(bx, by, 'enemy') || this.passable(bx, by, 'player') ? [x, y] : [p.x, p.y];
      this.bombs.push({ id: this.nextId++, x: spot[0], y: spot[1], t: BOMB.fuse });
      s.bombs--;
      p.itemT = 0.25;
      this.dirty = true;
      this.emit({ type: 'sfx', name: 'place' });
    } else if (it === 'potion') {
      if (s.potions <= 0) return;
      if (s.hp >= s.maxHp) { this.emit({ type: 'toast', text: 'Your hearts are already full.' }); return; }
      s.potions--; s.hp = s.maxHp;
      this.autoSelect();
      this.dirty = true;
      this.emit({ type: 'sfx', name: 'power' });
      this.emit({ type: 'toast', text: 'Glug glug... hearts refilled!' });
    }
  }

  updateBoomerang(dt) {
    const b = this.boom;
    if (!b) return;
    const p = this.p;
    if (!b.back) {
      const step = BOOMERANG.speed * dt;
      b.x += b.vx * step; b.y += b.vy * step; b.dist += step;
      const tx = Math.floor(b.x / TILE); const ty = Math.floor(b.y / TILE);
      const c = this.cell(tx, ty);
      if (c === 'X') { this.hitCrystal(); b.back = true; } else if (!this.passable(tx, ty, 'fly') || this.solidThingAt(b, 'fly')) {
        if (BREAKABLE[c]) this.breakCell(tx, ty);
        b.back = true;
        this.emit({ type: 'sfx', name: 'bounce' });
      }
      if (b.dist >= BOOMERANG.range) b.back = true;
    } else {
      const dx = p.x - b.x; const dy = p.y - 2 - b.y; const d = Math.hypot(dx, dy);
      if (d < 8) {
        for (const it of b.carry) this.collect(it);
        this.boom = null;
        return;
      }
      const step = Math.min(d, BOOMERANG.back * dt);
      b.x += (dx / d) * step; b.y += (dy / d) * step;
    }
    for (const e of this.enemies) {
      if (e.dead || !overlap(b, e)) continue;
      if (b.hitIds?.has(e.id)) continue;
      (b.hitIds ||= new Set()).add(e.id);
      this.hitEnemy(e, 0, 'boom', b.x, b.y);
      b.back = true;
    }
    for (const it of this.pickups) {
      if (!it.taken && !b.carry.includes(it) && overlap(b, it)) { b.carry.push(it); it.carried = true; }
    }
    for (const it of b.carry) { it.x = b.x; it.y = b.y; }
  }

  updateBombs(dt) {
    for (const bomb of this.bombs) {
      bomb.t -= dt;
      if (bomb.t <= 0) this.explode(bomb);
    }
    this.bombs = this.bombs.filter((b) => b.t > 0);
  }

  explode(bomb) {
    this.emit({ type: 'boom', x: bomb.x, y: bomb.y });
    this.emit({ type: 'sfx', name: 'boom' });
    this.emit({ type: 'shake', ms: 140 });
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - bomb.x, e.y - bomb.y) < BOMB.radius + Math.max(e.w, e.h) / 2) this.hitEnemy(e, BOMB.damage, 'bomb', bomb.x, bomb.y);
    }
    const p = this.p;
    if (Math.hypot(p.x - bomb.x, p.y - bomb.y) < BOMB.hurtPlayer) this.hurtPlayer(1, bomb.x, bomb.y);
    const r = this.room;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const d = Math.hypot(center(x) - bomb.x, center(y) - bomb.y);
        if (d > BOMB.breakReach) continue;
        const c = this.cell(x, y);
        if (c === 'c' && !this.flags[cellFlag(r, x, y)]) this.openCell(x, y, 'The wall crumbled!');
        else if (BREAKABLE[c] && d < BOMB.radius) this.breakCell(x, y);
      }
    }
  }

  /** In the Ember Lab boss room, bombs turn up whenever you run low. */
  bossBombSupply(dt) {
    if (this.s.bombs >= 2 || this.pickups.some((i) => i.kind === 'bombs' && !i.taken)) return;
    this.bombSupplyT -= dt;
    if (this.bombSupplyT > 0) return;
    this.bombSupplyT = 5;
    const spots = [[2, 3], [8, 3], [2, 10], [8, 10]];
    const [x, y] = spots[Math.floor(this.rng() * spots.length)];
    this.addPickup('bombs', center(x), center(y), { keep: true });
  }

  // ------------------------------------------------------------------ shots, pickups, damage

  updateShots(dt) {
    const p = this.p;
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
      const tx = Math.floor(s.x / TILE); const ty = Math.floor(s.y / TILE);
      if (s.t <= 0 || !this.passable(tx, ty, 'fly')) { s.dead = true; continue; }
      if (overlap(s, p)) {
        s.dead = true;
        // Shield: facing the rock (and not mid-swing) blocks it.
        const [fx, fy] = DIR_VEC[p.dir];
        const facing = (fx * s.vx + fy * s.vy) < -0.5 * Math.hypot(s.vx, s.vy);
        if (facing && p.attackT <= 0 && p.kt <= 0) {
          this.emit({ type: 'sfx', name: 'bounce' });
          this.emit({ type: 'block', x: s.x, y: s.y });
        } else this.hurtPlayer(1, s.x - s.vx, s.y - s.vy);
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  addPickup(kind, x, y, { keep = false } = {}) {
    const it = { id: this.nextId++, kind, x, y, w: 10, h: 10, t: keep ? Infinity : 10 };
    this.pickups.push(it);
    return it;
  }

  /** Random loot. Hearts come more often when you're low, bombs when you're out. */
  dropLoot(x, y, chance) {
    const s = this.s;
    if (this.rng() > chance) return;
    const low = s.hp <= s.maxHp / 3;
    const table = [
      ['gem', 5], ['gem5', 2],
      ['heart', (low ? 4 : 2) * this.tune.heartDrop],
      ['bombs', s.items.bombs ? (s.bombs <= 1 ? 5 : 0.8) : 0],
    ];
    const total = table.reduce((a, [, w]) => a + w, 0);
    let r = this.rng() * total;
    for (const [kind, w] of table) {
      r -= w;
      if (r <= 0) { this.addPickup(kind, x, y); return; }
    }
  }

  updatePickups(dt) {
    const p = this.p;
    for (const it of this.pickups) {
      if (it.taken || it.carried) continue;
      it.t -= dt;
      if (it.t <= 0) { it.taken = true; continue; }
      if (overlap(it, p)) this.collect(it);
    }
    this.pickups = this.pickups.filter((i) => !i.taken);
  }

  collect(it) {
    if (it.taken) return;
    it.taken = true;
    const s = this.s;
    const area = this.room.area;
    this.dirty = true;
    switch (it.kind) {
      case 'gem': s.gems = Math.min(999, s.gems + 1); this.emit({ type: 'sfx', name: 'coin' }); break;
      case 'gem5': s.gems = Math.min(999, s.gems + 5); this.emit({ type: 'sfx', name: 'coin' }); break;
      case 'heart': s.hp = Math.min(s.maxHp, s.hp + 2); this.emit({ type: 'sfx', name: 'select' }); break;
      case 'bombs': s.bombs = Math.min(BOMB.max, s.bombs + 3); this.emit({ type: 'sfx', name: 'place' }); break;
      case 'heartC':
        this.flags[`hc:${area}`] = true;
        this.give('heart');
        this.addPickup(this.finalPrize(), ROOM_W / 2, ROOM_H / 2, { keep: true });
        break;
      case 'orb':
        this.emit({ type: 'sfx', name: 'win' });
        this.p.showing = 'orb';
        this.say(['The warp orb hums...', 'It carries you back outside.'], 'orb', { item: 'orb' });
        break;
      case 'crown':
        this.s.done = true;
        this.p.showing = 'crown';
        this.emit({ type: 'sfx', name: 'strike' });
        this.say(['You got the HOLLOW CROWN!', 'The keep trembles... time to go home.'], 'ending', { item: 'crown' });
        break;
      default: break;
    }
  }

  exitDungeon() {
    const entrance = Object.values(ROOMS).find((r) => r.area === this.room.area && r.exits.bottom);
    const ex = entrance.exits.bottom;
    this.warp(ex.to, ex.tx, ex.ty, ex.dir);
  }

  hurtPlayer(dmg, fx, fy) {
    const p = this.p; const s = this.s;
    if (p.inv > 0 || this.mode !== 'play') return;
    s.hp -= dmg;
    this.roomHurt = true;
    p.inv = PLAYER.invuln;
    const ax = p.x - fx; const ay = p.y - fy; const d = Math.hypot(ax, ay) || 1;
    p.kx = (ax / d) * PLAYER.knockSpeed; p.ky = (ay / d) * PLAYER.knockSpeed; p.kt = PLAYER.knock;
    p.attackT = 0;
    this.dirty = true;
    this.emit({ type: 'sfx', name: 'thud' });
    this.emit({ type: 'hurt' });
    if (s.hp <= 0) {
      if (s.potions > 0) {
        s.potions--; s.hp = s.maxHp;
        this.autoSelect();
        this.emit({ type: 'sfx', name: 'power' });
        this.emit({ type: 'toast', text: 'Your potion saved you!' });
        return;
      }
      s.hp = 0;
      s.deaths++;
      this.mode = 'dead';
      this.emit({ type: 'dead' });
    }
  }

  contactDamage() {
    const p = this.p;
    if (p.inv > 0) return;
    for (const e of this.enemies) {
      if (!harmful(e)) continue;
      const box = { x: e.x, y: e.y, w: e.w - 2, h: e.h - 2 };
      if (overlap(box, p)) { this.hurtPlayer(e.dmg, e.x, e.y); return; }
    }
  }

  checkClear() {
    const alive = this.enemies.some((e) => !e.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (!alive && !this.wasClear) {
      this.wasClear = true;
      const r = this.room;
      if (r.area !== 'ow') this.visitCleared[r.id] = true;
      if (r.on.clear) this.fireTrigger('clear');
      else if (r.seal || r.map.some((row) => row.includes('z'))) { this.emit({ type: 'sfx', name: 'power' }); this.emit({ type: 'cells' }); }
      this.emit({ type: 'cleared', id: r.id, hurt: this.roomHurt });
    }
  }

  /** After death: back to the last entrance with everything you'd found. */
  respawn() {
    const s = this.s;
    s.hp = s.maxHp;
    this.visitCleared = {};
    this.mode = 'play';
    const r = s.respawn;
    this.p.inv = 1;
    this.room = null;
    this.enterRoom(r.room, center(r.x), center(r.y), r.dir);
    this.emit({ type: 'respawn' });
  }

  // ------------------------------------------------------------------ moving between rooms

  checkEdges() {
    const p = this.p; const r = this.room;
    let side = null;
    if (p.y < -1) side = 'top'; else if (p.y > ROOM_H + 1) side = 'bottom';
    else if (p.x < -1) side = 'left'; else if (p.x > ROOM_W + 1) side = 'right';
    if (side) {
      const n = neighbour(r, side);
      if (n) return this.scrollTo(n, side);
      const ex = r.exits[side];
      if (ex) return this.warp(ex.to, ex.tx, ex.ty, ex.dir);
      p.x = clamp(p.x, 0, ROOM_W); p.y = clamp(p.y, 0, ROOM_H);
      return null;
    }
    // warp cells (doors, cave mouths, stairs)
    const tx = Math.floor(p.x / TILE); const ty = Math.floor(p.y / TILE);
    const w = r.warps.find((o) => o.x === tx && o.y === ty);
    if (w && Math.abs(p.x - center(tx)) < 7 && this.passable(tx, ty, 'player')) {
      const c = this.cell(tx, ty);
      const deep = c === 'D' && ty === ROWS - 1 ? p.y > center(ty) + 1 : Math.abs(p.y - center(ty)) < 6;
      if (deep) return this.warp(w.to, w.tx, w.ty, w.dir);
    }
    return null;
  }

  scrollTo(n, side) {
    const p = this.p; const from = this.room.id;
    let x = p.x; let y = p.y;
    if (side === 'top') y = ROOM_H - 5; else if (side === 'bottom') y = 5;
    else if (side === 'left') x = ROOM_W - 5; else x = 5;
    this.boom = null;
    this.enterRoom(n.id, x, y, p.dir);
    this.mode = 'scroll';
    this.emit({ type: 'scroll', side, from, to: n.id });
    if (this.instant) this.endTransition();
  }

  warp(to, tx, ty, dir) {
    const from = this.room.id;
    const target = ROOMS[to];
    this.s.respawn = { room: to, x: tx, y: ty, dir };
    // Arriving in a house puts you back outside its door if you fall... houses are safe anyway.
    this.enterRoom(to, center(tx), center(ty), dir);
    this.mode = 'fade';
    this.dirty = true;
    this.emit({ type: 'warp', from, to, area: target.area });
    if (this.instant) this.endTransition();
  }

  endTransition() {
    if (this.mode === 'scroll' || this.mode === 'fade') this.mode = 'play';
  }
}

export { OPPOSITE };
