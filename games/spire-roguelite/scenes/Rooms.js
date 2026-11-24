// The non-combat rooms: campfire, treasure chest, events and the merchant.
import Phaser from 'phaser';
import {
  PALETTE, hex, text, button, WIDTH, HEIGHT, route, go, setBackground, icon, unit, potionIcon, sfx, topBar, runMenu,
  showCards, pickCard, modal, toast, relicInfo,
} from './common.js';
import { handCard, wideCard } from './cardview.js';
import { ACT_COLORS } from './MapScene.js';
import { RELICS } from '../logic/relics.js';
import { POTIONS } from '../logic/potions.js';
import { CARDS, canUpgrade } from '../logic/cards.js';
import { EVENTS } from '../logic/events.js';
import {
  HEROES, rest, smith, canRest, restAmount, openTreasure, leaveRoom, buy, shopRemove, canGetPotion,
  chooseEvent, eventChoiceBlocked, eventChoiceDesc, eventPick, eventTakeOffer, eventContinue, pickable,
} from '../logic/run.js';
import { saveRun } from '../save.js';

/** Shared setup for a room scene. */
function roomBase(scene, bg) {
  setBackground(scene, bg);
  scene.bar = topBar(scene, scene.run, {
    onDeck: () => showCards(scene, scene.run.deck, 'Your deck'),
    onMenu: () => runMenu(scene, scene.run, {
      onAbandon: () => { scene.run.screen = 'dead'; scene.run.abandoned = true; saveRun(scene.run); go(scene, 'RunEnd', { run: scene.run }); },
    }),
  });
}

const upgradedCopy = (card) => ({ ...card, up: true });

// ---------------------------------------------------------------- campfire

export class Rest extends Phaser.Scene {
  constructor() { super('Rest'); }

  init(data) { this.run = data.run; }

  create() {
    const run = this.run;
    roomBase(this, '#1d1820');
    const g = this.add.graphics();
    g.fillStyle(hex('#2c2230')).fillCircle(WIDTH / 2, 250, 130);
    g.fillStyle(hex('#3a2c34')).fillCircle(WIDTH / 2, 250, 90);
    text(this, WIDTH / 2, 80, 'Campfire', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 112, 'Choose one: rest or upgrade', { color: PALETTE.lavender });
    const fire = this.add.image(WIDTH / 2, 262, 'campfire').setScale(5);
    this.tweens.add({ targets: fire, scaleY: 5.3, duration: 300, yoyo: true, repeat: -1 });
    unit(this, WIDTH / 2 - 92, 300, HEROES[run.hero].sprite, 4);

    const amt = Math.min(restAmount(run), run.maxHp - run.hp);
    const restBtn = button(this, WIDTH / 2, 404, 300, 54, canRest(run) ? `Rest: heal ${amt} HP` : 'Rest (blocked by your Lamp)', () => {
      if (!rest(run)) return;
      sfx('coin');
      saveRun(run);
      route(this, run);
    }, { fill: PALETTE.leaf, color: PALETTE.cream });
    restBtn.setEnabled(canRest(run));
    const up = pickable(run, 'upgrade');
    const smithBtn = button(this, WIDTH / 2, 470, 300, 54, 'Smith: upgrade a card', () => {
      pickCard(this, {
        cards: up, title: 'Upgrade a card', subtitle: 'Tap a card to see the upgrade', verb: 'Upgrade', preview: upgradedCopy,
        onPick: (card) => { smith(run, card.uid); sfx('power'); saveRun(run); route(this, run); },
      });
    }, { fill: PALETTE.orange, color: PALETTE.night });
    smithBtn.setEnabled(up.length > 0);
    text(this, WIDTH / 2, 540, `HP ${run.hp}/${run.maxHp}`, { color: PALETTE.cream });
    if (!canRest(run) && !up.length) {
      button(this, WIDTH / 2, 600, 240, 44, 'Move on', () => { leaveRoom(run); route(this, run); }, { fill: PALETTE.lavender });
    }
  }
}

// ---------------------------------------------------------------- treasure

export class Treasure extends Phaser.Scene {
  constructor() { super('Treasure'); }

  init(data) { this.run = data.run; }

