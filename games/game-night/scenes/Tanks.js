import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal, holdButton } from './common.js';
import { getBest, submitBest } from '../save.js';

// 13x13 maps.  . empty  B brick  S steel  G bush (drawn over tanks)  W water  E your base
const STAGES = [
  ['.............', '.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.B.B.BSB.B.B.', '.B.B.B.B.B.B.', '.....B.B.....', 'SS.BB...BB.SS',
    '.....B.B.....', '.B.B.BBB.B.B.', '.B.B.B.B.B.B.', '.B.B.....B.B.', '.....BBB.....', '.....BEB.....'],
  ['.............', '.GG.BBBBB.GG.', '.GG.B...B.GG.', '....B.S.B....', '.BB.......BB.', '.BB.WWWWW.BB.', '.....G.G.....',
    'SS.B.G.G.B.SS', '...B.....B...', '.B.BBB.BBB.B.', '.B.........B.', '.....BBB.....', '.....BEB.....'],
  ['.............', '.S.B.S.S.B.S.', '.S.B.....B.S.', '...B.BBB.B...', 'BBB..B.B..BBB', '.....B.B.....', '.WW.GGGGG.WW.',
    '.WW.GGGGG.WW.', '.....B.B.....', 'BB.SSB.BSS.BB', '.............', '.B...BBB...B.', '.B...BEB...B.'],
];
const TILE = 24;
const N = 13;
const OX = (WIDTH - TILE * N) / 2;
const OY = 92;
const SIZE = 20;                      // tank hit box
const DIRS = { up: [0, -1, 0], right: [1, 0, 90], down: [0, 1, 180], left: [-1, 0, 270] };
const SPAWNS = [0, 6, 12];
const PER_STAGE = 12;

export class Tanks extends Phaser.Scene {
  constructor() { super('Tanks'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Tank Battle', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 74, '', { color: PALETTE.cream });
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.indigo)).fillRect(OX - 6, OY - 6, TILE * N + 12, TILE * N + 12);
    g.fillStyle(hex(PALETTE.ink)).fillRect(OX, OY, TILE * N, TILE * N);
    this.tileLayer = this.add.container(0, 0).setDepth(2);
    this.bushLayer = this.add.container(0, 0).setDepth(20);

    // Controls
    const cy = 548;
    this.pad = {
      up: holdButton(this, 100, cy - 52, 60, 48, '^', { size: 32 }),
      down: holdButton(this, 100, cy + 52, 60, 48, 'v', { size: 32 }),
      left: holdButton(this, 36, cy, 60, 48, '<', { size: 32 }),
      right: holdButton(this, 164, cy, 60, 48, '>', { size: 32 }),
    };
    this.fireBtn = holdButton(this, 286, cy, 112, 96, 'FIRE', { fill: PALETTE.red, color: PALETTE.cream });

