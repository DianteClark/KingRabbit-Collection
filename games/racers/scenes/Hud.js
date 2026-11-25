import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT, modal, openHowTo } from './common.js';
import { save } from '../save.js';
import { fmtTime, ordinal } from '../logic/cup.js';
import { wrapIdx } from '../logic/track.js';
import { PAINT_HEX } from '../art.js';
import { layout, steerFromX, inCircle } from '../layout.js';

/** Overlay for the race: top bar, mini-map, touch controls, countdown, hints and the pause menu. */
export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  init({ raceScene }) {
    this.rs = raceScene;
    this.race = raceScene.race;
    this.leaving = false;
    this.modalOpen = false;
    this.touches = new Map();     // pointer id -> { role, x }
    this.steerOrder = [];
    this.auto = save.get('autoGas') !== false;
    this.L = layout(this.auto);
    this.hint = null;
  }

  create() {
    const L = this.L;
    // top bar
    this.add.rectangle(0, 0, WIDTH, L.bar, hex(PALETTE.ink), 0.55).setOrigin(0);
    this.backBtn = button(this, 26, 21, 44, 38, '<', () => this.pause(), { size: 32, fill: PALETTE.cream });
    this.helpBtn = button(this, WIDTH - 26, 21, 44, 38, '?', () => this.help(), { size: 32, fill: PALETTE.gold });
    const solo = !this.race.cars.some((c) => !c.human);
    this.posText = text(this, 58, 20, '', { size: 32, color: PALETTE.gold, origin: [0, 0.5] });
    this.posOf = text(this, 112, 24, '', { color: PALETTE.lavender, origin: [0, 0.5] });
    if (solo) { this.posText.setVisible(false); this.posOf.setVisible(false); }
    this.lapText = text(this, solo ? 120 : 210, 21, '', { color: PALETTE.cream });
    this.timeText = text(this, solo ? 250 : 320, 21, '', { color: PALETTE.cream });
    this.bestText = text(this, solo ? 400 : 440, 21, '', { color: PALETTE.lavender });
    this.drawMinimapBase();
    this.dots = this.add.graphics();
    this.controls = this.add.graphics();
    this.labels = {};
    for (const [k, b] of Object.entries(L.buttons)) this.labels[k] = text(this, b.x, b.y, b.label, { color: PALETTE.cream });
    this.arrows = this.add.graphics();
    this.meterText = text(this, L.buttons.boost.x, L.buttons.boost.y + L.buttons.boost.r + 10, '', { color: PALETTE.gold });
    this.rain = this.race.def.mood === 'rain' ? this.makeRain() : null;
    this.wrongText = text(this, WIDTH / 2, 120, 'WRONG WAY!', { size: 32, color: PALETTE.red }).setVisible(false).setDepth(30);
    this.countText = text(this, WIDTH / 2, 150, '', { size: 32, color: PALETTE.gold }).setDepth(31);
    this.countBg = this.add.rectangle(WIDTH / 2, 150, 120, 52, hex(PALETTE.ink), 0.6).setDepth(30).setVisible(false);
    this.hintBox = this.add.container(WIDTH / 2, 70).setDepth(35).setVisible(false);
    this.hintBg = this.add.rectangle(0, 0, 400, 32, hex(PALETTE.ink), 0.75).setStrokeStyle(2, hex(PALETTE.gold));
    this.hintText = text(this, 0, 0, '', { color: PALETTE.cream });
    this.hintBox.add([this.hintBg, this.hintText]);

    this.setupInput();
    this.events.on('resume', () => this.resetTouches());
    this.onBlur = () => { if (!this.modalOpen && !this.leaving && document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', this.onBlur);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.onBlur));
    this.refresh();
    window.__hud = this;
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.input.addPointer(4);
    const L = this.L;
    this.input.on('pointerdown', (p) => {
      if (this.modalOpen || this.leaving) return;
      if (p.y < L.bar + 2) return;       // the top bar's own buttons handle themselves
      for (const [k, b] of Object.entries(L.buttons)) {
        if (inCircle(p.x, p.y, b, 10)) { this.touches.set(p.id, { role: k }); return; }
      }
      if (p.x < L.steerMaxX) {
        this.touches.set(p.id, { role: 'steer', x: p.x });
        this.steerOrder = this.steerOrder.filter((id) => id !== p.id).concat(p.id);
      }
    });
    this.input.on('pointermove', (p) => {
      const t = this.touches.get(p.id);
      if (t && t.role === 'steer') t.x = p.x;
    });
    const up = (p) => {
      this.touches.delete(p.id);
      this.steerOrder = this.steerOrder.filter((id) => id !== p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => this.resetTouches());
    const kb = this.input.keyboard;
    this.keys = kb ? kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,SHIFT,X,B') : null;
  }

  held(role) { for (const t of this.touches.values()) if (t.role === role) return true; return false; }

  /** Called by the race every step. */
  readInput() {
    if (this.modalOpen || this.leaving) return { steer: 0, gas: 0, brake: false, drift: false, boost: false };
    let steer = 0;
    const last = this.steerOrder[this.steerOrder.length - 1];
    if (last != null && this.touches.get(last)) steer = steerFromX(this.touches.get(last).x, this.L);
    let drift = this.held('drift'); let boost = this.held('boost');
    let gas = this.auto ? 1 : (this.held('gas') ? 1 : 0);
    const k = this.keys;
    if (k) {
      const kx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      if (kx) steer = kx;
      if (k.UP.isDown || k.W.isDown) gas = 1;
      drift = drift || k.SPACE.isDown || k.SHIFT.isDown || k.DOWN.isDown || k.S.isDown;
      boost = boost || k.X.isDown || k.B.isDown;
    }
    // with a GAS button, holding DRIFT while steering keeps the power on through the slide
    if (!this.auto && drift && steer) gas = 1;
    this.lastSteer = steer;
    return { steer, gas, brake: false, drift, boost };
  }

  /** Forget held touches (a finger lifted over a popup or the How to Play sheet never reports). */
  resetTouches() {
    this.touches.clear();
    this.steerOrder = [];
    this.input.manager?.pointers?.forEach((p) => p.reset?.());
  }

  // ------------------------------------------------------------------ drawing

  update() { this.refresh(); }

  refresh() {
    const race = this.race; const p = race.player;
    const n = race.cars.length;
    const pos = race.positionOf(p);
    this.posText.setText(ordinal(pos));
    this.posOf.setText(`/${n}`).setX(58 + this.posText.width + 2);
    this.lapText.setText(`Lap ${Math.min(race.laps, p.lap + 1)}/${race.laps}`);
    this.timeText.setText(fmtTime(Math.max(0, p.finished ? p.finishTime : race.time)));
    const bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : null;
    this.bestText.setText(bestLap != null ? `Best ${fmtTime(bestLap)}` : '');
    this.drawDots();
    this.drawControls();
    this.wrongText.setVisible(p.wrongT > 1 && Math.floor(race.time * 3) % 2 === 0 && !p.finished);
    if (this.rain) this.updateRain();
    this.updateHints();
  }

  drawMinimapBase() {
    const t = this.race.t; const M = this.L.map;
    const sc = Math.min((M.w - 8) / t.W, (M.h - 8) / t.H);
    this.mapSc = sc;
    this.mapOx = M.x + (M.w - t.W * sc) / 2; this.mapOy = M.y + (M.h - t.H * sc) / 2;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink), 0.5).fillRect(M.x, M.y, M.w, M.h);
    g.lineStyle(3, hex(PALETTE.cream), 0.8);
    g.beginPath();
    for (let i = 0; i <= t.n; i += 6) {
      const j = i % t.n;
      const x = this.mapOx + t.x[j] * sc; const y = this.mapOy + t.y[j] * sc;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.strokePath();
    // start line
    g.fillStyle(hex(PALETTE.red)).fillRect(Math.round(this.mapOx + t.x[0] * sc) - 2, Math.round(this.mapOy + t.y[0] * sc) - 2, 4, 4);
  }

  drawDots() {
    const g = this.dots; g.clear();
    const sc = this.mapSc;
    const cars = [...this.race.cars].sort((a) => (a.human ? 1 : -1));
    for (const c of cars) {
      const x = Math.round(this.mapOx + c.x * sc); const y = Math.round(this.mapOy + c.y * sc);
      g.fillStyle(hex(PALETTE.ink)).fillRect(x - 3, y - 3, 6, 6);
      g.fillStyle(c.human ? hex(PALETTE.gold) : PAINT_HEX[c.colour] ?? 0xffffff).fillRect(x - 2, y - 2, 4, 4);
    }
  }

  drawControls() {
    const g = this.controls; const L = this.L; const p = this.race.player;
    g.clear();
    // steering pads
    const s = this.lastSteer || 0;
    const live = this.race.running && !p.finished;
    for (const pad of L.pads) {
      const on = (pad.dir < 0 && s < 0) || (pad.dir > 0 && s > 0);
      g.fillStyle(hex(PALETTE.ink), on ? 0.45 : 0.25).fillRoundedRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h, 10);
      g.lineStyle(3, 0xffffff, on ? 0.7 : 0.3).strokeRoundedRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h, 10);
      const ax = pad.x; const ay = pad.y; const d = pad.dir;
      g.fillStyle(0xffffff, on ? 0.9 : 0.5).fillTriangle(ax + d * 18, ay, ax - d * 10, ay - 18, ax - d * 10, ay + 18);
    }
    // round buttons
    const fills = { drift: PALETTE.plum, boost: PALETTE.orange, gas: PALETTE.leaf };
    for (const [k, b] of Object.entries(L.buttons)) {
      let down = this.held(k);
      if (this.keys) {
        if (k === 'drift') down = down || this.keys.SPACE.isDown || this.keys.SHIFT.isDown;
        if (k === 'boost') down = down || this.keys.X.isDown || this.keys.B.isDown;
      }
      const ready = k !== 'boost' || p.boost >= 0.25;
      const a = (live ? 1 : 0.45) * (ready ? 1 : 0.55);
      g.fillStyle(hex(PALETTE.ink), 0.5 * a).fillCircle(b.x, b.y + 4, b.r);
      g.fillStyle(hex(fills[k]), (down ? 0.95 : 0.7) * a).fillCircle(b.x, b.y + (down ? 3 : 0), b.r - 2);
      g.lineStyle(3, hex(PALETTE.ink), 0.8 * a).strokeCircle(b.x, b.y + (down ? 3 : 0), b.r - 2);
      this.labels[k].setY(b.y + (down ? 3 : 0)).setAlpha(live ? 1 : 0.6);
    }
    // boost meter: ring round the BOOST button
    const B = L.buttons.boost;
    g.lineStyle(5, hex(PALETTE.ink), 0.6);
    g.beginPath(); g.arc(B.x, B.y, B.r + 5, 0, Math.PI * 2); g.strokePath();
    if (p.boost > 0) {
      g.lineStyle(5, hex(p.boost >= 0.25 ? PALETTE.gold : PALETTE.lavender), 1);
      g.beginPath(); g.arc(B.x, B.y, B.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.boost, false); g.strokePath();
    }
    this.meterText.setText('');
  }

  makeRain() {
    const drops = [];
    for (let i = 0; i < 70; i++) drops.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, v: 380 + Math.random() * 200 });
    return { g: this.add.graphics().setDepth(-1), drops };
  }

  updateRain() {
    const { g, drops } = this.rain;
    g.clear();
    g.fillStyle(0xc0d0f0, 0.45);
    const dt = this.rs.paused ? 0 : this.game.loop.delta / 1000;
    for (const d of drops) {
      d.y += d.v * dt; d.x -= d.v * 0.25 * dt;
      if (d.y > HEIGHT) { d.y -= HEIGHT + 10; d.x = Math.random() * (WIDTH + 80); }
      if (d.x < -10) d.x += WIDTH + 20;
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 6);
    }
  }

  // ------------------------------------------------------------------ guided first races

  updateHints() {
    const race = this.race; const p = race.player;
    const hints = save.get('hints') || {};
    const mark = (k) => { save.set('hints', { ...(save.get('hints') || {}), [k]: true }); this.showHint(null); };
    if (p.finished || this.modalOpen) { this.showHint(null); return; }
    if (!hints.steer) {
      if (race.phase === 'countdown' || race.time < 6) {
        this.showHint('Hold the left side of the screen to steer');
        if (race.running && this.lastSteer) this.steerT = (this.steerT || 0) + 1 / 60;
        if (this.steerT > 1) mark('steer');
        return;
      }
      mark('steer');
    }
    if (!race.running) return;
    if (!hints.drift) {
      const t = race.t; const line = race.rs?.line || race.line;
      let tight = false;
      for (let q = 10; q < 50; q += 4) if (Math.abs(line.k[wrapIdx(t, p.idx + q)]) > 1 / 75) tight = true;
      if (p.driftT > 0.6 && p.drifting) { mark('drift'); return; }
      if (tight || this.hint === 'drift') { this.showHint('Bend ahead: hold DRIFT while you turn!', 'drift'); return; }
    }
    if (!hints.boost && p.boost >= 0.5) {
      if (p.boostT > 0) { mark('boost'); return; }
      this.showHint('Boost is charged: tap BOOST!', 'boost');
      return;
    }
    if (!hints.pad) {
      const near = race.t.pads.some((pd) => { const d = wrapIdx(race.t, pd.i - p.idx); return d > 0 && d < 40; });
      if (p.padT > 0) { mark('pad'); return; }
      if (near) { this.showHint('Orange pads give a free boost', 'pad'); return; }
    }
    if (this.hint) this.showHint(null);
  }

  showHint(msg, id = msg) {
    if (!msg) { this.hint = null; this.hintBox.setVisible(false); return; }
    if (this.hint === id && this.hintBox.visible) return;
    this.hint = id;
    this.hintText.setText(msg);
    this.hintBg.width = this.hintText.width + 28;
    this.hintBg.setSize(this.hintText.width + 28, 32);
    this.hintBox.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.hintBox, alpha: 1, duration: 150 });
  }

  // ------------------------------------------------------------------ messages

  countdown(n) {
    this.countBg.setVisible(true);
    this.countText.setText(n > 0 ? String(n) : 'GO!').setColor(n > 0 ? PALETTE.gold : PALETTE.leaf).setAlpha(1);
    this.countBg.setAlpha(1);
    this.tweens.killTweensOf([this.countText, this.countBg]);
    if (n === 0) this.tweens.add({ targets: [this.countText, this.countBg], alpha: 0, delay: 600, duration: 300 });
  }

  toast(msg) {
    const t = text(this, WIDTH / 2, 110, msg, { color: PALETTE.gold }).setDepth(41);
    const bg = this.add.rectangle(WIDTH / 2, 110, t.width + 20, 28, hex(PALETTE.ink), 0.6).setDepth(40);
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1100, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  lapBanner(lap, time) {
    const final = lap === this.race.laps - 1;
    this.banner(final ? 'Final lap!' : `Lap ${lap + 1}`, `Last lap ${fmtTime(time)}`);
  }

  finishBanner(msg) { this.banner(msg, '', 2400); }

  banner(msg, sub = '', hold = 1400) {
    const c = this.add.container(0, 0).setDepth(45);
    c.add(this.add.rectangle(WIDTH / 2, 150, WIDTH, sub ? 80 : 60, hex(PALETTE.ink), 0.65));
    c.add(text(this, WIDTH / 2, sub ? 138 : 150, msg, { size: 32, color: PALETTE.gold }));
    if (sub) c.add(text(this, WIDTH / 2, 170, sub, { color: PALETTE.cream }));
    c.setScale(1, 0);
    this.tweens.add({ targets: c, scaleY: 1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: hold, duration: 300, onComplete: () => c.destroy() });
  }

  // ------------------------------------------------------------------ menus

  setModal(on) {
    this.modalOpen = on;
    this.rs.paused = on;
    this.resetTouches();
  }

  help() {
    if (this.modalOpen || this.leaving) return;
    this.setModal(true);
    openHowTo(this, [this.rs], () => this.setModal(false));
  }

  pause() {
    if (this.modalOpen || this.leaving || this.race.player.finished) return;
    this.setModal(true);
    const d = this.rs.data0;
    const lines = d.mode === 'cup' ? ['Quit keeps your cup saved.', 'This race starts again', 'when you come back.'] : ['Race paused'];
    modal(this, 'Paused', lines, [
      ['Resume', () => this.setModal(false)],
      ['Restart', () => this.leave('RaceScene', d)],
      ['Quit', () => this.leave(d.mode === 'cup' ? 'Cup' : d.mode === 'daily' ? 'Title' : 'Tracks', { mode: d.mode })],
    ]);
  }

  leave(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    this.rs.leavingRace = true;
    this.input.enabled = false;
    this.cameras.main.fadeOut(180, 28, 22, 24);
    this.rs.cameras.main.fadeOut(180, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('RaceScene');
      this.scene.start(key, data);
    });
  }
}
