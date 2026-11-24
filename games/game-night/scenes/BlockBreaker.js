import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { getBest, submitBest } from '../save.js';

const F = { x: 20, y: 96, w: WIDTH - 40, h: 500 };
const BW = 32; const BH = 16;           // brick = 16x8 sprite at x2
const COLS = 10;
const PADDLE_Y = F.y + F.h - 30;
const BALL_R = 6;

// Level layouts: one string per row, one char per brick.  g green(1)  o orange(1)  r red(2)  l lavender(3)  . empty
const LEVELS = [
  ['gggggggggg', 'oooooooooo', 'rrrrrrrrrr', 'llllllllll'],
  ['l........l', 'rr......rr', 'ooo....ooo', 'gggg..gggg', 'oooooooooo', 'rrrrrrrrrr'],
  ['..llllll..', '.lrrrrrrl.', 'lroooooorl', 'lrog..gorl', 'lroooooorl', '.lrrrrrrl.', '..llllll..'],
  ['rgrgrgrgrg', 'grgrgrgrgr', 'oooooooooo', 'l.l.l.l.l.', '.l.l.l.l.l', 'gggggggggg', 'rrrrrrrrrr'],
  ['llllllllll', 'l........l', 'l.rrrrrr.l', 'l.roooor.l', 'l.rogggr.l', 'l.roooor.l', 'l.rrrrrr.l', 'llllllllll'],
];
const KIND = { g: ['green', 1, 10], o: ['orange', 1, 20], r: ['red', 2, 40], l: ['lavender', 3, 60] };

