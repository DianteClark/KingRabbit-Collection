import { Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, header, icon, modal, sfx, unit, toast, tapCooldown } from './common.js';
import { getProgress, setProgress } from '../save.js';
import { GEAR, gearText, HEROES } from '../logic/heroes.js';
import { REGIONS } from '../logic/world.js';
import * as PR from '../logic/progress.js';

const TABS = [['weapon', 'Weapons'], ['armor', 'Armour'], ['charm', 'Charms']];

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    this.region = data?.region ?? 0;
    this.tab = data?.tab || 'weapon';
    this.p = getProgress();
  }

  create() {
    setBackground(this, '#2c2418');
    header(this, `${REGIONS[this.region].name} shop`, () => go(this, 'WorldMap', { region: this.region }));
    this.add.rectangle(0, 44, WIDTH, 50, hex(PALETTE.ink), 0.5).setOrigin(0);
    unit(this, 30, 92, 'castle:16', 3);
    text(this, 58, 69, 'Fine gear for brave heroes!', { origin: [0, 0.5], color: PALETTE.sand });
    this.goldText = text(this, WIDTH - 12, 69, '', { origin: [1, 0.5], color: PALETTE.gold });
    TABS.forEach(([id, label], i) => {
      button(this, 62 + i * 118, 120, 112, 40, label, () => { if (id !== this.tab) go(this, 'Shop', { region: this.region, tab: id }); }, {
        fill: id === this.tab ? PALETTE.gold : PALETTE.indigo, color: id === this.tab ? PALETTE.night : PALETTE.cream,
      });
    });
    this.list = this.add.container(0, 0);
    this.drawList();
    text(this, WIDTH / 2, 614, 'Equip what you buy on the Heroes screen.', { color: PALETTE.lavender });
  }

  drawList() {
    this.list.removeAll(true);
    this.goldText.setText(`${this.p.gold} gold`);
    const stock = PR.shopStock(this.p).filter((id) => GEAR[id].slot === this.tab).sort((a, b) => GEAR[a].price - GEAR[b].price);
    let y = 150;
    if (!stock.length) this.list.add(text(this, WIDTH / 2, 220, 'Nothing here yet. Come back later!', { color: PALETTE.lavender }));
    for (const id of stock) {
      const g = GEAR[id];
      const owned = this.p.owned.includes(id);
      this.list.add(this.add.rectangle(8, y, WIDTH - 16, 58, hex(PALETTE.night)).setOrigin(0).setStrokeStyle(2, hex(PALETTE.wine)));
      this.list.add(icon(this, 32, y + 29, g.icon, 2));
      this.list.add(text(this, 56, y + 17, g.name, { origin: [0, 0.5], color: PALETTE.cream }));
      this.list.add(text(this, 56, y + 39, gearText(id), { origin: [0, 0.5], color: PALETTE.lavender }));
      const can = this.p.gold >= g.price;
      const b = button(this, WIDTH - 52, y + 29, 80, 42, owned ? 'Owned' : `${g.price}`, () => this.buy(id), {
        fill: owned ? PALETTE.leaf : can ? PALETTE.gold : PALETTE.indigo, color: owned || !can ? PALETTE.cream : PALETTE.night, silent: true,
      });
      if (owned) b.setEnabled(false);
      this.list.add(b);
      y += 64;
    }
  }

  buy(id) {
    if (this._modals) return;
    const g = GEAR[id];
    if (this.p.gold < g.price) { sfx('error'); toast(this, `You need ${g.price - this.p.gold} more gold`, 590, PALETTE.orange); return; }
    sfx('select');
    modal(this, `Buy ${g.name}?`, `${gearText(id)}\nPrice: ${g.price} gold (you have ${this.p.gold}).`, [
      [`Buy and equip on ${HEROES[this.p.active].name}`, (close) => { close(); this.doBuy(id, true); }],
      ['Just buy', (close) => { close(); this.doBuy(id, false); }, PALETTE.lavender],
      ['Cancel', (close) => close(), PALETTE.indigo, PALETTE.cream],
    ], { art: { make: (x, y) => icon(this, x, y, g.icon, 4) } });
  }

  doBuy(id, wear) {
    if (!PR.buy(this.p, id)) return;
    if (wear) PR.equip(this.p, this.p.active, id);
    setProgress(this.p);
    sfx('coin');
    toast(this, wear ? `${HEROES[this.p.active].name} equips the ${GEAR[id].name}!` : `${GEAR[id].name} bought!`, 590, PALETTE.gold);
    tapCooldown(this, 300);
    this.drawList();
  }
}
