import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import { W, H, TILE, ROAD_X, ROAD_Y, DISTRICTS, blockRect, findPath, districtOfRow } from '../logic/city.js';
import { BUILDINGS } from '../logic/buildings.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import * as P from './panels.js';

const VIEW = { y: 78, h: 456 };
const MW = W * TILE; const MH = H * TILE;
const MS_PER_MIN = 350;
const SPEEDS = [[0, '||'], [1, '1x'], [3, '3x'], [8, '8x']];
const ICON = { noise: 35, shoplift: 28, vandal: 54, breakin: 31, accident: 58, burglary: 12, assault: 40, domestic: 12, cartheft: 31, drugdeal: 7, robbery: 44, gangfight: 40, shooting: 49 };
const CIV_SMALL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const CIV_BIG = [1, 2, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15];
const GROUND = { uptown: 0x3a3f5c, downtown: 0x45405a, eastside: 0x4a3c44, harbor: 0x34453f };

// Cars drive on the right: shift them half a lane to the right of the road's centre line.
const LANE = { R: [0, 4], L: [0, -4], D: [-4, 0], U: [4, 0] };
const toPx = (x, y, dir = 'R') => ({ x: x * TILE + LANE[dir][0], y: y * TILE + LANE[dir][1] });

export class City extends Phaser.Scene {
  constructor() { super('City'); }

  init(data) {
    this.s = data.state;
    this.holds = new Set();
    this.speed = 1;
    this.followTarget = null;
    this.lastSaveHour = Math.floor(this.s.minute / 60);
  }

  create() {
    this.cameras.main.setBackgroundColor('#1c1618');
    this.world = this.add.container(0, 0);
    this.drawMap();
    // Night falls over the buildings (cars, lights and markers stay bright on top).
    this.night = this.add.rectangle(0, 0, MW, MH, 0x0b0a24, 0).setOrigin(0);
    this.world.add(this.night);
    this.windows = this.add.graphics().setAlpha(0);
    this.world.add(this.windows);
    for (const lot of S.city().lots) {
      const [pw, ph] = BUILDINGS[lot.key];
      const x0 = lot.x * TILE; const y0 = (lot.y + lot.h) * TILE - ph;
      const n = Math.max(1, Math.round((pw * ph) / 140));
      for (let k = 0; k < n; k++) {
        this.windows.fillStyle(Math.random() < 0.7 ? 0xf0d472 : 0xf9f5ef, 0.9).fillRect(x0 + 2 + Math.floor(Math.random() * (pw - 4)), y0 + 2 + Math.floor(Math.random() * (ph * 0.6)), 1, 1);
      }
    }
    this.vehLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.lights = this.add.graphics();
    this.heliG = this.add.graphics();
    this.crimeLayer = this.add.container(0, 0).setVisible(false);
    this.markLayer = this.add.container(0, 0);
    this.world.add([this.lights, this.vehLayer, this.fxLayer, this.heliG, this.crimeLayer, this.markLayer]);
    this.heli = { x: 0, y: 0, a: 0 };
    this.rain = this.add.graphics().setDepth(49);
    this.unitSprites = new Map();
    this.markers = new Map();
    this.fireFx = new Map();
    this.suspects = new Map();
    this.ambulances = [];
    this.spawnCivilians();
    this.spawnWalkers();

    const hq = S.city().landmark('hq');
    this.zoom = 2.4;
    this.centerOn((hq.x + hq.w / 2) * TILE, (hq.y + hq.h / 2) * TILE);
    this.setupInput();
    this.buildHud();
    this.refreshHud();

    this.onHide = () => { if (document.hidden) this.save(); };
    document.addEventListener('visibilitychange', this.onHide);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', this.onHide); P.closeAll(); });

    window.__city = { S, P, scene: this }; // for browser tests
    if (this.s.pendingMajor) this.time.delayedCall(300, () => P.showMajor(this));
    else if (this.s.dayOver) this.time.delayedCall(300, () => this.endDay());
    else if (!this.s.welcomed) this.time.delayedCall(400, () => P.showWelcome(this));
    else this.toast(`Day ${this.s.day}  ${S.clock(this.s.minute)}${this.s.weather === 'rain' ? '  Rain today' : ''}`);
  }

  // ------------------------------------------------------------ map drawing