export class BlockBreaker extends Phaser.Scene {
  constructor() { super('BlockBreaker'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.ink);
    header(this, 'Block Breaker', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 72, '', { color: PALETTE.cream });
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.indigo)).fillRect(F.x - 6, F.y - 6, F.w + 12, F.h + 12);
    g.fillStyle(hex(PALETTE.ink)).fillRect(F.x, F.y, F.w, F.h + 6);
    for (let x = F.x + 16; x < F.x + F.w; x += 32) for (let y = F.y + 16; y < F.y + F.h; y += 32) g.fillStyle(hex(PALETTE.night)).fillRect(x, y, 2, 2);
    this.hint = text(this, WIDTH / 2, F.y + F.h - 90, 'Drag to move - tap to launch', { color: PALETTE.lavender });

    this.paddle = { x: WIDTH / 2, w: 72, img: this.add.image(WIDTH / 2, PADDLE_Y, 'blocks', 'paddle').setScale(3) };
    this.bricks = [];
    this.balls = [];
    this.drops = [];
    this.score = 0; this.lives = 3; this.level = 0; this.over = false;

    this.input.on('pointermove', (p) => { if (p.isDown) this.dragTo(p); });
    this.input.on('pointerdown', (p) => { this.dragStart = { px: p.x, x: this.paddle.x }; });
    this.input.on('pointerup', () => { if (this.balls.some((b) => b.stuck)) this.launch(); });

    this.loadLevel(0);
  }

  dragTo(p) {
    if (!this.dragStart) return;
    // Relative drag: the paddle moves with your finger without jumping under it.
    this.paddle.x = Phaser.Math.Clamp(this.dragStart.x + (p.x - this.dragStart.px) * 1.3, F.x + this.paddle.w / 2, F.x + F.w - this.paddle.w / 2);
  }

  loadLevel(i) {
    this.level = i;
    this.bricks.forEach((b) => b.img.destroy());
    this.bricks = [];
    const rows = LEVELS[i % LEVELS.length];
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        const [frame, hp, pts] = KIND[ch];
        const x = F.x + c * BW + BW / 2; const y = F.y + 40 + r * BH + BH / 2;
        this.bricks.push({ x, y, hp, maxHp: hp, pts, img: this.add.image(x, y, 'blocks', frame).setScale(2) });
      });
    });
    this.speed = 330 + (i * 25);
    this.resetBall();
    this.updateHud();
  }

  resetBall() {
    this.balls.forEach((b) => b.img.destroy());
    this.balls = [this.newBall(this.paddle.x, PADDLE_Y - 16, 0, 0, true)];
    this.drops.forEach((d) => d.img.destroy()); this.drops = [];
    this.setPaddleWidth(72);
    this.hint.setVisible(true);
  }

  newBall(x, y, vx, vy, stuck = false) {
    return { x, y, vx, vy, stuck, img: this.add.image(x, y, 'blocks', 'ball').setScale(2).setDepth(5) };
  }

  launch() {
    for (const b of this.balls) if (b.stuck) {
      b.stuck = false;
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30) - 90);
      b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
    }
    this.hint.setVisible(false);
  }

  setPaddleWidth(w) {
    this.paddle.w = w;
    this.paddle.img.setScale(w / 24, 3);
  }

  updateHud() {
    this.hud.setText(`Score ${this.score}   Lives ${this.lives}   Lv ${this.level + 1}   Best ${Math.max(getBest('blockbreaker'), this.score)}`);
  }

  update(_, ms) {
    if (this.over) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    this.paddle.img.x = Math.round(this.paddle.x);

    for (const b of [...this.balls]) {
      if (b.stuck) { b.x = this.paddle.x; b.y = PADDLE_Y - 16; b.img.setPosition(b.x, b.y); continue; }
      const steps = 3;
      for (let s = 0; s < steps; s++) this.stepBall(b, dt / steps);
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      if (b.y > F.y + F.h + 20) { b.img.destroy(); this.balls.splice(this.balls.indexOf(b), 1); }
    }
    if (!this.balls.length) this.loseLife();

    // Power-up capsules
    for (const d of [...this.drops]) {
      d.y += 140 * dt; d.img.y = Math.round(d.y); d.label.y = Math.round(d.y);
      if (d.y > PADDLE_Y - 8 && d.y < PADDLE_Y + 10 && Math.abs(d.x - this.paddle.x) < this.paddle.w / 2 + 8) {
        this.applyPower(d.kind); d.img.destroy(); d.label.destroy(); this.drops.splice(this.drops.indexOf(d), 1);
      } else if (d.y > F.y + F.h) { d.img.destroy(); d.label.destroy(); this.drops.splice(this.drops.indexOf(d), 1); }
    }
  }

  stepBall(b, dt) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < F.x + BALL_R) { b.x = F.x + BALL_R; b.vx = Math.abs(b.vx); }
    if (b.x > F.x + F.w - BALL_R) { b.x = F.x + F.w - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y < F.y + BALL_R) { b.y = F.y + BALL_R; b.vy = Math.abs(b.vy); }
    // Paddle: bounce angle depends on where it hits.
    if (b.vy > 0 && b.y > PADDLE_Y - 12 && b.y < PADDLE_Y + 6 && Math.abs(b.x - this.paddle.x) < this.paddle.w / 2 + BALL_R) {
      const off = (b.x - this.paddle.x) / (this.paddle.w / 2);
      const a = Phaser.Math.DegToRad(-90 + off * 60);
      const sp = Math.min(Math.hypot(b.vx, b.vy) * 1.01, this.speed * 1.6);
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      b.y = PADDLE_Y - 12;
    }
    // Bricks
    for (const br of this.bricks) {
      if (Math.abs(b.x - br.x) > BW / 2 + BALL_R || Math.abs(b.y - br.y) > BH / 2 + BALL_R) continue;
      const ox = BW / 2 + BALL_R - Math.abs(b.x - br.x);
      const oy = BH / 2 + BALL_R - Math.abs(b.y - br.y);
      if (ox < oy) { b.vx = Math.sign(b.x - br.x) * Math.abs(b.vx); b.x += Math.sign(b.x - br.x) * ox; }
      else { b.vy = Math.sign(b.y - br.y) * Math.abs(b.vy); b.y += Math.sign(b.y - br.y) * oy; }
      this.hitBrick(br);
      break;
    }
  }

  hitBrick(br) {
    br.hp--;
    if (br.hp > 0) { br.img.setAlpha(0.45 + 0.55 * (br.hp / br.maxHp)); return; }
    this.score += br.pts;
    br.img.destroy();
    this.bricks.splice(this.bricks.indexOf(br), 1);
    if (Math.random() < 0.12) this.spawnDrop(br.x, br.y);
    this.updateHud();
    if (!this.bricks.length) {
      toast(this, `Level ${this.level + 1} clear!`, 360);
      this.time.delayedCall(800, () => this.loadLevel(this.level + 1));
    }
  }

  spawnDrop(x, y) {
    const kinds = [['W', PALETTE.leaf], ['M', PALETTE.orange], ['S', PALETTE.lavender]];
    const [kind, col] = kinds[Phaser.Math.Between(0, 2)];
    const img = this.add.rectangle(x, y, 26, 12, hex(col)).setStrokeStyle(2, hex(PALETTE.cream));
    const label = text(this, x, y, kind, { color: PALETTE.night });
    this.drops.push({ x, y, kind, img, label });
  }

  applyPower(kind) {
    if (kind === 'W') { this.setPaddleWidth(110); toast(this, 'Wide paddle!', 400); this.time.delayedCall(12000, () => this.setPaddleWidth(72)); }
    if (kind === 'M') {
      const extra = [];
      for (const b of this.balls) if (!b.stuck) {
        extra.push(this.newBall(b.x, b.y, -b.vx, b.vy), this.newBall(b.x, b.y, b.vx * 0.8, -Math.abs(b.vy)));
      }
      this.balls.push(...extra);
      toast(this, 'Multi-ball!', 400);
    }
    if (kind === 'S') { for (const b of this.balls) { b.vx *= 0.7; b.vy *= 0.7; } toast(this, 'Slow ball', 400); }
  }

  loseLife() {
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) { this.gameOver(); return; }
    toast(this, 'Ball lost!', 360);
    this.resetBall();
  }

  gameOver() {
    this.over = true;
    const isBest = submitBest('blockbreaker', this.score);
    this.time.delayedCall(400, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [`Score ${this.score}`, `Reached level ${this.level + 1}`], [
        ['Play again', () => { m.destroy(); this.scene.restart(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
