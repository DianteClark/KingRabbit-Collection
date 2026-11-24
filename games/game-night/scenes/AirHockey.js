import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';

// Portrait rink. You defend the bottom goal (blue), the CPU the top (red).
const R = { x: 24, y: 96, w: WIDTH - 48, h: 512 };
const GOAL_W = 120;
const MID_Y = R.y + R.h / 2;
const PUCK_R = 14;
const MALLET_R = 20;
const MAX_PUCK = 900;
const WIN_SCORE = 7;

export class AirHockey extends Phaser.Scene {
  constructor() { super('AirHockey'); }

  init() { this.mode = 'cpu'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Air Hockey', () => go(this, 'Menu'));
    this.scoreText = text(this, WIDTH / 2, 74, '', { color: PALETTE.cream });
    this.drawRink();

    this.puck = { x: 0, y: 0, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'puck').setScale(PUCK_R * 2 / 8 + 0.5) };
    this.me = { x: WIDTH / 2, y: R.y + R.h - 70, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'blue').setScale(5) };
    this.cpu = { x: WIDTH / 2, y: R.y + 70, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'red').setScale(5) };
    this.target = { x: this.me.x, y: this.me.y };

    this.input.on('pointerdown', (p) => { this.target = { x: p.x, y: p.y - 30 }; });
    this.input.on('pointermove', (p) => { if (p.isDown) this.target = { x: p.x, y: p.y - 30 }; });

    this.scores = [0, 0];
    this.over = false;
    this.serve(1);
    this.updateScore();
  }

  drawRink() {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(R.x - 8, R.y - 8, R.w + 16, R.h + 16);
    g.fillStyle(hex(PALETTE.lavender)).fillRect(R.x - 5, R.y - 5, R.w + 10, R.h + 10);
    g.fillStyle(hex(PALETTE.cream)).fillRect(R.x, R.y, R.w, R.h);
    // centre line + circle
    g.fillStyle(hex(PALETTE.lavender)).fillRect(R.x, MID_Y - 2, R.w, 4);
    g.lineStyle(3, hex(PALETTE.lavender)).strokeCircle(WIDTH / 2, MID_Y, 46);
    // goal creases
    g.fillStyle(hex(PALETTE.red), 0.85).slice(WIDTH / 2, R.y, 70, 0, Math.PI, false).fillPath();
    g.fillStyle(hex(PALETTE.indigo), 0.85).slice(WIDTH / 2, R.y + R.h, 70, Math.PI, 0, false).fillPath();
    // goal mouths
    g.fillStyle(hex(PALETTE.ink)).fillRect(WIDTH / 2 - GOAL_W / 2, R.y - 8, GOAL_W, 8);
    g.fillStyle(hex(PALETTE.ink)).fillRect(WIDTH / 2 - GOAL_W / 2, R.y + R.h, GOAL_W, 8);
    text(this, WIDTH / 2, R.y + R.h + 22, 'Drag to move your mallet', { color: PALETTE.lavender });
  }

  updateScore() {
    this.scoreText.setText(`You ${this.scores[0]}  -  ${this.scores[1]} CPU    (first to ${WIN_SCORE})`);
  }

  serve(toward) {
    this.puck.x = WIDTH / 2; this.puck.y = MID_Y + (toward === 0 ? -60 : 60);
    this.puck.vx = 0; this.puck.vy = 0;
    this.frozen = 0.6;
  }

  moveMallet(m, tx, ty, maxSpeed, dt, minY, maxY) {
    const cx = Phaser.Math.Clamp(tx, R.x + MALLET_R, R.x + R.w - MALLET_R);
    const cy = Phaser.Math.Clamp(ty, minY, maxY);
    let dx = cx - m.x; let dy = cy - m.y;
    const d = Math.hypot(dx, dy);
    const step = maxSpeed * dt;
    if (d > step) { dx *= step / d; dy *= step / d; }
    m.vx = dx / dt; m.vy = dy / dt;
    m.x += dx; m.y += dy;
  }

  collide(m) {
    const p = this.puck;
    const dx = p.x - m.x; const dy = p.y - m.y;
    const d = Math.hypot(dx, dy);
    const min = PUCK_R + MALLET_R;
    if (d >= min || d === 0) return;
    const nx = dx / d; const ny = dy / d;
    p.x = m.x + nx * min; p.y = m.y + ny * min;
    // Relative velocity along the normal, bounce off the moving mallet.
    const rvx = p.vx - m.vx; const rvy = p.vy - m.vy;
    const along = rvx * nx + rvy * ny;
    if (along < 0) {
      p.vx -= 1.9 * along * nx; p.vy -= 1.9 * along * ny;
    }
    p.vx += m.vx * 0.25; p.vy += m.vy * 0.25;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_PUCK) { p.vx *= MAX_PUCK / sp; p.vy *= MAX_PUCK / sp; }
  }

  cpuThink(dt) {
    const p = this.puck; const c = this.cpu;
    let tx; let ty;
    const homeY = R.y + 60;
    if (p.y < MID_Y + 20 && (p.vy < 120 || p.y < c.y)) {
      // Attack: get behind the puck (above it) and drive it toward your goal.
      tx = p.x + (WIDTH / 2 - p.x) * 0.15;
      ty = p.y < c.y ? p.y - 40 : p.y - 6;
    } else {
      // Defend: shadow the puck along the goal line.
      tx = WIDTH / 2 + (p.x - WIDTH / 2) * 0.55;
      ty = homeY;
    }
    this.moveMallet(c, tx, ty, 430, dt, R.y + MALLET_R, MID_Y - MALLET_R);
  }

  update(_, deltaMs) {
    if (this.over) return;
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    this.moveMallet(this.me, this.target.x, this.target.y, 1600, dt, MID_Y + MALLET_R, R.y + R.h - MALLET_R);
    this.cpuThink(dt);

    if (this.frozen > 0) this.frozen -= dt;
    else {
      // Sub-step the puck so fast shots don't tunnel through mallets.
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const p = this.puck;
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        this.collide(this.me); this.collide(this.cpu);
        if (p.x < R.x + PUCK_R) { p.x = R.x + PUCK_R; p.vx = Math.abs(p.vx) * 0.9; }
        if (p.x > R.x + R.w - PUCK_R) { p.x = R.x + R.w - PUCK_R; p.vx = -Math.abs(p.vx) * 0.9; }
        const inMouth = Math.abs(p.x - WIDTH / 2) < GOAL_W / 2 - 4;
        if (p.y < R.y + PUCK_R) {
          if (inMouth) { this.goal(0); return; }
          p.y = R.y + PUCK_R; p.vy = Math.abs(p.vy) * 0.9;
        }
        if (p.y > R.y + R.h - PUCK_R) {
          if (inMouth) { this.goal(1); return; }
          p.y = R.y + R.h - PUCK_R; p.vy = -Math.abs(p.vy) * 0.9;
        }
      }
      const f = Math.pow(0.6, dt); // gentle air friction
      this.puck.vx *= f; this.puck.vy *= f;
    }
    for (const o of [this.puck, this.me, this.cpu]) o.img.setPosition(Math.round(o.x), Math.round(o.y));
  }

  goal(scorer) {
    this.scores[scorer]++;
    this.updateScore();
    this.cameras.main.flash(150, scorer === 0 ? 90 : 161, scorer === 0 ? 90 : 61, scorer === 0 ? 150 : 59);
    toast(this, scorer === 0 ? 'GOAL!' : 'CPU scores', MID_Y);
    if (this.scores[scorer] >= WIN_SCORE) {
      this.over = true;
      const won = scorer === 0;
      endGame(this, {
        id: 'airhockey', mode: 'cpu', title: won ? 'You win!' : 'CPU wins',
        lines: [`${this.scores[0]} - ${this.scores[1]}`], outcome: won ? 'w' : 'l',
        onAgain: () => this.scene.restart(),
      });
      return;
    }
    this.serve(scorer === 0 ? 1 : 0);
  }
}
