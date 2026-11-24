import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, modal, setBackground, toast } from './common.js';
import { CATEGORIES, totals, isComplete, UPPER_BONUS_AT, allowed, scoreFor, isYacht, grandTotal, cpuHold, cpuChoose, LEVELS } from '../logic/yacht.js';
import { getSkill, tune } from '../adaptive.js';

import { getBest, submitBest, record } from '../save.js';
import { sfx } from '../../../shared/core/sfx.js';

const DIE_SCALE = 4;            // 12px dice -> 48px
const DICE_Y = 108;
const ROW_H = 23;            // scorecard rows are tap targets: keep them as tall as fits
const CARD_TOP = 240;
const CARD_LEFT = 20;
const CARD_W = WIDTH - CARD_LEFT * 2;

export class Yacht extends Phaser.Scene {
  constructor() { super('Yacht'); }

  init(data) {
    this.mode = data.mode || 'solo';
    this.cfg = tune(LEVELS, getSkill('yacht'));
    this.players = [{ name: this.mode === 'pvp' ? 'P1' : 'You', card: {} }];
    if (this.mode === 'cpu') this.players.push({ name: 'CPU', card: {}, cpu: true });
    if (this.mode === 'pvp') this.players.push({ name: 'P2', card: {} });
  }

  create() {
    // Scene objects are reused between visits: never carry a half-finished roll over.
    this.rolling = false;
    this.rolled = false;
    this.pending = null;
    setBackground(this, PALETTE.indigo);
    header(this, 'Yacht', () => go(this, 'Menu'));
    this.dice = [];
    const dy = this.players.length > 1 ? DICE_Y + 8 : DICE_Y;
    for (let i = 0; i < 5; i++) {
      const x = WIDTH / 2 + (i - 2) * 64;
      const hold = this.add.image(x, dy, 'yacht', 'hold').setScale(DIE_SCALE).setVisible(false);
      const die = this.add.image(x, dy, 'yacht', 'd1').setScale(DIE_SCALE).setInteractive({ useHandCursor: true });
      die.on('pointerup', () => this.toggleHold(i));
      this.dice.push({ die, hold, value: 1, held: false, baseY: dy });
    }
    this.hint = text(this, WIDTH / 2, 150, '', { color: PALETTE.lavender });
    this.turnText = text(this, WIDTH / 2, 72, '', { color: PALETTE.gold }).setVisible(this.players.length > 1);
    this.rollBtn = button(this, WIDTH / 2, 182, 200, 40, 'Roll', () => this.roll(), { fill: PALETTE.gold });
    this.buildCard();
    this.newGame();
  }

  colX(p) {
    // Right-aligned value columns: one per player.
    if (this.players.length === 1) return CARD_LEFT + CARD_W - 10;
    return CARD_LEFT + CARD_W - 10 - (this.players.length - 1 - p) * 64;
  }

