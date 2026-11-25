import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { reportDaily } from '../../../shared/core/trophies.js';
import { WIDTH, header, go, modal, busyUi, store, persist, fit, drawBar, hpColor, sleep } from './common.js';
import { battleSkillPanel, battleItemPanel, tipPanel, closeAll } from './panels.js';
import * as B from '../logic/battle.js';
import * as G from '../logic/game.js';
import { CLASSES, SKILLS, ITEMS, MONSTERS, STATUS } from '../logic/data.js';
import { makeRng } from '../logic/rng.js';
import { dailySetup, breather, dailyScore, WAVES } from '../logic/daily.js';
import { playMusic, jingle, fx } from '../music.js';
import { save } from '../save.js';
import { give, checkTrophies, GAME } from '../trophies.js';

const FIELD_TOP = 54;
const FIELD_H = 196;
const MSG_Y = 254;
const CARD_Y = 336;
const CARD_H = 114;
const CMD_Y = 456;

// [sky top, sky bottom, ground tile, back wall tile (indoors)]
const BACKDROPS = {
  plains: ['#2a3a6a', '#4a5a9a', 'grass'], eastfield: ['#2a3a6a', '#4a5a9a', 'grass2'], desert: ['#3a2a5a', '#7a4a6a', 'sand'],
  frost: ['#20284a', '#5a6a9a', 'snow'], molecave: ['#120c10', '#2a1c1c', 'floorC', 'rockO'], tower: ['#141a3a', '#2a3466', 'floorB', 'wallB'],
  embercave: ['#1a0808', '#4a1410', 'floorS', 'rockR'], castle: ['#14080e', '#3a1020', 'floorR', 'wallR'], sky: ['#1a1c48', '#3a3e80', 'floorRing'],
};
const MAP_BACK = { mc1: 'molecave', mc2: 'molecave', tw1: 'tower', tw2: 'tower', tw3: 'tower', tw4: 'sky', ec1: 'embercave', ec2: 'embercave', cs1: 'castle', cs2: 'castle', cs3: 'castle' };

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) { this.data0 = data || {}; }

  create() {
    closeAll();
    this.__leaving = false;
    this.cameras.main.setBackgroundColor('#0c0a18').fadeIn(160);
    this.speed = save.get('speed') || 1;
    this.auto = !!save.get('autoBattle');
    this.daily = !!this.data0.daily;
    this.tapResolve = null;
    // The scene object is reused for every battle: reset what the last one left behind.
    this.ending = false; this.choosing = null; this.targetMode = null; this.markers = null; this.dailyRun = null; this.st = null;
    this.input.on('pointerup', () => { if (this.tapResolve && !busyUi(this) && Date.now() - (this.__modalClosedAt || 0) > 250) { const r = this.tapResolve; this.tapResolve = null; r(); } });

    if (this.daily) {
      const d = dailySetup(store.daily?.seed ?? 1);
      this.dailyRun = { ...d, wave: 0, rounds: 0 };
      this.party = d.party;
      this.bag = d.bag;
      this.rng = makeRng(d.seed ^ 0x5a5a);
      this.setup = { enemies: d.waves[0], area: 'castle' };
    } else {
      this.st = store.state;
      if (!this.st) { this.scene.start('Title'); return; }
      this.setup = this.data0.setup;
      this.party = this.st.party;
      this.bag = this.st.bag;
      this.rng = G.rngOf(this.st);
    }
    const s = this.setup;
    this.back = BACKDROPS[s.area] || BACKDROPS[MAP_BACK[s.map]] || BACKDROPS.plains;
    this.makeBattle();
    window.__pq = { scene: this, b: this.b, B, ready: false };

    const title = this.daily ? `Daily Arena 1/${WAVES}` : s.boss ? MONSTERS[s.boss].name : 'Battle';
    this.titleText = header(this, title, () => this.pauseMenu());
    this.drawBackdrop();
    this.foeSprites = [];
    this.drawFoes();
    this.msgBg = panel(this, 6, MSG_Y, WIDTH - 12, 76, { fill: '#211d44', inner: PALETTE.cream, border: PALETTE.ink });
    this.msgText = text(this, 20, MSG_Y + 12, '', { origin: 0, align: 'left', color: PALETTE.cream, wrap: WIDTH - 40 });
    this.cards = [];
    this.party.forEach((_, i) => this.cards.push(this.makeCard(i)));
    this.cards.forEach((_, i) => this.updateCard(i));
    this.cmd = this.add.container(0, 0).setDepth(100);
    this.toggles();
    playMusic(s.boss ? (s.boss === 'vesper' ? 'final' : 'boss') : this.daily ? 'boss' : 'battle');
    this.flawless = true;
    this.intro();
  }

  makeBattle() {
    const s = this.setup;
    const opts = this.daily ? { diff: 1, goldMult: 0 } : G.battleOpts(this.st);
    this.b = B.createBattle({ party: this.party, enemies: s.enemies, bag: this.bag, rng: this.rng, boss: !!s.boss || this.daily, canRun: !this.daily && !s.boss, phase2: s.phase2 || null, ...opts });
    if (this.daily && [2, 4].includes(this.dailyRun.wave)) this.b.boss = true;
  }

  // ------------------------------------------------------------ drawing

  drawBackdrop() {
    const [top, mid, ground, wall] = this.back;
    const g = this.add.graphics();
    const bands = 6;
    const c1 = Phaser.Display.Color.HexStringToColor(top); const c2 = Phaser.Display.Color.HexStringToColor(mid);
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, FIELD_TOP + i * 22, WIDTH, 22);
    }
    if (wall) {
      // Indoors: the dungeon's own wall behind the monsters, dimmed so they stand out.
      for (let x = 0; x < WIDTH; x += 32) for (let y = FIELD_TOP; y < FIELD_TOP + 132; y += 32) this.add.image(x, y, 'atlas', wall).setOrigin(0).setScale(2).setAlpha(0.45);
    }
    for (let x = 0; x < WIDTH; x += 32) for (let y = FIELD_TOP + 132; y < FIELD_TOP + FIELD_H; y += 32) this.add.image(x, y, 'atlas', ground).setOrigin(0).setScale(2).setAlpha(0.95);
    this.add.rectangle(0, FIELD_TOP + 132, WIDTH, 4, 0x000000, 0.35).setOrigin(0);
    if (this.st && !this.st.flags.vesper && !MAP_BACK[this.setup.map]) {
      for (let i = 0; i < 14; i++) this.add.rectangle(Phaser.Math.Between(4, WIDTH - 4), Phaser.Math.Between(FIELD_TOP + 6, FIELD_TOP + 100), 2, 2, 0xf9f5ef, 0.6);
    }
  }

  drawFoes() {
    for (const s of this.foeSprites) { s.img.destroy(); s.bar.destroy(); s.zone.destroy(); }
    this.foeSprites = [];
    const foes = this.b.foes;
    const scaleOf = (f) => (typeof f.d.spr === 'string' ? (f.d.spr === 'tentacle' || f.d.spr === 'scorpion' ? 3 : 3.6) : f.d.big ? 6 : foes.length >= 5 ? 3.4 : 4);
    const widths = foes.map((f) => this.textures.get(`m_${f.id}`).getSourceImage().width * scaleOf(f));
    const gap = 6;
    const total = widths.reduce((a, w) => a + w, 0) + gap * (foes.length - 1);
    let x = (WIDTH - total) / 2;
    const base = FIELD_TOP + 170;
    foes.forEach((f, i) => {
      const w = widths[i];
      const cx = Math.round(x + w / 2);
      x += w + gap;
      const img = this.add.image(cx, base, `m_${f.id}`).setOrigin(0.5, 1).setScale(scaleOf(f));
      this.tweens.add({ targets: img, y: base - 3, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const bar = this.add.graphics();
      const zone = this.add.zone(cx, base - img.displayHeight / 2, Math.max(56, w), Math.max(64, img.displayHeight + 20)).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.onFoeTap(i));
      const spr = { img, bar, zone, cx, base, f };
      this.foeSprites.push(spr);
      this.drawFoeBar(i);
    });
  }

  drawFoeBar(i, hp) {
    const s = this.foeSprites[i];
    if (!s) return;
    const f = this.b.foes[i];
    const v = hp ?? f.hp;
    if (v <= 0 || f.fled) { s.bar.clear(); return; }
    drawBar(s.bar, s.cx - 24, s.base + 8, 48, 8, v / f.maxhp, hpColor(v / f.maxhp));
  }

  makeCard(i) {
    const w = 86; const x = this.cardX(i); const y = CARD_Y;
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, CARD_H, hex('#211d44')).setOrigin(0).setStrokeStyle(3, hex(PALETTE.ink));
    const edge = this.add.rectangle(3, 3, w - 6, CARD_H - 6).setOrigin(0).setStrokeStyle(2, hex(PALETTE.cream), 0.7);
    const m = this.party[i];
    const spr = this.add.image(w / 2, 26, 'atlas', `c${CLASSES[m.cls].ch}_6`).setScale(2.5);
    const name = text(this, w / 2, 56, CLASSES[m.cls].name, { color: PALETTE.cream });
    const hp = text(this, w / 2, 76, '', { color: PALETTE.cream });
    const bar = this.add.graphics();
    const mp = text(this, w / 2, 102, '', { color: '#9fb4ff' });
    const st = text(this, w - 6, 6, '', { origin: [1, 0], color: PALETTE.night });
    const stBg = this.add.rectangle(w - 4, 4, 10, 18, 0).setOrigin(1, 0);
    // Small corner marks: gold = attack up, blue = defence up.
    const buff = this.add.rectangle(7, 7, 8, 8, hex(PALETTE.gold)).setOrigin(0).setStrokeStyle(1, hex(PALETTE.ink));
    const buffD = this.add.rectangle(18, 7, 8, 8, 0x5b74d0).setOrigin(0).setStrokeStyle(1, hex(PALETTE.ink));
    c.add([bg, edge, spr, name, hp, bar, mp, stBg, st, buff, buffD]);
    const zone = this.add.zone(x + w / 2, y + CARD_H / 2, w, CARD_H).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.onAllyTap(i));
    return { c, bg, edge, spr, name, hp, bar, mp, st, stBg, buff, buffD, i, shownHp: null, w };
  }

  updateCard(i, shown) {
    const card = this.cards?.[i] || null;
    if (!card) return;
    const a = this.b.allies[i];
    const hp = shown ?? a.hp;
    card.shownHp = hp;
    card.hp.setText(`HP ${Math.max(0, Math.round(hp))}`); fit(card.hp, 80);
    drawBar(card.bar, 8, 86, card.w - 16, 8, hp / a.s.hp, hpColor(hp / a.s.hp));
    card.mp.setText(`MP ${a.mp}`); fit(card.mp, 80);
    const down = a.hp <= 0;
    card.spr.setFrame(down ? `c${CLASSES[a.id].ch}_5` : `c${CLASSES[a.id].ch}_6`).setAlpha(down ? 0.7 : 1);
    card.name.setColor(down ? PALETTE.red : PALETTE.cream);
    const sts = Object.entries(a.st).filter(([, v]) => v > 0).map(([k]) => k);
    if (sts.length && !down) {
      card.st.setText(STATUS[sts[0]].short).setVisible(true);
      card.stBg.setFillStyle(hex(STATUS[sts[0]].color)).setSize(card.st.width + 6, 20).setVisible(true);
    } else { card.st.setVisible(false); card.stBg.setVisible(false); }
    card.buff.setVisible(a.buff.atk > 0 && !down); card.buffD.setVisible(a.buff.def > 0 && !down);
  }

  highlight(i) {
    this.cards.forEach((c, k) => { c.bg.setFillStyle(hex(k === i ? '#4b4588' : '#211d44')); c.edge.setStrokeStyle(2, hex(k === i ? PALETTE.gold : PALETTE.cream), k === i ? 1 : 0.7); });
  }

  toggles() {
    const y = 614;
    this.autoBtn = button(this, 92, y, 168, 42, '', () => { this.auto = !this.auto; save.set('autoBattle', this.auto); this.syncToggles(); if (this.auto && this.choosing) this.choosing.autoNow(); }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.fastBtn = button(this, 270, y, 168, 42, '', () => { this.speed = this.speed >= 4 ? 1 : this.speed * 2; save.set('speed', this.speed); this.syncToggles(); }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.autoBtn.setDepth(200); this.fastBtn.setDepth(200);
    this.syncToggles();
  }

  syncToggles() {
    this.autoBtn.setLabel(this.auto ? 'Auto: ON' : 'Auto: off');
    this.autoBtn.body.setFillStyle(hex(this.auto ? PALETTE.leaf : PALETTE.indigo));
    this.fastBtn.setLabel(this.speed === 1 ? 'Speed >' : this.speed === 2 ? 'Speed >>' : 'Speed >>>');
    this.fastBtn.body.setFillStyle(hex(this.speed > 1 ? PALETTE.leaf : PALETTE.indigo));
  }

  // ------------------------------------------------------------ messages

  dur(ms) { return Math.max(60, ms / this.speed); }

  say(msg, ms) {
    this.msgText.setText(msg);
    const d = this.dur(ms ?? Math.max(520, 280 + msg.length * 16));
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      this.time.delayedCall(d, fin);
      this.time.delayedCall(120, () => { if (!done) this.tapResolve = fin; });
    });
  }

  waitTap(msg) {
    this.msgText.setText(msg);
    return new Promise((res) => { this.time.delayedCall(250, () => { this.tapResolve = res; }); });
  }

  // ------------------------------------------------------------ flow

  async intro() {
    const s = this.setup;
    const names = this.b.foes.map((f) => f.d.name);
    const uniq = [...new Set(names)];
    let msg;
    if (this.daily) msg = `Wave 1 of ${WAVES}. Fight!`;
    else if (s.boss) msg = `${MONSTERS[s.boss].name} attacks!`;
    else if (s.enemies.length === 1) msg = `A ${names[0]} appears!`;
    else msg = uniq.length === 1 ? `${names.length} ${names[0]}s appear!` : 'Monsters appear!';
    await this.say(msg, 900);
    if (!save.get('tips')?.battle && !this.daily) {
      const tips = { ...(save.get('tips') || {}), battle: true };
      save.set('tips', tips);
      await new Promise((r) => tipPanel('Battles', [
        'Choose a command for each hero, then the round plays out. Faster fighters go first.',
        'Fight attacks. Skill uses spells and abilities (they cost MP). Guard halves damage. Run tries to escape.',
        'Tap a monster to target it. Auto lets the heroes fight on their own, and Speed makes battles faster.',
      ], r));
    }
    window.__pq.ready = true;
    this.loop();
  }

  async loop() {
    const b = this.b;
    while (!b.over) {
      let cmds;
      if (this.auto) {
        this.highlight(-1);
        this.msgText.setText('Auto battle...');
        await sleep(this, this.dur(220));
        cmds = B.autoCommands(b);
      } else cmds = await this.chooseAll();
      this.clearCmd();
      const ev = B.runRound(b, cmds);
      if (this.daily) this.dailyRun.rounds++;
      await this.play(ev);
      for (let i = 0; i < this.cards.length; i++) this.updateCard(i);
    }
    this.finishBattle();
  }

  async play(events) {
    for (const e of events) {
      if (e.t === 'msg') { await this.say(e.text); continue; }
      if (e.t === 'turn') {
        if (e.side === 'ally') this.highlight(e.idx); else { this.highlight(-1); const s = this.foeSprites[e.idx]; if (s) { this.tweens.add({ targets: s.img, scaleX: s.img.scaleX * 1.08, scaleY: s.img.scaleY * 1.08, duration: this.dur(90), yoyo: true }); } }
        continue;
      }
      if (e.t === 'fx') { await this.anim(e); continue; }
      if (e.t === 'dmg') { await this.showDamage(e); continue; }
      if (e.t === 'heal') { this.popNumber(e.side, e.idx, `+${e.amount}`, '#8fd46a'); if (e.side === 'ally') this.tweenCard(e.idx, e.hp); else this.drawFoeBar(e.idx); continue; }
      if (e.t === 'mp') { if (e.side === 'ally') this.updateCard(e.idx); continue; }
      if (e.t === 'miss') { fx('miss'); this.popNumber(e.side, e.idx, 'Miss', PALETTE.cream); continue; }
      if (e.t === 'ko') { await this.knockOut(e); continue; }
      if (e.t === 'revive') { fx('heal'); this.updateCard(e.idx); continue; }
      if (e.t === 'status' || e.t === 'buff') { if (e.side === 'ally') this.updateCard(e.idx); else if (e.on && e.t === 'status') this.popNumber('foe', e.idx, STATUS[e.st].short, STATUS[e.st].color); continue; }
      if (e.t === 'flee') { const s = this.foeSprites[e.idx]; fx('miss'); if (s) { this.tweens.add({ targets: s.img, x: s.img.x + 300, alpha: 0, duration: this.dur(400) }); s.bar.clear(); } continue; }
      if (e.t === 'steal') { if (this.st) this.st.steals = (this.st.steals || 0) + 1; continue; }
      if (e.t === 'phase') { await this.phase(); continue; }
    }
  }

  async phase() {
    fx('dark');
    this.cameras.main.flash(400, 160, 80, 200);
    this.cameras.main.shake(400, 0.01);
    await sleep(this, 400);
    this.drawFoes();
    this.titleText.setText(MONSTERS[this.b.foes[0].id].name);
    fit(this.titleText, 220);
    playMusic('final');
  }

  foePos(i) { const s = this.foeSprites[i]; return s ? { x: s.cx, y: s.base - s.img.displayHeight / 2 } : { x: WIDTH / 2, y: 150 }; }
  cardX(i) { return Math.round((WIDTH - this.party.length * 89 + 3) / 2) + i * 89; }
  allyPos(i) { return { x: this.cardX(i) + 43, y: CARD_Y + 40 }; }
  posOf(side, idx) { return side === 'ally' ? this.allyPos(idx) : this.foePos(idx); }

  async anim(e) {
    const kind = e.kind;
    const pts = (e.targets || []).map((t) => this.posOf(t.side, t.idx));
    const color = { slash: 0xf9f5ef, fire: 0xd86020, ice: 0x9fd8ff, bolt: 0xe3d245, holy: 0xfff8c0, heal: 0x8fd46a, buff: 0xe3d245, status: 0x9a407e, dark: 0x8a40a0, steal: 0xe3d245, smoke: 0x8a8fc4 }[kind] || 0xffffff;
    const snd = { slash: 'slash', fire: 'fire', ice: 'ice', bolt: 'bolt', holy: 'holy', heal: 'heal', buff: 'buff', status: 'status', dark: 'dark', steal: 'steal', smoke: 'smoke' }[kind];
    if (snd) fx(snd);
    if (kind === 'slash') {
      for (const p of pts) {
        const l = this.add.rectangle(p.x, p.y, 4, 54, color).setAngle(35).setDepth(300);
        this.tweens.add({ targets: l, scaleY: 0.1, alpha: 0, duration: this.dur(220), onComplete: () => l.destroy() });
      }
      await sleep(this, this.dur(140));
      return;
    }
    if (kind === 'smoke') { this.cameras.main.flash(300, 138, 143, 196); await sleep(this, this.dur(300)); return; }
    for (const p of pts) {
      for (let k = 0; k < 7; k++) {
        const r = this.add.rectangle(p.x + Phaser.Math.Between(-24, 24), p.y + Phaser.Math.Between(-24, 24), 6, 6, color).setDepth(300);
        const up = kind === 'heal' || kind === 'buff' || kind === 'holy';
        this.tweens.add({ targets: r, y: r.y + (up ? -26 : 18), alpha: 0, angle: 90, duration: this.dur(380 + k * 30), onComplete: () => r.destroy() });
      }
    }
    if (kind === 'bolt' || kind === 'dark') this.cameras.main.flash(this.dur(160), kind === 'bolt' ? 240 : 120, kind === 'bolt' ? 230 : 60, kind === 'bolt' ? 120 : 160);
    await sleep(this, this.dur(300));
  }

  popNumber(side, idx, str, color) {
    const p = this.posOf(side, idx);
    const t = text(this, p.x, p.y - 10, str, { size: 16, color }).setDepth(400).setStroke('#040303', 4);
    this.tweens.add({ targets: t, y: t.y - 26, duration: this.dur(500), onComplete: () => this.tweens.add({ targets: t, alpha: 0, duration: this.dur(240), onComplete: () => t.destroy() }) });
  }

  async showDamage(e) {
    if (e.side === 'foe') {
      const s = this.foeSprites[e.idx];
      fx('hurt');
      if (s) {
        s.img.setTintFill(0xffffff);
        this.time.delayedCall(this.dur(80), () => s.img.clearTint());
        this.tweens.add({ targets: s.img, x: s.cx + 6, duration: this.dur(40), yoyo: true, repeat: 2, onComplete: () => s.img.setX(s.cx) });
      }
      this.popNumber('foe', e.idx, String(e.amount), e.crit || e.weak ? PALETTE.gold : PALETTE.cream);
      this.drawFoeBar(e.idx);
    } else {
      fx('hurt');
      this.cameras.main.shake(this.dur(140), e.amount > 40 ? 0.012 : 0.006);
      const card = this.cards[e.idx];
      card.bg.setFillStyle(hex(PALETTE.red));
      this.time.delayedCall(this.dur(160), () => card.bg.setFillStyle(hex('#211d44')));
      this.popNumber('ally', e.idx, String(e.amount), '#ff9a9a');
      this.tweenCard(e.idx, e.hp);
    }
    await sleep(this, this.dur(220));
  }

  tweenCard(i, to) {
    const card = this.cards[i];
    const from = card.shownHp ?? to;
    this.tweens.addCounter({ from, to, duration: this.dur(Math.min(500, 120 + Math.abs(to - from) * 6)), onUpdate: (tw) => this.updateCard(i, tw.getValue()), onComplete: () => this.updateCard(i) });
  }

  async knockOut(e) {
    fx('ko');
    if (e.side === 'foe') {
      const s = this.foeSprites[e.idx];
      if (s) { s.bar.clear(); this.tweens.killTweensOf(s.img); this.tweens.add({ targets: s.img, alpha: 0, scaleY: 0.2, duration: this.dur(300) }); }
    } else {
      this.flawless = false;
      this.updateCard(e.idx);
    }
    await sleep(this, this.dur(200));
  }

  // ------------------------------------------------------------ choosing commands

  clearCmd() { this.cmd.removeAll(true); this.targetMode = null; this.markers?.forEach((m) => m.destroy()); this.markers = null; }

  /** Ask each hero for a command. Resolves to the command list. */
  chooseAll() {
    const b = this.b;
    const cmds = b.allies.map(() => null);
    const order = b.allies.filter(B.canAct).map((a) => a.idx);
    return new Promise((resolve) => {
      let k = 0;
      const next = () => {
        if (k >= order.length) { this.choosing = null; resolve(cmds); return; }
        this.askOne(order[k], k > 0, (cmd) => {
          if (cmd === 'back') { k = Math.max(0, k - 1); cmds[order[k]] = null; next(); return; }
          if (cmd?.type === 'run') { this.choosing = null; resolve(b.allies.map(() => ({ type: 'run' }))); return; }
          cmds[order[k]] = cmd; k++; next();
        });
      };
      this.choosing = { autoNow: () => { this.clearCmd(); closeAll(); this.choosing = null; resolve(B.autoCommands(b)); } };
      next();
    });
  }

  askOne(i, canBack, done) {
    const b = this.b;
    const a = b.allies[i];
    this.clearCmd();
    this.highlight(i);
    this.msgText.setText(`${a.name}: what will you do?`);
    const add = (o) => { this.cmd.add(o); return o; };
    let fired = false;
    const once = (fn) => () => { if (fired || busyUi(this)) return; fn(); };
    const go = (cmd) => { fired = true; done(cmd); };
    const bw = 110; const bh = 48;
    const cols = [62, 180, 298];
    const r1 = 500; const r2 = 556;
    add(button(this, cols[0], r1, bw, bh, 'Fight', once(() => this.pickTarget('foe', (t) => go({ type: 'attack', target: t }), () => this.askOne(i, canBack, done))), { fill: PALETTE.gold }));
    const skillLabel = a.id === 'mage' || a.id === 'cleric' ? 'Spell' : 'Skill';
    add(button(this, cols[1], r1, bw, bh, skillLabel, once(() => {
      battleSkillPanel(b, a, {
        onPick: (id) => {
          const sk = SKILLS[id];
          const need = { foe: 'foe', ally: 'ally', dead: 'dead' }[sk.target];
          if (!need) { go({ type: 'skill', skill: id }); return; }
          this.pickTarget(need, (t) => go({ type: 'skill', skill: id, target: t }), () => this.askOne(i, canBack, done));
        },
      });
    }), { fill: PALETTE.cream }));
    add(button(this, cols[2], r1, bw, bh, 'Item', once(() => {
      battleItemPanel(b, {
        onPick: (id) => {
          const it = ITEMS[id];
          const need = { ally: 'ally', dead: 'dead' }[it.target];
          if (!need) { go({ type: 'item', item: id }); return; }
          this.pickTarget(need, (t) => go({ type: 'item', item: id, target: t }), () => this.askOne(i, canBack, done));
        },
      });
    }), { fill: PALETTE.cream }));
    add(button(this, cols[0], r2, bw, bh, 'Guard', once(() => go({ type: 'guard' })), { fill: PALETTE.lavender }));
    const run = add(button(this, cols[1], r2, bw, bh, 'Run', once(() => go({ type: 'run' })), { fill: PALETTE.lavender }));
    if (!b.canRun) run.setEnabled(false);
    const back = add(button(this, cols[2], r2, bw, bh, 'Back', once(() => go('back')), { fill: PALETTE.indigo, color: PALETTE.cream }));
    if (!canBack) back.setEnabled(false);
  }

  /** kind: 'foe' | 'ally' | 'dead'. Skips the question when there is only one choice. */
  pickTarget(kind, done, cancel) {
    const b = this.b;
    const list = kind === 'foe' ? B.livingFoes(b) : kind === 'ally' ? B.livingAllies(b) : b.allies.filter((a) => a.hp <= 0);
    if (!list.length) { fx('error'); cancel(); return; }
    if (list.length === 1) { done({ side: list[0].side, idx: list[0].idx }); return; }
    this.clearCmd();
    this.msgText.setText(kind === 'foe' ? `Tap a monster: ${list.map((f) => f.name).join(', ')}` : kind === 'dead' ? 'Tap a fallen hero.' : 'Tap a hero.');
    this.targetMode = { kind, done: (t) => { this.targetMode = null; this.markers?.forEach((m) => m.destroy()); done(t); } };
    this.markers = list.map((u) => {
      const p = this.posOf(u.side, u.idx);
      const m = text(this, p.x, p.y - (u.side === 'foe' ? this.foeSprites[u.idx].img.displayHeight / 2 + 14 : 52), 'v', { size: 32, color: PALETTE.gold }).setDepth(350);
      this.tweens.add({ targets: m, y: m.y + 4, duration: 260, yoyo: true, repeat: -1 });
      return m;
    });
    this.cmd.add(button(this, WIDTH / 2, 528, 200, 48, 'Cancel', () => { this.targetMode = null; this.markers?.forEach((m) => m.destroy()); cancel(); }, { fill: PALETTE.indigo, color: PALETTE.cream }));
  }

  onFoeTap(i) {
    if (!this.targetMode || this.targetMode.kind !== 'foe' || busyUi(this)) return;
    const f = this.b.foes[i];
    if (!B.alive(f)) { fx('error'); return; }
    fx('select');
    this.targetMode.done({ side: 'foe', idx: i });
  }

  onAllyTap(i) {
    if (!this.targetMode || this.targetMode.kind === 'foe' || busyUi(this)) return;
    const a = this.b.allies[i];
    if (this.targetMode.kind === 'dead' ? a.hp > 0 : a.hp <= 0) { fx('error'); return; }
    fx('select');
    this.targetMode.done({ side: 'ally', idx: i });
  }

  pauseMenu() {
    if (busyUi(this) || this.ending) return;
    const opts = [];
    if (this.daily) opts.push(['Give up', () => { this.b.over = 'lose'; closeAll(); this.choosing?.autoNow(); }, PALETTE.red, PALETTE.cream]);
    opts.push(['Keep fighting', null]);
    modal(this, 'Paused', [
      this.daily ? 'Giving up ends today\'s run with the waves you have cleared.' : this.b.canRun ? 'To escape, choose Run on a hero\'s turn.' : 'You can\'t run from this fight!',
      'Your journey saves after every battle.',
    ], opts);
  }

  // ------------------------------------------------------------ the end

  async finishBattle() {
    this.ending = true;
    this.clearCmd();
    this.highlight(-1);
    const b = this.b;
    if (this.daily) { await this.dailyNext(); return; }
    const st = this.st;
    const res = B.finish(b);
    st.battles++;
    const s = this.setup;
    if (b.over === 'win' && !b.defeated.length) {
      // Everything ran away (a Gold Ooze, say): no victory fanfare.
      await this.waitTap(this.b.foes.length === 1 ? `The ${this.b.foes[0].d.name} got away...` : 'The monsters got away...');
      persist();
      go(this, 'World', { after: {} });
      return;
    }
    if (b.over === 'win') {
      playMusic(null);
      jingle('victory');
      const { ups, lines } = G.applyWin(st, res, { boss: s.boss || null });
      if (s.mimic) G.markOpened(st, s.mimic);
      if (b.defeated.includes('goldooze')) st.flags.goldooze = true;
      if (s.boss && this.flawless) give('flawless');
      await this.waitTap(`Victory! ${res.xp} XP and ${res.gold} gold.`);
      if (res.drops.length) await this.waitTap(`Found ${res.drops.map((d) => ITEMS[d].name).join(', ')}!`);
      for (const u of ups) {
        jingle('level');
        const learned = u.learned.length ? ` Learned ${u.learned.join(', ')}!` : '';
        await this.waitTap(`${u.name} is now level ${u.lv}!${learned}`);
      }
      checkTrophies(st);
      persist();
      if (s.boss === 'vesper') { go(this, 'Ending'); return; }
      go(this, 'World', { after: { lines, boss: s.boss } });
      return;
    }
    if (b.over === 'fled') { persist(); go(this, 'World', { after: {} }); return; }
    // Everyone fell.
    playMusic(null);
    jingle('lose');
    this.cameras.main.flash(500, 60, 0, 0);
    await this.waitTap('The party has fallen...');
    const { lost } = G.applyWipe(st);
    persist();
    const where = G.MAPS[st.lastInn.map]?.name || 'town';
    const lines = [lost ? `You wake up in ${where}. You lost ${lost} gold.` : `You wake up in ${where}, safe and sound.`];
    if (s.boss) lines.push('Train a little, buy better gear, then try again!');
    modal(this, 'Defeat', [lines[0]], [['Wake up', () => go(this, 'World', { after: { lines, wiped: true } })]]);
  }

  async dailyNext() {
    const run = this.dailyRun;
    const b = this.b;
    if (b.over === 'win') {
      run.wave++;
      if (run.wave < WAVES) {
        jingle('item');
        breather(this.party);
        await this.waitTap(`Wave ${run.wave} cleared! Everyone catches their breath.`);
        this.setup = { enemies: run.waves[run.wave], area: 'castle' };
        this.makeBattle();
        window.__pq.b = this.b;
        this.titleText.setText(`Daily Arena ${run.wave + 1}/${WAVES}`);
        this.drawFoes();
        for (let i = 0; i < this.cards.length; i++) this.updateCard(i);
        this.ending = false;
        await this.say(run.wave === 2 || run.wave === 4 ? `A boss: ${MONSTERS[run.waves[run.wave][0]].name}!` : `Wave ${run.wave + 1}!`, 800);
        this.loop();
        return;
      }
    }
    const cleared = run.wave;
    const score = dailyScore({ cleared, party: this.party, rounds: run.rounds });
    const r = reportDaily(GAME, score);
    if (cleared >= WAVES) { give('daily'); jingle('victory'); } else jingle('lose');
    modal(this, cleared >= WAVES ? 'Arena cleared!' : 'Arena over', [
      `Waves cleared: ${cleared} of ${WAVES}`,
      `Score: ${score}`,
      { text: r.isBest ? 'A new best for today!' : `Today's best: ${r.best}`, color: PALETTE.gold },
      { text: `Daily streak: ${r.streak}`, color: PALETTE.lavender },
    ], [['Back to title', () => go(this, 'Title')]]);
  }
}

