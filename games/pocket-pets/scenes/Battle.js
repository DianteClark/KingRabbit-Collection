import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, header, go, store, persist, petImage, setPetFrame, typeChip, drawBar, hpColor, fit, LCD } from './common.js';
import { getSkill, reportResult, SKILL_ID } from '../adaptive.js';
import { petFrames, PET_MOOD } from '../art.js';
import * as G from '../logic/game.js';
import * as B from '../logic/battle.js';
import { makeAI, botAction } from '../logic/ai.js';
import { MOVES, SPECIES, STATUS_INFO, ITEMS } from '../logic/data.js';
import { TYPE_INFO, typeMult } from '../logic/types.js';
import { maxHp, petName, petType, xpForLevel, MAX_LEVEL, learnMove, canEvolve } from '../logic/pet.js';
import { partyPanel, bagPanel, learnPanel, closeAll, blocking } from './panels.js';

const SCREEN = { x: 8, y: 60, w: 344, h: 266 };
const POS = [{ x: 96, y: 258 }, { x: 262, y: 148 }];
const MSG_Y = 334;
const MOVE_SFX = { flame: 'shoot', tide: 'bounce', leaf: 'flip', spark: 'hit', stone: 'thud', plain: 'move' };

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) { this.setup = data.setup; }

  create() {
    closeAll();
    const st = store.state;
    this.state = st;
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(150);
    const setup = this.setup;
    this.rng = G.rngOf(st);
    this.dexBefore = { ...st.dex.caught };
    this.b = B.createBattle({
      kind: setup.kind, party: st.party, bag: st.bag, foeParty: setup.foeParty, foe: setup.foe, rng: this.rng,
      ai: setup.kind === 'trainer' ? makeAI(getSkill(SKILL_ID), this.rng) : null,
    });
    window.__pets = { scene: this, b: this.b, state: st, G, ready: false, bot: (catchItem) => this.ready && this.act(botAction(this.b, this.rng, { catchItem })) };
    const title = setup.kind === 'wild' ? 'Wild battle' : `${setup.foe.title} ${setup.foe.name}`;
    header(this, title, null);

    // The pocket screen
    this.add.rectangle(SCREEN.x - 4, SCREEN.y - 4, SCREEN.w + 8, SCREEN.h + 8, hex(PALETTE.ink)).setOrigin(0);
    this.add.rectangle(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, hex(LCD.light)).setOrigin(0);
    this.add.tileSprite(SCREEN.x, SCREEN.y, SCREEN.w / 2, SCREEN.h / 2, 'screen', 'dots').setOrigin(0).setScale(2).setAlpha(0.28);
    for (const p of POS) this.add.ellipse(p.x, p.y + 44, 132, 22, hex(LCD.mid), 0.55);

    this.pets = [null, null];
    this.boxes = [this.makeBox(0), this.makeBox(1)];
    this.msgBg = panel(this, 6, MSG_Y, WIDTH - 12, 80, { fill: PALETTE.cream, inner: PALETTE.night, border: PALETTE.ink });
    this.msgText = text(this, 20, MSG_Y + 12, '', { origin: 0, align: 'left', color: PALETTE.night, wrap: WIDTH - 40 });
    this.menu = this.add.container(0, 0);
    this.input.on('pointerup', () => { if (this.tapResolve) { const r = this.tapResolve; this.tapResolve = null; r(); } });
    this.intro();
  }

  // ------------------------------------------------------------ info boxes

  makeBox(side) {
    const w = side === 0 ? 176 : 184; const h = side === 0 ? 92 : 70;
    const x = side === 0 ? WIDTH - 16 - w : 16; const y = side === 0 ? 218 : 70;
    const c = this.add.container(x, y).setDepth(5);
    const bg = this.add.graphics();
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, 0, w, h);
    bg.fillStyle(hex(PALETTE.cream)).fillRect(3, 3, w - 6, h - 6);
    bg.fillStyle(hex(LCD.shade)).fillRect(3, h - 10, w - 6, 7);
    const name = text(this, 10, 16, '', { origin: [0, 0.5], color: PALETTE.night });
    const lv = text(this, w - 10, 16, '', { origin: [1, 0.5], color: PALETTE.night });
    const bar = this.add.graphics();
    const hpLabel = text(this, 10, 40, 'HP', { origin: [0, 0.5], color: PALETTE.red });
    const st = text(this, w - 10, 40, '', { origin: [1, 0.5], color: PALETTE.cream });
    const stBg = this.add.rectangle(w - 8, 40, 10, 20, 0x000000).setOrigin(1, 0.5);
    const hpNum = text(this, w - 10, 62, '', { origin: [1, 0.5], color: PALETTE.night });
    const xp = this.add.graphics();
    c.add([bg, name, lv, bar, hpLabel, stBg, st, hpNum, xp]);
    const box = { c, w, h, name, lv, bar, st, stBg, hpNum, xp, side, shownHp: 0 };
    if (side === 1 && this.setup.kind === 'trainer') {
      box.balls = this.setup.foeParty.map((_, i) => this.add.image(14 + i * 22, h + 12, 'items', 'capsule').setScale(2));
      c.add(box.balls);
    }
    return box;
  }

  /** Redraw a box for the active pet on `side` (hp = shown HP). */
  updateBox(side, hp) {
    const box = this.boxes[side];
    const pet = B.active(this.b, side);
    const mh = maxHp(pet);
    box.shownHp = hp ?? pet.hp;
    box.name.setText(petName(pet)); fit(box.name, box.w - 70);
    box.lv.setText(`Lv${pet.lv}`);
    const barX = 36; const barW = box.w - 36 - (pet.st ? 52 : 10);
    drawBar(box.bar, barX, 32, barW, 14, box.shownHp / mh, hpColor(box.shownHp / mh));
    if (pet.st) {
      box.st.setText(STATUS_INFO[pet.st].short).setVisible(true);
      box.stBg.setFillStyle(hex(STATUS_INFO[pet.st].color)).setSize(box.st.width + 8, 20).setVisible(true);
    } else { box.st.setVisible(false); box.stBg.setVisible(false); }
    if (side === 0) {
      box.hpNum.setText(`${Math.max(0, Math.round(box.shownHp))}/${mh}`);
      const lo = xpForLevel(pet.lv); const hi = pet.lv >= MAX_LEVEL ? lo + 1 : xpForLevel(pet.lv + 1);
      box.xp.clear();
      box.xp.fillStyle(0x3a3a3a).fillRect(10, box.h - 12, box.w - 20, 6);
      box.xp.fillStyle(0x3f74c9).fillRect(10, box.h - 12, Math.round((box.w - 20) * Math.min(1, (pet.xp - lo) / (hi - lo))), 6);
    }
    if (box.balls) {
      this.setup.foeParty.forEach((p, i) => box.balls[i].setAlpha(p.hp > 0 ? 1 : 0.25));
    }
  }

  tweenHp(side, to) {
    const box = this.boxes[side];
    const from = box.shownHp;
    return new Promise((res) => {
      this.tweens.addCounter({
        from, to, duration: Math.min(700, 120 + Math.abs(to - from) * 18),
        onUpdate: (tw) => this.updateBox(side, tw.getValue()),
        onComplete: () => { this.updateBox(side, to); res(); },
      });
    });
  }

  // ------------------------------------------------------------ helpers

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  tween(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r })); }

  /** Show a message and wait (tap to hurry). */
  say(msg, ms) {
    if (!msg) return Promise.resolve();
    this.msgText.setText(msg);
    const dur = ms ?? Math.max(700, 350 + msg.length * 24);
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      this.time.delayedCall(dur, fin);
      this.time.delayedCall(220, () => { if (!done) this.tapResolve = fin; });
    });
  }

  showPet(side, { pop = true } = {}) {
    const pet = B.active(this.b, side);
    this.pets[side]?.destroy();
    const scale = SPECIES[pet.sp].stage === 'baby' ? 6 : 5;
    const img = petImage(this, POS[side].x, POS[side].y, pet.sp, scale, pet.st === 'sleep' ? PET_MOOD.faint[0] : 0).setDepth(2);
    img.base = scale;
    if (side === 0) img.setFlipX(true);
    this.pets[side] = img;
    img.sp = pet.sp;
    this.idle(side);
    if (pop) { img.setScale(0.5); this.tweens.add({ targets: img, scale, duration: 220, ease: 'Back.out' }); }
    return img;
  }

  idle(side) {
    const img = this.pets[side];
    if (!img) return;
    img.idleEv?.remove();
    let f = 0;
    img.idleEv = this.time.addEvent({
      delay: 600 + side * 90, loop: true, callback: () => {
        if (!img.active || img.locked) return;
        const pet = B.active(this.b, side);
        if (pet.sp !== img.sp) return;
        if (pet.st === 'sleep') { setPetFrame(img, pet.sp, PET_MOOD.faint[0]); return; }
        f = f ? 0 : 1;
        setPetFrame(img, pet.sp, PET_MOOD.idle[f]);
        img.y = POS[side].y - f * 3;
      },
    });
  }

  mood(side, frame, ms = 400) {
    const img = this.pets[side];
    if (!img) return;
    img.locked = true;
    setPetFrame(img, img.sp, frame);
    this.time.delayedCall(ms, () => { img.locked = false; });
  }

  // ------------------------------------------------------------ flow

  async intro() {
    const b = this.b;
    const setup = this.setup;
    this.updateBox(1);
    this.boxes[0].c.setVisible(false);
    if (setup.kind === 'trainer') {
      this.boxes[1].c.setVisible(false);
      const tamer = this.add.image(POS[1].x, POS[1].y, 'chars2', `c${setup.foe.ch ?? 0}_1`).setScale(5).setFlipX(true);
      tamer.x = WIDTH + 60;
      await this.tween({ targets: tamer, x: POS[1].x, duration: 380, ease: 'Cubic.out' });
      await this.say(`${setup.foe.title} ${setup.foe.name} wants to battle!`);
      await this.tween({ targets: tamer, x: WIDTH + 60, duration: 260 });
      tamer.destroy();
      this.boxes[1].c.setVisible(true);
      sfx('select');
      this.showPet(1);
      await this.say(`${setup.foe.name} sent out ${petName(B.active(b, 1))}!`);
    } else {
      const img = this.showPet(1, { pop: false });
      img.x = -60;
      await this.tween({ targets: img, x: POS[1].x, duration: 420, ease: 'Cubic.out' });
      sfx('select');
      await this.say(`A wild ${petName(B.active(b, 1))} appeared!`);
    }
    this.boxes[0].c.setVisible(true);
    this.updateBox(0);
    this.showPet(0);
    sfx('select');
    await this.say(`Go, ${petName(B.active(b, 0))}!`, 650);
    this.mainMenu();
  }

  clearMenu() { this.menu.removeAll(true); this.ready = false; if (window.__pets) window.__pets.ready = false; }

  mainMenu() {
    this.clearMenu();
    this.ready = true; window.__pets.ready = true;
    const me = B.active(this.b, 0);
    this.msgText.setText(`What will ${petName(me)} do?`);
    const wild = this.b.kind === 'wild';
    const opts = [
      ['FIGHT', () => this.fightMenu(), PALETTE.gold],
      ['PETS', () => this.openPets(), PALETTE.cream],
      ['BAG', () => this.openBag(), PALETTE.cream],
      ['RUN', () => this.act({ type: 'run' }), wild ? PALETTE.lavender : PALETTE.indigo],
    ];
    opts.forEach(([label, fn, fill], i) => {
      const x = i % 2 ? 268 : 92; const y = i < 2 ? 472 : 576;
      const btn = button(this, x, y, 168, 92, label, () => { if (!blocking()) fn(); }, { fill, size: 32, color: PALETTE.night });
      if (label === 'RUN' && !wild) btn.setEnabled(false);
      this.menu.add(btn);
    });
  }

  fightMenu() {
    this.clearMenu();
    const me = B.active(this.b, 0);
    const foe = B.active(this.b, 1);
    this.msgText.setText('Pick a move. STRONG moves hit twice as hard.');
    if (me.moves.every((m) => m.pp <= 0)) {
      this.msgText.setText(`${petName(me)} has no PP left!`);
    }
    me.moves.forEach((m, i) => {
      const mv = MOVES[m.id];
      const x = i % 2 ? 268 : 92; const y = i < 2 ? 460 : 544;
      const c = this.add.container(x, y);
      const btn = button(this, 0, 0, 168, 76, '', () => this.act({ type: 'move', slot: i }), { fill: PALETTE.cream });
      c.add(btn);
      c.add(this.add.rectangle(-78, -32, 156, 8, hex(TYPE_INFO[mv.type].color)).setOrigin(0, 0));
      const nm = text(this, 0, -10, mv.name, { color: PALETTE.night });
      fit(nm, 150);
      c.add(nm);
      const eff = mv.power ? typeMult(mv.type, petType(foe)) : 1;
      const tag = eff > 1 ? 'STRONG' : eff < 1 ? 'weak' : (mv.power ? '' : 'status');
      c.add(text(this, -74, 18, `PP ${m.pp}/${mv.pp}`, { origin: [0, 0.5], color: m.pp ? PALETTE.indigo : PALETTE.red }));
      if (tag) c.add(text(this, 74, 18, tag, { origin: [1, 0.5], color: eff > 1 ? PALETTE.red : PALETTE.indigo }));
      if (m.pp <= 0) btn.setEnabled(me.moves.every((q) => q.pp <= 0));
      this.menu.add(c);
    });
    this.menu.add(button(this, WIDTH / 2, 614, 336, 40, 'Back', () => this.mainMenu(), { fill: PALETTE.lavender }));
  }

  openPets() {
    partyPanel(this.state, {
      mode: 'switch', title: 'Switch pet', sub: 'Switching uses your turn.', activeIdx: this.b.sides[0].active,
      onPick: (i) => this.act({ type: 'switch', idx: i }),
    });
  }

  openBag() {
    bagPanel(this.state, { battle: { wild: this.b.kind === 'wild', activeIdx: this.b.sides[0].active, onAction: (a) => this.act(a) } });
  }

  async act(action) {
    const problem = B.actionProblem(this.b, action);
    if (problem) { sfx('error'); this.msgText.setText(problem); return; }
    this.clearMenu();
    const ev = B.takeTurn(this.b, action);
    await this.play(ev);
    await this.next();
  }

  async next() {
    const b = this.b;
    if (b.phase === 'over') { await this.end(); return; }
    if (b.phase === 'switch') {
      this.msgText.setText('Choose your next pet!');
      const idx = await new Promise((res) => partyPanel(this.state, { mode: 'faint', title: 'Next pet', sub: 'Who will you send out?', onPick: res }));
      await this.play(B.sendOut(b, idx));
      await this.next();
      return;
    }
    this.mainMenu();
  }

  async play(events) {
    for (const e of events) await this.playEvent(e);
  }

  async playEvent(e) {
    const b = this.b;
    switch (e.t) {
      case 'use': {
        const img = this.pets[e.side];
        sfx(MOVE_SFX[MOVES[e.move].type] || 'move');
        this.msgText.setText(e.msg);
        if (img) {
          const dx = e.side === 0 ? 18 : -18; const dy = e.side === 0 ? -10 : 10;
          await this.tween({ targets: img, x: POS[e.side].x + dx, y: POS[e.side].y + dy, duration: 90, yoyo: true });
          img.setPosition(POS[e.side].x, POS[e.side].y);
        }
        await this.wait(260);
        return;
      }
      case 'hit': {
        const img = this.pets[e.side];
        sfx(e.dot ? 'smallBoom' : e.eff > 1 ? 'boom' : 'hit');
        if (img) {
          this.mood(e.side, PET_MOOD.hurt[e.side], 500);
          this.tweens.add({ targets: img, alpha: 0.2, duration: 70, yoyo: true, repeat: 2 });
          this.tweens.add({ targets: img, x: POS[e.side].x + 5, duration: 45, yoyo: true, repeat: 3, onComplete: () => img.setX(POS[e.side].x) });
          if (e.dmg > 0) this.floatText(POS[e.side].x, POS[e.side].y - 40, `-${e.dmg}`, e.eff > 1 ? PALETTE.red : PALETTE.night);
        }
        await this.tweenHp(e.side, e.hp);
        if (e.msg) await this.say(e.msg);
        return;
      }
      case 'heal': {
        if (e.onField !== false) { sfx('power'); await this.tweenHp(e.side, B.active(b, e.side).hp); }
        await this.say(e.msg);
        return;
      }
      case 'status': {
        sfx('error');
        this.updateBox(e.side, this.boxes[e.side].shownHp);
        const img = this.pets[e.side];
        if (img) this.tweens.add({ targets: img, angle: 8, duration: 80, yoyo: true, repeat: 2, onComplete: () => img.setAngle(0) });
        if (e.st === 'sleep' && img) setPetFrame(img, img.sp, PET_MOOD.faint[0]);
        await this.say(e.msg);
        return;
      }
      case 'cure': this.updateBox(e.side, this.boxes[e.side].shownHp); await this.say(e.msg); return;
      case 'stat': {
        sfx(e.n > 0 ? 'power' : 'thud');
        const label = `${{ atk: 'ATK', def: 'DEF', spd: 'SPD' }[e.key]} ${e.n > 0 ? '+' : ''}${e.n}`;
        this.floatText(POS[e.side].x, POS[e.side].y - 30, label, e.n > 0 ? '#3f74c9' : PALETTE.red);
        await this.say(e.msg);
        return;
      }
      case 'faint': {
        const img = this.pets[e.side];
        sfx('thud');
        if (img) {
          img.locked = true;
          setPetFrame(img, img.sp, PET_MOOD.faint[0]);
          await this.tween({ targets: img, y: img.y + 40, alpha: 0, duration: 380, ease: 'Cubic.in' });
          img.destroy();
          this.pets[e.side] = null;
        }
        this.updateBox(e.side, 0);
        await this.say(e.msg);
        return;
      }
      case 'send': {
        sfx('select');
        this.updateBox(e.side);
        this.showPet(e.side);
        await this.say(e.msg, 650);
        return;
      }
      case 'recall': {
        const img = this.pets[e.side];
        sfx('flip');
        this.msgText.setText(e.msg);
        if (img) { await this.tween({ targets: img, scale: 0.3, alpha: 0, duration: 220 }); img.destroy(); this.pets[e.side] = null; }
        await this.wait(250);
        return;
      }
      case 'throw': return this.throwAnim(e);
      case 'catch': return this.catchAnim(e);
      case 'xp': {
        const pet = this.state.party.find((p) => p.uid === e.uid);
        if (pet === B.active(b, 0)) this.updateBox(0, this.boxes[0].shownHp);
        if (!e.quiet) await this.say(e.msg, 650);
        return;
      }
      case 'level': {
        const pet = this.state.party.find((p) => p.uid === e.uid);
        sfx('power');
        if (pet === B.active(b, 0)) { this.updateBox(0); this.mood(0, PET_MOOD.happy[0], 700); }
        const g = e.gains;
        await this.say(`${e.msg}${g ? ` (HP +${g.hp}, ATK +${g.atk}, DEF +${g.def}, SPD +${g.spd})` : ''}`);
        return;
      }
      case 'learn': {
        const pet = this.state.party.find((p) => p.uid === e.uid);
        if (e.auto) { sfx('coin'); await this.say(e.msg); return; }
        await this.say(`${petName(pet)} wants to learn ${MOVES[e.move].name}...`, 600);
        const slot = await new Promise((res) => learnPanel(pet, e.move, res));
        if (slot == null) { await this.say(`${petName(pet)} did not learn ${MOVES[e.move].name}.`); return; }
        const old = MOVES[pet.moves[slot].id].name;
        learnMove(pet, e.move, slot);
        sfx('coin');
        await this.say(`${petName(pet)} forgot ${old} and learned ${MOVES[e.move].name}!`);
        return;
      }
      case 'item': sfx('power'); await this.say(e.msg, 650); return;
      case 'end': return;
      default:
        if (e.anim === 'sleep' && this.pets[e.side]) this.floatText(POS[e.side].x + 30, POS[e.side].y - 40, 'z z', PALETTE.indigo);
        if (e.msg) { if (e.bad) sfx('error'); await this.say(e.msg); }
    }
  }

  floatText(x, y, str, color) {
    const t = text(this, x, y, str, { size: 32, color }).setDepth(20);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  async throwAnim(e) {
    sfx('shoot');
    this.msgText.setText(e.msg);
    const cap = this.add.image(POS[0].x, POS[0].y, 'items', e.item).setScale(3).setDepth(10);
    const start = { x: POS[0].x, y: POS[0].y };
    await new Promise((res) => this.tweens.addCounter({
      from: 0, to: 1, duration: 520,
      onUpdate: (tw) => {
        const t = tw.getValue();
        cap.setPosition(start.x + (POS[1].x - start.x) * t, start.y + (POS[1].y + 30 - start.y) * t - Math.sin(t * Math.PI) * 120);
        cap.setAngle(t * 540);
      },
      onComplete: res,
    }));
    cap.setAngle(0);
    this.cap = cap;
    const img = this.pets[1];
    sfx('capture');
    if (img) { img.locked = true; await this.tween({ targets: img, scale: 0.2, alpha: 0, y: POS[1].y + 30, duration: 260 }); }
    await this.tween({ targets: cap, y: POS[1].y + 40, duration: 160, ease: 'Bounce.out' });
  }

  async catchAnim(e) {
    const cap = this.cap;
    for (let i = 0; i < e.shakes; i++) {
      await this.wait(300);
      sfx('tap');
      await this.tween({ targets: cap, angle: i % 2 ? 22 : -22, duration: 120, yoyo: true });
    }
    await this.wait(320);
    const img = this.pets[1];
    if (e.ok) {
      sfx('win');
      cap.setTint(0x9a9a9a);
      for (let k = 0; k < 6; k++) {
        const s = text(this, cap.x, cap.y, '*', { size: 32, color: PALETTE.gold }).setDepth(11);
        const a = (k / 6) * Math.PI * 2;
        this.tweens.add({ targets: s, x: cap.x + Math.cos(a) * 40, y: cap.y + Math.sin(a) * 40, alpha: 0, duration: 600, onComplete: () => s.destroy() });
      }
      await this.say(e.msg);
    } else {
      sfx('error');
      cap.destroy(); this.cap = null;
      if (img) { img.locked = false; img.setAlpha(1); await this.tween({ targets: img, scale: img.base || 5, y: POS[1].y, duration: 220, ease: 'Back.out' }); }
      await this.say(e.msg);
    }
  }

  // ------------------------------------------------------------ the end

  async end() {
    const b = this.b; const setup = this.setup; const st = this.state;
    const result = b.result;
    this.clearMenu();
    if (setup.kind === 'trainer') {
      reportResult(SKILL_ID, result === 'win' ? 1 : 0, B.margin(b), setup.weight ?? 0.35);
      const lines = result === 'win' ? setup.lose : setup.win;
      if (lines?.length) {
        const tamer = this.add.image(WIDTH + 60, POS[1].y, 'chars2', `c${setup.foe.ch ?? 0}_1`).setScale(5).setFlipX(true);
        await this.tween({ targets: tamer, x: POS[1].x, duration: 300 });
        for (const l of lines) await this.say(l);
      }
    }
    const caught = result === 'caught' ? B.active(b, 1) : null;
    const wasNew = caught && !this.dexBefore[caught.sp];
    const out = G.afterBattle(st, setup, result, caught);
    if (result === 'win' || result === 'caught') {
      if (wasNew) { sfx('coin'); await this.say(`${petName(caught)} was added to your PetDex!`); }
      if (out.caughtTo === 'party') await this.say(`${petName(out.caught)} joined your team!`);
      for (const l of out.lines) { if (out.badge && l.includes('Badge')) sfx('strike'); else if (l.includes('coins')) sfx('coin'); await this.say(l); }
      await this.evolutions();
    }
    persist();
    const after = result === 'lose' ? { lines: out.lines, blackout: out.blackout } : { badge: out.badge, champion: setup.champion && result === 'win' };
    if (result === 'lose' && !out.blackout) after.lines = out.lines;
    if (result === 'lose') { sfx('lose'); await this.say(out.blackout ? 'All your pets have fainted...' : 'You lost the battle.'); }
    go(this, 'World', { after });
  }

  async evolutions() {
    const st = this.state;
    for (const pet of st.party) {
      const to = canEvolve(pet);
      if (!to) continue;
      const from = pet.sp;
      for (const img of this.pets) img?.destroy();
      this.pets = [null, null];
      for (const bx of this.boxes) bx.c.setVisible(false);
      const cx = WIDTH / 2; const cy = SCREEN.y + SCREEN.h / 2;
      const img = petImage(this, cx, cy, from, 6);
      await this.say(`What? ${petName(pet)} is evolving!`, 900);
      let d = 260;
      for (let k = 0; k < 9; k++) {
        img.setTexture(`pet_${k % 2 ? to : from}`, 0).setTintFill(0x252525);
        sfx('flip');
        await this.wait(d);
        d = Math.max(70, d * 0.8);
      }
      const name = petName(pet);
      G.evolvePet(st, pet);
      img.clearTint().setTexture(`pet_${to}`, Math.min(1, petFrames(to) - 1));
      this.cameras.main.flash(300, 249, 245, 239);
      sfx('win');
      await this.say(`${name} evolved into ${SPECIES[to].name}!`, 1400);
      img.destroy();
    }
  }
}
