import { Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, header, icon, unit, modal, sfx, bar, tapCooldown } from './common.js';
import { getProgress, setProgress } from '../save.js';
import { HEROES, HERO_IDS, GEAR, gearText, SKILL_LEVELS, xpToNext, MAX_LEVEL } from '../logic/heroes.js';
import { SKILLS, describe, costLabel } from '../logic/skills.js';
import { REGIONS, JOINS } from '../logic/world.js';
import * as PR from '../logic/progress.js';

const SLOTS = [['weapon', 'Weapon'], ['armor', 'Armour'], ['charm', 'Charm']];

export class Heroes extends Phaser.Scene {
  constructor() { super('Heroes'); }

  init(data) {
    this.from = data?.from || 'Menu';
    this.region = data?.region;
    this.p = getProgress();
    this.sel = data?.sel || this.p.active;
  }

  create() {
    setBackground(this, '#231c2c');
    header(this, 'Heroes & gear', () => go(this, this.from, { region: this.region }));
    this.drawTabs();
    this.drawHero();
  }

  drawTabs() {
    HERO_IDS.forEach((id, i) => {
      const x = 47 + i * 89;
      const have = !!this.p.heroes[id];
      const on = id === this.sel;
      const b = button(this, x, 82, 84, 60, '', () => {
        if (!have) {
          const r = Object.entries(JOINS).find(([, ids]) => ids.includes(id))[0];
          modal(this, HEROES[id].name, `${HEROES[id].blurb}\n\nJoins when you reach ${REGIONS[r].name}.`, [['Close', (c) => c(), PALETTE.lavender]]);
          return;
        }
        if (id !== this.sel) go(this, 'Heroes', { from: this.from, region: this.region, sel: id });
      }, { fill: on ? PALETTE.gold : PALETTE.indigo, color: PALETTE.cream });
      const u = unit(this, 0, 22, HEROES[id].sprite, 2);
      b.face.add(u);
      if (!have) { u.setTint(0x000000); u.setAlpha(0.6); u.anims.stop(); }
      if (this.p.active === id) b.face.add(text(this, 0, -21, 'Active', { color: on ? PALETTE.night : PALETTE.gold }).setScale(1));
    });
  }

  drawHero() {
    const id = this.sel;
    const h = this.p.heroes[id];
    const def = HEROES[id];
    const st = PR.statsOf(this.p, id);
    const y0 = 116;
    this.add.rectangle(0, y0, WIDTH, 96, hex(PALETTE.ink), 0.5).setOrigin(0);
    unit(this, 40, y0 + 80, def.sprite, 4);
    text(this, 80, y0 + 14, `${def.name}  Lv ${h.lvl}`, { origin: [0, 0.5], color: PALETTE.gold });
    const xpb = bar(this, 80, y0 + 36, 176, 16, PALETTE.lavender);
    if (h.lvl >= MAX_LEVEL) xpb.set(1, 1, 'Max level'); else xpb.set(h.xp, xpToNext(h.lvl), `XP ${h.xp}/${xpToNext(h.lvl)}`);
    text(this, 80, y0 + 58, `HP ${st.maxHp}   Skull ${st.skull}   Power +${st.power}`, { origin: [0, 0.5] });
    text(this, 80, y0 + 80, def.blurb, { origin: [0, 0.5], color: PALETTE.lavender });
    if (this.p.active === id) text(this, WIDTH - 12, y0 + 14, 'Active', { origin: [1, 0.5], color: PALETTE.leaf });
    else button(this, WIDTH - 52, y0 + 20, 92, 36, 'Use', () => { this.p.active = id; setProgress(this.p); sfx('power'); go(this, 'Heroes', { from: this.from, region: this.region, sel: id }); }, { fill: PALETTE.gold });

    // Gear slots
    const gy = 240;
    text(this, 12, gy - 16, 'Gear (tap a slot to change it)', { origin: [0, 0.5], color: PALETTE.sand });
    SLOTS.forEach(([slot, label], i) => {
      const x = 62 + i * 118;
      const item = h.gear[slot];
      const b = button(this, x, gy + 24, 112, 50, '', () => this.pickGear(slot, label), { fill: PALETTE.indigo, color: PALETTE.cream });
      b.face.add(text(this, 0, -14, label, { color: PALETTE.lavender }));
      if (item) {
        b.face.add(icon(this, -36, 8, GEAR[item].icon, 1.5));
        b.face.add(text(this, 10, 8, this.shortName(GEAR[item].name), { color: PALETTE.cream }));
      } else b.face.add(text(this, 0, 8, 'Empty', { color: PALETTE.lavender }));
    });

    // Skills
    const sy = 306;
    text(this, 12, sy, 'Skills (tap for details)', { origin: [0, 0.5], color: PALETTE.sand });
    def.skills.forEach((sid, k) => {
      const y = sy + 14 + k * 66;
      const open = h.lvl >= SKILL_LEVELS[k];
      const sk = SKILLS[sid];
      const row = this.add.rectangle(8, y, WIDTH - 16, 62, hex(PALETTE.night)).setOrigin(0).setStrokeStyle(2, hex(open ? PALETTE.indigo : PALETTE.ink))
        .setInteractive({ useHandCursor: true });
      row.on('pointerup', () => { if (!this._modals) { sfx('select'); modal(this, sk.name, `${describe(sid, Math.max(h.lvl, SKILL_LEVELS[k]), st.power)}\nCost: ${costLabel(sid)}.${open ? '' : `\nOpens at level ${SKILL_LEVELS[k]}.`}`, [['Close', (c) => c(), PALETTE.lavender]], { art: { make: (ax, ay) => icon(this, ax, ay, sk.icon, 4) } }); } });
      const ic = icon(this, 30, y + 31, sk.icon, 2);
      if (!open) ic.setAlpha(0.4);
      text(this, 54, y + 12, sk.name, { origin: [0, 0.5], color: open ? PALETTE.cream : PALETTE.lavender });
      text(this, WIDTH - 16, y + 12, open ? costLabel(sid) : `Lv ${SKILL_LEVELS[k]}`, { origin: [1, 0.5], color: open ? PALETTE.gold : PALETTE.lavender });
      const d = text(this, 54, y + 23, describe(sid, Math.max(h.lvl, SKILL_LEVELS[k]), st.power), { origin: [0, 0], color: PALETTE.lavender, wrap: WIDTH - 72, align: 'left' });
      d.setLineSpacing(0);
      if (d.height > 36) this.clip(describe(sid, Math.max(h.lvl, SKILL_LEVELS[k]), st.power), d);
    });
    button(this, WIDTH / 2, 612, 200, 40, 'Auto equip best', () => { PR.autoEquip(this.p, id); setProgress(this.p); sfx('power'); go(this, 'Heroes', { from: this.from, region: this.region, sel: id }); }, { fill: PALETTE.lavender });
  }

