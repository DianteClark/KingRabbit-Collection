import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { checkerboard, highlighter, endGame, think } from './boardkit.js';
import { newGame, legalMoves, makeMove, status, inCheck, cpuMove } from '../logic/chess.js';

const CELL = 40;
const LEFT = 30;
const TOP = 168;
const frameFor = (p) => (p === p.toUpperCase() ? 'w' : 'b') + p.toUpperCase();
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export class Chess extends Phaser.Scene {
  constructor() { super('Chess'); }

  init(data) { this.mode = data.mode ?? 'cpu'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Chess', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 92, '', { color: PALETTE.cream });
    this.taken = text(this, WIDTH / 2, 118, '', { color: PALETTE.lavender });
    this.g = checkerboard(this, { left: LEFT, top: TOP, cell: CELL, labels: true });
    this.hl = highlighter(this, this.g);
    this.pieces = this.add.container(0, 0).setDepth(10);
    this.input.on('pointerup', (p) => this.tap(this.g.indexAt(p.x, p.y)));
    text(this, WIDTH / 2, TOP + CELL * 8 + 40, 'Pawns promote to a queen', { color: PALETTE.lavender });
    this.restart();
  }

  restart() {
    this.s = newGame();
    this.selected = -1;
    this.last = null;
    this.over = false;
    this.busy = false;
    this.next();
  }

  name(side) {
    if (this.mode === 'pvp') return side === 'w' ? 'White' : 'Black';
    return side === 'w' ? 'You' : 'CPU';
  }

  isCpu() { return this.mode === 'cpu' && this.s.turn === 'b'; }

  draw() {
    this.pieces.removeAll(true);
    this.s.board.forEach((p, i) => {
      if (!p) return;
      const { x, y } = this.g.center(i);
      this.pieces.add(this.add.image(x, y, 'chess', frameFor(p)).setScale(5));
    });
    this.hl.clear();
    if (this.last) this.hl.last(this.last.from, this.last.to);
    if (this.selected >= 0) {
      this.hl.selected(this.selected);
      for (const m of this.moves.filter((x) => x.from === this.selected)) this.hl.target(m.to, Boolean(m.capture));
    }
    // Material balance
    let w = 0; let b = 0;
    for (const p of this.s.board) if (p) { if (p === p.toUpperCase()) w += VAL[p]; else b += VAL[p.toUpperCase()]; }
    const diff = w - b;
    this.taken.setText(diff === 0 ? 'Material even' : `${this.name(diff > 0 ? 'w' : 'b')} +${Math.abs(diff)}`);
  }

  next() {
    this.moves = legalMoves(this.s);
    this.draw();
    const st = status(this.s);
    if (st) { this.finish(st); return; }
    const check = inCheck(this.s) ? ' - check!' : '';
    if (this.isCpu()) {
      this.status.setText(`CPU is thinking...${check}`);
      this.busy = true;
      think(this, () => this.apply(cpuMove(this.s)));
    } else {
      this.status.setText(`${this.name(this.s.turn)} to move${check}`);
      if (check) toast(this, 'Check!', 150);
    }
  }

  tap(i) {
    if (i < 0 || this.over || this.busy || this.isCpu()) return;
    const p = this.s.board[i];
    const mine = p && (p === p.toUpperCase() ? 'w' : 'b') === this.s.turn;
    if (mine) { this.selected = this.moves.some((m) => m.from === i) ? i : -1; this.draw(); return; }
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
    const c = this.g.center(m.from);
    const sprite = this.pieces.list.find((o) => o.x === c.x && o.y === c.y);
    const to = this.g.center(m.to);
    const done = () => {
      this.s = makeMove(this.s, m);
      this.last = { from: m.from, to: m.to };
      this.busy = false;
      this.next();
    };
    if (!sprite) { done(); return; }
    sprite.setDepth(20);
    this.pieces.bringToTop(sprite);
    this.tweens.add({ targets: sprite, x: to.x, y: to.y, duration: 180, ease: 'Quad.easeOut', onComplete: done });
  }

  finish(st) {
    this.over = true;
    let title; let outcome;
    if (st.result === 'checkmate') {
      title = this.mode === 'cpu' ? (st.winner === 'w' ? 'Checkmate! You win' : 'Checkmate. CPU wins') : `Checkmate! ${this.name(st.winner)} wins`;
      outcome = st.winner === 'w' ? 'w' : 'l';
    } else {
      title = 'Draw';
      outcome = 'd';
    }
    this.status.setText(title);
    const why = { checkmate: 'Checkmate', stalemate: 'Stalemate - no legal moves', draw: 'Draw by material or 50 moves' }[st.result];
    endGame(this, { id: 'chess', mode: this.mode, title: st.result === 'checkmate' ? 'Checkmate!' : 'Draw', lines: [why, title.replace('Checkmate! ', '').replace('Checkmate. ', '')], outcome, onAgain: () => this.restart() });
  }
}