  drawMap() {
    const g = this.add.graphics();
    g.fillStyle(0x262433).fillRect(0, 0, MW, MH);
    // Block ground, tinted by district
    for (let r = 0; r < ROAD_Y.length - 1; r++) {
      for (let c = 0; c < ROAD_X.length - 1; c++) {
        const b = blockRect(c, r);
        g.fillStyle(GROUND[districtOfRow(r).id]).fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
        g.fillStyle(0x8a8fc4, 0.35).fillRect(b.x * TILE, b.y * TILE, b.w * TILE, 1);
        g.fillStyle(0x040303, 0.35).fillRect(b.x * TILE, (b.y + b.h) * TILE - 1, b.w * TILE, 1);
      }
    }
    // Roads: two lanes with a dashed centre line
    const x0 = (ROAD_X[0] - 1) * TILE; const x1 = (ROAD_X.at(-1) + 1) * TILE;
    const y0 = (ROAD_Y[0] - 1) * TILE; const y1 = (ROAD_Y.at(-1) + 1) * TILE;
    g.fillStyle(0x4a4858);
    for (const y of ROAD_Y) g.fillRect(x0, (y - 1) * TILE, x1 - x0, 16);
    for (const x of ROAD_X) g.fillRect((x - 1) * TILE, y0, 16, y1 - y0);
    g.fillStyle(0xb9b6c9, 0.7);
    for (const y of ROAD_Y) {
      for (let px = x0; px < x1; px += 6) {
        if (ROAD_X.some((x) => Math.abs(px + 1 - x * TILE) < 10)) continue;
        g.fillRect(px, y * TILE, 3, 1);
      }
    }
    for (const x of ROAD_X) {
      for (let py = y0; py < y1; py += 6) {
        if (ROAD_Y.some((y) => Math.abs(py + 1 - y * TILE) < 10)) continue;
        g.fillRect(x * TILE, py, 1, 3);
      }
    }
    // Crosswalk stripes at each intersection edge
    g.fillStyle(0xf9f5ef, 0.35);
    for (const x of ROAD_X) {
      for (const y of ROAD_Y) {
        for (let k = -7; k <= 6; k += 2) {
          g.fillRect(x * TILE + k, (y - 1) * TILE - 3, 1, 2); g.fillRect(x * TILE + k, (y + 1) * TILE + 1, 1, 2);
          g.fillRect((x - 1) * TILE - 3, y * TILE + k, 2, 1); g.fillRect((x + 1) * TILE + 1, y * TILE + k, 2, 1);
        }
      }
    }
    this.world.add(g);
    this.bLayer = this.add.container(0, 0);
    this.world.add(this.bLayer);
    this.lotImgs = new Map();
    for (const lot of S.city().lots) {
      const [, ph] = BUILDINGS[lot.key];
      const img = this.add.image(lot.x * TILE, (lot.y + lot.h) * TILE - ph, `b:${lot.key}`).setOrigin(0, 0);
      this.bLayer.add(img);
      this.lotImgs.set(lot.id, img);
    }
  }

  // ------------------------------------------------------------ view and input

  clampView() {
    const z = this.zoom;
    const vw = WIDTH; const vh = VIEW.h;
    const w = MW * z; const h = MH * z;
    let x = this.world.x; let y = this.world.y;
    x = w <= vw ? (vw - w) / 2 : Phaser.Math.Clamp(x, vw - w, 0);
    y = h <= vh ? VIEW.y + (vh - h) / 2 : Phaser.Math.Clamp(y, VIEW.y + vh - h, VIEW.y);
    this.world.setPosition(Math.round(x), Math.round(y)).setScale(z);
  }

  centerOn(wx, wy) {
    this.world.x = WIDTH / 2 - wx * this.zoom;
    this.world.y = VIEW.y + VIEW.h / 2 - wy * this.zoom;
    this.clampView();
  }

  zoomAt(z, sx, sy) {
    const nz = Phaser.Math.Clamp(z, Math.min(WIDTH / MW, VIEW.h / MH), 4);
    const wx = (sx - this.world.x) / this.zoom; const wy = (sy - this.world.y) / this.zoom;
    this.zoom = nz;
    this.world.x = sx - wx * nz; this.world.y = sy - wy * nz;
    this.clampView();
  }