  shortName(name) { return name.length > 10 ? `${name.split(' ')[0]}` : name; }

  /** Shorten text so it fits two lines (full text is in the popup). */
  clip(s, t) {
    let cut = s;
    while (cut.length > 4) {
      cut = cut.slice(0, cut.lastIndexOf(' '));
      t.setText(`${cut}...`);
      if (t.height <= 36) return;
    }
  }

  pickGear(slot, label, page = 0) {
    if (this._modals) return;
    sfx('select');
    const id = this.sel;
    const owned = this.p.owned.filter((g) => GEAR[g].slot === slot);
    const cur = this.p.heroes[id].gear[slot];
    if (!owned.length) {
      modal(this, label, `You don't own any ${label.toLowerCase()} yet. Buy gear in the shop (the house on the world map) or win side quests.`, [['Close', (c) => c(), PALETTE.lavender]]);
      return;
    }
    const content = this.add.container(0, 0);
    content.w = 300;
    let y = 0;
    const m = { close: null };
    const all = [...owned, null];
    const pages = Math.ceil(all.length / 6);
    const list = all.slice(page * 6, page * 6 + 6);
    for (const g of list) {
      const on = g === cur;
      const b = button(this, 150, y + 24, 296, 46, '', () => {
        PR.equip(this.p, id, g, slot);
        setProgress(this.p);
        sfx('place');
        m.close?.();
        tapCooldown(this);
        go(this, 'Heroes', { from: this.from, region: this.region, sel: id });
      }, { fill: on ? PALETTE.gold : PALETTE.indigo, color: on ? PALETTE.night : PALETTE.cream });
      if (g) {
        b.face.add(icon(this, -128, 0, GEAR[g].icon, 2));
        b.face.add(text(this, -106, -9, GEAR[g].name, { origin: [0, 0.5], color: on ? PALETTE.night : PALETTE.cream }));
        b.face.add(text(this, -106, 10, gearText(g), { origin: [0, 0.5], color: on ? PALETTE.night : PALETTE.lavender }));
      } else b.label.setText('Take it off');
      content.add(b);
      y += 52;
    }
    content.h = y;
    const buttons = [['Close', (c) => c(), PALETTE.lavender]];
    if (pages > 1) buttons.unshift([`More (${(page + 1) % pages + 1}/${pages})`, (c) => { c(); this.time.delayedCall(10, () => this.pickGear(slot, label, (page + 1) % pages)); }, PALETTE.sand]);
    const md = modal(this, `${label} for ${HEROES[id].name}`, null, buttons, { width: 330, content, row: true });
    m.close = md.close;
  }
}
