import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record } from '../save.js';
import { TARGET, newRound, playable, playTile, draw, passTurn, roundResult, cpuChoice, pips } from '../logic/dominoes.js';

// Pip layout on a 3x3 grid for 0..6
const PIPS = {
  0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

/** Draw a domino into graphics g. (x,y) = top-left. h = size of one half. */
function domino(g, x, y, a, b, h, vertical, { face = PALETTE.cream, glow } = {}) {
  const w = vertical ? h : h * 2; const ht = vertical ? h * 2 : h;
  if (glow) g.fillStyle(hex(glow)).fillRect(x - 3, y - 3, w + 6, ht + 6);
  g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, w, ht);
  g.fillStyle(hex(face)).fillRect(x + 2, y + 2, w - 4, ht - 4);
  g.fillStyle(hex(PALETTE.lavender));
  if (vertical) g.fillRect(x + 4, y + h - 1, w - 8, 2); else g.fillRect(x + h - 1, y + 4, 2, ht - 8);
  const pip = Math.max(2, Math.round(h / 7));
  const half = (v, hx, hy) => {
    g.fillStyle(hex(PALETTE.ink));
    for (const [px, py] of PIPS[v]) {
      const cx = hx + (h / 4) * (px + 1); const cy = hy + (h / 4) * (py + 1);
      g.fillRect(Math.round(cx - pip / 2), Math.round(cy - pip / 2), pip, pip);
    }
  };
  half(a, x, y);
  if (vertical) half(b, x, y + h); else half(b, x + h, y);
}

function back(g, x, y, h) {
  g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, h, h * 2);
  g.fillStyle(hex(PALETTE.indigo)).fillRect(x + 2, y + 2, h - 4, h * 2 - 4);
  g.fillStyle(hex(PALETTE.lavender)).fillRect(x + h / 2 - 2, y + h - 2, 4, 4);
}

const CHAIN_H = 18;
const CHAIN_TOP = 150;
const HAND_H = 28;

export class Dominoes extends Phaser.Scene {
  constructor() { super('Dominoes'); }

  init() { this.mode = 'cpu'; }

  create() {
    setBackground(this, PALETTE.leaf);
    header(this, 'Dominoes', () => go(this, 'Menu'));
    this.scoreText = text(this, WIDTH / 2, 76, '', { color: PALETTE.cream });
    this.status = text(this, WIDTH / 2, 100, '', { color: PALETTE.night });
    this.cpuRow = this.add.graphics();
    this.table = this.add.graphics();
    this.endsText = text(this, WIDTH / 2, 404, '', { color: PALETTE.night });
    this.handG = this.add.graphics();
    this.handZones = this.add.container(0, 0);
    this.drawBtn = button(this, WIDTH / 2, 600, 200, 44, 'Draw', () => this.humanDraw(), { fill: PALETTE.gold });
    this.scores = [0, 0];
    this.newRound();
  }

  newRound() {
    this.r = newRound();
    this.over = false;
    this.busy = false;
    this.refresh();
    this.next();
  }