  setupInput() {
    this.input.addPointer(1);
    const inView = (p) => p.y >= VIEW.y && p.y <= VIEW.y + VIEW.h;
    this.drag = null;
    this.input.on('pointerdown', (p) => {
      if (!inView(p)) return;
      const both = this.input.pointer1.isDown && this.input.pointer2.isDown;
      if (both) {
        const a = this.input.pointer1; const b = this.input.pointer2;
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom };
        this.drag = null;
      } else {
        this.drag = { x: p.x, y: p.y, wx: this.world.x, wy: this.world.y, moved: 0, id: p.id };
      }
    });
    this.input.on('pointermove', (p) => {
      if (this.pinch && this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const a = this.input.pointer1; const b = this.input.pointer2;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt(this.pinch.z * (d / this.pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.followTarget = null;
        return;
      }
      if (!this.drag || !p.isDown || p.id !== this.drag.id) return;
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(p.x - this.drag.x, p.y - this.drag.y));
      if (this.drag.moved > 6) {
        this.followTarget = null;
        this.world.x = this.drag.wx + (p.x - this.drag.x); this.world.y = this.drag.wy + (p.y - this.drag.y);
        this.clampView();
      }
    });
    this.input.on('pointerup', (p) => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.pinch = null;
      if (this.drag && p.id === this.drag.id) {
        if (this.drag.moved <= 6 && inView(p)) this.tapAt(p.x, p.y);
        this.drag = null;
      }
    });
    this.input.on('wheel', (p, _o, _dx, dy) => { if (inView(p)) this.zoomAt(this.zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y); });
  }

  /** What did the chief tap on? Markers first, then cars. */
  tapAt(sx, sy) {
    if (P.blocking()) return;
    let best = null; let bd = 22;
    for (const [id, m] of this.markers) {
      const d = Math.hypot(this.world.x + m.x * this.zoom - sx, this.world.y + m.y * this.zoom - sy);
      if (d < bd) { bd = d; best = { kind: m.kind, id: m.kind === 'fire' ? m.fireId : id }; }
    }
    if (!best) {
      for (const u of this.s.units) {
        const spr = this.unitSprites.get(u.id); if (!spr) continue;
        const d = Math.hypot(this.world.x + spr.x * this.zoom - sx, this.world.y + spr.y * this.zoom - sy);
        if (d < Math.max(14, 6 * this.zoom) && d < bd) { bd = d; best = { kind: 'unit', id: u.id }; }
      }
    }
    if (!best) return;
    sfx('tap');
    if (best.kind === 'inc') P.showIncident(this, best.id);
    else if (best.kind === 'fire') {
      const f = this.s.fires.find((x) => x.id === best.id);
      if (f) this.toast(f.status === 'burning' ? `Fire on ${S.streetAt(f.door)}: ${Math.round(f.sev)}% burning` : f.status === 'out' ? 'Fire is out' : 'Building lost');
    } else {
      const u = this.s.units.find((x) => x.id === best.id);
      if (u.task.inc && this.s.incidents.some((i) => i.id === u.task.inc)) P.showIncident(this, u.task.inc);
      else this.toast(`Car ${u.id}: ${u.crew.map((id) => S.label(this.s.officers.find((o) => o.id === id))).join(' & ') || 'no driver'}`);
    }
  }

  follow(t) { this.followTarget = t; this.zoom = Math.max(this.zoom, 2.6); }

  // ------------------------------------------------------------ HUD

  buildHud() {
    const top = this.add.graphics().setDepth(50);
    top.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, VIEW.y);
    top.fillStyle(hex(PALETTE.ink)).fillRect(0, VIEW.y - 2, WIDTH, 2);
    top.fillStyle(hex(PALETTE.night)).fillRect(0, VIEW.y + VIEW.h, WIDTH, HEIGHT - VIEW.y - VIEW.h);
    top.fillStyle(hex(PALETTE.ink)).fillRect(0, VIEW.y + VIEW.h, WIDTH, 2);
    const d = (o) => o.setDepth(51);
    d(button(this, 28, 22, 44, 34, '<', () => this.toTitle(), { size: 32, fill: PALETTE.cream }));
    this.clockText = d(text(this, 150, 22, '', { size: 16, color: PALETTE.cream }));
    this.speedBtn = d(button(this, WIDTH - 82, 22, 54, 34, '1x', () => this.cycleSpeed(), { fill: PALETTE.gold }));
    d(button(this, WIDTH - 28, 22, 40, 34, '?', () => this.howTo(), { size: 32, fill: PALETTE.gold }));
    this.stats = ['Safety', 'Mayor', 'Morale'].map((l, i) => {
      const x = 8 + i * 92;
      const t = d(text(this, x, 50, l, { origin: 0, color: PALETTE.lavender }));
      const bg = d(this.add.rectangle(x, 68, 82, 5, hex(PALETTE.ink)).setOrigin(0, 0.5));
      const fg = d(this.add.rectangle(x, 68, 82, 5, hex(PALETTE.leaf)).setOrigin(0, 0.5));
      return { t, bg, fg, l };
    });
    this.moneyText = d(text(this, WIDTH - 8, 58, '', { origin: 0, color: PALETTE.gold }).setOrigin(1, 0.5));
    // Ticker
    this.ticker = d(text(this, 10, VIEW.y + VIEW.h + 8, '', { origin: 0, color: PALETTE.cream, wrap: 340 }));
    this.ticker.setOrigin(0, 0);
    const zone = this.add.zone(0, VIEW.y + VIEW.h + 2, WIDTH, 50).setOrigin(0).setInteractive().setDepth(51);
    zone.on('pointerup', () => { if (!P.blocking()) P.showLog(this); });
    const by = 616;
    [['Force', () => P.showForce(this)], ['Cases', () => P.showCases(this)], ['Budget', () => P.showBudget(this)], ['Paper', () => P.showPaper(this)]]
      .forEach(([l, fn], i) => d(button(this, 46 + i * 89, by, 84, 40, l, fn, { fill: i === 1 && this.s.groups.length ? PALETTE.orange : PALETTE.lavender })));
    this.casesBtnIdx = 1;
    // Calls waiting for the chief's decision: tap to jump to the oldest one.
    this.waitBtn = d(button(this, WIDTH - 66, VIEW.y + VIEW.h - 24, 116, 32, '', () => this.nextWaiting(), { fill: PALETTE.orange }));
    this.waitBtn.setVisible(false);
    this.pauseTag = d(text(this, WIDTH / 2, VIEW.y + 14, 'PAUSED', { color: PALETTE.gold }));
    this.crimeBtn = d(button(this, 54, VIEW.y + VIEW.h - 24, 96, 32, 'Crime map', () => this.toggleCrimeMap(), { fill: PALETTE.cream }));
    this.goalText = d(text(this, WIDTH / 2, VIEW.y + 14, '', { color: PALETTE.gold, wrap: 340 }));
    this.goalBg = this.add.rectangle(WIDTH / 2, VIEW.y + 14, WIDTH, 24, hex(PALETTE.ink), 0.75).setDepth(50).setVisible(false);
  }

  refreshHud() {
    const s = this.s;
    const avgMorale = S.activeOfficers(s).reduce((a, o) => a + o.morale, 0) / Math.max(1, S.activeOfficers(s).length);
    const vals = [s.safety, s.trust, avgMorale];
    this.stats.forEach((st, i) => {
      const v = Math.round(vals[i]);
      st.t.setText(`${st.l} ${v}`);
      st.fg.width = 82 * v / 100;
      st.fg.fillColor = hex(v < 25 ? PALETTE.red : v < 45 ? PALETTE.orange : PALETTE.leaf);
    });
    this.moneyText.setText(`${s.money < 0 ? '-' : ''}$${Math.abs(Math.round(s.money)).toLocaleString('en-US')}`);
    this.moneyText.setColor(s.money < 0 ? '#f3b0a8' : PALETTE.gold);
    const waiting = this.waitingCalls().length;
    this.waitBtn.setVisible(waiting > 0);
    if (waiting) this.waitBtn.setLabel(`${waiting} big call${waiting > 1 ? 's' : ''}`);
    const goal = this.crimeLayer.visible && s.demand ? `Mayor's goal: ${S.districtName(s.demand.district)} crime ${s.demand.target} or less (now ${Math.round(s.districts[s.demand.district].crime)})` : '';
    this.goalText.setText(goal); this.goalBg.setVisible(!!goal);
    this.pauseTag.setVisible(!goal && this.speed === 0 && Math.floor(this.time.now / 500) % 2 === 0);
    this.clockText.setText(`Day ${s.day}  ${S.clock(s.minute)}${s.mode === 'endless' ? '  Endless' : ''}`);
    const last = s.log.at(-1);
    // Two lines at most so it never runs into the buttons below; the full text is in the radio log.
    let tickerStr = last ? `${S.clock(last.t)} ${last.text}` : 'All quiet. Tap a marker to see a call.';
    if (tickerStr.length > 78) tickerStr = `${tickerStr.slice(0, 76).trimEnd()}...`;
    if (this.ticker.text !== tickerStr) {
      this.ticker.setText(tickerStr);
      this.ticker.setColor({ bad: '#f3b0a8', good: '#c9e6a8', alert: PALETTE.orange }[last?.tone] || PALETTE.cream);
    }
  }

  /** Big calls the chief hasn't looked at yet (the dispatcher may have sent one car already). */
  waitingCalls() { return this.s.incidents.filter((i) => !i.chief && !i.special && i.d >= 2 && (i.status === 'new' || i.status === 'enroute' || i.status === 'scene')).sort((a, b) => a.t0 - b.t0); }

  nextWaiting() {
    const inc = this.waitingCalls()[0];
    if (!inc) return;
    const lot = S.city().lots[inc.lot];
    this.zoom = Math.max(this.zoom, 2.4);
    this.centerOn((lot.x + lot.w / 2) * TILE, lot.y * TILE + 60 / this.zoom);
    P.showIncident(this, inc.id);
  }

  // ------------------------------------------------------------ overlays

  headlight(p, dir) {
    if (this.dark < 0.3) return;
    const v = { R: [6, 0], L: [-6, 0], D: [0, 6], U: [0, -6] }[dir];
    this.lights.fillStyle(0xf9f5ef, 0.22 * this.dark).fillCircle(p.x + v[0], p.y + v[1], 3);
  }

  drawRain(on) {
    this.rain.clear();
    if (!on) return;
    const t = this.time.now;
    this.rain.lineStyle(1, 0xb9c4e8, 0.45);
    for (let k = 0; k < 70; k++) {
      const x = (k * 53 + t * 0.25) % (WIDTH + 40) - 20;
      const y = VIEW.y + ((k * 97 + t * 0.6) % VIEW.h);
      this.rain.lineBetween(x, y, x - 3, Math.min(VIEW.y + VIEW.h, y + 8));
    }
  }

  /** The helicopter hovers over a chase or a big event, otherwise it circles HQ. */
  drawHeli(ms) {
    const g = this.heliG;
    g.clear();
    if (!this.s.heli) return;
    const s = this.s;
    const chase = s.incidents.find((i) => i.status === 'chase' && i.suspect);
    const ev = s.units.find((u) => u.task.type === 'event');
    let target;
    if (chase) target = toPx(chase.suspect.x, chase.suspect.y);
    else if (ev) target = toPx(ev.x, ev.y);
    else {
      const hq = S.city().landmark('hq');
      this.heli.a += ms / 2500;
      target = { x: (hq.x + hq.w / 2) * TILE + Math.cos(this.heli.a) * 40, y: (hq.y + hq.h / 2) * TILE + Math.sin(this.heli.a) * 30 };
    }
    const h = this.heli;
    if (!h.init) { Object.assign(h, target, { init: true }); }
    const dx = target.x - h.x; const dy = target.y - h.y;
    const d = Math.hypot(dx, dy);
    const sp = Math.min(d, (ms / 1000) * 70);
    if (d > 0.5) { h.x += (dx / d) * sp; h.y += (dy / d) * sp; h.face = Math.atan2(dy, dx); }
    const x = h.x; const y = h.y - 10; const f = h.face || 0;
    g.fillStyle(0x040303, 0.3).fillEllipse(h.x + 3, h.y + 3, 10, 5);
    const tx = x - Math.cos(f) * 9; const ty = y - Math.sin(f) * 9;
    g.lineStyle(3, 0x040303).lineBetween(x, y, tx, ty);
    g.lineStyle(1, 0xdfe3f0).lineBetween(x, y, tx, ty);
    g.fillStyle(0x040303).fillCircle(x, y, 5).fillStyle(0xdfe3f0).fillCircle(x, y, 4).fillStyle(0x3060ff).fillCircle(x + Math.cos(f) * 2, y + Math.sin(f) * 2, 1.8);
    const r = this.time.now / 40;
    g.lineStyle(1, 0xf9f5ef, 0.95).lineBetween(x - Math.cos(r) * 8, y - Math.sin(r) * 8, x + Math.cos(r) * 8, y + Math.sin(r) * 8);
    g.lineBetween(x - Math.cos(r + 1.57) * 8, y - Math.sin(r + 1.57) * 8, x + Math.cos(r + 1.57) * 8, y + Math.sin(r + 1.57) * 8);
    if (chase || ev) {
      const b = Math.floor(this.time.now / 150) % 2;
      g.fillStyle(b ? 0xff3030 : 0x3060ff).fillRect(x - 1, y - 5, 2, 1);
      g.fillStyle(0xf9f5ef, 0.12).fillCircle(h.x, h.y, 10); // searchlight
    }
  }

  toggleCrimeMap() {
    const on = !this.crimeLayer.visible;
    this.crimeLayer.setVisible(on);
    this.crimeBtn.setLabel(on ? 'Hide map' : 'Crime map');
    if (on) { this.zoomAt(0.1, WIDTH / 2, VIEW.y + VIEW.h / 2); this.followTarget = null; }
  }

  drawCrimeMap() {
    const s = this.s;
    if (!this.crimeParts) {
      this.crimeParts = DISTRICTS.map((d) => {
        const r0 = d.rows[0];
        const top = ROAD_Y[r0] * TILE; const bot = ROAD_Y[r0 + 1] * TILE;
        const rect = this.add.rectangle(ROAD_X[0] * TILE, top, (ROAD_X.at(-1) - ROAD_X[0]) * TILE, bot - top, 0xa13d3b, 0).setOrigin(0);
        const label = text(this, (ROAD_X[0] + ROAD_X.at(-1)) / 2 * TILE, (top + bot) / 2, '', { color: PALETTE.cream, size: 16 });
        const bg = this.add.rectangle(label.x, label.y, 10, 10, 0x040303, 0.75);
        this.crimeLayer.add([rect, bg, label]);
        return { d, rect, label, bg };
      });
    }
    for (const p of this.crimeParts) {
      const c = Math.round(s.districts[p.d.id].crime);
      const g = s.groups.filter((x) => x.district === p.d.id).length;
      const patrol = s.units.filter((u) => u.zone === p.d.id).length;
      p.rect.fillAlpha = 0.1 + (c / 100) * 0.55;
      p.label.setText(`${p.d.name}: crime ${c}${g ? `, ${g} gang${g > 1 ? 's' : ''}` : ''}${patrol ? `\n${patrol} car${patrol > 1 ? 's' : ''} assigned` : ''}`).setScale(1 / this.zoom);
      p.bg.setSize(p.label.width / this.zoom + 10, p.label.height / this.zoom + 6).setPosition(p.label.x, p.label.y);
      p.bg.setOrigin(0.5);
    }
  }

  cycleSpeed() {
    this.speed = (this.speed + 1) % SPEEDS.length;
    this.speedBtn.setLabel(SPEEDS[this.speed][1]);
  }

  howTo() {
    this.hold('howto');
    showHowTo(RULES, () => this.release('howto'));
  }

  toast(msg) {
    const t = text(this, WIDTH / 2, VIEW.y + 46, msg, { color: PALETTE.gold, wrap: 330 }).setDepth(60);
    const bg = this.add.rectangle(WIDTH / 2, VIEW.y + 46, Math.min(350, t.width + 16), t.height + 8, hex(PALETTE.ink), 0.8).setDepth(59);
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1500, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  hold(r) { this.holds.add(r); }
  release(r) { this.holds.delete(r); }

  // ------------------------------------------------------------ the clock

  update(_, ms) {
    const s = this.s;
    const running = !this.holds.size && SPEEDS[this.speed][0] > 0 && !s.over;
    const gm = running ? (Math.min(ms, 100) / MS_PER_MIN) * SPEEDS[this.speed][0] : 0;
    if (gm > 0) {
      const events = S.tick(s, gm);
      for (const e of events) this.onEvent(e);
      if (Math.floor(s.minute / 60) !== this.lastSaveHour) { this.lastSaveHour = Math.floor(s.minute / 60); this.save(); }
    }
    const h = (s.minute % 1440) / 60;
    const dark = h >= 20 || h < 5 ? 1 : h >= 18 ? (h - 18) / 2 : h < 7 ? (7 - h) / 2 : 0;
    const rain = s.weather === 'rain';
    this.night.fillAlpha = dark * 0.42 + (rain ? 0.12 : 0);
    this.windows.setAlpha(dark);
    this.dark = dark;
    this.drawRain(rain);
    this.drawHeli(ms);
    if (this.crimeLayer.visible) this.drawCrimeMap();
    this.lights.clear();
    this.stepCivilians(gm);
    this.stepWalkers(gm);
    this.stepAmbulances(gm);
    this.drawUnits();
    this.drawMarkers();
    this.drawFires();
    if (this.followTarget) {
      const t = this.followTarget;
      const inc = t.inc && s.incidents.find((i) => i.id === t.inc);
      const pos = inc ? (inc.status === 'chase' ? toPx(inc.suspect.x, inc.suspect.y) : toPx(inc.door.x, inc.door.y)) : t.door ? toPx(t.door.x, t.door.y) : null;
      if (pos) {
        const cx = WIDTH / 2 - pos.x * this.zoom; const cy = VIEW.y + VIEW.h / 2 - pos.y * this.zoom;
        this.world.x += (cx - this.world.x) * 0.12; this.world.y += (cy - this.world.y) * 0.12;
        this.clampView();
      } else this.followTarget = null;
    }
    this.refreshHud();
  }

  onEvent(e) {
    if (e.kind === 'call' && e.big) {
      sfx('select');
      const inc = this.s.incidents.find((i) => i.id === e.inc);
      if (inc) this.toast(`New call: ${inc.name} (${S.districtName(inc.district)})`);
    } else if (e.kind === 'major') { this.save(); P.showMajor(this); }
    else if (e.kind === 'chase') { sfx('power'); this.toast('Car chase! Tap to watch'); }
    else if (e.kind === 'chaseEnd') sfx(e.caught ? 'coin' : 'error');
    else if (e.kind === 'death') { sfx('lose'); this.cameras.main.flash(300, 160, 40, 40); }
    else if (e.kind === 'fire') sfx('smallBoom');
    else if (e.kind === 'ambulance') this.sendAmbulance(e.door);
    else if (e.kind === 'dayOver') this.endDay();
    else if (e.kind === 'solved' || e.kind === 'failed') {
      // Let the chief know how the calls they handled turned out.
      const inc = this.s.incidents.find((i) => i.id === e.inc);
      if (inc && (inc.chief || inc.d >= 3) && !inc.special) {
        this.toast(`${inc.name}, ${S.districtName(inc.district)}: ${e.kind === 'solved' ? 'solved!' : 'they got away'}`);
        sfx(e.kind === 'solved' ? 'coin' : 'error');
      }
    }
  }

  afterMajor() {
    if (this.s.over) P.showGameOver(this);
    else if (this.s.pendingMajor) P.showMajor(this);
  }

  endDay() {
    if (this.holds.has('dayend')) return;
    const result = S.endDay(this.s);
    this.save();
    P.showDayEnd(this, result);
  }

  // ------------------------------------------------------------ units and markers

  carSprite(key, dir) {
    return this.add.image(0, 0, `car:${key}-${dir}`);
  }

  drawUnits() {
    const s = this.s;
    const seen = new Set();
    const blink = Math.floor(this.time.now / 160) % 2;
    for (const u of s.units) {
      if (!u.crew.length) continue;
      seen.add(u.id);
      let spr = this.unitSprites.get(u.id);
      if (!spr) {
        spr = this.add.container(0, 0);
        spr.car = this.carSprite('SmallCar1', 'R');
        spr.l1 = this.add.rectangle(-1, -3, 2, 1, 0xff3030);
        spr.l2 = this.add.rectangle(1, -3, 2, 1, 0x3060ff);
        spr.add([spr.car, spr.l1, spr.l2]);
        this.vehLayer.add(spr);
        this.unitSprites.set(u.id, spr);
      }
      const p = toPx(u.x, u.y, u.dir);
      spr.setPosition(p.x, p.y);
      this.headlight(p, u.dir);
      spr.car.setTexture(`car:SmallCar1-${u.dir}`);
      const lights = ['respond', 'chase', 'event'].includes(u.task.type);
      spr.l1.setVisible(lights).setFillStyle(blink ? 0xff3030 : 0x3060ff);
      spr.l2.setVisible(lights).setFillStyle(blink ? 0x3060ff : 0xff3030);
    }
    for (const [id, spr] of this.unitSprites) if (typeof id === 'number' && !seen.has(id)) { spr.destroy(); this.unitSprites.delete(id); }
    // Fire trucks
    const tseen = new Set();
    for (const t of s.trucks) {
      if (t.task.type === 'home') continue;
      tseen.add(`t${t.id}`);
      let spr = this.unitSprites.get(`t${t.id}`);
      if (!spr) { spr = this.carSprite('BigCar7', 'R'); this.vehLayer.add(spr); this.unitSprites.set(`t${t.id}`, spr); }
      const p = toPx(t.x, t.y, t.dir);
      spr.setPosition(p.x, p.y).setTexture(`car:BigCar7-${t.dir}`);
    }
    for (const [id, spr] of this.unitSprites) if (typeof id === 'string' && !tseen.has(id)) { spr.destroy(); this.unitSprites.delete(id); }
    // Fleeing suspects
    const sseen = new Set();
    for (const inc of s.incidents) {
      if (inc.status !== 'chase' || !inc.suspect) continue;
      sseen.add(inc.id);
      let spr = this.suspects.get(inc.id);
      const key = `SmallCar${inc.suspect.car}`;
      if (!spr) { spr = this.carSprite(key, 'R'); this.vehLayer.add(spr); this.suspects.set(inc.id, spr); }
      const p = toPx(inc.suspect.x, inc.suspect.y, inc.suspect.dir);
      spr.setPosition(p.x, p.y).setTexture(`car:${key}-${inc.suspect.dir}`);
    }
    for (const [id, spr] of this.suspects) if (!sseen.has(id)) { spr.destroy(); this.suspects.delete(id); }
  }

  markerFor(id, kind, iconFrame) {
    let m = this.markers.get(id);
    if (m) return m;
    m = this.add.container(0, 0);
    m.badge = this.add.graphics();
    m.icon = this.add.image(0, -10, 'icons', iconFrame).setScale(1);
    m.add([m.badge, m.icon]);
    m.kind = kind;
    this.markLayer.add(m);
    this.markers.set(id, m);
    return m;
  }

  drawMarkers() {
    const s = this.s;
    const seen = new Set();
    const k = 1.15 / this.zoom; // markers keep the same size on screen at any zoom
    const t = this.time.now / 1000;
    for (const inc of s.incidents) {
      seen.add(inc.id);
      const lot = S.city().lots[inc.lot];
      const m = this.markerFor(inc.id, 'inc', ICON[inc.type] ?? 35);
      let col = 0xe3d245;
      if (inc.status === 'new') col = inc.d >= 2 ? 0xd88038 : 0xe3d245;
      else if (inc.status === 'chase') col = Math.floor(t * 6) % 2 ? 0xa13d3b : 0xf9f5ef;
      else if (inc.status === 'done') col = inc.outcome === 'solved' ? 0x6c8c50 : 0x7a6060;
      else col = 0x8a8fc4;
      const urgent = !inc.chief && !inc.special && inc.d >= 2 && inc.status !== 'done' && inc.status !== 'chase';
      if (m.col !== col) {
        m.col = col;
        m.badge.clear().fillStyle(0x040303).fillCircle(0, -10, 11).fillStyle(col).fillCircle(0, -10, 9)
          .fillStyle(0x040303).fillTriangle(-5, -2, 5, -2, 0, 6).fillStyle(col).fillTriangle(-3, -2, 3, -2, 0, 3);
      }
      const pos = inc.status === 'chase' ? toPx(inc.suspect.x, inc.suspect.y) : { x: (lot.x + lot.w / 2) * TILE, y: lot.y * TILE + 2 };
      m.x = pos.x; m.y = pos.y;
      m.setScale(k).setAlpha(inc.status === 'done' ? 0.7 : 1);
      if (urgent) m.y -= Math.abs(Math.sin(t * 5)) * 5 * k;
    }
    for (const f of s.fires) {
      const id = `f${f.id}`;
      seen.add(id);
      const lot = S.city().lots[f.lot];
      const m = this.markerFor(id, 'fire', 16);
      m.fireId = f.id;
      const col = f.status === 'burning' ? 0xa13d3b : f.status === 'out' ? 0x6c8c50 : 0x7a6060;
      if (m.col !== col) {
        m.col = col;
        m.badge.clear().fillStyle(0x040303).fillCircle(0, -10, 11).fillStyle(col).fillCircle(0, -10, 9)
          .fillStyle(0x040303).fillTriangle(-5, -2, 5, -2, 0, 6).fillStyle(col).fillTriangle(-3, -2, 3, -2, 0, 3);
      }
      m.x = (lot.x + lot.w / 2) * TILE; m.y = lot.y * TILE + 2;
      m.setScale(k);
    }
    for (const [id, m] of this.markers) if (!seen.has(id)) { m.destroy(); this.markers.delete(id); }
  }

  drawFires() {
    const s = this.s;
    const seen = new Set();
    const t = this.time.now;
    for (const f of s.fires) {
      const lot = S.city().lots[f.lot];
      const img = this.lotImgs.get(f.lot);
      if (f.status === 'lost') img?.setTint(0x555555);
      if (f.status !== 'burning') continue;
      seen.add(f.id);
      let g = this.fireFx.get(f.id);
      if (!g) { g = this.add.graphics(); this.fxLayer.add(g); this.fireFx.set(f.id, g); }
      g.clear();
      const n = 3 + Math.floor(f.sev / 15);
      for (let k = 0; k < n; k++) {
        const fx = lot.x * TILE + ((k * 37 + Math.floor(t / 90) * 7) % (lot.w * TILE));
        const fy = (lot.y + lot.h) * TILE - 4 - ((k * 13 + Math.floor(t / 70) * 3) % Math.max(4, lot.h * TILE - 2));
        g.fillStyle([0xe3d245, 0xd88038, 0xa13d3b][(k + Math.floor(t / 100)) % 3]).fillRect(fx, fy, 2, 3);
      }
      g.fillStyle(0x6a6a7a, 0.5);
      for (let k = 0; k < 3; k++) {
        const sy = lot.y * TILE - ((t / 40 + k * 9) % 18);
        g.fillCircle((lot.x + lot.w / 2) * TILE + Math.sin(t / 300 + k) * 3, sy, 2 + k * 0.5);
      }
    }
    for (const [id, g] of this.fireFx) if (!seen.has(id)) { g.destroy(); this.fireFx.delete(id); }
  }

  // ------------------------------------------------------------ city life (just for show)

  randomRoad() {
    const pts = [...S.city().roads.values()];
    const p = pts[Math.floor(Math.random() * pts.length)];
    return { x: p.x, y: p.y };
  }

  spawnCivilians() {
    this.civs = [];
    for (let k = 0; k < 16; k++) {
      const p = this.randomRoad();
      const big = Math.random() < 0.3;
      const key = big ? `BigCar${Phaser.Utils.Array.GetRandom(CIV_BIG)}` : `SmallCar${Phaser.Utils.Array.GetRandom(CIV_SMALL)}`;
      const c = { x: p.x, y: p.y, dir: 'R', path: [], key, speed: 0.45 + Math.random() * 0.3, spr: this.carSprite(key, 'R') };
      this.vehLayer.add(c.spr);
      this.civs.push(c);
    }
  }

  move(c, dist) {
    while (dist > 0 && c.path.length) {
      const t = c.path[0];
      const dx = t.x - c.x; const dy = t.y - c.y; const d = Math.hypot(dx, dy);
      if (d > 0.001) c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
      if (d <= dist) { c.x = t.x; c.y = t.y; c.path.shift(); dist -= d; } else { c.x += (dx / d) * dist; c.y += (dy / d) * dist; dist = 0; }
    }
  }

  stepCivilians(gm) {
    for (const c of this.civs) {
      if (!c.path.length) c.path = (findPath(S.city().roads, { x: Math.round(c.x), y: Math.round(c.y) }, this.randomRoad()) || []).slice(1);
      this.move(c, c.speed * gm);
      const p = toPx(c.x, c.y, c.dir);
      c.spr.setPosition(p.x, p.y).setTexture(`car:${c.key}-${c.dir}`);
      this.headlight(p, c.dir);
    }
  }

  spawnWalkers() {
    this.walkers = [];
    for (let k = 0; k < 22; k++) {
      const c = Phaser.Math.Between(0, ROAD_X.length - 2); const r = Phaser.Math.Between(0, ROAD_Y.length - 2);
      const b = blockRect(c, r);
      const w = { b, t: Math.random(), v: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.004), spr: this.add.image(0, 0, 'people', Phaser.Math.Between(0, 191)) };
      this.fxLayer.add(w.spr);
      this.walkers.push(w);
    }
  }

  stepWalkers(gm) {
    for (const w of this.walkers) {
      w.t = (w.t + w.v * gm + 1) % 1;
      const { b } = w;
      const pw = b.w * TILE; const ph = b.h * TILE; const per = 2 * (pw + ph);
      let d = w.t * per; let x; let y;
      if (d < pw) { x = d; y = 0; } else if ((d -= pw) < ph) { x = pw; y = d; } else if ((d -= ph) < pw) { x = pw - d; y = ph; } else { d -= pw; x = 0; y = ph - d; }
      w.spr.setPosition(Math.round(b.x * TILE + x), Math.round(b.y * TILE + y - 2));
    }
  }

  sendAmbulance(door) {
    const hosp = S.city().landmark('hospital').door;
    const path = findPath(S.city().roads, hosp, door);
    if (!path) return;
    const a = { x: hosp.x, y: hosp.y, dir: 'D', path: path.slice(1), key: 'BigCar3', speed: 1.3, wait: 0, back: false, spr: this.carSprite('BigCar3', 'D') };
    a.light = this.add.rectangle(0, 0, 2, 1, 0xff3030);
    this.vehLayer.add([a.spr, a.light]);
    this.ambulances.push(a);
  }

  stepAmbulances(gm) {
    const hosp = S.city().landmark('hospital').door;
    for (const a of [...this.ambulances]) {
      if (!a.path.length) {
        if (!a.back) { a.wait += gm; if (a.wait > 14) { a.back = true; a.path = (findPath(S.city().roads, { x: Math.round(a.x), y: Math.round(a.y) }, hosp) || []).slice(1); } } else {
          a.spr.destroy(); a.light.destroy();
          this.ambulances.splice(this.ambulances.indexOf(a), 1);
          continue;
        }
      }
      this.move(a, a.speed * gm);
      const p = toPx(a.x, a.y, a.dir);
      a.spr.setPosition(p.x, p.y).setTexture(`car:BigCar3-${a.dir}`);
      a.light.setPosition(p.x, p.y - 3).setFillStyle(Math.floor(this.time.now / 150) % 2 ? 0xff3030 : 0xf9f5ef);
    }
  }

  // ------------------------------------------------------------ saving

  save() { if (!this.s.over) store.set('run', this.s); }

  endRun() {
    const s = this.s;
    const best = store.get('best') || {};
    best[s.mode] = Math.max(best[s.mode] || 0, s.day - 1);
    store.set('best', best);
    store.set('run', null);
  }

  newRun(mode) {
    const s = S.newGame(mode);
    store.set('run', s);
    this.scene.restart({ state: s });
  }

  toTitle() {
    if (!this.s.over) this.save();
    P.closeAll();
    this.scene.start('Title');
  }
}
