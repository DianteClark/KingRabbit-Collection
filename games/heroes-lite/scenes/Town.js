import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, store, header, modal, toast, resourceBar, creatureSlot, setBackground, costText, hint } from './common.js';
import { creatureInfo } from './heroPanel.js';
import * as G from '../logic/game.js';
import { BUILDINGS, CREATURES, FACTIONS, SPELLS, buildingName, buildingDesc } from '../logic/data.js';
import { sprite, townFrame, dwellingFrame, groundFrame, BUILDING_ICON, unitFrame, spellFrame, heroFrame, RES_ICON } from '../frames.js';
import { saveGame } from '../save.js';

const GRID = ['hall1', 'hall2', 'hall3', 'fort', 'tavern', 'market', 'guild1', 'guild2', 'guild3', 'dw0', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5'];
const TABS = [['build', 'Build'], ['recruit', 'Recruit'], ['army', 'Army'], ['trade', 'Trade']];
const CONTENT_TOP = 252;

export class Town extends Phaser.Scene {
  constructor() { super('Town'); }

  init(data) { this.townId = data.townId; this.tab = data.tab || 'build'; }

  create() {
    this.s = store.state;
    this.town = G.getObj(this.s, this.townId);
    setBackground(this, PALETTE.night);
    header(this, this.town.name, () => this.close());
    this.res = resourceBar(this, 60);
    // Town picture.
    const g = this.add.graphics();
    for (let x = 0; x < WIDTH; x += 32) for (let y = 78; y < 206; y += 32) sprite(this, x + 16, y + 16, groundFrame(this.s.biome));
    g.setDepth(1).fillStyle(hex(PALETTE.ink)).fillRect(0, 76, WIDTH, 3).fillRect(0, 204, WIDTH, 3);
    this.view = this.add.container(0, 0);
    this.tabBtns = TABS.map(([id, label], i) => button(this, 46 + i * 89, 228, 84, 36, label, () => this.show(id)));
    this.content = this.add.container(0, 0);
    this.refresh();
    hint(this, 'townscreen', 'Build one thing a day (gold cards are affordable). Recruit in the Recruit tab: troops join a hero standing in the gate, or stay to guard the town.', 140);
    window.__heroes = { ...(window.__heroes || {}), town: this };
  }

  close() {
    saveGame(this.s);
    sfx('tap');
    this.scene.stop();
    this.scene.wake('Adventure');
  }

  refresh() {
    this.res.update(this.s.players[0].res);
    this.drawView();
    this.show(this.tab);
  }

  drawView() {
    const t = this.town;
    this.view.removeAll(true);
    const lvl = t.built.hall3 ? 3 : t.built.hall2 ? 2 : 1;
    this.view.add(sprite(this, WIDTH / 2, 204, townFrame(t.faction, lvl), 2).setOrigin(0.5, 1));
    // Built dwellings stand around the town.
    const spots = [[38, 140], [38, 186], [92, 186], [268, 186], [322, 186], [322, 140]];
    for (let i = 0; i < 6; i++) if (t.built[`dw${i}`]) this.view.add(sprite(this, spots[i][0], spots[i][1] + 16, dwellingFrame(t.faction, i), 1.5).setOrigin(0.5, 1));
    const vh = G.visitingHero(this.s, t);
    if (vh) this.view.add(sprite(this, WIDTH / 2 + 34, 188, heroFrame(vh.faction === 'necro' ? 'heroN' : 'heroC', vh.might, 0), 2));
    const bg = this.add.rectangle(WIDTH / 2, 92, 210, 24, hex(PALETTE.ink), 0.7);
    this.view.add(bg);
    this.view.add(text(this, WIDTH / 2, 92, `+${G.townIncome(t)} gold a day`, { color: PALETTE.gold }));
  }

  show(id) {
    this.tab = id;
    TABS.forEach(([tid], i) => {
      const on = tid === id;
      this.tabBtns[i].body.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      this.tabBtns[i].label.setColor(on ? PALETTE.night : PALETTE.cream);
    });
    this.content.removeAll(true);
    this[`tab_${id}`]();
  }

  put(o) { this.content.add(o); return o; }

  // ---------- Build ----------

  tab_build() {
    const t = this.town;
    GRID.forEach((bid, i) => {
      const x = 8 + (i % 2) * 176; const y = CONTENT_TOP + Math.floor(i / 2) * 48;
      const st = G.buildStatus(this.s, t, bid);
      const built = !!t.built[bid];
      const fill = built ? PALETTE.wine : st.ok ? PALETTE.indigo : PALETTE.night;
      this.put(panel(this, x, y, 168, 44, { fill, inner: built ? PALETTE.leaf : st.ok ? PALETTE.gold : PALETTE.indigo }));
      const b = BUILDINGS[bid];
      const icon = b.dwelling !== undefined ? dwellingFrame(t.faction, b.dwelling) : BUILDING_ICON[bid];
      this.put(sprite(this, x + 22, y + 22, icon, 1));
      const name = buildingName(bid, t.faction);
      this.put(text(this, x + 40, y + 13, name, { origin: [0, 0.5], color: PALETTE.cream }));
      let status = built ? 'Built' : st.reason === 'Needs' ? 'Needs more' : st.reason === 'Built today' ? 'Tomorrow' : shortCost(b.cost);
      if (st.ok) status = shortCost(b.cost);
      this.put(text(this, x + 40, y + 32, status, { origin: [0, 0.5], color: built ? PALETTE.leaf : st.ok ? PALETTE.gold : PALETTE.lavender }));
      const z = this.put(this.add.zone(x + 84, y + 22, 168, 44).setInteractive({ useHandCursor: true }));
      z.on('pointerup', () => this.buildInfo(bid));
    });
  }

  buildInfo(bid) {
    const t = this.town;
    const b = BUILDINGS[bid];
    const st = G.buildStatus(this.s, t, bid);
    const lines = [buildingDesc(bid, t.faction)];
    if (!t.built[bid]) lines.push({ text: `Cost: ${costText(b.cost)}`, color: PALETTE.gold });
    if (st.reason === 'Needs') lines.push({ text: `Needs: ${st.missing.map((m) => buildingName(m, t.faction)).join(', ')}`, color: PALETTE.orange });
    if (st.reason === 'Built today') lines.push({ text: 'You can build once per day.', color: PALETTE.orange });
    if (st.reason === 'Cost') lines.push({ text: 'Not enough resources.', color: PALETTE.orange });
    if (st.reason === 'Built') lines.push({ text: 'Already built.', color: PALETTE.leaf });
    const btns = st.ok ? [['Build', () => { G.build(this.s, t, bid); sfx('place'); saveGame(this.s); this.refresh(); toast(this, `${buildingName(bid, t.faction)} built!`, 150); }], ['Cancel', null]] : [['OK', null]];
    modal(this, buildingName(bid, t.faction), lines, btns);
  }

  // ---------- Recruit ----------

  tab_recruit() {
    const t = this.town;
    const vh = G.visitingHero(this.s, t);
    this.put(text(this, 12, CONTENT_TOP + 14, vh ? `Recruits join ${vh.name}` : 'Recruits join the garrison', { origin: [0, 0.5], color: PALETTE.lavender }));
    const any = [0, 1, 2, 3, 4, 5].some((i) => t.built[`dw${i}`] && t.stock[i] > 0);
    this.put(button(this, 296, CONTENT_TOP + 14, 112, 30, 'Buy all', () => this.recruitAll(), { fill: PALETTE.gold })).setEnabled(any);
    const f = FACTIONS[t.faction];
    for (let i = 0; i < 6; i++) {
      const type = f.creatures[i]; const c = CREATURES[type];
      const y = CONTENT_TOP + 36 + i * 57;
      const built = t.built[`dw${i}`];
      this.put(panel(this, 8, y, WIDTH - 16, 54, { fill: built ? PALETTE.indigo : PALETTE.night, inner: built ? PALETTE.lavender : PALETTE.indigo }));
      const img = this.put(sprite(this, 36, y + 26, unitFrame(c.sprite), 3));
      if (!built) img.setAlpha(0.4);
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => creatureInfo(this, type));
      this.put(text(this, 64, y + 16, c.name, { origin: [0, 0.5], color: built ? PALETTE.cream : PALETTE.lavender }));
      this.put(text(this, 64, y + 38, built ? `${t.stock[i]} ready, ${shortCost(c.cost)} each` : `Build ${f.dwellings[i]}`, { origin: [0, 0.5], color: built ? PALETTE.sand : PALETTE.lavender }));
      if (built) {
        const btn = this.put(button(this, 304, y + 27, 76, 36, 'Buy', () => this.recruitModal(i)));
        btn.setEnabled(t.stock[i] > 0);
      }
    }
  }

  recruitAll() {
    let got = 0;
    for (let i = 5; i >= 0; i--) if (this.town.built[`dw${i}`] && this.town.stock[i] > 0) got += G.recruit(this.s, this.town, i, this.town.stock[i]);
    if (got) { sfx('coin'); toast(this, `${got} creatures recruited`, 150); } else { sfx('error'); toast(this, 'Not enough gold or no free slot', 150); }
    saveGame(this.s);
    this.refresh();
  }

  recruitModal(tier) {
    const t = this.town;
    const type = FACTIONS[t.faction].creatures[tier]; const c = CREATURES[type];
    const p = this.s.players[0];
    const max = Math.min(t.stock[tier], G.maxAffordable(p.res, c.cost));
    if (max <= 0) { toast(this, 'Not enough gold', 150); sfx('error'); return; }
    let n = max;
    let label = null; let costT = null;
    const m = modal(this, `Recruit ${c.name}`, [`${t.stock[tier]} available`], [
      ['Recruit', () => {
        const got = G.recruit(this.s, t, tier, n);
        if (got) { sfx('coin'); toast(this, `${got} ${c.name} recruited`, 150); } else { sfx('error'); toast(this, 'No free army slot', 150); }
        saveGame(this.s); this.refresh();
      }],
      ['Cancel', null],
    ], {
      extra: 164,
      content: (cc, y) => {
        // Creature and the chosen amount on one line, the stepper below, then the price.
        cc.add(sprite(this, WIDTH / 2 - 60, y + 22, unitFrame(c.sprite), 3));
        label = text(this, WIDTH / 2 + 20, y + 22, '', { size: 32, color: PALETTE.cream });
        costT = text(this, WIDTH / 2, y + 134, '', { color: PALETTE.gold });
        const upd = () => { label.setText(`x ${n}`); costT.setText(costText(c.cost, n)); };
        cc.add([label, costT]);
        const by = y + 84;
        cc.add(button(this, 66, by, 56, 44, '-', () => { n = Math.max(1, n - 1); upd(); }, { size: 32 }));
        cc.add(button(this, 138, by, 56, 44, '1', () => { n = 1; upd(); }));
        cc.add(button(this, 222, by, 56, 44, '+', () => { n = Math.min(max, n + 1); upd(); }, { size: 32 }));
        cc.add(button(this, 294, by, 56, 44, 'Max', () => { n = max; upd(); }));
        upd();
      },
    });
    void m;
  }

  // ---------- Army ----------

  tab_army() {
    const t = this.town;
    const vh = G.visitingHero(this.s, t);
    let y = CONTENT_TOP + 10;
    this.put(text(this, 14, y, 'Garrison (defends the town)', { origin: [0, 0.5], color: PALETTE.sand }));
    y += 40;
    t.garrison.forEach((st, i) => this.put(creatureSlot(this, 42 + i * 69, y, st, { size: 62, onTap: st && vh ? () => this.move('garrison', i) : (st ? () => creatureInfo(this, st.type, st.count) : null) })));
    y += 50;
    if (vh) {
      this.put(text(this, 14, y, `${vh.name}'s army`, { origin: [0, 0.5], color: PALETTE.sand }));
      y += 40;
      vh.army.forEach((st, i) => this.put(creatureSlot(this, 42 + i * 69, y, st, { size: 62, onTap: st ? () => this.move('hero', i) : null })));
      y += 42;
      this.put(text(this, WIDTH / 2, y, 'Tap a stack to move it across', { color: PALETTE.lavender }));
      y += 24;
    } else {
      this.put(text(this, 14, y, 'No hero in town', { origin: [0, 0.5], color: PALETTE.lavender }));
      y += 30;
      const ch = G.canHire(this.s, t);
      const b = this.put(button(this, WIDTH / 2, y + 10, 260, 42, `Hire a hero (${G.HERO_COST} gold)`, () => this.hire(), { fill: PALETTE.gold }));
      if (!ch.ok) { b.setEnabled(false); y += 34; this.put(text(this, WIDTH / 2, y + 10, ch.reason, { color: PALETTE.orange })); }
      y += 44;
    }
    // Mage guild spells.
    const spells = [];
    for (let lv = 1; lv <= 3; lv++) if (t.built[`guild${lv}`]) spells.push(...t.guild[lv]);
    y += 6;
    this.put(text(this, 14, y, spells.length ? 'Mage Guild spells (heroes learn them here)' : 'No Mage Guild yet', { origin: [0, 0.5], color: PALETTE.sand }));
    y += 30;
    spells.forEach((sp, i) => {
      const img = this.put(sprite(this, 30 + i * 40, y, spellFrame(SPELLS[sp].icon), 2));
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => toast(this, `${SPELLS[sp].name}: ${SPELLS[sp].desc}`, 150));
    });
  }

  move(from, slot) {
    if (G.transfer(this.s, this.town, from, slot)) { sfx('place'); saveGame(this.s); this.refresh(); } else {
      sfx('error');
      toast(this, from === 'hero' ? 'A hero must keep one stack' : 'No free slot', 150);
    }
  }

  hire() {
    const pool = G.retiredHeroes(this.s, 0);
    if (pool.length) {
      const btns = pool.slice(-3).reverse().map((r) => [`${r.name}, level ${r.level}`, () => this.doHire(r.id)]);
      btns.push(['A new hero', () => this.doHire('new'), PALETTE.lavender]);
      btns.push(['Cancel', null, PALETTE.cream]);
      modal(this, 'Tavern', [`Hire for ${G.HERO_COST} gold. Heroes who fled are waiting here (with any army they kept).`], btns);
      return;
    }
    this.doHire('new');
  }

  doHire(pick) {
    const h = G.hireHero(this.s, this.town, pick);
    if (!h) return;
    sfx('power');
    saveGame(this.s);
    this.refresh();
    toast(this, `${h.name} joins you!`, 150);
  }

  // ---------- Trade ----------

  tab_trade() {
    const t = this.town;
    const p = this.s.players[0];
    if (!G.townsOf(this.s, 0).some((tt) => tt.built.market)) {
      this.put(text(this, WIDTH / 2, CONTENT_TOP + 40, 'Build a Marketplace to trade.', { color: PALETTE.lavender }));
      this.put(button(this, WIDTH / 2, CONTENT_TOP + 90, 200, 40, 'Go to Build', () => this.show('build')));
      return;
    }
    void t;
    this.put(text(this, WIDTH / 2, CONTENT_TOP + 10, 'Buy and sell for gold', { color: PALETTE.lavender }));
    ['wood', 'ore', 'gems'].forEach((r, i) => {
      const y = CONTENT_TOP + 34 + i * 76;
      this.put(panel(this, 8, y, WIDTH - 16, 68));
      this.put(sprite(this, 34, y + 34, RES_ICON[r], 2));
      this.put(text(this, 58, y + 20, `${r[0].toUpperCase()}${r.slice(1)}: ${p.res[r]}`, { origin: [0, 0.5], color: PALETTE.cream }));
      this.put(text(this, 58, y + 46, `buy ${G.MARKET.buy[r]}, sell ${G.MARKET.sell[r]}`, { origin: [0, 0.5], color: PALETTE.sand }));
      this.put(button(this, 236, y + 34, 70, 40, 'Buy', () => this.trade(r, 1), { fill: PALETTE.gold }));
      this.put(button(this, 310, y + 34, 70, 40, 'Sell', () => this.trade(r, -1)));
    });
  }

  trade(r, n) {
    if (G.trade(this.s, 0, r, n)) { sfx('coin'); saveGame(this.s); this.refresh(); } else { sfx('error'); toast(this, n > 0 ? 'Not enough gold' : `No ${r} to sell`, 150); }
  }
}

function shortCost(cost) {
  const ab = { gold: 'g', wood: 'w', ore: 'o', gems: 'gm' };
  const parts = Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `${v}${ab[k]}`);
  return parts.join(' ') || 'free';
}
