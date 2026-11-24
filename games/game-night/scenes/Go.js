import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, popIn } from './common.js';
import { grid, endGame, think } from './boardkit.js';
import { N, newGame, play, pass, isOver, score, cpuMove, tryMove } from '../logic/go.js';

const CELL = 32;
const LEFT = (WIDTH - CELL * N) / 2;
const TOP = 160;
const FRAME = { 1: 'dark', 2: 'light' };

export class Go extends Phaser.Scene {
  constructor() { super('Go'); }

  init(data) { this.mode = data.mode ?? 'cpu'; }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Go', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 88, '', { color: PALETTE.cream });
    this.caps = text(this, WIDTH / 2, 116, '', { color: PALETTE.lavender });

    const f = this.add.graphics();
    const w = CELL * N;
    f.fillStyle(hex(PALETTE.ink)).fillRect(LEFT - 8, TOP - 8, w + 16, w + 16);
    f.fillStyle(hex(PALETTE.orange)).fillRect(LEFT - 4, TOP - 4, w + 8, w + 8);
    for (let i = 0; i < N * N; i++) {
      this.add.image(LEFT + (i % N) * CELL + CELL / 2, TOP + Math.floor(i / N) * CELL + CELL / 2, 'go', 'cell').setScale(CELL / 8);
    }
    this.g = grid(LEFT, TOP, N, CELL);
    this.marks = this.add.graphics().setDepth(12);
    this.stones = this.add.container(0, 0).setDepth(10);
    this.input.on('pointerup', (p) => this.tap(this.g.indexAt(p.x, p.y)));

    const by = TOP + w + 44;
    this.passBtn = button(this, WIDTH / 2 - 76, by, 136, 44, 'Pass', () => this.humanPass());
    button(this, WIDTH / 2 + 76, by, 136, 44, 'Resign', () => this.resign(), { fill: PALETTE.red, color: PALETTE.cream });
    text(this, WIDTH / 2, by + 48, 'Surround stones to capture. 2 passes end it.', { color: PALETTE.lavender });
    this.restart();
  }

  restart() {
    this.game = newGame();
    this.over = false;
    this.busy = false;
    this.lastMove = -1;
    this.draw();
    this.next();
  }

  name(p) {
    if (this.mode === 'pvp') return p === 1 ? 'Black' : 'White';
    return p === 1 ? 'You' : 'CPU';
  }

  isCpu() { return this.mode === 'cpu' && this.game.turn === 2; }

  draw(territory) {
    this.stones.removeAll(true);
    this.game.board.forEach((v, i) => {
      if (!v) return;
      const { x, y } = this.g.center(i);
      const s = this.add.image(x, y, 'go', FRAME[v]).setScale(CELL / 8);
      this.stones.add(s);
      if (i === this.lastMove) popIn(this, s, CELL / 8);
    });
    this.marks.clear();
    if (this.lastMove >= 0 && !territory) {
      const { x, y } = this.g.center(this.lastMove);
      this.marks.fillStyle(hex(PALETTE.red)).fillRect(x - 3, y - 3, 6, 6);
    }
    if (territory) {
      territory.forEach((o, i) => {
        if (!o) return;
        const { x, y } = this.g.center(i);
        this.marks.fillStyle(hex(o === 1 ? PALETTE.indigo : PALETTE.cream)).fillRect(x - 5, y - 5, 10, 10);
      });
    }
    const c = this.game.captures;
    this.caps.setText(`Captured: ${this.name(1)} ${c[1]}   ${this.name(2)} ${c[2]}`);
  }

  next() {
    if (isOver(this.game)) { this.finish(); return; }
    if (this.isCpu()) {
      this.status.setText('CPU is thinking...');
      this.busy = true;
      think(this, () => {
        const m = cpuMove(this.game);
        this.busy = false;
        if (m < 0) { toast(this, 'CPU passes', 600); this.game = pass(this.game); this.lastMove = -1; this.draw(); this.next(); }
        else this.place(m);
      });
    } else {
      const prevPass = this.game.passes === 1 ? ' (opponent passed)' : '';
      this.status.setText(`${this.name(this.game.turn)} to play${prevPass}`);
    }
  }

  tap(i) {
    if (i < 0 || this.over || this.busy || this.isCpu()) return;
    if (this.game.board[i]) return;
    if (!tryMove(this.game, i)) { toast(this, 'Not allowed there (suicide or ko)', 600); return; }
    this.place(i);
  }

  place(i) {
    const next = play(this.game, i);
    if (!next) return;
    this.game = next;
    this.lastMove = i;
    if (next.lastCaptured) this.cameras.main.shake(80, 0.004);
    this.draw();
    this.next();
  }

  humanPass() {
    if (this.over || this.busy || this.isCpu()) return;
    this.game = pass(this.game);
    this.lastMove = -1;
    this.draw();
    this.next();
  }

  resign() {
    if (this.over) return;
    this.over = true;
    const loser = this.mode === 'cpu' ? 1 : this.game.turn;
    const winner = 3 - loser;
    endGame(this, {
      id: 'go', mode: this.mode, title: `${this.name(winner)} win${winner === 1 && this.mode === 'cpu' ? '' : 's'}`,
      lines: [`${this.name(loser)} resigned`], outcome: 'l', onAgain: () => this.restart(),
    });
  }

  finish() {
    this.over = true;
    const sc = score(this.game.board);
    this.draw(sc.territory);
    const blackWins = sc.black > sc.white;
    const title = this.mode === 'cpu' ? (blackWins ? 'You win!' : 'CPU wins') : `${blackWins ? 'Black' : 'White'} wins!`;
    this.status.setText(title);
    endGame(this, {
      id: 'go', mode: this.mode, title,
      lines: [`${this.name(1)} ${sc.black}  -  ${sc.white} ${this.name(2)}`, '(White gets 6.5 komi)'],
      outcome: blackWins ? 'w' : 'l', onAgain: () => this.restart(),
    });
  }
}
