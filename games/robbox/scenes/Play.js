import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, HEIGHT, header, go, setBackground, modal, toast, fit, BLUE, ORANGE, starRow, openHowTo,
} from './common.js';
import { sprite, setRef, robotRef, ART, convRef } from '../frames.js';
import { LEVELS } from '../logic/levels.js';
import {
  parseLevel, initState, createRun, stepRun, goalCounts, programLength, parseCode, codeString, hasLoop,
  SLOTS, SLOT_NAMES, FAIL, DIRS, OPS,
} from '../logic/engine.js';
import {
  save, recordWin, saveProgram, loadProgram, bestFor, starsOf, isSolved, totalStars,
} from '../save.js';
import { earn, stat, daily, today } from '../trophies.js';

// Screen layout (portrait 360x640).
const GRID_TOP = 52;
const SLOT_BOTTOM = 452; // program slots sit just above the palette; the grid gets the rest
const ROW_PITCH = 44;
const PER_ROW = 7;
const CELL = 38;
const PITCH = 42;
const CELL_X0 = 58; // left edge of the first program cell
const PAL_Y = 484;
const CTRL_Y = 540;
const MISC_Y = 598;
const COND_FILL = { b: BLUE, o: ORANGE };
const SPEEDS = [1, 2, 4];

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  init(data) {
    this.index = Math.max(0, Math.min(LEVELS.length - 1, data?.index ?? 0));
    this.daily = data?.daily || null; // the day, when this is the Daily Level
  }

  create() {
    setBackground(this, PALETTE.night);
    window.__robbox = this;
    this.level = LEVELS[this.index];
    this.lv = parseLevel(this.level);
    save.set('last', this.index);
    this.gen = 0;
    this.mode = 'edit'; // edit | running | paused | done
    this.animating = false;
    this.run = null;
    this.brush = null;
    this.sel = 'main';
    this.undoStack = [];
    this.modalOpen = 0;
    this.dynObjs = []; this.gearImgs = []; this.press = null; this.drag = null; this.toastObj = null; this.toastBg = null;
    this.speed = SPEEDS.includes(save.get('speed')) ? save.get('speed') : 1;
    this.program = this.loadProgram();

    const hd = header(this, '', () => go(this, 'Levels', { world: this.level.world }));
    this.backBtn = hd.back;
    fit(text(this, WIDTH / 2, 16, `${this.daily ? 'Daily: ' : ''}${this.level.id}  ${this.level.name}`, { color: PALETTE.cream }), WIDTH - 130);
    this.targetText = text(this, WIDTH / 2, 38, '', { color: PALETTE.gold });

    this.slotTop = this.measureSlots();
    this.grid = { top: GRID_TOP, h: this.slotTop - 26 - GRID_TOP };
    this.statusL = text(this, 10, this.slotTop - 13, '', { color: PALETTE.cream, origin: [0, 0.5] });
    this.statusR = text(this, WIDTH - 10, this.slotTop - 13, '', { color: PALETTE.lavender, origin: [1, 0.5] });
    this.layoutGrid();
    this.drawStatic();
    this.state = initState(this.lv);
    this.drawDynamic(true);
    this.banner = this.add.container(0, 0).setDepth(300);

    this.slotLayer = this.add.container(0, 0).setDepth(20);
    this.hiLayer = this.add.graphics().setDepth(40);
    this.buildSlots();
    this.buildPalette();
    this.buildControls();
    this.refresh();
    this.setupDrag();
    this.anims8 = 0;
    this.time.addEvent({ delay: 130, loop: true, callback: () => this.animateTiles() });
    this.coach = this.add.container(0, 0).setDepth(350);

    this.events.off('howto-open');
    this.events.on('howto-open', () => { this.press = null; this.endDrag(null); });
    this.events.once('shutdown', () => { this.input.off('pointermove'); this.input.off('pointerup'); this.input.off('pointerupoutside'); });

    const seen = save.get('seenIntro') || {};
    if (this.level.intro && !seen[this.level.id]) {
      this.time.delayedCall(250, () => this.showModal('New!', [this.level.intro], [['Got it', () => this.updateCoach()]]));
      save.set('seenIntro', { ...seen, [this.level.id]: true });
    } else this.updateCoach();
  }

  // ------------------------------------------------------------------ program storage

  loadProgram() {
    const saved = loadProgram(this.level.id);
    const p = { main: [], f1: [], f2: [] };
    if (!saved) return p;
    try {
      for (const s of SLOTS) {
        const cap = this.cap(s);
        p[s] = parseCode(saved[s] || '').filter((c) => this.level.ops.includes(c.op) && (!c.cond || this.level.brushes.includes(c.cond))).slice(0, cap);
      }
    } catch { return { main: [], f1: [], f2: [] }; }
    return p;
  }

  storeProgram() {
    saveProgram(this.level.id, { main: codeString(this.program.main), f1: codeString(this.program.f1), f2: codeString(this.program.f2) });
  }

  cap(slot) { return this.level.slots[slot] || 0; }

  toastY() { return this.grid.top + 12; }

  // ------------------------------------------------------------------ grid drawing

  layoutGrid() {
    const { w, h, cells } = this.lv;
    const extraFor = (CC, EE) => {
      let ext = 0;
      cells.forEach((c, i) => {
        if (c.t === 'void') return;
        const y = Math.floor(i / w);
        const lift = (c.h + (c.t === 'wall' ? 1 : 0)) * EE + 6;
        ext = Math.max(ext, lift - y * CC);
      });
      return ext;
    };
    // Biggest whole-pixel scale of the 16px art that fits: 3x, 2x, else 1.5x.
    // Keep the bottom of the area free for the message banner when the grid still fits at that size.
    const BANNER = 50;
    const fits = (size, room) => w * size <= 344 && h * size + extraFor(size, size / 4) <= room;
    let C = 24; let room = this.grid.h;
    for (const size of [48, 32]) {
      if (fits(size, this.grid.h - BANNER)) { C = size; room = this.grid.h - BANNER; break; }
      if (fits(size, this.grid.h)) { C = size; break; }
    }
    if (C === 24 && fits(24, this.grid.h - BANNER)) room = this.grid.h - BANNER;
    const E = C / 4;
    this.C = C; this.E = E;
    this.rl = Math.round(C * 0.18); // the robot stands a little up its tile
    const ext = extraFor(C, E);
    const total = h * C + ext;
    this.ox = Math.round((WIDTH - w * C) / 2);
    this.oy = Math.round(this.grid.top + (room - total) / 2 + ext);
    this.scaleArt = C / 16;
  }

  px(x) { return this.ox + x * this.C + this.C / 2; }
  py(y, h = 0) { return this.oy + y * this.C + this.C / 2 - h * this.E; }

  drawStatic() {
    const { w, cells } = this.lv;
    const s = this.scaleArt;
    this.lampImg = {}; this.glow = {}; this.gateImg = {}; this.convImg = [];
    const g = this.add.graphics().setDepth(0);
    // Faint dots where there is no floor, so the edge of the world is easy to see.
    cells.forEach((c, i) => {
      if (c.t !== 'void') return;
      const x = this.px(i % w); const y = this.py(Math.floor(i / w));
      g.fillStyle(hex(PALETTE.indigo), 0.5).fillRect(x - 1, y - 1, 2, 2);
    });
    // Lower levels are drawn a little darker, so heights read at a glance.
    const maxH = Math.max(...cells.filter((c) => c.t !== 'void').map((c) => c.h));
    const shade = (h) => {
      const f = 1 - 0.2 * Math.max(0, maxH - h);
      const v = Math.round(255 * f);
      return (v << 16) | (v << 8) | v;
    };
    cells.forEach((c, i) => {
      if (c.t === 'void') return;
      const gx = i % w; const gy = Math.floor(i / w);
      const depth = gy * 10;
      const lift = c.h + (c.t === 'wall' ? 1 : 0);
      const x = this.px(gx); const y = this.py(gy, lift);
      const half = this.C / 2 - 2 * (s / 2);
      // Side of the column, down to the ground (one stripe per level).
      const side = this.add.graphics().setDepth(depth);
      const ground = this.py(gy, 0) + this.C / 2 + 3;
      const topBottom = y + half;
      const wall = c.t === 'wall';
      side.fillStyle(wall ? 0x4e282e : 0x47416b).fillRect(x - half, topBottom - 2, half * 2, ground - topBottom + 2);
      for (let k = 1; k <= lift; k++) side.fillStyle(wall ? 0x2a1418 : 0x2b2540).fillRect(x - half, topBottom + k * this.E - 2, half * 2, 2);
      side.fillStyle(0x040303).fillRect(x - half, ground - 2, half * 2, 2);
      let ref = ART.floor;
      if (c.paint === 'b') ref = ART.floorBlue;
      if (c.paint === 'o') ref = ART.floorOrange;
      if (c.t === 'pad') ref = ART.pad;
      if (c.t === 'wall') ref = ART.hazard;
      if (c.t === 'tele') ref = ART.tele;
      if (c.t === 'conv') ref = convRef(c.dir, 0);
      const top = sprite(this, x, y, ref, s).setDepth(depth + 1);
      if (c.t !== 'wall') top.setTint(shade(c.h));
      if (c.t === 'tele' && c.pair === 'B') top.setTint(0xffc080);
      if (c.t === 'conv') this.convImg.push({ img: top, dir: c.dir });
      if (c.paint && c.t !== 'floor') {
        // Painted special tiles get a coloured frame so the colour still shows.
        this.add.rectangle(x, y, this.C - 4, this.C - 4).setStrokeStyle(3, hex(COND_FILL[c.paint])).setDepth(depth + 2);
      }
      if (c.t === 'lamp') {
        this.glow[i] = this.add.rectangle(x, y, this.C - 2, this.C - 2, hex(PALETTE.gold), 0).setDepth(depth + 1);
        this.lampImg[i] = sprite(this, x, y + s, ART.lamp, s).setDepth(depth + 2);
      }
      if (c.t === 'gate') this.gateImg[i] = sprite(this, x, y, ART.gate, s).setDepth(depth + 2);
    });
    this.robot = sprite(this, 0, 0, robotRef(this.lv.start.d), s);
    this.carry = sprite(this, 0, 0, ART.crate, s / 2).setVisible(false);
    this.tweens.add({ targets: Object.values(this.glow), alpha: { from: 0.25, to: 0.5 }, yoyo: true, repeat: -1, duration: 600 });
  }

  /** Sync everything that changes (lamps, gates, crates, gears, robot) with this.state. */
  drawDynamic(placeRobot = true) {
    const st = this.state;
    const s = this.scaleArt;
    for (const [i, img] of Object.entries(this.lampImg)) {
      const on = st.lit.includes(Number(i));
      if (on) img.clearTint(); else img.setTint(0x4a4a5e);
      this.glow[i].setVisible(on);
    }
    for (const [i, img] of Object.entries(this.gateImg)) {
      const open = st.opened.includes(Number(i));
      setRef(this, img, open ? ART.floorGreen : ART.gate);
    }
    // Crates and gears are plain scene sprites (not in a container) so they depth-sort with the tiles.
    (this.dynObjs || []).forEach((o) => o.destroy());
    this.dynObjs = [];
    this.gearImgs = [];
    for (const i of st.crates) {
      const gx = i % this.lv.w; const gy = Math.floor(i / this.lv.w);
      const c = this.lv.cells[i];
      const img = sprite(this, this.px(gx), this.py(gy, c.h) - 2, ART.crate, s).setDepth(gy * 10 + 3);
      if (c.t === 'pad') img.setTint(0xfff0a0);
      this.dynObjs.push(img);
    }
    for (const i of st.keys) {
      const gx = i % this.lv.w; const gy = Math.floor(i / this.lv.w);
      const img = sprite(this, this.px(gx), this.py(gy, this.lv.cells[i].h) - 2, ART.gear(this.anims8 || 0), s).setDepth(gy * 10 + 3);
      this.gearImgs.push(img);
      this.dynObjs.push(img);
    }
    if (placeRobot) this.placeRobot();
    this.carry.setVisible(st.carrying);
    this.updateStatus();
  }

  placeRobot() {
    const st = this.state;
    const h = this.lv.cells[st.y * this.lv.w + st.x]?.h ?? 0;
    this.robot.setPosition(this.px(st.x), this.py(st.y, h) - this.rl).setAlpha(1).setScale(this.scaleArt).setAngle(0);
    this.robot.setDepth(st.y * 10 + 5);
    setRef(this, this.robot, robotRef(st.d));
  }

  update() {
    if (this.carry.visible) this.carry.setPosition(this.robot.x, this.robot.y - this.C * 0.55).setDepth(this.robot.depth + 1).setAlpha(this.robot.alpha);
  }

  animateTiles() {
    this.anims8++;
    for (const { img, dir } of this.convImg) setRef(this, img, convRef(dir, this.anims8));
    for (const g of this.gearImgs || []) setRef(this, g, ART.gear(this.anims8));
  }

  updateStatus() {
    const g = goalCounts(this.lv, this.state);
    const parts = [];
    if (g.lampsTotal) parts.push(`Lamps ${g.lamps}/${g.lampsTotal}`);
    if (g.cratesTotal) parts.push(`Crates ${g.crates}/${g.cratesTotal}`);
    if (this.state.gears) parts.push(`Gears ${this.state.gears}`);
    this.statusL.setText(parts.join('  '));
    const len = programLength(this.program);
    const best = bestFor(this.level.id);
    this.statusR.setText(`Used ${len}${best != null ? `   Best ${best}` : ''}`);
    this.statusR.setColor(len && len <= this.level.target ? PALETTE.gold : PALETTE.lavender);
    this.targetText.setText(`3 stars: ${this.level.target} commands or fewer`);
    fit(this.targetText.setScale(1), WIDTH - 120);
  }

  // ------------------------------------------------------------------ program area

  measureSlots() {
    let h = -6;
    for (const s of SLOTS) if (this.cap(s)) h += Math.ceil(this.cap(s) / PER_ROW) * ROW_PITCH + 6;
    return SLOT_BOTTOM - h;
  }

  buildSlots() {
    this.slotGeo = {};
    let y = this.slotTop;
    for (const s of SLOTS) {
      const cap = this.cap(s);
      if (!cap) continue;
      const rows = Math.ceil(cap / PER_ROW);
      const geo = { top: y, rows, cap, rowY: [] };
      for (let r = 0; r < rows; r++) geo.rowY.push(y + r * ROW_PITCH + ROW_PITCH / 2);
      this.slotGeo[s] = geo;
      // Background (tap to select this slot).
      const bgH = rows * ROW_PITCH;
      const bg = this.add.rectangle(4, y, WIDTH - 8, bgH - 2, hex(PALETTE.ink), 0.5).setOrigin(0).setDepth(10);
      bg.setInteractive();
      bg.on('pointerdown', (p) => { if (!this.blocked()) this.press = { kind: 'slot', slot: s, x: p.x, y: p.y }; });
      geo.bg = bg;
      // Label tab.
      const lab = this.add.container(28, y + ROW_PITCH / 2).setDepth(12);
      const lbg = this.add.rectangle(0, 0, 46, 40, hex(PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
      const ltx = text(this, 0, 0, SLOT_NAMES[s], { color: PALETTE.cream });
      fit(ltx, 42);
      lab.add([lbg, ltx]);
      lab.setSize(50, 44).setInteractive();
      lab.on('pointerdown', (p) => { if (!this.blocked()) this.press = { kind: 'slot', slot: s, x: p.x, y: p.y }; });
      geo.label = { c: lab, bg: lbg, t: ltx };
      // Empty places.
      const ph = this.add.graphics().setDepth(11);
      for (let i = 0; i < cap; i++) {
        const { x, y: cy } = this.cellPos(s, i);
        ph.lineStyle(2, hex(PALETTE.indigo), 1).strokeRect(x - CELL / 2 + 1, cy - CELL / 2 + 1, CELL - 2, CELL - 2);
      }
      y += bgH + 6;
    }
    if (!this.slotGeo[this.sel]) this.sel = 'main';
  }

  cellPos(slot, i) {
    const geo = this.slotGeo[slot];
    const r = Math.floor(i / PER_ROW); const c = i % PER_ROW;
    return { x: CELL_X0 + CELL / 2 + c * PITCH, y: geo.rowY[r] };
  }

  /** A command tile (used in the program, the palette and while dragging). */
  makeCmd(x, y, cell, size = CELL) {
    const c = this.add.container(x, y);
    const fill = cell.cond ? COND_FILL[cell.cond] : (cell.op === '1' || cell.op === '2') ? PALETTE.plum : PALETTE.indigo;
    c.add(this.add.rectangle(0, 2, size, size, hex(PALETTE.ink)));
    const body = this.add.rectangle(0, 0, size, size, hex(fill)).setStrokeStyle(2, hex(PALETTE.lavender));
    c.add(body);
    c.body = body;
    if (cell.op === '1' || cell.op === '2') c.add(text(this, 0, 0, `F${cell.op}`, { color: PALETTE.cream }));
    else c.add(this.add.image(0, 0, 'icons', cell.op));
    return c;
  }

  refresh() {
    this.slotLayer.removeAll(true);
    this.cellObjs = {};
    for (const s of SLOTS) {
      const geo = this.slotGeo[s];
      if (!geo) continue;
      const on = s === this.sel;
      geo.label.bg.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      geo.label.t.setColor(on ? PALETTE.night : PALETTE.cream);
      geo.bg.setStrokeStyle(2, hex(on ? PALETTE.gold : PALETTE.ink), on ? 0.9 : 0.5);
      this.cellObjs[s] = this.program[s].map((cell, i) => {
        const { x, y } = this.cellPos(s, i);
        const o = this.makeCmd(x, y, cell);
        o.setSize(PITCH, ROW_PITCH).setInteractive();
        o.on('pointerdown', (p) => { if (!this.blocked()) this.press = { kind: 'prog', slot: s, index: i, x: p.x, y: p.y, obj: o }; });
        this.slotLayer.add(o);
        return o;
      });
    }
    this.updateStatus();
    this.drawHighlight();
    this.updateCoach();
  }

  buildPalette() {
    const items = [...this.level.ops].map((op) => ({ kind: 'op', op }));
    for (const b of this.level.brushes) items.push({ kind: 'brush', brush: b });
    const pitch = Math.min(50, Math.floor((WIDTH - 12) / items.length));
    const size = Math.min(42, pitch - 4);
    const x0 = WIDTH / 2 - ((items.length - 1) * pitch) / 2;
    this.palItems = [];
    this.add.rectangle(WIDTH / 2, PAL_Y, WIDTH - 8, 52, hex(PALETTE.indigo), 0.35).setDepth(5);
    items.forEach((it, k) => {
      const x = x0 + k * pitch;
      let o;
      if (it.kind === 'op') o = this.makeCmd(x, PAL_Y, { op: it.op, cond: null }, size);
      else {
        o = this.add.container(x, PAL_Y);
        o.add(this.add.rectangle(0, 2, size, size, hex(PALETTE.ink)));
        o.body = this.add.rectangle(0, 0, size, size, hex(COND_FILL[it.brush])).setStrokeStyle(2, hex(PALETTE.ink));
        o.add([o.body, this.add.image(0, 0, 'icons', 'brush')]);
      }
      o.setDepth(30).setSize(pitch, 52).setInteractive();
      o.on('pointerdown', (p) => { if (!this.blocked()) this.press = { kind: 'pal', item: it, x: p.x, y: p.y, obj: o }; });
      o.item = it;
      this.palItems.push(o);
    });
    this.syncPalette();
  }

  syncPalette() {
    for (const o of this.palItems) {
      if (o.item.kind === 'brush') {
        const on = this.brush === o.item.brush;
        o.body.setStrokeStyle(on ? 4 : 2, hex(on ? PALETTE.gold : PALETTE.ink));
        o.y = PAL_Y - (on ? 4 : 0);
      } else {
        const fill = this.brush ? COND_FILL[this.brush] : (o.item.op === '1' || o.item.op === '2') ? PALETTE.plum : PALETTE.indigo;
        o.body.setFillStyle(hex(fill));
      }
    }
  }

  buildControls() {
    this.stepBtn = button(this, 50, CTRL_Y, 84, 46, 'Step', () => this.stepOnce(), { fill: PALETTE.lavender });
    this.runBtn = button(this, 150, CTRL_Y, 100, 46, 'Run', () => this.runPressed(), { fill: PALETTE.leaf, color: PALETTE.cream, silent: true });
    this.resetBtn = button(this, 250, CTRL_Y, 84, 46, 'Reset', () => this.resetRun(), { fill: PALETTE.lavender });
    this.speedBtn = button(this, 326, CTRL_Y, 56, 46, `${this.speed}x`, () => {
      this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
      save.set('speed', this.speed);
      this.speedBtn.setLabel(`${this.speed}x`);
    }, { fill: PALETTE.sand });
    this.hintBtn = button(this, 68, MISC_Y, 120, 44, 'Hint', () => this.showHint(), { fill: PALETTE.gold });
    this.undoBtn = button(this, 180, MISC_Y, 88, 44, 'Undo', () => this.undo(), { fill: PALETTE.lavender });
    this.clearBtn = button(this, 292, MISC_Y, 120, 44, 'Clear', () => this.clearSlot(), { fill: PALETTE.lavender });
    this.syncControls();
  }

  syncControls() {
    const label = this.mode === 'running' ? 'Pause' : this.mode === 'done' ? (this.run?.won ? 'Run' : 'Retry') : 'Run';
    this.runBtn.setLabel(label);
    this.runBtn.body.setFillStyle(hex(this.mode === 'running' ? PALETTE.orange : PALETTE.leaf));
    this.undoBtn.setEnabled(this.undoStack.length > 0);
    this.clearBtn.setLabel(`Clear ${SLOT_NAMES[this.sel]}`);
    fit(this.clearBtn.label.setScale(1), 108);
    this.clearBtn.setEnabled(this.program[this.sel].length > 0);
  }

  blocked() { return this.modalOpen > 0 || !!document.getElementById('howto') || this.leaving; }

  // ------------------------------------------------------------------ touch: taps and drags

  setupDrag() {
    this.press = null;
    this.drag = null;
    this.input.on('pointermove', (p) => {
      if (!this.press || this.drag) { if (this.drag) this.moveDrag(p); return; }
      if (!p.isDown) return;
      if (Math.hypot(p.x - this.press.x, p.y - this.press.y) > 10 && (this.press.kind === 'pal' || this.press.kind === 'prog')) this.beginDrag(p);
    });
    const up = (p) => {
      const pr = this.press;
      this.press = null;
      if (this.drag) { this.endDrag(p); return; }
      if (!pr || this.blocked()) return;
      if (Math.hypot(p.x - pr.x, p.y - pr.y) > 14) return;
      this.tap(pr);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', (p) => { this.press = null; if (this.drag) this.endDrag(null); });
  }

  tap(pr) {
    if (pr.kind === 'slot') { this.selectSlot(pr.slot); return; }
    if (pr.kind === 'pal') {
      if (pr.item.kind === 'brush') {
        this.brush = this.brush === pr.item.brush ? null : pr.item.brush;
        sfx('select');
        this.syncPalette();
        this.updateCoach();
        return;
      }
      this.addCmd(pr.item.op, this.sel, this.program[this.sel].length);
      return;
    }
    if (pr.kind === 'prog') {
      if (this.brush) this.paintCmd(pr.slot, pr.index);
      else this.removeCmd(pr.slot, pr.index);
    }
  }

  selectSlot(s) {
    if (this.sel === s) return;
    this.sel = s;
    sfx('select');
    this.refresh();
    this.syncControls();
  }

  beginDrag(p) {
    const pr = this.press;
    const cell = pr.kind === 'pal' ? (pr.item.kind === 'op' ? { op: pr.item.op, cond: this.brush } : null) : this.program[pr.slot][pr.index];
    if (!cell) { this.press = null; return; }
    this.drag = { from: pr, cell };
    this.drag.ghost = this.makeCmd(p.x, p.y - 30, cell).setDepth(600).setAlpha(0.9);
    if (pr.kind === 'prog') pr.obj.setAlpha(0.3);
    this.drag.marker = this.add.rectangle(0, 0, 4, CELL + 4, hex(PALETTE.gold)).setDepth(590).setVisible(false);
    this.moveDrag(p);
  }

  moveDrag(p) {
    const d = this.drag;
    d.ghost.setPosition(p.x, p.y - 30);
    d.target = this.dropTarget(p.x, p.y - 30);
    if (d.target) {
      const { slot, index } = d.target;
      const geo = this.slotGeo[slot];
      const r = Math.min(Math.floor(index / PER_ROW), geo.rows - 1);
      const c = index - r * PER_ROW;
      d.marker.setPosition(CELL_X0 + c * PITCH - 2, geo.rowY[r]).setVisible(true);
    } else d.marker.setVisible(false);
  }

  /** Where a dragged command would land: { slot, index } or null (outside the program). */
  dropTarget(x, y) {
    for (const s of SLOTS) {
      const geo = this.slotGeo[s];
      if (!geo) continue;
      for (let r = 0; r < geo.rows; r++) {
        if (Math.abs(y - geo.rowY[r]) > ROW_PITCH / 2 + 2 || x < 4 || x > WIDTH - 4) continue;
        const col = Math.max(0, Math.min(PER_ROW, Math.floor((x - CELL_X0 + PITCH / 2) / PITCH)));
        let len = this.program[s].length;
        const from = this.drag?.from;
        if (from?.kind === 'prog' && from.slot === s) len -= 1;
        return { slot: s, index: Math.min(r * PER_ROW + col, len) };
      }
    }
    return null;
  }

  endDrag(p) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.ghost.destroy(); d.marker.destroy();
    if (d.from.kind === 'prog' && d.from.obj?.active) d.from.obj.setAlpha(1);
    if (!p) return;
    const t = d.target;
    if (d.from.kind === 'pal') {
      if (t) this.addCmd(d.cell.op, t.slot, t.index);
      return;
    }
    if (!t) { this.removeCmd(d.from.slot, d.from.index); return; }
    this.moveCmd(d.from.slot, d.from.index, t.slot, t.index);
  }

  // ------------------------------------------------------------------ editing

  snapshot() { return JSON.stringify(this.program); }

  /** Apply an edit (fn changes a copy of the program and returns false to refuse). */
  edit(fn) {
    if (this.mode !== 'edit') this.resetRun(true);
    const before = this.snapshot();
    const next = JSON.parse(before);
    if (fn(next) === false) return false;
    if (!this.level.loops && hasLoop(next)) {
      sfx('error');
      toast(this, 'Loops unlock in World 5: a function can\'t call itself yet.', this.toastY());
      return false;
    }
    this.undoStack.push(before);
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.program = next;
    this.storeProgram();
    this.refresh();
    this.syncControls();
    return true;
  }

  full(slot) {
    sfx('error');
    toast(this, `${SLOT_NAMES[slot]} is full (${this.cap(slot)} commands).`, this.toastY());
  }

  addCmd(op, slot, index) {
    if (this.program[slot].length >= this.cap(slot)) { this.full(slot); return; }
    if (this.edit((p) => { p[slot].splice(index, 0, { op, cond: this.brush }); })) sfx('place');
  }

  removeCmd(slot, index) {
    if (this.edit((p) => { p[slot].splice(index, 1); })) sfx('flip');
  }

  moveCmd(fs, fi, ts, ti) {
    if (fs === ts && fi === ti) { this.refresh(); return; }
    if (fs !== ts && this.program[ts].length >= this.cap(ts)) { this.full(ts); this.refresh(); return; }
    if (this.edit((p) => { const [c] = p[fs].splice(fi, 1); p[ts].splice(ti, 0, c); })) sfx('place');
  }

  paintCmd(slot, index) {
    const cur = this.program[slot][index].cond;
    const to = cur === this.brush ? null : this.brush;
    if (this.edit((p) => { p[slot][index].cond = to; })) sfx('select');
  }

  undo() {
    if (!this.undoStack.length) return;
    if (this.mode !== 'edit') this.resetRun(true);
    this.program = JSON.parse(this.undoStack.pop());
    this.storeProgram();
    this.refresh();
    this.syncControls();
    sfx('flip');
  }

  clearSlot() {
    const s = this.sel;
    if (!this.program[s].length) return;
    this.edit((p) => { p[s] = []; });
    toast(this, `${SLOT_NAMES[s]} cleared. Undo brings it back.`, this.toastY(), PALETTE.cream, 1200);
  }

  // ------------------------------------------------------------------ running

  stepMs() { return 420 / this.speed; }

  startRun() {
    this.hideBanner();
    this.run = createRun(this.lv, this.program);
    this.runLength = programLength(this.program);
    this.state = this.run.state;
    stat('programs run');
  }

  runPressed() {
    if (this.animating && this.mode !== 'running') return;
    if (!this.program.main.length) { sfx('error'); toast(this, 'Add some commands to MAIN first.', this.toastY()); return; }
    if (this.mode === 'running') { this.mode = 'paused'; sfx('tap'); this.syncControls(); return; }
    sfx('select');
    if (this.mode === 'done') this.resetRun(true);
    if (this.mode === 'edit') this.startRun();
    this.mode = 'running';
    this.syncControls();
    this.coach.removeAll(true);
    if (!this.animating) this.doStep();
  }

  stepOnce() {
    if (!this.program.main.length) { sfx('error'); toast(this, 'Add some commands to MAIN first.', this.toastY()); return; }
    if (this.mode === 'running') { this.mode = 'paused'; this.syncControls(); return; }
    if (this.animating) return;
    if (this.mode === 'done') this.resetRun(true);
    if (this.mode === 'edit') this.startRun();
    this.mode = 'paused';
    this.syncControls();
    this.coach.removeAll(true);
    this.doStep();
  }

  resetRun(quiet = false) {
    this.gen++;
    this.tweens.killTweensOf(this.robot);
    this.robotAnim?.remove();
    this.animating = false;
    this.run = null;
    this.mode = 'edit';
    this.state = initState(this.lv);
    this.hideBanner();
    this.drawDynamic(true);
    this.drawHighlight();
    this.syncControls();
    if (!quiet) { sfx('flip'); this.updateCoach(); }
  }

  doStep() {
    if (!this.run || this.run.done) return;
    const before = this.state;
    const info = stepRun(this.run);
    if (!info) return;
    this.animating = true;
    this.drawHighlight(info);
    const gen = this.gen;
    this.animateStep(info, before, this.run.state, () => {
      if (gen !== this.gen) return;
      this.animating = false;
      this.state = this.run.state;
      this.drawDynamic(!info.fail);
      if (info.won) { this.onWin(); return; }
      if (info.fail) { this.onFail(info.fail); return; }
      if (this.mode === 'running') this.time.delayedCall(this.stepMs() * 0.15, () => { if (gen === this.gen && this.mode === 'running' && !this.animating) this.doStep(); });
    });
  }

  /** Gold box on the command being run; plum boxes on the calls it is inside. */
  drawHighlight(info) {
    const g = this.hiLayer;
    g.clear();
    if (!info || !this.run) return;
    for (const f of this.run.stack.slice(0, info.slot ? undefined : 0)) {
      if (f.pc <= 0 || !this.slotGeo[f.slot]) continue;
      if (f.slot === info.slot && f === this.run.stack.at(-1)) continue;
      const { x, y } = this.cellPos(f.slot, f.pc - 1);
      g.lineStyle(3, hex(PALETTE.plum)).strokeRect(x - CELL / 2 - 3, y - CELL / 2 - 3, CELL + 6, CELL + 6);
    }
    if (info.slot && info.index >= 0) {
      const { x, y } = this.cellPos(info.slot, info.index);
      g.lineStyle(4, hex(info.skipped ? PALETTE.lavender : PALETTE.gold)).strokeRect(x - CELL / 2 - 3, y - CELL / 2 - 3, CELL + 6, CELL + 6);
      if (info.skipped) g.fillStyle(hex(PALETTE.ink), 0.5).fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
    }
  }

  animateStep(info, before, after, done) {
    const ms = this.stepMs();
    const gen = this.gen;
    const later = (t, fn) => this.time.delayedCall(t, () => { if (gen === this.gen) fn(); });
    if (info.skipped || !info.op) { later(ms * 0.45, done); return; }
    if (info.op === '1' || info.op === '2') { sfx('tap'); later(ms * 0.35, done); return; }
    if (info.op === 'L' || info.op === 'R') {
      sfx('move');
      setRef(this, this.robot, robotRef(after.d));
      this.tweens.add({ targets: this.robot, scaleX: this.scaleArt * 0.8, yoyo: true, duration: ms * 0.2 });
      later(ms * 0.6, done);
      return;
    }
    if (info.op === 'A') {
      for (const e of info.events) this.actionEvent(e, after);
      setRef(this, this.robot, robotRef(after.d, 'push', 1));
      later(ms * 0.35, () => setRef(this, this.robot, robotRef(after.d)));
      later(ms * 0.7, done);
      return;
    }
    // Move / Jump: follow the path.
    const segs = [...info.path];
    let k = 0;
    this.robotAnim = this.time.addEvent({ delay: 90, loop: true, callback: () => { k++; if (gen === this.gen && this.robot.alpha > 0) setRef(this, this.robot, robotRef(before.d, 'walk', k)); } });
    let cur = { x: before.x, y: before.y, h: this.lv.cells[before.y * this.lv.w + before.x].h };
    const next = () => {
      if (gen !== this.gen) return;
      const seg = segs.shift();
      if (!seg) {
        this.robotAnim.remove();
        for (const e of info.events) this.passEvent(e);
        if (!info.fail) setRef(this, this.robot, robotRef(after.d));
        done();
        return;
      }
      this.animateSeg(cur, seg, ms, info.fail && !segs.length ? info.fail : null, next);
      if (seg.how !== 'fall' && seg.how !== 'bump' && seg.how !== 'hop') cur = seg;
    };
    next();
  }

  animateSeg(from, seg, ms, fail, next) {
    const r = this.robot;
    const tx = this.px(seg.x); const ty = this.py(seg.y, seg.h) - this.rl;
    const fx = this.px(from.x); const fy = this.py(from.y, from.h) - this.rl;
    r.setDepth(Math.max(0, Math.max(from.y, seg.y)) * 10 + 5);
    const arc = (dur, x1, y1, height, cb) => {
      const o = { t: 0 };
      this.tweens.add({
        targets: o, t: 1, duration: dur,
        onUpdate: () => { r.x = fx + (x1 - fx) * o.t; r.y = fy + (y1 - fy) * o.t - Math.sin(Math.PI * o.t) * height; },
        onComplete: cb,
      });
    };
    switch (seg.how) {
      case 'walk': sfx('move'); this.tweens.add({ targets: r, x: tx, y: ty, duration: ms * 0.8, onComplete: next }); break;
      case 'jump': sfx('bounce'); arc(ms * 0.85, tx, ty, 14, next); break;
      case 'hop': sfx('bounce'); arc(ms * 0.6, fx, fy, 10, next); break;
      case 'slide': this.tweens.add({ targets: r, x: tx, y: ty, duration: ms * 0.35, onComplete: next }); break;
      case 'tele':
        sfx('power');
        this.tweens.add({
          targets: r, alpha: 0, scaleX: 0.5, duration: ms * 0.25,
          onComplete: () => { r.setPosition(tx, ty).setDepth(seg.y * 10 + 5); this.tweens.add({ targets: r, alpha: 1, scaleX: this.scaleArt, duration: ms * 0.25, onComplete: next }); },
        });
        break;
      case 'bump': {
        sfx('thud');
        const bx = fx + (tx - fx) * 0.3; const by = fy + (this.py(seg.y, from.h) - this.rl - fy) * 0.3;
        this.tweens.add({ targets: r, x: bx, y: by, duration: ms * 0.25, yoyo: true, onComplete: () => { this.cameras.main.shake(120, 0.006); next(); } });
        break;
      }
      case 'fall': {
        const mx = this.px(seg.x); const my = this.py(seg.y, from.h) - this.rl;
        this.tweens.add({
          targets: r, x: mx, y: my, duration: ms * 0.6,
          onComplete: () => {
            sfx('error');
            this.tweens.add({ targets: r, y: my + 40, alpha: 0, angle: 90, scale: this.scaleArt * 0.6, duration: 400, onComplete: next });
          },
        });
        break;
      }
      default: next();
    }
  }

  /** Lamps, crates: things Action does. */
  actionEvent(e, after) {
    const gx = e.at % this.lv.w; const gy = Math.floor(e.at / this.lv.w);
    if (e.type === 'light') sfx('coin');
    if (e.type === 'unlight') sfx('flip');
    if (e.type === 'pick' || e.type === 'drop') sfx('place');
    if (e.type === 'nothing') {
      sfx('bounce');
      const t = text(this, this.robot.x, this.robot.y - 26, '?', { color: PALETTE.lavender }).setDepth(320);
      this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 500, onComplete: () => t.destroy() });
    }
    if (e.type === 'light' || e.type === 'unlight') {
      const on = e.type === 'light';
      if (on) this.lampImg[e.at].clearTint(); else this.lampImg[e.at].setTint(0x4a4a5e);
      this.glow[e.at].setVisible(on);
      if (on) {
        const ring = this.add.rectangle(this.px(gx), this.py(gy, this.lv.cells[e.at].h), this.C, this.C).setStrokeStyle(3, hex(PALETTE.gold)).setDepth(310);
        this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
      }
    }
    if (e.type === 'pick' || e.type === 'drop') {
      this.state = after;
      this.drawDynamic(false);
    }
    this.updateStatus();
  }

  /** Gears and gates picked up / opened while moving. */
  passEvent(e) {
    if (e.type === 'gear') sfx('power');
    if (e.type === 'gate') sfx('hit');
  }

  // ------------------------------------------------------------------ results

  onWin() {
    this.mode = 'done';
    this.syncControls();
    this.drawHighlight();
    sfx('win');
    const res = recordWin(this.level, this.runLength);
    this.winTrophies(res);
    this.updateStatus();
    // Celebrate: every lamp flashes.
    Object.values(this.lampImg).forEach((img, k) => this.tweens.add({ targets: img, scale: this.scaleArt * 1.25, yoyo: true, duration: 160, delay: k * 50 }));
    this.time.delayedCall(700, () => this.winModal(res));
  }

  winTrophies(res) {
    stat('levels cleared');
    earn('first-solve');
    if (res.runStars >= 3) earn('three-stars');
    if (this.runLength < this.level.target) earn('code-golf');
    for (let w = 1; w <= 4; w++) if (LEVELS.filter((l) => l.world === w).every((l) => isSolved(l))) earn(`world-${w}`);
    if (LEVELS.every((l) => isSolved(l))) earn('world-5');
    const stars = totalStars();
    if (stars >= 60) earn('stars-60');
    if (stars >= LEVELS.length * 3) earn('all-stars');
    if (this.daily) {
      earn('daily');
      if (res.runStars >= 3) earn('daily-3');
      daily(this.runLength, this.daily, { lower: true });
    }
  }

  winModal(res) {
    if (this.leaving) return;
    const last = this.index === LEVELS.length - 1;
    const lines = [
      `Your program: ${this.runLength} commands`,
      res.runStars < 3 ? `${this.level.target} or fewer earns 3 stars.` : 'Target reached!',
    ];
    if (res.prev != null) lines.push(res.newRecord ? `New best! (was ${res.prev})` : `Your best: ${res.prev}`);
    if (last) lines.push('You finished every level. Well done!');
    const buttons = [];
    if (!last) buttons.push(['Next level', () => go(this, 'Play', { index: this.index + 1 })]);
    buttons.push([res.runStars < 3 ? 'Try for 3 stars' : 'Play again', () => this.resetRun(), last ? PALETTE.gold : PALETTE.lavender]);
    buttons.push(['Levels', () => go(this, 'Levels', { world: this.level.world })]);
    this.showModal(last ? 'All done!' : 'Level clear!', lines, buttons, {
      extra: 44,
      content: (c, y) => c.add(starRow(this, WIDTH / 2, y + 18, res.runStars, { scale: 2, gap: 32 })),
    });
  }

  onFail(reason) {
    this.mode = 'done';
    this.syncControls();
    sfx(reason === 'ended' ? 'error' : 'lose');
    if (reason === 'long') earn('forever');
    if (reason === 'fell') earn('fell');
    const g = goalCounts(this.lv, this.state);
    let msg = FAIL[reason] || 'Stopped.';
    if (reason === 'ended' && this.state.carrying && g.lamps === g.lampsTotal) msg = 'Out of moves: still carrying a crate.';
    this.showBanner(msg, 'Tap Retry, or change your program.', PALETTE.orange);
  }

  showBanner(msg, sub, color = PALETTE.gold) {
    this.hideBanner();
    const t = text(this, WIDTH / 2, 0, msg, { color, wrap: WIDTH - 40 });
    const s = sub ? text(this, WIDTH / 2, 0, sub, { color: PALETTE.cream, wrap: WIDTH - 40 }) : null;
    const h = t.height + (s ? s.height + 4 : 0) + 14;
    const y = this.grid.top + this.grid.h - h / 2 + 4;
    const bg = this.add.rectangle(WIDTH / 2, y, WIDTH - 12, h, hex(PALETTE.ink), 0.9).setStrokeStyle(2, hex(color));
    t.setY(y - h / 2 + 7 + t.height / 2);
    if (s) s.setY(t.y + t.height / 2 + 4 + s.height / 2);
    this.banner.add([bg, t, ...(s ? [s] : [])]);
  }

  hideBanner() { this.banner?.removeAll(true); }

  showModal(title, lines, buttons, opts = {}) {
    this.press = null;
    if (this.drag) this.endDrag(null);
    this.modalOpen++;
    let counted = true;
    const m = modal(this, title, lines, buttons, {
      ...opts,
      onClose: () => { if (counted) { counted = false; this.modalOpen--; } },
    });
    return m;
  }

  showHint() {
    const buttons = [
      ['Close', null],
      ['Show an answer', () => this.showModal('Show an answer?', ['This replaces your program with one that solves the level.'], [
        ['Yes, show me', () => this.loadAnswer()], ['No, keep trying', null],
      ])],
    ];
    this.showModal('Hint', [this.level.hint], buttons);
  }

  loadAnswer() {
    const sol = this.level.solution;
    this.edit((p) => { for (const s of SLOTS) p[s] = sol[s].map((c) => ({ ...c })); });
    this.brush = null;
    this.syncPalette();
    toast(this, 'Answer loaded. Press Run to watch it.', this.toastY(), PALETTE.cream);
  }

  // ------------------------------------------------------------------ first-time coaching

  /** What to tell a new player right now: { msg, at: {x, y} } or null. */
  coachTip() {
    const id = this.level.id;
    const p = this.program;
    const solved = bestFor(id) != null;
    if (solved || this.mode !== 'edit') return null;
    const pal = (op) => this.palItems.find((o) => o.item.kind === 'op' && o.item.op === op);
    const cellAt = (s, i) => this.cellPos(s, i);
    if (id === '1-1') {
      const code = codeString(p.main);
      if (code === '') return { msg: 'Tap Move to add it to your program (MAIN).', at: pal('F') };
      if (code === 'F' || code === 'F F') return { msg: 'The lamp is 3 tiles away. Add Move until there are three.', at: pal('F') };
      if (code === 'F F F') return { msg: 'Now add Action (the lightning bolt). It lights the lamp.', at: pal('A') };
      if (code === 'F F F A') return { msg: 'Press Run and watch the robot go!', at: this.runBtn };
      return { msg: 'Tap a command in MAIN to remove it. You need Move, Move, Move, Action.', at: cellAt('main', p.main.length - 1) };
    }
    if (id === '2-1') {
      if (!p.f1.length && this.sel !== 'f1') return { msg: 'Tap F1 to pick that slot. New commands then go into F1.', at: this.slotGeo.f1.label.c, side: true };
      if (!p.f1.length) return { msg: 'Now add Move, Move, Action to F1.', at: pal('F') };
      if (!p.main.some((c) => c.op === '1') && this.sel !== 'main') return { msg: 'Tap MAIN, then add the F1 command to run F1.', at: this.slotGeo.main.label.c, side: true };
      if (!p.main.some((c) => c.op === '1')) return { msg: 'Add the F1 command: each one runs all of F1.', at: pal('1') };
      return null;
    }
    if (id === '5-3') {
      const painted = [...p.main, ...p.f1].some((c) => c.cond);
      if (!painted && !this.brush) return { msg: 'Tap the blue brush, then tap a command in your program to paint it.', at: this.palItems.find((o) => o.item.kind === 'brush') };
      if (!painted) return { msg: 'Tap a command in your program to paint it blue. Tap the brush again to put it away.', at: p.f1.length ? cellAt('f1', 0) : null };
    }
    return null;
  }

  updateCoach() {
    if (!this.coach) return;
    this.coach.removeAll(true);
    this.coachTween?.remove();
    const tip = this.coachTip();
    if (!tip) { if (!this.banner.length || this.mode === 'edit') this.hideBanner(); return; }
    this.showBanner(tip.msg, null, PALETTE.gold);
    if (tip.at) {
      // An arrow above the target pointing down, or (side) just right of it pointing left.
      const g = this.add.graphics();
      if (tip.side) {
        g.fillStyle(hex(PALETTE.ink)).fillTriangle(9, -11, 9, 11, -9, 0);
        g.fillStyle(hex(PALETTE.gold)).fillTriangle(7, -8, 7, 8, -6, 0);
      } else {
        g.fillStyle(hex(PALETTE.ink)).fillTriangle(-11, -9, 11, -9, 0, 9);
        g.fillStyle(hex(PALETTE.gold)).fillTriangle(-8, -7, 8, -7, 0, 6);
      }
      const ax = tip.at.x + (tip.side ? 38 : 0); const ay = tip.at.y - (tip.side ? 0 : 34);
      g.setPosition(ax, ay);
      this.coach.add(g);
      this.coachTween = this.tweens.add({ targets: g, [tip.side ? 'x' : 'y']: (tip.side ? ax : ay) + 6, yoyo: true, repeat: -1, duration: 350 });
    }
  }
}

export { DIRS, OPS, openHowTo };