    this.score = 0; this.lives = 3; this.stage = 0; this.over = false;
    this.loadStage(0);
  }

  loadStage(i) {
    this.stage = i;
    this.map = STAGES[i % STAGES.length].map((r) => [...r]);
    this.enemiesLeft = PER_STAGE;
    this.enemies?.forEach((e) => e.img.destroy());
    this.bullets?.forEach((b) => b.img.destroy());
    this.enemies = []; this.bullets = [];
    this.spawnTimer = 1;
    this.drawTiles();
    this.spawnPlayer();
    this.updateHud();
    toast(this, `Stage ${i + 1}`, OY + 150);
  }

  drawTiles() {
    this.tileLayer.removeAll(true);
    this.bushLayer.removeAll(true);
    const frame = { B: 'brick', S: 'steel', W: 'water', E: 'base' };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const t = this.map[r][c];
        const x = OX + c * TILE + TILE / 2; const y = OY + r * TILE + TILE / 2;
        if (frame[t]) this.tileLayer.add(this.add.image(x, y, 'tanks', frame[t]).setScale(3));
        if (t === 'G') this.bushLayer.add(this.add.image(x, y, 'tanks', 'bush').setScale(3).setAlpha(0.95));
      }
    }
  }

  spawnPlayer() {
    this.player?.img.destroy();
    this.player = this.makeTank(OX + 4 * TILE + TILE / 2, OY + 12 * TILE + TILE / 2, 'p', 'up');
    this.player.shield = 2.5;
  }

  makeTank(x, y, kind, dir) {
    const frames = { p: ['p1', 'p2'], g: ['g1', 'g2'], w: ['w1', 'w2'], r: ['r1', 'r2'] }[kind];
    const img = this.add.image(x, y, 'tanks', frames[0]).setScale(3).setDepth(10).setAngle(DIRS[dir][2]);
    return { x, y, dir, kind, frames, img, cool: 0, anim: 0, hp: kind === 'w' ? 2 : 1, thinkT: 0 };
  }

  updateHud() {
    this.hud.setText(`Stage ${this.stage + 1}  Lives ${this.lives}  Enemies ${this.enemiesLeft + this.enemies.length}  Score ${this.score}`);
  }

  solidAt(px, py, forBullet = false) {
    const c = Math.floor((px - OX) / TILE); const r = Math.floor((py - OY) / TILE);
    if (c < 0 || r < 0 || c >= N || r >= N) return 'edge';
    const t = this.map[r][c];
    if (t === 'B' || t === 'S' || t === 'E') return t;
    if (t === 'W' && !forBullet) return t;
    return null;
  }

  canOccupy(tank, x, y) {
    const h = SIZE / 2;
    for (const [dx, dy] of [[-h, -h], [h - 1, -h], [-h, h - 1], [h - 1, h - 1], [0, -h], [0, h - 1], [-h, 0], [h - 1, 0]]) {
      if (this.solidAt(x + dx, y + dy)) return false;
    }
    for (const o of [this.player, ...this.enemies]) {
      if (!o || o === tank || o.dead) continue;
      if (Math.abs(o.x - x) < SIZE && Math.abs(o.y - y) < SIZE && Math.hypot(o.x - x, o.y - y) < Math.hypot(o.x - tank.x, o.y - tank.y)) return false;
    }
    return true;
  }

  drive(t, dir, speed, dt) {
    if (dir !== t.dir) {
      // Turning: snap to the half-tile grid so tanks slide into corridors.
      const half = TILE / 2;
      if (DIRS[dir][0] !== 0) t.y = OY + Math.round((t.y - OY) / half) * half;
      else t.x = OX + Math.round((t.x - OX) / half) * half;
      t.dir = dir;
      t.img.setAngle(DIRS[dir][2]);
    }
    const [dx, dy] = DIRS[dir];
    const nx = t.x + dx * speed * dt; const ny = t.y + dy * speed * dt;
    t.anim += dt;
    t.img.setFrame(t.frames[Math.floor(t.anim * 10) % 2]);
    if (this.canOccupy(t, nx, ny)) { t.x = nx; t.y = ny; return true; }
    return false;
  }

  fire(t) {
    if (t.cool > 0) return;
    const mine = this.bullets.filter((b) => b.owner === t).length;
    if (mine >= 1) return;
    t.cool = t === this.player ? 0.35 : 1.2;
    const [dx, dy] = DIRS[t.dir];
    const img = this.add.image(t.x + dx * 14, t.y + dy * 14, 'tanks', 'bullet').setScale(3).setDepth(15).setAngle(DIRS[t.dir][2]);
    this.bullets.push({ x: img.x, y: img.y, dx, dy, owner: t, img, speed: t === this.player ? 260 : 200 });
  }

  update(_, ms) {
    if (this.over) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    const p = this.player;
    if (p && !p.dead) {
      if (p.shield > 0) { p.shield -= dt; p.img.setAlpha(Math.floor(p.shield * 10) % 2 ? 0.5 : 1); } else p.img.setAlpha(1);
      const dir = ['up', 'down', 'left', 'right'].find((d) => this.pad[d].isDown);
      if (dir) this.drive(p, dir, 72, dt);
      p.cool -= dt;
      if (this.fireBtn.isDown) this.fire(p);
      p.img.setPosition(Math.round(p.x), Math.round(p.y));
    }

    // Enemy spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemiesLeft > 0 && this.enemies.length < 4) {
      const col = SPAWNS[(PER_STAGE - this.enemiesLeft) % 3];
      const x = OX + col * TILE + TILE / 2; const y = OY + TILE / 2;
      const kinds = ['g', 'g', 'w', 'r'];
      const e = this.makeTank(x, y, kinds[(PER_STAGE - this.enemiesLeft) % 4], 'down');
      if (this.canOccupy(e, x, y)) { this.enemies.push(e); this.enemiesLeft--; this.spawnTimer = 2.6 - Math.min(1.2, this.stage * 0.2); this.updateHud(); }
      else { e.img.destroy(); this.spawnTimer = 0.5; }
    }

    // Enemy AI: roll forward, turn when blocked or on a whim (leaning toward your base), shoot often.
    for (const e of this.enemies) {
      const speed = (e.kind === 'r' ? 70 : 48) + this.stage * 4;
      e.thinkT -= dt;
      const moved = this.drive(e, e.dir, speed, dt);
      if (!moved || e.thinkT <= 0) {
        e.thinkT = Phaser.Math.FloatBetween(0.8, 2.6);
        const r = Math.random();
        const toBase = e.x < WIDTH / 2 - 10 ? 'right' : e.x > WIDTH / 2 + 10 ? 'left' : 'down';
        e.dir = r < 0.45 ? 'down' : r < 0.65 ? toBase : Phaser.Utils.Array.GetRandom(['left', 'right', 'up', 'down']);
        e.img.setAngle(DIRS[e.dir][2]);
      }
      e.cool -= dt;
      if (Math.random() < dt * 0.9) this.fire(e);
      e.img.setPosition(Math.round(e.x), Math.round(e.y));
    }

    this.moveBullets(dt);
  }

  moveBullets(dt) {
    for (const b of [...this.bullets]) {
      b.x += b.dx * b.speed * dt; b.y += b.dy * b.speed * dt;
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      const hit = this.solidAt(b.x, b.y, true);
      if (hit) {
        if (hit === 'B') this.breakAt(b.x, b.y);
        if (hit === 'E') { this.removeBullet(b); this.baseDestroyed(); return; }
        this.boom(b.x, b.y, 'small');
        this.removeBullet(b);
        continue;
      }
      // Bullets cancel each other out.
      const other = this.bullets.find((o) => o !== b && (o.owner === this.player) !== (b.owner === this.player) && Math.hypot(o.x - b.x, o.y - b.y) < 8);
      if (other) { this.removeBullet(b); this.removeBullet(other); continue; }
      if (b.owner === this.player) {
        const e = this.enemies.find((t) => Math.abs(t.x - b.x) < SIZE / 2 + 2 && Math.abs(t.y - b.y) < SIZE / 2 + 2);
        if (e) {
          this.removeBullet(b);
          e.hp--;
          if (e.hp <= 0) this.killEnemy(e); else e.img.setTint(0xffaaaa);
        }
      } else if (this.player && !this.player.dead && Math.abs(this.player.x - b.x) < SIZE / 2 + 2 && Math.abs(this.player.y - b.y) < SIZE / 2 + 2) {
        this.removeBullet(b);
        if (this.player.shield <= 0) this.killPlayer();
      }
    }
  }

  breakAt(x, y) {
    const c = Math.floor((x - OX) / TILE); const r = Math.floor((y - OY) / TILE);
    this.map[r][c] = '.';
    this.drawTiles();
  }

  removeBullet(b) { b.img.destroy(); const i = this.bullets.indexOf(b); if (i >= 0) this.bullets.splice(i, 1); }

  boom(x, y, size) {
    const frames = size === 'big' ? ['ex1', 'ex2', 'ex3', 'ex4'] : ['ex1', 'ex2'];
    const img = this.add.image(x, y, 'tanks', frames[0]).setScale(3).setDepth(30);
    frames.forEach((f, k) => this.time.delayedCall(k * 70, () => img.setFrame(f)));
    this.time.delayedCall(frames.length * 70, () => img.destroy());
  }

  killEnemy(e) {
    this.boom(e.x, e.y, 'big');
    e.img.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.score += e.kind === 'w' ? 200 : e.kind === 'r' ? 150 : 100;
    this.updateHud();
    if (!this.enemies.length && this.enemiesLeft === 0) {
      this.score += 500;
      this.time.delayedCall(1200, () => { if (!this.over) this.loadStage(this.stage + 1); });
    }
  }

  killPlayer() {
    const p = this.player;
    p.dead = true;
    this.boom(p.x, p.y, 'big');
    p.img.setVisible(false);
    this.cameras.main.shake(200, 0.01);
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) { this.gameOver('Out of tanks'); return; }
    this.time.delayedCall(1200, () => this.spawnPlayer());
  }

  baseDestroyed() {
    this.boom(OX + 6 * TILE + TILE / 2, OY + 12 * TILE + TILE / 2, 'big');
    this.gameOver('Your base was destroyed');
  }

  gameOver(why) {
    if (this.over) return;
    this.over = true;
    const isBest = submitBest('tanks', this.score);
    this.time.delayedCall(800, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [why, `Score ${this.score}  Stage ${this.stage + 1}`], [
        ['Play again', () => { m.destroy(); this.scene.restart(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
