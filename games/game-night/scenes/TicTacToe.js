import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, modal, popIn, setBackground } from './common.js';
import { result, cpuMove, MISTAKES } from '../logic/tictactoe.js';
import { sfx } from '../../../shared/core/sfx.js';
import { record } from '../save.js';

const BOARD = 312;
const LEFT = (WIDTH - BOARD) / 2;
const TOP = 168;
const CELL = BOARD / 3;
const PIECE_SCALE = 5;

export class TicTacToe extends Phaser.Scene {
  constructor() { super('TicTacToe'); }

  init(data) {
    this.mode = data.mode ?? 'cpu';
    this.level = data.level || 'normal';
    this.firstPlayer = 'X';
    this.tally = { X: 0, O: 0, draw: 0 };
  }

  create() {
    setBackground(this, PALETTE.lavender);
    header(this, 'Tic-Tac-Toe', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 120, '', { color: PALETTE.night });

    // Board: cream card with lavender grid, matching the sprite sheet's mock-up.
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(LEFT - 4, TOP - 4, BOARD + 8, BOARD + 12);
    g.fillStyle(hex(PALETTE.cream)).fillRect(LEFT, TOP, BOARD, BOARD);
    g.fillStyle(hex(PALETTE.lavender));
    for (let i = 1; i < 3; i++) {
      g.fillRect(LEFT + CELL * i - 3, TOP + 12, 6, BOARD - 24);
      g.fillRect(LEFT + 12, TOP + CELL * i - 3, BOARD - 24, 6);
    }

    this.cells = [];
    for (let i = 0; i < 9; i++) {
      const x = LEFT + (i % 3) * CELL + CELL / 2;
      const y = TOP + Math.floor(i / 3) * CELL + CELL / 2;
      const zone = this.add.zone(x, y, CELL, CELL).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.humanMove(i));
      this.cells.push({ x, y });
    }

    this.scoreText = text(this, WIDTH / 2, TOP + BOARD + 56, '', { color: PALETTE.night });
    this.newRound();
  }

  newRound() {
    this.pieces?.forEach((p) => p?.destroy());
    this.pieces = new Array(9).fill(null);
    this.board = new Array(9).fill(null);
    this.turn = this.firstPlayer;
    this.over = false;
    this.updateTexts();
    if (this.isCpuTurn()) this.queueCpu();
  }

  isCpuTurn() { return this.mode === 'cpu' && this.turn === 'O'; }

  label(p) {
    if (this.mode === 'pvp') return `Player ${p}`;
    return p === 'X' ? 'You' : 'CPU';
  }

  updateTexts() {
    const t = this.tally;
    this.scoreText.setText(`${this.label('X')} ${t.X}   Draw ${t.draw}   ${this.label('O')} ${t.O}`);
    if (!this.over) {
      this.status.setText(this.isCpuTurn() ? 'CPU is thinking...' : `${this.label(this.turn)}: place ${this.turn}`);
    }
  }

  humanMove(i) {
    if (this.over || this.busy || this.isCpuTurn() || this.board[i]) return;
    this.place(i);
  }

  place(i) {
    this.board[i] = this.turn;
    const piece = this.add.image(this.cells[i].x, this.cells[i].y, 'ttt', this.turn.toLowerCase());
    popIn(this, piece, PIECE_SCALE);
    sfx('place');
    this.pieces[i] = piece;

    const r = result(this.board);
    if (r) { this.finish(r); return; }
    this.turn = this.turn === 'X' ? 'O' : 'X';
    this.updateTexts();
    if (this.isCpuTurn()) this.queueCpu();
  }

  queueCpu() {
    this.busy = true;
    this.time.delayedCall(450, () => {
      this.busy = false;
      if (!this.over) this.place(cpuMove(this.board, 'O', { mistakeChance: MISTAKES[this.level] }));
    });
  }

  finish(r) {
    this.over = true;
    let title;
    if (r.winner === 'draw') {
      this.tally.draw++;
      title = 'Draw!';
      if (this.mode === 'cpu') record('ttt', 'd');
    } else {
      this.tally[r.winner]++;
      r.line.forEach((i) => this.tweens.add({ targets: this.pieces[i], scale: PIECE_SCALE + 1, yoyo: true, repeat: 2, duration: 140 }));
      if (this.mode === 'cpu') {
        title = r.winner === 'X' ? 'You win!' : 'CPU wins';
        record('ttt', r.winner === 'X' ? 'w' : 'l');
      } else title = `${r.winner} wins!`;
    }
    this.status.setText(title);
    sfx(r.winner === 'draw' ? 'place' : (this.mode === 'pvp' || r.winner === 'X') ? 'win' : 'lose');
    this.updateTexts();
    this.firstPlayer = this.firstPlayer === 'X' ? 'O' : 'X'; // take turns going first
    this.time.delayedCall(900, () => {
      const m = modal(this, title, [this.scoreText.text], [
        ['Play again', () => { m.destroy(); this.newRound(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
