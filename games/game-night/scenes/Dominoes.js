import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';
import { TARGET, SIDES, newRound, ends, playable, playTile, draw, passTurn, roundResult, cpuChoice, pips, layoutTable, LEVELS } from '../logic/dominoes.js';
import { getSkill, tune } from '../adaptive.js';


const PIPS = {
  0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

/** Domino centred at (cx,cy). vertical: a on top. horizontal: a on the left. h = half size. */
function domino(g, cx, cy, a, b, h, vertical, { face = PALETTE.cream, glow, alpha = 1 } = {}) {
  const w = vertical ? h : h * 2; const ht = vertical ? h * 2 : h;
  const x = Math.round(cx - w / 2); const y = Math.round(cy - ht / 2);
  if (glow) g.fillStyle(hex(glow), alpha).fillRect(x - 3, y - 3, w + 6, ht + 6);
  g.fillStyle(hex(PALETTE.ink), alpha).fillRect(x, y, w, ht);
  g.fillStyle(hex(face), alpha).fillRect(x + 2, y + 2, w - 4, ht - 4);
  g.fillStyle(hex(PALETTE.lavender), alpha);
  if (vertical) g.fillRect(x + 3, y + h - 1, w - 6, 2); else g.fillRect(x + h - 1, y + 3, 2, ht - 6);
  const pip = Math.max(2, Math.round(h / 7));
  const half = (v, hx, hy) => {
    g.fillStyle(hex(PALETTE.ink), alpha);
    for (const [px, py] of PIPS[v]) {
      const ccx = hx + (h / 4) * (px + 1); const ccy = hy + (h / 4) * (py + 1);
      g.fillRect(Math.round(ccx - pip / 2), Math.round(ccy - pip / 2), pip, pip);
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

// Board area. Tiles are laid out by layoutTable() (logic/dominoes.js), which shrinks them when a
// long round would otherwise run off the table.
const AREA = { x0: 10, x1: WIDTH - 10, y0: 128, y1: 398 };
const CENTER = { x: WIDTH / 2, y: 262 };

const HAND_H = 26;

export class Dominoes extends Phaser.Scene {
  constructor() { super('Dominoes'); }

  init(data) { this.mode = 'cpu'; this.cfg = tune(LEVELS, getSkill('dominoes')); }

  create() {
    setBackground(this, PALETTE.leaf);
    header(this, 'Dominoes', () => go(this, 'Menu'));
    this.scoreText = text(this, WIDTH / 2, 70, '', { color: PALETTE.cream });
    this.status = text(this, WIDTH / 2, 94, '', { color: PALETTE.night });
    this.cpuRow = this.add.graphics();
    this.table = this.add.graphics();
    this.targets = this.add.container(0, 0).setDepth(20);
    this.endsText = text(this, WIDTH / 2, 416, '', { color: PALETTE.night });
    this.handG = this.add.graphics();
    this.handZones = this.add.container(0, 0);
    this.drawBtn = button(this, WIDTH / 2, 606, 220, 44, 'Draw', () => this.humanDraw(), { fill: PALETTE.gold });
    this.scores = [0, 0];
    this.lastWinner = null;
    this.newRound();
  }

  newRound() {
    // The winner of the last round leads with any tile; the first round (and after a block) the highest double leads.
    this.r = newRound(Math.random, this.lastWinner ?? null);
    this.voids = new Set();   // numbers you've shown you don't have (the CPU remembers on Hard)
    this.over = false;
    this.busy = false;
    this.selected = -1;
    this.lastPlay = null;
    this.refresh();
    this.next();
  }

  // ---------- drawing ----------
  refresh() {
    const r = this.r;
    this.scoreText.setText(`You ${this.scores[0]}   CPU ${this.scores[1]}   (first to ${TARGET})`);
    this.cpuRow.clear();
    const n = r.hands[1].length;
    const shown = Math.min(n, 14);
    for (let k = 0; k < shown; k++) back(this.cpuRow, WIDTH / 2 - (shown * 14) / 2 + k * 14, 106, 11);

    this.table.clear();
    this.targets.removeAll(true);
    this.layout = r.center ? layoutTable(r, AREA, CENTER) : null;
    if (r.center) {
      const cv = r.spinner; // a double is laid crosswise
      const H = this.layout.h;
      const lastIsCenter = this.lastPlay?.side === 'center';
      domino(this.table, CENTER.x, CENTER.y, r.center[0], r.center[1], H, cv, { glow: lastIsCenter ? PALETTE.red : r.spinner ? PALETTE.gold : undefined });
      for (const side of SIDES) {
        const arm = r.arms[side];
        const slots = this.layout.arms[side];
        arm.forEach(([inner, outer], k) => {
          const s = slots[k];
          // Draw so the inner value faces back toward the centre.
          const [a, b] = (s.dir[0] < 0 || s.dir[1] < 0) ? [outer, inner] : [inner, outer];
          const last = this.lastPlay?.side === side && k === arm.length - 1;
          domino(this.table, s.x, s.y, a, b, H, s.vertical, { glow: last ? PALETTE.red : undefined });
        });
      }
    }
    const e = ends(r);
    this.endsText.setText(r.center
      ? `Open ends: ${e.map((x) => x.value).join('  ')}     Boneyard ${r.boneyard.length}`
      : `Boneyard ${r.boneyard.length}`);

    // Hand
    this.handG.clear();
    this.handZones.removeAll(true);
    const hand = r.hands[0];
    const myTurn = r.turn === 0 && !this.over && !this.busy;
    const can = new Map(myTurn ? playable(r, 0).map((o) => [o.i, o.sides]) : []);
    const perRow = hand.length > 20 ? 11 : 10; const hw = HAND_H + 6;
    hand.forEach(([a, b], i) => {
      const row = Math.floor(i / perRow); const col = i % perRow;
      const inRow = Math.min(perRow, hand.length - row * perRow);
      const x = WIDTH / 2 - (inRow * hw) / 2 + col * hw + HAND_H / 2;
      const y = 470 + row * (HAND_H * 2 + 12);
      const ok = can.has(i);
      const sel = i === this.selected;
      domino(this.handG, x, y - (sel ? 14 : ok ? 6 : 0), a, b, HAND_H, true, {
        face: ok ? PALETTE.cream : PALETTE.lavender, glow: sel ? PALETTE.red : ok ? PALETTE.gold : undefined,
      });
      const z = this.add.zone(x, y, HAND_H + 6, HAND_H * 2 + 16).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.pick(i));
      this.handZones.add(z);
    });
    // Where the selected tile could go
    if (this.selected >= 0 && can.has(this.selected)) this.showTargets(can.get(this.selected));
    const stuck = myTurn && !can.size;
    this.drawBtn.setVisible(stuck);
    this.drawBtn.setLabel(r.boneyard.length ? 'Draw a tile' : 'Pass');
  }

  showTargets(sides) {
    const r = this.r;
    const H = this.layout.h;
    for (const side of sides) {
      if (side === 'center') continue;
      const slot = this.layout.arms[side][r.arms[side].length];
      const w = slot.vertical ? H : H * 2; const h = slot.vertical ? H * 2 : H;
      // Drawn at the tile's size, but the tap area is at least 44px so it's easy to hit.
      const zone = this.add.rectangle(slot.x, slot.y, w + 6, h + 6, hex(PALETTE.gold), 0.55).setStrokeStyle(3, hex(PALETTE.red));
      const hit = this.add.zone(slot.x, slot.y, Math.max(44, w + 10), Math.max(44, h + 10)).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.commit(this.selected, side));
      this.targets.add(hit);
      this.tweens.add({ targets: zone, alpha: 0.35, yoyo: true, repeat: -1, duration: 400 });
      this.targets.add(zone);
    }
  }

  // ---------- flow ----------
  next() {
    const res = roundResult(this.r);
    if (res) { this.endRound(res); return; }
    if (this.r.turn === 1) {
      const lead = this.r.hands[1][this.r.lead.i];
      this.status.setText(this.r.center ? 'CPU is playing...' : this.r.lead.i === null ? 'CPU won last round and leads' : lead && lead[0] === lead[1] ? 'CPU leads with the highest double' : 'CPU leads its heaviest tile');
      this.busy = true;
      this.refresh();
      this.time.delayedCall(800, () => this.cpuStep());
    } else {
      const opts = playable(this.r, 0);
      const lead = this.r.hands[0][this.r.lead.i];
      if (!this.r.center) this.status.setText(this.r.lead.i === null ? 'You won last round: lead any tile' : lead && lead[0] === lead[1] ? 'You lead: tap your highest double' : 'No doubles out: lead your heaviest tile');
      else this.status.setText(opts.length ? 'Tap a glowing tile, then where to play it' : 'No match: draw from the boneyard');
      this.refresh();
    }
  }

  cpuStep() {
    const c = cpuChoice(this.r, 1, { cfg: this.cfg, voids: this.voids });
    if (c) {
      this.r = playTile(this.r, 1, c.i, c.side);
      this.lastPlay = { side: c.side };
      sfx('place');
      this.busy = false;
      this.next();
    } else if (this.r.boneyard.length) {
      this.r = draw(this.r, 1);
      sfx('card');
      this.refresh();
      this.time.delayedCall(350, () => this.cpuStep());
    } else {
      toast(this, 'CPU passes', 416);
      this.r = passTurn(this.r);
      this.busy = false;
      this.next();
    }
  }

  pick(i) {
    if (this.over || this.busy || this.r.turn !== 0) return;
    const opt = playable(this.r, 0).find((o) => o.i === i);
    if (!opt) {
      toast(this, this.r.center ? "That tile doesn't match an open end" : 'Lead with the glowing tile', 416);
      return;
    }
    if (opt.sides[0] === 'center') { this.commit(i, 'center'); return; }
    this.selected = this.selected === i ? -1 : i;
    sfx('select');
    this.refresh();
  }

  commit(i, side) {
    this.selected = -1;
    this.r = playTile(this.r, 0, i, side);
    this.lastPlay = { side };
    sfx('place');
    this.next();
  }

  humanDraw() {
    if (this.over || this.busy || this.r.turn !== 0) return;
    ends(this.r).forEach((e) => this.voids.add(e.value));
    if (this.r.boneyard.length) { this.r = draw(this.r, 0); sfx('card'); toast(this, 'You draw a tile', 416); }
    else { this.r = passTurn(this.r); toast(this, 'You pass', 416); }
    this.next();
  }

  endRound(res) {
    this.over = true;
    this.refresh();
    if (res.winner !== null) this.scores[res.winner] += res.points;
    this.lastWinner = res.winner;
    sfx(res.winner === 0 ? 'win' : res.winner === 1 ? 'lose' : 'place');
    const matchOver = this.scores.some((s) => s >= TARGET);
    const blocked = !this.r.hands[0].length || !this.r.hands[1].length ? '' : 'Blocked! ';
    const who = res.winner === null ? 'Blocked - tie' : `${blocked}${res.winner === 0 ? 'You win the round' : 'CPU wins the round'}`;
    const lines = [res.winner === null ? 'No points' : `+${res.points} points`, `You ${this.scores[0]}  CPU ${this.scores[1]}`];
    this.time.delayedCall(900, () => {
      if (matchOver) {
        const youWon = this.scores[0] >= TARGET;
        record('dominoes', youWon ? 'w' : 'l', Math.min(1, Math.abs(this.scores[0] - this.scores[1]) / 100));
        const m = modal(this, youWon ? 'You win the match!' : 'CPU wins the match', lines, [
          ['New match', () => { m.destroy(); this.scores = [0, 0]; this.lastWinner = null; this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      } else {
        const m = modal(this, who, [...lines, `Pips left: you ${pips(this.r.hands[0])}, CPU ${pips(this.r.hands[1])}`], [
          ['Next round', () => { m.destroy(); this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      }
    });
  }
}
