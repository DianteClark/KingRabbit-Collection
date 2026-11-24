import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, modal, setBackground } from './common.js';
import { CATEGORIES, totals, isComplete, UPPER_BONUS_AT, allowed, scoreFor, isYacht, grandTotal } from '../logic/yacht.js';
import { toast } from './common.js';
import { getBest, submitBest } from '../save.js';

const DIE_SCALE = 4;            // 12px dice -> 48px
const DICE_Y = 116;
const ROW_H = 23;
const CARD_TOP = 238;
const CARD_LEFT = 24;
const CARD_W = WIDTH - CARD_LEFT * 2;

export class Yacht extends Phaser.Scene {
  constructor() { super('Yacht'); }

  create() {
    setBackground(this, PALETTE.indigo);
    header(this, 'Yacht', () => go(this, 'Menu'));

    // Dice + hold frames
    this.dice = [];
    for (let i = 0; i < 5; i++) {
      const x = WIDTH / 2 + (i - 2) * 64;
      const hold = this.add.image(x, DICE_Y, 'yacht', 'hold').setScale(DIE_SCALE).setVisible(false);
      const die = this.add.image(x, DICE_Y, 'yacht', 'd1').setScale(DIE_SCALE).setInteractive({ useHandCursor: true });
      die.on('pointerup', () => this.toggleHold(i));
      this.dice.push({ die, hold, value: 1, held: false, baseY: DICE_Y });
    }
    this.hint = text(this, WIDTH / 2, 156, '', { color: PALETTE.lavender });
    this.rollBtn = button(this, WIDTH / 2, 196, 200, 44, 'Roll', () => this.roll(), { fill: PALETTE.gold });

    this.buildCard();
    this.newGame();
  }

  buildCard() {
    const g = this.add.graphics();
    const h = (CATEGORIES.length + 2) * ROW_H + 14;
    g.fillStyle(hex(PALETTE.orange)).fillRect(CARD_LEFT - 6, CARD_TOP - 8, CARD_W + 12, h + 4);
    g.fillStyle(hex(PALETTE.indigo)).fillRect(CARD_LEFT - 2, CARD_TOP - 4, CARD_W + 4, h - 4);

    this.rows = CATEGORIES.map((cat, i) => {
      // Upper section and lower section get a little gap between them (the bonus row).
      const y = CARD_TOP + 8 + i * ROW_H + (i >= 6 ? ROW_H : 0);
      const bg = this.add.rectangle(WIDTH / 2, y, CARD_W - 8, ROW_H - 3, hex(PALETTE.lavender), 0)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.pick(cat.id));
      const name = text(this, CARD_LEFT + 10, y, cat.name, { origin: [0, 0.5] });
      const val = text(this, CARD_LEFT + CARD_W - 10, y, '', { origin: [1, 0.5] });
      return { cat, bg, name, val };
    });
    const bonusY = CARD_TOP + 8 + 6 * ROW_H;
    this.bonusName = text(this, CARD_LEFT + 10, bonusY, `Bonus (${UPPER_BONUS_AT}+)`, { origin: [0, 0.5], color: PALETTE.lavender });
    this.bonusVal = text(this, CARD_LEFT + CARD_W - 10, bonusY, '', { origin: [1, 0.5], color: PALETTE.lavender });
    const totalY = CARD_TOP + 8 + (CATEGORIES.length + 1) * ROW_H + 8;
    this.totalText = text(this, CARD_LEFT + 10, totalY, '', { origin: [0, 0.5], color: PALETTE.gold });
    this.bestText = text(this, CARD_LEFT + CARD_W - 10, totalY, '', { origin: [1, 0.5], color: PALETTE.sand });
  }

  newGame() {
    this.card = {};
    this.newTurn();
  }

  newTurn() {
    this.rollsLeft = 3;
    this.rolled = false;
    this.dice.forEach((d) => { d.held = false; });
    this.refresh();
  }

  toggleHold(i) {
    if (!this.rolled || this.rolling) return;
    const d = this.dice[i];
    d.held = !d.held;
    this.refresh();
  }

  roll() {
    if (this.rollsLeft <= 0 || this.rolling) return;
    this.rolling = true;
    this.rollsLeft--;
    const rolling = this.dice.filter((d) => !d.held);
    rolling.forEach((d) => { d.value = Phaser.Math.Between(1, 6); });

    // Tumble: flick random faces and bounce, then land on the real values.
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
          this.refresh();
        }
      },
    });
    this.refresh();
  }

  pick(id) {
    if (!this.rolled || this.rolling || this.card[id] !== undefined) return;
    const dice = this.dice.map((d) => d.value);
    if (!allowed(this.card, dice).includes(id)) { toast(this, 'Joker rule: use the highlighted box', 220); return; }
    if (isYacht(dice) && this.card.yacht === 50) {
      this.card.yachtBonus = (this.card.yachtBonus || 0) + 100;
      toast(this, 'Yacht bonus +100!', 220);
    }
    this.card[id] = scoreFor(id, dice, this.card);
    if (isComplete(this.card)) { this.refresh(); this.finish(); return; }
    this.newTurn();
  }

  refresh() {
    const dice = this.dice.map((d) => d.value);
    this.dice.forEach((d) => {
      if (!this.rolling) d.die.setFrame(`d${d.value}`);
      d.die.setAlpha(this.rolled ? 1 : 0.35);
      d.hold.setVisible(d.held);
    });

    const left = this.rollsLeft;
    this.rollBtn.setLabel(left === 3 ? 'Roll' : `Roll again (${left})`).setEnabled(left > 0 && !this.rolling);
    if (!this.rolled) this.hint.setText('Roll the dice to start');
    else if (left > 0) this.hint.setText('Tap dice to hold, or pick a score');
    else this.hint.setText('Pick a score below');

    for (const r of this.rows) {
      const done = this.card[r.cat.id];
      if (done !== undefined) {
        r.val.setText(String(done)).setColor(PALETTE.cream);
        r.name.setColor(PALETTE.lavender);
        r.bg.setFillStyle(hex(PALETTE.lavender), 0);
      } else if (this.rolled && !this.rolling) {
        const ok = allowed(this.card, dice).includes(r.cat.id);
        const s = scoreFor(r.cat.id, dice, this.card);
        r.val.setText(ok ? String(s) : '-').setColor(ok && s ? PALETTE.gold : PALETTE.lavender);
        r.name.setColor(ok ? PALETTE.cream : PALETTE.lavender);
        r.bg.setFillStyle(hex(PALETTE.lavender), ok ? 0.18 : 0);
      } else {
        r.val.setText('-').setColor(PALETTE.lavender);
        r.name.setColor(PALETTE.cream);
        r.bg.setFillStyle(hex(PALETTE.lavender), 0);
      }
    }

    const t = totals(this.card);
    this.bonusVal.setText(t.bonus ? `+${t.bonus}` : `${t.upper}/${UPPER_BONUS_AT}`);
    const yb = this.card.yachtBonus ? ` (+${this.card.yachtBonus})` : '';
    this.totalText.setText(`Total ${grandTotal(this.card)}${yb}`);
    this.bestText.setText(`Best ${getBest('yacht')}`);
  }

  finish() {
    const total = grandTotal(this.card);
    const best = getBest('yacht');
    const isBest = submitBest('yacht', total);
    this.refresh();
    this.time.delayedCall(500, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [`Final score ${total}`, `Best ${Math.max(best, total)}`], [
        ['Play again', () => { m.destroy(); this.newGame(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}
