import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast, modal } from './common.js';
import { record } from '../save.js';
import {
  COLORS, TARGET, newRound, canPlay, playableIdx, play, drawOne, passTurn, winner, top, cpuPick, favouriteColor,
  resolveWild4, penalty, handPoints, nextPlayer, LEVELS,
} from '../logic/wildcards.js';
import { getSkill, tune } from '../adaptive.js';

import { sfx } from '../../../shared/core/sfx.js';

const COLOR_HEX = [PALETTE.red, PALETTE.orange, PALETTE.indigo, PALETTE.leaf];
const NAMES = ['You', 'Lefty', 'Righty'];
const frameOf = (c) => {
  if (c.value === 'wild' || c.value === 'wild4') return c.color === null || c.color === undefined ? c.value : `c${c.color}_wild`;
  return `c${c.color}_${c.value}`;
};

export class WildCards extends Phaser.Scene {
  constructor() { super('WildCards'); }

  init(data) { this.mode = 'cpu'; this.cfg = tune(LEVELS, getSkill('wildcards')); }

  create() {
    setBackground(this, PALETTE.wine);
    header(this, 'Wild Cards', () => go(this, 'Menu'));
    this.layer = this.add.container(0, 0);
    this.status = text(this, WIDTH / 2, 352, '', { color: PALETTE.cream });
    this.actionBtns = this.add.container(0, 0).setDepth(30);
    this.scores = [0, 0, 0];
    this.newRound();
  }

  newRound() {
    this.r = newRound(3);
    this.lacks = [new Set(), new Set(), new Set()];   // colours each player has shown they don't hold
    this.over = false;
    this.busy = false;
    this.drawn = -1;
    this.calledUno = false;
    this.catchable = undefined;
    const fx = {
      skip: 'First card is a Skip: you miss a turn', reverse: 'First card is a Reverse: Righty starts',
      draw2: 'First card is a Draw Two: you draw 2', wild: 'First card is Wild: you pick the colour',
    }[this.r.startEffect];
    if (fx) toast(this, fx, 440);
    this.draw();
    this.time.delayedCall(fx ? 900 : 0, () => this.next());
  }

  // ---------- drawing ----------
  draw() {
    this.layer.removeAll(true);
    const r = this.r;
    [1, 2].forEach((p) => {
      const x = p === 1 ? 90 : WIDTH - 90;
      const active = r.turn === p && !this.over;
      const g = this.add.graphics();
      g.fillStyle(hex(active ? PALETTE.gold : PALETTE.night)).fillRect(x - 76, 64, 152, 92);
      g.fillStyle(hex(PALETTE.indigo)).fillRect(x - 73, 67, 146, 86);
      this.layer.add(g);
      this.layer.add(text(this, x, 80, `${NAMES[p]}  ${this.scores[p]}`, { color: active ? PALETTE.gold : PALETTE.cream }));
      const n = r.hands[p].length;
      const shown = Math.min(n, 8);
      for (let k = 0; k < shown; k++) this.layer.add(this.add.image(x - (shown - 1) * 6 + k * 12, 118, 'wild', 'back').setScale(1.5));
      this.layer.add(text(this, x + 56, 118, String(n), { color: PALETTE.gold }));
      if (n === 1) this.layer.add(text(this, x, 142, 'UNO!', { color: PALETTE.gold }));
    });
    this.layer.add(text(this, WIDTH / 2, 176, `${r.dir === 1 ? 'Play goes  -->' : '<--  Play goes'}    You ${this.scores[0]} / ${TARGET}`, { color: PALETTE.lavender }));
    const deck = this.add.image(WIDTH / 2 - 56, 262, 'wild', 'back').setScale(4).setInteractive({ useHandCursor: true });
    deck.on('pointerup', () => this.humanDraw());
    this.layer.add(deck);
    this.layer.add(text(this, WIDTH / 2 - 56, 324, 'Draw', { color: PALETTE.cream }));
    const cg = this.add.graphics();
    cg.fillStyle(hex(r.color === null ? PALETTE.lavender : COLOR_HEX[r.color])).fillRect(WIDTH / 2 + 18, 204, 76, 116);
    this.layer.add(cg);
    this.layer.add(this.add.image(WIDTH / 2 + 56, 262, 'wild', frameOf(top(r))).setScale(4));
    if (top(r).value === 'wild4' && top(r).color !== null) {
      // A played +4 shows its chosen colour; keep the "+4" readable on it.
      this.layer.add(text(this, WIDTH / 2 + 56 + 1, 262 + 2, '+4', { size: 32, color: PALETTE.ink }));
      this.layer.add(text(this, WIDTH / 2 + 56, 262, '+4', { size: 32, color: PALETTE.cream }));
    }
    this.layer.add(text(this, WIDTH / 2 + 56, 330, r.color === null ? 'Any' : COLORS[r.color], { color: PALETTE.cream }));

    const hand = r.hands[0];
    const myTurn = r.turn === 0 && !this.over && !this.busy;
    // Up to 3 rows; very big hands squeeze more cards into each row instead of a 4th row.
    const per = Math.max(9, Math.ceil(hand.length / 3));
    const rows = Math.max(1, Math.ceil(hand.length / per));
    const rowGap = rows > 2 ? 70 : 84;   // 3 rows stay clear of the Keep it / UNO buttons
    hand.forEach((c, i) => {
      const row = Math.floor(i / per); const col = i % per;
      const inRow = Math.min(per, hand.length - row * per);
      const spacing = inRow > 1 ? Math.min(52, 300 / (inRow - 1)) : 0;
      const x = WIDTH / 2 - ((inRow - 1) * spacing) / 2 + col * spacing;
      const ok = myTurn && (this.drawn < 0 ? canPlay(r, c) : i === this.drawn);
      const y = 600 - (rows - 1 - row) * rowGap - (ok ? 12 : 0);
      const img = this.add.image(x, y, 'wild', frameOf(c)).setScale(3).setInteractive({ useHandCursor: true });
      if (myTurn && !ok) img.setTint(0x9a9a9a);
      img.on('pointerup', () => this.humanPlay(i));
      this.layer.add(img);
    });
    this.drawButtons();
  }

