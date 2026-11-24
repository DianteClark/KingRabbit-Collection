import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal, holdButton } from './common.js';
import { getBest, submitBest } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';
import { getSkill, tune, reportResult } from '../adaptive.js';

const F = { x: 0, y: 64, w: WIDTH, h: 468 };
const SIZES = {
  big: { frame: 'rockL', r: 30, scale: 2.5, pts: 20, next: 'mid', speed: [30, 60] },
  mid: { frame: 'rockM', r: 18, scale: 2.5, pts: 50, next: 'small', speed: [50, 90] },
  small: { frame: 'rockS', r: 9, scale: 2.5, pts: 100, next: null, speed: [70, 120] },
};
// Adapts to you: rock speed, how often the saucer shows up and how well it aims.
const PRESETS = {
  easy: { rockSpeed: 0.8, ufoEvery: 34, ufoAim: 0.55 },
  normal: { rockSpeed: 1, ufoEvery: 24, ufoAim: 0.28 },
  hard: { rockSpeed: 1.3, ufoEvery: 15, ufoAim: 0.08 },
};
const EXTRA_LIFE = 10000;

export class SpaceRocks extends Phaser.Scene {
  constructor() { super('SpaceRocks'); }

  init() {
    this.mode = 'solo';
    this.cfg = tune(PRESETS, getSkill('spacerocks'));
  }

  create() {
    setBackground(this, PALETTE.ink);
    header(this, 'Space Rocks', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 72, '', { color: PALETTE.cream }).setDepth(30);
    // Two layers of stars that drift for a bit of depth.
    this.stars = [];
    for (let k = 0; k < 70; k++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(F.y, F.y + F.h), 2, 2, hex(k % 3 ? PALETTE.indigo : PALETTE.lavender));
      s.speed = k % 3 ? 4 : 10;
      this.stars.push(s);
    }
    this.add.rectangle(WIDTH / 2, F.y + F.h + 1, WIDTH, 2, hex(PALETTE.indigo));

    const by = 584;
    this.btnL = holdButton(this, 50, by, 76, 72, '<', { size: 32 });
    this.btnR = holdButton(this, 134, by, 76, 72, '>', { size: 32 });
    this.btnThrust = holdButton(this, 226, by, 76, 72, 'Go');
    this.btnFire = holdButton(this, 310, by, 76, 72, 'Fire', { fill: PALETTE.gold });

