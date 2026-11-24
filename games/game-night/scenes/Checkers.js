import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground } from './common.js';
import { checkerboard, highlighter, endGame, think } from './boardkit.js';
import { newBoard, legalMoves, play, other, side, winnerIfStuck, cpuMove } from '../logic/checkers.js';
import { sfx } from '../../../shared/core/sfx.js';

const CELL = 40;
const LEFT = (WIDTH - CELL * 8) / 2;
const TOP = 168;

export class Checkers extends Phaser.Scene {
  constructor() { super('Checkers'); }

  init(data) { this.mode = data.mode ?? 'cpu'; this.level = data.level || 'normal'; }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Checkers', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 92, '', { color: PALETTE.cream });
    this.counts = text(this, WIDTH / 2, 120, '', { color: PALETTE.lavender });
    this.g = checkerboard(this, { left: LEFT, top: TOP, cell: CELL, frame: PALETTE.red });
    this.hl = highlighter(this, this.g);
    this.pieces = this.add.container(0, 0).setDepth(10);
    this.input.on('pointerup', (p) => this.tap(this.g.indexAt(p.x, p.y)));
    text(this, WIDTH / 2, TOP + CELL * 8 + 40, 'Captures are compulsory', { color: PALETTE.lavender });
    this.restart();
  }

  restart() {
    this.board = newBoard();
    this.turn = 'd';
    this.selected = -1;
    this.over = false;
    this.busy = false;
    this.last = null;
    this.quiet = 0;   // moves in a row with no capture and no crowning
    this.draw();
    this.next();
  }

  name(s) {
    if (this.mode === 'pvp') return s === 'd' ? 'Dark' : 'Light';
    return s === 'd' ? 'You' : 'CPU';
  }

  isCpu() { return this.mode === 'cpu' && this.turn === 'l'; }

  draw() {
    this.pieces.removeAll(true);
    let d = 0; let l = 0;
    this.board.forEach((p, i) => {
      if (!p) return;
      if (side(p) === 'd') d++; else l++;
      const { x, y } = this.g.center(i);
      const frame = side(p) === 'd' ? 'dark' : 'light';
      this.pieces.add(this.add.image(x, y, 'checkers', frame).setScale(5));
      if (p === 'D' || p === 'L') this.pieces.add(this.add.image(x, y - 7, 'checkers', frame).setScale(5)); // kings are stacked
    });
    this.counts.setText(`${this.name('d')} ${d}   ${this.name('l')} ${l}`);
    this.hl.clear();
    if (this.last) this.hl.last(this.last.from, this.last.to);
    if (this.selected >= 0) {
      this.hl.selected(this.selected);
      for (const m of this.moves.filter((x) => x.from === this.selected)) this.hl.target(m.to, m.captured.length > 0);
    }
  }

  next() {
    const w = winnerIfStuck(this.board, this.turn);
    if (w) { this.finish(w); return; }
    if (this.quiet >= 80) { this.drawGame(); return; }
    this.moves = legalMoves(this.board, this.turn);
    if (this.isCpu()) {
      this.status.setText('CPU is thinking...');
      this.busy = true;
      think(this, () => this.apply(cpuMove(this.board, 'l', { level: this.level })));
    } else {
      this.status.setText(`${this.name(this.turn)} to move${this.moves[0]?.captured.length ? ' - capture!' : ''}`);
    }
  }

  tap(i) {
    if (i < 0 || this.over || this.busy || this.isCpu()) return;
    const mine = this.board[i] && side(this.board[i]) === this.turn;
    if (mine && this.moves.some((m) => m.from === i)) { this.selected = i; this.draw(); return; }
    if (this.selected >= 0) {
      const m = this.moves.find((x) => x.from === this.selected && x.to === i);
      if (m) { this.apply(m); return; }
    }
    this.selected = -1;
    this.draw();
  }

  apply(m) {
    this.busy = true;
    this.selected = -1;
    // Hop the piece along its path, then commit.
    const piece = this.pieces.list.find((o) => {
      const c = this.g.center(m.from); return o.x === c.x && o.y === c.y;
    });
    const hops = m.path.slice(1).map((sq) => this.g.center(sq));
    const finish = () => {
      const before = this.board[m.from];
      this.board = play(this.board, m);
      const crowned = before !== this.board[m.to];
      this.quiet = m.captured.length || crowned ? 0 : this.quiet + 1;
      sfx(m.captured.length ? 'capture' : crowned ? 'power' : 'move');
      this.last = { from: m.from, to: m.to };
      this.turn = other(this.turn);
      this.busy = false;
      this.draw();
      this.next();
    };
    if (!piece) { finish(); return; }
    piece.setDepth(20);
    this.tweens.chain({
      targets: piece,
      tweens: hops.map((h) => ({ x: h.x, y: h.y, duration: 160, ease: 'Quad.easeOut' })),
      onComplete: finish,
    });
  }

  drawGame() {
    this.over = true;
    this.status.setText('Draw');
    endGame(this, {
      id: 'checkers', mode: this.mode, title: 'Draw',
      lines: ['40 moves each with no capture', 'or crowning'], outcome: 'd', onAgain: () => this.restart(),
    });
  }

  finish(winner) {
    this.over = true;
    const title = this.mode === 'cpu' ? (winner === 'd' ? 'You win!' : 'CPU wins') : `${this.name(winner)} wins!`;
    this.status.setText(title);
    sfx(this.mode === 'pvp' || winner === 'd' ? 'win' : 'lose');
    endGame(this, {
      id: 'checkers', mode: this.mode, title, lines: ['The other side has no moves left'],
      outcome: winner === 'd' ? 'w' : 'l', onAgain: () => this.restart(),
    });
  }
}
