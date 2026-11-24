import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, header, go, setBackground, fit, tapZone, starRow, toast } from './common.js';
import { LEVELS, WORLDS } from '../logic/levels.js';
import { isUnlocked, starsOf, bestFor, isSolved } from '../save.js';

/** Level select: one world at a time, tabs along the top, 8 cards with stars and records. */
export class Levels extends Phaser.Scene {
  constructor() { super('Levels'); }

  init(data) { this.world = data?.world || 1; }

  create() {
    setBackground(this, PALETTE.night);
    window.__robboxLevels = this;
    header(this, 'Levels', () => go(this, 'Menu'));
    this.page = this.add.container(0, 0);
    this.tabs = WORLDS.map((w, i) => {
      const x = 40 + i * 70;
      const open = isUnlocked(LEVELS.findIndex((l) => l.world === w.id));
      const b = button(this, x, 78, 62, 44, open ? `W${w.id}` : '', () => this.show(w.id), { fill: PALETTE.lavender });
      if (!open) b.face.add(this.add.image(0, 0, 'icons', 'lock'));
      b.setEnabled(open);
      return b;
    });
    this.show(this.world);
  }

  show(world) {
    this.world = world;
    this.page.removeAll(true);
    this.tabs.forEach((b, i) => b.body.setFillStyle(hex(i + 1 === world ? PALETTE.gold : PALETTE.lavender)));
    const w = WORLDS[world - 1];
    const levels = LEVELS.filter((l) => l.world === world);
    const stars = levels.reduce((n, l) => n + starsOf(l), 0);
    this.page.add(text(this, WIDTH / 2, 124, `World ${world}: ${w.name}`, { size: 32, color: PALETTE.gold }));
    this.page.add(text(this, WIDTH / 2, 156, `${w.blurb}   Stars ${stars}/${levels.length * 3}`, { color: PALETTE.lavender }));
    levels.forEach((l, k) => {
      const x = 92 + (k % 2) * 176; const y = 214 + Math.floor(k / 2) * 98;
      this.page.add(this.card(l, x, y));
    });
  }

  card(l, x, y) {
    const c = this.add.container(x, y);
    const open = isUnlocked(l.index);
    const solved = isSolved(l);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(-80, -40 + 4, 160, 84);
    g.fillStyle(hex(solved ? PALETTE.leaf : open ? PALETTE.lavender : PALETTE.indigo)).fillRect(-80, -42, 160, 84);
    g.fillStyle(hex(PALETTE.night)).fillRect(-77, -39, 154, 78);
    c.add(g);
    c.add(text(this, 0, -27, l.id, { color: open ? PALETTE.gold : PALETTE.lavender }));
    c.add(fit(text(this, 0, -9, open ? l.name : 'Locked', { color: open ? PALETTE.cream : PALETTE.lavender }), 146));
    if (open) {
      c.add(starRow(this, 0, 11, starsOf(l), { gap: 24 }));
      const best = bestFor(l.id);
      c.add(fit(text(this, 0, 29, best == null ? `Target ${l.target}` : `Best ${best}  Target ${l.target}`, { color: PALETTE.lavender }), 146));
    } else c.add(this.add.image(0, 14, 'icons', 'lock').setTint(0x8a8fc4));
    c.setSize(160, 84);
    c.setInteractive({ useHandCursor: open });
    tapZone(c, () => {
      if (!open) { sfx('error'); toast(this, 'Solve the level before to open this one.', 600); return; }
      sfx('select');
      go(this, 'Play', { index: l.index });
    });
    return c;
  }
}