  create() {
    const run = this.run;
    roomBase(this, ACT_COLORS[(run.act - 1) % 3].bg);
    text(this, WIDTH / 2, 84, 'Treasure!', { size: 32, color: PALETTE.gold });
    this.chest = this.add.image(WIDTH / 2, 260, 'chest').setScale(7).setInteractive({ useHandCursor: true });
    this.hint = text(this, WIDTH / 2, 360, 'Tap the chest to open it', { color: PALETTE.lavender });
    this.chest.on('pointerup', () => this.open());
    this.tweens.add({ targets: this.chest, angle: 3, duration: 200, yoyo: true, repeat: -1, repeatDelay: 900 });
    if (run.treasure?.opened) this.showLoot();
  }

  open() {
    const run = this.run;
    if (run.treasure.opened) return;
    openTreasure(run);
    saveRun(run);
    sfx('coin');
    this.tweens.killTweensOf(this.chest);
    this.chest.setAngle(0);
    this.tweens.add({ targets: this.chest, scale: 8, duration: 120, yoyo: true });
    this.showLoot();
  }

  showLoot() {
    const run = this.run;
    this.chest.disableInteractive();
    this.hint.setText(`You found ${run.treasure.gold} gold`).setColor(PALETTE.gold);
    const id = run.treasure.relic;
    if (id) {
      const r = RELICS[id];
      const ic = icon(this, WIDTH / 2, 420, r.art, 3).setInteractive({ useHandCursor: true });
      ic.on('pointerup', () => relicInfo(this, id));
      text(this, WIDTH / 2, 466, r.name, { color: PALETTE.sand });
      text(this, WIDTH / 2, 492, r.text, { wrap: 300, color: PALETTE.cream }).setOrigin(0.5, 0);
    }
    this.bar.refresh();
    button(this, WIDTH / 2, HEIGHT - 44, 240, 46, 'Continue', () => { leaveRoom(run); route(this, run); }, { fill: PALETTE.gold });
  }
}

// ---------------------------------------------------------------- events

export class Event extends Phaser.Scene {
  constructor() { super('Event'); }

  init(data) { this.run = data.run; }

  create() {
    const run = this.run;
    roomBase(this, '#221c2a');
    const ev = EVENTS[run.event.id];
    this.add.rectangle(WIDTH / 2, 150, WIDTH - 24, 150, hex(ACT_COLORS[(run.act - 1) % 3].ground)).setStrokeStyle(3, hex(PALETTE.ink));
    const a = ev.art.split(':');
    if (a[0] === 'cr') unit(this, WIDTH / 2, 206, `${a[1]}:${a[2]}`, 6);
    else icon(this, WIDTH / 2, 150, ev.art, ev.art.startsWith('bld') ? 4 : 7);
    text(this, WIDTH / 2, 250, ev.title, { size: 32, color: PALETTE.gold });
    this.body = this.add.container(0, 0);
    if (run.event.outcome) this.showOutcome(run.event.outcome);
    else this.showChoices();
  }

  showChoices() {
    const run = this.run;
    const ev = EVENTS[run.event.id];
    this.body.removeAll(true);
    const t = text(this, WIDTH / 2, 280, ev.text, { wrap: WIDTH - 40, color: PALETTE.cream }).setOrigin(0.5, 0);
    this.body.add(t);
    let y = Math.max(372, 290 + t.height + 30);
    ev.choices.forEach((ch, i) => {
      const blocked = eventChoiceBlocked(run, i);
      const desc = blocked || eventChoiceDesc(run, i);
      const b = button(this, WIDTH / 2, y, WIDTH - 32, 58, '', () => this.choose(i), { fill: i === ev.choices.length - 1 && /Leave|Refuse/.test(ch.label) ? PALETTE.lavender : PALETTE.sand });
      b.face.add(text(this, -(WIDTH - 32) / 2 + 14, -12, ch.label, { origin: [0, 0.5], color: PALETTE.night }));
      b.face.add(text(this, -(WIDTH - 32) / 2 + 14, 10, desc, { origin: [0, 0.5], color: blocked ? PALETTE.wine : PALETTE.indigo }));
      b.setEnabled(!blocked);
      if (blocked) { b.setAlpha(0.75); b.body.setFillStyle(hex('#8a8070')); }
      this.body.add(b);
      y += 66;
    });
  }