  drawButtons() {
    this.actionBtns.removeAll(true);
    const r = this.r;
    if (this.drawn >= 0) {
      this.actionBtns.add(button(this, WIDTH / 2, 392, 160, 40, 'Keep it', () => {
        this.drawn = -1; passTurn(this.r); this.next();
      }));
    }
    // Call "UNO!" on your turn while you hold two cards, before you play the second-to-last one.
    if (r.turn === 0 && !this.over && !this.busy && r.hands[0].length === 2 && !this.calledUno) {
      this.actionBtns.add(button(this, WIDTH - 60, 392, 96, 40, 'UNO!', () => {
        this.calledUno = true; toast(this, 'You: UNO!', 440); this.drawButtons();
      }, { fill: PALETTE.gold }));
    }
    if (this.catchable !== undefined) {
      this.actionBtns.add(button(this, 60, 392, 96, 40, 'Catch!', () => this.catchCpu(), { fill: PALETTE.red, color: PALETTE.cream }));
    }
  }

  // ---------- flow ----------
  next() {
    if (this.r.hands[0].length > 2) this.calledUno = false;   // drew back up: the old call no longer counts
    this.draw();
    const w = winner(this.r);
    if (w >= 0) { this.finishRound(w); return; }
    if (this.r.color === null && this.r.turn === 0) {
      this.chooseColor((k) => { this.r.color = k; this.next(); });
      return;
    }
    if (this.r.turn !== 0) {
      this.status.setText(`${NAMES[this.r.turn]} is thinking...`);
      this.busy = true;
      this.draw();
      this.time.delayedCall(850, () => this.cpuTurn());
    } else {
      this.status.setText(playableIdx(this.r, 0).length ? 'Your turn: play a raised card or draw' : 'No match: tap the deck to draw');
    }
  }

  chooseColor(done) {
    const m = modal(this, 'Pick a colour', [], COLORS.map((name, k) => [name, () => { m.destroy(); done(k); }, COLOR_HEX[k], PALETTE.cream]));
  }

  announce(ev) {
    const you = ev.target === 0;
    const tgt = ev.target !== undefined ? NAMES[ev.target] : '';
    const msg = {
      skip: you ? 'You are skipped!' : `${tgt} is skipped!`,
      reverse: 'Direction reversed!',
      draw2: you ? 'You draw 2 and miss a turn!' : `${tgt} draws 2 and is skipped!`,
    }[ev.effect];
    if (msg) toast(this, msg, 440);
  }

  cpuTurn() {
    const p = this.r.turn;
    let i = cpuPick(this.r, p, { cfg: this.cfg, lacks: this.lacks });
    if (i < 0) {
      this.lacks[p].add(this.r.color);
      sfx('card');
      const d = drawOne(this.r);
      if (canPlay(this.r, this.r.hands[p][d])) i = d;
      else { toast(this, `${NAMES[p]} draws`, 440); passTurn(this.r); this.busy = false; this.next(); return; }
    }
    const card = this.r.hands[p][i];
    const rest = this.r.hands[p].filter((_, k) => k !== i);
    const color = favouriteColor(rest, Math.random() < this.cfg.smart ? this.lacks[nextPlayer(this.r)] : null);
    const ev = play(this.r, p, i, color);
    if (card.color !== null) this.lacks[p].delete(card.color);
    sfx('card');
    this.announce(ev);
    // CPUs usually remember to call Uno (always on Hard); when they forget you get a moment to catch them.
    if (this.r.hands[p].length === 1) {
      if (Math.random() < this.cfg.uno) toast(this, `${NAMES[p]}: UNO!`, 190);
      else {
        this.catchable = p;
        this.time.delayedCall(2600, () => { if (this.catchable === p) { this.catchable = undefined; this.drawButtons(); } });
      }
    }
    if (ev.effect === 'wild4') { this.handleWild4(ev); return; }
    this.busy = false;
    this.next();
  }