  buildCard() {
    const g = this.add.graphics();
    const h = (CATEGORIES.length + 3) * ROW_H + 10;
    g.fillStyle(hex(PALETTE.orange)).fillRect(CARD_LEFT - 6, CARD_TOP - 30, CARD_W + 12, h + 30);
    g.fillStyle(hex(PALETTE.indigo)).fillRect(CARD_LEFT - 2, CARD_TOP - 26, CARD_W + 4, h + 22);
    this.players.forEach((pl, p) => { pl.head = text(this, this.colX(p), CARD_TOP - 13, pl.name, { origin: [1, 0.5], color: PALETTE.sand }); });

    this.rows = CATEGORIES.map((cat, i) => {
      const y = CARD_TOP + 8 + i * ROW_H + (i >= 6 ? ROW_H : 0);
      const bg = this.add.rectangle(WIDTH / 2, y, CARD_W - 8, ROW_H - 1, hex(PALETTE.lavender), 0).setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.pick(cat.id));
      const name = text(this, CARD_LEFT + 10, y, cat.name, { origin: [0, 0.5] });
      const vals = this.players.map((_, p) => text(this, this.colX(p), y, '', { origin: [1, 0.5] }));
      return { cat, bg, name, vals };
    });
    const bonusY = CARD_TOP + 8 + 6 * ROW_H;
    text(this, CARD_LEFT + 10, bonusY, `Bonus (${UPPER_BONUS_AT}+)`, { origin: [0, 0.5], color: PALETTE.lavender });
    this.bonusVals = this.players.map((_, p) => text(this, this.colX(p), bonusY, '', { origin: [1, 0.5], color: PALETTE.lavender }));
    const totalY = CARD_TOP + 8 + (CATEGORIES.length + 1) * ROW_H + 4;
    text(this, CARD_LEFT + 10, totalY, 'Total', { origin: [0, 0.5], color: PALETTE.gold });
    this.totalVals = this.players.map((_, p) => text(this, this.colX(p), totalY, '', { origin: [1, 0.5], color: PALETTE.gold }));
    this.bestText = text(this, WIDTH / 2, totalY + 26, '', { color: PALETTE.sand });
  }

  get current() { return this.players[this.turn]; }

  newGame() {
    this.players.forEach((p) => { p.card = {}; });
    this.turn = 0;
    this.over = false;
    this.newTurn();
  }

  newTurn() {
    this.rollsLeft = 3;
    this.rolled = false;
    this.dice.forEach((d) => { d.held = false; });
    this.turnText.setText(this.current.name === 'You' ? 'Your turn' : `${this.current.name}'s turn`);
    this.refresh();
    if (this.current.cpu) this.time.delayedCall(700, () => this.cpuStep());
  }

  toggleHold(i) {
    if (!this.rolled || this.rolling || this.current.cpu || this.rollsLeft === 0) return;
    const d = this.dice[i];
    d.held = !d.held;
    sfx('select');
    this.refresh();
  }

  roll(done) {
    if (this.rollsLeft <= 0 || this.rolling || this.over) return;
    if (this.current.cpu && typeof done !== 'function') return;
    this.rolling = true;
    this.pending = null;
    this.rollsLeft--;
    sfx('roll');
    const rolling = this.dice.filter((d) => !d.held);
    rolling.forEach((d) => { d.value = Phaser.Math.Between(1, 6); });
    let ticks = 0;
    this.time.addEvent({
      delay: 60,
      repeat: 6,
      callback: () => {
        ticks++;
        rolling.forEach((d) => {
          d.die.setFrame(`d${Phaser.Math.Between(1, 6)}`);
          d.die.y = d.baseY - (ticks % 2 ? 6 : 0);
          d.die.angle = Phaser.Math.Between(-12, 12);
        });
        if (ticks === 7) {
          rolling.forEach((d) => { d.die.y = d.baseY; d.die.angle = 0; });
          this.rolling = false;
          this.rolled = true;
          if (isYacht(this.dice.map((x) => x.value))) { toast(this, 'YACHT!', 160); sfx('win'); }
          this.refresh();
          if (typeof done === 'function') done();
        }
      },
    });
    this.refresh();
  }

  cpuStep() {
    if (this.over || !this.current.cpu) return;
    const card = this.current.card;
    const values = () => this.dice.map((d) => d.value);
    if (!this.rolled) { this.roll(() => this.time.delayedCall(650, () => this.cpuStep())); return; }
    if (this.rollsLeft > 0) {
      const hold = cpuHold(values(), card, this.cfg);
      if (hold) {
        this.dice.forEach((d, i) => { d.held = hold[i]; });
        this.refresh();
        this.time.delayedCall(550, () => this.roll(() => this.time.delayedCall(650, () => this.cpuStep())));
        return;
      }
    }
    const id = cpuChoose(values(), card, this.cfg);
    this.time.delayedCall(400, () => this.score(id));
  }

  pick(id) {
    if (this.current.cpu || !this.rolled || this.rolling || this.over) return;
    const card = this.current.card;
    const dice = this.dice.map((d) => d.value);
    if (card[id] !== undefined || !allowed(card, dice).includes(id)) { this.score(id); return; }
    // Scoring a zero throws a box away: ask for a second tap so a slip of the thumb can't do it.
    if (scoreFor(id, dice, card) === 0 && this.pending !== id) {
      this.pending = id;
      sfx('error');
      this.refresh();
      return;
    }
    this.score(id);
  }

  score(id) {
    const card = this.current.card;
    if (!this.rolled || this.rolling || card[id] !== undefined || this.over) return;
    const dice = this.dice.map((d) => d.value);
    if (!allowed(card, dice).includes(id)) { toast(this, 'Joker rule: use the highlighted box', 220); sfx('error'); return; }
    if (isYacht(dice) && card.yacht === 50) {
      card.yachtBonus = (card.yachtBonus || 0) + 100;
      toast(this, 'Yacht bonus +100!', 220);
    }
    this.pending = null;
    card[id] = scoreFor(id, dice, card);
    sfx(card[id] ? 'coin' : 'place');
    if (this.players.every((p) => isComplete(p.card))) { this.refresh(); this.finish(); return; }
    this.turn = (this.turn + 1) % this.players.length;
    this.newTurn();
  }

  refresh() {
    const dice = this.dice.map((d) => d.value);
    const cpuTurn = this.current.cpu;
    this.dice.forEach((d) => {
      if (!this.rolling) d.die.setFrame(`d${d.value}`);
      d.die.setAlpha(this.rolled ? 1 : 0.35);
      d.hold.setVisible(d.held);
    });
    const left = this.rollsLeft;
    this.rollBtn.setLabel(left === 3 ? 'Roll' : `Roll again (${left})`).setEnabled(left > 0 && !this.rolling && !cpuTurn && !this.over);
    if (cpuTurn) this.hint.setText('CPU is playing...');
    else if (!this.rolled) this.hint.setText('Roll the dice to start');
    else if (this.pending) this.hint.setText(`Score 0 in ${CATEGORIES.find((c) => c.id === this.pending).name}? Tap again`);
    else if (left > 0) this.hint.setText('Tap dice to hold, or pick a score');
    else this.hint.setText('Pick a score below');

    const ok = this.rolled && !this.rolling ? allowed(this.current.card, dice) : [];
    for (const r of this.rows) {
      const cur = this.current.card[r.cat.id];
      const can = cur === undefined && ok.includes(r.cat.id) && !cpuTurn;
      if (can && this.pending === r.cat.id) r.bg.setFillStyle(hex(PALETTE.red), 0.6);
      else r.bg.setFillStyle(hex(PALETTE.lavender), can ? 0.18 : 0);
      r.name.setColor(cur === undefined ? PALETTE.cream : PALETTE.lavender);
      this.players.forEach((pl, p) => {
        const v = pl.card[r.cat.id];
        if (v !== undefined) r.vals[p].setText(String(v)).setColor(PALETTE.cream);
        else if (p === this.turn && ok.includes(r.cat.id)) {
          const s = scoreFor(r.cat.id, dice, pl.card);
          r.vals[p].setText(String(s)).setColor(s ? PALETTE.gold : PALETTE.lavender);
        } else r.vals[p].setText('-').setColor(PALETTE.lavender);
      });
    }
    this.players.forEach((pl, p) => {
      const t = totals(pl.card);
      this.bonusVals[p].setText(t.bonus ? `+${t.bonus}` : `${t.upper}/${UPPER_BONUS_AT}`);
      this.totalVals[p].setText(String(grandTotal(pl.card)));
      pl.head.setColor(p === this.turn && !this.over ? PALETTE.gold : PALETTE.sand);
    });
    this.bestText.setText(this.mode === 'pvp' ? '' : `Your best score: ${getBest('yacht')}`);
  }

  finish() {
    this.over = true;
    const all = this.players.map((p) => grandTotal(p.card));
    const mine = all[0];
    const best = getBest('yacht');
    const isBest = this.mode !== 'pvp' && submitBest('yacht', mine);
    this.refresh();
    let title; let lines;
    if (this.players.length === 1) {
      title = isBest ? 'New best!' : 'Game over';
      lines = [`Final score ${mine}`, `Best ${Math.max(best, mine)}`];
      sfx(isBest ? 'win' : 'place');
    } else {
      const [a, b] = all;
      const w = a === b ? null : a > b ? 0 : 1;
      title = w === null ? 'Tie game!' : this.mode === 'cpu' ? (w === 0 ? 'You win!' : 'CPU wins') : `${this.players[w].name} wins!`;
      lines = [`${this.players[0].name} ${a}  -  ${b} ${this.players[1].name}`];
      if (this.mode === 'cpu') record('yacht', w === null ? 'd' : w === 0 ? 'w' : 'l', Math.min(1, Math.abs(a - b) / 80));
      sfx(w === 1 && this.mode === 'cpu' ? 'lose' : 'win');
    }
    this.time.delayedCall(500, () => {
      const m = modal(this, title, lines, [
        ['Play again', () => { m.destroy(); this.newGame(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
