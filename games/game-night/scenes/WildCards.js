import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record } from '../save.js';
import {
  COLORS, newRound, canPlay, playableIdx, play, drawOne, passTurn, winner, top, cpuPick, favouriteColor,
} from '../logic/wildcards.js';

const COLOR_HEX = [PALETTE.red, PALETTE.orange, PALETTE.indigo, PALETTE.leaf];
const NAMES = ['You', 'Lefty', 'Righty'];
const frameOf = (c) => {
  if (c.value === 'wild' || c.value === 'wild4') return c.color === null || c.color === undefined ? c.value : `c${c.color}_wild`;
  return `c${c.color}_${c.value}`;
};

export class WildCards extends Phaser.Scene {
  constructor() { super('WildCards'); }

  init() { this.mode = 'cpu'; }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Wild Cards', () => go(this, 'Menu'));
    this.layer = this.add.container(0, 0);
    this.status = text(this, WIDTH / 2, 352, '', { color: PALETTE.cream });
    this.actionBtns = this.add.container(0, 0);
    this.newRound();
  }

  newRound() {
    this.r = newRound(3);
    this.over = false;
    this.busy = false;
    this.drawn = -1;
    this.draw();
    this.next();
  }

  // ---------- drawing ----------
  draw() {
    this.layer.removeAll(true);
    const r = this.r;
    // Opponents
    [1, 2].forEach((p) => {
      const x = p === 1 ? 90 : WIDTH - 90;
      const active = r.turn === p && !this.over;
      const g = this.add.graphics();
      g.fillStyle(hex(active ? PALETTE.gold : PALETTE.night)).fillRect(x - 76, 70, 152, 84);
      g.fillStyle(hex(PALETTE.indigo)).fillRect(x - 73, 73, 146, 78);
      this.layer.add(g);
      this.layer.add(text(this, x, 88, NAMES[p], { color: active ? PALETTE.gold : PALETTE.cream }));
      const n = r.hands[p].length;
      const shown = Math.min(n, 8);
      for (let k = 0; k < shown; k++) {
        this.layer.add(this.add.image(x - (shown - 1) * 6 + k * 12, 124, 'wild', 'back').setScale(1.5));
      }
      this.layer.add(text(this, x + 56, 124, String(n), { color: PALETTE.gold }));
    });
    // Piles
    this.layer.add(text(this, WIDTH / 2, 176, r.dir === 1 ? 'Play goes  -->' : '<--  Play goes', { color: PALETTE.lavender }));
    const deck = this.add.image(WIDTH / 2 - 56, 262, 'wild', 'back').setScale(4).setInteractive({ useHandCursor: true });
    deck.on('pointerup', () => this.humanDraw());
    this.layer.add(deck);
    this.layer.add(text(this, WIDTH / 2 - 56, 324, 'Draw', { color: PALETTE.cream }));
    const cg = this.add.graphics();
    cg.fillStyle(hex(COLOR_HEX[r.color])).fillRect(WIDTH / 2 + 18, 204, 76, 116);
    this.layer.add(cg);
    this.layer.add(this.add.image(WIDTH / 2 + 56, 262, 'wild', frameOf(top(r))).setScale(4));
    this.layer.add(text(this, WIDTH / 2 + 56, 330, COLORS[r.color], { color: PALETTE.cream }));
    // Your hand: rows of up to 9, overlapping.
    const hand = r.hands[0];
    const myTurn = r.turn === 0 && !this.over;
    const rows = Math.max(1, Math.ceil(hand.length / 9));
    hand.forEach((c, i) => {
      const row = Math.floor(i / 9); const col = i % 9;
      const inRow = Math.min(9, hand.length - row * 9);
      const spacing = inRow > 1 ? Math.min(52, 300 / (inRow - 1)) : 0;
      const x = WIDTH / 2 - ((inRow - 1) * spacing) / 2 + col * spacing;
      const ok = myTurn && (this.drawn < 0 ? canPlay(r, c) : i === this.drawn);
      const y = 600 - (rows - 1 - row) * 84 - (ok ? 12 : 0);
      const img = this.add.image(x, y, 'wild', frameOf(c)).setScale(3).setInteractive({ useHandCursor: true });
      if (myTurn && !ok) img.setTint(0x9a9a9a);
      img.on('pointerup', () => this.humanPlay(i));
      this.layer.add(img);
    });
  }

  // ---------- flow ----------
  next() {
    const w = winner(this.r);
    if (w >= 0) { this.finish(w); return; }
    this.draw();
    if (this.r.turn !== 0) {
      this.status.setText(`${NAMES[this.r.turn]} is thinking...`);
      this.busy = true;
      this.time.delayedCall(800, () => this.cpuTurn());
    } else {
      this.status.setText(playableIdx(this.r, 0).length ? 'Your turn: play a raised card' : 'No match: tap the deck to draw');
    }
  }

  announce(ev) {
    const who = NAMES[ev.player];
    const tgt = ev.target !== undefined ? NAMES[ev.target] : '';
    const msg = {
      skip: `${tgt} is skipped!`, reverse: 'Direction reversed!', draw2: `${tgt} draws 2!`, draw4: `${tgt} draws 4!`,
    }[ev.effect];
    if (msg) toast(this, msg, 400);
    if (this.r.hands[ev.player].length === 1) toast(this, `${who}: last card!`, 430);
  }

  cpuTurn() {
    const p = this.r.turn;
    let i = cpuPick(this.r, p);
    if (i < 0) {
      const d = drawOne(this.r);
      if (canPlay(this.r, this.r.hands[p][d])) i = d;
      else { toast(this, `${NAMES[p]} draws`, 400); passTurn(this.r); this.busy = false; this.next(); return; }
    }
    const ev = play(this.r, p, i, favouriteColor(this.r.hands[p]));
    this.announce(ev);
    this.busy = false;
    this.next();
  }

  humanPlay(i) {
    if (this.over || this.busy || this.r.turn !== 0) return;
    const c = this.r.hands[0][i];
    if (this.drawn >= 0 && i !== this.drawn) { toast(this, 'Play the card you drew, or keep it', 400); return; }
    if (!canPlay(this.r, c)) { toast(this, "That card doesn't match", 400); return; }
    const commit = (color) => {
      this.drawn = -1;
      this.actionBtns.removeAll(true);
      const ev = play(this.r, 0, i, color);
      this.announce(ev);
      this.next();
    };
    if (c.value === 'wild' || c.value === 'wild4') {
      const m = modal(this, 'Pick a colour', [], COLORS.map((name, k) => [name, () => { m.destroy(); commit(k); }, COLOR_HEX[k], PALETTE.cream]));
      return;
    }
    commit(c.color);
  }

  humanDraw() {
    if (this.over || this.busy || this.r.turn !== 0 || this.drawn >= 0) return;
    if (playableIdx(this.r, 0).length) { toast(this, 'You have a card you can play', 400); return; }
    const d = drawOne(this.r);
    if (canPlay(this.r, this.r.hands[0][d])) {
      this.drawn = d;
      this.status.setText('You drew a playable card');
      this.actionBtns.removeAll(true);
      this.actionBtns.add(button(this, WIDTH / 2, 392, 160, 40, 'Keep it', () => {
        this.drawn = -1; this.actionBtns.removeAll(true); passTurn(this.r); this.next();
      }));
      this.draw();
    } else {
      toast(this, 'No luck - turn passes', 400);
      passTurn(this.r);
      this.next();
    }
  }

  finish(w) {
    this.over = true;
    this.draw();
    record('wildcards', w === 0 ? 'w' : 'l');
    const title = w === 0 ? 'You win!' : `${NAMES[w]} wins`;
    this.status.setText(title);
    this.time.delayedCall(700, () => {
      const m = modal(this, title, [w === 0 ? 'You played your last card' : 'Better luck next round'], [
        ['Play again', () => { m.destroy(); this.newRound(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