  choose(i) {
    const out = chooseEvent(this.run, i);
    if (!out) { sfx('error'); return; }
    sfx('select');
    saveRun(this.run);
    this.bar.refresh();
    this.showOutcome(out);
  }

  showOutcome(out) {
    const run = this.run;
    this.body.removeAll(true);
    this.body.add(text(this, WIDTH / 2, 290, out.text, { wrap: WIDTH - 40, color: PALETTE.cream }).setOrigin(0.5, 0));
    this.bar.refresh();
    if (out.pick && !out.done) {
      const mode = out.pick.mode;
      const verbs = { upgrade: 'Upgrade', remove: 'Remove', transform: 'Transform', duplicate: 'Duplicate' };
      const cards = pickable(run, mode);
      const open = () => pickCard(this, {
        cards, title: `${verbs[mode]} a card`, verb: verbs[mode], preview: mode === 'upgrade' ? upgradedCopy : null,
        onPick: (card) => { eventPick(run, card.uid); sfx('power'); saveRun(run); this.showOutcome(out); },
        cancelLabel: 'Back',
      });
      if (!cards.length) { eventPick(run, null); this.showOutcome(out); return; }
      this.body.add(button(this, WIDTH / 2, 400, 280, 50, `${verbs[mode]} a card`, open, { fill: PALETTE.gold }));
      return;
    }
    if (out.offer && !out.done) {
      let y = 340;
      out.offer.forEach((id) => {
        const w = wideCard(this, { id, up: false }, WIDTH - 24).setPosition(12, y);
        const zone = this.add.zone(WIDTH / 2, y + w.h / 2, WIDTH - 24, w.h).setInteractive({ useHandCursor: true });
        zone.on('pointerup', () => {
          const m = modal(this, `Take ${CARDS[id].name}?`, null, [
            ['Take it', () => { m.destroy(); eventTakeOffer(run, id); sfx('power'); saveRun(run); this.showOutcome(out); }],
            ['Back', () => m.destroy(), PALETTE.lavender],
          ]);
        });
        this.body.add([w, zone]);
        y += w.h + 6;
      });
      this.body.add(button(this, WIDTH / 2, HEIGHT - 36, 200, 40, 'Skip', () => { eventTakeOffer(run, null); saveRun(run); this.showOutcome(out); }, { fill: PALETTE.lavender }));
      return;
    }
    const label = out.fight ? 'Fight!' : 'Continue';
    this.body.add(button(this, WIDTH / 2, HEIGHT - 48, 240, 48, label, () => {
      eventContinue(run);
      if (out.fight) sfx('thud');
      route(this, run);
    }, { fill: out.fight ? PALETTE.red : PALETTE.gold, color: out.fight ? PALETTE.cream : PALETTE.night }));
  }
}

