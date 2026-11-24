import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, popIn, modal } from './common.js';
import { grid, endGame, think } from './boardkit.js';
import { sfx } from '../../../shared/core/sfx.js';
import { N, newGame, play, pass, isOver, cpuMove, tryMove, suggestDead, toggleDead, finalScore, LEVELS } from '../logic/go.js';
import { getSkill, tune } from '../adaptive.js';


const CELL = 32;
const LEFT = (WIDTH - CELL * N) / 2;
const TOP = 160;
const FRAME = { 1: 'dark', 2: 'light' };

export class Go extends Phaser.Scene {
  constructor() { super('Go'); }

  init(data) { this.mode = data.mode ?? 'cpu'; this.cfg = tune(LEVELS, getSkill('go')); }

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
    this.input.on('pointerup', (p, over) => { if (!over.length) this.tap(this.g.indexAt(p.x, p.y)); });

    const by = TOP + w + 44;
    this.passBtn = button(this, WIDTH / 2 - 76, by, 136, 44, 'Pass', () => this.humanPass());
    this.resignBtn = button(this, WIDTH / 2 + 76, by, 136, 44, 'Resign', () => this.resign(), { fill: PALETTE.red, color: PALETTE.cream });
    text(this, WIDTH / 2, by + 48, 'Surround stones to capture. 2 passes end it.', { color: PALETTE.lavender });
    this.restart();
  }

  restart() {
    this.st = newGame();
    this.counting = false;
    this.dead = new Set();
    this.passBtn?.setLabel('Pass');
    this.over = false;
    this.busy = false;
    this.confirming = false;
    this.lastMove = -1;
    this.draw();
    this.next();
  }

  name(p) {
    if (this.mode === 'pvp') return p === 1 ? 'Black' : 'White';
    return p === 1 ? 'You' : 'CPU';
  }

  isCpu() { return this.mode === 'cpu' && this.st.turn === 2; }

  draw(territory) {
    this.stones.removeAll(true);
    this.st.board.forEach((v, i) => {
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
    const c = this.st.captures;
    this.caps.setText(`Captured: ${this.name(1)} ${c[1]}   ${this.name(2)} ${c[2]}`);
    this.syncButtons();
  }

  /** Pass/Score and Resign only look pressable when they would do something. */
  syncButtons() {
    const thinking = this.mode === 'cpu' && this.busy;
    this.passBtn.setEnabled(this.counting || (!this.over && !thinking && !this.isCpu()));
    this.resignBtn.setEnabled(!this.over && !this.counting && !thinking);
  }

  next() {
    if (isOver(this.st)) { this.finish(); return; }
    if (this.isCpu()) {
      this.status.setText('CPU is thinking...');
      this.busy = true;
      this.syncButtons();
      think(this, () => {
        if (this.over || !this.isCpu()) return;   // resigned while the CPU was thinking
        const m = cpuMove(this.st, { cfg: this.cfg });
        this.busy = false;
        if (m < 0) { toast(this, 'CPU passes', 600); this.st = pass(this.st); this.lastMove = -1; this.draw(); this.next(); }
        else this.place(m);
      });
    } else {
      const prevPass = this.st.passes === 1 ? ' (opponent passed)' : '';
      this.status.setText(`${this.name(this.st.turn)} to play${prevPass}`);
    }
  }

  tap(i) {
    if (this.counting) {
      if (i < 0 || !this.st.board[i]) return;
      // Against the computer, it decides about its own stones, and you can't revive a group
      // it can see is dead. You can still give up your own groups.
      if (this.mode === 'cpu') {
        if (this.st.board[i] === 2) { toast(this, 'The CPU decides about its own stones', 600); return; }
        if (this.dead.has(i) && this.cpuDead.has(i)) { toast(this, 'That group has no way to live', 600); return; }
      }
      this.dead = toggleDead(this.st.board, this.dead, i); this.drawCounting();
      return;
    }
    if (i < 0 || this.over || this.busy || this.isCpu()) return;
    if (this.st.board[i]) return;
    if (!tryMove(this.st, i)) { toast(this, 'Not allowed there (suicide or ko)', 600); return; }
    this.place(i);
  }

  place(i) {
    const next = play(this.st, i);
    if (!next) return;
    this.st = next;
    this.lastMove = i;
    if (next.lastCaptured) { this.cameras.main.shake(80, 0.004); sfx('capture'); } else sfx('place');
    this.draw();
    this.next();
  }

  humanPass() {
    if (this.counting) { this.score(); return; }
    if (this.over || this.busy || this.isCpu()) return;
    this.st = pass(this.st);
    this.lastMove = -1;
    this.draw();
    this.next();
  }

  resign() {
    if (this.over || this.counting || this.confirming) return;
    if (this.mode === 'cpu' && this.busy) return;
    this.confirming = true;
    const who = this.mode === 'pvp' ? `${this.name(this.st.turn)} resigns?` : 'Resign this game?';
    const m = modal(this, who, ['The game counts as a loss.'], [
      ['Resign', () => { m.destroy(); this.confirming = false; this.doResign(); }, PALETTE.red, PALETTE.cream],
      ['Keep playing', () => { m.destroy(); this.confirming = false; }],
    ]);
  }

  doResign() {
    if (this.over || this.counting) return;
    this.over = true;
    this.syncButtons();
    const loser = this.mode === 'cpu' ? 1 : this.st.turn;
    const winner = 3 - loser;
    endGame(this, {
      id: 'go', mode: this.mode, title: `${this.name(winner)} win${winner === 1 && this.mode === 'cpu' ? '' : 's'}`,
      lines: [`${this.name(loser)} resigned`], outcome: 'l', onAgain: () => this.restart(),
    });
  }

  finish() {
    // Both passed: agree which stones are dead before counting.
    this.counting = true;
    this.dead = suggestDead(this.st.board);
    this.cpuDead = new Set(this.dead);
    this.passBtn.setLabel('Score');
    this.status.setText(this.mode === 'cpu' ? 'Dead stones are marked. Tap Score' : 'Tap groups to mark them dead');
    this.drawCounting();
  }

  drawCounting() {
    const { territory, black, white } = finalScore(this.st.board, this.dead);
    this.draw(territory);
    for (const i of this.dead) {
      const { x, y } = this.g.center(i);
      this.marks.lineStyle(3, hex(PALETTE.red)).lineBetween(x - 8, y - 8, x + 8, y + 8).lineBetween(x + 8, y - 8, x - 8, y + 8);
    }
    this.stones.list.forEach((img) => {
      const i = this.g.indexAt(img.x, img.y);
      img.setAlpha(this.dead.has(i) ? 0.45 : 1);
    });
    this.caps.setText(`Count so far: ${this.name(1)} ${black}  ${this.name(2)} ${white}`);
  }

  score() {
    this.counting = false;
    this.over = true;
    const sc = finalScore(this.st.board, this.dead);
    this.st = { ...this.st, board: sc.board };
    this.dead = new Set();
    this.draw(sc.territory);
    const blackWins = sc.black > sc.white;
    const title = this.mode === 'cpu' ? (blackWins ? 'You win!' : 'CPU wins') : `${blackWins ? 'Black' : 'White'} wins!`;
    this.status.setText(title);
    this.passBtn.setLabel('Pass');
    endGame(this, {
      id: 'go', mode: this.mode, title,
      lines: [`${this.name(1)} ${sc.black}  -  ${sc.white} ${this.name(2)}`, '(stones + territory, White +6.5)'],
      outcome: blackWins ? 'w' : 'l', margin: Math.min(1, Math.abs(sc.black - sc.white) / 30), onAgain: () => this.restart(),
    });
  }
}
