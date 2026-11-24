import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, HEIGHT, route, setBackground, icon, potionIcon, sfx, topBar, runMenu, showCards, modal, toast, go, tapCooldown } from './common.js';
import { wideCard } from './cardview.js';
import { RELICS } from '../logic/relics.js';
import { CARDS } from '../logic/cards.js';
import { POTIONS } from '../logic/potions.js';
import { takeGold, takePotion, takeRelic, takeCard, skipCards, leaveRewards, chooseBossRelic, canGetPotion } from '../logic/run.js';
import { saveRun } from '../save.js';

/** Rewards after a fight, and the boss relic choice. */
export class Reward extends Phaser.Scene {
  constructor() { super('Reward'); }

  init(data) { this.run = data.run; }

  create() {
    setBackground(this, '#2a2030');
    this.bar = topBar(this, this.run, {
      onDeck: () => showCards(this, this.run.deck, 'Your deck'),
      onMenu: () => runMenu(this, this.run, { onAbandon: () => this.abandon() }),
    });
    this.items = this.add.container(0, 0);
    if (this.run.screen === 'bossRelic') this.drawBossRelics();
    else this.drawRewards();
  }

  drawRewards() {
    const rw = this.run.rewards;
    this.items.removeAll(true);
    this.items.add(text(this, WIDTH / 2, 76, rw.boss ? 'Boss defeated!' : 'Victory!', { size: 32, color: PALETTE.gold }));
    this.items.add(text(this, WIDTH / 2, 108, 'Tap a reward to take it', { color: PALETTE.lavender }));
    let y = 150;
    const row = (ref, label, fn, { tint, fill = PALETTE.indigo } = {}) => {
      const b = button(this, WIDTH / 2, y, 300, 50, label, fn, { fill, color: PALETTE.cream });
      const ic = ref === 'potion' ? potionIcon(this, -122, 0, tint, 2) : icon(this, -122, 0, ref, 2);
      b.face.add(ic);
      b.label.setX(14);
      this.items.add(b);
      y += 60;
    };
    if (rw.gold) row('sk:13,1', `${rw.gold} gold`, () => { takeGold(this.run); sfx('coin'); this.save(); this.drawRewards(); });
    if (rw.potion) {
      row('potion', POTIONS[rw.potion].name, () => {
        if (!canGetPotion(this.run)) { sfx('error'); toast(this, 'Your potion belt is full. Tap a potion at the top to throw it away.', 560, PALETTE.orange); return; }
        takePotion(this.run); sfx('select'); this.save(); this.drawRewards();
      }, { tint: rw.potion });
    }
    rw.relics.forEach((id, i) => row(RELICS[id].art, RELICS[id].name, () => {
      const m = modal(this, RELICS[id].name, RELICS[id].text, [
        ['Take it', () => { m.destroy(); takeRelic(this.run, i); sfx('power'); this.save(); this.drawRewards(); }],
        ['Later', () => m.destroy(), PALETTE.lavender],
      ], { art: { ref: RELICS[id].art, scale: 3 } });
    }));
    if (!rw.cardsTaken && rw.cards.length) row('sk:19,1', 'Add a card to your deck', () => this.cardChoice(), { fill: PALETTE.plum });
    const left = rw.gold || rw.potion || rw.relics.length || (!rw.cardsTaken && rw.cards.length);
    this.items.add(button(this, WIDTH / 2, HEIGHT - 40, 260, 48, left ? 'Skip the rest' : 'Continue', () => this.leave(left), { fill: left ? PALETTE.lavender : PALETTE.gold }));
    this.bar.refresh();
  }

  leave(left) {
    const go2 = () => { leaveRewards(this.run); sfx('tap'); route(this, this.run); };
    if (!left) { go2(); return; }
    const m = modal(this, 'Leave rewards behind?', 'Anything you have not taken will be lost.', [
      ['Leave them', () => { m.destroy(); go2(); }, PALETTE.red, PALETTE.cream],
      ['Go back', () => m.destroy()],
    ]);
  }

  cardChoice() {
    sfx('card');
    const rw = this.run.rewards;
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.night)).setOrigin(0).setInteractive());
    c.add(text(this, WIDTH / 2, 30, 'Choose a card', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 62, 'Tap one, then Take it (or skip)', { color: PALETTE.lavender }));
    let y = 84;
    let chosen = null;
    const outlines = [];
    for (const id of rw.cards) {
      const card = { id, up: false };
      const w = wideCard(this, card, WIDTH - 24).setPosition(12, y);
      const ol = this.add.rectangle(WIDTH / 2, y + w.h / 2, WIDTH - 18, w.h + 6).setStrokeStyle(3, hex(PALETTE.gold)).setVisible(false);
      const zone = this.add.zone(WIDTH / 2, y + w.h / 2, WIDTH - 24, w.h).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { sfx('select'); chosen = id; outlines.forEach((o) => o.setVisible(o.id === id)); take.setEnabled(true).setLabel(`Take ${CARDS[id].name}`); });
      ol.id = id;
      outlines.push(ol);
      c.add([w, ol, zone]);
      y += w.h + 12;
    }
    const take = button(this, WIDTH / 2, HEIGHT - 96, 280, 46, 'Take it', () => {
      if (!chosen) return;
      takeCard(this.run, chosen); sfx('power'); this.save(); c.destroy(); this.drawRewards();
    }, { fill: PALETTE.gold }).setEnabled(false);
    const skip = button(this, WIDTH / 2, HEIGHT - 40, 280, 42, 'Skip', () => { skipCards(this.run); this.save(); c.destroy(); this.drawRewards(); }, { fill: PALETTE.lavender });
    c.add([take, skip]);
  }

  drawBossRelics() {
    this.items.removeAll(true);
    this.items.add(text(this, WIDTH / 2, 78, 'Choose a boss relic', { size: 32, color: PALETTE.gold }));
    this.items.add(text(this, WIDTH / 2, 110, 'Powerful, but most have a drawback', { color: PALETTE.lavender }));
    let y = 136;
    for (const id of this.run.bossRelics) {
      const r = RELICS[id];
      const body = text(this, 76, y + 34, r.text, { origin: [0, 0], wrap: WIDTH - 100, align: 'left' });
      const h = Math.max(86, body.height + 46);
      const bg = this.add.rectangle(12, y, WIDTH - 24, h, hex(PALETTE.indigo)).setOrigin(0).setStrokeStyle(3, hex(PALETTE.ink)).setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        sfx('select');
        const m = modal(this, r.name, r.text, [
          ['Take it', () => { m.destroy(); chooseBossRelic(this.run, id); sfx('power'); route(this, this.run); }],
          ['Back', () => m.destroy(), PALETTE.lavender],
        ], { art: { ref: r.art, scale: 3 } });
      });
      this.items.add([bg, icon(this, 42, y + h / 2, r.art, 3), text(this, 76, y + 12, r.name, { origin: [0, 0], color: PALETTE.gold }), body]);
      this.items.bringToTop(body);
      y += h + 10;
    }
    this.items.add(button(this, WIDTH / 2, HEIGHT - 40, 240, 44, 'Skip', () => { chooseBossRelic(this.run, null); route(this, this.run); }, { fill: PALETTE.lavender }));
  }

  save() { saveRun(this.run); this.bar.refresh(); tapCooldown(this); }

  abandon() {
    this.run.screen = 'dead';
    this.run.abandoned = true;
    saveRun(this.run);
    go(this, 'RunEnd', { run: this.run });
  }
}