// ---------------------------------------------------------------- merchant

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) { this.run = data.run; }

  create() {
    roomBase(this, '#2a2218');
    this.items = this.add.container(0, 0);
    this.draw();
  }

  draw() {
    const run = this.run;
    const shop = run.shop;
    this.items.removeAll(true);
    this.items.add(icon(this, 36, 74, 'bld:0,3', 1));
    this.items.add(text(this, 60, 66, 'Merchant', { origin: [0, 0.5], color: PALETTE.gold }));
    this.items.add(text(this, 60, 86, 'Tap anything to look closer', { origin: [0, 0.5], color: PALETTE.lavender }));
    // Cards: 4 per row
    shop.cards.forEach((it, i) => {
      const x = 48 + (i % 4) * 88;
      const y = 166 + Math.floor(i / 4) * 140;
      const v = handCard(this, { id: it.id, up: false }, { playable: !it.sold }).setPosition(x, y);
      if (it.sold) v.setAlpha(0.25);
      const zone = this.add.zone(x, y, 76, 108).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => !it.sold && this.inspectCard(i));
      this.items.add([v, zone, this.priceTag(x, y + 62, it)]);
    });
    // Relics and potions
    const rowY = 456;
    this.items.add(text(this, 12, rowY - 30, 'Relics', { origin: [0, 0.5], color: PALETTE.sand }));
    shop.relics.forEach((it, i) => {
      const x = 40 + i * 56;
      const ic = icon(this, x, rowY, RELICS[it.id].art, 2).setAlpha(it.sold ? 0.25 : 1).setInteractive({ useHandCursor: true });
      ic.on('pointerup', () => !it.sold && this.inspectRelic(i));
      this.items.add([ic, this.priceTag(x, rowY + 30, it)]);
    });
    this.items.add(text(this, 200, rowY - 30, 'Potions', { origin: [0, 0.5], color: PALETTE.sand }));
    shop.potions.forEach((it, i) => {
      const x = 216 + i * 52;
      const ic = potionIcon(this, x, rowY, it.id, 2).setAlpha(it.sold ? 0.25 : 1).setInteractive({ useHandCursor: true });
      ic.on('pointerup', () => !it.sold && this.inspectPotion(i));
      this.items.add([ic, this.priceTag(x, rowY + 30, it)]);
    });
    // Card removal
    const can = !shop.removeUsed && run.gold >= run.removeCost;
    const rm = button(this, WIDTH / 2, 538, 300, 44, shop.removeUsed ? 'Card removed' : `Remove a card: ${run.removeCost} gold`, () => this.remove(), { fill: PALETTE.plum, color: PALETTE.cream });
    rm.setEnabled(can);
    this.items.add(rm);
    this.items.add(button(this, WIDTH / 2, HEIGHT - 36, 240, 44, 'Leave', () => { leaveRoom(run); sfx('tap'); route(this, run); }, { fill: PALETTE.gold }));
    this.bar.refresh();
  }

  priceTag(x, y, it) {
    const c = this.add.container(x, y);
    if (it.sold) { c.add(text(this, 0, 0, 'Sold', { color: PALETTE.lavender })); return c; }
    const afford = this.run.gold >= it.price;
    c.add(icon(this, -14, 0, 'sk:13,1', 1));
    c.add(text(this, -4, 0, String(it.price), { origin: [0, 0.5], color: afford ? (it.sale ? '#9be36b' : PALETTE.gold) : PALETTE.red }));
    return c;
  }

  buyFlow(title, body, kind, i, art) {
    const it = this.run.shop[kind][i];
    const afford = this.run.gold >= it.price;
    const blocked = kind === 'potions' && !canGetPotion(this.run) ? 'Your potion belt is full' : '';
    const m = modal(this, title, body, [
      [blocked || (afford ? `Buy for ${it.price} gold` : `Need ${it.price} gold`), () => {
        if (blocked || !buy(this.run, kind, i)) { sfx('error'); return; }
        m.destroy();
        sfx('coin');
        saveRun(this.run);
        this.draw();
      }, afford && !blocked ? PALETTE.gold : PALETTE.indigo, afford && !blocked ? PALETTE.night : PALETTE.lavender],
      ['Back', () => m.destroy(), PALETTE.lavender],
    ], { art, width: 340 });
    return m;
  }

  inspectCard(i) {
    sfx('select');
    const it = this.run.shop.cards[i];
    const m = this.buyFlow(CARDS[it.id].name + (it.sale ? ' (on sale!)' : ''), null, 'cards', i);
    const w = wideCard(this, { id: it.id, up: false }, WIDTH - 40);
    // Put the readable card just above the modal box.
    w.setPosition(20, 120 - Math.max(0, w.h - 80));
    m.add(w);
  }

  inspectRelic(i) {
    sfx('select');
    const it = this.run.shop.relics[i];
    const r = RELICS[it.id];
    this.buyFlow(r.name, r.text, 'relics', i, { ref: r.art, scale: 3 });
  }

  inspectPotion(i) {
    sfx('select');
    const it = this.run.shop.potions[i];
    const p = POTIONS[it.id];
    this.buyFlow(p.name, p.text, 'potions', i, { ref: 'ar:6,8', scale: 3, tint: p.tint });
  }

  remove() {
    const run = this.run;
    pickCard(this, {
      cards: run.deck, title: 'Remove a card', subtitle: `Costs ${run.removeCost} gold`, verb: 'Remove it',
      onPick: (card) => { if (shopRemove(run, card.uid)) { sfx('capture'); saveRun(run); this.draw(); } },
    });
  }
}

export { canUpgrade, toast };
