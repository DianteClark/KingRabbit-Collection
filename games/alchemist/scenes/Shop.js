import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, setBackground, store, persist, header, statBar, toast, once, hint } from './common.js';
import { showMarket, showBook, showShelf, showPrice, showUpgrades, showNight, showTip, anyOpen, closeAll, reqLabel } from './panels.js';
import * as G from '../logic/game.js';
import { POTIONS, NAMED, INGREDIENTS, STORY_DAYS } from '../logic/data.js';
import { reportDay, getSkill } from '../adaptive.js';
import { noteBest } from '../save.js';
import { playMusic, jingle } from '../music.js';

const ROOM_TOP = 86;
const FLOOR_Y = 182;
const PANEL_Y = 396;
const COUNTER_Y = 300;

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  create(data = {}) {
    closeAll();
    this.input.enabled = true;
    this.s = store.s;
    if (!this.s) { this.scene.start('Title'); return; }
    setBackground(this, PALETTE.night);
    this.drawRoom();
    this.head = header(this, `Day ${this.s.day}`, () => { persist(); go(this, 'Title'); });
    this.bar = statBar(this);
    this.ui = this.add.container(0, 0).setDepth(100);
    this.customerSprite = null;
    this.refreshShelf();
    this.refresh();
    if (this.s.phase === 'over') { this.time.delayedCall(50, () => go(this, 'Ending')); return; }
    if (this.s.phase === 'open' && G.current(this.s)) this.spawnCustomer(G.current(this.s), false);
    if (this.s.phase === 'night') playMusic('night'); else playMusic('shop');
    if (data.intro || !this.s.tut.intro) this.time.delayedCall(250, () => this.intro());
    else if (this.s.phase === 'night' && this.s.lastReport) this.time.delayedCall(200, () => this.openNight());
    else if (this.s.phase === 'prep' && G.isFestivalDay(this.s) && !this.s.tut.festDay) this.time.delayedCall(250, () => this.festivalMorning());
    else if (this.s.phase === 'prep' && data.from === 'night') this.morningNews();
  }

  // ---------------------------------------------------------------- the room

  drawRoom() {
    // back wall with windows
    for (let x = 0; x < WIDTH; x += 144) this.add.image(x, ROOM_TOP, 'lab', 'winWall').setOrigin(0).setScale(3);
    const g = this.add.graphics();
    // wooden floor
    g.fillStyle(0x7a4e32).fillRect(0, FLOOR_Y, WIDTH, PANEL_Y - FLOOR_Y);
    for (let y = FLOOR_Y; y < PANEL_Y; y += 18) {
      g.fillStyle(0x5e3a26).fillRect(0, y, WIDTH, 3);
      const off = ((y - FLOOR_Y) / 18) % 2 ? 40 : 0;
      for (let x = off; x < WIDTH; x += 80) g.fillRect(x, y, 3, 18);
    }
    g.fillStyle(0x000000, 0.25).fillRect(0, FLOOR_Y, WIDTH, 8);
    // potion cabinet
    g.fillStyle(hex(PALETTE.ink)).fillRect(150, 92, 204, 92);
    g.fillStyle(0x6a3e26).fillRect(153, 95, 198, 86);
    g.fillStyle(0x3e2418).fillRect(158, 100, 188, 76);
    g.fillStyle(0x8a5a36).fillRect(156, 136, 192, 5).fillRect(156, 176, 192, 5);
    this.shelfLayer = this.add.container(0, 0);
    this.moreTxt = text(this, 340, 108, '', { origin: [1, 0.5], color: PALETTE.cream });
    // books, vines, barrel
    this.add.image(10, FLOOR_Y + 14, 'lab', 'books').setOrigin(0, 1).setScale(3);
    this.add.image(62, FLOOR_Y + 14, 'lab', 'bookEmpty').setOrigin(0, 1).setScale(3);
    this.add.image(118, ROOM_TOP, 'lab', 'vines').setOrigin(0.5, 0).setScale(3);
    this.add.image(28, PANEL_Y - 4, 'lab', 'barrel').setOrigin(0.5, 1).setScale(3);
    // cauldron with smoke
    this.add.image(74, 296, 'shadow').setScale(3).setAlpha(0.5);
    this.add.image(74, 300, 'lab', 'cauldron').setOrigin(0.5, 1).setScale(3);
    this.add.sprite(74, 196, 'smoke').play('smoke').setScale(2).setAlpha(0.55).setTint(0xd8a0f0);
    const zone = this.add.zone(74, 250, 110, 110).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => { if (this.s.phase === 'prep' && !anyOpen() && !this.__modal && once(this, 400)) this.toBrew(); });
    // apprentice
    this.appr = this.add.sprite(140, 312, 'apprentice', '0_0').setOrigin(0.5, 1).setScale(3).setVisible(false);
    // the alchemist (you) behind the counter
    this.add.sprite(240, COUNTER_Y + 62, 'alchemist', '0_0').setOrigin(0.5, 1).setScale(4).play('alch-idle');
    this.add.image(180, COUNTER_Y - 12, 'lab', 'tableLong').setOrigin(0).setScale(3);
    this.add.image(276, COUNTER_Y - 12, 'lab', 'tableFlask').setOrigin(0).setScale(3);
    // the panel under the room
    this.add.rectangle(0, PANEL_Y, WIDTH, HEIGHT - PANEL_Y, hex('#2b2238')).setOrigin(0);
    this.add.rectangle(0, PANEL_Y, WIDTH, 3, hex(PALETTE.ink)).setOrigin(0);
  }

  refreshShelf() {
    this.shelfLayer.removeAll(true);
    const list = G.shelfList(this.s);
    const icons = [];
    for (const e of list) for (let i = 0; i < e.n; i++) icons.push(e.potion);
    const per = 6;
    const shown = icons.slice(0, per * 2);
    shown.forEach((p, i) => {
      const row = Math.floor(i / per); const col = i % per;
      this.shelfLayer.add(this.add.image(176 + col * 30, 120 + row * 40, `potion_${p}`).setScale(2));
    });
    this.moreTxt.setText(icons.length > shown.length ? `+${icons.length - shown.length}` : '');
    this.moreTxt.setVisible(icons.length > shown.length).setDepth(2);
    if (!icons.length) this.shelfLayer.add(text(this, 252, 138, 'Empty shelves', { color: '#b89878' }));
  }

  refresh() {
    const s = this.s;
    const phase = { prep: G.isFestivalDay(s) ? 'Festival day' : 'Morning', open: 'Shop open', night: 'Night', over: '' }[s.phase] || '';
    this.bar.update(s, phase);
    this.head.title.setText(`Day ${s.day}`);
    this.appr.setVisible(s.up.apprentice > 0);
    if (s.up.apprentice > 0 && !this.appr.anims.isPlaying) this.appr.play(s.phase === 'prep' ? 'appr-magic' : 'appr-idle');
    this.ui.removeAll(true);
    this.hintRect?.destroy(); this.hintRect = null;
    if (s.phase === 'prep') this.prepUI();
    else if (s.phase === 'open') this.openUI();
    else if (s.phase === 'night') this.nightUI();
  }

  btn(x, y, w, h, label, fn, opts = {}) {
    const b = button(this, x, y, w, h, label, () => { if (anyOpen() || this.__modal || !once(this, 250)) return; fn(); }, opts);
    this.ui.add(b);
    return b;
  }

  // ---------------------------------------------------------------- morning

  prepUI() {
    const s = this.s;
    const L = 96; const R = 264; const W = 160;
    const gather = this.btn(L, 428, W, 48, `Gather (${s.stamina})`, () => this.toGather(), { fill: PALETTE.leaf, color: PALETTE.cream });
    const brew = this.btn(R, 428, W, 48, 'Brew', () => this.toBrew(), { fill: PALETTE.plum, color: PALETTE.cream });
    this.btn(L, 486, W, 48, 'Market', () => showMarket(s, () => { persist(); this.refresh(); }));
    this.btn(R, 486, W, 48, 'Upgrades', () => this.openUpgrades());
    this.btn(L, 544, W, 48, 'Recipes', () => showBook(s));
    this.btn(R, 544, W, 48, `Shelves ${G.shelfCount(s)}/${G.shelfCap(s)}`, () => showShelf(s, { onChange: () => { persist(); this.refreshShelf(); this.refresh(); } }));
    const fest = G.isFestivalDay(s);
    const open = this.btn(WIDTH / 2, 604, 332, 48, fest ? 'Go to the Festival!' : 'Open the shop', () => this.openShop(), { fill: PALETTE.gold });
    // first-day guidance
    if (s.day === 1 && s.mode === 'story') {
      const hasPotions = G.shelfCount(s) > 0;
      if (!s.tut.gathered && !hasPotions) this.hintRect = hint(this, gather, W, 48);
      else if (!hasPotions) this.hintRect = hint(this, brew, W, 48);
      else this.hintRect = hint(this, open, 332, 48);
      if (this.hintRect) this.ui.add(this.hintRect);
    }
  }

  toGather() { persist(); go(this, 'Gather'); }
  toBrew() { persist(); go(this, 'Brew'); }

  openUpgrades() {
    showUpgrades(this.s, (kind) => {
      persist();
      jingle('upgrade');
      this.refresh();
      if (kind === 'up') this.refreshShelf();
    });
  }

  openShop() {
    const s = this.s;
    if (G.isFestivalDay(s)) {
      showTip('The Festival of Flasks', `<p class="al-p">Three rounds: a potion with Fire in it, a Healing Salve, and your finest potion. Each round scores the match, the stars and the value. Your reputation adds a bonus at the end.</p>
        <p class="al-p">You have ${G.shelfCount(s)} potion${G.shelfCount(s) === 1 ? '' : 's'} on your shelves. Ready?</p>`, null, {
        btn: 'Not yet',
        extra: [{ label: "Let's go!", cls: 'gold', fn: () => { if (G.startFestival(s)) { persist(); go(this, 'Festival'); } } }],
      });
      return;
    }
    const go2 = () => {
      if (!G.openShop(s)) return;
      persist();
      sfx('select');
      this.refresh();
      this.nextCustomer();
    };
    if (G.shelfCount(s) === 0 && s.day > 1) {
      showTip('Empty shelves', '<p class="al-p">You have no potions to sell. Open anyway? Customers will leave empty-handed.</p>', null, {
        btn: 'Back', extra: [{ label: 'Open anyway', cls: 'gold', fn: go2 }],
      });
      return;
    }
    if (G.shelfCount(s) === 0) { toast(this, 'Brew a potion first! Tap Brew.'); sfx('error'); return; }
    go2();
  }

  // ---------------------------------------------------------------- customers

  openUI() {
    const s = this.s;
    const c = G.current(s);
    if (!c) {
      this.say(null, 'That was the last customer of the day.');
      this.btn(WIDTH / 2, 600, 300, 52, 'Close up for the night', () => this.closeUp(), { fill: PALETTE.gold });
      return;
    }
    const who = c.title ? `${c.name}, ${c.title}` : c.name;
    this.say(who, c.text, `${s.cur + 1} of ${s.queue.length}`);
    if (c.talk) {
      this.btn(WIDTH / 2, 600, 240, 52, 'Goodbye!', () => this.talkDone(), { fill: PALETTE.gold });
      return;
    }
    if (c.counter) { this.counterUI(c); return; }
    this.btn(116, 600, 204, 52, 'Offer a potion', () => this.offerFlow(), { fill: PALETTE.gold });
    this.btn(292, 600, 124, 52, 'Sorry...', () => this.sorry());
  }

  /** Speech box in the bottom panel. */
  say(name, msg, right = '') {
    if (name) this.ui.add(text(this, 14, 414, name, { origin: [0, 0.5], color: PALETTE.gold }));
    if (right) this.ui.add(text(this, WIDTH - 14, 414, right, { origin: [1, 0.5], color: PALETTE.lavender }));
    const box = this.add.rectangle(WIDTH / 2, 432, WIDTH - 20, 132, hex('#3e3050')).setOrigin(0.5, 0).setStrokeStyle(3, hex(PALETTE.ink));
    this.ui.add(box);
    const t = text(this, 22, 442, `"${msg}"`, { origin: [0, 0], wrap: WIDTH - 44, align: 'left' });
    this.ui.add(t);
    return t;
  }

  nextCustomer() {
    const s = this.s;
    const c = G.current(s);
    this.customerSprite?.destroy();
    this.customerSprite = null;
    if (!c) { this.refresh(); return; }
    this.spawnCustomer(c, true);
    this.refresh();
    if (!s.tut.selling && !c.talk) {
      s.tut.selling = true; persist();
      this.time.delayedCall(800, () => showTip('Your first customer', `<p class="al-p">Customers tell you what they need. Tap <b>Offer a potion</b> and the shelf shows which potions fit.</p>
        <p class="al-p">Then pick a price. The fair price is a safe choice; asking more can start some haggling. Happy customers raise your reputation, and more reputation brings more customers.</p>`));
    }
  }

  spawnCustomer(c, walk) {
    const spr = this.add.sprite(walk ? WIDTH + 40 : 262, PANEL_Y - 8, 'npcs', c.row * 4).setOrigin(0.5, 1).setScale(4).play(`npc${c.row}`);
    if (c.tint) spr.setTint(c.tint);
    spr.setDepth(50);
    this.customerSprite = spr;
    if (!walk) return;
    jingle('door');
    this.tweens.add({ targets: spr, x: 262, duration: 700, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: spr, y: spr.y - 6, duration: 120, yoyo: true, repeat: 2 });
  }

  leave(happy) {
    const spr = this.customerSprite;
    this.customerSprite = null;
    if (!spr) return;
    if (happy) this.tweens.add({ targets: spr, y: spr.y - 14, duration: 140, yoyo: true });
    this.tweens.add({ targets: spr, x: WIDTH + 50, delay: 250, duration: 650, ease: 'Sine.easeIn', onComplete: () => spr.destroy() });
  }

  offerFlow() {
    const s = this.s;
    const c = G.current(s);
    if (!c) return;
    if (!G.shelfCount(s)) { toast(this, 'Your shelves are empty.', 380); sfx('error'); return; }
    showShelf(s, {
      mode: 'offer', customer: c,
      onPick: (key) => showPrice(s, key, c, (price) => this.makeOffer(key, price), () => this.offerFlow()),
    });
  }

  makeOffer(key, price) {
    const s = this.s;
    const r = G.offer(s, key, price);
    persist();
    this.react(r);
  }

  /** Show what the customer said and the result, then the next step. */
  react(r) {
    const s = this.s;
    if (!r || r.outcome === 'none') { this.refresh(); return; }
    const c = s.queue[r.outcome === 'counter' || r.outcome === 'wrong' ? s.cur : s.cur - 1];
    this.refreshShelf();
    this.ui.removeAll(true);
    this.bar.update(s, 'Shop open');
    const who = c ? (c.title ? `${c.name}, ${c.title}` : c.name) : '';
    if (r.outcome === 'counter') { this.counterUI(G.current(s), r); return; }
    if (r.outcome === 'wrong') {
      sfx('error');
      this.say(who, `Hmm, a ${POTIONS[r.potion].name}? That's not what I need. I was hoping for something else.`, r.patience === 1 ? 'Last try!' : '');
      this.btn(116, 600, 204, 52, 'Offer another', () => this.offerFlow(), { fill: PALETTE.gold });
      this.btn(292, 600, 124, 52, 'Sorry...', () => this.sorry());
      this.wiggle();
      return;
    }
    let line; let result;
    if (r.outcome === 'sold') {
      jingle('sale'); sfx('coin');
      line = r.line || (r.grumpy ? 'Fine. Daylight robbery, but fine.' : r.weak ? 'A bit weak... but it will do, I suppose.' : r.rep >= 2 ? 'Wonderful! Thank you so much!' : 'Thanks. That will do nicely.');
      result = `Sold for ${r.price} coins. Reputation ${fmt(r.rep)}.`;
      if (r.gift) result += r.gift.coins ? ` Gift: ${r.gift.coins} coins!` : ` Gift: ${r.gift.n} ${INGREDIENTS[r.gift.ing].name}!`;
      this.coinPop(`+${r.price}`);
      this.leave(true);
    } else if (r.outcome === 'left') {
      sfx('lose');
      line = r.why === 'price' ? 'Insist?! I\'m taking my business elsewhere!' : r.why === 'wrong' ? 'You don\'t have what I need. Good day.' : 'Too bad. Goodbye then.';
      result = `They left. Reputation ${fmt(r.rep)}.`;
      this.leave(false);
    } else if (r.outcome === 'sorry') {
      line = r.line || 'Oh well. Maybe next time.';
      result = r.rep ? `Reputation ${fmt(r.rep)}.` : 'No harm done.';
      if (r.gift?.ing) result += ` Gift: ${r.gift.n} ${INGREDIENTS[r.gift.ing].name}!`;
      this.leave(false);
    } else if (r.outcome === 'talk') {
      line = 'See you around!';
      result = r.gift ? (r.gift.coins ? `Gift: ${r.gift.coins} coins!` : `Gift: ${r.gift.n} ${INGREDIENTS[r.gift.ing].name}!`) : '';
      this.leave(true);
    } else return;
    const t = this.say(who, line);
    if (result) this.ui.add(text(this, 22, t.y + t.height + 10, result, { origin: [0, 0], color: r.rep < 0 ? '#ff9a8a' : '#a8e070', wrap: WIDTH - 44, align: 'left' }));
    const last = G.shopDone(s);
    this.btn(WIDTH / 2, 600, 300, 52, last ? 'Close up for the night' : 'Next customer', () => (last ? this.closeUp() : this.nextCustomer()), { fill: PALETTE.gold });
  }

  counterUI(c, r) {
    const offerC = c.counter;
    if (!offerC) return;
    sfx('select');
    const who = c.title ? `${c.name}, ${c.title}` : c.name;
    this.say(who, `${offerC.price} coins? That's too much! I'll give you ${offerC.counter}.${r?.weak ? ' It\'s weaker than I asked for, after all.' : ''}`);
    this.btn(66, 600, 112, 52, `Take ${offerC.counter}`, () => { this.react(G.acceptCounter(this.s)); persist(); }, { fill: PALETTE.gold });
    this.btn(182, 600, 112, 52, 'Insist', () => { this.react(G.insist(this.s)); persist(); }, { fill: PALETTE.orange });
    this.btn(298, 600, 112, 52, 'No deal', () => { this.react(G.refuseCounter(this.s)); persist(); });
    this.wiggle();
  }

  sorry() { const r = G.sorry(this.s); persist(); this.react(r); }
  talkDone() { const r = G.goodbye(this.s); persist(); if (r.gift) sfx('coin'); this.react(r); }

  wiggle() {
    const spr = this.customerSprite;
    if (spr) this.tweens.add({ targets: spr, x: spr.x + 4, duration: 60, yoyo: true, repeat: 2 });
  }

  coinPop(msg) {
    const t = text(this, 262, 300, msg, { size: 32, color: PALETTE.gold }).setDepth(60);
    this.tweens.add({ targets: t, y: 250, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- night

  closeUp() {
    const s = this.s;
    const r = G.closeShop(s);
    if (!r) return;
    reportDay(r.satisfaction, r.customers);
    noteBest(s);
    persist();
    this.customerSprite?.destroy();
    playMusic('night');
    this.refresh();
    this.openNight();
  }

  openNight() {
    const s = this.s;
    const r = s.lastReport;
    if (!r) return;
    if (r.closed) jingle('sad');
    showNight(s, r, {
      onSleep: () => (r.closed ? go(this, 'Ending') : this.sleep()),
      onUpgrades: () => this.openUpgrades(),
    });
    if (!s.tut.night && !r.closed) {
      s.tut.night = true; persist();
      showTip('Night time', `<p class="al-p">Every night the shop pays rent${s.up.apprentice ? ' and wages' : ''}. It goes up a little every 5 days.</p>
        <p class="al-p">Spend your coins on <b>Upgrades</b>: a bigger basket, a better cauldron, a sign for more customers, and new places to gather (the Forest opens on day 2).</p>`);
    }
  }

  nightUI() {
    this.say(null, 'The shop is closed. Time to rest.');
    this.btn(96, 544, 160, 48, 'Ledger', () => this.openNight());
    this.btn(264, 544, 160, 48, 'Upgrades', () => this.openUpgrades());
    this.btn(WIDTH / 2, 604, 332, 48, 'Go to sleep', () => this.sleep(), { fill: PALETTE.gold });
  }

  sleep() {
    const s = this.s;
    if (s.phase !== 'night') return;
    s.skill = getSkill();
    G.sleep(s);
    persist();
    this.cameras.main.fadeOut(400, 10, 6, 20);
    this.input.enabled = false;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ from: 'night' }));
  }

  morningNews() {
    const s = this.s;
    const bits = [];
    if (s.today.apprentice.length) bits.push(`Nell brewed ${s.today.apprentice.length} potion${s.today.apprentice.length === 1 ? '' : 's'} overnight.`);
    if (s.day === 2 && s.mode === 'story') bits.push('The Forest can now be opened in Upgrades.');
    if (s.mode === 'story' && s.day === STORY_DAYS - 1) bits.push('The festival is tomorrow!');
    toast(this, `Good morning! Day ${s.day}.${bits.length ? ` ${bits.join(' ')}` : ''}`, 360);
    sfx('select');
  }

  festivalMorning() {
    const s = this.s;
    s.tut.festDay = true; persist();
    showTip('Festival day!', `<p class="al-p">Today is the Festival of Flasks. The shop stays closed: gather and brew one last time, then tap <b>Go to the Festival!</b></p>
      <p class="al-p">Rounds: a Fire potion, a Healing Salve, and your finest potion.</p>`);
  }

  intro() {
    const s = this.s;
    s.tut.intro = true; persist();
    showTip('A letter from Aunt Hazel', `<div class="al-quote">My dear, I'm off to see the world, so the shop is yours now. The garden out back has everything you need to start. Brew good potions, be fair with folk, and pay the rent on time!<br><br>P.S. The Festival of Flasks is in ${STORY_DAYS} days. That awful Madame Vex has won it for years...</div>
      <p class="al-p">Each morning: gather ingredients, then brew them into potions. Then open the shop and sell to the townsfolk.</p>
      <p class="al-p">Start in the garden. Tap <b>Gather</b>.</p>`, null, { btn: "Let's begin" });
  }
}

const fmt = (n) => (n > 0 ? `+${n}` : n === 0 ? '+0' : String(n));
