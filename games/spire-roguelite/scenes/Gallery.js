// Developer-only sprite check: open the game with ?gallery=enemies (or cards, relics).
import Phaser from 'phaser';
import { PALETTE, text, WIDTH, unit, icon, potionIcon } from './common.js';
import { handCard } from './cardview.js';
import { ENEMIES } from '../logic/enemies.js';
import { CARDS } from '../logic/cards.js';
import { RELICS } from '../logic/relics.js';
import { POTIONS } from '../logic/potions.js';
import { HEROES } from '../logic/run.js';

export class Gallery extends Phaser.Scene {
  constructor() { super('Gallery'); }

  create() {
    const q = new URLSearchParams(window.location.search);
    const what = q.get('gallery') || 'enemies';
    const page = Number(q.get('page') || 0);
    this.cameras.main.setBackgroundColor(PALETTE.indigo);
    if (what === 'enemies') {
      const list = [...Object.entries(HEROES).map(([id, h]) => [id, { name: h.name, sprite: h.sprite }]), ...Object.entries(ENEMIES)];
      list.slice(page * 20, page * 20 + 20).forEach(([id, d], i) => {
        const x = 45 + (i % 4) * 90; const y = 90 + Math.floor(i / 4) * 120;
        unit(this, x, y, d.sprite, d.boss ? 2 : 3, !HEROES[id]);
        text(this, x, y + 14, d.name, { wrap: 88 }).setOrigin(0.5, 0);
      });
    } else if (what === 'cards') {
      const list = Object.keys(CARDS);
      list.slice(page * 20, page * 20 + 20).forEach((id, i) => {
        const x = 46 + (i % 4) * 89; const y = 64 + Math.floor(i / 4) * 116;
        handCard(this, { id, up: page % 2 === 1 }).setPosition(x, y);
      });
    } else {
      Object.entries(RELICS).forEach(([id, r], i) => {
        const x = 24 + (i % 9) * 38; const y = 30 + Math.floor(i / 9) * 44;
        icon(this, x, y, r.art, 2);
      });
      Object.keys(POTIONS).forEach((id, i) => potionIcon(this, 24 + i * 30, 400, id, 2));
      text(this, WIDTH / 2, 600, 'relics + potions');
    }
  }
}