  refresh() {
    const r = this.r;
    this.scoreText.setText(`You ${this.scores[0]}   CPU ${this.scores[1]}   (to ${TARGET})`);
    // CPU hand as backs
    this.cpuRow.clear();
    const n = r.hands[1].length;
    const w = Math.min(n, 12) * 16;
    for (let k = 0; k < Math.min(n, 12); k++) back(this.cpuRow, WIDTH / 2 - w / 2 + k * 16, 116, 12);
    // Chain, wrapped in rows of 8 tiles
    this.table.clear();
    const per = 8; const tw = CHAIN_H * 2 + 4;
    r.chain.forEach(([a, b], k) => {
      const row = Math.floor(k / per); const col = k % per;
      const rowCount = Math.min(per, r.chain.length - row * per);
      const x0 = WIDTH / 2 - (rowCount * tw) / 2;
      const glow = (k === 0 || k === r.chain.length - 1) && r.chain.length > 1 ? PALETTE.gold : undefined;
      domino(this.table, x0 + col * tw, CHAIN_TOP + row * (CHAIN_H + 10), a, b, CHAIN_H, false, { glow });
    });
    this.endsText.setText(r.ends ? `Ends:  ${r.ends[0]}  and  ${r.ends[1]}   Boneyard ${r.boneyard.length}` : `Boneyard ${r.boneyard.length}`);
    // Human hand
    this.handG.clear();
    this.handZones.removeAll(true);
    const hand = r.hands[0];
    const canPlay = new Set(r.turn === 0 ? playable(r, 0).map((o) => o.i) : []);
    const perRow = 9; const hw = HAND_H + 6;
    hand.forEach(([a, b], i) => {
      const row = Math.floor(i / perRow); const col = i % perRow;
      const rowCount = Math.min(perRow, hand.length - row * perRow);
      const x = WIDTH / 2 - (rowCount * hw) / 2 + col * hw;
      const y = 436 + row * (HAND_H * 2 + 10);
      const ok = canPlay.has(i);
      domino(this.handG, x, y - (ok ? 6 : 0), a, b, HAND_H, true, { face: ok ? PALETTE.cream : PALETTE.lavender, glow: ok ? PALETTE.gold : undefined });
      const z = this.add.zone(x + HAND_H / 2, y + HAND_H, HAND_H + 4, HAND_H * 2 + 8).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.humanPlay(i));
      this.handZones.add(z);
    });
    const stuck = r.turn === 0 && !canPlay.size && !this.over;
    this.drawBtn.setVisible(stuck);
    this.drawBtn.setLabel(r.boneyard.length ? 'Draw' : 'Pass');
  }

  next() {
    const res = roundResult(this.r);
    if (res) { this.endRound(res); return; }
    if (this.r.turn === 1) {
      this.status.setText('CPU is playing...');
      this.busy = true;
      this.time.delayedCall(700, () => this.cpuStep());
    } else {
      this.status.setText(playable(this.r, 0).length ? 'Your turn: tap a glowing tile' : 'No match: draw from the boneyard');
    }
  }

  cpuStep() {
    const c = cpuChoice(this.r, 1);
    if (c) {
      this.r = playTile(this.r, 1, c.i, c.side);
      this.busy = false;
      this.refresh(); this.next();
    } else if (this.r.boneyard.length) {
      this.r = draw(this.r, 1);
      this.refresh();
      this.time.delayedCall(350, () => this.cpuStep());
    } else {
      toast(this, 'CPU passes', 560);
      this.r = passTurn(this.r);
      this.busy = false;
      this.refresh(); this.next();
    }
  }

  humanPlay(i) {
    if (this.over || this.busy || this.r.turn !== 0) return;
    const opt = playable(this.r, 0).find((o) => o.i === i);
    if (!opt) { toast(this, "That tile doesn't match an end", 560); return; }
    const tile = this.r.hands[0][i];
    const ends = this.r.ends;
    if (opt.sides.length === 2 && ends && ends[0] !== ends[1]) {
      const m = modal(this, 'Which end?', [`Tile ${tile[0]}-${tile[1]}`], [
        [`Left (${ends[0]})`, () => { m.destroy(); this.commit(i, 'left'); }],
        [`Right (${ends[1]})`, () => { m.destroy(); this.commit(i, 'right'); }],
      ]);
      return;
    }
    this.commit(i, opt.sides[0]);
  }

  commit(i, sideName) {
    this.r = playTile(this.r, 0, i, sideName);
    this.refresh(); this.next();
  }

  humanDraw() {
    if (this.over || this.busy || this.r.turn !== 0) return;
    if (this.r.boneyard.length) this.r = draw(this.r, 0);
    else { this.r = passTurn(this.r); toast(this, 'You pass', 560); }
    this.refresh(); this.next();
  }

  endRound(res) {
    this.over = true;
    this.refresh();
    if (res.winner !== null) this.scores[res.winner] += res.points;
    const matchOver = this.scores.some((s) => s >= TARGET);
    const who = res.winner === null ? 'Blocked - tie' : res.winner === 0 ? 'You win the round' : 'CPU wins the round';
    const lines = [res.winner === null ? 'No points' : `+${res.points} points`, `You ${this.scores[0]}  CPU ${this.scores[1]}`];
    if (matchOver) {
      const youWon = this.scores[0] >= TARGET;
      record('dominoes', youWon ? 'w' : 'l');
      this.time.delayedCall(800, () => {
        const m = modal(this, youWon ? 'You win the match!' : 'CPU wins the match', lines, [
          ['New match', () => { m.destroy(); this.scores = [0, 0]; this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      });
    } else {
      this.time.delayedCall(800, () => {
        const m = modal(this, who, [...lines, `CPU had ${pips(this.r.hands[1])} pips left`], [
          ['Next round', () => { m.destroy(); this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      });
    }
  }
}