  catchCpu() {
    const p = this.catchable;
    if (p === undefined) return;
    this.catchable = undefined;
    penalty(this.r, p, 2);
    toast(this, `Caught ${NAMES[p]}! They draw 2`, 190);
    this.draw();
  }

  handleWild4(ev) {
    const target = ev.target;
    const prevColor = this.r.discard[this.r.discard.length - 2]?.color;
    const finishWith = (challenge) => {
      const out = resolveWild4(this.r, challenge);
      const draws = (p, n) => (p === 0 ? `You draw ${n}` : `${NAMES[p]} draws ${n}`);
      toast(this, {
        accepted: `${draws(target, 4)} and ${target === 0 ? 'miss a turn' : 'is skipped'}`,
        caught: `Illegal +4! ${draws(ev.player, 4)} instead`,
        failed: `Challenge failed: ${draws(target, 6)}`,
      }[out], 440);
      this.busy = false;
      this.next();
    };
    if (target === 0) {
      this.busy = false;
      const colourName = prevColor === null || prevColor === undefined ? 'matching' : COLORS[prevColor];
      const m = modal(this, 'Wild Draw Four!', [`${NAMES[ev.player]} played +4 on you.`, 'Challenge if you think they', `still had a ${colourName} card.`], [
        ['Accept (draw 4)', () => { m.destroy(); finishWith(false); }],
        ['Challenge', () => { m.destroy(); finishWith(true); }],
      ]);
      return;
    }
    // A CPU may challenge your +4. Hard challenges more when it hasn't seen you short of that colour.
    if (ev.player === 0) {
      const prev = this.r.discard[this.r.discard.length - 2]?.color;
      const chance = this.lacks[0].has(prev) ? this.cfg.challenge * 0.25 : this.cfg.challenge;
      finishWith(Math.random() < chance);
    } else finishWith(false);
  }

  humanPlay(i) {
    if (this.over || this.busy || this.r.turn !== 0) return;
    const c = this.r.hands[0][i];
    if (this.drawn >= 0 && i !== this.drawn) { toast(this, 'Play the card you drew, or keep it', 440); return; }
    if (!canPlay(this.r, c)) { toast(this, "That card doesn't match", 440); return; }
    const commit = (color) => {
      const goingToOne = this.r.hands[0].length === 2;
      this.drawn = -1;
      if (c.color !== null) this.lacks[0].delete(c.color);
      sfx('card');
      const ev = play(this.r, 0, i, color);
      this.announce(ev);
      if (goingToOne && !this.calledUno && Math.random() < 0.75) {
        penalty(this.r, 0, 2);
        toast(this, "Caught! You didn't call UNO: +2", 190);
      }
      this.calledUno = false;   // a new call is needed the next time you get down to two cards
      if (ev.effect === 'wild4') { this.handleWild4(ev); return; }
      this.next();
    };
    if (c.value === 'wild' || c.value === 'wild4') { this.chooseColor(commit); return; }
    commit(c.color);
  }

  humanDraw() {
    if (this.over || this.busy || this.r.turn !== 0 || this.drawn >= 0) return;
    if (!playableIdx(this.r, 0).length) this.lacks[0].add(this.r.color);
    sfx('card');
    const d = drawOne(this.r);
    if (canPlay(this.r, this.r.hands[0][d])) {
      this.drawn = d;
      this.status.setText('You drew a playable card: play it or keep it');
      this.draw();
    } else {
      toast(this, 'No luck - turn passes', 440);
      passTurn(this.r);
      this.next();
    }
  }

  finishRound(w) {
    this.over = true;
    this.catchable = undefined;
    const pts = this.r.hands.reduce((s, h, p) => (p === w ? s : s + handPoints(h)), 0);
    this.scores[w] += pts;
    sfx(w === 0 ? 'win' : 'lose');
    this.draw();
    const matchOver = this.scores[w] >= TARGET;
    const title = w === 0 ? 'You win the round!' : `${NAMES[w]} wins the round`;
    this.status.setText(title);
    const lines = [`+${pts} points`, `You ${this.scores[0]}  Lefty ${this.scores[1]}  Righty ${this.scores[2]}`];
    this.time.delayedCall(700, () => {
      if (matchOver) {
        record('wildcards', w === 0 ? 'w' : 'l', Math.min(1, (Math.max(...this.scores) - [...this.scores].sort((a, b) => b - a)[1]) / 300));
        const m = modal(this, w === 0 ? 'You win the match!' : `${NAMES[w]} wins the match`, lines, [
          ['New match', () => { m.destroy(); this.scores = [0, 0, 0]; this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      } else {
        const m = modal(this, title, [...lines, `First to ${TARGET} wins`], [
          ['Next round', () => { m.destroy(); this.newRound(); }],
          ['Menu', () => go(this, 'Menu')],
        ]);
      }
    });
  }
}
