import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal, holdButton } from './common.js';
import { getBest, submitBest } from '../save.js';

const F = { x: 0, y: 64, w: WIDTH, h: 468 };
const SIZES = {
  big: { frame: 'rockL', r: 30, scale: 2.5, pts: 20, next: 'mid', speed: [30, 60] },
  mid: { frame: 'rockM', r: 18, scale: 2.5, pts: 50, next: 'small', speed: [50, 90] },
  small: { frame: 'rockS', r: 9, scale: 2.5, pts: 100, next: null, speed: [70, 120] },
};

export class SpaceRocks extends Phaser.Scene {
  constructor() { super('SpaceRocks'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.ink);
    header(this, 'Space Rocks', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 72, '', { color: PALETTE.cream }).setDepth(30);
    // Starfield
    const g = this.add.graphics();
    for (let k = 0; k < 70; k++) {
      g.fillStyle(hex(k % 3 ? PALETTE.indigo : PALETTE.lavender)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(F.y, F.y + F.h), 2, 2);
    }
    g.fillStyle(hex(PALETTE.indigo)).fillRect(0, F.y + F.h, WIDTH, 2);

    // Controls: rotate on the left thumb, thrust + fire on the right.
    const by = 584;
    this.btnL = holdButton(this, 50, by, 76, 72, '<', { size: 32 });
    this.btnR = holdButton(this, 134, by, 76, 72, '>', { size: 32 });
    this.btnThrust = holdButton(this, 226, by, 76, 72, 'Go');
    this.btnFire = holdButton(this, 310, by, 76, 72, 'Fire', { fill: PALETTE.gold });

    this.ship = { x: WIDTH / 2, y: F.y + F.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, img: this.add.image(0, 0, 'rocks', 'ship').setScale(3).setDepth(10), invuln: 2 };
    this.flame = this.add.image(0, 0, 'rocks', 'flame1').setScale(3).setDepth(9).setVisible(false);
    this.bullets = [];
    this.rocks = [];
    this.score = 0; this.lives = 3; this.wave = 0; this.over = false; this.cooldown = 0;
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const n = 2 + this.wave;
    for (let k = 0; k < n; k++) {
      // Spawn along the edges, away from the ship.
      let x; let y;
      do { x = Phaser.Math.Between(0, WIDTH); y = Phaser.Math.Between(F.y, F.y + F.h); } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 140);
      this.spawnRock('big', x, y);
    }
    this.updateHud();
    if (this.wave > 1) toast(this, `Wave ${this.wave}`, F.y + 60);
  }

  spawnRock(size, x, y) {
    const s = SIZES[size];
    const a = Math.random() * Math.PI * 2;
    const sp = Phaser.Math.Between(...s.speed) * (1 + (this.wave - 1) * 0.08);
    const img = this.add.image(x, y, 'rocks', s.frame).setScale(s.scale).setDepth(5);
    this.rocks.push({ size, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: Phaser.Math.FloatBetween(-1.5, 1.5), img, r: s.r });
  }

  wrap(o) {
    if (o.x < -10) o.x += WIDTH + 20;
    if (o.x > WIDTH + 10) o.x -= WIDTH + 20;
    if (o.y < F.y - 10) o.y += F.h + 20;
    if (o.y > F.y + F.h + 10) o.y -= F.h + 20;
  }

  updateHud() {
    this.hud.setText(`Score ${this.score}   Ships ${this.lives}   Wave ${this.wave}   Best ${Math.max(getBest('spacerocks'), this.score)}`);
  }

  update(time, ms) {
    if (this.over) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    const s = this.ship;
    if (s.alive !== false) {
      if (this.btnL.isDown) s.a -= 4.2 * dt;
      if (this.btnR.isDown) s.a += 4.2 * dt;
      const thrust = this.btnThrust.isDown;
      if (thrust) { s.vx += Math.cos(s.a) * 260 * dt; s.vy += Math.sin(s.a) * 260 * dt; }
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 320) { s.vx *= 320 / sp; s.vy *= 320 / sp; }
      s.vx *= Math.pow(0.55, dt); s.vy *= Math.pow(0.55, dt);
      s.x += s.vx * dt; s.y += s.vy * dt;
      this.wrap(s);
      s.img.setPosition(Math.round(s.x), Math.round(s.y)).setRotation(s.a + Math.PI / 2);
      if (s.invuln > 0) { s.invuln -= dt; s.img.setAlpha(Math.floor(time / 100) % 2 ? 0.3 : 1); } else s.img.setAlpha(1);
      this.flame.setVisible(thrust).setFrame(Math.floor(time / 80) % 2 ? 'flame1' : 'flame2')
        .setPosition(s.x - Math.cos(s.a) * 18, s.y - Math.sin(s.a) * 18).setRotation(s.a + Math.PI / 2);
      this.cooldown -= dt;
      if (this.btnFire.isDown && this.cooldown <= 0 && this.bullets.length < 6) {
        this.cooldown = 0.22;
        const b = this.add.rectangle(s.x + Math.cos(s.a) * 14, s.y + Math.sin(s.a) * 14, 4, 4, hex(PALETTE.gold)).setDepth(8);
        this.bullets.push({ x: b.x, y: b.y, vx: Math.cos(s.a) * 480 + s.vx, vy: Math.sin(s.a) * 480 + s.vy, life: 0.9, img: b });
      }
    }
    for (const b of [...this.bullets]) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      this.wrap(b);
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      if (b.life <= 0) this.removeBullet(b);
    }
    for (const r of [...this.rocks]) {
      r.x += r.vx * dt; r.y += r.vy * dt; this.wrap(r);
      r.img.setPosition(Math.round(r.x), Math.round(r.y)).setRotation(r.img.rotation + r.spin * dt);
      for (const b of [...this.bullets]) {
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) { this.removeBullet(b); this.breakRock(r); break; }
      }
      if (this.rocks.includes(r) && s.alive !== false && s.invuln <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 9) this.crash();
    }
  }

  removeBullet(b) { b.img.destroy(); this.bullets.splice(this.bullets.indexOf(b), 1); }

  breakRock(r) {
    const s = SIZES[r.size];
    this.score += s.pts;
    r.img.destroy();
    this.rocks.splice(this.rocks.indexOf(r), 1);
    this.burst(r.x, r.y, PALETTE.lavender);
    if (s.next) { this.spawnRock(s.next, r.x, r.y); this.spawnRock(s.next, r.x, r.y); }
    this.updateHud();
    if (!this.rocks.length) this.time.delayedCall(1000, () => { if (!this.over) this.nextWave(); });
  }

  burst(x, y, color) {
    for (let k = 0; k < 8; k++) {
      const p = this.add.rectangle(x, y, 3, 3, hex(color)).setDepth(7);
      const a = (k / 8) * Math.PI * 2;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26, alpha: 0, duration: 350, onComplete: () => p.destroy() });
    }
  }

  crash() {
    const s = this.ship;
    s.alive = false;
    s.img.setVisible(false); this.flame.setVisible(false);
    this.burst(s.x, s.y, PALETTE.orange);
    this.cameras.main.shake(200, 0.01);
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) { this.gameOver(); return; }
    this.time.delayedCall(1200, () => {
      Object.assign(s, { x: WIDTH / 2, y: F.y + F.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, invuln: 2.5, alive: true });
      s.img.setVisible(true);
    });
  }

  gameOver() {
    this.over = true;
    const isBest = submitBest('spacerocks', this.score);
    this.time.delayedCall(700, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [`Score ${this.score}`, `Wave ${this.wave}`], [
        ['Play again', () => { m.destroy(); this.scene.restart(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
