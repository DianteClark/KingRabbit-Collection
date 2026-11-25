import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, go, store, persist, img, fmt, shadowTitle, setBackground, flushAwards, fit } from './common.js';
import * as D from '../logic/data.js';
import { jingle, playMusic } from '../music.js';

/** The town hall is restored: a little ceremony, then back to the farm for endless play. */
export class Ending extends Phaser.Scene {
  constructor() { super('Ending'); }

  create() {
    const s = store.state;
    if (!s) { this.scene.start('Title'); return; }
    setBackground(this, '#2f5a2c');
    for (let y = 120; y < 420; y += 32) for (let x = 0; x < WIDTH; x += 32) this.add.image(x, y, 'hv', y < 260 ? 'grass0' : 'plaza').setOrigin(0).setScale(2);
    this.add.rectangle(0, 0, WIDTH, 120, hex(PALETTE.night)).setOrigin(0);
    shadowTitle(this, WIDTH / 2, 40, 'HEARTH RESTORED');
    text(this, WIDTH / 2, 84, 'Emberbrook\'s town hall stands again', { color: PALETTE.cream });
    const hall = this.add.image(WIDTH / 2, 196, 'hv', 'hallRuin').setScale(2);
    this.time.delayedCall(700, () => {
      this.cameras.main.flash(400, 255, 250, 220);
      hall.setFrame('hall');
      jingle('fanfare');
    });
    // villagers in a row, hopping
    D.VILLAGER_ORDER.forEach((id, i) => {
      const v = img(this, 50 + i * 52, 320, `npc${D.VILLAGERS[id].row}_0`, 2.5);
      this.tweens.add({ targets: v, y: v.y - 8, duration: 260, yoyo: true, repeat: -1, delay: i * 90, ease: 'Sine.out' });
    });
    img(this, WIDTH / 2, 372, 'pShow', 2.5);
    for (let i = 0; i < 14; i++) {
      const l = img(this, 20 + i * 25, 240 + (i % 2) * 10, 'o_lantern', 1.5);
      this.tweens.add({ targets: l, alpha: 0.6, duration: 500 + i * 30, yoyo: true, repeat: -1 });
    }
    this.add.rectangle(0, 420, WIDTH, 220, hex(PALETTE.night)).setOrigin(0);
    const when = s.hallDay ? `${D.SEASONS[s.hallDay.season]} ${s.hallDay.day}, year ${s.hallDay.year}` : '';
    const lines = [
      `Restored on ${when}.`,
      `Shipped ${fmt(s.earned)}g of goods.`,
      `${s.stats.harvested} crops, ${s.stats.fishCaught} fish, mine floor ${s.mineDeepest}.`,
      s.hallDay?.year === 1 ? 'All within your first year. Amazing!' : 'The valley thanks you.',
    ];
    lines.forEach((l, i) => fit(text(this, WIDTH / 2, 446 + i * 26, l, { color: i === 3 ? PALETTE.gold : PALETTE.cream }), WIDTH - 24));
    text(this, WIDTH / 2, 556, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, WIDTH / 2, 600, 240, 48, 'Keep farming', () => {
      if (this.leaving) return;
      this.leaving = true;
      persist();
      go(this, 'World', { ending: true });
    }, { fill: PALETTE.gold });
    playMusic('festival');
    persist();
    flushAwards();
  }
}
