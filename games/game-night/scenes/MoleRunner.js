import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal, holdButton, fitLine, arcadePad } from './common.js';
import { getBest, submitBest } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';
import { getSkill, tune, reportResult } from '../adaptive.js';
import { earn } from '../trophies.js';
import { COLS, ROWS, LEVELS, parse, at, solid, supported, moves, chaseStep } from '../logic/molerunner.js';

const TILE = 24;
const OX = (WIDTH - COLS * TILE) / 2;
const OY = 80;
const HOLE_TIME = 5000;
// Adapts to you: how fast enemies move (ms per tile) and how long a hole holds them.
const PRESETS = {
  easy: { step: 340, trap: 3400 },
  normal: { step: 280, trap: 2600 },
  hard: { step: 215, trap: 1900 },
};

export class MoleRunner extends Phaser.Scene {
  constructor() { super('MoleRunner'); }

  init() {
    this.mode = 'solo';
    this.cfg = tune(PRESETS, getSkill('molerunner'), ['step', 'trap']);
  }

  create() {
    setBackground(this, PALETTE.lavender);
    header(this, 'Mole Runner', () => go(this, 'Menu'));
    this.hud = text(this, WIDTH / 2, 68, '', { color: PALETTE.night });
    this.tileLayer = this.add.container(0, 0).setDepth(2);

    const y = 520;
    this.pad = {
      up: holdButton(this, 96, y - 54, 64, 50, '^', { size: 32, pad: ['up'] }),
      down: holdButton(this, 96, y + 54, 64, 50, 'v', { size: 32, pad: ['down'] }),
      left: holdButton(this, 30, y, 56, 50, '<', { size: 32, pad: ['left'] }),
      right: holdButton(this, 162, y, 56, 50, '>', { size: 32, pad: ['right'] }),
    };
    this.digL = holdButton(this, 250, y - 14, 120, 60, 'Dig left', { fill: PALETTE.orange, pad: ['x2', 'l'] });
    this.digR = holdButton(this, 250, y + 62, 120, 60, 'Dig right', { fill: PALETTE.orange, pad: ['b', 'a', 'r'] });
    arcadePad(this); // controller: d-pad runs, X / L dig left, A / B / R dig right

    this.score = 0; this.lives = 3; this.levelIdx = 0; this.over = false; this.levelsCleared = 0; this.dying = false;
    this.startLevel();
  }

  startLevel() {
    const lv = parse(LEVELS[this.levelIdx % LEVELS.length]);
    this.grid = lv.grid;
    this.gemsLeft = lv.gems;
    this.dug = new Map();         // index -> refill timer
    this.cleared = false;
    this.player?.img.destroy();
    this.enemies?.forEach((e) => e.img.destroy());
    this.player = this.makeBody(lv.player.r, lv.player.c, 'p');
    this.enemies = lv.enemies.map((e) => this.makeBody(e.r, e.c, 'e'));
    // Each time round the levels, enemies get a little quicker.
    this.enemySpeed = Math.max(160, this.cfg.step - Math.floor(this.levelIdx / LEVELS.length) * 35);
    this.drawTiles();
    this.updateHud();
  }

  makeBody(r, c, kind) {
    const img = this.add.image(0, 0, 'mole', `${kind}walk1`).setScale(3).setDepth(kind === 'p' ? 12 : 11);
    const b = { r, c, kind, moving: false, img, anim: 0, trappedUntil: 0, dead: false, facing: 1 };
    this.place(b);
    return b;
  }

  pos(r, c) { return { x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 }; }
  place(b) { const p = this.pos(b.r, b.c); b.img.setPosition(p.x, p.y); }

