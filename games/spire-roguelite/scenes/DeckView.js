import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, HEIGHT, modal, sfx, dragScroll } from './common.js';
import { wideCard } from './cardview.js';
import { CARDS } from '../logic/cards.js';

const ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
const TOP = 56;
const BOTTOM = HEIGHT - 60;

/**
 * Overlay that lists cards. Launched on top of another scene (which it pauses and resumes).
 * data: { cards, title, from, subtitle,
 *         pick: { verb, preview(card) -> upgraded copy?, onPick(card) }, cancelLabel, onCancel, combat }
 */
export class DeckView extends Phaser.Scene {
  constructor() { super('Deck'); }

  init(data) { this.opts = data; this.chosen = null; }

  create() {
    const o = this.opts;
    this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.night)).setOrigin(0).setInteractive();
    text(this, WIDTH / 2, 22, o.title || 'Cards', { color: PALETTE.gold });
    if (o.subtitle) text(this, WIDTH / 2, 42, o.subtitle, { color: PALETTE.lavender });

    const cards = [...o.cards].sort((a, b) => (ORDER[CARDS[a.id].type] - ORDER[CARDS[b.id].type]) || CARDS[a.id].name.localeCompare(CARDS[b.id].name) || (b.up - a.up));
    const list = this.add.container(0, 0);
    let y = TOP + 4;
    if (!cards.length) list.add(text(this, WIDTH / 2, TOP + 60, 'No cards here.', { color: PALETTE.lavender }));
    for (const card of cards) {
      const w = wideCard(this, card, WIDTH - 24, { combat: o.combat });
      w.setPosition(12, y);
      const zone = this.add.zone(WIDTH / 2, y + w.h / 2, WIDTH - 24, w.h).setInteractive({ useHandCursor: !!o.pick });
      zone.on('pointerup', () => this.tap(card));
      list.add([w, zone]);
      y += w.h + 6;
    }
    const mask = this.make.graphics().fillRect(0, TOP, WIDTH, BOTTOM - TOP).createGeometryMask();
    list.setMask(mask);
    this.scroller = dragScroll(this, list, TOP, BOTTOM, y - TOP + 8);
    if (y > BOTTOM) text(this, WIDTH - 12, BOTTOM + 6, 'drag to scroll', { origin: [1, 0], color: PALETTE.lavender });

    const label = o.cancelLabel || (o.pick ? 'Cancel' : 'Close');
    button(this, WIDTH / 2, HEIGHT - 28, 200, 40, label, () => this.close(true), { fill: PALETTE.lavender });
  }

  tap(card) {
    const o = this.opts;
    if (this.scroller.moved || !o.pick) return;
    sfx('select');
    const after = o.pick.preview ? o.pick.preview(card) : null;
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.night), 0.96).setOrigin(0).setInteractive());
    let y = 120;
    const a = wideCard(this, card, WIDTH - 24).setPosition(12, y);
    c.add(a);
    y += a.h + 8;
    if (after) {
      c.add(text(this, WIDTH / 2, y + 10, 'becomes', { color: PALETTE.lavender }));
      y += 26;
      const b = wideCard(this, after, WIDTH - 24).setPosition(12, y);
      c.add(b);
      y += b.h + 8;
    }
    c.add(button(this, WIDTH / 2, y + 36, 240, 44, o.pick.verb || 'Choose', () => {
      c.destroy();
      this.chosen = card;
      this.close(false);
    }, { fill: PALETTE.gold }));
    c.add(button(this, WIDTH / 2, y + 92, 240, 40, 'Back', () => c.destroy(), { fill: PALETTE.lavender }));
  }

  close(cancelled) {
    const o = this.opts;
    this.scene.stop();
    if (o.from) this.scene.resume(o.from);
    if (cancelled) o.onCancel?.();
    else if (this.chosen) o.pick.onPick(this.chosen);
  }
}

export { modal };
