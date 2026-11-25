import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, M, header, go, setBackground, card, pips, modal } from './common.js';
import { meta, setMeta } from '../save.js';
import { KEY } from '../art.js';
import { CHARACTERS, CHARACTER_IDS, SHOP, SHOP_IDS } from '../logic/data.js';
import { buyUpgrade, unlockHero, shopCost, refundShop } from '../logic/meta.js';
import { award } from '../trophies.js';

/** Heroes (pick or unlock) and permanent upgrades bought with coins. */
export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    setBackground(this, PALETTE.night);
    const m = meta();
    header(this, 'Heroes & Shop', () => go(this, 'Title'));
    text(this, WIDTH / 2, 62, `Coins: ${m.coins}`, { color: PALETTE.gold });
    this.info = text(this, WIDTH / 2, HEIGHT - M - 10, 'Tap a hero to pick or unlock. Tap an upgrade to buy.', { color: PALETTE.lavender });

    CHARACTER_IDS.forEach((id, i) => {
      const c = CHARACTERS[id];
      const owned = m.heroes.includes(id);
      const sel = m.hero === id;
      const x = 104 + i * 144; const y = 118;
      const k = card(this, x, y, 136, 76, () => this.tapHero(id), { fill: sel ? PALETTE.leaf : PALETTE.indigo, border: sel ? PALETTE.gold : PALETTE.lavender });
      k.add(this.add.image(-40, -6, KEY, `h_${id}_0`).setScale(2).setAlpha(owned ? 1 : 0.45));
      k.add(text(this, 18, -18, c.name, { color: PALETTE.cream }));
      k.add(this.add.image(4, 8, KEY, ({ dagger: 'i_knife', boomerang: 'i_boomerang', lightning: 'i_staff', aura: 'i_amulet' })[c.weapon]));
      k.add(text(this, 30, 8, sel ? 'Picked' : owned ? 'Pick' : `${c.cost}c`, { color: sel ? PALETTE.gold : owned ? PALETTE.cream : PALETTE.sand }));
    });

    SHOP_IDS.forEach((id, i) => {
      const s = SHOP[id];
      const lv = m.shop[id] || 0;
      const cost = shopCost(id, lv);
      const x = 104 + (i % 4) * 144; const y = 204 + Math.floor(i / 4) * 74;
      const k = card(this, x, y, 136, 66, () => this.tapUpgrade(id));
      k.add(this.add.image(-48, -12, KEY, s.icon).setScale(2));
      k.add(text(this, 12, -16, s.name, { color: PALETTE.cream }));
      pips(this, k, -54 + (5 - s.max) * 6 + 14, 14, lv, s.max);
      k.add(text(this, 40, 13, cost == null ? 'MAX' : `${cost}c`, { color: cost == null ? PALETTE.leaf : m.coins >= cost ? PALETTE.gold : PALETTE.lavender }));
    });
  }

  tapHero(id) {
    const m = meta();
    const c = CHARACTERS[id];
    if (m.heroes.includes(id)) {
      m.hero = id; setMeta(m); sfx('select'); this.scene.restart(); return;
    }
    if (m.coins < c.cost) { sfx('error'); this.info.setText(`${c.name}: ${c.desc} Needs ${c.cost} coins.`); return; }
    modal(this, `Unlock ${c.name}?`, [c.desc, `Costs ${c.cost} coins.`], [
      ['Unlock', () => {
        const mm = meta();
        if (!unlockHero(mm, id)) return;
        mm.hero = id; setMeta(mm); sfx('power'); award('hero');
        if (mm.heroes.length >= CHARACTER_IDS.length) award('all-heroes');
        this.scene.restart();
      }],
      ['Cancel', null],
    ]);
  }

  tapUpgrade(id) {
    const m = meta();
    const s = SHOP[id];
    const lv = m.shop[id] || 0;
    const cost = shopCost(id, lv);
    if (cost == null) { this.info.setText(`${s.name}: ${s.desc}. Already maxed.`); sfx('error'); return; }
    if (!buyUpgrade(m, id)) { this.info.setText(`${s.name}: ${s.desc} per level. Needs ${cost} coins.`); sfx('error'); return; }
    setMeta(m); sfx('coin'); award('shopper');
    this.scene.restart();
  }
}
// Not on screen (no room) but handy from the console: refund the shop.
export const refund = () => { const m = meta(); refundShop(m); setMeta(m); };
