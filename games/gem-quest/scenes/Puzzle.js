import { Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, header, icon, modal, sfx, toast } from './common.js';
import { BoardView } from './boardview.js';
import { PUZZLES, newPuzzle, puzzleMove, solve } from '../logic/puzzle.js';
import { cloneBoard, gemsLeft } from '../logic/board.js';
import { getProgress, setProgress } from '../save.js';
import { REGIONS } from '../logic/world.js';
import * as PR from '../logic/progress.js';
import { give } from '../awards.js';
import { MAP_ART } from '../art.js';
import { DEBUG } from '../debug.js';

const REWARD = 100;

export class Puzzle extends Phaser.Scene {
  constructor() { super('Puzzle'); }

  init(data) {
    this.id = data.id;
    this.region = data.region ?? 0;
    this.fails = data.fails || 0;
    this.ps = newPuzzle(this.id);
    this.history = [];
    this.busy = false;
  }

  create() {
    const P = PUZZLES[this.id];
    setBackground(this, REGIONS[this.region].bg);
    header(this, 'Riddle stone', () => go(this, 'WorldMap', { region: this.region }));
    icon(this, 36, 82, MAP_ART.puzzle, 1);
    text(this, 64, 70, P.name, { origin: [0, 0.5], color: PALETTE.gold });
    text(this, 64, 94, 'Clear every gem.', { origin: [0, 0.5], color: PALETTE.cream });
    this.movesText = text(this, WIDTH - 12, 82, '', { origin: [1, 0.5], color: PALETTE.sand });
    this.board = new BoardView(this, this.ps.board, { x: 12, y: 132, cell: 42 });
    this.board.onSwap = (a, b) => this.swap(a, b);
    this.board.setEnabled(true);
    this.tip = text(this, WIDTH / 2, 494, P.tip, { wrap: WIDTH - 30, color: PALETTE.lavender });
    this.undoBtn = button(this, 64, 600, 108, 44, 'Undo', () => this.undo(), { fill: PALETTE.lavender });
    button(this, 180, 600, 108, 44, 'Restart', () => this.restart(), { fill: PALETTE.lavender });
    this.hintBtn = button(this, 296, 600, 108, 44, 'Hint', () => this.hint(), { fill: PALETTE.sand });
    this.refresh();
    if (DEBUG) window.__puzzle = this;
  }

  refresh() {
    this.movesText.setText(`Moves ${this.ps.movesLeft}`);
    this.undoBtn.setEnabled(this.history.length > 0 && !this.busy);
  }

  swap(a, b) {
    if (this.busy || this.ps.over) return;
    const before = { board: cloneBoard(this.ps.board), movesLeft: this.ps.movesLeft, made: this.ps.made };
    const res = puzzleMove(this.ps, a, b);
    this.busy = true;
    this.board.setEnabled(false);
    if (res.ok) this.history.push(before);
    this.board.play(res.steps).then(() => {
      this.busy = false;
      this.refresh();
      if (this.ps.over === 'win') this.win();
      else if (this.ps.over === 'lose') this.lose();
      else this.board.setEnabled(true);
    });
  }

  undo() {
    if (this.busy || !this.history.length || this._modals) return;
    const h = this.history.pop();
    Object.assign(this.ps, { board: h.board, movesLeft: h.movesLeft, made: h.made, over: null });
    this.board.sync(this.ps.board);
    this.board.setEnabled(true);
    sfx('flip');
    this.refresh();
  }

  restart() {
    if (this.busy || this._modals) return;
    go(this, 'Puzzle', { id: this.id, region: this.region, fails: this.fails });
  }

  hint() {
    if (this.busy || this._modals) return;
    const sol = solve(this.ps.board, this.ps.movesLeft);
    if (!sol) { toast(this, 'No way out from here. Undo or restart.', 470, PALETTE.orange); sfx('error'); return; }
    this.board.hint(sol[0].a, sol[0].b);
    sfx('select');
  }

  win() {
    sfx('win');
    const p = getProgress();
    const first = !p.cleared[this.id];
    if (first) { p.cleared[this.id] = true; p.gold += REWARD; setProgress(p); }
    if (PR.puzzlesDone(p)) give('puzzles');
    modal(this, 'Riddle solved!', first ? `The stone glows and opens.\n+${REWARD} gold (you have ${p.gold}).` : 'Solved again. Well done!', [
      ['Back to map', () => go(this, 'WorldMap', { region: this.region })],
    ]);
  }

  lose() {
    sfx('lose');
    this.fails++;
    const left = gemsLeft(this.ps.board);
    modal(this, 'Stuck!', `${left} gem${left === 1 ? '' : 's'} left and ${this.ps.movesLeft ? 'no moves' : 'no moves left'}.`, [
      ['Undo last move', (close) => { close(); this.undo(); }],
      ['Start over', (close) => { close(); this.restart(); }, PALETTE.lavender],
      ['Back to map', () => go(this, 'WorldMap', { region: this.region }), PALETTE.indigo, PALETTE.cream],
    ]);
  }
}

export { hex };
