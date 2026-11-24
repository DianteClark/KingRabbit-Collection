import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';
import { sfx } from '../../../shared/core/sfx.js';
import { newGame, turnSequences, apply, rollDice, winner, other, cpuTurn, pipCount, winType, openingRoll, LEVELS } from '../logic/backgammon.js';
import { getSkill, tune } from '../adaptive.js';


// Layout: 12 points per row, 6 | bar | 6. Light (player 0) moves 24 -> 1, home bottom-right.
const PW = 24;                  // point width (8px sprite x3)
const BAR = 24;
const BX = (WIDTH - (PW * 12 + BAR)) / 2;
const TOP = 128;
const HALF = 132;               // height of each half
const MID = TOP + HALF + 20;    // y where the bottom half starts
const BOTTOM = MID + HALF;
const STACK = 5;                // checkers drawn before "+n"

function pointX(i) {
  // Bottom row: points 1..12, right to left. Top row: 13..24, left to right.
  const col = i <= 12 ? 12 - i : i - 13;
  return BX + col * PW + (col >= 6 ? BAR : 0) + PW / 2;
}
const isTop = (i) => i >= 13;

export class Tables extends Phaser.Scene {
  constructor() { super('Tables'); }

  init(data) { this.mode = data.mode ?? 'cpu'; this.cfg = tune(LEVELS, getSkill('tables'), ['look']); }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Tables', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 84, '', { color: PALETTE.cream });
    this.info = text(this, WIDTH / 2, 108, '', { color: PALETTE.lavender });

    // Board
    const g = this.add.graphics();
    const w = PW * 12 + BAR;
    g.fillStyle(hex(PALETTE.red)).fillRect(BX - 8, TOP - 8, w + 16, BOTTOM - TOP + 16);
    g.fillStyle(hex(PALETTE.leaf)).fillRect(BX, TOP, w, BOTTOM - TOP);
    g.fillStyle(hex(PALETTE.wine)).fillRect(BX + PW * 6, TOP - 8, BAR, BOTTOM - TOP + 16);
    for (let i = 1; i <= 24; i++) {
      const dark = i % 2 === 0;
      const frame = isTop(i) ? (dark ? 'pointDarkDown' : 'pointLightDown') : (dark ? 'pointDarkUp' : 'pointLightUp');
      this.add.image(pointX(i), isTop(i) ? TOP : BOTTOM, 'tables', frame).setOrigin(0.5, isTop(i) ? 0 : 1).setScale(3, 3.5);
    }
    this.hl = this.add.graphics().setDepth(5);
    this.checkers = this.add.container(0, 0).setDepth(10);

    // Bear-off tray (tap target) + dice + buttons
    this.offZone = this.add.rectangle(WIDTH / 2, BOTTOM + 30, 300, 34, hex(PALETTE.indigo)).setInteractive();
    this.offText = text(this, WIDTH / 2, BOTTOM + 30, '', { color: PALETTE.cream });
    this.offZone.on('pointerup', () => this.tapTarget('off'));
    this.diceImgs = [0, 1, 2, 3].map((k) => this.add.image(124 + k * 34, BOTTOM + 84, 'tables', 'd1').setScale(2.5).setVisible(false));
    this.rollBtn = button(this, WIDTH / 2 + 110, BOTTOM + 84, 100, 44, 'Roll', () => this.humanRoll(), { fill: PALETTE.gold });
    this.undoBtn = button(this, WIDTH / 2 - 130, BOTTOM + 84, 72, 44, 'Undo', () => this.undo());

