import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, modal, dpad, swipeArea } from './common.js';
import { sfx } from '../../../shared/core/sfx.js';
import { save, submitBest } from '../save.js';
import { LEVELS, parse, interior, step, solved } from '../logic/sokoban.js';

const AREA = { x: 16, y: 104, w: WIDTH - 32, h: 344 };

export class BoxBox extends Phaser.Scene {
  constructor() { super('BoxBox'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Box Box', () => go(this, 'Menu'));
    // Tap the level name to pick any level you've unlocked.
    this.title = button(this, WIDTH / 2, 80, 190, 34, '', () => this.pickLevel(), { fill: PALETTE.gold });
    this.movesText = text(this, WIDTH / 2, 462, '', { color: PALETTE.lavender });
    this.board = this.add.container(0, 0);

    dpad(this, WIDTH / 2, 552, (d) => this.move(d), { size: 52 });
    button(this, 54, 524, 84, 40, 'Undo', () => this.undo());
    button(this, 54, 580, 84, 40, 'Reset', () => this.loadLevel(this.levelIdx));
    this.prevBtn = button(this, WIDTH - 54, 524, 84, 40, '< Lvl', () => this.loadLevel(this.levelIdx - 1));
    this.nextBtn = button(this, WIDTH - 54, 580, 84, 40, 'Lvl >', () => this.loadLevel(this.levelIdx + 1));
    swipeArea(this, AREA, { onSwipe: (d) => this.move(d) });

    const unlocked = save.get('boxboxUnlocked') ?? 0;
    this.loadLevel(Math.min(unlocked, LEVELS.length - 1));
  }

  unlocked() { return save.get('boxboxUnlocked') ?? 0; }

  loadLevel(i) {
    if (i < 0 || i >= LEVELS.length || i > this.unlocked()) return;
    this.levelIdx = i;
    this.lv = parse(LEVELS[i]);
    this.inside = interior(this.lv);
    this.state = { player: this.lv.player, boxes: new Set(this.lv.boxes) };
    this.history = [];
    this.moves = 0;
    this.facing = 1;
    this.done = false;
    this.cell = Math.min(32, Math.floor(AREA.w / this.lv.w / 8) * 8, Math.floor(AREA.h / this.lv.h / 8) * 8);
    this.ox = Math.round(WIDTH / 2 - (this.lv.w * this.cell) / 2);
    this.oy = Math.round(AREA.y + AREA.h / 2 - (this.lv.h * this.cell) / 2);
    this.title.setLabel(`Level ${i + 1} of ${LEVELS.length}`);
    this.prevBtn.setEnabled(i > 0);
    this.nextBtn.setEnabled(i < Math.min(this.unlocked(), LEVELS.length - 1));
    this.draw();
  }

  pos(i) { return { x: this.ox + (i % this.lv.w) * this.cell + this.cell / 2, y: this.oy + Math.floor(i / this.lv.w) * this.cell + this.cell / 2 }; }

  draw() {
    this.board.removeAll(true);
    const s = this.cell / 8;
    const g = this.add.graphics();
    for (const i of this.inside) {
      const { x, y } = this.pos(i);
      g.fillStyle(hex(PALETTE.indigo)).fillRect(x - this.cell / 2, y - this.cell / 2, this.cell, this.cell);
      g.fillStyle(hex(PALETTE.night), 0.35).fillRect(x - this.cell / 2, y - this.cell / 2, this.cell, 1);
    }
    this.board.add(g);
    for (const i of this.lv.walls) {
      // Only draw walls that touch the playable area, so the level outline stays neat.
      const near = [-1, 1, -this.lv.w, this.lv.w, -this.lv.w - 1, -this.lv.w + 1, this.lv.w - 1, this.lv.w + 1].some((d) => this.inside.has(i + d));
      if (!near) continue;
      const { x, y } = this.pos(i);
      this.board.add(this.add.image(x, y, 'boxbox', 'wall').setScale(s));
    }
    const goalG = this.add.graphics();
    const inset = this.cell / 5;
    for (const i of this.lv.goals) {
      const { x, y } = this.pos(i);
      goalG.lineStyle(Math.max(2, s / 2), hex(PALETTE.gold)).strokeRect(x - this.cell / 2 + inset, y - this.cell / 2 + inset, this.cell - inset * 2, this.cell - inset * 2);
    }
    this.board.add(goalG);
    for (const i of this.state.boxes) {
      const { x, y } = this.pos(i);
      const img = this.add.image(x, y, 'boxbox', 'box').setScale(s);
      if (this.lv.goals.has(i)) img.setTint(0xfff0a0);
      this.board.add(img);
    }
    const p = this.pos(this.state.player);
    this.board.add(this.add.image(p.x, p.y, 'boxbox', 'player').setScale(s).setFlipX(this.facing < 0));
    const onGoal = [...this.state.boxes].filter((b) => this.lv.goals.has(b)).length;
    this.movesText.setText(`Moves ${this.moves}   Boxes home ${onGoal}/${this.lv.goals.size}`);
  }

  move(dir) {
    if (this.done) return;
    const r = step(this.lv, this.state, dir);
    if (dir === 'left') this.facing = -1;
    if (dir === 'right') this.facing = 1;
    if (!r) { this.draw(); sfx('thud'); return; }
    const pushed = r.boxes !== this.state.boxes && [...r.boxes].some((b) => !this.state.boxes.has(b));
    const homeBefore = [...this.state.boxes].filter((b) => this.lv.goals.has(b)).length;
    const homeAfter = [...r.boxes].filter((b) => this.lv.goals.has(b)).length;
    sfx(homeAfter > homeBefore ? 'coin' : pushed ? 'place' : 'move');
    this.history.push(this.state);
    this.state = { player: r.player, boxes: r.boxes };
    this.moves++;
    this.draw();
    if (solved(this.lv, this.state)) this.win();
  }

  undo() {
    if (this.done || !this.history.length) return;
    this.state = this.history.pop();
    this.moves--;
    this.draw();
  }

  win() {
    this.done = true;
    const i = this.levelIdx;
    if (i + 1 > this.unlocked()) save.set('boxboxUnlocked', Math.min(i + 1, LEVELS.length));
    submitBest('boxbox', i + 1);
    sfx('win');
    const bests = save.get('boxboxMoves') || {};
    const prev = bests[i];
    if (!prev || this.moves < prev) save.set('boxboxMoves', { ...bests, [i]: this.moves });
    const last = i === LEVELS.length - 1;
    this.time.delayedCall(500, () => {
      const m = modal(this, last ? 'All levels done!' : 'Level clear!', [`Solved in ${this.moves} moves`, prev ? (this.moves < prev ? `New record (was ${prev})` : `Your record: ${prev}`) : 'First solve!'], [
        last ? ['Play again', () => { m.destroy(); this.loadLevel(0); }] : ['Next level', () => { m.destroy(); this.loadLevel(i + 1); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }

  /** Grid of all levels: solved ones show your fewest moves, locked ones are greyed out. */
  pickLevel() {
    if (this.picker) return;
    const c = this.add.container(0, 0).setDepth(50);
    this.picker = c;
    const close = () => { c.destroy(); this.picker = null; };
    c.add(this.add.rectangle(0, 0, WIDTH, 640, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive().on('pointerup', close));
    c.add(panel(this, 20, 104, WIDTH - 40, 440));
    c.add(text(this, WIDTH / 2, 134, 'Pick a level', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 166, 'Green = solved. Number below = fewest moves.', { color: PALETTE.cream, wrap: 280 }));
    const bests = save.get('boxboxMoves') || {};
    LEVELS.forEach((_, i) => {
      const x = 66 + (i % 4) * 76; const y = 214 + Math.floor(i / 4) * 74;
      const open = i <= this.unlocked();
      const b = button(this, x, y, 64, 46, open ? String(i + 1) : '-', () => { close(); this.loadLevel(i); }, {
        fill: i === this.levelIdx ? PALETTE.gold : bests[i] ? PALETTE.leaf : PALETTE.lavender, size: 24,
      }).setEnabled(open);
      c.add(b);
      if (bests[i]) c.add(text(this, x, y + 36, String(bests[i]), { color: PALETTE.cream }));
    });
    c.add(button(this, WIDTH / 2, 510, 160, 40, 'Close', close));
  }
}
