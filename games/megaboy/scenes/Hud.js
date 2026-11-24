import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import {
  PAUSE_BTN, HELP_BTN, DPAD, SHOOT, JUMP, SWAP, BARS, BOSS_BAR, hitShoot, hitJump, hitSwap, inDpadZone, dpadDir,
} from '../layout.js';
import { P, MAX_ENERGY, WEAPONS, WEAPON_ORDER, ZOOM, MAX_ETANKS } from '../logic/constants.js';
import { STAGES } from '../logic/stages.js';
import { save } from '../save.js';
import { skillLabel } from '../adaptive.js';
import { openHelp } from './common.js';
import { musicOn, setMusicOn } from '../music.js';

const { WIDTH, HEIGHT } = LANDSCAPE;
const NAMES = { buster: 'BUSTER', ember: 'EMBER', ice: 'ICE', thorn: 'THORN', volt: 'VOLT', drill: 'DRILL', gale: 'GALE' };

export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  init({ stage }) {
    this.st = stage;
    this.pad = { id: null, x: DPAD.x, y: DPAD.y };
    this.held = { jump: new Set(), shoot: new Set() };
    this.swapPress = 0;
    this.modal = null;
    this.ready = false;
  }

  get w() { return this.st.w; }

  create() {
    this.gfx = this.add.graphics().setDepth(5);
    this.ctl = this.add.graphics().setDepth(4);
    button(this, PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.w, PAUSE_BTN.h, '<', () => this.pauseMenu(), { size: 32, fill: PALETTE.cream });
    button(this, HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h, '?', () => this.help(), { size: 32, fill: PALETTE.gold });
    this.lifeIcon = this.add.image(BARS.x + 4, 116, 'life').setScale(2).setDepth(6);
    this.lifeText = text(this, BARS.x + 16, 116, '', { origin: [0, 0.5] }).setDepth(6);
    this.tankIcon = this.add.image(BARS.x + 4, 140, 'etank').setScale(2).setDepth(6);
    this.tankText = text(this, BARS.x + 16, 140, '', { origin: [0, 0.5] }).setDepth(6);
    // control labels
    this.jumpLabel = text(this, JUMP.x, JUMP.y, 'JUMP', { color: PALETTE.night }).setDepth(6);
    this.shootLabel = text(this, SHOOT.x, SHOOT.y, 'SHOOT', { color: PALETTE.night }).setDepth(6);
    this.swapIcon = this.add.image(SWAP.x - 24, SWAP.y, 'icon-buster').setScale(2).setDepth(6);
    this.swapLabel = text(this, SWAP.x + 12, SWAP.y, 'WPN', { color: PALETTE.night }).setDepth(6);
    // messages
    this.flash = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xd8343a, 0).setOrigin(0).setDepth(20);
    this.center = text(this, WIDTH / 2, 150, '', { size: 32, color: PALETTE.cream }).setDepth(30);
    this.centerSub = text(this, WIDTH / 2, 188, '', { color: PALETTE.sand }).setDepth(30);
    this.stageName = text(this, WIDTH / 2, 110, this.st.def.name, { size: 32, color: PALETTE.gold }).setDepth(30);
    this.tweens.add({ targets: this.stageName, alpha: 0, delay: 1400, duration: 500 });

    this.setupInput();
    this.ready = true;
    this.refresh();
    // once you own a second weapon, point at the weapon button
    const seen = save.get('seen') || [];
    if (this.w.weapons.length > 1 && !seen.includes('wpn')) {
      save.set('seen', [...seen, 'wpn']);
      this.time.delayedCall(1600, () => this.toast('Tap WPN to switch weapons, or pick one in the pause menu.'));
    }
    if (!save.get('seenHelp')) {
      save.set('seenHelp', true);
      this.time.delayedCall(300, () => this.help(() => this.coach()));
    } else if (!save.get('coached')) this.time.delayedCall(400, () => this.coach());
  }

  /** First time only: point at the controls. */
  coach() {
    if (save.get('coached')) return;
    save.set('coached', true);
    const items = [];
    const tag = (x, y, msg) => {
      const t = text(this, x, y, msg, { color: PALETTE.night }).setDepth(45);
      const bg = this.add.rectangle(x, y, t.width + 14, t.height + 8, hex(PALETTE.gold)).setDepth(44).setStrokeStyle(2, hex(PALETTE.ink));
      items.push(t, bg);
    };
    tag(DPAD.x + 6, DPAD.y - DPAD.r - 14, 'Run and climb');
    tag(JUMP.x - 6, JUMP.y - JUMP.r - 14, 'Jump');
    tag(SHOOT.x - 30, SHOOT.y - SHOOT.r - 14, 'Shoot (hold)');
    this.tweens.add({ targets: items, y: '-=4', yoyo: true, repeat: 7, duration: 380 });
    this.time.delayedCall(6500, () => this.tweens.add({ targets: items, alpha: 0, duration: 400, onComplete: () => items.forEach((o) => o.destroy()) }));
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.input.addPointer(3);
    const topButton = (p) => p.y < 50 && (p.x < 58 || p.x > WIDTH - 58);
    this.input.on('pointerdown', (p) => {
      if (this.modal || document.getElementById('howto') || topButton(p)) return;
      if (hitJump(p.x, p.y)) { this.held.jump.add(p.id); return; }
      if (hitShoot(p.x, p.y)) { this.held.shoot.add(p.id); return; }
      if (hitSwap(p.x, p.y)) { if (this.w.weapons.length > 1) this.swapPress++; else this.toast('Beat a boss to get a new weapon.', true); return; }
      if (inDpadZone(p.x, p.y) && this.pad.id === null) this.pad = { id: p.id, x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p) => {
      if (p.id === this.pad.id) { this.pad.x = p.x; this.pad.y = p.y; return; }
      // a thumb sliding between SHOOT and JUMP moves the press with it
      if (this.held.jump.has(p.id) && hitShoot(p.x, p.y)) { this.held.jump.delete(p.id); this.held.shoot.add(p.id); } else if (this.held.shoot.has(p.id) && hitJump(p.x, p.y)) { this.held.shoot.delete(p.id); this.held.jump.add(p.id); }
    });
    const up = (p) => {
      if (p.id === this.pad.id) this.pad = { id: null, x: DPAD.x, y: DPAD.y };
      this.held.jump.delete(p.id); this.held.shoot.delete(p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => this.releaseAll());

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,K,SPACE,X,J');
      kb.on('keydown', (e) => {
        if (e.repeat) return;
        const k = e.key.toLowerCase();
        if (this.modal) { if (k === 'escape' || k === 'p') this.modal.close?.(); return; }
        if (k === 'q') this.swapPress--;
        if (k === 'e' || k === 'tab') { this.swapPress++; e.preventDefault?.(); }
        if (k === 'escape' || k === 'p') this.pauseMenu();
      });
    }
  }

  releaseAll() {
    this.pad = { id: null, x: DPAD.x, y: DPAD.y };
    this.held.jump.clear(); this.held.shoot.clear();
  }

  /** Called by the stage every simulation step. */
  readInput() {
    // browser tests can drive the hero (window.__botInput returns an input object)
    if (window.__botInput && !this.modal) return window.__botInput(this.w);
    const out = { l: false, r: false, u: false, d: false, jump: false, shoot: false, swap: 0 };
    if (this.modal || document.getElementById('howto')) return out;
    if (this.pad.id !== null) Object.assign(out, dpadDir(this.pad.x, this.pad.y));
    out.jump = this.held.jump.size > 0;
    out.shoot = this.held.shoot.size > 0;
    const k = this.keys;
    if (k) {
      out.l = out.l || k.LEFT.isDown || k.A.isDown;
      out.r = out.r || k.RIGHT.isDown || k.D.isDown;
      out.u = out.u || k.UP.isDown || k.W.isDown;
      out.d = out.d || k.DOWN.isDown || k.S.isDown;
      out.jump = out.jump || k.Z.isDown || k.K.isDown || k.SPACE.isDown;
      out.shoot = out.shoot || k.X.isDown || k.J.isDown;
    }
    if (out.l && out.r) { out.l = false; out.r = false; }
    out.swap = Math.sign(this.swapPress);
    this.swapPress = 0;
    return out;
  }

  // ------------------------------------------------------------------ drawing

  update() { this.refresh(); }

  refresh() {
    const w = this.w; if (!w) return;
    const g = this.gfx; g.clear();
    const bar = (x, y, h, v, max, color) => {
      g.fillStyle(hex(PALETTE.ink)).fillRect(x - 1, y - 1, BARS.w + 2, h + 2);
      const segs = max; const sh = (h - 2) / segs;
      const n = Math.ceil(v);
      for (let i = 0; i < segs; i++) {
        const yy = y + h - 1 - (i + 1) * sh;
        g.fillStyle(i < n ? color : 0x2a2440).fillRect(x + 1, Math.round(yy) + 1, BARS.w - 2, Math.max(1, Math.round(sh) - 1));
      }
    };
    bar(BARS.x, BARS.y, BARS.h, w.p.hp, P.maxHp, 0xf0d472);
    if (w.weapon !== 'buster') bar(BARS.x + BARS.w + BARS.gap, BARS.y, BARS.h, w.energy[w.weapon], MAX_ENERGY, hex(WEAPONS[w.weapon].color));
    const bb = w.bossBar();
    if (bb !== null && w.mode !== 'won') bar(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.h, bb * P.maxHp, P.maxHp, 0xd84a4a);
    this.lifeText.setText(`${w.lives}`);
    this.tankText.setText(`${w.etanks}`);
    this.tankIcon.setAlpha(w.etanks ? 1 : 0.4); this.tankText.setAlpha(w.etanks ? 1 : 0.4);
    // low health warning
    if (w.p.hp > 0 && w.p.hp <= 6 && Math.floor(this.time.now / 250) % 2) g.lineStyle(2, 0xd84a4a).strokeRect(BARS.x - 2, BARS.y - 2, BARS.w + 4, BARS.h + 4);

    // controls
    const c = this.ctl; c.clear();
    const live = !this.modal;
    // d-pad cross
    const dir = this.pad.id !== null ? dpadDir(this.pad.x, this.pad.y) : { l: false, r: false, u: false, d: false };
    const arm = 22; const len = DPAD.r - 8;
    c.fillStyle(hex(PALETTE.ink), 0.45).fillRect(DPAD.x - len, DPAD.y - arm / 2, len * 2, arm).fillRect(DPAD.x - arm / 2, DPAD.y - len, arm, len * 2);
    const armFill = (on, x, y, ww, hh) => c.fillStyle(0xf9f5ef, on ? 0.85 : 0.32).fillRect(x, y, ww, hh);
    armFill(dir.l, DPAD.x - len + 2, DPAD.y - arm / 2 + 2, len - arm / 2 - 2, arm - 4);
    armFill(dir.r, DPAD.x + arm / 2, DPAD.y - arm / 2 + 2, len - arm / 2 - 2, arm - 4);
    armFill(dir.u, DPAD.x - arm / 2 + 2, DPAD.y - len + 2, arm - 4, len - arm / 2 - 2);
    armFill(dir.d, DPAD.x - arm / 2 + 2, DPAD.y + arm / 2, arm - 4, len - arm / 2 - 2);
    c.fillStyle(0xf9f5ef, 0.2).fillRect(DPAD.x - arm / 2 + 2, DPAD.y - arm / 2 + 2, arm - 4, arm - 4);
    if (this.pad.id !== null) c.fillStyle(0xf9f5ef, 0.5).fillCircle(this.pad.x, this.pad.y, 9);
    // round buttons
    const round = (b, down, fill) => {
      c.fillStyle(hex(PALETTE.ink), 0.45).fillCircle(b.x, b.y + 4, b.r);
      c.fillStyle(hex(fill), down ? 0.95 : 0.6).fillCircle(b.x, b.y + (down ? 3 : 0), b.r - 2);
      c.lineStyle(3, hex(PALETTE.night), 0.8).strokeCircle(b.x, b.y + (down ? 3 : 0), b.r - 2);
    };
    const jd = this.held.jump.size > 0; const sd = this.held.shoot.size > 0;
    round(JUMP, jd, PALETTE.gold);
    round(SHOOT, sd, w.p.charge >= P.chargeMid && Math.floor(this.time.now / 90) % 2 ? PALETTE.cream : PALETTE.lavender);
    this.jumpLabel.setY(JUMP.y + (jd ? 3 : 0));
    this.shootLabel.setY(SHOOT.y + (sd ? 3 : 0));
    // weapon swap
    const many = w.weapons.length > 1;
    c.fillStyle(hex(PALETTE.ink), 0.45).fillRoundedRect(SWAP.x - SWAP.w / 2, SWAP.y - SWAP.h / 2 + 3, SWAP.w, SWAP.h, 8);
    c.fillStyle(hex(WEAPONS[w.weapon].color), many ? 0.75 : 0.3).fillRoundedRect(SWAP.x - SWAP.w / 2, SWAP.y - SWAP.h / 2, SWAP.w, SWAP.h, 8);
    this.swapIcon.setTexture(`icon-${w.weapon}`).setAlpha(many ? 1 : 0.5);
    this.swapLabel.setAlpha(many ? 1 : 0.5);
    for (const o of [this.jumpLabel, this.shootLabel]) o.setAlpha(live ? 1 : 0.5);
    // READY
    const ready = w.mode === 'ready';
    this.center.setText(ready ? 'READY' : this.center.bossText || '').setVisible(ready ? Math.floor(this.time.now / 160) % 2 === 0 : !!this.center.bossText);
  }

  flashHurt() {
    this.flash.setAlpha(0.25);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 220 });
  }

  bossIntro(name) {
    this.center.bossText = name;
    this.centerSub.setText('Watch for the flash before each attack').setAlpha(1);
    this.time.delayedCall(1500, () => { this.center.bossText = ''; });
    this.tweens.add({ targets: this.centerSub, alpha: 0, delay: 1700, duration: 400 });
  }

  weaponFlash() {
    const w = this.w;
    this.toast(WEAPONS[w.weapon].name, false, 900);
  }

  /** A word over a point in the stage (converted from world to screen). */
  popText(wx, wy, str) {
    const x = (wx - this.w.camX) * ZOOM; const y = wy * ZOOM;
    const t = text(this, Math.max(40, Math.min(WIDTH - 40, x)), Math.max(70, y), str, { color: PALETTE.gold }).setDepth(35);
    this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 700, delay: 200, onComplete: () => t.destroy() });
  }

  toast(msg, warn = false, ms = 0) {
    this.lastToast?.destroy(); this.lastToastBg?.destroy();
    const t = text(this, WIDTH / 2, 0, msg, { color: warn ? PALETTE.sand : PALETTE.gold, wrap: 380 }).setDepth(41);
    const y = 64 + t.height / 2;
    t.setY(Math.round(y));
    const bg = this.add.rectangle(WIDTH / 2, y, t.width + 20, t.height + 10, hex(PALETTE.ink), 0.78).setDepth(40);
    this.lastToast = t; this.lastToastBg = bg;
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: ms || Math.min(5000, 1500 + msg.length * 50), duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  // ------------------------------------------------------------------ menus

  help(onClose) {
    if (document.getElementById('howto') || this.modal) return;
    const stagePaused = this.scene.isPaused('Stage');
    if (!stagePaused) this.scene.pause('Stage');
    this.releaseAll();
    openHelp(() => { if (!stagePaused && !this.modal) this.scene.resume('Stage'); onClose?.(); });
  }

  openModal(build, onClose) {
    this.modal?.destroy();
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
    this.modal = c;
    c.close = () => { c.destroy(); if (this.modal === c) this.modal = null; onClose?.(); };
    build(c);
    return c;
  }

  pauseMenu() {
    if (this.modal || document.getElementById('howto') || this.st._leaving) return;
    const w = this.w;
    if (w.mode === 'dying' || w.mode === 'won' || w.mode === 'gameover' || w.mode === 'victory') return;
    this.scene.pause('Stage');
    this.releaseAll();
    const m = this.openModal((c) => {
      c.add(panel(this, 12, 6, WIDTH - 24, HEIGHT - 12));
      const L = 196; const R = 506;
      c.add(text(this, L, 30, 'PAUSED', { size: 32, color: PALETTE.gold }));
      c.add(text(this, L, 60, `${this.st.def.name}   Health ${w.p.hp}/${P.maxHp}`, { color: PALETTE.cream }));
      // weapons: tap one to use it
      const slots = WEAPON_ORDER;
      const btns = [];
      slots.forEach((k, i) => {
        const x = i === 0 ? L : L + (i % 2 ? -86 : 86); const y = i === 0 ? 96 : 96 + Math.ceil(i / 2) * 44;
        const own = w.weapons.includes(k);
        const b = button(this, x, y, i === 0 ? 340 : 164, 38, own ? NAMES[k] : '- - -', () => {
          if (!own) return;
          w.selectWeapon(k); this.st.handleEvents();
          btns.forEach((o) => o.body.setFillStyle(hex(o.key === w.weapon ? PALETTE.gold : PALETTE.lavender)));
        }, { fill: k === w.weapon ? PALETTE.gold : PALETTE.lavender, silent: false });
        b.key = k;
        if (!own) b.setEnabled(false);
        if (own) {
          const ic = this.add.image(-(i === 0 ? 340 : 164) / 2 + 18, 0, `icon-${k}`).setScale(2);
          b.face.add(ic);
          if (k !== 'buster') {
            const e = this.add.graphics();
            e.fillStyle(hex(PALETTE.ink)).fillRect(30, -6, 44, 12);
            e.fillStyle(hex(WEAPONS[k].color)).fillRect(32, -4, Math.round(40 * w.energy[k] / MAX_ENERGY), 8);
            b.face.add(e);
            b.label.setX(-18);
          }
        }
        btns.push(b); c.add(b);
      });
      const tank = button(this, L, 286, 340, 40, `Use E-TANK  (${w.etanks} of ${MAX_ETANKS})`, () => {
        if (w.useEtank()) { this.st.handleEvents(); tank.setLabel(`Used! Health full (${w.etanks} left)`); tank.setEnabled(false); }
      }, { fill: PALETTE.cream });
      tank.setEnabled(w.etanks > 0 && w.p.hp < P.maxHp);
      c.add(tank);
      c.add(text(this, L, 326, w.etanks ? (w.p.hp < P.maxHp ? 'An E-tank refills all your health.' : 'Health is already full.') : 'Find Energy Tanks (E) in stages.', { color: PALETTE.lavender }));
      // right column
      const half = (x, y, label, fn) => { const b = button(this, x, y, 110, 42, label, () => fn(b), { fill: PALETTE.lavender }); c.add(b); return b; };
      c.add(button(this, R, 50, 224, 44, 'Resume', () => m.close(), { fill: PALETTE.gold }));
      c.add(button(this, R, 106, 224, 42, 'How to Play', () => { m.close(); this.help(); }, { fill: PALETTE.lavender }));
      half(R - 57, 160, isMuted() ? 'Sound off' : 'Sound on', (b) => { setMuted(!isMuted()); b.setLabel(isMuted() ? 'Sound off' : 'Sound on'); });
      half(R + 57, 160, musicOn() ? 'Music on' : 'Music off', (b) => { setMusicOn(!musicOn()); b.setLabel(musicOn() ? 'Music on' : 'Music off'); });
      c.add(button(this, R, 214, 224, 42, 'Stage Select', () => this.confirmQuit('select'), { fill: PALETTE.lavender }));
      c.add(button(this, R, 266, 224, 42, 'All Games', () => this.confirmQuit('all'), { fill: PALETTE.indigo, color: PALETTE.cream }));
      c.add(text(this, R, 312, `Enemy pace ${skillLabel()}/10`, { color: PALETTE.lavender }));
      c.add(text(this, R, 332, `Lives ${w.lives}`, { color: PALETTE.lavender }));
    }, () => this.scene.resume('Stage'));
  }

  confirmQuit(to) {
    const c = this.add.container(0, 0).setDepth(80);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, WIDTH / 2 - 170, 70, 340, 220, { fill: PALETTE.wine }));
    c.add(text(this, WIDTH / 2, 110, 'Leave this stage?', { size: 32, color: PALETTE.cream }));
    c.add(text(this, WIDTH / 2, 158, 'Energy Tanks you found are kept.\nThe stage starts over next time.', { color: PALETTE.sand }));
    c.add(button(this, WIDTH / 2 - 76, 240, 136, 44, 'Leave', () => { c.destroy(); this.modal?.destroy(); this.modal = null; this.st.quit(to); }, { fill: PALETTE.gold }));
    c.add(button(this, WIDTH / 2 + 76, 240, 136, 44, 'Stay', () => c.destroy(), { fill: PALETTE.lavender }));
  }
}

export { STAGES };
