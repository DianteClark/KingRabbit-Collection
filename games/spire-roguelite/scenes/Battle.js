import Phaser from 'phaser';
import {
  PALETTE, hex, text, button, WIDTH, HEIGHT, route, go, setBackground, icon, unit, playOnce, outlined, floatText,
  toast, sfx, topBar, runMenu, modal, info, showCards, relicInfo,
} from './common.js';
import { handCard, wideCard } from './cardview.js';
import { ACT_COLORS } from './MapScene.js';
import { Combat, HAND_LIMIT } from '../logic/combat.js';
import { CARDS, cardName } from '../logic/cards.js';
import { ENEMIES } from '../logic/enemies.js';
import { STATUSES } from '../logic/statuses.js';
import { POTIONS } from '../logic/potions.js';
import { RELICS } from '../logic/relics.js';
import { HEROES, finishCombat, discardPotion } from '../logic/run.js';
import { saveRun } from '../save.js';

const FEET_Y = 246;
const PLAYER = { x: 60, y: 392 };
const CONTROLS_Y = 436;
const HAND_Y = 552;
const PLAY_LINE = 470; // drag a card above this line to play it
const PANEL_TOP = 292;

const INTENT_TINT = { attack: 0xff7b6b, defend: 0x8fc3ff };

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.run = data.run;
    this.c = new Combat(this.run, this.run.combat);
    this.selected = null;
    this.press = null;
    this.busy = false;
    this.potionAim = null;
    this.ended = false;
  }

  create() {
    const run = this.run;
    const colors = ACT_COLORS[(run.act - 1) % 3];
    setBackground(this, colors.bg);
    this.drawBackdrop(colors);

    this.bar = topBar(this, run, {
      onDeck: () => showCards(this, run.deck, 'Your deck', { combat: null }),
      onMenu: () => runMenu(this, run, { onAbandon: () => this.abandon() }),
      onPotion: (slot) => this.potionMenu(slot),
    });
    this.drawRelics();
    this.turnText = text(this, WIDTH - 8, 56, '', { origin: [1, 0.5], color: PALETTE.lavender }).setDepth(41);

    // Background tap target: deselects.
    this.add.zone(0, 44, WIDTH, HEIGHT - 44).setOrigin(0).setInteractive().on('pointerup', () => {
      if (!this.press?.dragging) this.deselect();
    });

    this.enemyViews = new Map();
    this.layoutEnemies();
    this.drawPlayer();
    this.drawControls();
    this.hint = outlined(this, WIDTH / 2, 470, '', { color: PALETTE.sand }).setDepth(35);
    this.panel = this.add.container(0, 0).setDepth(36);
    this.handGroup = this.add.container(0, 0).setDepth(30);
    this.handViews = [];

    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));

    // Play any events left from creating the fight (relic effects at the start), then show the hand.
    const evs = this.c.takeEvents();
    this.refresh();
    this.buildHand(true);
    if (this.c.s.turn === 1 && evs.some((e) => e.t === 'turn')) this.banner(this.c.s.kind === 'boss' ? 'Boss fight!' : this.c.s.kind === 'elite' ? 'Elite fight!' : 'Fight!');
    saveRun(run);
    window.__battle = this; // for automated tests
  }

  // ------------------------------------------------------------ drawing

  drawBackdrop(colors) {
    const g = this.add.graphics();
    g.fillStyle(hex(colors.ground)).fillRect(0, 150, WIDTH, 270);
    g.fillStyle(hex(colors.dots), 0.8);
    for (let i = 0; i < 14; i++) g.fillRect(0, 150 + i * 20, WIDTH, 2);
    g.fillStyle(hex(PALETTE.ink), 0.35).fillRect(0, 420, WIDTH, HEIGHT - 420);
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.run.floor), String(this.run.seed)]);
    for (let i = 0; i < 9; i++) {
      this.add.image(rnd.between(0, WIDTH), rnd.between(118, 138), 'trees', rnd.pick(['1,0', '1,3', '1,6'])).setScale(3).setTint(colors.tint).setAlpha(0.4);
    }
  }

  drawRelics() {
    this.relicIcons = this.run.relics.map((id, i) => {
      const r = RELICS[id];
      const img = icon(this, 14 + i * 20, 56, r.art, 1).setDepth(41).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => relicInfo(this, id));
      return img;
    });
  }

  enemyPositions(n) {
    const xs = { 1: [220], 2: [140, 270], 3: [70, 180, 290], 4: [52, 136, 220, 304] }[Math.min(4, n)] || [];
    return xs;
  }

  /** (Re)build every enemy's view. Called at the start and when one is summoned. */
  layoutEnemies() {
    for (const v of this.enemyViews.values()) v.c.destroy();
    this.enemyViews.clear();
    const list = this.c.s.enemies;
    const xs = this.enemyPositions(list.length);
    list.forEach((e, i) => {
      if (e.dead && !this.enemyViews.has(e.uid)) { /* keep slot empty */ }
      const d = ENEMIES[e.id];
      const big = d.boss;
      const scale = list.length >= 4 ? 3 : 4;
      const x = xs[i];
      const c = this.add.container(0, 0).setDepth(10);
      const shadow = this.add.ellipse(x, FEET_Y - 2, big ? 80 : 52, 12, hex(PALETTE.ink), 0.45);
      const spr = unit(this, x, FEET_Y, d.sprite, scale, true);
      const h = (big ? 24 : 16) * scale;
      const zone = this.add.zone(x, FEET_Y - h / 2, Math.max(56, h * 0.8), h + 30).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapEnemy(e.uid));
      const barW = big ? 96 : 66;
      const bar = this.hpBar(x, FEET_Y + 12, barW);
      const blk = this.blockBadge(x - barW / 2 - 4, FEET_Y + 12);
      const intent = this.add.container(x, FEET_Y - h - 14);
      const statuses = this.add.container(x, FEET_Y + 32);
      const ring = this.add.ellipse(x, FEET_Y - 2, big ? 96 : 64, 18).setStrokeStyle(2, hex(PALETTE.gold)).setVisible(false);
      c.add([ring, shadow, spr, zone, bar.c, blk.c, intent, statuses]);
      this.enemyViews.set(e.uid, { c, spr, bar, blk, intent, statuses, ring, x, h, e });
      if (e.dead) c.setVisible(false);
    });
  }

  hpBar(x, y, w) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, 16, hex(PALETTE.ink)).setStrokeStyle(2, hex(PALETTE.ink));
    const fill = this.add.rectangle(-w / 2 + 1, 0, w - 2, 12, hex(PALETTE.red)).setOrigin(0, 0.5);
    const t = outlined(this, 0, 0, '');
    c.add([bg, fill, t]);
    return {
      c,
      set: (hp, max, blocked) => {
        fill.width = Math.max(0, (w - 2) * (hp / max));
        fill.setFillStyle(hex(blocked ? '#5b8fd6' : PALETTE.red));
        t.setText(`${hp}/${max}`);
      },
    };
  }

  blockBadge(x, y) {
    const c = this.add.container(x, y).setVisible(false);
    const ic = icon(this, 0, 0, 'ui:2,1', 2).setTint(0x8fc3ff);
    const t = outlined(this, 0, 0, '');
    c.add([ic, t]);
    return { c, set: (n) => { c.setVisible(n > 0); t.setText(String(n)); } };
  }

  drawPlayer() {
    const h = HEROES[this.run.hero];
    this.add.ellipse(PLAYER.x, PLAYER.y - 2, 56, 12, hex(PALETTE.ink), 0.45);
    this.player = unit(this, PLAYER.x, PLAYER.y, h.sprite, 4);
    this.add.zone(PLAYER.x, PLAYER.y - 32, 64, 72).setInteractive().on('pointerup', () => this.tapPlayer());
    this.pBar = this.hpBar(PLAYER.x, PLAYER.y + 12, 84);
    this.pBlock = this.blockBadge(PLAYER.x - 46, PLAYER.y + 12);
    this.pStatus = this.add.container(118, PLAYER.y - 10);
  }

  drawControls() {
    const y = CONTROLS_Y;
    this.add.circle(34, y, 24, hex(PALETTE.ink));
    this.orb = this.add.circle(34, y, 21, hex(PALETTE.gold));
    this.energyText = text(this, 34, y, '', { color: PALETTE.night });
    this.drawBtn = button(this, 96, y, 64, 36, '', () => this.showPile('draw'), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.discBtn = button(this, 166, y, 64, 36, '', () => this.showPile('discard'), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.exhBtn = button(this, 222, y, 36, 36, '', () => this.showPile('exhaust'), { fill: PALETTE.wine, color: PALETTE.cream });
    this.endBtn = button(this, 300, y, 104, 40, 'End turn', () => this.endTurn(), { fill: PALETTE.gold });
    for (const [b, ref] of [[this.drawBtn, 'sk:19,1'], [this.discBtn, 'sk:6,6']]) {
      b.face.add(icon(this, -16, 0, ref, 1));
      b.label.setX(10);
    }
  }

  statusRow(container, st, { maxPerRow = 4, center = true } = {}) {
    container.removeAll(true);
    const entries = Object.entries(st).filter(([k, n]) => n && STATUSES[k] && k !== 'strUp');
    const w = 34;
    entries.forEach(([k, n], i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const inRow = Math.min(maxPerRow, entries.length - row * maxPerRow);
      const x = center ? (col - (inRow - 1) / 2) * w : col * w;
      const debuff = STATUSES[k].kind === 'debuff' || (k === 'str' && n < 0);
      const bg = this.add.rectangle(x - 7, row * 20, 18, 18, hex(debuff ? PALETTE.plum : PALETTE.ink), 0.9);
      const ic = icon(this, x - 7, row * 20, STATUSES[k].art, 1);
      const showN = !['bulwark'].includes(k);
      const t = showN ? outlined(this, x + 4, row * 20 + 2, String(n), { origin: [0, 0.5], color: debuff ? '#ffb0e0' : PALETTE.cream }) : null;
      container.add([bg, ic]);
      if (t) container.add(t);
    });
  }

  drawIntent(view) {
    const { intent, e } = view;
    intent.removeAll(true);
    if (e.dead) return;
    const it = this.c.intent(e);
    if (!it) return;
    const parts = [];
    const main = it.kinds[0];
    if (main === 'attack') {
      parts.push(icon(this, 0, 0, 'ui:3,2', 2).setTint(INTENT_TINT.attack));
      const label = it.times > 1 ? `${it.dmg}x${it.times}` : `${it.dmg}`;
      parts.push(outlined(this, 0, 0, label, { size: label.length <= 3 ? 32 : 16, color: '#ffd0c8' }));
    } else if (main === 'defend') {
      parts.push(icon(this, 0, 0, 'ui:2,1', 2).setTint(INTENT_TINT.defend));
    } else if (main === 'buff') parts.push(this.arrow(true));
    else if (main === 'debuff') parts.push(this.arrow(false));
    else if (main === 'summon') parts.push(icon(this, 0, 0, 'sp:0,2', 2));
    else parts.push(outlined(this, 0, 0, '?', { size: 32 }));
    // Extra small icons for combined intents.
    const extra = it.kinds.slice(1);
    const w = parts.length === 2 ? 36 + parts[1].width : 32;
    if (parts.length === 2) { parts[0].setX(-w / 2 + 16); parts[1].setOrigin(0, 0.5).setX(-w / 2 + 34); }
    extra.forEach((k, i) => {
      const x = w / 2 + 6 + i * 14;
      if (k === 'defend') parts.push(icon(this, x, 6, 'ui:2,1', 1).setTint(INTENT_TINT.defend));
      if (k === 'buff') parts.push(this.arrow(true, 0.5).setPosition(x, 6));
      if (k === 'debuff') parts.push(this.arrow(false, 0.5).setPosition(x, 6));
      if (k === 'summon') parts.push(icon(this, x, 6, 'sp:0,2', 1));
    });
    const bounds = parts.length === 2 ? w : 34;
    const extraW = extra.length * 14;
    const pill = this.add.rectangle(extraW / 2, 0, bounds + extraW + 8, 30, hex(PALETTE.ink), 0.6);
    intent.add([pill, ...parts]);
  }

  arrow(up, s = 1) {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink));
    const k = up ? 1 : -1;
    g.fillTriangle(-12 * s, 2 * s * k, 12 * s, 2 * s * k, 0, -13 * s * k);
    g.fillRect(-6 * s, (up ? 1 : -13) * s, 12 * s, 12 * s);
    g.fillStyle(hex(up ? '#7fd36b' : '#c46bd6'));
    g.fillTriangle(-9 * s, 0, 9 * s, 0, 0, -10 * s * k);
    g.fillRect(-4 * s, (up ? 0 : -10) * s, 8 * s, 10 * s);
    return g;
  }

  // ------------------------------------------------------------ refresh

  refresh() {
    const s = this.c.s;
    for (const v of this.enemyViews.values()) {
      const e = v.e;
      if (e.dead) { v.c.setVisible(false); continue; }
      v.c.setVisible(true);
      v.bar.set(e.hp, e.maxHp, e.block > 0);
      v.blk.set(e.block);
      this.statusRow(v.statuses, e.st);
      this.drawIntent(v);
    }
    const p = s.player;
    this.pBar.set(p.hp, p.maxHp, p.block > 0);
    this.pBlock.set(p.block);
    this.statusRow(this.pStatus, p.st, { maxPerRow: 6, center: false });
    this.energyText.setText(`${s.energy}/${this.c.maxEnergy()}`);
    this.orb.setFillStyle(hex(s.energy > 0 ? PALETTE.gold : PALETTE.indigo));
    this.drawBtn.setLabel(String(s.draw.length));
    this.discBtn.setLabel(String(s.discard.length));
    this.exhBtn.setLabel(String(s.exhaust.length)).setVisible(s.exhaust.length > 0);
    this.turnText.setText(`Turn ${s.turn}`);
    this.bar.refresh();
    this.endBtn.setEnabled(!this.busy && !s.over);
    this.updatePlayable();
  }

  // ------------------------------------------------------------ hand

  buildHand(fromDeck = false) {
    for (const v of this.handViews) v.destroy();
    this.handViews = [];
    const hand = this.c.s.hand;
    hand.forEach((card, i) => {
      const v = handCard(this, card, { combat: this.c, playable: !this.c.whyNot(card) });
      const zone = this.add.zone(0, 0, 76, 108).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p) => { if (!this.busy) this.press = { uid: card.uid, x: p.x, y: p.y, dragging: false, view: v }; });
      v.add(zone);
      v.zone = zone;
      this.handGroup.add(v);
      this.handViews.push(v);
      const pos = this.handPos(i, hand.length);
      if (fromDeck) {
        v.setPosition(20, HEIGHT + 60).setAngle(-20);
        this.tweens.add({ targets: v, x: pos.x, y: pos.y, angle: pos.angle, duration: 220, delay: i * 50, ease: 'Quad.easeOut' });
      } else v.setPosition(pos.x, pos.y).setAngle(pos.angle);
    });
    this.layoutHand(false);
  }

  handPos(i, n) {
    const spacing = n <= 1 ? 0 : Math.min(78, (WIDTH - 16 - 76) / (n - 1));
    const total = spacing * (n - 1);
    const x = WIDTH / 2 - total / 2 + i * spacing;
    const mid = (n - 1) / 2;
    const off = n <= 1 ? 0 : (i - mid) / Math.max(1, mid);
    return { x, y: HAND_Y + Math.abs(off) * 8, angle: off * 4 };
  }

  layoutHand(animate = true) {
    const n = this.handViews.length;
    this.handViews.forEach((v, i) => {
      const pos = this.handPos(i, n);
      const sel = this.selected === v.card.uid;
      const target = { x: pos.x, y: sel ? HAND_Y - 14 : pos.y, angle: sel ? 0 : pos.angle, scale: 1 };
      this.handGroup.bringToTop(v);
      if (animate) this.tweens.add({ targets: v, ...target, duration: 120 });
      else v.setPosition(target.x, target.y).setAngle(target.angle).setScale(target.scale);
    });
    const selView = this.handViews.find((v) => v.card.uid === this.selected);
    if (selView) this.handGroup.bringToTop(selView);
  }

  updatePlayable() {
    for (const v of this.handViews) {
      const ok = !this.c.whyNot(v.card);
      v.setAlpha(ok ? 1 : 0.6);
      v.costText?.setColor(ok ? PALETTE.night : PALETTE.red);
    }
  }

  // ------------------------------------------------------------ input

  onMove(p) {
    const pr = this.press;
    if (!pr || this.busy || !p.isDown) return;
    if (!pr.dragging && Math.hypot(p.x - pr.x, p.y - pr.y) > 12) {
      pr.dragging = true;
      this.selectCard(pr.uid, false);
      this.handGroup.bringToTop(pr.view);
    }
    if (pr.dragging) {
      pr.view.setPosition(p.x, p.y - 30).setAngle(0).setScale(1.08);
      const card = this.cardByUid(pr.uid);
      const over = p.y < PLAY_LINE;
      const target = card && this.c.needsTarget(card) && over ? this.enemyAt(p.x, p.y) : null;
      for (const v of this.enemyViews.values()) v.ring.setVisible(v.e.uid === target);
      this.hint.setText(over ? (card && this.c.needsTarget(card) && !target && this.c.livingEnemies().length > 1 ? 'Drop it on an enemy' : 'Release to play') : 'Drag up to play');
    }
  }

  onUp(p) {
    const pr = this.press;
    this.press = null;
    if (!pr || this.busy) return;
    for (const v of this.enemyViews.values()) v.ring.setVisible(false);
    if (pr.dragging) {
      const card = this.cardByUid(pr.uid);
      if (card && p.y < PLAY_LINE) {
        const target = this.c.needsTarget(card) ? this.enemyAt(p.x, p.y) : undefined;
        if (this.c.needsTarget(card) && target === null && this.c.livingEnemies().length > 1) {
          this.hint.setText('Tap an enemy to aim it');
          this.layoutHand();
          return;
        }
        this.tryPlay(pr.uid, target ?? undefined);
      } else {
        this.layoutHand();
        this.hint.setText(this.selected ? this.hintFor(card) : '');
      }
      return;
    }
    // A tap on a card.
    if (Math.hypot(p.x - pr.x, p.y - pr.y) <= 12) this.tapCard(pr.uid);
  }

  cardByUid(uid) { return this.c.s.hand.find((c) => c.uid === uid); }

  enemyAt(x, y) {
    let best = null;
    let bestD = 1e9;
    for (const v of this.enemyViews.values()) {
      if (v.e.dead) continue;
      const cy = FEET_Y - v.h / 2;
      const d = Math.abs(x - v.x) + Math.abs(y - cy) * 0.5;
      if (Math.abs(x - v.x) < 60 && y < FEET_Y + 60 && d < bestD) { bestD = d; best = v.e.uid; }
    }
    return best;
  }

  tapCard(uid) {
    if (this.busy) return;
    const card = this.cardByUid(uid);
    if (!card) return;
    if (this.selected === uid) {
      // Second tap plays it (when no aim is needed, or there is only one enemy).
      if (!this.c.needsTarget(card) || this.c.livingEnemies().length === 1) this.tryPlay(uid);
      else { this.hint.setText('Tap an enemy to aim it'); sfx('error'); }
      return;
    }
    sfx('select');
    this.selectCard(uid, true);
  }

  selectCard(uid, animate) {
    this.selected = uid;
    this.potionAim = null;
    const card = this.cardByUid(uid);
    this.showPanel(card);
    this.layoutHand(animate);
    this.hint.setText(this.hintFor(card));
  }

  hintFor(card) {
    if (!card) return '';
    const why = this.c.whyNot(card);
    if (why) return why;
    if (this.c.needsTarget(card) && this.c.livingEnemies().length > 1) return 'Tap an enemy (or drag the card onto one)';
    return 'Tap the card again to play it';
  }

  deselect() {
    if (this.busy) return;
    this.selected = null;
    this.potionAim = null;
    this.panel.removeAll(true);
    this.hint.setText('');
    this.layoutHand();
  }

  showPanel(card) {
    this.panel.removeAll(true);
    if (!card) return;
    const w = wideCard(this, card, WIDTH - 20, { combat: this.c });
    w.setPosition(10, Math.min(PANEL_TOP, 404 - w.h));
    this.panel.add(w);
    this.panel.setAlpha(0.96);
  }

  tapEnemy(uid) {
    if (this.busy) return;
    if (this.potionAim !== null) { const slot = this.potionAim; this.potionAim = null; this.drinkPotion(slot, uid); return; }
    if (this.selected) {
      const card = this.cardByUid(this.selected);
      if (card) { this.tryPlay(card.uid, this.c.needsTarget(card) ? uid : undefined); return; }
    }
    this.enemyInfo(uid);
  }

  enemyInfo(uid) {
    const v = this.enemyViews.get(uid);
    if (!v) return;
    const e = v.e;
    const d = ENEMIES[e.id];
    const lines = [`HP ${e.hp}/${e.maxHp}${e.block ? `   Block ${e.block}` : ''}`, '', `Next turn - ${this.c.intentText(e)}`];
    const st = Object.entries(e.st).filter(([k, n]) => n && STATUSES[k] && k !== 'strUp');
    if (st.length) { lines.push(''); for (const [k, n] of st) lines.push(`${STATUSES[k].name} ${n}: ${STATUSES[k].desc(n)}`); }
    info(this, d.name + (d.boss ? ' (Boss)' : d.elite ? ' (Elite)' : ''), lines.join('\n'), { width: 340 });
  }

  tapPlayer() {
    if (this.busy) return;
    if (this.selected) { const card = this.cardByUid(this.selected); if (card && !this.c.needsTarget(card)) { this.tryPlay(card.uid); return; } }
    const p = this.c.p;
    const lines = [`HP ${p.hp}/${p.maxHp}${p.block ? `   Block ${p.block}` : ''}`, `Energy ${this.c.s.energy}`];
    const st = Object.entries(p.st).filter(([k, n]) => n && STATUSES[k]);
    if (st.length) { lines.push(''); for (const [k, n] of st) lines.push(`${STATUSES[k].name} ${n}: ${STATUSES[k].desc(n)}`); }
    else lines.push('', 'No buffs or debuffs.');
    info(this, HEROES[this.run.hero].name, lines.join('\n'), { width: 340 });
  }

  showPile(which) {
    if (this.busy) return;
    const titles = { draw: 'Draw pile (random order)', discard: 'Discard pile', exhaust: 'Exhausted cards' };
    showCards(this, this.c.s[which], titles[which], { combat: this.c });
  }

  // ------------------------------------------------------------ actions

  tryPlay(uid, target) {
    if (this.busy || this.c.s.over) return;
    const card = this.cardByUid(uid);
    if (!card) return;
    const why = this.c.whyNot(card);
    if (why) { sfx('error'); toast(this, why, 478, PALETTE.orange); this.layoutHand(); return; }
    if (this.c.needsTarget(card) && target === undefined && this.c.livingEnemies().length > 1) {
      this.selectCard(uid, true);
      return;
    }
    const d = CARDS[card.id];
    const view = this.handViews.find((v) => v.card.uid === uid);
    if (!this.c.playCard(uid, target)) { sfx('error'); this.layoutHand(); return; }
    sfx(d.type === 'attack' ? 'hit' : d.type === 'power' ? 'power' : 'card');
    if (d.type === 'attack') playOnce(this.player, 'attack');
    this.selected = null;
    this.panel.removeAll(true);
    this.hint.setText('');
    // Fly the played card away, then rebuild the hand.
    if (view) {
      this.handViews = this.handViews.filter((v) => v !== view);
      view.zone.disableInteractive();
      const tv = target !== undefined ? this.enemyViews.get(target) : null;
      this.tweens.add({ targets: view, x: tv ? tv.x : WIDTH / 2, y: tv ? FEET_Y - 40 : 330, scale: 0.4, alpha: 0, duration: 200, onComplete: () => view.destroy() });
    }
    const evs = this.c.takeEvents();
    this.animate(evs, () => this.afterAction());
    this.syncHand();
  }

  /** Keep the hand views in step with the state after a card draws or adds cards. */
  syncHand() {
    const uids = this.c.s.hand.map((c) => c.uid);
    const have = this.handViews.map((v) => v.card.uid);
    if (uids.length === have.length && uids.every((u, i) => u === have[i])) { this.layoutHand(); this.updatePlayable(); return; }
    this.buildHand(false);
  }

  afterAction() {
    this.refresh();
    this.syncHand();
    saveRun(this.run);
    this.checkOver();
  }

  endTurn() {
    if (this.busy || this.c.s.over) return;
    sfx('tap');
    this.deselect();
    this.busy = true;
    this.endBtn.setEnabled(false);
    // Discard the hand.
    const keep = this.run.relics.some((r) => RELICS[r]?.keepHand);
    for (const v of this.handViews) {
      v.zone.disableInteractive();
      if (!keep) this.tweens.add({ targets: v, x: WIDTH - 20, y: HEIGHT + 60, angle: 20, duration: 220, onComplete: () => v.destroy() });
    }
    if (!keep) this.handViews = [];
    this.hint.setText('Enemy turn');
    this.time.delayedCall(260, () => {
      this.c.endTurn();
      const evs = this.c.takeEvents();
      this.animate(evs, () => {
        this.hint.setText('');
        this.refresh();
        if (this.c.s.over) { this.checkOver(); return; }
        this.buildHand(true);
        this.banner('Your turn');
        this.refresh();
        saveRun(this.run);
      });
    });
  }

  potionMenu(slot) {
    if (this.busy || this.c.s.over) return;
    const id = this.run.potions[slot];
    const p = POTIONS[id];
    if (!p) return;
    const m = modal(this, p.name, p.text, [
      ['Drink', () => {
        m.destroy();
        if (p.target === 'enemy' && this.c.livingEnemies().length > 1) {
          this.deselect();
          this.potionAim = slot;
          this.hint.setText('Tap an enemy for the potion');
          return;
        }
        this.drinkPotion(slot);
      }],
      ['Throw away', () => { m.destroy(); discardPotion(this.run, slot); this.bar.refresh(); saveRun(this.run); }, PALETTE.red, PALETTE.cream],
      ['Close', () => m.destroy(), PALETTE.lavender],
    ], { art: { ref: 'ar:6,8', scale: 3, tint: p.tint } });
  }

  drinkPotion(slot, target) {
    if (!this.c.usePotion(slot, target)) { sfx('error'); return; }
    sfx('power');
    this.hint.setText('');
    this.animate(this.c.takeEvents(), () => this.afterAction());
    this.syncHand();
  }

  // ------------------------------------------------------------ animation

  animate(events, done) {
    this.busy = true;
    this.endBtn.setEnabled(false);
    let t = 0;
    const at = (fn, gap) => { this.time.delayedCall(t, fn); t += gap; };
    for (const ev of events) {
      switch (ev.t) {
        case 'move': t += 220; at(() => this.enemyMove(ev), 300); break;
        case 'hit': at(() => this.showHit(ev), ev.who === 'p' ? 180 : 110); break;
        case 'block': at(() => this.showBlock(ev), 80); break;
        case 'status': at(() => this.showStatus(ev), 90); break;
        case 'heal': at(() => this.showHeal(ev), 100); break;
        case 'die': case 'flee': at(() => this.showDeath(ev), 160); break;
        case 'summon': at(() => { this.layoutEnemies(); this.refresh(); sfx('place'); }, 250); break;
        case 'negate': at(() => this.unitFloat(ev.who, 'Blocked!', PALETTE.sand, 16), 60); break;
        case 'addCard': at(() => toast(this, `${ev.n} ${CARDS[ev.id].name} added to your ${ev.pile === 'draw' ? 'draw pile' : ev.pile === 'hand' ? 'hand' : 'discard'}`, 300, PALETTE.sand), 200); break;
        case 'shuffle': at(() => this.unitFloat('p', 'Shuffle', PALETTE.lavender, 16), 0); break;
        case 'poison': at(() => sfx('smallBoom'), 0); break;
        case 'energy': at(() => this.energyText.setText(`${this.c.s.energy}/${this.c.maxEnergy()}`), 0); break;
        case 'upgradeAll': at(() => toast(this, 'All cards upgraded!', 300), 0); break;
        default: break;
      }
    }
    this.time.delayedCall(t + 80, () => { this.busy = false; done?.(); });
  }

  unitPos(who) {
    if (who === 'p') return { x: PLAYER.x, y: PLAYER.y - 40, spr: this.player };
    const v = this.enemyViews.get(who);
    return v ? { x: v.x, y: FEET_Y - v.h / 2, spr: v.spr, v } : null;
  }

  unitFloat(who, str, color, size = 32) {
    const u = this.unitPos(who);
    if (u) floatText(this, u.x, u.y - 10, str, color, size);
  }

  enemyMove(ev) {
    const v = this.enemyViews.get(ev.who);
    if (!v || v.e.dead) return;
    playOnce(v.spr, 'attack');
    this.tweens.add({ targets: v.spr, x: v.x - 14, duration: 90, yoyo: true });
    const label = outlined(this, Phaser.Math.Clamp(v.x, 60, WIDTH - 60), FEET_Y - v.h - 36, ev.name, { color: PALETTE.sand }).setDepth(44);
    this.tweens.add({ targets: label, alpha: 0, delay: 500, duration: 250, onComplete: () => label.destroy() });
  }

  showHit(ev) {
    const u = this.unitPos(ev.who);
    if (!u) return;
    if (ev.who === 'p') {
      this.pBar.set(ev.hp, this.c.p.maxHp, ev.block > 0);
      this.pBlock.set(ev.block);
      if (ev.amt > 0) { this.cameras.main.shake(120, 0.006); sfx('capture'); playOnce(this.player, 'hit'); }
      else sfx('bounce');
    } else {
      u.v.bar.set(ev.hp, u.v.e.maxHp, ev.block > 0);
      u.v.blk.set(ev.block);
      if (ev.amt > 0) playOnce(u.spr, 'hit');
      sfx(ev.amt > 0 ? 'hit' : 'bounce');
    }
    if (u.spr) { u.spr.setTintFill(0xffffff); this.time.delayedCall(80, () => u.spr.active && u.spr.clearTint()); }
    floatText(this, u.x + Phaser.Math.Between(-10, 10), u.y, ev.amt > 0 ? String(ev.amt) : 'Blocked', ev.amt > 0 ? (ev.who === 'p' ? '#ff6b6b' : PALETTE.cream) : '#8fc3ff', ev.amt > 0 ? 32 : 16);
  }

  showBlock(ev) {
    if (ev.who === 'p') this.pBlock.set(ev.block);
    else this.enemyViews.get(ev.who)?.blk.set(ev.block);
    this.unitFloat(ev.who, `+${ev.amt}`, '#8fc3ff', 16);
    sfx('place');
  }

  showStatus(ev) {
    if (ev.st === 'cleanse') { this.unitFloat('p', 'Cleansed', '#9be36b', 16); return; }
    const s = STATUSES[ev.st];
    if (!s) return;
    const debuff = s.kind === 'debuff' || (ev.st === 'str' && ev.n < 0);
    this.unitFloat(ev.who, `${s.name} ${ev.n > 0 ? '+' : ''}${ev.n}`, debuff ? '#e6a0ff' : '#9be36b', 16);
    // Statuses change intents and card numbers right away.
    if (ev.who === 'p') this.statusRow(this.pStatus, this.c.p.st, { maxPerRow: 6, center: false });
    else { const v = this.enemyViews.get(ev.who); if (v) this.statusRow(v.statuses, v.e.st); }
  }

  showHeal(ev) {
    if (ev.who === 'p') this.pBar.set(ev.hp, this.c.p.maxHp, this.c.p.block > 0);
    else { const v = this.enemyViews.get(ev.who); v?.bar.set(ev.hp, v.e.maxHp, v.e.block > 0); }
    this.unitFloat(ev.who, ev.note || `+${ev.amt}`, '#9be36b', ev.note ? 16 : 32);
    sfx('coin');
  }

  showDeath(ev) {
    const v = this.enemyViews.get(ev.who);
    if (!v) return;
    sfx('smallBoom');
    v.intent.removeAll(true);
    v.statuses.removeAll(true);
    v.bar.c.setVisible(false);
    v.blk.c.setVisible(false);
    playOnce(v.spr, 'death');
    this.tweens.add({ targets: v.c, alpha: 0, delay: 350, duration: 300, onComplete: () => v.c.setVisible(false).setAlpha(1) });
  }

  banner(str) {
    const t = outlined(this, WIDTH / 2, 300, str, { size: 32, color: PALETTE.gold }).setDepth(60).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 250, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ end of fight

  checkOver() {
    const s = this.c.s;
    if (!s.over || this.ended) return;
    this.ended = true;
    this.busy = true;
    for (const v of this.handViews) v.destroy();
    this.handViews = [];
    if (s.over === 'win') {
      sfx('win');
      this.banner('Victory!');
      this.time.delayedCall(1000, () => { finishCombat(this.run); route(this, this.run); });
    } else {
      sfx('lose');
      playOnce(this.player, 'death');
      this.banner('Defeated...');
      this.time.delayedCall(1500, () => { finishCombat(this.run); route(this, this.run); });
    }
  }

  abandon() {
    this.run.combat = null;
    this.run.screen = 'dead';
    this.run.abandoned = true;
    saveRun(this.run);
    go(this, 'RunEnd', { run: this.run });
  }
}

export { cardName, HAND_LIMIT };
