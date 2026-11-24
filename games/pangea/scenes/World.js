// The map: drag to scroll, pinch or +/- to zoom, tap units and cities. A HUD bar on top (turn,
// gold, science, happiness) and an order bar at the bottom. Lists and dialogs are HTML panels.
import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, HEIGHT, store, go, openHowTo, toast,
} from './common.js';
import * as G from '../logic/game.js';
import * as AI from '../logic/ai.js';
import { UNITS, JOBS, COLORS, TECHS } from '../logic/data.js';
import {
  frame, unitFrame, drawTerrain, drawFog, ERA_TOWN,
} from '../art.js';
import * as P from './panels.js';
import {
  save, saveGame, loadGame, clearGame, recordResult,
} from '../save.js';
import { reportResult } from '../adaptive.js';
import { Coach } from './coach.js';

const T = 16; // world pixels per tile
const TOP = 58;
const BOTTOM = 516;
const ZOOMS = [1, 2, 3];
const MAJOR = new Set(['war', 'peace', 'pact', 'cityLost', 'cityWon', 'lost', 'held', 'wonder', 'dead', 'meet', 'broke', 'starve', 'trade']);

export class World extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    const start = store.start;
    store.start = null;
    this.s = start?.state || loadGame();
    if (!this.s) { this.scene.start('Menu'); return; }
    this.fresh = !!start?.fresh;
    // The scene object is reused between games: reset everything that lives on it.
    this.overShown = false; this.lastViewer = null; this.lastTechPrompt = null; this.lastIdlePrompt = null;
    this.aiRunning = false; this.coachText = null; this.info = null; this.reach = null;
    clearTimeout(this.saveTimer);
    this.busy = false;
    this.sel = null;
    this.pendingGoto = null;
    this.views = new Map();
    this.cityViews = new Map();
    this.zoomI = 1;
    this.over = !!this.s.over;
    this.me = this.viewer();
    document.body.style.background = PALETTE.night;

    // Map camera (main) shows the world between the bars; a UI camera on top draws the HUD.
    const cam = this.cameras.main;
    cam.setViewport(0, TOP, WIDTH, BOTTOM - TOP).setBackgroundColor('#1b6fa8');
    cam.setZoom(ZOOMS[this.zoomI]);
    cam.setBounds(-T * 3, -T * 3, this.s.w * T + T * 6, this.s.h * T + T * 6);
    cam.fadeIn(150);
    this.uiCam = this.cameras.add(0, 0, WIDTH, HEIGHT);
    this.world = this.add.layer();
    this.hud = this.add.layer();
    cam.ignore(this.hud);
    this.uiCam.ignore(this.world);

    this.buildWorld();
    this.buildHud();
    this.setupInput();
    this.coach = new Coach(this);
    this.time.addEvent({ delay: 260, loop: true, callback: () => this.animateIdle() });

    window.__pangea = { scene: this, G, AI, P };
    this.redrawAll();
    const home = G.cityById(this.s, this.s.civs[this.me].capital) || G.unitsOf(this.s, this.me)[0];
    if (home) this.centerOn(home.x, home.y);
    if (this.over) { this.refreshHud(); this.time.delayedCall(200, () => this.showOver()); return; }
    this.time.delayedCall(60, () => this.resumeTurn());
  }

  /** The civ whose eyes we look through. */
  viewer() {
    const s = this.s;
    if (s.civs[s.cur]?.human) return s.cur;
    const h = s.civs.find((c) => c.human && c.alive) || s.civs.find((c) => c.human);
    return h ? h.id : 0;
  }

  // ---------------------------------------------------------------- world drawing

  buildWorld() {
    const s = this.s;
    this.terrainRT = this.add.renderTexture(0, 0, s.w * T, s.h * T).setOrigin(0);
    this.borderG = this.add.graphics();
    this.rangeG = this.add.graphics();
    this.cityLayer = this.add.container(0, 0);
    this.unitLayer = this.add.container(0, 0);
    this.fogRT = this.add.renderTexture(0, 0, s.w * T, s.h * T).setOrigin(0);
    this.fogRT.setTint(0x7c82b4);
    this.veilRT = this.add.renderTexture(0, 0, s.w * T, s.h * T).setOrigin(0).setAlpha(0.42);
    this.labelLayer = this.add.container(0, 0);
    this.cursor = this.add.rectangle(0, 0, T, T).setStrokeStyle(1, hex(PALETTE.gold)).setOrigin(0).setVisible(false);
    this.tweens.add({ targets: this.cursor, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
    this.pathG = this.add.graphics();
    this.fx = this.add.container(0, 0);
    this.world.add([this.terrainRT, this.borderG, this.rangeG, this.cityLayer, this.unitLayer, this.veilRT, this.fogRT, this.labelLayer, this.cursor, this.pathG, this.fx]);
  }

  redrawAll() {
    drawTerrain(this, this.terrainRT, this.s);
    this.terrainKey = this.terrainSig();
    this.refreshWorld();
  }

  terrainSig() { return this.s.tiles.map((t) => `${t.f || ''}${t.imp || ''}`).join(','); }

  refreshWorld() {
    const s = this.s;
    if (this.terrainSig() !== this.terrainKey) { drawTerrain(this, this.terrainRT, s); this.terrainKey = this.terrainSig(); }
    this.vis = G.visibleSet(s, this.me);
    this.ex = s.civs[this.me].explored;
    drawFog(this, this.fogRT, s, this.ex, this.vis, this.veilRT);
    this.drawBorders();
    this.refreshCities();
    this.refreshUnits();
    this.drawRange();
  }

  drawBorders() {
    const s = this.s; const g = this.borderG;
    g.clear();
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        const o = s.tiles[i].o;
        if (o < 0 || !this.ex[i]) continue;
        const col = hex(COLORS[s.civs[o].color].hex);
        g.fillStyle(col, 0.13).fillRect(x * T, y * T, T, T);
        g.fillStyle(col, 0.95);
        const diff = (dx, dy) => { const nx = x + dx; const ny = y + dy; return !G.inMap(s, nx, ny) || s.tiles[ny * s.w + nx].o !== o; };
        if (diff(0, -1)) g.fillRect(x * T, y * T, T, 1.5);
        if (diff(0, 1)) g.fillRect(x * T, y * T + T - 1.5, T, 1.5);
        if (diff(-1, 0)) g.fillRect(x * T, y * T, 1.5, T);
        if (diff(1, 0)) g.fillRect(x * T + T - 1.5, y * T, 1.5, T);
      }
    }
  }

  refreshCities() {
    const s = this.s;
    const z = this.cameras.main.zoom;
    const seen = new Set();
    for (const ct of s.cities) {
      seen.add(ct.id);
      let v = this.cityViews.get(ct.id);
      if (!v) {
        v = { img: this.add.image(ct.x * T + T / 2, ct.y * T + T / 2, 'towns', '__BASE'), label: this.add.container(0, 0) };
        v.bg = this.add.rectangle(0, 0, 10, 18, 0x000000, 0.85).setOrigin(0.5, 1);
        v.txt = text(this, 0, -2, '', { size: 16 }).setOrigin(0.5, 1);
        v.label.add([v.bg, v.txt]);
        this.cityLayer.add(v.img);
        this.labelLayer.add(v.label);
        this.cityViews.set(ct.id, v);
      }
      const era = ERA_TOWN(G.eraOf(s, ct.owner));
      const [k, f] = frame(this, 'towns', era * 16, ct.blds.includes('walls') ? 32 : 16);
      v.img.setTexture(k, f);
      const known = !!this.ex[G.idx(s, ct.x, ct.y)];
      v.img.setVisible(known);
      v.label.setVisible(known);
      v.txt.setText(z < 2 ? `${ct.pop}` : `${ct.capital ? '*' : ''}${ct.name} ${ct.pop}`); // zoomed out: just the size
      v.bg.setSize(v.txt.width + 8, v.txt.height + 2).setFillStyle(hex(COLORS[s.civs[ct.owner].color].dark), 0.92).setStrokeStyle(1, hex(COLORS[s.civs[ct.owner].color].hex));
      v.label.setPosition(ct.x * T + T / 2, ct.y * T - 1).setScale(1 / z);
    }
    for (const [id, v] of this.cityViews) if (!seen.has(id)) { v.img.destroy(); v.label.destroy(); this.cityViews.delete(id); }
  }

  makeUnitView(u) {
    const c = this.add.container(0, 0);
    const col = hex(COLORS[this.s.civs[u.owner].color].hex);
    const plate = this.add.ellipse(0, 6, 13, 5, col, 0.95).setStrokeStyle(1, 0x040303);
    const [k, f] = unitFrame(this, u.type, 0, 0);
    const spr = this.add.image(0, 0, k, f);
    const flag = this.add.rectangle(-7, -7, 3, 4, col).setStrokeStyle(0.5, 0x040303);
    const hpBg = this.add.rectangle(0, 9, 12, 2, 0x040303).setOrigin(0.5);
    const hp = this.add.rectangle(-6, 9, 12, 2, 0x6c8c50).setOrigin(0, 0.5);
    const mark = this.add.rectangle(6, -6, 3, 3, 0xf9f5ef).setStrokeStyle(0.5, 0x040303).setVisible(false);
    c.add([plate, spr, flag, hpBg, hp, mark]);
    this.unitLayer.add(c);
    return { c, spr, hp, hpBg, mark, type: u.type, owner: u.owner, k: (u.id * 3) % 4 };
  }

  unitPos(u) {
    const both = G.civilianAt(this.s, u.x, u.y) && G.militaryAt(this.s, u.x, u.y);
    const civ = G.isCivilian(u);
    // In a city, units stand small in the corners so the town stays visible.
    if (G.cityAt(this.s, u.x, u.y)) return [u.x * T + T / 2 + (civ ? -5 : 5), u.y * T + T / 2 + 4];
    const dx = both ? (civ ? -3 : 3) : 0; const dy = both ? (civ ? -2 : 1) : 0;
    return [u.x * T + T / 2 + dx, u.y * T + T / 2 + dy];
  }

  refreshUnits() {
    const s = this.s;
    const alive = new Set();
    for (const u of s.units) {
      alive.add(u.id);
      let v = this.views.get(u.id);
      if (v && (v.type !== u.type || v.owner !== u.owner)) { v.c.destroy(); this.views.delete(u.id); v = null; }
      if (!v) { v = this.makeUnitView(u); this.views.set(u.id, v); }
      if (v.moving) continue;
      const [x, y] = this.unitPos(u);
      v.c.setPosition(x, y).setScale(G.cityAt(s, u.x, u.y) ? 0.7 : 1);
      const seen = !!this.vis[G.idx(s, u.x, u.y)];
      v.c.setVisible(seen);
      v.hp.width = 12 * u.hp / 10;
      v.hp.setFillStyle(u.hp > 6 ? 0x6c8c50 : u.hp > 3 ? 0xe3d245 : 0xa13d3b);
      v.hp.setVisible(u.hp < 10); v.hpBg.setVisible(u.hp < 10);
      v.mark.setVisible(!!(u.fort || u.sleep || u.job));
      v.mark.setFillStyle(u.job ? 0xd88038 : 0xf9f5ef);
      const spent = u.owner === this.me && s.cur === this.me && (u.moves <= 0 || u.fort || u.sleep || u.job);
      if (spent) v.spr.setTint(0x9a96a8); else v.spr.clearTint();
    }
    for (const [id, v] of this.views) if (!alive.has(id) && !v.dying) { v.c.destroy(); this.views.delete(id); }
    this.unitLayer.sort('y');
    this.placeCursor();
  }

  animateIdle() {
    for (const [, v] of this.views) {
      if (v.moving || v.dying || !v.c.visible) continue;
      v.k = (v.k + 1) % 4;
      const [k, f] = unitFrame(this, v.type, 0, v.k);
      v.spr.setTexture(k, f);
    }
  }

  placeCursor() {
    const u = this.sel && G.unitById(this.s, this.sel);
    if (!u) { this.cursor.setVisible(false); return; }
    this.cursor.setPosition(u.x * T, u.y * T).setVisible(true);
  }

  drawRange() {
    const g = this.rangeG;
    g.clear();
    this.pathG.clear();
    this.reach = null;
    const u = this.sel && G.unitById(this.s, this.sel);
    if (!u || !this.myTurn() || u.owner !== this.me) return;
    if (u.moves > 0) {
      this.reach = G.reachable(this.s, u);
      for (const [i, r] of this.reach) {
        if (r.passOnly || i === G.idx(this.s, u.x, u.y)) continue;
        const x = i % this.s.w; const y = Math.floor(i / this.s.w);
        g.fillStyle(0xf9f5ef, 0.28).fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      }
      // Targets next to the unit.
      for (const [dx, dy] of G.DIRS8) {
        const info = G.targetInfo(this.s, u, u.x + dx, u.y + dy);
        if (info && this.vis[G.idx(this.s, u.x + dx, u.y + dy)]) {
          g.lineStyle(1.5, info.kind === 'capture' ? 0xe3d245 : 0xd8402e, 1).strokeRect((u.x + dx) * T + 1, (u.y + dy) * T + 1, T - 2, T - 2);
        }
      }
    }
    if (this.pendingGoto) {
      const pts = this.pendingGoto.path;
      this.pathG.fillStyle(0xe3d245, 1);
      for (const [x, y] of pts) this.pathG.fillRect(x * T + T / 2 - 1.5, y * T + T / 2 - 1.5, 3, 3);
    }
  }

  // ---------------------------------------------------------------- camera

  centerOn(x, y) { this.cameras.main.centerOn(x * T + T / 2, y * T + T / 2); }

  ensureVisible(x, y) {
    const cam = this.cameras.main;
    const v = cam.worldView;
    const px = x * T + T / 2; const py = y * T + T / 2;
    const m = T * 1.5;
    if (px < v.x + m || px > v.right - m || py < v.y + m || py > v.bottom - m) this.centerOn(x, y);
  }

  setZoom(i) {
    i = Phaser.Math.Clamp(i, 0, ZOOMS.length - 1);
    if (i === this.zoomI) return;
    const cam = this.cameras.main;
    const mid = cam.midPoint.clone();
    this.zoomI = i;
    cam.setZoom(ZOOMS[i]);
    cam.centerOn(mid.x, mid.y);
    this.zoomBtns[0].setEnabled(i < ZOOMS.length - 1);
    this.zoomBtns[1].setEnabled(i > 0);
    this.refreshCities();
  }

  setupInput() {
    let down = null;
    let pinch = null;
    const inMap = (p) => p.y >= TOP && p.y <= BOTTOM;
    this.input.on('pointerdown', (p, over) => {
      const a = this.input.pointer1; const b = this.input.pointer2;
      if (a.isDown && b.isDown) { pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; down = null; return; }
      if (over.length || !inMap(p) || P.blocking() || this.coach.blocks(p)) { down = null; return; }
      down = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, drag: false, id: p.id };
    });
    this.input.on('pointermove', (p) => {
      if (pinch) {
        const a = this.input.pointer1; const b = this.input.pointer2;
        if (!a.isDown || !b.isDown) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > pinch.d * 1.35) { this.setZoom(this.zoomI + 1); pinch.d = d; }
        else if (d < pinch.d * 0.74) { this.setZoom(this.zoomI - 1); pinch.d = d; }
        return;
      }
      if (!down || !p.isDown || p.id !== down.id) return;
      const dx = p.x - down.x; const dy = p.y - down.y;
      if (!down.drag && Math.hypot(dx, dy) > 9) down.drag = true;
      if (down.drag) {
        const z = this.cameras.main.zoom;
        this.cameras.main.setScroll(down.sx - dx / z, down.sy - dy / z);
      }
    });
    this.input.on('pointerup', (p) => {
      if (pinch) { if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) pinch = null; down = null; return; }
      if (!down || p.id !== down.id) return;
      const d = down; down = null;
      if (d.drag || P.blocking() || this.busy) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = Math.floor(wp.x / T); const ty = Math.floor(wp.y / T);
      if (!G.inMap(this.s, tx, ty)) return;
      this.tapTile(tx, ty);
    });
    this.input.on('wheel', (p, _o, _dx, dy) => { if (inMap(p) && !P.blocking()) this.setZoom(this.zoomI + (dy > 0 ? -1 : 1)); });
  }

  // ---------------------------------------------------------------- HUD

  buildHud() {
    const add = (o) => { this.hud.add(o); return o; };
    const g = add(this.add.graphics());
    g.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, TOP);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, TOP - 3, WIDTH, 3);
    g.fillStyle(hex(PALETTE.night)).fillRect(0, BOTTOM, WIDTH, HEIGHT - BOTTOM);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, BOTTOM, WIDTH, 3);
    this.civStripe = add(this.add.rectangle(0, TOP - 3, WIDTH, 3, 0x2f8fe0).setOrigin(0));
    add(button(this, 27, 27, 46, 42, '<', () => this.leave(), { size: 32, fill: PALETTE.cream }));
    add(button(this, WIDTH - 27, 27, 46, 42, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold }));
    this.turnText = add(text(this, WIDTH / 2, 16, '', { color: PALETTE.cream }));
    this.statText = add(text(this, WIDTH / 2, 40, '', { color: PALETTE.gold }));
    // The stats line opens the empire overview.
    const z = add(this.add.zone(56, 2, WIDTH - 112, TOP - 6).setOrigin(0).setInteractive({ useHandCursor: true }));
    z.on('pointerup', () => { if (!P.blocking() && !this.busy) { sfx('tap'); P.showEmpire(this); } });
    this.zoomBtns = [
      add(button(this, WIDTH - 26, BOTTOM - 74, 40, 40, '+', () => this.setZoom(this.zoomI + 1), { size: 32, fill: PALETTE.cream })),
      add(button(this, WIDTH - 26, BOTTOM - 28, 40, 40, '-', () => this.setZoom(this.zoomI - 1), { size: 32, fill: PALETTE.cream })),
    ];
    this.panel = add(this.add.container(0, 0));
    this.banner = add(this.add.container(WIDTH / 2, TOP + 26).setVisible(false));
    const bb = this.add.rectangle(0, 0, 300, 36, hex(PALETTE.ink), 0.88).setStrokeStyle(2, hex(PALETTE.gold));
    this.bannerText = text(this, 0, 0, '', { color: PALETTE.cream });
    this.banner.add([bb, this.bannerText]);
    this.bannerBg = bb;
  }

  showBanner(msg) {
    this.bannerText.setText(msg);
    this.bannerBg.setSize(Math.min(WIDTH - 20, this.bannerText.width + 28), 36);
    this.banner.setVisible(!!msg);
  }

  myTurn() { return !this.s.over && this.s.cur === this.me && this.s.civs[this.me].human; }

  refreshHud() {
    const s = this.s; const me = this.me; const cv = s.civs[me];
    const t = G.civTotals(s, me);
    this.turnText.setText(`Turn ${s.turn}/${s.maxTurn}  ${cv.name}`).setColor(COLORS[cv.color].hex);
    const j = t.joy.net;
    this.statText.setText(`Gold ${cv.gold} (${t.net >= 0 ? '+' : ''}${t.net})  Sci ${t.sci}  Joy ${j >= 0 ? '+' : ''}${j}`);
    this.statText.setColor(j < 0 ? '#f3b0a8' : PALETTE.gold);
    this.civStripe.setFillStyle(hex(COLORS[cv.color].hex));
    this.refreshPanel();
  }

  clearPanel() { this.panel.removeAll(true); }

  pText(x, y, str, opts = {}) { const t = text(this, x, y, str, { origin: [0, 0.5], ...opts }); this.panel.add(t); return t; }

  pButton(x, y, w, h, label, fn, opts) {
    const b = button(this, x, y, w, h, label, () => { if (this.busy || P.blocking()) return; fn(); }, opts);
    this.panel.add(b);
    return b;
  }

  /** A row of evenly spaced buttons across the panel. items: [label, fn, opts]. */
  pRow(y, items, h = 40) {
    // items: [label, fn, opts, weight=1]; widths share the row by weight.
    const gap = 6; const left = 8;
    const total = items.reduce((a, it) => a + (it[3] ?? 1), 0);
    const unit = (WIDTH - left * 2 - gap * (items.length - 1)) / total;
    let x = left;
    return items.map(([label, fn, opts, wt = 1]) => {
      const w = Math.floor(unit * wt);
      const b = this.pButton(x + w / 2, y, w, h, label, fn, opts);
      x += w + gap;
      return b;
    });
  }

  refreshPanel() {
    this.clearPanel();
    const s = this.s;
    const L1 = BOTTOM + 16; const L2 = BOTTOM + 36; const R1 = BOTTOM + 62; const R2 = BOTTOM + 105;
    if (s.over) {
      this.pText(12, L1, 'The game is over.', { color: PALETTE.gold });
      this.pRow(R2, [['Results', () => this.showOver(), { fill: PALETTE.gold }], ['Main menu', () => this.leave()]]);
      return;
    }
    if (!this.myTurn()) {
      this.pText(12, L1, `${s.civs[s.cur].name} is moving...`, { color: PALETTE.lavender });
      return;
    }
    const u = this.sel && G.unitById(s, this.sel);
    const idle = G.idleUnits(s, this.me).length;
    const bottom = [
      [idle ? `Next (${idle})` : 'Next', () => this.nextUnit(), { fill: PALETTE.indigo, color: PALETTE.cream }],
      ['End Turn', () => this.askEndTurn(), { fill: idle ? PALETTE.lavender : PALETTE.gold }],
    ];
    const rowB = this.pRow(R2, bottom);
    rowB[0].setEnabled(idle > 0);
    this.endBtn = rowB[1];
    if (u && u.owner === this.me) {
      const d = UNITS[u.type];
      this.pText(12, L1, `${d.name}${u.vet ? ' (veteran)' : ''}`, { color: COLORS[s.civs[u.owner].color].hex });
      this.pText(WIDTH - 12, L1, `HP ${u.hp}/10  Moves ${u.moves}/${d.move}`, { origin: [1, 0.5], color: PALETTE.cream });
      const status = u.job ? `Building a ${JOBS[u.job.kind].name}: ${u.job.left} turn${u.job.left > 1 ? 's' : ''}` : u.goto ? `On the way to ${u.goto[0]},${u.goto[1]}` : u.fort ? 'Fortified (+25% defence)' : u.sleep ? 'Sleeping' : this.unitHint(u);
      this.pText(12, L2, status, { color: PALETTE.lavender });
      this.pRow(R1, this.unitActions(u));
      return;
    }
    // Nothing selected: research line + menu buttons.
    const cv = s.civs[this.me];
    const rt = G.turnsToResearch(s, this.me);
    if (this.info) {
      this.pText(12, L1, this.info[0], { color: PALETTE.cream });
      this.pText(12, L2, this.info[1] || '', { color: PALETTE.lavender });
    } else {
      this.pText(12, L1, cv.research ? `Studying ${TECHS[cv.research].name}: ${rt} turn${rt > 1 ? 's' : ''}` : 'Choose something to research!', { color: cv.research ? PALETTE.lavender : PALETTE.orange });
      const idleCities = G.citiesOf(s, this.me).filter((c) => !c.queue.length).length;
      if (idleCities) this.pText(12, L2, `${idleCities} cit${idleCities > 1 ? 'ies need' : 'y needs'} something to build`, { color: PALETTE.orange });
    }
    this.pRow(R1, [
      ['Tech', () => P.showTech(this), { fill: cv.research ? PALETTE.lavender : PALETTE.gold }],
      ['Empire', () => P.showEmpire(this)],
      ['Rivals', () => P.showRivals(this)],
    ]);
  }

  unitHint(u) {
    const s = this.s;
    if (u.type === 'settler') {
      if (G.canFoundAt(s, u.owner, u.x, u.y)) return 'A good spot? Tap Found City.';
      const t = G.tileAt(s, u.x, u.y);
      if (t.o >= 0 && t.o !== u.owner) return 'Can\'t found a city in foreign land.';
      return 'Too close to a city (3 tiles apart).';
    }
    if (u.type === 'worker') {
      if (G.jobOptions(s, u).length) return 'Pick a job for this tile.';
      if (G.cityAt(s, u.x, u.y)) return 'Move next to the city to work.';
      return G.tileAt(s, u.x, u.y).o === u.owner ? 'Nothing to build on this tile.' : 'Move to your own land to work.';
    }
    if (u.moves <= 0) return 'No moves left this turn.';
    return 'Tap a light tile to move.';
  }

  unitActions(u) {
    const s = this.s;
    const out = [];
    if (u.type === 'settler') out.push(['Found City', () => this.found(u), { fill: PALETTE.gold }]);
    if (u.type === 'worker') {
      for (const k of G.jobOptions(s, u)) out.push([k === 'chop' ? 'Chop' : JOBS[k].name, () => this.doJob(u, k), { fill: PALETTE.gold }]);
    }
    if (u.goto) out.push(['Stop', () => { u.goto = null; this.changed(); }]);
    if (!UNITS[u.type].civ && !u.fort) out.push(['Fortify', () => { G.fortify(s, u); sfx('place'); this.afterOrder(); }]);
    if ((u.fort || u.sleep || u.job) && !u.goto) out.push(['Wake', () => { u.fort = false; u.sleep = false; u.job = null; this.changed(); }]);
    if (u.type === 'worker' && !u.sleep && !u.job && out.length < 3) out.push(['Sleep', () => { G.fortify(s, u); this.afterOrder(); }]);
    out.push(['Skip', () => { G.skip(s, u); this.afterOrder(); }]);
    out.push(['Disband', () => this.askDisband(u), { fill: PALETTE.indigo, color: PALETTE.cream }]);
    // Three orders plus a close button (back to the Tech / Empire / Rivals buttons).
    const items = out.slice(0, 3);
    items.push(['X', () => this.select(null), { fill: PALETTE.cream }, 0.5]);
    const btns = this.pRow(BOTTOM + 62, items);
    items.forEach(([label], i) => {
      if (label === 'Found City' && !G.canFoundAt(s, u.owner, u.x, u.y)) btns[i].setEnabled(false);
      if ((label === 'Found City' || JOBS[label.toLowerCase()] || label === 'Chop') && u.moves <= 0 && !u.job) btns[i].setEnabled(false);
    });
    return [];
  }

  // ---------------------------------------------------------------- orders

  changed() {
    if (!this.s) return;
    this.refreshWorld();
    this.refreshHud();
    this.saveSoon();
  }

  saveSoon() {
    if (this.s.over) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveGame(this.s), 120);
  }

  select(u, { center = false } = {}) {
    this.sel = u ? u.id : null;
    this.pendingGoto = null;
    this.info = null;
    if (u) { sfx('select'); if (center) this.ensureVisible(u.x, u.y); }
    this.drawRange();
    this.placeCursor();
    this.refreshPanel();
    if (u) this.coach.event('selected', u);
  }

  afterOrder() {
    this.changed();
    // Move on to the next unit that wants orders.
    const next = G.idleUnits(this.s, this.me)[0];
    this.select(next || null, { center: true });
  }

  nextUnit() {
    const list = G.idleUnits(this.s, this.me);
    if (!list.length) { this.select(null); return; }
    const i = list.findIndex((u) => u.id === this.sel);
    const u = list[(i + 1) % list.length];
    this.select(u);
    this.centerOn(u.x, u.y);
  }

  found(u) {
    const ct = G.foundCity(this.s, u);
    if (!ct) { sfx('error'); return; }
    sfx('power');
    this.sel = null;
    this.changed();
    this.puff(ct.x, ct.y);
    this.coach.event('founded', ct);
    this.time.delayedCall(350, () => P.showCity(this, ct.id, { onClose: () => this.coach.event('cityClosed') }));
  }

  doJob(u, k) {
    if (!G.startJob(this.s, u, k)) { sfx('error'); return; }
    sfx('place');
    this.coach.event('job');
    this.afterOrder();
  }

  askDisband(u) {
    P.confirm({
      title: 'Disband?', text: `Send this ${UNITS[u.type].name} home for good? It saves its upkeep.`, yes: 'Disband', yesCls: 'red',
      onYes: () => { G.disband(this.s, u); this.sel = null; this.changed(); this.checkOver(); },
    });
  }

  tapTile(x, y) {
    const s = this.s;
    if (!this.myTurn()) { this.showTileInfo(x, y); return; }
    const u = this.sel && G.unitById(s, this.sel);
    const i = G.idx(s, x, y);
    const seen = this.vis[i];
    const ct = G.cityAt(s, x, y);
    const foreign = seen && (s.units.some((o) => o.x === x && o.y === y && o.owner !== this.me) || (ct && ct.owner !== this.me));
    if (u && u.owner === this.me && foreign && !G.isCivilian(u)) { this.tryAttack(u, x, y); return; }
    if (u && u.owner === this.me && this.reach?.has(i) && !this.reach.get(i).passOnly && (u.x !== x || u.y !== y)) { this.moveSelected(u, x, y); return; }
    // Own units on the tile: select (tap again to switch between the two that can share a tile).
    const mine = s.units.filter((o) => o.x === x && o.y === y && o.owner === this.me);
    if (ct && ct.owner === this.me && (!mine.length || (u && u.x === x && u.y === y && mine.length === 1))) { sfx('tap'); P.showCity(this, ct.id); return; }
    if (mine.length === 1 && u && u.id === mine[0].id && !ct) { this.select(null); return; } // tap again to let go
    if (mine.length) {
      const cur = mine.findIndex((o) => o.id === this.sel);
      const pick = mine[(cur + 1) % mine.length];
      if (cur >= 0 && mine.length === 1 && ct?.owner === this.me) { P.showCity(this, ct.id); return; }
      this.select(pick);
      return;
    }
    if (ct && this.ex[i]) { sfx('tap'); P.showCity(this, ct.id); return; }
    // Far tile with a unit selected: first tap shows the route, the second sends the unit.
    if (u && u.owner === this.me && u.moves > 0 && this.ex[i]) {
      if (this.pendingGoto && this.pendingGoto.x === x && this.pendingGoto.y === y) {
        const steps = G.moveUnit(s, u, x, y);
        this.pendingGoto = null;
        if (!steps.length) { sfx('error'); this.flashInfo(['Can\'t get there right now.']); return; }
        this.animateMove(u, steps, () => { this.coach.event('moved', u); this.afterMove(u); });
        return;
      }
      const path = G.findPath(s, u, x, y);
      if (path && path.length) {
        const turns = this.estimateTurns(u, path);
        this.pendingGoto = { x, y, path };
        this.info = [`Go here? ${turns} turn${turns > 1 ? 's' : ''} away.`, 'Tap the tile again to send the unit.'];
        sfx('tap');
        this.drawRange();
        this.refreshPanelInfoOnly();
        return;
      }
      if (!G.isLand(G.tileAt(s, x, y)) && !G.hasTech(s, this.me, 'mapmaking')) { this.flashInfo(['Land units need Map Making', 'to cross water.']); return; }
    }
    this.select(null);
    this.showTileInfo(x, y);
  }

  refreshPanelInfoOnly() {
    // Keep the unit panel but show the route question in the status lines.
    this.refreshPanel();
    const lines = this.panel.list.filter((o) => o.type === 'Text');
    if (this.info && lines.length >= 2) {
      lines[0].setText(this.info[0]).setColor(PALETTE.gold);
      const status = lines.find((t, k) => k > 0 && t.originX === 0);
      if (status) status.setText(this.info[1]).setColor(PALETTE.cream);
      const hp = lines.find((t) => t.originX === 1);
      if (hp) hp.setVisible(false);
    }
    this.info = null;
  }

  estimateTurns(u, path) {
    let turns = 1; let left = u.moves;
    for (const [x, y] of path) {
      if (left <= 0) { turns++; left = UNITS[u.type].move; }
      left -= G.stepCost(this.s, u, x, y);
    }
    return turns;
  }

  showTileInfo(x, y) {
    const s = this.s; const i = G.idx(s, x, y);
    if (!this.ex[i]) { this.info = ['Unexplored', 'Send a unit to see what is there.']; this.refreshPanel(); this.info = null; return; }
    const lines = P.tileText(s, x, y);
    const t = s.tiles[i];
    const other = this.vis[i] && s.units.find((o) => o.x === x && o.y === y && o.owner !== this.me);
    if (other) lines[1] = `${s.civs[other.owner].name} ${UNITS[other.type].name}, health ${other.hp}/10`;
    else if (t.o >= 0) lines[0] += `, ${t.o === this.me ? 'yours' : s.civs[t.o].name}`;
    this.info = lines;
    this.refreshPanel();
    this.info = null;
  }

  flashInfo(lines) { sfx('error'); this.info = lines; this.refreshPanel(); this.info = null; }

  moveSelected(u, x, y) {
    const steps = G.moveUnit(this.s, u, x, y);
    if (!steps.length) { sfx('error'); return; }
    this.animateMove(u, steps, () => { this.coach.event('moved', u); this.afterMove(u); });
  }

  afterMove(u) {
    this.changed();
    const live = G.unitById(this.s, u.id);
    if (live && live.moves > 0) this.select(live); else this.afterOrder();
    this.reportNew();
  }

  animateMove(u, steps, done) {
    const v = this.views.get(u.id);
    this.busy = true;
    sfx('move');
    if (!v) { this.busy = false; done(); return; }
    v.moving = true;
    v.c.setVisible(true);
    const pts = steps.map(([x, y]) => [x * T + T / 2, y * T + T / 2]);
    const dur = 85;
    let k = 0;
    const stepNext = () => {
      if (k >= pts.length) { v.moving = false; this.busy = false; done(); return; }
      const [px, py] = pts[k++];
      if (px < v.c.x) v.spr.setFlipX(true); else if (px > v.c.x) v.spr.setFlipX(false);
      this.tweens.add({ targets: v.c, x: px, y: py, duration: dur, onComplete: stepNext });
    };
    stepNext();
    this.ensureVisible(steps[steps.length - 1][0], steps[steps.length - 1][1]);
  }

  tryAttack(u, x, y) {
    const s = this.s;
    if (u.moves <= 0) { this.flashInfo(['No moves left this turn.', 'Attack next turn.']); return; }
    if (G.dist(u.x, u.y, x, y) > 1) {
      // Step next to the target first, if that is possible this turn.
      const reach = this.reach || G.reachable(s, u);
      let best = null; let bl = -1;
      for (const [i, r] of reach) {
        if (r.passOnly || r.left <= 0) continue;
        const fx = i % s.w; const fy = Math.floor(i / s.w);
        if (G.dist(fx, fy, x, y) === 1 && G.isLand(G.tileAt(s, fx, fy)) && r.left > bl) { bl = r.left; best = [fx, fy]; }
      }
      if (!best) { this.flashInfo(['Too far to attack this turn.', 'Move closer first.']); return; }
      const steps = G.moveUnit(s, u, best[0], best[1]);
      this.animateMove(u, steps, () => { this.changed(); this.select(u); this.tryAttack(u, x, y); });
      return;
    }
    const info = G.targetInfo(s, u, x, y);
    if (!info) { this.flashInfo(['Can\'t attack from here.', G.isLand(G.tileAt(s, u.x, u.y)) ? 'That unit can\'t be reached.' : 'Units at sea can\'t attack.']); return; }
    sfx('select');
    P.showForecast(this, u, info, () => {
      if (info.needsWar) { G.declareWar(s, this.me, info.owner); sfx('error'); }
      this.doAttack(u, x, y);
    });
  }

  doAttack(u, x, y) {
    const s = this.s;
    const from = [u.x, u.y];
    const res = G.attack(s, u, x, y);
    if (!res) { sfx('error'); return; }
    this.busy = true;
    const av = this.views.get(u.id) || this.views.get(res.attacker);
    if (res.kind === 'capture') {
      sfx('capture');
      if (res.city) this.cameras.main.flash(200, 240, 212, 114);
      this.busy = false;
      this.changed();
      this.puff(x, y);
      if (res.city) toast(this, `${G.cityById(s, res.city).name} is yours!`);
      this.afterMove(u);
      this.checkOver();
      return;
    }
    // Bump toward the target, then show the result.
    const dv = this.views.get(res.defender);
    sfx('hit');
    const ox = from[0] * T + T / 2; const oy = from[1] * T + T / 2;
    const tx = x * T + T / 2; const ty = y * T + T / 2;
    if (av) {
      av.moving = true;
      const [ka, fa] = unitFrame(this, res.attType, 3, 2);
      av.spr.setTexture(ka, fa);
      this.tweens.add({ targets: av.c, x: ox + (tx - ox) * 0.45, y: oy + (ty - oy) * 0.45, yoyo: true, duration: 140, onComplete: () => { av.moving = false; } });
    }
    if (dv) this.tweens.add({ targets: dv.c, alpha: 0.4, yoyo: true, repeat: 2, duration: 70 });
    this.time.delayedCall(420, () => {
      const loserView = res.won ? dv : av;
      const loserType = res.won ? res.defType : res.attType;
      sfx(res.won ? 'boom' : 'thud');
      if (loserView) this.playDeath(loserView, loserType);
      const pct = Math.round(res.info.win * 100);
      toast(this, res.won ? `Victory! (${pct}% chance)` : `Defeat (${pct}% chance)`, HEIGHT - 190, res.won ? PALETTE.gold : '#f3b0a8');
      this.time.delayedCall(420, () => {
        this.busy = false;
        this.changed();
        const live = G.unitById(s, u.id);
        if (live && live.moves > 0) this.select(live); else this.afterOrder();
        this.checkOver();
      });
    });
  }

  playDeath(v, type) {
    v.dying = true;
    let k = 0;
    this.time.addEvent({
      delay: 90, repeat: 3, callback: () => {
        const [kk, f] = unitFrame(this, type, 4, k++);
        v.spr.setTexture(kk, f);
        if (k === 4) this.tweens.add({ targets: v.c, alpha: 0, duration: 200, onComplete: () => v.c.destroy() });
      },
    });
  }

  puff(x, y) {
    const r = this.add.circle(x * T + T / 2, y * T + T / 2, 4, 0xf9f5ef, 0.8);
    this.fx.add(r);
    this.tweens.add({ targets: r, radius: 18, alpha: 0, duration: 450, onComplete: () => r.destroy() });
  }

  // ---------------------------------------------------------------- turns

  askEndTurn() {
    const s = this.s;
    const idleCity = G.citiesOf(s, this.me).find((c) => !c.queue.length);
    if (idleCity) {
      P.confirm({
        title: 'Idle city', text: `${idleCity.name} has nothing to build. Its production would go to waste.`,
        yes: 'Open city', no: 'End turn anyway',
        onYes: () => { this.centerOn(idleCity.x, idleCity.y); P.showCity(this, idleCity.id); },
        onNo: () => this.endTurn(),
      });
      return;
    }
    if (!s.civs[this.me].research && G.availableTechs(s, this.me).length) {
      P.confirm({
        title: 'No research', text: 'Your scholars have nothing to study. Pick a technology first?',
        yes: 'Pick research', no: 'End turn anyway',
        onYes: () => P.showTech(this), onNo: () => this.endTurn(),
      });
      return;
    }
    this.endTurn();
  }

  endTurn() {
    if (this.busy || !this.myTurn()) return;
    this.busy = true;
    this.select(null);
    sfx('flip');
    this.coach.event('endTurn');
    G.endTurn(this.s);
    saveGame(this.s);
    this.runOthers();
  }

  /** Let computer rivals move one by one (with a beat between them), then hand over. */
  runOthers() {
    const s = this.s;
    this.refreshHud();
    if (s.over) { this.aiRunning = false; this.showBanner(''); this.busy = false; this.changed(); this.checkOver(); return; }
    const cur = s.civs[s.cur];
    if (!cur.human) {
      this.aiRunning = true;
      this.showBanner(`${cur.name} is moving...`);
      this.refreshPanel();
      this.time.delayedCall(this.s.civs.filter((c) => !c.human).length > 2 ? 70 : 110, () => {
        if (!this.scene.isActive()) return;
        AI.playTurn(s, s.cur);
        G.endTurn(s);
        saveGame(s);
        this.refreshWorld();
        this.runOthers();
      });
      return;
    }
    this.showBanner('');
    this.aiRunning = false;
    this.busy = false;
    saveGame(s);
    if (s.hotseat && s.cur !== this.me) {
      this.me = s.cur;
      this.hideWorld(true);
      P.showHandoff(s, s.cur, () => { this.hideWorld(false); this.beginTurn(); }, () => this.leave());
      return;
    }
    this.me = s.cur;
    this.beginTurn();
  }

  hideWorld(h) { this.world.setVisible(!h); }

  /** Pick up after loading: an AI's turn in progress, a hand-off, or the human's turn. */
  resumeTurn() {
    const s = this.s;
    if (!s.civs[s.cur].human) { this.busy = true; this.runOthers(); return; }
    if (s.hotseat) {
      this.me = s.cur;
      this.hideWorld(true);
      P.showHandoff(s, s.cur, () => { this.hideWorld(false); this.beginTurn(true); }, () => this.leave());
      return;
    }
    this.me = s.cur;
    this.beginTurn(true);
  }

  beginTurn(resumed = false) {
    const s = this.s;
    this.refreshWorld();
    const cap = G.cityById(s, s.civs[this.me].capital) || G.unitsOf(s, this.me)[0];
    if (cap && (this.lastViewer !== this.me || resumed)) this.centerOn(cap.x, cap.y);
    this.lastViewer = this.me;
    // Long trips carry on by themselves.
    if (!resumed) G.runGotos(s, this.me);
    this.changed();
    this.coach.start();
    this.reportNew(() => this.offers(() => this.prompts()));
  }

  /** Show what happened since this player last looked. */
  reportNew(then) {
    const s = this.s; const cv = s.civs[this.me];
    const fresh = s.events.filter((e) => e.id > (cv.seenEv || 0) && (e.civ === this.me || (e.civ === -1 && this.cares(e))));
    cv.seenEv = s.evId || 0;
    const major = fresh.filter((e) => MAJOR.has(e.kind));
    const minor = fresh.filter((e) => !MAJOR.has(e.kind) && !e.quiet && e.kind !== 'idle');
    if (fresh.some((e) => e.kind === 'tech' || e.kind === 'wonder')) sfx('power');
    else if (fresh.some((e) => e.kind === 'built' && e.civ === this.me)) sfx('coin');
    minor.slice(-3).forEach((e, k) => this.time.delayedCall(k * 900, () => toast(this, e.text, HEIGHT - 190 - k * 4)));
    if (major.length && !this.s.over) {
      const color = (e) => (['cityLost', 'lost', 'war', 'dead', 'broke', 'starve'].includes(e.kind) ? '#f3b0a8' : ['cityWon', 'wonder', 'peace', 'pact', 'held', 'trade'].includes(e.kind) ? '#c9e6a8' : null);
      if (major.some((e) => e.kind === 'war')) sfx('error');
      P.showReport(this, major.slice(-12).map((e) => ({ text: e.text, color: color(e) })), () => { this.changed(); then?.(); });
      return;
    }
    then?.();
  }

  cares(e) {
    const me = this.me; const met = this.s.civs[me].met;
    if (e.kind === 'wonder' || e.kind === 'dead') return true;
    if (e.a === me || e.b === me) return true;
    return (e.a == null || met[e.a]) && (e.b == null || met[e.b]);
  }

  offers(then) {
    const s = this.s;
    const o = (s.offers || []).find((x) => x.to === this.me);
    if (!o) { then?.(); return; }
    P.showOffer(this, o, (yes) => {
      AI.answerOffer(s, o, yes);
      if (yes) sfx('coin');
      this.changed();
      this.offers(then);
    });
  }

  /** Start-of-turn nudges: research, idle cities, then the first unit that wants orders. */
  prompts() {
    const s = this.s;
    if (this.coach.active()) { this.coach.refresh(); return; }
    if (!s.civs[this.me].research && G.availableTechs(s, this.me).length && G.citiesOf(s, this.me).length && this.lastTechPrompt !== s.turn) {
      this.lastTechPrompt = s.turn; // once a turn, so closing the panel always gets you back to the map
      P.showTech(this, { onClose: () => this.prompts() });
      return;
    }
    const idle = G.citiesOf(s, this.me).find((c) => !c.queue.length);
    if (idle && this.lastIdlePrompt !== `${s.turn}:${idle.id}`) {
      this.lastIdlePrompt = `${s.turn}:${idle.id}`;
      this.centerOn(idle.x, idle.y);
      P.showCity(this, idle.id, { onClose: () => this.prompts() });
      return;
    }
    const u = G.idleUnits(s, this.me)[0];
    if (u && !this.sel) { this.select(u); this.ensureVisible(u.x, u.y); }
  }

  checkOver() {
    if (this.s.over && !this.overShown) this.time.delayedCall(500, () => this.showOver());
  }

  showOver() {
    const s = this.s;
    if (!s.over) return;
    this.overShown = true;
    const o = s.over;
    const humans = s.civs.filter((c) => c.human);
    const winner = s.civs[o.winner];
    const won = !!winner?.human;
    const how = { conquest: 'by conquest', science: 'by launching the Space Ark', score: `with the best score on turn ${s.maxTurn}`, defeat: 'after the last of your cities fell' }[o.kind] || '';
    let title; let msg;
    if (s.hotseat) { title = won ? `${winner.name} wins!` : 'The computer wins'; msg = `${winner.name} won ${how}.`; } else if (won) { title = 'Victory!'; msg = `${winner.name} won ${how}. Well played, ${winner.leader}!`; } else { title = 'Defeat'; msg = o.kind === 'defeat' ? 'Your civilization has fallen.' : `${winner?.name || 'A rival'} won ${how}.`; }
    if (!s.recorded) {
      s.recorded = true;
      const human = humans[0];
      if (!s.hotseat && human && s.civs.some((c) => !c.human)) {
        const sc = G.score(s, human.id);
        const best = Math.max(...s.civs.filter((c) => !c.human).map((c) => G.score(s, c.id)));
        recordResult(won, sc);
        reportResult(won ? 1 : 0, Math.min(1, Math.abs(sc - best) / Math.max(40, best)));
        if (s.tutorial) save.set('tutorialDone', true);
      }
      save.set('last', { won, kind: o.kind, turn: o.turn, civ: human?.name });
      clearGame();
    }
    this.refreshHud();
    P.showGameOver(this, {
      won: won || s.hotseat, title, text: msg,
      onNew: () => go(this, 'Menu', { setup: s.hotseat ? 'hotseat' : 'solo' }),
      onMenu: () => go(this, 'Menu'),
      onLook: () => { this.me = humans[0]?.id ?? 0; s.civs[this.me].explored.fill(1); this.changed(); this.refreshPanel(); },
    });
  }

  leave() {
    // Leaving is fine between rival turns (each one is saved whole), not mid-animation.
    if (this.busy && !this.aiRunning) return;
    if (!this.s.over) saveGame(this.s);
    P.closeAll();
    document.querySelector('.pg-cover')?.remove();
    this.coach.destroy();
    go(this, 'Menu');
  }
}
