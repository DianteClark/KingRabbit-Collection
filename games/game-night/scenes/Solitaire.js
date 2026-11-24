import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record } from '../save.js';
import { deal, drawStock, bestMove, move, won, canAutoFinish, autoStep, SUITS, RANKS, isRed } from '../logic/solitaire.js';

const CW = 44;
const CH = 60;
const GAP = 5;
const X0 = (WIDTH - (CW * 7 + GAP * 6)) / 2;
const colX = (i) => X0 + i * (CW + GAP);
const TOP_ROW = 72;
const TAB_Y = 146;
const MAX_Y = 584;

export class Solitaire extends Phaser.Scene {
  constructor() { super('Solitaire'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.leaf);
    header(this, 'Solitaire', () => go(this, 'Menu'));
    this.layer = this.add.container(0, 0);
    this.movesText = text(this, WIDTH - 16, 34, '', { origin: [1, 0.5], color: PALETTE.cream });
    this.movesText.setVisible(false);
    button(this, 70, 614, 110, 40, 'Undo', () => this.undo());
    button(this, WIDTH / 2, 614, 110, 40, 'New deal', () => this.newDeal());
    this.autoBtn = button(this, WIDTH - 70, 614, 110, 40, 'Finish', () => this.autoFinish(), { fill: PALETTE.gold });
    this.input.on('pointerup', (p) => this.tap(p.x, p.y));
    this.newDeal();
  }

  newDeal() {
    this.g = deal();
    this.history = [];
    this.done = false;
    this.draw();
  }

  push(next) {
    this.history.push(this.g);
    if (this.history.length > 200) this.history.shift();
    this.g = next;
    this.draw();
    if (won(this.g)) this.win();
  }

  undo() {
    if (this.done || !this.history.length) return;
    this.g = this.history.pop();
    this.draw();
  }

  // ---------- drawing ----------
  card(x, y, c) {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, CW, CH);
    if (!c.up) {
      g.fillStyle(hex(PALETTE.indigo)).fillRect(x + 2, y + 2, CW - 4, CH - 4);
      g.fillStyle(hex(PALETTE.lavender));
      for (let yy = 6; yy < CH - 6; yy += 6) for (let xx = 6 + ((yy / 6) % 2) * 3; xx < CW - 6; xx += 6) g.fillRect(x + xx, y + yy, 2, 2);
      this.layer.add(g);
      return;
    }
    g.fillStyle(hex(PALETTE.cream)).fillRect(x + 2, y + 2, CW - 4, CH - 4);
    this.layer.add(g);
    const col = isRed(c) ? PALETTE.red : PALETTE.night;
    this.layer.add(text(this, x + 5, y + 11, RANKS[c.rank], { origin: [0, 0.5], color: col }));
    this.layer.add(this.add.image(x + CW - 11, y + 11, 'cards', SUITS[c.suit]).setScale(2));
    this.layer.add(this.add.image(x + CW / 2, y + CH / 2 + 8, 'cards', SUITS[c.suit]).setScale(3));
  }

  slot(x, y, label) {
    const g = this.add.graphics();
    g.lineStyle(2, hex(PALETTE.cream), 0.5).strokeRect(x + 1, y + 1, CW - 2, CH - 2);
    this.layer.add(g);
    if (label) this.layer.add(text(this, x + CW / 2, y + CH / 2, label, { color: PALETTE.cream }).setAlpha(0.5));
  }

  draw() {
    this.layer.removeAll(true);
    this.hits = [];
    const g = this.g;
    // Stock
    if (g.stock.length) this.card(colX(0), TOP_ROW, { up: false });
    else this.slot(colX(0), TOP_ROW, g.waste.length ? 'O' : '');
    this.hits.push({ x: colX(0), y: TOP_ROW, w: CW, h: CH, src: { from: 'stock' } });
    // Waste
    if (g.waste.length) {
      this.card(colX(1), TOP_ROW, g.waste[g.waste.length - 1]);
      this.hits.push({ x: colX(1), y: TOP_ROW, w: CW, h: CH, src: { from: 'waste' } });
    } else this.slot(colX(1), TOP_ROW);
    // Foundations
    g.foundations.forEach((f, i) => {
      const x = colX(3 + i);
      if (f.length) {
        this.card(x, TOP_ROW, f[f.length - 1]);
        this.hits.push({ x, y: TOP_ROW, w: CW, h: CH, src: { from: 'foundation', i } });
      } else {
        this.slot(x, TOP_ROW);
        this.layer.add(this.add.image(x + CW / 2, TOP_ROW + CH / 2, 'cards', SUITS[i]).setScale(3).setAlpha(0.35));
      }
    });
    // Tableau: squeeze the spacing on long columns so they fit.
    g.tableau.forEach((pile, i) => {
      const x = colX(i);
      if (!pile.length) { this.slot(x, TAB_Y, 'K'); return; }
      const downs = pile.filter((c) => !c.up).length;
      const ups = pile.length - downs;
      let upGap = 20;
      const need = downs * 8 + (ups - 1) * upGap + CH;
      if (TAB_Y + need > MAX_Y) upGap = Math.max(10, (MAX_Y - TAB_Y - CH - downs * 8) / Math.max(1, ups - 1));
      let y = TAB_Y;
      pile.forEach((c, k) => {
        this.card(x, y, c);
        const last = k === pile.length - 1;
        const h = last ? CH : (c.up ? upGap : 8);
        if (c.up) this.hits.push({ x, y, w: CW, h, src: { from: 'tableau', i, k } });
        y += c.up ? upGap : 8;
      });
    });
    this.autoBtn.setVisible(canAutoFinish(g) && !won(g));
    this.movesText.setText(`Moves ${g.moves}`);
  }

  // ---------- input ----------
  tap(x, y) {
    if (this.done) return;
    const hit = [...this.hits].reverse().find((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
    if (!hit) return;
    if (hit.src.from === 'stock') {
      const n = drawStock(this.g);
      if (n) this.push(n);
      return;
    }
    const dst = bestMove(this.g, hit.src);
    if (!dst) { this.cameras.main.shake(60, 0.003); return; }
    this.push(move(this.g, hit.src, dst));
  }

  autoFinish() {
    if (!canAutoFinish(this.g)) return;
    const stepOnce = () => {
      const n = autoStep(this.g);
      if (!n) return;
      this.g = n;
      this.draw();
      if (won(this.g)) { this.win(); return; }
      this.time.delayedCall(70, stepOnce);
    };
    stepOnce();
  }

  win() {
    if (this.done) return;
    this.done = true;
    record('solitaire', 'w');
    toast(this, 'All four suits complete!', 300);
    this.time.delayedCall(900, () => {
      const m = modal(this, 'You win!', [`Finished in ${this.g.moves} moves`], [
        ['New deal', () => { m.destroy(); this.newDeal(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
