import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, modal, toast, setBackground } from './common.js';
import { SIZE, newBoard, legalMoves, play, count, isOver, cpuMove, other } from '../logic/reversi.js';
import { record } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';

const CELL = 40;
const BOARD = CELL * SIZE;
const LEFT = (WIDTH - BOARD) / 2;
const TOP = 176;
const SCALE = CELL / 8; // sprites are 8x8
const FRAME = { 1: 'dark', 2: 'light' };

export class Reversi extends Phaser.Scene {
  constructor() { super('Reversi'); }

  init(data) { this.mode = data.mode ?? 'cpu'; this.level = data.level || 'normal'; }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Reversi', () => go(this, 'Menu'));

    // Score boxes
    this.scoreBox(90, 1);
    this.scoreBox(270, 2);
    this.status = text(this, WIDTH / 2, 144, '', { color: PALETTE.cream });

    // Red double frame like the sheet's mock-up, then the green cells.
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.red)).fillRect(LEFT - 12, TOP - 12, BOARD + 24, BOARD + 24);
    g.fillStyle(hex(PALETTE.wine)).fillRect(LEFT - 8, TOP - 8, BOARD + 16, BOARD + 16);
    g.fillStyle(hex(PALETTE.red)).fillRect(LEFT - 5, TOP - 5, BOARD + 10, BOARD + 10);
    for (let i = 0; i < 64; i++) {
      const { x, y } = this.pos(i);
      this.add.image(x, y, 'reversi', 'cell').setScale(SCALE);
    }

    this.hints = this.add.graphics();
    this.discs = new Array(64).fill(null);
    this.input.on('pointerup', (p) => {
      const cx = Math.floor((p.x - LEFT) / CELL);
      const cy = Math.floor((p.y - TOP) / CELL);
      if (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE) this.humanMove(cy * SIZE + cx);
    });

    this.restart();
  }

  scoreBox(x, player) {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.red)).fillRect(x - 60, 70, 120, 44);
    g.fillStyle(hex(PALETTE.wine)).fillRect(x - 56, 74, 112, 36);
    this.add.image(x - 30, 92, 'reversi', FRAME[player]).setScale(3);
    const t = text(this, x + 16, 92, '2', { size: 32 });
    (this.counts ??= {})[player] = t;
  }

  pos(i) {
    return { x: LEFT + (i % SIZE) * CELL + CELL / 2, y: TOP + Math.floor(i / SIZE) * CELL + CELL / 2 };
  }

  restart() {
    this.discs.forEach((d) => d?.destroy());
    this.discs = new Array(64).fill(null);
    this.board = newBoard();
    this.board.forEach((v, i) => { if (v) this.discs[i] = this.add.image(this.pos(i).x, this.pos(i).y, 'reversi', FRAME[v]).setScale(SCALE); });
    this.turn = 1;
    this.over = false;
    this.busy = false;
    this.refresh();
  }

  name(p) {
    if (this.mode === 'pvp') return p === 1 ? 'Dark' : 'Light';
    return p === 1 ? 'You' : 'CPU';
  }

  isCpuTurn() { return this.mode === 'cpu' && this.turn === 2; }

  refresh() {
    const c = count(this.board);
    this.counts[1].setText(String(c.dark));
    this.counts[2].setText(String(c.light));
    this.hints.clear();
    if (this.over) return;
    this.status.setText(this.isCpuTurn() ? 'CPU is thinking...' : `${this.name(this.turn)} to move`);
    if (!this.isCpuTurn()) {
      this.hints.fillStyle(hex(PALETTE.cream), 0.85);
      for (const m of legalMoves(this.board, this.turn)) {
        const { x, y } = this.pos(m);
        this.hints.fillRect(x - 3, y - 3, 6, 6);
      }
    } else {
      this.busy = true;
      this.time.delayedCall(500, () => this.cpuTurn());
    }
  }

  humanMove(i) {
    if (this.over || this.busy || this.isCpuTurn()) return;
    if (!legalMoves(this.board, this.turn).includes(i)) return;
    this.apply(i);
  }

  cpuTurn() {
    const m = cpuMove(this.board, 2, { level: this.level });
    this.busy = false;
    if (m >= 0) this.apply(m);
  }

  apply(i) {
    const { board, flips } = play(this.board, i, this.turn);
    this.board = board;
    const { x, y } = this.pos(i);
    const d = this.add.image(x, y, 'reversi', FRAME[this.turn]).setScale(0);
    this.tweens.add({ targets: d, scale: SCALE, duration: 150, ease: 'Back.easeOut' });
    sfx('place');
    if (flips.length) this.time.delayedCall(90, () => sfx('flip'));
    this.discs[i] = d;

    // Flip animation: squash, swap colour, unsquash — staggered so you can see the capture.
    this.busy = true;
    flips.forEach((f, n) => {
      const disc = this.discs[f];
      this.tweens.add({
        targets: disc, scaleX: 0, duration: 90, delay: 60 + n * 40,
        onComplete: () => {
          disc.setFrame(FRAME[this.board[f]]);
          this.tweens.add({ targets: disc, scaleX: SCALE, duration: 90 });
        },
      });
    });
    this.time.delayedCall(200 + flips.length * 40, () => { this.busy = false; this.nextTurn(); });
  }

  nextTurn() {
    if (isOver(this.board)) { this.finish(); return; }
    const next = other(this.turn);
    if (legalMoves(this.board, next).length) {
      this.turn = next;
    } else {
      toast(this, `${this.name(next)} has no moves - pass`, 622);
    }
    this.refresh();
  }

  finish() {
    this.over = true;
    this.refresh();
    const { dark, light } = count(this.board);
    let title;
    if (dark === light) title = 'Draw!';
    else if (this.mode === 'cpu') title = dark > light ? 'You win!' : 'CPU wins';
    else title = `${dark > light ? 'Dark' : 'Light'} wins!`;
    if (this.mode === 'cpu') record('reversi', dark === light ? 'd' : (dark > light ? 'w' : 'l'));
    sfx(this.mode === 'pvp' || dark > light ? 'win' : dark === light ? 'place' : 'lose');
    this.status.setText(title);
    this.time.delayedCall(800, () => {
      const m = modal(this, title, [`${this.name(1)} ${dark}  -  ${light} ${this.name(2)}`], [
        ['Play again', () => { m.destroy(); this.restart(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
