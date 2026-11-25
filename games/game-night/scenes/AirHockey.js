import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';
import { sfx } from '../../../shared/core/sfx.js';
import { earn } from '../trophies.js';
import { getSkill, tune } from '../adaptive.js';


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

  init(data) {
    this.mode = 'cpu';
    // speed: CPU mallet top speed. read: how far ahead it predicts bounces. aim: shot accuracy.
    this.ai = tune({
      easy: { speed: 300, read: 0.3, aim: 0.45, react: 0.35 },
      normal: { speed: 460, read: 0.7, aim: 0.2, react: 0.18 },
      hard: { speed: 680, read: 1, aim: 0.06, react: 0.05 },
    }, getSkill('airhockey'));
  }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Air Hockey', () => go(this, 'Menu'));
    this.scoreText = text(this, WIDTH / 2, 74, '', { color: PALETTE.cream });
    this.drawRink();

    this.puck = { x: 0, y: 0, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'puck').setScale(PUCK_R * 2 / 8 + 0.5) };
    this.me = { x: WIDTH / 2, y: R.y + R.h - 70, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'blue').setScale(5) };
    this.cpu = { x: WIDTH / 2, y: R.y + 70, vx: 0, vy: 0, img: this.add.image(0, 0, 'airhockey', 'red').setScale(5) };
    this.target = { x: this.me.x, y: this.me.y };

    // Taps on the header buttons don't pull the mallet toward them.
    this.input.on('pointerdown', (p, over) => { if (!over.length) this.target = { x: p.x, y: p.y - 30 }; });
    this.input.on('pointermove', (p) => { if (p.isDown) this.target = { x: p.x, y: p.y - 30 }; });

    this.scores = [0, 0];
    this.over = false;
    this.stuckT = 0;       // how long the puck has sat still against a wall on the CPU side
    this.backOffT = 0;     // CPU retreating to let a pinned puck go
    this.thinkT = 0;
    this.aimOffset = 0;
    this.serve('me');
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
    this.scoreText.setText(`You ${this.scores[0]}  -  ${this.scores[1]} CPU   first to ${WIN_SCORE}`);
  }

  /** Put the puck on one side to restart play: 'me' (bottom) or 'cpu' (top). */
  serve(side) {
    this.puck.x = WIDTH / 2; this.puck.y = MID_Y + (side === 'cpu' ? -60 : 60);
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
    if (Math.hypot(m.vx, m.vy) > 60) sfx('hit');
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

  /** Where will the puck cross row y (following side-wall bounces)? null if moving away. */
  predictX(y) {
    const p = this.puck;
    if (p.vy >= -5) return null;
    const t = (y - p.y) / p.vy;
    if (t < 0 || t > 3) return null;
    let x = p.x + p.vx * t * this.ai.read;
    const lo = R.x + PUCK_R; const hi = R.x + R.w - PUCK_R; const span = hi - lo;
    // Reflect off the side walls.
    let u = (x - lo) % (2 * span);
    if (u < 0) u += 2 * span;
    x = lo + (u > span ? 2 * span - u : u);
    return x;
  }

  cpuThink(dt) {
    const p = this.puck; const c = this.cpu;
    const homeY = R.y + 56;
    const minY = R.y + MALLET_R; const maxY = MID_Y - MALLET_R;
    let tx; let ty;
    // Re-decide the aim now and then (where in your goal it shoots).
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.6 + this.ai.react * 3;
      this.aimOffset = (Math.random() - 0.5) * GOAL_W * (0.4 + this.ai.aim * 3);
    }
    const inMyHalf = p.y < MID_Y - 4;
    if (this.backOffT > 0) {
      this.backOffT -= dt;
      tx = WIDTH / 2; ty = homeY;
    } else if (inMyHalf && p.vy < 260) {
      // Attack: line up behind the puck relative to the shot, then drive through it.
      const goal = { x: WIDTH / 2 + this.aimOffset, y: R.y + R.h + 40 };
      const reach = MALLET_R + PUCK_R + 6;
      let dir = norm(goal.x - p.x, goal.y - p.y);
      // Ideal spot is behind the puck; if that's off the table, use the nearest spot that is and
      // shoot from there at an angle (never toward our own back wall).
      const ax = Phaser.Math.Clamp(p.x - dir.x * reach, R.x + MALLET_R, R.x + R.w - MALLET_R);
      const ay = Phaser.Math.Clamp(p.y - dir.y * reach, minY, maxY);
      dir = norm(p.x - ax, p.y - ay);
      if (dir.y < 0.15) dir = norm(dir.x, 0.15);          // always push it forward a little
      const behind = (p.x - c.x) * dir.x + (p.y - c.y) * dir.y;
      const across = Math.abs((p.x - c.x) * dir.y - (p.y - c.y) * dir.x);
      const dist = Math.hypot(c.x - ax, c.y - ay);
      if (dist < 12 || (behind > 0 && across < PUCK_R)) {
        tx = p.x + dir.x * 40; ty = p.y + dir.y * 40;          // strike through it
      } else if (behind < 0 && across < MALLET_R + PUCK_R) {
        // We're on the wrong side of the puck: go around it, not through it.
        const side = c.x < p.x ? -1 : 1;
        tx = p.x + side * (reach + 6); ty = p.y - 10;
      } else { tx = ax; ty = ay; }
    } else {
      // Defend: stand between the puck and the goal, predicting where it will arrive.
      const px = this.predictX(homeY);
      tx = px === null ? WIDTH / 2 + (p.x - WIDTH / 2) * 0.35 : WIDTH / 2 + (px - WIDTH / 2) * 0.9;
      ty = homeY;
    }
    this.moveMallet(c, tx, ty, this.ai.speed, dt, minY, maxY);
  }

  /** A puck sitting still against a wall gets a puff of table air; the CPU backs off if it pinned it. */
  unstick(dt) {
    const p = this.puck;
    const nearWall = p.x < R.x + PUCK_R + 4 || p.x > R.x + R.w - PUCK_R - 4 || p.y < R.y + PUCK_R + 4 || p.y > R.y + R.h - PUCK_R - 4;
    const slow = Math.hypot(p.vx, p.vy) < 40;
    const pinned = nearWall || Math.hypot(p.x - this.cpu.x, p.y - this.cpu.y) < PUCK_R + MALLET_R + 3;
    // Pinned on any wall: free it quickly. Idle anywhere on the CPU's side: the CPU has 2s to play it.
    if (slow && (pinned || p.y < MID_Y)) this.stuckT += dt * (pinned ? 1 : 0.6);
    else this.stuckT = 0;
    if (this.stuckT > 1.2) {
      this.stuckT = 0;
      if (p.y < MID_Y) this.backOffT = 0.7;
      const d = norm(WIDTH / 2 - p.x, MID_Y - p.y);
      p.vx += d.x * 140; p.vy += d.y * 140;
    }
  }

  update(_, deltaMs) {
    if (this.over) return;
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    this.moveMallet(this.me, this.target.x, this.target.y, 1600, dt, MID_Y + MALLET_R, R.y + R.h - MALLET_R);
    this.cpuThink(dt);
    this.unstick(dt);

    if (this.frozen > 0) this.frozen -= dt;
    else {
      // Sub-step the puck so fast shots don't tunnel through mallets.
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const p = this.puck;
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        this.collide(this.me); this.collide(this.cpu);
        if (p.x < R.x + PUCK_R) { p.x = R.x + PUCK_R; if (p.vx < -80) sfx('bounce'); p.vx = Math.abs(p.vx) * 0.9; }
        if (p.x > R.x + R.w - PUCK_R) { p.x = R.x + R.w - PUCK_R; if (p.vx > 80) sfx('bounce'); p.vx = -Math.abs(p.vx) * 0.9; }
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
    sfx(scorer === 0 ? 'goal' : 'lose');
    this.updateScore();
    this.cameras.main.flash(150, scorer === 0 ? 90 : 161, scorer === 0 ? 90 : 61, scorer === 0 ? 150 : 59);
    toast(this, scorer === 0 ? 'GOAL!' : 'CPU scores', MID_Y);
    if (this.scores[scorer] >= WIN_SCORE) {
      this.over = true;
      const won = scorer === 0;
      if (won && this.scores[1] === 0) earn('airhockey-shutout');
      endGame(this, {
        id: 'airhockey', mode: 'cpu', title: won ? 'You win!' : 'CPU wins',
        lines: [`${this.scores[0]} - ${this.scores[1]}`], outcome: won ? 'w' : 'l',
        margin: Math.abs(this.scores[0] - this.scores[1]) / WIN_SCORE,
        onAgain: () => this.scene.restart({}),
      });
      return;
    }
    // As in real air hockey, the player who conceded gets the puck.
    this.serve(scorer === 0 ? 'cpu' : 'me');
  }
}

function norm(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
