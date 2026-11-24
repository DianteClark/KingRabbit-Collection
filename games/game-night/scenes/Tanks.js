import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal, holdButton } from './common.js';
import { getBest, submitBest } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';
import { getSkill, tune, reportResult } from '../adaptive.js';

// 13x13 maps.  . empty  B brick  S steel  G bush (drawn over tanks)  W water  E your flag
const STAGES = [
  ['.............', '.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.B.B.BSB.B.B.', '.B.B.B.B.B.B.', '.....B.B.....', 'SS.BB...BB.SS',
    '.....B.B.....', '.B.B.BBB.B.B.', '.B.B.B.B.B.B.', '.B.B.....B.B.', '.....BBB.....', '.....BEB.....'],
  ['.............', '.GG.BBBBB.GG.', '.GG.B...B.GG.', '....B.S.B....', '.BB.......BB.', '.BB.WWWWW.BB.', '.....G.G.....',
    'SS.B.G.G.B.SS', '...B.....B...', '.B.BBB.BBB.B.', '.B.........B.', '.....BBB.....', '.....BEB.....'],
  ['.............', '.S.B.S.S.B.S.', '.S.B.....B.S.', '...B.BBB.B...', 'BBB..B.B..BBB', '.....B.B.....', '.WW.GGGGG.WW.',
    '.WW.GGGGG.WW.', '.....B.B.....', 'BB.SSB.BSS.BB', '.............', '.B...BBB...B.', '.B...BEB...B.'],
  ['......S......', '.BBB.....BBB.', '.B.G..B..G.B.', '.B.GG.B.GG.B.', '...........S.', 'WW.BBSSSBB.WW', '.............',
    '.SBB.B.B.BBS.', '.....B.B.....', '.GGG.....GGG.', 'BBB.BB.BB.BBB', '.....BBB.....', '.....BEB.....'],
];
const TILE = 24;
const N = 13;
const OX = (WIDTH - TILE * N) / 2;
const OY = 92;
const SIZE = 20;                      // tank hit box
const DIRS = { up: [0, -1, 0], right: [1, 0, 90], down: [0, 1, 180], left: [-1, 0, 270] };
const SPAWNS = [0, 6, 12];
const BASE = { r: 12, c: 6 };
const BASE_WALL = [[11, 5], [11, 6], [11, 7], [12, 5], [12, 7]];

// Difficulty: enemies per stage, on screen at once, speed, reaction, how often they shoot on sight,
// and the share of enemies that go for your flag instead of roaming.
const LEVELS = {
  easy: { per: 8, onScreen: 3, speed: 40, think: 1.1, aim: 0.45, baseHunters: 0.15, playerHunters: 0.15, bullet: 170 },
  normal: { per: 12, onScreen: 4, speed: 50, think: 0.7, aim: 0.75, baseHunters: 0.35, playerHunters: 0.3, bullet: 200 },
  hard: { per: 16, onScreen: 5, speed: 60, think: 0.45, aim: 0.95, baseHunters: 0.45, playerHunters: 0.4, bullet: 240 },
};
const POWERS = ['shield', 'clock', 'shovel', 'star', 'grenade', 'life'];

export class Tanks extends Phaser.Scene {
  constructor() { super('Tanks'); }

