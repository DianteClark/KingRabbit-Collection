import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, go, route, setBackground, icon, unit, helpButton, sfx, relicInfo } from './common.js';
import { HEROES, newRun } from '../logic/run.js';
import { RELICS, STARTER_RELIC } from '../logic/relics.js';
import { CARDS, STARTER_DECKS } from '../logic/cards.js';
import { saveRun } from '../save.js';

export class HeroSelect extends Phaser.Scene {
  constructor() { super('HeroSelect'); }

  init(data) { this.mode = data.mode || 'normal'; this.pick = null; }

  create() {
    setBackground(this, PALETTE.night);
    button(this, 30, 26, 44, 36, '<', () => go(this, 'Menu'), { size: 16, fill: PALETTE.cream });
    text(this, WIDTH / 2, 26, this.mode === 'endless' ? 'Endless: pick a hero' : 'Choose your hero', { color: PALETTE.gold });
    helpButton(this, WIDTH - 26, 26);

    this.panels = Object.entries(HEROES).map(([id, h], i) => this.heroPanel(id, h, 56 + i * 166));
    this.begin = button(this, WIDTH / 2, 612, 240, 44, 'Pick a hero', () => this.start(), { fill: PALETTE.gold }).setEnabled(false);
  }

  heroPanel(id, h, top) {
    const c = this.add.container(0, top);
    const bg = this.add.rectangle(8, 0, WIDTH - 16, 156, hex(PALETTE.indigo)).setOrigin(0).setStrokeStyle(3, hex(PALETTE.ink));
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(id));
    const ground = this.add.rectangle(56, 116, 84, 10, hex(PALETTE.ink), 0.4);
    c.add([bg, ground, unit(this, 56, 118, h.sprite, 5)]);
    c.add(text(this, 108, 12, h.name, { origin: [0, 0], color: PALETTE.gold, size: 32 }));
    c.add(icon(this, 300, 28, 'sk:4,5', 1));
    c.add(text(this, 312, 28, String(h.hp), { origin: [0, 0.5] }));
    c.add(text(this, 108, 50, h.blurb, { origin: [0, 0], wrap: WIDTH - 128, align: 'left', color: PALETTE.cream }));
    const relic = RELICS[STARTER_RELIC[id]];
    const rIcon = icon(this, 30, 140, relic.art, 1).setInteractive({ useHandCursor: true });
    rIcon.on('pointerup', () => relicInfo(this, STARTER_RELIC[id]));
    const special = [...new Set(STARTER_DECKS[id].filter((c2) => c2 !== 'strike' && c2 !== 'defend'))].map((c2) => CARDS[c2].name).join(', ');
    c.add([rIcon, text(this, 44, 140, `${relic.name}  -  ${special}`, { origin: [0, 0.5], color: PALETTE.sand })]);
    c.bg = bg;
    c.id = id;
    return c;
  }

  select(id) {
    sfx('select');
    this.pick = id;
    for (const p of this.panels) {
      p.bg.setFillStyle(hex(p.id === id ? '#5b5488' : PALETTE.indigo));
      p.bg.setStrokeStyle(3, hex(p.id === id ? PALETTE.gold : PALETTE.ink));
    }
    this.begin.setLabel(`Begin as ${HEROES[id].name}`).setEnabled(true);
  }

  start() {
    if (!this.pick) return;
    sfx('power');
    const run = newRun({ hero: this.pick, mode: this.mode, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    saveRun(run);
    route(this, run);
  }
}
