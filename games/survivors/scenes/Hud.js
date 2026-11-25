import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { stick, hit, usingPad, hideWhilePad } from '../../../shared/core/padkit.js';
import { WIDTH, HEIGHT, M, card, modal, openHowTo } from './common.js';
import { KEY } from '../art.js';
import { WEAPONS, PASSIVES, EVOLUTIONS } from '../logic/data.js';
import { describeOffer } from '../logic/build.js';
import { fmtClock } from '../logic/waves.js';

const JOY_R = 34;        // how far the knob travels
const JOY_ZONE = 0.6;    // left 60% of the screen starts the joystick

/** Everything on the glass during a run: joystick, bars, pause, level-up cards and banners. */
export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  init(data) { this.g = data.game; }

  create() {
    this.move = { x: 0, y: 0 };
    this.overlay = null;
    this.padNav = () => (this.overlay ? 'modal' : 'off');
    this.padStart = () => this.togglePause();
    this.input.addPointer(2);

    // low-health glow (four edge strips)
    this.low = this.add.graphics().setDepth(0);
    // top: XP bar, level, timer
    this.add.rectangle(M, M, 548, 12, hex(PALETTE.ink)).setOrigin(0);
    this.xpFill = this.add.rectangle(M + 2, M + 2, 0, 8, hex('#6ac0ff')).setOrigin(0);
    this.lvText = text(this, M, M + 24, 'Lv 1', { color: PALETTE.gold, origin: [0, 0.5] });
    this.timer = text(this, WIDTH / 2, M + 30, '00:00', { size: 32, color: PALETTE.cream });
    this.kills = text(this, WIDTH - M - 20, 82, '', { color: PALETTE.cream, origin: [1, 0.5] });
    this.coins = text(this, WIDTH - M - 20, 102, '', { color: PALETTE.gold, origin: [1, 0.5] });
    this.add.image(WIDTH - M - 8, 82, KEY, 'i_skull');
    this.add.image(WIDTH - M - 8, 102, KEY, 'i_coin');
    this.icons = [];
    for (let i = 0; i < 12; i++) this.icons.push(this.add.image(M + 8 + (i % 6) * 18, M + 46 + Math.floor(i / 6) * 18, KEY, 'i_knife').setVisible(false));
    this.pauseBtn = button(this, WIDTH - M - 22, M + 22, 44, 44, 'II', () => this.togglePause(), { fill: PALETTE.cream });
    // boss bar
    this.bossBox = this.add.container(WIDTH / 2, HEIGHT - M - 14).setVisible(false);
    this.bossName = text(this, 0, -14, '', { color: PALETTE.sand });
    this.bossFill = this.add.rectangle(-148, 6, 296, 8, hex(PALETTE.red)).setOrigin(0, 0.5);
    this.bossBox.add([this.add.rectangle(0, 6, 304, 14, hex(PALETTE.ink)), this.bossFill, this.bossName]);
    // banner
    this.bannerText = text(this, WIDTH / 2, 132, '', { size: 16, color: PALETTE.gold }).setStroke(PALETTE.ink, 4).setAlpha(0);
    // joystick
    this.joyBase = this.add.circle(0, 0, JOY_R + 6, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.35).setVisible(false).setDepth(5);
    this.joyKnob = this.add.circle(0, 0, 14, 0xffffff, 0.45).setVisible(false).setDepth(5);
    this.joyHint = text(this, WIDTH * 0.3, HEIGHT - M - 40, 'Touch and slide here to move', { color: PALETTE.cream }).setAlpha(0.8);
    hideWhilePad(this, [this.joyHint]);
    this.tweens.add({ targets: this.joyHint, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });
    this.joyId = null;
    this.input.on('pointerdown', (p) => this.joyDown(p));
    this.input.on('pointermove', (p) => this.joyMove(p));
    this.input.on('pointerup', (p) => this.joyUp(p));
    this.input.on('pointerupoutside', (p) => this.joyUp(p));
    this.input.on('gameout', () => this.joyUp(null, true));

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,P,ESC,ONE,TWO,THREE');
    this.keys.P.on('down', () => this.togglePause());
    this.keys.ESC.on('down', () => this.togglePause());
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => this.keys[k].on('down', () => this.levelCards?.[i]?.pick()));
    // the browser tab hidden or the app sent to the background: pause
    this.onHide = () => { if (document.hidden && !this.overlay && !this.g.run.over) this.togglePause(); };
    document.addEventListener('visibilitychange', this.onHide);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.onHide));
    if (this.g.run.pending && !this.g.run.paused) this.g.offerLevel();
  }

  // ------------------------------------------------------------------ joystick

  joyDown(p) {
    if (this.overlay || this.joyId != null || p.x > WIDTH * JOY_ZONE) return;
    if (p.x > WIDTH - M - 60 && p.y < M + 60) return;
    this.joyId = p.id;
    const cx = Phaser.Math.Clamp(p.x, M + JOY_R, WIDTH - M - JOY_R); const cy = Phaser.Math.Clamp(p.y, M + JOY_R, HEIGHT - M - JOY_R);
    this.joyBase.setPosition(cx, cy).setVisible(true);
    this.joyKnob.setPosition(p.x, p.y).setVisible(true);
    this.joyHint.setVisible(false);
    this.joyMove(p);
  }

  joyMove(p) {
    if (p.id !== this.joyId) return;
    let dx = p.x - this.joyBase.x; let dy = p.y - this.joyBase.y;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { // floating: the base follows a thumb that slides past the rim
      const k = (d - JOY_R) / d;
      this.joyBase.x += dx * k; this.joyBase.y += dy * k;
      dx = p.x - this.joyBase.x; dy = p.y - this.joyBase.y;
    }
    this.joyKnob.setPosition(this.joyBase.x + dx, this.joyBase.y + dy);
    const m = Math.min(1, Math.hypot(dx, dy) / JOY_R);
    this.touchMove = m < 0.15 ? { x: 0, y: 0 } : { x: (dx / (Math.hypot(dx, dy) || 1)) * m, y: (dy / (Math.hypot(dx, dy) || 1)) * m };
  }

  joyUp(p, all = false) {
    if (!all && p?.id !== this.joyId) return;
    this.joyId = null;
    this.touchMove = null;
    this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
  }

  // ------------------------------------------------------------------ overlays

  togglePause() {
    const run = this.g.run;
    if (run.over) return;
    if (this.overlay === 'pause') { this.closePause(); return; }
    if (this.overlay) return;
    this.joyUp(null, true);
    run.paused = 'pause';
    this.overlay = 'pause';
    sfx('tap');
    this.pauseBox = modal(this, 'Paused', [`${fmtClock(run.t)}   Level ${run.level}   ${run.kills} kills`], [
      ['Resume', () => this.closePause(true)],
      ['How to play', () => { this.overlay = null; openHowTo(this, [], () => this.togglePause()); }],
      ['Give up', () => { this.overlay = null; this.g.finish('quit'); }, PALETTE.red],
    ]);
  }

  closePause(already = false) {
    if (!already) this.pauseBox?.destroy();
    this.pauseBox = null;
    this.overlay = null;
    this.g.run.paused = null;
  }

  closeOverlays() {
    this.pauseBox?.destroy(); this.levelBox?.destroy();
    this.overlay = null; this.levelCards = null;
  }

  showLevelUp(offers) {
    this.joyUp(null, true);
    this.overlay = 'level';
    const c = this.add.container(0, 0).setDepth(40);
    this.levelBox = c;
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    c.add(text(this, WIDTH / 2, 70, `Level ${this.g.run.level}!`, { size: 32, color: PALETTE.gold }).setStroke(PALETTE.ink, 4));
    c.add(text(this, WIDTH / 2, 100, 'Pick one', { color: PALETTE.lavender }));
    let used = false;
    this.levelCards = offers.map((o, i) => {
      const d = describeOffer(o);
      const x = WIDTH / 2 + (i - (offers.length - 1) / 2) * 196;
      const pick = () => {
        if (used) return;
        used = true;
        sfx('power');
        c.destroy();
        this.levelBox = null; this.levelCards = null; this.overlay = null;
        this.g.choose(o);
      };
      const k = card(this, x, 214, 184, 176, pick, { fill: o.kind === 'evolve' ? PALETTE.plum : PALETTE.indigo, border: o.kind === 'evolve' ? PALETTE.gold : PALETTE.lavender });
      k.add(this.add.rectangle(0, -48, 52, 52, hex(PALETTE.night)).setStrokeStyle(2, hex(PALETTE.ink)));
      k.add(this.add.image(0, -48, KEY, d.icon).setScale(3));
      k.add(text(this, 0, -6, d.name, { color: PALETTE.cream }));
      k.add(text(this, 0, 16, d.tag, { color: o.level === 1 && o.kind !== 'evolve' ? PALETTE.leaf : PALETTE.gold }));
      k.add(text(this, 0, 50, d.desc, { color: PALETTE.lavender, wrap: 164 }));
      if (i === 0) k.padFirst = true;
      k.pick = pick;
      c.add(k);
      return k;
    });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  banner(msg) {
    if (!this.bannerText) return;
    this.bannerText.setText(msg).setAlpha(1).setScale(1.2);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 200 });
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 2200, duration: 400 });
  }

  // ------------------------------------------------------------------ per frame

  update(time) {
    const run = this.g.run;
    // movement: touch, else keyboard, else controller
    const k = this.keys;
    let kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const s = stick();
    if (!kx && !ky && (Math.abs(s.x) > 0.2 || Math.abs(s.y) > 0.2)) { kx = s.x; ky = s.y; }
    if (this.touchMove) this.move = this.touchMove;
    else { this.keyMove ||= { x: 0, y: 0 }; this.keyMove.x = kx; this.keyMove.y = ky; this.move = this.keyMove; }
    if (this.joyHint.visible && (run.t > 8 || kx || ky)) this.joyHint.setVisible(false);
    if (this.overlay && usingPad() && hit('b') && this.overlay === 'pause') this.closePause();

    this.xpFill.width = Math.round(544 * Math.min(1, run.xp / run.xpNext));
    // Text redraws a texture whenever it changes, so only touch it when the value is new.
    if (this.lastLv !== run.level) { this.lastLv = run.level; this.lvText.setText(`Lv ${run.level}`); }
    const clock = fmtClock(run.t);
    if (this.lastClock !== clock) { this.lastClock = clock; this.timer.setText(clock); }
    if (this.lastFinal !== run.finalPhase) { this.lastFinal = run.finalPhase; this.timer.setColor(run.finalPhase ? PALETTE.gold : PALETTE.cream); }
    // kills tick fast late on: refresh a few times a second at most
    if (time > (this.countT || 0)) {
      this.countT = time + 250;
      if (this.lastKills !== run.kills) { this.lastKills = run.kills; this.kills.setText(String(run.kills)); }
      if (this.lastCoins !== run.coins) { this.lastCoins = run.coins; this.coins.setText(String(run.coins)); }
    }
    const sig = run.buildVer || 0;
    if (this.lastSig !== sig) {
      this.lastSig = sig;
      const wi = Object.keys(run.build.weapons).map((id) => (run.build.evolved[id] ? EVOLUTIONS[run.build.evolved[id]].icon : WEAPONS[id].icon));
      const pi = Object.keys(run.build.passives).map((id) => PASSIVES[id].icon);
      this.icons.forEach((im, i) => {
        const name = i < 6 ? wi[i] : pi[i - 6]; // weapons on the first row, passives on the second
        im.setVisible(!!name);
        if (name) im.setFrame(name);
      });
    }
    const b = run.boss;
    const showBoss = !!(b && b.active);
    if (this.bossBox.visible !== showBoss) this.bossBox.setVisible(showBoss);
    if (showBoss) {
      if (this.lastBoss !== b.boss.name) { this.lastBoss = b.boss.name; this.bossName.setText(b.boss.name); }
      this.bossFill.width = Math.max(0, Math.round(296 * b.hp / b.maxHp));
    }
    // low HP: pulsing red edges
    this.low.clear();
    if (run.lowHp && !run.over) {
      const a = 0.25 + 0.2 * Math.sin(time / 150);
      this.low.fillStyle(0xff2020, a);
      this.low.fillRect(0, 0, WIDTH, 8).fillRect(0, HEIGHT - 8, WIDTH, 8).fillRect(0, 0, 8, HEIGHT).fillRect(WIDTH - 8, 0, 8, HEIGHT);
      if (!this.beatT || time > this.beatT) { this.beatT = time + 900; if (!run.paused) sfx('thud'); }
    }
  }
}
