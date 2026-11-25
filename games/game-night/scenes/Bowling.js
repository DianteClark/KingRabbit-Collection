import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { getBest, submitBest } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';
import { earn, stat } from '../trophies.js';
import { frames, totalScore, position, marks } from '../logic/bowling.js';

const LANE = { x: 112, w: 136, top: 150, bottom: 600 };
const GUTTER = 14;
const FOUL_Y = 548;
const BALL_R = 11;
const PIN_R = 7;
const HEAD_Y = 214;
// Pin rack: 1 at the front, 7-10 at the back.
const RACK = [[0, 0], [-1, -1], [1, -1], [-2, -2], [0, -2], [2, -2], [-3, -3], [-1, -3], [1, -3], [3, -3]];

export class Bowling extends Phaser.Scene {
  constructor() { super('Bowling'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Bowling', () => go(this, 'Menu'));
    this.card = this.add.container(0, 0);
    this.drawLane();
    this.pinsLayer = this.add.container(0, 0).setDepth(5);
    this.ball = { x: WIDTH / 2, y: FOUL_Y + 20, vx: 0, vy: 0, img: this.add.image(0, 0, 'bowling', 'ball').setScale(3).setDepth(6) };
    this.aimG = this.add.graphics().setDepth(7);
    this.meter = this.add.graphics().setDepth(7);
    this.prompt = text(this, WIDTH / 2, 622, '', { color: PALETTE.gold });
    // Taps on the header (back / How to Play) shouldn't count as a throw step.
    this.input.on('pointerup', (p, over) => { if (p.y > 60 && !over.length) this.tap(); });
    this.rolls = [];
    this.over = false;
    this.rack(true);
    this.drawCard();
    this.ready();
  }

  drawLane() {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(LANE.x - GUTTER - 6, LANE.top - 6, LANE.w + GUTTER * 2 + 12, LANE.bottom - LANE.top + 12);
    g.fillStyle(hex(PALETTE.indigo)).fillRect(LANE.x - GUTTER, LANE.top, GUTTER, LANE.bottom - LANE.top);
    g.fillStyle(hex(PALETTE.indigo)).fillRect(LANE.x + LANE.w, LANE.top, GUTTER, LANE.bottom - LANE.top);
    g.fillStyle(hex(PALETTE.orange)).fillRect(LANE.x, LANE.top, LANE.w, LANE.bottom - LANE.top);
    for (let x = LANE.x + 17; x < LANE.x + LANE.w; x += 17) g.fillStyle(hex(PALETTE.red), 0.45).fillRect(x, LANE.top, 2, LANE.bottom - LANE.top);
    g.fillStyle(hex(PALETTE.cream)).fillRect(LANE.x, FOUL_Y - 18, LANE.w, 2);
    // Aiming arrows on the lane
    for (let k = -2; k <= 2; k++) g.fillStyle(hex(PALETTE.wine)).fillTriangle(WIDTH / 2 + k * 24 - 4, 440, WIDTH / 2 + k * 24 + 4, 440, WIDTH / 2 + k * 24, 430);
  }

  rack(fresh) {
    if (fresh) {
      this.pins = RACK.map(([cx, cy]) => {
        const x = WIDTH / 2 + cx * 15; const y = HEAD_Y + cy * 20;
        return { x, y, hx: x, hy: y, vx: 0, vy: 0, down: false, gone: false };
      });
    } else {
      // Clear the fallen pins, put standing ones back on their spots.
      this.pins = this.pins.filter((p) => !p.down).map((p) => ({ ...p, x: p.hx, y: p.hy, vx: 0, vy: 0 }));
    }
    this.drawPins();
  }

  drawPins() {
    this.pinsLayer.removeAll(true);
    for (const p of this.pins) {
      if (p.gone) continue;
      this.pinsLayer.add(this.add.image(Math.round(p.x), Math.round(p.y), 'bowling', p.down ? 'pinDown' : 'pin').setScale(3));
    }
  }

  drawCard() {
    this.card.removeAll(true);
    const fs = frames(this.rolls);
    // 9 frames of 33px + a 51px 10th: room for three-digit totals inside the boxes.
    const x0 = 4; const y0 = 64; const w = 33;
    const g = this.add.graphics();
    this.card.add(g);
    fs.forEach((f, i) => {
      const bw = i === 9 ? 51 : w;
      const x = x0 + i * w;
      g.fillStyle(hex(PALETTE.ink)).fillRect(x, y0, bw, 52);
      g.fillStyle(hex(PALETTE.cream)).fillRect(x + 2, y0 + 2, bw - 4, 48);
      g.fillStyle(hex(PALETTE.lavender)).fillRect(x + 2, y0 + 22, bw - 4, 2);
      const m = marks(f.rolls, i === 9);
      this.card.add(text(this, x + bw / 2, y0 + 12, m.join(i === 9 ? '' : ' '), { color: PALETTE.night }));
      if (f.score !== null) this.card.add(text(this, x + bw / 2, y0 + 38, String(f.score), { color: PALETTE.indigo }));
    });
    this.card.add(text(this, WIDTH / 2, 132, `Total ${totalScore(this.rolls)}   Best ${getBest('bowling')}`, { color: PALETTE.cream }));
  }

  ready() {
    this.phase = 'position';
    this.t = 0;
    this.ball.x = WIDTH / 2; this.ball.y = FOUL_Y; this.ball.vx = 0; this.ball.vy = 0;
    this.ball.img.setVisible(true);
    this.prompt.setText('Tap to set your spot');
  }

  tap() {
    if (this.over) return;
    if (this.phase !== 'rolling' && this.phase !== 'done') sfx('select');
    if (this.phase === 'position') { this.phase = 'aim'; this.t = 0; this.prompt.setText('Tap to set the angle'); }
    else if (this.phase === 'aim') { this.phase = 'power'; this.t = 0; this.prompt.setText('Tap to set the power'); }
    else if (this.phase === 'power') this.release();
  }

  release() {
    const speed = 380 + this.power * 520;
    this.ball.vx = Math.sin(this.angle) * speed;
    this.ball.vy = -Math.cos(this.angle) * speed;
    this.phase = 'rolling';
    this.rollTime = 0;
    this.pinSound = 0;
    sfx('thud');
    this.aimG.clear(); this.meter.clear();
    this.prompt.setText('');
  }

  update(_, ms) {
    const dt = Math.min(ms / 1000, 1 / 30);
    this.t += dt;
    const b = this.ball;
    this.aimG.clear(); this.meter.clear();
    if (this.phase === 'position') {
      b.x = WIDTH / 2 + Math.sin(this.t * 2.4) * (LANE.w / 2 - BALL_R - 4);
    } else if (this.phase === 'aim') {
      this.angle = Math.sin(this.t * 2.8) * 0.22;
      this.aimG.lineStyle(3, hex(PALETTE.cream));
      this.aimG.lineBetween(b.x, b.y - 14, b.x + Math.sin(this.angle) * 70, b.y - 14 - Math.cos(this.angle) * 70);
    } else if (this.phase === 'power') {
      this.power = (Math.sin(this.t * 3.4 - Math.PI / 2) + 1) / 2;
      const mx = 296; const top = 300; const h = 200;
      this.meter.fillStyle(hex(PALETTE.ink)).fillRect(mx - 4, top - 4, 28, h + 8);
      const cols = [PALETTE.leaf, PALETTE.gold, PALETTE.orange, PALETTE.red];
      for (let k = 0; k < 20; k++) {
        const on = k / 20 < this.power;
        this.meter.fillStyle(hex(cols[Math.min(3, Math.floor(k / 5))]), on ? 1 : 0.2).fillRect(mx, top + h - (k + 1) * 10 + 1, 20, 8);
      }
      this.aimG.lineStyle(3, hex(PALETTE.cream));
      this.aimG.lineBetween(b.x, b.y - 14, b.x + Math.sin(this.angle) * 70, b.y - 14 - Math.cos(this.angle) * 70);
    } else if (this.phase === 'rolling') {
      this.physics(dt);
    }
    b.img.setPosition(Math.round(b.x), Math.round(b.y));
  }

  physics(dt) {
    this.rollTime += dt;
    const b = this.ball;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      if (!b.gone) {
        b.x += b.vx * h; b.y += b.vy * h;
        // Gutter: the ball drops in and rolls straight down the channel.
        if (!b.gutter && (b.x < LANE.x || b.x > LANE.x + LANE.w)) {
          b.gutter = true; sfx('bounce'); b.x = b.x < LANE.x ? LANE.x - GUTTER / 2 : LANE.x + LANE.w + GUTTER / 2; b.vx = 0;
        }
        if (b.y < LANE.top - 20) { b.gone = true; b.img.setVisible(false); }
      }
      for (const p of this.pins) {
        if (p.gone) continue;
        p.x += p.vx * h; p.y += p.vy * h;
        if (!b.gone && !b.gutter && this.bounce(b, p, 6, 1, BALL_R + PIN_R)) this.clatter();
      }
      for (let i = 0; i < this.pins.length; i++) {
        for (let j = i + 1; j < this.pins.length; j++) {
          const a = this.pins[i]; const c = this.pins[j];
          if (!a.gone && !c.gone && this.bounce(a, c, 1, 1, PIN_R * 2)) this.clatter();
        }
      }
    }
    for (const p of this.pins) {
      p.vx *= Math.pow(0.08, dt); p.vy *= Math.pow(0.08, dt);
      if (!p.down && Math.hypot(p.x - p.hx, p.y - p.hy) > 5) p.down = true;
      if (p.x < LANE.x - GUTTER || p.x > LANE.x + LANE.w + GUTTER || p.y < LANE.top - 10) p.gone = true;
    }
    this.drawPins();
    const moving = this.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vy) > 8);
    if ((b.gone || b.gutter && b.y < LANE.top) && !moving || this.rollTime > 6) this.finishRoll();
  }

  /** Elastic circle collision between a (mass ma) and c (mass mc). */
  bounce(a, c, ma, mc, minDist) {
    const dx = c.x - a.x; const dy = c.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d >= minDist || d === 0) return false;
    const nx = dx / d; const ny = dy / d;
    const overlap = minDist - d;
    a.x -= nx * overlap * (mc / (ma + mc)); a.y -= ny * overlap * (mc / (ma + mc));
    c.x += nx * overlap * (ma / (ma + mc)); c.y += ny * overlap * (ma / (ma + mc));
    const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
    if (rel <= 0) return false;
    const imp = (2 * rel) / (ma + mc);
    a.vx -= imp * mc * nx; a.vy -= imp * mc * ny;
    c.vx += imp * ma * nx; c.vy += imp * ma * ny;
    // Pins scatter a little sideways so racks break up naturally.
    c.vx += (Math.random() - 0.5) * 40;
    return rel > 30;
  }

  /** Pin noise: a big crash on first contact, then a few quieter knocks. */
  clatter() {
    const now = this.time.now;
    if (!this.pinSound) { sfx('pins'); this.pinSound = now; this.lastKnock = now; return; }
    if (now - this.lastKnock > 120 && now - this.pinSound < 1500) { sfx('hit'); this.lastKnock = now; }
  }

  finishRoll() {
    this.phase = 'done';
    const standingBefore = this.pins.filter((p) => !p.counted).length;
    const knocked = this.pins.filter((p) => (p.down || p.gone) && !p.counted).length;
    this.pins.forEach((p) => { if (p.down || p.gone) p.counted = true; });
    this.rolls.push(knocked);
    const pos = position(this.rolls);
    const prev = position(this.rolls.slice(0, -1));
    let msg = knocked === 0 ? (this.ball.gutter ? 'Gutter ball' : 'Miss') : `${knocked} pin${knocked > 1 ? 's' : ''}`;
    if (knocked === standingBefore && prev.freshRack) msg = 'STRIKE!';
    else if (knocked === standingBefore && knocked > 0) msg = 'Spare!';
    toast(this, msg, 380);
    if (msg === 'STRIKE!') { earn('bowl-strike'); stat('strikes'); sfx('strike'); this.cameras.main.shake(180, 0.006); } else if (msg === 'Spare!') sfx('win');
    this.drawCard();
    this.ball.gutter = false; this.ball.gone = false;
    if (pos.over) { this.time.delayedCall(900, () => this.gameOver()); return; }
    this.time.delayedCall(1100, () => {
      this.rack(pos.freshRack);
      this.ready();
    });
  }

  gameOver() {
    this.over = true;
    const total = totalScore(this.rolls);
    const isBest = submitBest('bowling', total);
    sfx(isBest ? 'win' : 'goal');
    this.drawCard();
    const m = modal(this, isBest ? 'New best!' : 'Game over', [`Final score ${total}`], [
      ['Play again', () => { m.destroy(); this.scene.restart(); }],
      ['Menu', () => go(this, 'Menu')],
    ]);
  }
}