    this.input.on('pointerup', (p, over) => {
      if (over.length) return;
      const pt = this.pointAt(p.x, p.y);
      if (pt !== null) this.tapPoint(pt);
    });
    this.restart();
  }

  restart() {
    this.s = newGame();
    this.over = false;
    this.dice = [];
    this.selected = null;
    // Opening roll: one die each, higher goes first and plays both numbers.
    const o = openingRoll();
    this.s = { ...this.s, turn: o.first };
    const [a, b] = o.dice;
    toast(this, `Opening roll: ${this.name(0)} ${a}, ${this.name(1)} ${b}`, 440);
    this.startTurn(o.first === 0 ? [a, b] : [b, a]);
  }

  name(p) {
    if (this.mode === 'pvp') return p === 0 ? 'Light' : 'Dark';
    return p === 0 ? 'You' : 'CPU';
  }

  isCpu() { return this.mode === 'cpu' && this.s.turn === 1; }

  pointAt(x, y) {
    if (y < TOP || y > BOTTOM) return null;
    const bx = x - BX;
    if (bx >= PW * 6 && bx < PW * 6 + BAR) return 'bar';
    let col = Math.floor((bx >= PW * 6 + BAR ? bx - BAR : bx) / PW);
    if (col < 0 || col > 11) return null;
    return y < MID - 10 ? 13 + col : 12 - col;
  }

  // ---------- turn flow ----------
  startTurn(preset) {
    this.dice = [];
    this.selected = null;
    this.turnStart = null;
    this.draw();
    this.rollBtn.setEnabled(!this.isCpu() && !preset);
    this.undoBtn.setVisible(false);
    if (this.isCpu()) {
      this.status.setText(preset ? 'CPU won the opening roll' : 'CPU is rolling...');
      this.time.delayedCall(preset ? 1400 : 600, () => this.cpuPlay(preset));
    } else if (preset) {
      this.time.delayedCall(900, () => this.humanRoll(preset));
    } else {
      this.status.setText(`${this.name(this.s.turn)}: tap Roll`);
    }
  }

  humanRoll(preset) {
    if (this.over || this.dice.length || this.isCpu()) return;
    this.dice = Array.isArray(preset) ? preset.slice() : rollDice();
    sfx('roll');
    this.used = [];
    this.turnStart = { s: this.s, dice: this.dice.slice() };
    this.rollBtn.setEnabled(false);
    this.undoBtn.setVisible(true);
    this.refreshOptions();
  }

  refreshOptions() {
    this.seqs = turnSequences(this.s, this.dice);
    this.draw();
    if (!this.seqs.length || !this.seqs[0].moves.length) {
      const msg = this.turnStart && this.turnStart.dice.length === this.dice.length ? 'No legal moves' : 'Turn complete';
      if (msg === 'No legal moves') toast(this, msg, 600);
      this.time.delayedCall(msg === 'No legal moves' ? 900 : 400, () => this.endTurn());
      return;
    }
    this.status.setText(`${this.name(this.s.turn)}: move ${this.dice.join(' ')}`);
  }

  firstSteps() {
    // Unique single moves that begin some maximal sequence.
    const seen = new Map();
    for (const r of this.seqs) {
      const m = r.moves[0];
      seen.set(`${m.from}>${m.to}>${m.die}`, m);
    }
    return [...seen.values()];
  }

  tapPoint(pt) {
    if (this.over || this.isCpu() || !this.dice.length) return;
    const steps = this.firstSteps();
    if (this.selected !== null) {
      const choice = steps.filter((m) => m.from === this.selected && m.to === pt);
      if (choice.length) { this.doStep(choice.sort((a, b) => a.die - b.die)[0]); return; }
    }
    this.selected = steps.some((m) => m.from === pt) ? pt : null;
    this.draw();
  }

  tapTarget(t) {
    if (t !== 'off' || this.selected === null) return;
    const steps = this.firstSteps().filter((m) => m.from === this.selected && m.to === 'off');
    if (steps.length) this.doStep(steps.sort((a, b) => a.die - b.die)[0]);
  }

  doStep(m) {
    this.s = apply(this.s, m);
    sfx(m.hit ? 'capture' : 'move');
    if (m.hit) toast(this, 'Hit!', 600);
    const k = this.dice.indexOf(m.die);
    this.dice.splice(k, 1);
    this.selected = null;
    if (winner(this.s) !== null) { this.draw(); this.finish(); return; }
    this.refreshOptions();
  }

  undo() {
    if (!this.turnStart || this.isCpu()) return;
    this.s = this.turnStart.s;
    this.dice = this.turnStart.dice.slice();
    this.selected = null;
    this.refreshOptions();
  }

  endTurn() {
    if (this.over) return;
    this.s = { ...this.s, turn: other(this.s.turn) };
    this.startTurn();
  }

  cpuPlay(preset) {
    this.dice = preset ? preset.slice() : rollDice();
    sfx('roll');
    this.status.setText(`CPU rolled ${this.dice.slice(0, 2).join(' ')}${this.dice.length === 4 ? ' (double)' : ''}`);
    this.draw();
    const pick = cpuTurn(this.s, this.dice, { cfg: this.cfg });
    if (!pick || !pick.moves.length) {
      toast(this, 'CPU has no moves', 600);
      this.time.delayedCall(1000, () => this.endTurn());
      return;
    }
    // Play the CPU's moves one at a time so you can follow them.
    const steps = pick.moves.slice();
    const stepOnce = () => {
      if (!steps.length) { this.time.delayedCall(400, () => this.endTurn()); return; }
      const m = steps.shift();
      this.s = apply(this.s, m);
      sfx(m.hit ? 'capture' : 'move');
      this.dice.splice(this.dice.indexOf(m.die), 1);
      this.lastCpu = m;
      this.draw();
      if (winner(this.s) !== null) { this.finish(); return; }
      this.time.delayedCall(450, stepOnce);
    };
    this.time.delayedCall(700, stepOnce);
  }

  // ---------- drawing ----------
  stackPos(i, k) {
    const x = pointX(i);
    const y = isTop(i) ? TOP + 12 + k * 24 : BOTTOM - 12 - k * 24;
    return { x, y };
  }

  draw() {
    this.checkers.removeAll(true);
    this.hl.clear();
    const frame = (p) => (p === 0 ? 'light' : 'dark');
    for (let i = 1; i <= 24; i++) {
      const pt = this.s.pts[i];
      if (!pt.n) continue;
      const shown = Math.min(pt.n, STACK);
      for (let k = 0; k < shown; k++) {
        const { x, y } = this.stackPos(i, k);
        this.checkers.add(this.add.image(x, y, 'tables', frame(pt.owner)).setScale(3));
      }
      if (pt.n > STACK) {
        const { x, y } = this.stackPos(i, STACK - 1);
        this.checkers.add(text(this, x, y, String(pt.n), { color: pt.owner === 0 ? PALETTE.night : PALETTE.cream }));
      }
    }
    // Bar
    for (const p of [0, 1]) {
      for (let k = 0; k < this.s.bar[p]; k++) {
        const y = p === 0 ? MID + 20 + k * 20 : MID - 40 - k * 20;
        this.checkers.add(this.add.image(BX + PW * 6 + BAR / 2, y, 'tables', frame(p)).setScale(3));
      }
    }
    // Highlights for the human
    if (!this.isCpu() && this.dice.length && this.seqs?.length) {
      const steps = this.firstSteps();
      const froms = new Set(steps.map((m) => m.from));
      for (const f of froms) this.markPoint(f, PALETTE.gold, 0.3);
      if (this.selected !== null) {
        this.markPoint(this.selected, PALETTE.gold, 0.7);
        for (const m of steps.filter((x) => x.from === this.selected)) {
          if (m.to === 'off') this.hl.lineStyle(3, hex(PALETTE.gold)).strokeRect(WIDTH / 2 - 150, BOTTOM + 13, 300, 34);
          else this.markPoint(m.to, PALETTE.cream, 0.55);
        }
      }
    }
    // Dice
    this.diceImgs.forEach((im, k) => {
      const d = this.dice[k];
      im.setVisible(Boolean(d));
      if (d) im.setFrame(`d${d}`);
    });
    this.offText.setText(`Borne off: ${this.name(0)} ${this.s.off[0]}  ${this.name(1)} ${this.s.off[1]}`);
    this.info.setText(`Pips: ${this.name(0)} ${pipCount(this.s, 0)}  ${this.name(1)} ${pipCount(this.s, 1)}`);
  }

  markPoint(i, color, alpha) {
    if (i === 'bar') {
      this.hl.fillStyle(hex(color), alpha).fillRect(BX + PW * 6, MID - 10, BAR, 40);
      return;
    }
    const x = pointX(i) - PW / 2;
    this.hl.fillStyle(hex(color), alpha).fillRect(x, isTop(i) ? TOP : MID - 10 + 10, PW, HALF - 10);
  }

  finish() {
    this.over = true;
    const w = winner(this.s);
    const kind = winType(this.s, w);
    const title = this.mode === 'cpu' ? (w === 0 ? 'You win!' : 'CPU wins') : `${this.name(w)} wins!`;
    this.status.setText(`${title} ${kind.name}`);
    endGame(this, {
      id: 'tables', mode: this.mode, title,
      lines: [kind.name, `Worth ${kind.points} point${kind.points > 1 ? 's' : ''}`], outcome: w === 0 ? 'w' : 'l', margin: kind.points / 3, onAgain: () => this.restart(),
    });
  }
}
