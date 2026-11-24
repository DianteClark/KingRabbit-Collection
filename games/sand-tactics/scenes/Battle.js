import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, HEIGHT, store, go, modal, toast, setBackground, openHowTo, TEAM_COLOR, fit, money,
} from './common.js';
import * as G from '../logic/game.js';
import { UNITS, UNIT_ORDER, TERRAIN, SIDES, displayHp, isRanged } from '../logic/data.js';
import { aiStep, aiParams } from '../logic/ai.js';
import { mapById, CAMPAIGN } from '../logic/maps.js';
import {
  frame, sprite, setRef, unitRef, isFoot, isSmallVehicle, buildingRef, BOOM, SHOT, DEATH, CURSOR, TILE,
} from '../frames.js';
import { save, saveBattle, loadBattle, clearBattle, missionWon, recordSkirmish } from '../save.js';
import { getSkill, reportResult, SKILL_ID } from '../adaptive.js';

const T = 32; // one map cell on screen (16px art at 2x)
const TOP = 48;
const BOTTOM = 532;
const VIEW_H = BOTTOM - TOP;

const BLUE = 0x5b8fd8;
const RED = 0xd0453f;

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  create() {
    const start = store.start;
    store.start = null;
    this.s = start?.state || loadBattle();
    if (!this.s) { this.scene.start('Menu'); return; }
    this.fresh = !!start?.fresh;
    setBackground(this, '#3b2a2a');
    this.busy = false;
    this.skipping = false;
    this.ui = { mode: 'idle' };
    this.views = new Map();
    this.propViews = new Map();
    this.fast = !!save.get('fast');
    this.resultShown = false;

    this.mapW = this.s.w * T; this.mapH = this.s.h * T;
    this.ox = Math.max(0, Math.floor((WIDTH - this.mapW) / 2));
    this.oy = Math.max(0, Math.floor((VIEW_H - this.mapH) / 2));
    this.scroll = { x: 0, y: 0 };
    this.world = this.add.container(0, 0);
    this.drawGround();
    this.overlay = this.add.graphics();
    this.propLayer = this.add.container(0, 0);
    this.unitLayer = this.add.container(0, 0);
    this.labelLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.cursor = this.add.container(0, 0).setVisible(false);
    for (const [k, [dx, dy]] of Object.entries({ tl: [-12, -12], tr: [12, -12], bl: [-12, 12], br: [12, 12] })) {
      this.cursor.add(sprite(this, dx, dy, CURSOR[k], 2));
    }
    this.tweens.add({ targets: this.cursor, scale: 1.1, yoyo: true, repeat: -1, duration: 400 });
    this.world.add([this.overlay, this.propLayer, this.unitLayer, this.labelLayer, this.fxLayer, this.cursor]);

    this.refreshProps();
    this.refreshUnits();
    this.buildUi();
    this.setupInput();
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.animateIdle() });

    // Start looking at the side to move: its HQ, or its units.
    const focus = G.hqOf(this.s, this.s.turn) || G.unitsOf(this.s, this.s.turn)[0];
    if (focus) this.centerOn(focus.x, focus.y, false); else this.scrollTo(0, this.mapH);

    window.__sand = { scene: this, G, aiStep, aiParams };
    this.refreshHud();
    if (this.fresh) this.intro(); else this.startTurnFlow(false);
  }

  // ---------- Map drawing ----------

  drawGround() {
    const s = this.s;
    const rt = this.add.renderTexture(0, 0, s.w * 16, s.h * 16).setOrigin(0).setScale(2);
    let seed = (s.mapId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const tile = (tx, ty, px, py) => { const [k, f] = frame(this, ['tiles', tx, ty, 8, 8]); rt.drawFrame(k, f, px, py); };
    const t = (x, y) => (G.inMap(s, x, y) ? G.terrainAt(s, x, y) : null);
    // Autotile one 8x8 quarter of a cell from a 3x3 ring block.
    const ring = ([bx, by], x, y, qx, qy, same, fill) => {
      const hx = qx === 0 ? x - 1 : x + 1; const vy = qy === 0 ? y - 1 : y + 1;
      const hDiff = G.inMap(s, hx, y) && !same(t(hx, y));
      const vDiff = G.inMap(s, x, vy) && !same(t(x, vy));
      const col = hDiff ? (qx === 0 ? 0 : 2) : 1;
      const row = vDiff ? (qy === 0 ? 0 : 2) : 1;
      if (col === 1 && row === 1) { if (fill) tile(...fill, x * 16 + qx * 8, y * 16 + qy * 8); else tile(bx + 8, by + 8, x * 16 + qx * 8, y * 16 + qy * 8); return; }
      tile(bx + col * 8, by + row * 8, x * 16 + qx * 8, y * 16 + qy * 8);
    };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const k = t(x, y);
        for (let q = 0; q < 4; q++) {
          const qx = q % 2; const qy = q >> 1;
          const px = x * 16 + qx * 8; const py = y * 16 + qy * 8;
          tile(...pick(TILE.sand), px, py);
          if (k === 'sand' && rnd() < 0.06) tile(...pick(TILE.sandDecal), px, py);
          if (k === 'dunes') ring(TILE.dunesRing, x, y, qx, qy, (o) => o === 'dunes', pick(TILE.dunesFill));
          if (k === 'mesa') { tile(...TILE.mesaFill[0], px, py); ring(TILE.mesaRing, x, y, qx, qy, (o) => o === 'mesa', TILE.mesaFill[rnd() < 0.8 ? 0 : 1]); }
          if (k === 'water') {
            // The pond ring's middle is see-through: lay deep water under it first.
            const deep = rnd() < 0.7 ? [72, 24] : [80, 24];
            tile(...deep, px, py);
            ring(TILE.waterRing, x, y, qx, qy, (o) => o === 'water', deep);
          }
          if (k === 'oasis') tile(...pick(TILE.oasis), px, py);
        }
      }
    }
    // Second pass: edges and objects that may poke into neighbouring cells.
    const obj = (ref, px, py) => { const [kk, f] = frame(this, ['tiles', ...ref, 8, 8]); rt.drawFrame(kk, f, px, py); };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const k = t(x, y);
        const bx = x * 16; const by = y * 16;
        if (k === 'oasis') {
          // Grass edges: light lip on top/left, shadow under the bottom/right, like the tileset's grass pieces.
          const other = (dx, dy) => G.inMap(s, x + dx, y + dy) && t(x + dx, y + dy) !== 'oasis';
          if (other(0, -1)) rt.fill(0xa6b880, 1, bx, by, 16, 1);
          if (other(-1, 0)) rt.fill(0xa6b880, 1, bx, by, 1, 16);
          if (other(0, 1)) rt.fill(0x2e4a3a, 1, bx, by + 15, 16, 1);
          if (other(1, 0)) rt.fill(0x2e4a3a, 1, bx + 15, by, 1, 16);
          // A little pool and palms (shrubs) make it an oasis.
          const pool = rnd() < 0.55;
          if (pool) {
            rt.fill(0x1e5f66, 1, bx + 3, by + 9, 7, 4);
            rt.fill(0x2a8a8a, 1, bx + 4, by + 9, 5, 3);
            rt.fill(0x7fd4c8, 1, bx + 5, by + 10, 2, 1);
          }
          obj(TILE.shrub, bx + (pool ? 7 : 4), by + (pool ? 1 : 3));
          if (!pool || rnd() < 0.5) obj(TILE.shrub, bx + (pool ? 0 : 1), by + (pool ? 0 : 8));
        }
        if (k === 'mesa') {
          // Boulders on every plateau so mesas read as rough high ground.
          obj(pick(TILE.rocks), bx + 1 + Math.floor(rnd() * 4), by + Math.floor(rnd() * 3));
          if (rnd() < 0.6) obj(pick(TILE.rocks), bx + 7 + Math.floor(rnd() * 2), by + 5 + Math.floor(rnd() * 2));
        }
      }
    }
    // Faint grid so cells are easy to read.
    const g = this.add.graphics();
    g.lineStyle(1, 0x000000, 0.12);
    for (let x = 1; x < s.w; x++) g.lineBetween(x * T, 0, x * T, s.h * T);
    for (let y = 1; y < s.h; y++) g.lineBetween(0, y * T, s.w * T, y * T);
    this.world.add([rt, g]);
  }

  cellCenter(x, y) { return [x * T + T / 2, y * T + T / 2]; }

  refreshProps() {
    const s = this.s;
    for (const p of s.props) {
      const key = `${p.x},${p.y}`;
      let v = this.propViews.get(key);
      const [cx] = this.cellCenter(p.x, p.y);
      const by = (p.y + 1) * T;
      if (!v) {
        v = { img: sprite(this, cx, by, buildingRef(p.kind, p.owner), 2).setOrigin(0.5, 1), owner: null };
        this.propLayer.add(v.img);
        // Small owner flag in the corner so ownership reads at a glance.
        v.plate = this.add.rectangle(p.x * T + 3, p.y * T + T - 3, 9, 7, BLUE).setOrigin(0, 1).setStrokeStyle(1, 0x040303);
        this.labelLayer.add(v.plate);
        v.cap = text(this, p.x * T + 4, p.y * T + 2, '', { origin: [0, 0], color: PALETTE.cream });
        v.capBg = this.add.rectangle(p.x * T + 2, p.y * T + 2, 20, 18, hex(PALETTE.ink), 0.85).setOrigin(0);
        this.labelLayer.add([v.capBg, v.cap]);
        this.propViews.set(key, v);
      }
      if (v.owner !== p.owner) {
        setRef(this, v.img, buildingRef(p.kind, p.owner)); v.owner = p.owner;
        v.plate.setFillStyle(p.owner === 0 ? BLUE : p.owner === 1 ? RED : 0xcfc6b8, 1).setVisible(p.owner >= 0);
      }
      const capturing = p.capBy && G.unitById(s, p.capBy);
      // Capture progress: points left, on a flag in the capturing side's colour.
      v.cap.setText(capturing ? `${p.cap}` : '').setColor(PALETTE.cream);
      v.capBg.setVisible(!!capturing).setSize(v.cap.width + 6, 18);
      if (capturing) v.capBg.setFillStyle(capturing.side === 0 ? 0x2c4a80 : 0x6e2224, 1).setStrokeStyle(1, 0xf9f5ef);
    }
    this.propLayer.sort('y');
  }

  facingFor(u) { return u.side === 0 ? 'up' : 'down'; }

  makeView(u) {
    const art = UNITS[u.type].art;
    const [cx, cy] = this.cellCenter(u.x, u.y);
    const c = this.add.container(cx, cy);
    const sprs = [];
    if (isFoot(art)) {
      // A squad of two soldiers.
      const back = sprite(this, 6, -4, unitRef(art, u.side), 2);
      const front = sprite(this, -5, 3, unitRef(art, u.side), 2);
      sprs.push(back, front);
      if (u.side === 1) for (const sp of sprs) sp.setFlipX(true);
    } else {
      const small = isSmallVehicle(art);
      sprs.push(sprite(this, 0, UNITS[u.type].air ? -4 : 0, unitRef(art, u.side, this.facingFor(u)), small ? 3 : 2));
    }
    if (UNITS[u.type].air) {
      const sh = this.add.ellipse(0, 10, 22, 7, 0x000000, 0.25);
      c.add(sh);
    }
    c.add(sprs);
    const hpBg = this.add.rectangle(T / 2 - 1, T / 2 - 1, 14, 18, hex(PALETTE.ink), 0.9).setOrigin(1, 1);
    const hp = text(this, T / 2 - 3, T / 2 - 1, '', { origin: [1, 1], color: PALETTE.cream });
    c.add([hpBg, hp]);
    const v = { c, sprs, hp, hpBg, art, side: u.side, facing: this.facingFor(u), frame: 0, anim: 'idle' };
    this.unitLayer.add(c);
    return v;
  }

  setFacing(v, facing) {
    v.facing = facing;
    if (isFoot(v.art)) {
      const flip = facing === 'left' || (facing === 'down' && v.side === 1) || (facing === 'up' && v.side === 1);
      for (const sp of v.sprs) sp.setFlipX(facing === 'right' ? false : flip);
    } else for (const sp of v.sprs) setRef(this, sp, unitRef(v.art, v.side, facing));
  }

  /** Bring every unit view in line with the game state. */
  refreshUnits() {
    const s = this.s;
    const alive = new Set();
    for (const u of s.units) {
      alive.add(u.id);
      let v = this.views.get(u.id);
      if (!v) { v = this.makeView(u); this.views.set(u.id, v); }
      const [cx, cy] = this.cellCenter(u.x, u.y);
      v.c.setPosition(cx, cy).setVisible(true).setAlpha(1);
      const hp = displayHp(u.hp);
      v.hp.setText(hp < 10 ? `${hp}` : '');
      v.hpBg.setVisible(hp < 10);
      const dim = u.done && u.side === s.turn && !s.over;
      for (const sp of v.sprs) { if (dim) sp.setTint(0xa8a0a0); else sp.clearTint(); }
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { v.c.destroy(); this.views.delete(id); }
    this.unitLayer.sort('y');
    this.refreshProps();
  }

  animateIdle() {
    for (const v of this.views.values()) {
      if (!isFoot(v.art) || v.anim !== 'idle') continue;
      v.frame = (v.frame + 1) % 4;
      v.sprs.forEach((sp, i) => setRef(this, sp, unitRef(v.art, v.side, 'right', 'idle', v.frame + i)));
    }
  }

  // ---------- Scrolling ----------

  scrollTo(x, y) {
    const maxX = Math.max(0, this.mapW - WIDTH);
    const maxY = Math.max(0, this.mapH - VIEW_H);
    this.scroll.x = Phaser.Math.Clamp(x, 0, maxX);
    // While a hint strip covers the top of the map, allow scrolling a little further so row 0 can be seen.
    const minY = -Math.max(0, (this.coachBox?.active ? this.coachBox.hitH : 0) - this.oy);
    this.scroll.y = Phaser.Math.Clamp(y, minY, maxY);
    this.world.setPosition(Math.round(this.ox - this.scroll.x), Math.round(TOP + this.oy - this.scroll.y));
  }

  centerOn(tx, ty, smooth = true) {
    const x = tx * T + T / 2 - WIDTH / 2; const y = ty * T + T / 2 - VIEW_H / 2;
    if (!smooth) { this.scrollTo(x, y); return Promise.resolve(); }
    return this.panTo(x, y);
  }

  panTo(x, y) {
    const from = { ...this.scroll };
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 0, to: 1, duration: this.dur(220),
        onUpdate: (tw) => { const v = tw.getValue(); this.scrollTo(from.x + (x - from.x) * v, from.y + (y - from.y) * v); },
        onComplete: res,
      });
    });
  }

  /** Scroll just enough that tile (tx, ty) is comfortably on screen. */
  follow(tx, ty) {
    const px = tx * T + T / 2 + this.ox - this.scroll.x; const py = ty * T + T / 2 + this.oy - this.scroll.y;
    const m = 72;
    let nx = this.scroll.x; let ny = this.scroll.y;
    if (px < m) nx -= m - px; if (px > WIDTH - m) nx += px - (WIDTH - m);
    if (py < m) ny -= m - py; if (py > VIEW_H - m) ny += py - (VIEW_H - m);
    if (nx === this.scroll.x && ny === this.scroll.y) return Promise.resolve();
    return this.panTo(nx, ny);
  }

  setupInput() {
    let down = null;
    this.input.on('pointerdown', (p) => {
      if (this.modalOpen()) { down = null; return; }
      if (this.busy) { this.skipping = true; down = null; return; }
      if (p.y < TOP || p.y > BOTTOM || this.coachHit(p)) { down = null; return; }
      down = { x: p.x, y: p.y, sx: this.scroll.x, sy: this.scroll.y, drag: false };
    });
    this.input.on('pointermove', (p) => {
      if (!down || !p.isDown) return;
      const dx = p.x - down.x; const dy = p.y - down.y;
      if (!down.drag && Math.hypot(dx, dy) > 10) down.drag = true;
      if (down.drag) this.scrollTo(down.sx - dx, down.sy - dy);
    });
    this.input.on('pointerup', (p) => {
      if (!down) return;
      const d = down; down = null;
      if (d.drag || this.busy || this.modalOpen()) return;
      const wx = p.x - this.ox + this.scroll.x; const wy = p.y - TOP - this.oy + this.scroll.y;
      const tx = Math.floor(wx / T); const ty = Math.floor(wy / T);
      if (!G.inMap(this.s, tx, ty)) return;
      this.tapTile(tx, ty);
    });
  }

  modalOpen() { return !!document.getElementById('howto') || this.children.list.some((c) => c.depth >= 100 && c.active && c.visible); }

  // ---------- HUD ----------

  buildUi() {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, TOP);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, TOP - 3, WIDTH, 3);
    g.fillStyle(hex(PALETTE.night)).fillRect(0, BOTTOM, WIDTH, HEIGHT - BOTTOM);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, BOTTOM, WIDTH, 3);
    this.turnStripe = this.add.rectangle(0, TOP - 3, WIDTH, 3, BLUE).setOrigin(0).setDepth(11);
    const add = (o) => o.setDepth(11);
    add(button(this, 28, 23, 44, 36, '<', () => this.leave(), { size: 32, fill: PALETTE.cream }));
    add(button(this, WIDTH - 28, 23, 44, 36, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold }));
    this.dayText = add(text(this, WIDTH / 2, 13, '', { color: PALETTE.cream }));
    this.fundsText = add(text(this, WIDTH / 2, 34, '', { color: PALETTE.gold }));
    this.panel = this.add.container(0, 0).setDepth(11);
  }

  refreshHud() {
    const s = this.s; const side = s.turn;
    this.dayText.setText(`Day ${s.day}  -  ${SIDES[side].name}'s turn`).setColor(TEAM_COLOR[side]);
    const shown = this.humanSide();
    this.fundsText.setText(`${SIDES[shown].name} funds ${money(s.funds[shown])}  (+${money(G.incomeOf(s, shown))})`);
    fit(this.fundsText.setScale(1), 230);
    this.turnStripe.setFillStyle(side === 0 ? BLUE : RED);
  }

  /** The side whose funds the header shows: the human, or in 2-player games whoever is moving. */
  humanSide() {
    const c = this.s.controllers;
    if (c[0] === 'human' && c[1] === 'human') return this.s.turn;
    return c[0] === 'human' ? 0 : 1;
  }

  isHumanTurn() { return this.s.controllers[this.s.turn] === 'human' && !this.s.over; }

  clearPanel() { this.panel.removeAll(true); }

  pText(x, y, str, opts = {}) { const t = text(this, x, y, str, { origin: [0, 0.5], ...opts }); this.panel.add(t); return t; }

  pButton(x, y, w, h, label, fn, opts) { const b = button(this, x, y, w, h, label, fn, opts); this.panel.add(b); return b; }

  /** Idle panel: info about the tapped tile, Next and End Turn. */
  showIdlePanel(info) {
    this.clearPanel();
    this.ui = { mode: 'idle' };
    this.time.delayedCall(0, () => this.coachUpdate());
    const lines = info || this.defaultInfo();
    lines.forEach((l, i) => fit(this.pText(12, 556 + i * 24, l.text || l, { color: l.color || PALETTE.cream }), 210));
    if (this.isHumanTurn()) {
      const ready = G.readyUnits(this.s, this.s.turn).length;
      this.pButton(292, 562, 120, 40, 'End Turn', () => this.askEndTurn(), { fill: ready ? PALETTE.lavender : PALETTE.gold });
      this.pButton(292, 612, 120, 36, ready ? `Next (${ready})` : 'Next', () => this.nextUnit(), { fill: PALETTE.indigo, color: PALETTE.cream }).setEnabled(ready > 0);
    }
  }

  defaultInfo() {
    const s = this.s;
    if (!this.isHumanTurn()) return [];
    const side = s.turn;
    const ready = G.readyUnits(s, side).length;
    const facs = s.props.filter((p) => p.kind === 'factory' && p.owner === side && !G.unitAt(s, p.x, p.y)).length;
    const out = [];
    out.push({ text: ready ? `${ready} unit${ready > 1 ? 's' : ''} ready to act` : 'All units have acted', color: PALETTE.cream });
    if (facs && s.funds[side] >= 1000) out.push({ text: 'Tap a factory to build', color: PALETTE.sand });
    out.push({ text: objectiveLine(s, side), color: PALETTE.lavender });
    return out;
  }

  tileInfo(x, y) {
    const s = this.s;
    const u = G.unitAt(s, x, y);
    const p = G.propAt(s, x, y);
    const tk = G.terrainAt(s, x, y);
    const stars = TERRAIN[tk].def;
    const lines = [];
    if (u) {
      const d = UNITS[u.type];
      lines.push({ text: `${SIDES[u.side].name} ${d.name}  HP ${displayHp(u.hp)}/10`, color: TEAM_COLOR[u.side] });
      lines.push({ text: `Move ${d.move}${d.range[1] > 1 ? `, range ${d.range[0]}-${d.range[1]}` : ''}${d.capture ? ', captures' : ''}`, color: PALETTE.cream });
    }
    let tline = `${TERRAIN[tk].name}  ${'*'.repeat(stars) || '-'} defence`;
    if (p) tline = `${p.owner < 0 ? 'Neutral' : SIDES[p.owner].name} ${TERRAIN[tk].name}  ${'*'.repeat(stars)}`;
    lines.push({ text: tline, color: PALETTE.sand });
    if (p && p.capBy) lines.push({ text: `Being captured: ${p.cap}/20 left`, color: PALETTE.orange });
    else if (!u && p && p.kind === 'factory') lines.push({ text: p.owner === s.turn ? 'Tap again to build' : 'Builds units', color: PALETTE.lavender });
    else if (!u) lines.push({ text: moveLine(tk), color: PALETTE.lavender });
    return lines.slice(0, 3);
  }

  // ---------- Highlights ----------

  clearHighlights() { this.overlay.clear(); this.cursor.setVisible(false); }

  showCursor(x, y) {
    const [cx, cy] = this.cellCenter(x, y);
    this.cursor.setPosition(cx, cy).setVisible(true);
  }

  fillCells(cells, color, alpha, edge = true) {
    const g = this.overlay;
    g.fillStyle(color, alpha);
    for (const [x, y] of cells) g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
    if (!edge) return;
    g.lineStyle(2, color, 1);
    for (const [x, y] of cells) g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
  }

  /** Tiles a unit could attack this turn (from anywhere it can move, or from where it stands if ranged). */
  attackCells(u, reach) {
    const s = this.s;
    const out = new Map();
    const add = (x, y) => { if (G.inMap(s, x, y)) out.set(G.idx(s, x, y), [x, y]); };
    if (isRanged(u.type)) for (const [x, y] of G.rangeTiles(s, u.type, u.x, u.y)) add(x, y);
    else {
      for (const n of reach.values()) {
        if (!n.stop) continue;
        add(n.x + 1, n.y); add(n.x - 1, n.y); add(n.x, n.y + 1); add(n.x, n.y - 1);
      }
    }
    return out;
  }

  showRanges(u, enemyView = false) {
    this.clearHighlights();
    const reach = G.reachable(this.s, u);
    const move = [...reach.values()].map((n) => [n.x, n.y]);
    const atk = [...this.attackCells(u, reach).entries()].filter(([i]) => !reach.has(i) || isRanged(u.type)).map(([, c]) => c);
    if (enemyView) {
      this.fillCells(move, RED, 0.25);
      this.fillCells(atk, RED, 0.5);
    } else {
      this.fillCells(move, 0x3d6fd0, 0.55);
      this.fillCells(atk, RED, 0.5);
      // Outline targets already in reach.
      const g = this.overlay;
      g.lineStyle(3, 0xffffff, 0.9);
      const cells = this.attackCells(u, reach);
      for (const v of this.s.units) {
        if (v.side === u.side || !G.canHit(u.type, v.type)) continue;
        if (cells.has(G.idx(this.s, v.x, v.y))) g.strokeRect(v.x * T + 2, v.y * T + 2, T - 4, T - 4);
      }
    }
    this.showCursor(u.x, u.y);
    return reach;
  }

  // ---------- Tapping ----------

  tapTile(x, y) {
    if (this.busy || this.s.over) return;
    const s = this.s;
    const ui = this.ui;
    const u = G.unitAt(s, x, y);
    if (!this.isHumanTurn()) { this.showInfoAt(x, y); return; }

    if (ui.mode === 'selected') {
      const sel = G.unitById(s, ui.id);
      const node = ui.reach.get(G.idx(s, x, y));
      if (u && u.side !== sel.side) {
        // Tap an enemy: walk next to it if possible and show the forecast.
        const from = this.bestTileToHit(sel, ui.reach, u);
        if (from) { this.moveSelected(sel, from[0], from[1], u); return; }
      }
      if (node && node.stop) { this.moveSelected(sel, x, y); return; }
      if (u && u.side === s.turn && u.id !== sel.id && !u.done) { this.selectUnit(u); return; }
      sfx('tap');
      this.deselect();
      this.showInfoAt(x, y);
      return;
    }
    if (ui.mode === 'moved' || ui.mode === 'target') {
      const sel = G.unitById(s, ui.id);
      if (u && ui.targets?.includes(u)) { this.showForecast(sel, u); return; }
      if (ui.mode === 'moved' && u && u.id === sel.id) return;
      sfx('error');
      return;
    }
    if (ui.mode === 'confirm') {
      const sel = G.unitById(s, ui.id);
      if (u && ui.targets?.includes(u)) { this.showForecast(sel, u); return; }
      return;
    }
    // Idle.
    if (u && u.side === s.turn && !u.done) { this.selectUnit(u); return; }
    const p = G.propAt(s, x, y);
    if (!u && p && p.kind === 'factory' && p.owner === s.turn) {
      this.openBuild(p);
      return;
    }
    this.showInfoAt(x, y);
  }

  showInfoAt(x, y) {
    const s = this.s;
    const u = G.unitAt(s, x, y);
    this.clearHighlights();
    const ownDone = u && u.done && u.side === s.turn && this.isHumanTurn();
    if (u && !ownDone) this.showRanges(u, u.side !== s.turn || !this.isHumanTurn());
    else this.showCursor(x, y);
    this.lastTap = [x, y];
    this.showIdlePanel(this.tileInfo(x, y));
  }

  selectUnit(u) {
    sfx('select');
    this.time.delayedCall(0, () => this.coachUpdate());
    const reach = this.showRanges(u);
    this.ui = { mode: 'selected', id: u.id, reach };
    this.clearPanel();
    const d = UNITS[u.type];
    fit(this.pText(12, 556, `${d.name}  HP ${displayHp(u.hp)}/10  Move ${d.move}`, { color: TEAM_COLOR[u.side] }), 336);
    fit(this.pText(12, 580, 'Tap a blue tile, or an enemy in red.', { color: PALETTE.cream }), 336);
    // Acting without moving (fire from here, capture, or just wait) is one tap away.
    this.pButton(96, 616, 168, 38, 'Act here', () => this.moveSelected(u, u.x, u.y), { fill: PALETTE.lavender });
    this.pButton(280, 616, 144, 38, 'Cancel', () => this.deselect(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.follow(u.x, u.y);
  }

  deselect() {
    this.clearHighlights();
    this.ui = { mode: 'idle' };
    this.showIdlePanel();
  }

  /** Best reachable tile from which u can hit v (prefers staying put, then defence, then short moves). */
  bestTileToHit(u, reach, v) {
    const s = this.s;
    if (!G.canHit(u.type, v.type)) return null;
    let best = null;
    for (const n of reach.values()) {
      if (!n.stop) continue;
      const moved = n.x !== u.x || n.y !== u.y;
      if (!G.targetsFrom(s, u, n.x, n.y, moved).includes(v)) continue;
      const score = (moved ? 0 : 100) + G.defStars(s, u.type, n.x, n.y) * 10 - n.c;
      if (!best || score > best.score) best = { score, x: n.x, y: n.y };
    }
    return best ? [best.x, best.y] : null;
  }

  async moveSelected(u, x, y, target) {
    const s = this.s;
    const reach = this.ui.reach;
    const path = G.pathTo(reach, G.idx(s, x, y));
    this.clearHighlights();
    this.busy = true;
    if (path.length > 1) { sfx('move'); await this.animateMove(u, path, true); }
    this.busy = false;
    this.skipping = false;
    this.ui = { mode: 'moved', id: u.id, to: [x, y], path, reach };
    this.showCursor(x, y);
    if (target) this.showForecast(u, target);
    else this.showActions(u);
  }

  /** Action buttons after a (not yet committed) move. */
  showActions(u) {
    const s = this.s;
    this.time.delayedCall(0, () => this.coachUpdate());
    const [x, y] = this.ui.to;
    const moved = x !== u.x || y !== u.y;
    const targets = G.targetsFrom(s, u, x, y, moved);
    this.ui.targets = targets;
    this.ui.mode = 'moved';
    this.clearHighlights();
    this.showCursor(x, y);
    this.fillCells(targets.map((v) => [v.x, v.y]), RED, 0.5);
    this.clearPanel();
    const acts = [];
    if (targets.length) acts.push(['Fire', () => this.chooseTarget(u), PALETTE.orange]);
    if (G.canCaptureAt(s, u, x, y)) {
      const p = G.propAt(s, x, y);
      acts.push(['Capture', () => this.commit({ id: u.id, to: [x, y], action: 'capture' }), PALETTE.gold]);
      fit(this.pText(12, 556, `Capture: ${p.cap} - ${displayHp(u.hp)} = ${Math.max(0, p.cap - displayHp(u.hp))} left`, { color: PALETTE.sand }), 336);
    } else {
      const d = UNITS[u.type];
      let hint = 'Wait here, or Undo the move.';
      if (isRanged(u.type) && moved) hint = 'Artillery can\'t fire after moving.';
      else if (targets.length) hint = `${targets.length} target${targets.length > 1 ? 's' : ''} in range.`;
      fit(this.pText(12, 556, `${d.name}: ${hint}`, { color: PALETTE.cream }), 336);
    }
    acts.push(['Wait', () => this.commit({ id: u.id, to: [x, y], action: 'wait' }), PALETTE.lavender]);
    acts.push(['Undo', () => this.undoMove(), PALETTE.indigo]);
    const w = Math.floor((WIDTH - 16 - (acts.length - 1) * 8) / acts.length);
    acts.forEach(([label, fn, fill], i) => {
      this.pButton(8 + w / 2 + i * (w + 8), 604, w, 46, label, fn, { fill, color: fill === PALETTE.indigo ? PALETTE.cream : PALETTE.night });
    });
  }

  chooseTarget(u) {
    if (this.ui.targets.length === 1) { this.showForecast(u, this.ui.targets[0]); return; }
    this.ui.mode = 'target';
    this.clearPanel();
    this.pText(12, 566, 'Tap a red target.', { color: PALETTE.orange });
    this.pButton(296, 604, 112, 46, 'Back', () => this.showActions(u), { fill: PALETTE.indigo, color: PALETTE.cream });
  }

  showForecast(u, v) {
    const s = this.s;
    this.time.delayedCall(0, () => this.coachUpdate());
    const [x, y] = this.ui.to;
    const f = G.forecast(s, u, x, y, v);
    this.ui.mode = 'confirm';
    this.ui.targets = this.ui.targets || G.targetsFrom(s, u, x, y, x !== u.x || y !== u.y);
    this.clearHighlights();
    this.showCursor(x, y);
    this.fillCells(this.ui.targets.map((t) => [t.x, t.y]), RED, 0.3);
    this.overlay.lineStyle(3, 0xffffff, 1).strokeRect(v.x * T + 1, v.y * T + 1, T - 2, T - 2);
    this.clearPanel();
    const vName = UNITS[v.type].name; const uName = UNITS[u.type].name;
    const after = displayHp(v.hp - f.dmg);
    fit(this.pText(12, 552, f.kills ? `Destroys the ${vName}!` : `Deal ${f.dmg}%: ${vName} ${displayHp(v.hp)} -> ${after}`, { color: f.kills ? PALETTE.gold : PALETTE.cream }), 336);
    let back = 'No counterattack';
    if (f.counter) back = f.counterKills ? `Counter destroys your ${uName}!` : `Counter ${f.counter}%: your ${uName} ${displayHp(u.hp)} -> ${displayHp(u.hp - f.counter)}`;
    fit(this.pText(12, 574, back, { color: f.counterKills ? PALETTE.orange : f.counter ? PALETTE.sand : PALETTE.lavender }), 336);
    this.pButton(96, 614, 176, 42, 'Fire!', () => this.commit({ id: u.id, to: [x, y], action: 'attack', target: v.id }), { fill: PALETTE.orange });
    this.pButton(276, 614, 152, 42, 'Back', () => this.showActions(u), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.follow(v.x, v.y);
  }

  undoMove() {
    const u = G.unitById(this.s, this.ui.id);
    sfx('tap');
    if (u) {
      const v = this.views.get(u.id);
      const [cx, cy] = this.cellCenter(u.x, u.y);
      v.c.setPosition(cx, cy);
      this.setFacing(v, this.facingFor(u));
      this.unitLayer.sort('y');
      this.selectUnit(u);
    } else this.deselect();
  }

  async commit(cmd) {
    const s = this.s;
    let events;
    try { events = G.act(s, cmd); } catch (e) { console.warn(e); sfx('error'); this.deselect(); return; }
    this.clearHighlights();
    this.clearPanel();
    this.busy = true;
    // The move was already animated before the choice.
    await this.playEvents(events.filter((e) => e.type !== 'move'));
    this.busy = false;
    this.skipping = false;
    this.afterAction();
  }

  afterAction() {
    this.coachActs = (this.coachActs || 0) + 1;
    this.refreshUnits();
    this.refreshHud();
    saveBattle(this.s);
    if (this.s.over) { this.showResult(); return; }
    this.ui = { mode: 'idle' };
    this.showIdlePanel();
  }

  nextUnit() {
    const ready = G.readyUnits(this.s, this.s.turn);
    if (!ready.length) return;
    this.nextIdx = ((this.nextIdx ?? -1) + 1) % ready.length;
    const u = ready[this.nextIdx];
    this.centerOn(u.x, u.y).then(() => this.selectUnit(u));
  }

  // ---------- Building ----------

  openBuild(p) {
    const s = this.s;
    const side = s.turn;
    sfx('select');
    this.clearHighlights();
    this.showCursor(p.x, p.y);
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    const rowH = 46;
    const top = 8;
    const h = 64 + UNIT_ORDER.length * rowH + 62;
    c.add(panel(this, 8, top, WIDTH - 16, h, { fill: PALETTE.night, inner: PALETTE.sand }));
    c.add(text(this, WIDTH / 2, top + 22, 'Build', { size: 32, color: PALETTE.gold }));
    const full = G.unitsOf(s, side).length >= G.UNIT_CAP;
    c.add(text(this, WIDTH / 2, top + 48, full ? `Unit limit reached (${G.UNIT_CAP})` : `Funds ${money(s.funds[side])}`, { color: full ? PALETTE.orange : PALETTE.cream }));
    const close = () => { if (c.active) c.destroy(); this.showIdlePanel(); this.clearHighlights(); };
    UNIT_ORDER.forEach((t, i) => {
      const d = UNITS[t];
      const y = top + 64 + i * rowH;
      const ok = s.funds[side] >= d.cost && !full;
      const row = this.add.container(0, 0).setAlpha(ok ? 1 : 0.45);
      row.add(this.add.rectangle(20, y + 2, WIDTH - 40, rowH - 4, i % 2 ? hex(PALETTE.indigo) : 0x3a3456, 1).setOrigin(0));
      const art = d.art;
      const icon = sprite(this, 44, y + rowH / 2, unitRef(art, side, side === 0 ? 'right' : 'left'), isFoot(art) || isSmallVehicle(art) ? 3 : 2);
      if (isFoot(art) && side === 1) icon.setFlipX(true);
      row.add(icon);
      row.add(text(this, 74, y + 14, d.name, { origin: [0, 0.5], color: PALETTE.cream }));
      row.add(text(this, WIDTH - 30, y + 14, money(d.cost), { origin: [1, 0.5], color: ok ? PALETTE.gold : PALETTE.orange }));
      row.add(fit(text(this, 74, y + 33, `Move ${d.move}${d.range[1] > 1 ? `  Range ${d.range[0]}-${d.range[1]}` : ''}  ${shortRole(t)}`, { origin: [0, 0.5], color: PALETTE.lavender }), WIDTH - 104));
      const z = this.add.zone(20, y + 2, WIDTH - 40, rowH - 4).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (!ok) { sfx('error'); toast(this, full ? 'Unit limit reached' : 'Not enough funds', 600, PALETTE.orange, 700, 120); return; }
        c.destroy();
        this.doBuild(p, t);
      });
      row.add(z);
      c.add(row);
    });
    c.add(button(this, WIDTH / 2, top + h - 32, 200, 42, 'Close', close, { fill: PALETTE.lavender }));
  }

  doBuild(p, type) {
    try { G.build(this.s, p.x, p.y, type); } catch (e) { sfx('error'); return; }
    sfx('coin');
    this.refreshUnits();
    const u = G.unitAt(this.s, p.x, p.y);
    const v = this.views.get(u.id);
    v.c.setScale(0.2);
    this.tweens.add({ targets: v.c, scale: 1, duration: 200, ease: 'Back.Out' });
    this.refreshHud();
    saveBattle(this.s);
    this.showIdlePanel();
    this.clearHighlights();
  }

  // ---------- Turns ----------

  askEndTurn() {
    const ready = G.readyUnits(this.s, this.s.turn).length;
    if (ready) {
      modal(this, 'End turn?', [`${ready} unit${ready > 1 ? 's' : ''} can still act.`], [
        ['End Turn', () => this.endTurn()], ['Keep playing', null],
      ], { row: true });
    } else this.endTurn();
  }

  endTurn() {
    (this.sideScroll ||= {})[this.s.turn] = { ...this.scroll };
    this.clearHighlights();
    this.ui = { mode: 'idle' };
    this.nextIdx = -1;
    const report = G.endTurn(this.s);
    saveBattle(this.s);
    this.refreshUnits();
    this.refreshHud();
    this.startTurnFlow(true, report);
  }

  /** Begin whatever comes next: the computer's moves, a hand-over in 2-player games, or the result. */
  async startTurnFlow(announce = true, report = null) {
    const s = this.s;
    if (s.over) { this.showResult(); return; }
    const side = s.turn;
    if (s.controllers[side] === 'cpu') { if (!this.fast) await this.banner(`${SIDES[side].name}'s turn`, side); this.runCpu(); return; }
    const twoPlayers = s.controllers[0] === 'human' && s.controllers[1] === 'human';
    const begin = () => {
      // Look where this commander was looking at the end of their last turn (or at their HQ).
      const back = this.sideScroll?.[side];
      const focus = G.hqOf(s, side) || G.unitsOf(s, side)[0];
      if (back) this.panTo(back.x, back.y);
      else if (focus && announce) this.centerOn(focus.x, focus.y);
      this.showIdlePanel();
      if (report) {
        const bits = [];
        if (report.income || report.harvest) bits.push(`+${money(report.income + (report.harvest || 0))} funds`);
        const fixed = report.repaired.length + (report.supplied?.length || 0);
        if (fixed) bits.push(`${fixed} repaired`);
        if (bits.length) toast(this, `Day ${s.day}: ${bits.join(', ')}`, 500, PALETTE.gold);
      }
    };
    if (twoPlayers && announce) {
      this.clearPanel();
      modal(this, `${SIDES[side].name}'s turn`, [`Day ${s.day}. Pass the phone to the ${SIDES[side].name} commander.`], [['Start turn', () => { sfx('power'); begin(); }]]);
    } else if (announce) { await this.banner(`Day ${s.day}: your turn`, side); begin(); } else begin();
  }

  banner(msg, side) {
    return new Promise((res) => {
      const y = TOP + VIEW_H / 2;
      const bg = this.add.rectangle(WIDTH / 2, y, WIDTH, 56, side === 0 ? 0x2c4a80 : 0x6e2224, 0.92).setDepth(60);
      const t = text(this, WIDTH / 2, y, msg, { size: 32, color: PALETTE.cream }).setDepth(61);
      fit(t, WIDTH - 20);
      bg.setScale(1, 0); t.setAlpha(0);
      this.tweens.add({ targets: bg, scaleY: 1, duration: 120 });
      this.tweens.add({ targets: t, alpha: 1, duration: 120 });
      this.time.delayedCall(this.fast ? 300 : 900, () => {
        this.tweens.add({ targets: [bg, t], alpha: 0, duration: 150, onComplete: () => { bg.destroy(); t.destroy(); res(); } });
      });
    });
  }

  showCpuPanel() {
    this.clearPanel();
    const side = this.s.turn;
    this.pText(12, 566, `${SIDES[side].army} are moving...`, { color: TEAM_COLOR[side] });
    this.pText(12, 594, 'Tap the map to skip animations.', { color: PALETTE.lavender });
    const b = this.pButton(296, 614, 112, 40, this.fast ? 'Fast: on' : 'Fast: off', () => {
      this.fast = !this.fast; save.set('fast', this.fast); b.setLabel(this.fast ? 'Fast: on' : 'Fast: off');
    }, { fill: PALETTE.indigo, color: PALETTE.cream });
  }

  async runCpu() {
    const s = this.s;
    const side = s.turn;
    const P = aiParams(Math.min(getSkill(), s.cpuCap ?? 1));
    this.busy = true;
    this.cpuRunning = true;
    this.coachUpdate();
    this.showCpuPanel();
    this.clearHighlights();
    let guard = 0;
    let think = 0;
    while (!s.over && s.turn === side && guard++ < 300) {
      if (!this.scene.isActive()) return;
      while (this.modalOpen() && this.scene.isActive()) await new Promise((r) => setTimeout(r, 150));
      // Cap the thinking per turn: past the budget the computer decides unit by unit.
      const t0 = performance.now();
      const step = aiStep(s, side, P, { quick: think > 1200 });
      think += performance.now() - t0;
      if (!step) break;
      if (step.kind === 'build') {
        G.build(s, step.x, step.y, step.type);
        const shown = this.onScreen(step.x, step.y);
        this.refreshUnits();
        if (shown || !this.fast) {
          if (!shown) await this.follow(step.x, step.y);
          sfx('coin');
          const u = G.unitAt(s, step.x, step.y);
          const v = this.views.get(u.id);
          v.c.setScale(0.2);
          await this.tweenP({ targets: v.c, scale: 1, duration: this.dur(220), ease: 'Back.Out' });
        }
        this.refreshHud();
      } else {
        const u = G.unitById(s, step.cmd.id);
        const from = [u.x, u.y];
        const events = G.act(s, step.cmd);
        const big = events.some((e) => e.type === 'attack' || e.type === 'captured' || e.type === 'over');
        const seen = this.onScreen(...from) || this.onScreen(...step.cmd.to);
        if (big) {
          // Fights and finished captures are always shown.
          if (!this.onScreen(...from) || !this.onScreen(...step.cmd.to)) await this.follow(...from);
          await this.playEvents(events, this.fast);
        } else if (seen && !this.fast) {
          // Plain moves on screen: animate (briskly in Fast mode), no camera moves.
          await this.playEvents(events, this.fast);
        }
        // Moves that happen off screen (or any plain move in Fast mode) are applied at once (batched).
        this.refreshUnits();
        this.refreshHud();
        if (!big && !seen) continue;
      }
      saveBattle(s);
      this.skipping = false;
      if (!this.fast) await this.wait(120);
    }
    this.cpuRunning = false;
    this.busy = false;
    this.skipping = false;
    this.cpuStats = { think: Math.round(think), steps: guard };
    if (!this.scene.isActive()) return;
    saveBattle(s);
    if (s.over) { this.refreshUnits(); this.showResult(); return; }
    const report = G.endTurn(s);
    saveBattle(s);
    this.refreshUnits();
    this.refreshHud();
    this.startTurnFlow(true, report);
  }

  // ---------- First-mission coach ----------

  coachOn() {
    const id = this.s.mapId;
    return this.s.mode === 'campaign' && (id === 'm1' || id === 'm2') && !save.get('seenTips') && !this.s.over;
  }

  /** Short step-by-step hint strip at the top of the map while learning (mission 1). */
  coachUpdate() {
    if (!this.scene.isActive()) return;
    this.coachBox?.destroy();
    this.coachBox = null;
    this.coachPulse?.destroy();
    this.coachPulse = null;
    if (!this.coachOn() || !this.isHumanTurn() || this.busy || this.modalOpen()) return;
    const s = this.s;
    const mode = this.ui.mode;
    const acts = this.coachActs || 0;
    const ready = G.readyUnits(s, s.turn);
    let msg = null;
    let pulse = null;
    if (s.mapId === 'm2') {
      const sel = this.ui.id && G.unitById(s, this.ui.id);
      if (mode === 'selected' && sel && UNITS[sel.type].capture) msg = 'Walk onto a grey city, then choose Capture. Cities pay 1000 funds a day.';
      else if (mode === 'idle' && s.day <= 2 && ready.length) {
        msg = 'Your factory (blue flag) builds units: tap it. Infantry is cheap and captures cities.';
        pulse = G.hqOf(s, 0) && s.props.find((p) => p.kind === 'factory' && p.owner === 0 && !G.unitAt(s, p.x, p.y));
      } else if (mode === 'idle' && !ready.length && s.day <= 2) msg = 'Tap End Turn. New units can move next turn.';
    } else if (mode === 'selected') msg = 'Blue tiles: where it can move. Red: what it could hit. Tap a blue tile, or tap an enemy in red to attack it.';
    else if (mode === 'moved') msg = this.ui.targets?.length ? 'Not moved for real yet! Tap Fire to attack, Wait to stay, or Undo.' : 'Not moved for real yet! Tap Wait to stay here, or Undo to pick again.';
    else if (mode === 'target') msg = 'Tap the enemy you want to hit.';
    else if (mode === 'confirm') msg = 'This is the forecast: how much damage you deal and take back. Tap Fire! to attack.';
    else if (mode === 'idle') {
      if (!ready.length) msg = 'Everyone has acted. Tap End Turn (bottom right). The enemy moves next.';
      else if (acts === 0 && s.day === 1) {
        msg = 'Welcome, Commander! Tap one of your blue units to give it orders.';
        pulse = ready.find((u) => u.type === 'tank') || ready[0];
      } else if (s.day === 1) msg = `Good! ${ready.length} unit${ready.length > 1 ? 's' : ''} can still act this turn. Tap one, or tap Next.`;
      else if (s.day === 2 && acts < 8) msg = 'Strike first: a hurt unit hits back weaker. Gang up on one enemy at a time.';
      else if (s.day === 3 && acts < 14) msg = 'Tip: tap an enemy to see where it can reach next turn. Dunes and oases give cover.';
    }
    if (!msg) return;
    const c = this.add.container(0, 0).setDepth(55);
    const t = text(this, 12, TOP + 8, msg, { origin: [0, 0], color: PALETTE.gold, wrap: WIDTH - 64, align: 'left' });
    const h = Math.max(36, t.height + 14);
    const bg = this.add.rectangle(0, TOP + 1, WIDTH, h, hex(PALETTE.ink), 0.88).setOrigin(0);
    const x = text(this, WIDTH - 22, TOP + 1 + h / 2, 'X', { color: PALETTE.cream });
    c.add([bg, t, x]);
    c.hitH = h;
    this.coachBox = c;
    if (pulse) {
      const [cx, cy] = this.cellCenter(pulse.x, pulse.y);
      const ring = this.add.circle(cx, cy, 18).setStrokeStyle(3, 0xe3d245);
      this.tweens.add({ targets: ring, scale: 1.35, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
      this.fxLayer.add(ring);
      this.coachPulse = ring;
    }
  }

  /** Taps on the hint strip: the x (or a tap anywhere on it) offers to turn hints off. */
  coachHit(p) {
    const c = this.coachBox;
    if (!c || !c.active || p.y > TOP + 1 + c.hitH) return false;
    if (p.x > WIDTH - 48) {
      modal(this, 'Hide tips?', ['You can read everything again under the gold ? button.'], [['Hide tips', () => { save.set('seenTips', true); this.coachUpdate(); }], ['Keep them', null]], { row: true });
    }
    return true;
  }

  /** Is map tile (x, y) inside the visible map area? */
  onScreen(x, y) {
    const px = x * T + T / 2 + this.ox - this.scroll.x; const py = y * T + T / 2 + this.oy - this.scroll.y;
    return px > 0 && px < WIDTH && py > 0 && py < VIEW_H;
  }

  // ---------- Animation ----------

  dur(ms) { return this.skipping ? 0 : Math.round(ms * (this.fast ? 0.25 : 1)); }

  wait(ms) {
    const d = this.dur(ms);
    if (d <= 0) return Promise.resolve();
    return new Promise((res) => this.time.delayedCall(d, res));
  }

  tweenP(cfg) {
    if (this.skipping || cfg.duration <= 0) {
      // Jump to the end state.
      const targets = Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets];
      for (const t of targets) for (const [k, v] of Object.entries(cfg)) if (typeof v === 'number' && !['duration', 'delay', 'repeat'].includes(k) && k in t) t[k] = v;
      return Promise.resolve();
    }
    return new Promise((res) => this.tweens.add({ ...cfg, onComplete: res }));
  }

  async animateMove(u, path, quick = false) {
    const v = this.views.get(u.id);
    if (!v) return;
    v.anim = 'walk';
    const per = quick ? 55 : 80;
    for (let i = 1; i < path.length; i++) {
      const [px, py] = path[i - 1]; const [nx, ny] = path[i];
      const facing = nx > px ? 'right' : nx < px ? 'left' : ny < py ? 'up' : 'down';
      this.setFacing(v, facing);
      if (isFoot(v.art)) v.sprs.forEach((sp, k) => setRef(this, sp, unitRef(v.art, v.side, 'right', 'walk', i + k)));
      const [cx, cy] = this.cellCenter(nx, ny);
      if (!quick) this.follow(nx, ny);
      await this.tweenP({ targets: v.c, x: cx, y: cy, duration: this.dur(per) });
    }
    v.anim = 'idle';
    this.unitLayer.sort('y');
  }

  async playEvents(events, quickMoves = false) {
    for (const e of events) {
      if (e.type === 'move') {
        const u = G.unitById(this.s, e.id) || { id: e.id };
        sfx('move');
        await this.animateMove(u, e.path, quickMoves);
      } else if (e.type === 'attack' || e.type === 'counter') {
        await this.animateHit(e);
      } else if (e.type === 'capture') {
        sfx('flip');
        this.refreshProps();
        await this.floatText(e.x, e.y, `${e.left} left`, PALETTE.sand);
      } else if (e.type === 'captured') {
        sfx('capture');
        this.refreshProps();
        const v = this.propViews.get(`${e.x},${e.y}`);
        if (v) { v.img.setScale(2.4); this.tweens.add({ targets: v.img, scale: 2, duration: 250 }); }
        const who = G.unitById(this.s, e.id)?.side ?? this.s.turn;
        await this.floatText(e.x, e.y, `${TERRAIN[e.kind].name} captured!`, TEAM_COLOR[who]);
      }
    }
  }

  async animateHit(e) {
    const a = this.views.get(e.a); const d = this.views.get(e.d);
    if (!a || !d) return;
    if (this.fast || this.skipping) { await this.quickHit(e, a, d); return; }
    const ax = a.c.x; const ay = a.c.y; const dx = d.c.x; const dy = d.c.y;
    // Face the target.
    const facing = Math.abs(dx - ax) >= Math.abs(dy - ay) ? (dx > ax ? 'right' : 'left') : (dy < ay ? 'up' : 'down');
    this.setFacing(a, facing);
    const aUnit = this.unitTypeOfView(e.a);
    const ranged = aUnit && isRanged(aUnit);
    if (isFoot(a.art)) { a.anim = 'attack'; a.sprs.forEach((sp, k) => setRef(this, sp, unitRef(a.art, a.side, 'right', 'attack', 1 + k))); }
    // Muzzle flash, then tracer or shell.
    const fx = this.add.image(ax + Math.sign(dx - ax) * 12, ay + Math.sign(dy - ay) * 10 - 4, ...frame(this, SHOT(0))).setScale(2);
    this.fxLayer.add(fx);
    sfx(ranged ? 'thud' : 'shoot');
    for (let i = 1; i < 4; i++) { await this.wait(40); fx.setTexture(...frame(this, SHOT(i))); }
    fx.destroy();
    if (ranged) {
      const shell = this.add.circle(ax, ay - 8, 3, 0x1c1618);
      this.fxLayer.add(shell);
      const midY = Math.min(ay, dy) - 40;
      await this.tweenP({ targets: shell, x: dx, duration: this.dur(260), onUpdate: (tw) => { const t = tw.progress; shell.y = (1 - t) * (1 - t) * (ay - 8) + 2 * (1 - t) * t * midY + t * t * dy; } });
      shell.destroy();
    }
    if (isFoot(a.art)) a.anim = 'idle';
    // Impact.
    sfx(e.killed ? 'boom' : 'hit');
    const boom = this.add.image(dx + Phaser.Math.Between(-4, 4), dy, ...frame(this, BOOM(0))).setScale(2);
    this.fxLayer.add(boom);
    for (const sp of d.sprs) sp.setTintFill(0xffffff);
    const shake = this.tweenP({ targets: d.c, x: dx + 3, duration: this.dur(40), yoyo: true, repeat: 2 });
    this.floatText(null, null, `-${e.dmg}%`, PALETTE.cream, dx, dy - 20);
    for (let i = 1; i < 4; i++) { await this.wait(60); boom.setTexture(...frame(this, BOOM(i))); }
    await shake;
    d.c.x = dx;
    boom.destroy();
    for (const sp of d.sprs) sp.clearTint();
    const hp = displayHp(e.hp);
    d.hp.setText(hp < 10 && hp > 0 ? `${hp}` : ''); d.hpBg.setVisible(hp < 10 && hp > 0);
    if (e.killed) {
      if (isFoot(d.art)) {
        d.anim = 'death';
        for (let i = 0; i < 4; i++) { d.sprs.forEach((sp) => setRef(this, sp, unitRef(d.art, d.side, 'right', 'death', i))); await this.wait(70); }
        const puff = this.add.image(dx, dy, ...frame(this, DEATH(0))).setScale(2);
        this.fxLayer.add(puff);
        for (let i = 1; i < 4; i++) { await this.wait(60); puff.setTexture(...frame(this, DEATH(i))); }
        puff.destroy();
      } else {
        const big = this.add.image(dx, dy, ...frame(this, BOOM(1))).setScale(3.5);
        this.fxLayer.add(big);
        for (let i = 1; i < 4; i++) { await this.wait(70); big.setTexture(...frame(this, BOOM(i))); }
        big.destroy();
      }
      await this.tweenP({ targets: d.c, alpha: 0, duration: this.dur(150) });
    }
    await this.wait(120);
  }

  /** Fast mode: one flash and a number, about a tenth of a second per hit. */
  async quickHit(e, a, d) {
    const dx = d.c.x; const dy = d.c.y;
    sfx(e.killed ? 'boom' : 'hit');
    const boom = this.add.image(dx, dy, ...frame(this, BOOM(e.killed ? 1 : 0))).setScale(e.killed ? 3 : 2);
    this.fxLayer.add(boom);
    for (const sp of d.sprs) sp.setTintFill(0xffffff);
    this.floatText(null, null, `-${e.dmg}%`, PALETTE.cream, dx, dy - 20);
    if (!this.skipping) await new Promise((r) => this.time.delayedCall(110, r));
    boom.destroy();
    for (const sp of d.sprs) sp.clearTint();
    const hp = displayHp(e.hp);
    d.hp.setText(hp < 10 && hp > 0 ? `${hp}` : ''); d.hpBg.setVisible(hp < 10 && hp > 0);
    if (e.killed) d.c.setAlpha(0);
    void a;
  }

  unitTypeOfView(id) {
    const u = G.unitById(this.s, id);
    if (u) return u.type;
    const v = this.views.get(id);
    return v ? Object.keys(UNITS).find((k) => UNITS[k].art === v.art) : null;
  }

  floatText(x, y, msg, color, px, py) {
    const [cx, cy] = x === null ? [px, py] : this.cellCenter(x, y);
    const t = text(this, cx, cy - 18, msg, { color });
    const bg = this.add.rectangle(cx, cy - 18, t.width + 10, 20, hex(PALETTE.ink), 0.8);
    this.fxLayer.add([bg, t]);
    return this.tweenP({ targets: [t, bg], y: cy - 34, duration: this.dur(600) }).then(() => { t.destroy(); bg.destroy(); });
  }

  // ---------- Start, end, leaving ----------

  intro() {
    const s = this.s;
    const def = mapById(s.mapId);
    if (s.mode === 'campaign') {
      const lines = [{ text: objectiveLine(s, 0), color: PALETTE.gold }];
      if (def.tip) lines.push(def.tip);
      modal(this, def.name, lines, [['Begin', () => this.startTurnFlow(s.controllers[s.turn] === 'cpu')]]);
    } else this.startTurnFlow(true);
  }

  leave() {
    if (this.modalOpen()) return;
    const s = this.s;
    const vsCpu = s.controllers.includes('cpu');
    const buttons = [['Save and quit', () => this.quit()]];
    if (!s.over) buttons.push(['Resign', () => this.confirmResign()]);
    buttons.push(['Keep playing', null]);
    modal(this, 'Leave battle?', [vsCpu ? 'Your battle is saved. Continue it from the menu any time.' : 'The battle is saved. Continue it from the menu.'], buttons);
  }

  confirmResign() {
    modal(this, 'Resign?', ['The battle counts as lost.'], [['Resign', () => {
      const side = this.s.controllers[0] === 'human' && this.s.controllers[1] === 'cpu' ? 0 : this.s.turn;
      G.resign(this.s, side);
      saveBattle(this.s);
      this.showResult();
    }], ['Cancel', null]], { row: true });
  }

  quit() {
    if (this.s.over) clearBattle(); else saveBattle(this.s);
    go(this, 'Menu');
  }

  showResult() {
    if (this.resultShown) return;
    this.resultShown = true;
    const s = this.s;
    this.refreshUnits();
    this.clearHighlights();
    this.clearPanel();
    clearBattle();
    const vsCpu = s.controllers.includes('cpu');
    const human = s.controllers[0] === 'human' ? 0 : 1;
    const won = vsCpu ? s.winner === human : true;
    const def = mapById(s.mapId);
    const reason = {
      hq: 'HQ captured', rout: 'All enemy units destroyed', survive: 'Held out until reinforcements arrived', resign: 'Resigned',
    }[s.reason] || '';
    const st = s.stats[human];
    const lines = [];
    if (vsCpu) {
      // The adaptive level moves by how decisive the result was.
      const mine = G.armyValue(s, human) + 1; const theirs = G.armyValue(s, 1 - human) + 1;
      const margin = Math.min(1, Math.abs(Math.log(mine / theirs)) / 2);
      reportResult(SKILL_ID, won ? 1 : 0, s.reason === 'resign' ? 1 : margin);
    }
    let title;
    const buttons = [];
    if (!vsCpu) {
      title = `${SIDES[s.winner].name} wins!`;
      lines.push({ text: `${reason} on day ${s.day}.`, color: TEAM_COLOR[s.winner] });
      buttons.push(['Rematch', () => this.restart()], ['Menu', () => go(this, 'Menu')]);
    } else if (won) {
      title = 'Victory!';
      lines.push({ text: `${reason} on day ${s.day}.`, color: PALETTE.gold });
      if (s.mode === 'campaign') {
        const i = CAMPAIGN.findIndex((m) => m.id === s.mapId);
        if (i === 0) save.set('seenTips', true);
        missionWon(i, s.mapId, s.day);
        if (def.outro) lines.push(def.outro);
        const next = CAMPAIGN[i + 1];
        if (next) buttons.push(['Next mission', () => go(this, 'Menu', { view: 'campaign', brief: next.id })]);
        else lines.push({ text: 'The Crimson Scorpions are beaten. The Azure Dunes are safe. Campaign complete!', color: PALETTE.sand });
        buttons.push(['Menu', () => go(this, 'Menu', { view: 'campaign' })]);
      } else {
        recordSkirmish(s.mapId, true);
        buttons.push(['Play again', () => this.restart()], ['Menu', () => go(this, 'Menu')]);
      }
    } else {
      title = 'Defeat';
      lines.push({ text: `${reason === 'Resigned' ? 'You resigned' : reason.replace('All enemy units', 'All your units').replace('HQ captured', 'Your HQ was captured')} on day ${s.day}.`, color: PALETTE.orange });
      if (s.reason === 'survive') lines[0].text = `The enemy held out until day ${s.day}.`;
      if (s.mode === 'skirmish') recordSkirmish(s.mapId, false);
      buttons.push(['Try again', () => this.restart()], ['Menu', () => go(this, 'Menu', s.mode === 'campaign' ? { view: 'campaign' } : undefined)]);
    }
    if (st) lines.push({ text: `Built ${st.built}, destroyed ${st.kills}, lost ${st.lost}, captured ${st.captured}`, color: PALETTE.lavender });
    sfx(won ? 'win' : 'lose');
    this.time.delayedCall(400, () => modal(this, title, lines, buttons));
  }

  restart() {
    const s = this.s;
    const def = mapById(s.mapId);
    const state = G.newGame(def, { seed: (Date.now() & 0xffffff) >>> 0, controllers: s.controllers, mode: s.mode, missionId: s.missionId });
    saveBattle(state);
    store.start = { state, fresh: true };
    go(this, 'Battle');
  }
}

export function objectiveLine(s, side) {
  if (s.survive && s.survive.side === side) {
    const left = s.survive.days - s.day + 1;
    return `Hold out ${left} more day${left === 1 ? '' : 's'} (until day ${s.survive.days + 1})`;
  }
  if (s.survive) return `Win before day ${s.survive.days + 1}`;
  return G.hqOf(s, 1 - side) ? 'Goal: take their HQ or rout them' : 'Goal: destroy every enemy unit';
}

function moveLine(tk) {
  const c = TERRAIN[tk].cost;
  if (tk === 'water') return 'Only drones can cross';
  if (tk === 'mesa') return 'Foot soldiers and drones only';
  if (c.tread > 1) return 'Slows tanks and wheels';
  if (c.wheel > 1) return 'Wheels move slower here';
  return 'Easy going for everyone';
}

function shortRole(t) {
  return {
    inf: 'Captures', lancer: 'Anti-vehicle', scout: 'Fast, captures', recon: 'Fast', tank: 'All-round',
    heavy: 'Very tough', arty: 'Ranged', flak: 'Anti-air', drone: 'Flies', truck: 'Repairs neighbours', harv: 'Dune income',
  }[t];
}
