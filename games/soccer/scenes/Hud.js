import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { modal, openHowTo, kitChip } from './common.js';
import { PHASE } from '../logic/match.js';
import { OX, OY } from './MatchScene.js';
import { W, L } from '../logic/constants.js';
import { applyResult, needsPens, matchData } from '../flow.js';
import { save } from '../save.js';

const BAR_H = 52;
const STICK = { x: 84, y: 540, r: 46, knob: 22 };
const SHOOT = { x: 306, y: 520, r: 44 };
const PASS = { x: 222, y: 584, r: 38 };
const RADAR = { x: WIDTH - 50, y: BAR_H + 8, w: 42, h: 72 };

/** Overlay for the match: scoreboard, radar, touch controls, messages and menus. */
export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  init({ matchScene }) {
    this.ms = matchScene;
    this.m = matchScene.match;
    this.stick = { id: null, ox: STICK.x, oy: STICK.y, dx: 0, dy: 0 };
    this.buttons = { pass: new Set(), shoot: new Set() };
    this.modalOpen = false;
  }

  create() {
    const home = this.ms.home; const away = this.ms.away;
    // Top bar
    this.add.rectangle(0, 0, WIDTH, BAR_H, hex(PALETTE.night)).setOrigin(0);
    this.add.rectangle(0, BAR_H, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0);
    button(this, 26, 26, 40, 38, '<', () => this.pause(), { size: 32, fill: PALETTE.cream });
    button(this, WIDTH - 26, 26, 40, 38, '?', () => this.help(), { size: 32, fill: PALETTE.gold });
    kitChip(this, 66, 18, home);
    kitChip(this, WIDTH - 66, 18, away);
    text(this, 100, 18, home.short, { color: PALETTE.cream });
    text(this, WIDTH - 100, 18, away.short, { color: PALETTE.cream });
    this.scoreText = text(this, WIDTH / 2, 17, '0 - 0', { size: 32, color: PALETTE.gold });
    this.clockText = text(this, WIDTH / 2, 41, '', { color: PALETTE.lavender });
    this.modeText = text(this, 66, 41, this.modeLabel(), { color: PALETTE.lavender, origin: [0, 0.5] });

    this.radar = this.add.graphics();
    this.controls = this.add.graphics();
    this.passLabel = text(this, PASS.x, PASS.y, 'PASS', { color: PALETTE.cream });
    this.shootLabel = text(this, SHOOT.x, SHOOT.y, 'SHOOT', { color: PALETTE.cream });
    this.hint = text(this, WIDTH / 2, 470, '', { color: PALETTE.cream }).setAlpha(0);
    this.hintBg = null;

    this.setupInput();
    this.refresh();
    if (!save.get('seenHelp')) {
      save.set('seenHelp', true);
      this.time.delayedCall(300, () => this.help());
    }
  }

  modeLabel() {
    const d = this.ms.data0;
    if (d.mode === 'cup') return ['QF', 'SF', 'Final'][(save.get('cup') || {}).round || 0] || 'Cup';
    if (d.mode === 'endless') return `Run ${(save.get('endless') || {}).streak || 0}`;
    return '';
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.input.addPointer(3);
    const inCircle = (p, c, extra = 8) => Math.hypot(p.x - c.x, p.y - c.y) < c.r + extra;
    this.input.on('pointerdown', (p) => {
      if (this.modalOpen || p.y < BAR_H + 4) return;
      if (inCircle(p, SHOOT)) { this.buttons.shoot.add(p.id); return; }
      if (inCircle(p, PASS)) { this.buttons.pass.add(p.id); return; }
      if (p.x < WIDTH * 0.58 && this.stick.id === null) {
        this.stick = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      }
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.stick.id) return;
      let dx = p.x - this.stick.ox; let dy = p.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      // Let the stick follow a thumb that drifts too far.
      if (d > STICK.r) {
        this.stick.ox += (dx / d) * (d - STICK.r); this.stick.oy += (dy / d) * (d - STICK.r);
        dx = p.x - this.stick.ox; dy = p.y - this.stick.oy;
      }
      this.stick.dx = dx; this.stick.dy = dy;
    });
    const up = (p) => {
      if (p.id === this.stick.id) this.stick = { id: null, ox: STICK.x, oy: STICK.y, dx: 0, dy: 0 };
      this.buttons.pass.delete(p.id); this.buttons.shoot.delete(p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => { this.buttons.pass.clear(); this.buttons.shoot.clear(); this.stick.id = null; });

    const kb = this.input.keyboard;
    this.keys = kb ? kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,X,J,SPACE,K') : null;
  }

  /** Called by the MatchScene every simulation step. */
  readInput() {
    if (this.modalOpen) return { mx: 0, my: 0, pass: false, shoot: false };
    let mx = this.stick.id !== null ? this.stick.dx / STICK.r : 0;
    let my = this.stick.id !== null ? this.stick.dy / STICK.r : 0;
    let pass = this.buttons.pass.size > 0;
    let shoot = this.buttons.shoot.size > 0;
    const k = this.keys;
    if (k) {
      const kx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      const ky = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      if (kx || ky) { const d = Math.hypot(kx, ky); mx = kx / d; my = ky / d; }
      pass = pass || k.X.isDown || k.J.isDown;
      shoot = shoot || k.SPACE.isDown || k.K.isDown;
    }
    return { mx, my, pass, shoot };
  }

  // ------------------------------------------------------------------ drawing

  update() { this.refresh(); }

  refresh() {
    const m = this.m;
    this.scoreText.setText(`${m.score[0]} - ${m.score[1]}`);
    const half = m.half === 1 ? '1st' : '2nd';
    this.clockText.setText(m.phase === PHASE.OVER ? 'Full time' : m.phase === PHASE.HALF ? 'Half time' : `${half}  ${m.minute}'`);
    this.drawRadar();
    this.drawControls();
    this.updateHint();
  }

  drawRadar() {
    const g = this.radar; const m = this.m; const R = RADAR;
    g.clear();
    // Fade out of the way when the play is right underneath it (top corners).
    const v = this.ms.cameras.main.worldView;
    const bx = (OX + m.ball.x - v.x) * 2; const by = (OY + m.ball.y - v.y) * 2;
    const under = bx > R.x - 40 && by < R.y + R.h + 50;
    g.setAlpha(under ? 0.25 : 1);
    g.fillStyle(hex(PALETTE.ink), 0.7).fillRect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(R.x, R.y, R.w, R.h);
    g.fillStyle(0xffffff, 0.5).fillRect(R.x, R.y + R.h / 2, R.w, 1);
    const sx = R.w / W; const sy = R.h / L;
    for (const p of m.players) {
      const c = p.side === 0 ? (p === m.active ? PALETTE.gold : this.ms.home.shirt) : this.ms.away.shirt;
      g.fillStyle(hex(PALETTE.ink)).fillRect(Math.round(R.x + p.x * sx) - 2, Math.round(R.y + p.y * sy) - 2, 4, 4);
      g.fillStyle(hex(c)).fillRect(Math.round(R.x + p.x * sx) - 1, Math.round(R.y + p.y * sy) - 1, 2, 2);
    }
    const b = m.ball;
    g.fillStyle(0xffffff).fillRect(Math.round(R.x + b.x * sx) - 1, Math.round(R.y + b.y * sy) - 1, 3, 3);
  }

  drawControls() {
    const g = this.controls; const m = this.m;
    g.clear();
    // Stick
    const s = this.stick;
    const on = s.id !== null;
    g.fillStyle(hex(PALETTE.ink), on ? 0.3 : 0.15).fillCircle(s.ox, s.oy, STICK.r);
    g.lineStyle(3, 0xffffff, on ? 0.5 : 0.25).strokeCircle(s.ox, s.oy, STICK.r);
    const kx = s.ox + (on ? clampLen(s.dx, s.dy, STICK.r).x : 0);
    const ky = s.oy + (on ? clampLen(s.dx, s.dy, STICK.r).y : 0);
    g.fillStyle(0xffffff, on ? 0.7 : 0.35).fillCircle(kx, ky, STICK.knob);
    g.lineStyle(2, hex(PALETTE.ink), 0.6).strokeCircle(kx, ky, STICK.knob);

    // Buttons: their job changes with who has the ball.
    const a = m.active;
    const b = m.ball;
    const haveIt = b.owner && b.owner.side === 0;
    const taking = m.phase === PHASE.TAKING && m.sp && m.sp.side === 0;
    const coming = a && b.intended === a;
    let passLbl = 'PASS'; let shootLbl = 'SHOOT';
    if (taking && m.sp.type === 'corner') shootLbl = 'CROSS';
    else if (taking && m.sp.type === 'throwin') shootLbl = 'LONG';
    else if (!haveIt && !coming && !taking) { passLbl = 'TACKLE'; shootLbl = 'SWITCH'; }
    this.passLabel.setText(passLbl);
    this.shootLabel.setText(shootLbl);
    const btn = (c, down, fill) => {
      g.fillStyle(hex(PALETTE.ink), 0.55).fillCircle(c.x, c.y + 4, c.r);
      g.fillStyle(hex(fill), down ? 0.95 : 0.7).fillCircle(c.x, c.y + (down ? 3 : 0), c.r - 2);
      g.lineStyle(3, hex(PALETTE.ink), 0.8).strokeCircle(c.x, c.y + (down ? 3 : 0), c.r - 2);
    };
    const pd = this.buttons.pass.size > 0 || (this.keys && (this.keys.X.isDown || this.keys.J.isDown));
    const sd = this.buttons.shoot.size > 0 || (this.keys && (this.keys.SPACE.isDown || this.keys.K.isDown));
    btn(PASS, pd, passLbl === 'TACKLE' ? PALETTE.orange : PALETTE.indigo);
    btn(SHOOT, sd, shootLbl === 'SWITCH' ? PALETTE.plum : PALETTE.red);
    this.passLabel.setY(PASS.y + (pd ? 3 : 0));
    this.shootLabel.setY(SHOOT.y + (sd ? 3 : 0));
    // Shot power ring round the Shoot button
    if (m.charging && m.charge > 0) {
      g.lineStyle(5, hex(PALETTE.gold), 1);
      g.beginPath();
      g.arc(SHOOT.x, SHOOT.y, SHOOT.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * m.charge, false);
      g.strokePath();
    }
  }

  updateHint() {
    const m = this.m;
    let msg = '';
    if (m.phase === PHASE.TAKING && m.sp && m.sp.side === 0 && m.sp.taker.role !== 'GK') {
      msg = { kickoff: 'Run, or PASS, to kick off', throwin: 'PASS to throw it in', corner: 'PASS short or CROSS it in' }[m.sp.type] || '';
    }
    if (msg !== this.hint.text) {
      this.hint.setText(msg);
      this.tweens.killTweensOf(this.hint);
      this.hint.setAlpha(msg ? 1 : 0);
      this.hintBg?.destroy();
      this.hintBg = null;
      if (msg) {
        this.hintBg = this.add.rectangle(WIDTH / 2, this.hint.y, this.hint.width + 20, 28, hex(PALETTE.ink), 0.6);
        this.children.moveBelow(this.hintBg, this.hint);
      }
    }
  }

  // ------------------------------------------------------------------ messages

  toast(msg) {
    const bg = this.add.rectangle(WIDTH / 2, 150, 10, 28, hex(PALETTE.ink), 0.6).setDepth(40);
    const t = text(this, WIDTH / 2, 150, msg, { color: PALETTE.gold }).setDepth(41);
    bg.width = t.width + 20;
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1000, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  banner(msg, color = PALETTE.gold, sub = '') {
    const c = this.add.container(0, 0).setDepth(45);
    c.add(this.add.rectangle(WIDTH / 2, 250, WIDTH, sub ? 92 : 64, hex(PALETTE.ink), 0.7));
    c.add(text(this, WIDTH / 2, sub ? 236 : 250, msg, { size: 32, color }));
    if (sub) c.add(text(this, WIDTH / 2, 272, sub, { color: PALETTE.cream }));
    c.setScale(1, 0);
    this.tweens.add({ targets: c, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 300, onComplete: () => c.destroy() });
  }

  goal(e) {
    const mine = e.side === 0;
    const team = mine ? this.ms.home : this.ms.away;
    const sub = e.own ? 'Own goal!' : `${team.name}  ${this.m.minute}'`;
    this.banner('GOAL!', mine ? PALETTE.gold : PALETTE.orange, sub);
    this.tweens.add({ targets: this.scoreText, scale: 1.4, yoyo: true, duration: 160, repeat: 2 });
  }

  // ------------------------------------------------------------------ menus

  setModal(on) {
    this.modalOpen = on;
    this.ms.paused = on;
    this.buttons.pass.clear(); this.buttons.shoot.clear();
    this.stick = { id: null, ox: STICK.x, oy: STICK.y, dx: 0, dy: 0 };
  }

  help() {
    if (this.modalOpen) return;
    openHowTo(this, [this.ms]);
  }

  pause() {
    if (this.modalOpen || this.m.phase === PHASE.OVER) return;
    this.setModal(true);
    const mode = this.ms.data0.mode;
    const lines = mode === 'quick' ? ['Match paused'] : ['Quitting now counts', 'as a 3-0 defeat'];
    const md = modal(this, 'Paused', lines, [
      ['Resume', () => { md.destroy(); this.setModal(false); }],
      ['Quit match', () => {
        md.destroy();
        if (mode === 'quick') { this.leave('Menu'); return; }
        const res = applyResult(this.ms.data0, [0, 3]);
        this.leave(mode === 'cup' ? 'Cup' : 'Endless', res);
      }],
    ]);
  }

  showFullTime() {
    if (this.modalOpen) return;
    this.setModal(true);
    const m = this.m; const d = this.ms.data0;
    const s = [m.score[0], m.score[1]];
    const line = `${this.ms.home.short} ${s[0]} - ${s[1]} ${this.ms.away.short}`;
    const stats = `Shots ${m.stats.shots[0]} - ${m.stats.shots[1]}`;
    if (needsPens(d.mode, s)) {
      sfx('power');
      modal(this, 'Penalties!', [line, 'It goes to a shoot-out'], [
        ['Take penalties', () => this.leave('Penalties', { data: d, score: s })],
      ]);
      return;
    }
    const res = applyResult(d, s);
    sfx(res.won ? 'win' : res.draw ? 'select' : 'lose');
    const title = res.won ? 'You win!' : res.draw ? 'Draw' : 'You lose';
    if (d.mode === 'quick') {
      modal(this, title, [line, stats], [
        ['Rematch', () => this.leave('MatchScene', matchData('quick', d.away))],
        ['Menu', () => this.leave('Menu')],
      ]);
    } else if (d.mode === 'cup') {
      const champ = res.cup && res.cup.champion === 'rabbits';
      modal(this, champ ? 'Champions!' : title, [line, champ ? 'You won the cup!' : res.won ? 'Through to the next round' : 'Knocked out of the cup'], [
        ['Continue', () => this.leave('Cup')],
      ]);
    } else {
      modal(this, title, [line, res.won ? `${res.streak} in a row!` : `Run over: ${res.streak} wins`], [
        ['Continue', () => this.leave('Endless', res)],
      ]);
    }
  }

  leave(key, data) {
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.ms.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('MatchScene');
      this.scene.start(key, data);
    });
  }
}

function clampLen(x, y, r) {
  const d = Math.hypot(x, y);
  return d > r ? { x: (x / d) * r, y: (y / d) * r } : { x, y };
}