    this.ship = { x: WIDTH / 2, y: F.y + F.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, img: this.add.image(0, 0, 'rocks', 'player').setScale(3).setDepth(10), invuln: 2, alive: true };
    this.flame = this.add.image(0, 0, 'rocks', 'flame1').setScale(3).setDepth(9).setVisible(false);
    this.bullets = [];
    this.rocks = [];
    this.ufo = null;
    this.ufoTimer = this.cfg.ufoEvery;
    this.score = 0; this.lives = 3; this.wave = 0; this.over = false; this.cooldown = 0; this.nextLife = EXTRA_LIFE;
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const n = 2 + this.wave;
    for (let k = 0; k < n; k++) {
      let x; let y;
      do { x = Phaser.Math.Between(0, WIDTH); y = Phaser.Math.Between(F.y, F.y + F.h); } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 140);
      this.spawnRock('big', x, y);
    }
    this.updateHud();
    if (this.wave > 1) { toast(this, `Wave ${this.wave}`, F.y + 60); sfx('power'); }
  }

  spawnRock(size, x, y) {
    const s = SIZES[size];
    const a = Math.random() * Math.PI * 2;
    const sp = Phaser.Math.Between(...s.speed) * (1 + (this.wave - 1) * 0.07) * this.cfg.rockSpeed;
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

  addScore(n) {
    this.score += n;
    if (this.score >= this.nextLife) {
      this.nextLife += EXTRA_LIFE;
      this.lives++;
      toast(this, 'Extra ship!', F.y + 90);
      sfx('coin');
    }
    this.updateHud();
  }

  update(time, ms) {
    if (this.over) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    for (const st of this.stars) { st.y += st.speed * dt; if (st.y > F.y + F.h) st.y = F.y; }
    const s = this.ship;
    if (s.alive) {
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
      if (this.btnFire.isDown && this.cooldown <= 0 && this.bullets.filter((b) => !b.enemy).length < 6) {
        this.cooldown = 0.2;
        this.shoot(s.x + Math.cos(s.a) * 14, s.y + Math.sin(s.a) * 14, s.a, 480, false, s.vx, s.vy);
        sfx('shoot');
      }
    }
    this.updateUfo(dt);
    for (const b of [...this.bullets]) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      this.wrap(b);
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      if (b.life <= 0) { this.removeBullet(b); continue; }
      if (b.enemy && s.alive && s.invuln <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < 11) { this.removeBullet(b); this.crash(); continue; }
      if (!b.enemy && this.ufo && Math.hypot(b.x - this.ufo.x, b.y - this.ufo.y) < 14) { this.removeBullet(b); this.killUfo(); }
    }
    for (const r of [...this.rocks]) {
      r.x += r.vx * dt; r.y += r.vy * dt; this.wrap(r);
      r.img.setPosition(Math.round(r.x), Math.round(r.y)).setRotation(r.img.rotation + r.spin * dt);
      for (const b of [...this.bullets]) {
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) { this.removeBullet(b); this.breakRock(r, !b.enemy); break; }
      }
      if (this.rocks.includes(r) && s.alive && s.invuln <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 9) this.crash();
    }
  }

  shoot(x, y, a, speed, enemy, vx = 0, vy = 0) {
    const img = this.add.rectangle(x, y, 4, 4, hex(enemy ? PALETTE.red : PALETTE.gold)).setDepth(8);
    this.bullets.push({ x, y, vx: Math.cos(a) * speed + vx, vy: Math.sin(a) * speed + vy, life: enemy ? 1.6 : 0.9, img, enemy });
  }

  // ---------- flying saucer ----------
  updateUfo(dt) {
    if (!this.ufo) {
      this.ufoTimer -= dt;
      if (this.ufoTimer <= 0 && this.wave >= 2) {
        const left = Math.random() < 0.5;
        const y = Phaser.Math.Between(F.y + 40, F.y + F.h - 40);
        this.ufo = { x: left ? -10 : WIDTH + 10, y, vx: left ? 70 : -70, t: 0, fire: 1.2, img: this.add.image(0, y, 'rocks', 'ufo').setScale(3).setDepth(9) };
        sfx('error');
      }
      return;
    }
    const u = this.ufo;
    u.t += dt; u.x += u.vx * dt; u.y += Math.sin(u.t * 2) * 30 * dt;
    u.img.setPosition(Math.round(u.x), Math.round(u.y));
    u.fire -= dt;
    if (u.fire <= 0 && this.ship.alive) {
      u.fire = 1.4;
      // Aim at the ship, with an error that shrinks as the CPU level rises.
      const a = Math.atan2(this.ship.y - u.y, this.ship.x - u.x) + (Math.random() - 0.5) * 2 * this.cfg.ufoAim;
      this.shoot(u.x, u.y, a, 220, true);
    }
    if (u.x < -20 || u.x > WIDTH + 20) { u.img.destroy(); this.ufo = null; this.ufoTimer = this.cfg.ufoEvery; }
  }

  killUfo() {
    this.burst(this.ufo.x, this.ufo.y, PALETTE.red);
    sfx('boom');
    this.ufo.img.destroy(); this.ufo = null;
    this.ufoTimer = this.cfg.ufoEvery;
    toast(this, '+1000', F.y + 90);
    this.addScore(1000);
  }

  removeBullet(b) { b.img.destroy(); const i = this.bullets.indexOf(b); if (i >= 0) this.bullets.splice(i, 1); }

  breakRock(r, byPlayer) {
    const s = SIZES[r.size];
    if (byPlayer) this.addScore(s.pts);
    r.img.destroy();
    this.rocks.splice(this.rocks.indexOf(r), 1);
    this.burst(r.x, r.y, PALETTE.lavender);
    sfx(r.size === 'small' ? 'hit' : 'smallBoom');
    if (s.next) { this.spawnRock(s.next, r.x, r.y); this.spawnRock(s.next, r.x, r.y); }
    if (!this.rocks.length) this.time.delayedCall(1000, () => { if (!this.over && !this.rocks.length) this.nextWave(); });
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
    sfx('boom');
    this.cameras.main.shake(200, 0.01);
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) { this.gameOver(); return; }
    this.respawnWhenClear();
  }

  /** Respawn in the middle, but only once no rock is about to hit that spot. */
  respawnWhenClear(waited = 0) {
    this.time.delayedCall(waited ? 250 : 1200, () => {
      if (this.over) return;
      const cx = WIDTH / 2; const cy = F.y + F.h / 2;
      const clear = this.rocks.every((r) => Math.hypot(r.x - cx, r.y - cy) > r.r + 60);
      if (!clear && waited < 12) { this.respawnWhenClear(waited + 1); return; }
      Object.assign(this.ship, { x: cx, y: cy, vx: 0, vy: 0, a: -Math.PI / 2, invuln: 2.5, alive: true });
      this.ship.img.setVisible(true);
    });
  }

  gameOver() {
    this.over = true;
    sfx('lose');
    const isBest = submitBest('spacerocks', this.score);
    // Reaching wave 4 counts as a strong game: the rocks speed up next time.
    reportResult('spacerocks', Math.min(1, (this.wave - 1) / 3), 0.5);
    this.time.delayedCall(700, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [`Score ${this.score}`, `Wave ${this.wave}`], [
        ['Play again', () => { m.destroy(); this.scene.restart(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
