import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record, save } from '../save.js';
import { deal, drawStock, bestMove, move, canMove, won, canAutoFinish, autoStep, hint, SUITS, RANKS, isRed } from '../logic/solitaire.js';
import { sfx } from '../../../shared/core/sfx.js';

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
    this.movesText = text(this, colX(2) + CW / 2 + 2, TOP_ROW + 30, '', { color: PALETTE.cream, align: 'center' }).setDepth(5);
    this.hintG = this.add.graphics().setDepth(40);
    button(this, 50, 614, 84, 40, 'Undo', () => this.undo());
    button(this, 140, 614, 84, 40, 'Hint', () => this.showHint());
    button(this, 230, 614, 84, 40, 'Deal', () => this.askDeal());
    this.autoBtn = button(this, 318, 614, 76, 40, 'Finish', () => this.autoFinish(), { fill: PALETTE.gold });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateClock() });
    this.input.on('pointerup', (p, over) => { if (!over.length) this.tap(p.x, p.y); });
    this.newDeal();
  }

  askDeal() {
    const m = modal(this, 'New deal', [`Now: draw ${this.drawCount()}`], [
      ['Draw 1', () => { m.destroy(); save.set('solitaireDraw', 1); this.newDeal(); }],
      ['Draw 3', () => { m.destroy(); save.set('solitaireDraw', 3); this.newDeal(); }],
      ['Cancel', () => m.destroy()],
    ]);
  }

  drawCount() { return save.get('solitaireDraw') === 3 ? 3 : 1; }

  updateClock() {
    if (this.done || !this.g) return;
    const t = Math.floor(this.elapsed / 1000);
    this.movesText.setText(`${this.g.moves}\nmoves\n${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  }

  showHint() {
    if (this.done) return;
    const h = hint(this.g);
    this.hintG.clear();
    if (!h) { toast(this, 'No moves left - try a new deal', 300); sfx('error'); return; }
    if (h.draw) { toast(this, 'Draw from the deck', 300); this.flashRect(colX(0), TOP_ROW, CH); return; }
    const src = [...this.hits].reverse().find((x) => x.src && JSON.stringify(x.src) === JSON.stringify(h.src));
    if (src) this.flashRect(src.x, src.y, CH);
    const dx = h.dst.to === 'foundation' ? colX(3 + h.dst.i) : colX(h.dst.i);
    const dy = h.dst.to === 'foundation' ? TOP_ROW : TAB_Y;
    this.flashRect(dx, dy, h.dst.to === 'foundation' ? CH : Math.max(CH, this.colBottom(h.dst.i) - TAB_Y));
  }

  colBottom(i) {
    const last = [...this.hits].reverse().find((x) => x.src?.from === 'tableau' && x.src.i === i);
    return last ? last.y + CH : TAB_Y + CH;
  }

  flashRect(x, y, h) {
    this.hintG.lineStyle(4, hex(PALETTE.gold)).strokeRect(x - 3, y - 3, CW + 6, h + 6);
    this.tweens.add({ targets: this.hintG, alpha: { from: 1, to: 0.2 }, yoyo: true, repeat: 3, duration: 220, onComplete: () => { this.hintG.clear(); this.hintG.setAlpha(1); } });
  }

  /** The clock only runs while the game is on screen (not behind How to Play, not after a win). */
  update(_, ms) {
    if (!this.done) this.elapsed += ms;
  }

  newDeal() {
    this.elapsed = 0;
    this.finishing = false;
    this.dealId = (this.dealId || 0) + 1;
    this.g = deal();
    this.history = [];
    this.done = false;
    this.sel = null;
    this.draw();
  }

  push(next) {
    this.sel = null;
    this.hintG?.clear();
    sfx(next.foundations.flat().length > this.g.foundations.flat().length ? 'coin' : 'card');
    this.history.push(this.g);
    if (this.history.length > 200) this.history.shift();
    this.g = next;
    this.draw();
    if (won(this.g)) this.win();
  }

  undo() {
    if (this.done || this.finishing) return;
    if (!this.history.length) { sfx('error'); return; }
    sfx('flip');
    this.sel = null;
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
    // Waste (draw 3 fans the top three; only the top one plays)
    if (g.waste.length) {
      const fan = this.drawCount() === 3 ? g.waste.slice(-3) : g.waste.slice(-1);
      fan.forEach((c, k) => this.card(colX(1) + k * 14, TOP_ROW, c));
      const tx = colX(1) + (fan.length - 1) * 14;
      this.hits.push({ x: tx, y: TOP_ROW, w: CW, h: CH, src: { from: 'waste' } });
      this.wasteX = tx;
    } else this.slot(colX(1), TOP_ROW);
    // Foundations
    g.foundations.forEach((f, i) => {
      const x = colX(3 + i);
      this.hits.push({ x, y: TOP_ROW, w: CW, h: CH, src: { from: 'foundation', i }, dst: { to: 'foundation', i } });
      if (f.length) {
        this.card(x, TOP_ROW, f[f.length - 1]);
      } else {
        this.slot(x, TOP_ROW);
        this.layer.add(this.add.image(x + CW / 2, TOP_ROW + CH / 2, 'cards', SUITS[i]).setScale(3).setAlpha(0.35));
      }
    });
    // Tableau: squeeze the spacing on long columns so they fit.
    g.tableau.forEach((pile, i) => {
      const x = colX(i);
      this.hits.push({ x, y: TAB_Y, w: CW, h: MAX_Y - TAB_Y, dst: { to: 'tableau', i } });
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
        if (c.up) this.hits.push({ x, y, w: CW, h, src: { from: 'tableau', i, k }, dst: { to: 'tableau', i } });
        y += c.up ? upGap : 8;
      });
    });
    // Selection outline around the picked card (and everything on top of it).
    if (this.sel) {
      const h = [...this.hits].reverse().find((x) => x.src && JSON.stringify(x.src) === JSON.stringify(this.sel));
      if (h) {
        let bottom = h.y + CH;
        if (this.sel.from === 'tableau') {
          const lastCard = [...this.hits].reverse().find((x) => x.src?.from === 'tableau' && x.src.i === this.sel.i);
          bottom = lastCard.y + CH;
        }
        const sg = this.add.graphics();
        sg.lineStyle(3, hex(PALETTE.gold)).strokeRect(h.x - 2, h.y - 2, CW + 4, bottom - h.y + 4);
        this.layer.add(sg);
      }
    }
    this.autoBtn.setVisible(canAutoFinish(g) && !won(g));
    this.updateClock();
  }

  // ---------- input ----------
  tap(x, y) {
    if (this.done || this.finishing) return;
    const under = this.hits.filter((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h).reverse(); // topmost first
    const hit = under.find((h) => h.src) || under.find((h) => h.dst);
    if (!hit) { this.sel = null; this.draw(); return; }
    if (hit.src?.from === 'stock') {
      this.sel = null;
      const n = drawStock(this.g, this.drawCount());
      if (n) this.push(n);
      return;
    }
    // A card is selected: try to drop it where you tapped.
    if (this.sel) {
      const dst = hit.dst || (hit.src?.from === 'foundation' ? { to: 'foundation', i: hit.src.i } : null);
      const same = hit.src && JSON.stringify(hit.src) === JSON.stringify(this.sel);
      if (same) {
        // Second tap on the same card: send it to its best spot.
        const best = bestMove(this.g, this.sel);
        const src = this.sel;
        this.sel = null;
        if (best) this.push(move(this.g, src, best)); else { this.draw(); this.cameras.main.shake(60, 0.003); }
        return;
      }
      if (dst && canMove(this.g, this.sel, dst)) {
        const src = this.sel;
        this.sel = null;
        this.push(move(this.g, src, dst));
        return;
      }
    }
    // Select the tapped card (if it can be moved at all).
    if (hit.src && hit.src.from !== 'stock') { this.sel = hit.src; sfx('select'); this.draw(); return; }
    this.sel = null;
    this.draw();
  }

  autoFinish() {
    if (this.finishing || !canAutoFinish(this.g)) return;
    this.finishing = true;
    this.sel = null;
    const deal = this.dealId;
    const stepOnce = () => {
      if (deal !== this.dealId) return;   // a new deal started meanwhile
      const n = autoStep(this.g);
      if (!n) { this.finishing = false; return; }
      this.g = n;
      sfx('card');
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
    sfx('win');
    // Bounce the foundation kings for a little celebration.
    this.cameras.main.flash(250, 240, 210, 110);
    toast(this, 'All four suits complete!', 300);
    this.time.delayedCall(900, () => {
      const m = modal(this, 'You win!', [`Finished in ${this.g.moves} moves`], [
        ['New deal', () => { m.destroy(); this.newDeal(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