  init(data) {
    this.mode = 'solo';
    this.cfg = tune(LEVELS, getSkill('tanks'), ['per', 'onScreen']);
  }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Tank Battle', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 74, '', { color: PALETTE.cream });
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.indigo)).fillRect(OX - 6, OY - 6, TILE * N + 12, TILE * N + 12);
    g.fillStyle(hex(PALETTE.ink)).fillRect(OX, OY, TILE * N, TILE * N);
    this.tileLayer = this.add.container(0, 0).setDepth(2);
    this.bushLayer = this.add.container(0, 0).setDepth(20);

    const cy = 548;
    this.pad = {
      up: holdButton(this, 100, cy - 52, 60, 48, '^', { size: 32 }),
      down: holdButton(this, 100, cy + 52, 60, 48, 'v', { size: 32 }),
      left: holdButton(this, 36, cy, 60, 48, '<', { size: 32 }),
      right: holdButton(this, 164, cy, 60, 48, '>', { size: 32 }),
    };
    this.fireBtn = holdButton(this, 286, cy, 112, 96, 'FIRE', { fill: PALETTE.red, color: PALETTE.cream });

    this.score = 0; this.lives = 3; this.stage = 0; this.over = false; this.star = 0;
    this.loadStage(0);
  }

  // ---------- stage ----------
  loadStage(i) {
    this.stage = i;
    this.map = STAGES[i % STAGES.length].map((r) => [...r]);
    this.enemiesLeft = this.cfg.per + Math.floor(i / STAGES.length) * 2;
    this.enemies?.forEach((e) => e.img.destroy());
    this.bullets?.forEach((b) => b.img.destroy());
    this.power?.img.destroy();
    this.enemies = []; this.bullets = []; this.power = null;
    this.spawned = 0; this.spawnTimer = 1; this.freezeT = 0; this.shovelT = 0;
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
    this.player.shield = 3;
  }

  makeTank(x, y, kind, dir) {
    const frames = { p: ['p1', 'p2'], g: ['g1', 'g2'], w: ['w1', 'w2'], r: ['r1', 'r2'] }[kind];
    const img = this.add.image(x, y, 'tanks', frames[0]).setScale(3).setDepth(10).setAngle(DIRS[dir][2]);
    return { x, y, dir, kind, frames, img, cool: 0, anim: 0, hp: kind === 'w' ? 2 : 1, thinkT: 0, plan: null };
  }

  updateHud() {
    const n = this.enemiesLeft + this.enemies.length;
    this.hud.setText(`Stage ${this.stage + 1}  Lives ${this.lives}  Enemies ${n}  Score ${this.score}`);
  }

  // ---------- map helpers ----------
  tileAt(px, py) {
    const c = Math.floor((px - OX) / TILE); const r = Math.floor((py - OY) / TILE);
    if (c < 0 || r < 0 || c >= N || r >= N) return { r, c, t: 'edge' };
    return { r, c, t: this.map[r][c] };
  }

  solidAt(px, py, forBullet = false) {
    const { t } = this.tileAt(px, py);
    if (t === 'edge' || t === 'B' || t === 'S' || t === 'E') return t;
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

  /** Cost-to-target for every tile (Dijkstra). Bricks cost extra: tanks can shoot through them. */
  distanceMap(tr, tc) {
    const dist = Array.from({ length: N }, () => new Array(N).fill(Infinity));
    dist[tr][tc] = 0;
    const open = [[0, tr, tc]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [d, r, c] = open.shift();
      if (d > dist[r][c]) continue;
      for (const [dc, dr] of Object.values(DIRS)) {
        const nr = r + dr; const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        const t = this.map[nr][nc];
        if (t === 'S' || t === 'W') continue;
        const nd = d + (t === 'B' ? 4 : 1);
        if (nd < dist[nr][nc]) { dist[nr][nc] = nd; open.push([nd, nr, nc]); }
      }
    }
    return dist;
  }

  // ---------- driving ----------
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
    const isPlayer = t === this.player;
    const max = isPlayer && this.star > 0 ? 2 : 1;
    if (this.bullets.filter((b) => b.owner === t).length >= max) return;
    t.cool = isPlayer ? (this.star > 0 ? 0.18 : 0.35) : 1.1;
    const [dx, dy] = DIRS[t.dir];
    const img = this.add.image(t.x + dx * 14, t.y + dy * 14, 'tanks', dx ? 'bulletH' : 'bullet').setScale(3).setDepth(15);
    if (dx < 0 || dy > 0) img.setFlip(dx < 0, dy > 0);
    const speed = isPlayer ? (this.star > 0 ? 340 : 270) : this.cfg.bullet;
    this.bullets.push({ x: img.x, y: img.y, dx, dy, owner: t, img, speed });
    if (isPlayer) sfx('shoot');
  }

  /** Does a shot fired from t right now travel to (tx,ty) without hitting steel first? */
  lineOfFire(t, tx, ty) {
    const [dx, dy] = DIRS[t.dir];
    if (dx && Math.abs(ty - t.y) > 10) return false;
    if (dy && Math.abs(tx - t.x) > 10) return false;
    if ((tx - t.x) * dx < 0 || (ty - t.y) * dy < 0) return false;
    const steps = Math.max(Math.abs(tx - t.x), Math.abs(ty - t.y)) / 6;
    for (let k = 1; k < steps; k++) {
      const hit = this.solidAt(t.x + dx * k * 6, t.y + dy * k * 6, true);
      if (hit === 'S' || hit === 'edge') return false;
    }
    return true;
  }

  // ---------- frame ----------
  update(time, ms) {
    if (this.over) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    if (this.star > 0) this.star -= dt;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.shovelT > 0) { this.shovelT -= dt; if (this.shovelT <= 0) this.setBaseWall('B'); }
    this.updatePlayer(dt);
    this.spawnEnemies(dt);
    if (this.freezeT <= 0) for (const e of this.enemies) this.updateEnemy(e, dt);
    else this.enemies.forEach((e) => e.img.setAlpha(Math.floor(time / 150) % 2 ? 0.6 : 1));
    this.moveBullets(dt);
    this.updatePower(time, dt);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p || p.dead) return;
    if (p.shield > 0) { p.shield -= dt; p.img.setAlpha(Math.floor(p.shield * 10) % 2 ? 0.5 : 1); } else p.img.setAlpha(1);
    const dir = ['up', 'down', 'left', 'right'].find((d) => this.pad[d].isDown);
    if (dir) this.drive(p, dir, 74, dt);
    p.cool -= dt;
    if (this.fireBtn.isDown) this.fire(p);
    p.img.setPosition(Math.round(p.x), Math.round(p.y));
  }

  spawnEnemies(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.enemiesLeft <= 0 || this.enemies.length >= this.cfg.onScreen) return;
    const col = SPAWNS[this.spawned % 3];
    const x = OX + col * TILE + TILE / 2; const y = OY + TILE / 2;
    const kinds = ['g', 'g', 'w', 'r'];
    const e = this.makeTank(x, y, kinds[this.spawned % 4], 'down');
    if (!this.canOccupy(e, x, y)) { e.img.destroy(); this.spawnTimer = 0.5; return; }
    // Give each enemy a job: hunt your flag, hunt you, or patrol.
    const roll = Math.random();
    e.role = roll < this.cfg.baseHunters ? 'base' : roll < this.cfg.baseHunters + this.cfg.playerHunters ? 'player' : 'patrol';
    if (e.kind === 'r' && e.role === 'patrol') e.role = 'player';
    e.carriesPower = this.spawned % 4 === 3;     // every 4th enemy drops a power-up
    if (e.carriesPower) e.img.setTint(0xffe080);
    this.enemies.push(e);
    this.enemiesLeft--;
    this.spawned++;
    this.spawnTimer = Math.max(1, 2.6 - this.stage * 0.2);
    this.sparkle(x, y);
    this.updateHud();
  }

  sparkle(x, y) {
    const img = this.add.image(x, y, 'tanks', 'spark1').setScale(3).setDepth(30);
    ['spark1', 'spark2', 'spark3', 'spark2'].forEach((f, k) => this.time.delayedCall(k * 80, () => img.setFrame(f)));
    this.time.delayedCall(330, () => img.destroy());
  }

  updateEnemy(e, dt) {
    const speed = (e.kind === 'r' ? this.cfg.speed * 1.4 : this.cfg.speed) + this.stage * 3;
    e.cool -= dt;
    e.thinkT -= dt;
    const cr = Math.floor((e.y - OY) / TILE); const cc = Math.floor((e.x - OX) / TILE);
    const cx = OX + cc * TILE + TILE / 2; const cy = OY + cr * TILE + TILE / 2;
    const centred = Math.abs(e.x - cx) < 3 && Math.abs(e.y - cy) < 3;
    // Re-plan at tile centres, when stuck, or every so often.
    if ((centred && e.thinkT <= 0) || e.stuck > 0.4 || !e.plan) {
      const [sdx, sdy] = DIRS[e.dir];
      const wasStuck = e.stuck > 0.4 && this.solidAt(e.x + sdx * 16, e.y + sdy * 16, true) !== 'B';   // bricks just get shot
      e.thinkT = this.cfg.think;
      e.stuck = 0;
      e.plan = this.plan(e, cr, cc);
      // Stuck twice in a row the same way (usually nose to nose with another tank): try another road.
      e.stuckN = wasStuck ? (e.stuckN || 0) + 1 : 0;
      if (e.stuckN >= 2) {
        const others = Object.keys(DIRS).filter((d) => d !== e.plan);
        e.plan = Phaser.Utils.Array.GetRandom(others);
        e.thinkT = this.cfg.think * 2;
        e.stuckN = 0;
      }
      if (e.plan !== e.dir) e.img.setAngle(DIRS[e.plan][2]);
    }
    const moved = this.drive(e, e.plan, speed, dt);
    if (!moved) e.stuck = (e.stuck || 0) + dt; else e.stuck = 0;
    // Brick in the way? Shoot it.
    const [dx, dy] = DIRS[e.dir];
    const ahead = this.solidAt(e.x + dx * 16, e.y + dy * 16, true);
    if (!moved && ahead === 'B') this.fire(e);
    // Shoot on sight: you or your flag in the line of fire.
    const p = this.player;
    const base = { x: OX + BASE.c * TILE + TILE / 2, y: OY + BASE.r * TILE + TILE / 2 };
    if (Math.random() < this.cfg.aim * dt * 6) {
      if (p && !p.dead && this.lineOfFire(e, p.x, p.y)) this.fire(e);
      else if (e.role !== 'patrol' && this.lineOfFire(e, base.x, base.y)) this.fire(e);
    }
    if (Math.random() < dt * 0.15) this.fire(e);      // the odd wild shot
    e.img.setPosition(Math.round(e.x), Math.round(e.y));
  }

  /** Choose a direction: follow the cheapest route to the flag or the player, or patrol. */
  plan(e, r, c) {
    let target = null;
    if (e.role === 'base') target = BASE;
    else if (e.role === 'player' && this.player && !this.player.dead) {
      target = { r: Math.floor((this.player.y - OY) / TILE), c: Math.floor((this.player.x - OX) / TILE) };
    }
    if (target) {
      const dist = this.distanceMap(target.r, target.c);
      let best = Infinity; let bestDir = null;
      for (const [name, [dc, dr]] of Object.entries(DIRS)) {
        const nr = r + dr; const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        const d = dist[nr][nc] + (name === e.dir ? -0.2 : 0);
        if (d < best) { best = d; bestDir = name; }
      }
      if (bestDir) return bestDir;
    }
    // Patrol: keep going, sometimes turn, lean downward toward your side.
    const options = Object.keys(DIRS).filter((d) => {
      const [dc, dr] = DIRS[d];
      const t = this.map[r + dr]?.[c + dc];
      return t !== undefined && t !== 'S' && t !== 'W';
    });
    if (options.includes(e.dir) && Math.random() < 0.6) return e.dir;
    const weighted = options.flatMap((d) => (d === 'down' ? [d, d, d] : [d]));
    return Phaser.Utils.Array.GetRandom(weighted.length ? weighted : Object.keys(DIRS));
  }

  moveBullets(dt) {
    for (const b of [...this.bullets]) {
      if (!this.bullets.includes(b)) continue;
      b.x += b.dx * b.speed * dt; b.y += b.dy * b.speed * dt;
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      const hit = this.solidAt(b.x, b.y, true);
      if (hit) {
        if (hit === 'B') this.breakAt(b.x, b.y);
        if (hit === 'E') { this.removeBullet(b); this.baseDestroyed(); return; }
        if (hit === 'S' && b.owner === this.player && this.star > 0) this.breakAt(b.x, b.y, true);
        this.boom(b.x, b.y, 'small');
        this.removeBullet(b);
        continue;
      }
      const other = this.bullets.find((o) => o !== b && (o.owner === this.player) !== (b.owner === this.player) && Math.hypot(o.x - b.x, o.y - b.y) < 8);
      if (other) { this.removeBullet(b); this.removeBullet(other); continue; }
      if (b.owner === this.player) {
        const e = this.enemies.find((t) => Math.abs(t.x - b.x) < SIZE / 2 + 2 && Math.abs(t.y - b.y) < SIZE / 2 + 2);
        if (e) {
          this.removeBullet(b);
          e.hp--;
          if (e.hp <= 0) this.killEnemy(e); else { e.img.setTint(0xffaaaa); sfx('hit'); }
        }
      } else if (this.player && !this.player.dead && Math.abs(this.player.x - b.x) < SIZE / 2 + 2 && Math.abs(this.player.y - b.y) < SIZE / 2 + 2) {
        this.removeBullet(b);
        if (this.player.shield <= 0) this.killPlayer(); else sfx('bounce');
      }
    }
  }

  breakAt(x, y, steelToo = false) {
    const { r, c, t } = this.tileAt(x, y);
    if (t === 'B' || (steelToo && t === 'S')) { this.map[r][c] = '.'; this.drawTiles(); sfx('smallBoom'); }
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
    sfx('boom');
    e.img.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.score += e.kind === 'w' ? 200 : e.kind === 'r' ? 150 : 100;
    if (e.carriesPower) this.dropPower();
    this.updateHud();
    if (!this.enemies.length && this.enemiesLeft === 0) {
      this.score += 500;
      sfx('win');
      this.time.delayedCall(1400, () => { if (!this.over) this.loadStage(this.stage + 1); });
    }
  }

  // ---------- power-ups ----------
  dropPower() {
    this.power?.img.destroy();
    const free = [];
    for (let r = 1; r < N - 2; r++) for (let c = 0; c < N; c++) if (this.map[r][c] === '.') free.push([r, c]);
    const [r, c] = Phaser.Utils.Array.GetRandom(free);
    const kind = Phaser.Utils.Array.GetRandom(POWERS);
    const img = this.add.image(OX + c * TILE + TILE / 2, OY + r * TILE + TILE / 2, 'tanks', `pw_${kind}`).setScale(3).setDepth(25);
    this.power = { kind, img, ttl: 12 };
    sfx('power');
  }

  updatePower(time, dt) {
    const pw = this.power;
    if (!pw) return;
    pw.ttl -= dt;
    pw.img.setVisible(pw.ttl > 3 || Math.floor(time / 120) % 2 === 0);
    if (pw.ttl <= 0) { pw.img.destroy(); this.power = null; return; }
    const p = this.player;
    if (p && !p.dead && Math.abs(p.x - pw.img.x) < 18 && Math.abs(p.y - pw.img.y) < 18) {
      pw.img.destroy(); this.power = null;
      this.applyPower(pw.kind);
    }
  }

  applyPower(kind) {
    sfx('coin');
    const msg = {
      shield: 'Shield!', clock: 'Enemies frozen!', shovel: 'Steel walls for your flag!', star: 'Power shells!', grenade: 'Grenade!', life: 'Extra tank!',
    }[kind];
    toast(this, msg, OY + 150);
    if (kind === 'shield') this.player.shield = 10;
    if (kind === 'clock') this.freezeT = 7;
    if (kind === 'shovel') { this.setBaseWall('S'); this.shovelT = 15; }
    if (kind === 'star') this.star = 20;
    if (kind === 'grenade') [...this.enemies].forEach((e) => this.killEnemy(e));
    if (kind === 'life') { this.lives++; this.updateHud(); }
    this.score += 200;
  }

  setBaseWall(t) {
    for (const [r, c] of BASE_WALL) this.map[r][c] = t;
    this.drawTiles();
  }

  // ---------- losing ----------
  killPlayer() {
    const p = this.player;
    p.dead = true;
    this.boom(p.x, p.y, 'big');
    sfx('boom');
    p.img.setVisible(false);
    this.cameras.main.shake(200, 0.01);
    this.lives--;
    this.star = 0;
    this.updateHud();
    if (this.lives <= 0) { this.gameOver('Out of tanks'); return; }
    this.time.delayedCall(1200, () => { if (!this.over) this.spawnPlayer(); });
  }

  baseDestroyed() {
    this.boom(OX + BASE.c * TILE + TILE / 2, OY + BASE.r * TILE + TILE / 2, 'big');
    this.gameOver('Your flag was destroyed');
  }

  gameOver(why) {
    if (this.over) return;
    this.over = true;
    sfx('lose');
    const isBest = submitBest('tanks', this.score);
    // Clearing two stages counts as beating the CPU; the level adapts from there.
    reportResult('tanks', Math.min(1, this.stage / 2), 0.5);
    this.time.delayedCall(800, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [why, `Score ${this.score}  Stage ${this.stage + 1}`], [
        ['Play again', () => { m.destroy(); this.scene.restart({}); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