  drawTiles() {
    this.tileLayer.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.lavender)).fillRect(OX, OY, COLS * TILE, ROWS * TILE);
    this.tileLayer.add(g);
    const frame = { '#': 'brick', '=': 'stone', H: 'ladder', '-': 'rope', '*': 'gem' };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const t = this.grid[i];
        if (!frame[t]) continue;
        if (t === '#' && this.dug.has(i)) {
          const left = this.dug.get(i).until - this.time.now;
          if (left > 900) continue;
          // About to refill: show the brick flickering back.
          this.tileLayer.add(this.add.image(this.pos(r, c).x, this.pos(r, c).y, 'mole', 'brick').setScale(3).setAlpha(0.45));
          continue;
        }
        this.tileLayer.add(this.add.image(this.pos(r, c).x, this.pos(r, c).y, 'mole', frame[t]).setScale(3));
      }
    }
  }

  updateHud() {
    fitLine(this.hud, [`Score ${this.score}`, `Gems ${this.gemsLeft}`, `Lives ${this.lives}`, `Level ${this.levelIdx + 1}`]);
  }

  occupiedBy(exclude) {
    // A trapped or standing enemy counts as something to stand on.
    return (r, c) => this.enemies.some((e) => e !== exclude && !e.dead && e.r === r && e.c === c && !e.moving);
  }

  stepBody(b, to, ms) {
    b.moving = true;
    if (to.c !== b.c) { b.facing = to.c > b.c ? 1 : -1; b.img.setFlipX(b.facing < 0); }
    const climbing = to.dir === 'up' || to.dir === 'down' || at(this.grid, b.r, b.c) === 'H';
    const onRope = at(this.grid, to.r, to.c) === '-';
    b.anim++;
    const kind = b.kind;
    const f = climbing ? 'climb' : onRope ? 'rope' : 'walk';
    b.img.setFrame(`${kind}${f}${(b.anim % 2) + 1}`);
    b.r = to.r; b.c = to.c;
    const p = this.pos(to.r, to.c);
    this.tweens.add({ targets: b.img, x: p.x, y: p.y, duration: ms, onComplete: () => { b.moving = false; this.arrived(b); } });
  }

  arrived(b) {
    const i = b.r * COLS + b.c;
    if (b.kind === 'p') {
      if (this.grid[i] === '*') {
        this.grid[i] = '.';
        this.gemsLeft--;
        this.score += 100;
        sfx('coin');
        this.drawTiles(); this.updateHud();
        if (this.gemsLeft === 0) this.levelClear();
      }
    } else if (this.dug.has(i) && !b.trappedUntil) {
      b.trappedUntil = this.time.now + this.cfg.trap;   // fell into a hole
      sfx('capture');
    }
    this.checkCatch();
  }

  dig(side) {
    const p = this.player;
    const tr = p.r + 1; const tc = p.c + side;
    if (tc < 0 || tc >= COLS || tr >= ROWS) return;
    const i = tr * COLS + tc;
    const aboveFree = !solid(this.grid, this.dug, p.r, tc) && at(this.grid, p.r, tc) !== 'H';
    if (at(this.grid, tr, tc) !== '#' || this.dug.has(i) || !aboveFree) return;
    if (this.enemies.some((e) => e.r === tr && e.c === tc)) return;
    p.img.setFlipX(side < 0);
    this.dug.set(i, { until: this.time.now + HOLE_TIME });
    sfx('thud');
    this.drawTiles();
  }

  update(time) {
    if (this.over || this.cleared || this.dying) return;
    // Refill holes
    let redraw = false;
    for (const [i, h] of [...this.dug]) {
      if (time >= h.until) {
        this.dug.delete(i);
        redraw = true;
        const r = Math.floor(i / COLS); const c = i % COLS;
        if (this.player.r === r && this.player.c === c) { this.die('Buried in the dirt!'); return; }
        for (const e of this.enemies) if (e.r === r && e.c === c) this.respawnEnemy(e);
      } else if (h.until - time < 900 && !h.flagged) { h.flagged = true; redraw = true; }
    }
    if (redraw) this.drawTiles();

    // Player
    const p = this.player;
    if (!p.moving) {
      if (this.digL.wasPressed()) this.dig(-1);
      if (this.digR.wasPressed()) this.dig(1);
      const occ = this.occupiedBy(null);
      if (!supported(this.grid, this.dug, p.r, p.c, occ)) {
        if (p.r < ROWS - 1) this.stepBody(p, { r: p.r + 1, c: p.c, dir: 'fall' }, 90);
      } else {
        const want = ['left', 'right', 'up', 'down'].find((d) => this.pad[d].isDown);
        if (want) {
          const m = moves(this.grid, this.dug, p.r, p.c, occ).find((x) => x.dir === want);
          if (m) this.stepBody(p, m, 140);
        }
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.dead || e.moving) continue;
      if (e.trappedUntil) {
        if (time < e.trappedUntil) continue;
        // Climb out diagonally toward the player.
        const side = this.player.c >= e.c ? 1 : -1;
        for (const s of [side, -side]) {
          if (!solid(this.grid, this.dug, e.r - 1, e.c + s) && !solid(this.grid, this.dug, e.r - 1, e.c)) {
            e.trappedUntil = 0;
            this.stepBody(e, { r: e.r - 1, c: e.c + s, dir: 'up' }, this.enemySpeed);
            break;
          }
        }
        continue;
      }
      const occ = this.occupiedBy(e);
      if (!supported(this.grid, this.dug, e.r, e.c, occ)) {
        if (e.r < ROWS - 1) this.stepBody(e, { r: e.r + 1, c: e.c, dir: 'fall' }, 110);
        continue;
      }
      const step = chaseStep(this.grid, this.dug, e, this.player, occ);
      const blocked = step && this.enemies.some((o) => o !== e && !o.dead && o.r === step.r && o.c === step.c);
      if (step && !blocked) this.stepBody(e, step, this.enemySpeed);
    }
    this.checkCatch();
  }

  checkCatch() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.img.x - p.img.x) < 14 && Math.abs(e.img.y - p.img.y) < 14) { this.die('Caught!'); return; }
    }
  }

  respawnEnemy(e) {
    e.dead = true;
    e.img.setVisible(false);
    this.score += 75;
    this.updateHud();
    sfx('smallBoom');
    this.time.delayedCall(2000, () => {
      if (!this.enemies.includes(e)) return;   // the level restarted meanwhile
      // Drop back in somewhere along the top row.
      const cols = [...Array(COLS).keys()].filter((c) => !solid(this.grid, this.dug, 0, c) && Math.abs(c - this.player.c) > 3);
      e.c = Phaser.Utils.Array.GetRandom(cols.length ? cols : [0]); e.r = 0;
      e.trappedUntil = 0; e.dead = false; e.moving = false;
      this.tweens.killTweensOf(e.img);
      this.place(e); e.img.setVisible(true);
    });
  }

  die(why) {
    if (this.over || this.dying || this.cleared) return;   // already through to the next level
    this.dying = true;
    this.tweens.killAll();
    this.cameras.main.shake(200, 0.01);
    sfx('lose');
    toast(this, why, OY + 160);
    this.lives--;
    this.updateHud();
    this.time.delayedCall(1100, () => {
      this.dying = false;
      if (this.lives <= 0) { this.gameOver(); return; }
      this.startLevel();
    });
    this.over = this.lives <= 0;
  }

  levelClear() {
    this.cleared = true;
    this.score += 500;
    this.updateHud();
    toast(this, 'All gems! Level clear', OY + 160);
    sfx('win');
    this.levelsCleared = (this.levelsCleared || 0) + 1;
    earn('mole-1');
    if (this.levelsCleared >= 3) earn('mole-3');
    this.time.delayedCall(1400, () => { this.levelIdx++; this.startLevel(); });
  }

  gameOver() {
    this.over = true;
    const isBest = submitBest('molerunner', this.score);
    // Clearing 3 levels in a run counts as beating the computer.
    reportResult('molerunner', Math.min(1, (this.levelsCleared || 0) / 3), 0.5);
    const m = modal(this, isBest ? 'New best!' : 'Game over', [`Score ${this.score}`, `Reached level ${this.levelIdx + 1}`, `Best ${getBest('molerunner')}`], [
      ['Play again', () => { m.destroy(); this.scene.restart(); }],
      ['Menu', () => go(this, 'Menu')],
    ]);
  }
}
