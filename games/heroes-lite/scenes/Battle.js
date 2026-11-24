import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, store, toast, setBackground, openHowTo, modal } from './common.js';
import { creatureInfo } from './heroPanel.js';
import * as C from '../logic/combat.js';
import { CREATURES, SPELLS } from '../logic/data.js';
import { aiParams } from '../logic/ai.js';
import { getSkill, SKILL_ID } from '../adaptive.js';
import { frame, sprite, unitFrame, groundFrame, spellFrame, projectileFrame, BATTLE, BIOMES } from '../frames.js';

const CELL = 48;
const OX = Math.round((WIDTH - C.GRID_W * CELL) / 2);
const OY = 104;
const SIDE_COLORS = [PALETTE.lavender, PALETTE.red];

const cx = (x) => OX + x * CELL + CELL / 2;
const cy = (y) => OY + y * CELL + CELL / 2;

function projectileFor(type) {
  return { archer: 4, monk: 2, lich: 0, centaur: 5, hunter: 4, cyclops: 7 }[type] ?? 4;
}

export class Battle extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.b = data.battle;
    this.biome = data.biome || 'grass';
    this.auto = false;
    this.busy = false;
    this.done = false;
    this.spellMode = null;
  }

  create() {
    setBackground(this, PALETTE.night);
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    const b = this.b;
    this.human = b.sides.findIndex((s) => !s.ai);
    this.aiTactics = aiParams(getSkill(SKILL_ID)).tactics;
    this.drawField();
    this.hl = this.add.graphics().setDepth(5);
    this.sprites = new Map();
    for (const s of b.stacks) this.makeStack(s);
    this.buildUi();
    this.syncAll();
    window.__heroes = { ...(window.__heroes || {}), battle: this };
    this.input.on('pointerup', (p) => this.tap(p));
    this.time.delayedCall(300, () => this.next());
  }

  drawField() {
    const sky = BATTLE.sky[BIOMES[this.biome]?.battleSky || 0];
    const sk = sprite(this, WIDTH / 2, 44, sky, 2).setOrigin(0.5, 0);
    sk.setCrop((304 - WIDTH / 2) / 2, 0, WIDTH / 2, 48);
    const g = this.add.graphics();
    for (let y = 0; y < C.GRID_H; y++) {
      for (let x = 0; x < C.GRID_W; x++) {
        sprite(this, cx(x), cy(y), groundFrame(this.biome), 3);
        if ((x + y) % 2) g.fillStyle(0x000000, 0.08).fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
      }
    }
    g.setDepth(1);
    g.lineStyle(1, 0x000000, 0.18);
    for (let x = 0; x <= C.GRID_W; x++) g.lineBetween(OX + x * CELL, OY, OX + x * CELL, OY + C.GRID_H * CELL);
    for (let y = 0; y <= C.GRID_H; y++) g.lineBetween(OX, OY + y * CELL, OX + C.GRID_W * CELL, OY + y * CELL);
    const frameG = this.add.graphics().setDepth(1);
    frameG.lineStyle(4, hex(PALETTE.ink)).strokeRect(OX - 2, OY - 2, C.GRID_W * CELL + 4, C.GRID_H * CELL + 4);
    for (const o of this.b.obstacles) sprite(this, cx(o.x), cy(o.y) + 8, BATTLE.rocks[o.kind % 3], 1.25).setDepth(10 + o.y * 3);
  }

  makeStack(s) {
    const def = CREATURES[s.type];
    const c = this.add.container(cx(s.x), cy(s.y));
    const img = sprite(this, 0, -6, unitFrame(def.sprite, 'idle', 0), 3);
    if (s.side === 1) img.setFlipX(true);
    const mine = s.side === this.human;
    const badge = this.add.rectangle(s.side === 0 ? 14 : -14, 16, 30, 16, hex(SIDE_COLORS[mine ? 0 : 1])).setStrokeStyle(2, hex(PALETTE.ink));
    const n = text(this, s.side === 0 ? 14 : -14, 16, `${s.count}`, { color: mine ? PALETTE.night : PALETTE.cream });
    c.add([img, badge, n]);
    c.img = img; c.badge = badge; c.n = n;
    c.setDepth(10 + s.y * 3 + 1);
    this.sprites.set(s.id, c);
    let i = s.id % 4;
    c.anim = 'idle';
    c.timer = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      if (!c.active || c.anim !== 'idle') return;
      i = (i + 1) % 4;
      c.img.setTexture(...frame(this, unitFrame(def.sprite, 'idle', i)));
    } });
  }

  playAnim(s, anim, ms = 260) {
    const c = this.sprites.get(s.id);
    if (!c) return Promise.resolve();
    const def = CREATURES[s.type];
    c.anim = anim;
    return new Promise((res) => {
      let i = 0;
      const step = () => {
        if (!c.active) { res(); return; }
        if (i >= 4) { if (anim !== 'death') c.anim = 'idle'; res(); return; }
        c.img.setTexture(...frame(this, unitFrame(def.sprite, anim, i++)));
        this.time.delayedCall(ms / 4, step);
      };
      step();
    });
  }

  buildUi() {
    const b = this.b;
    this.roundText = text(this, WIDTH / 2, 20, 'Round 1', { color: PALETTE.cream }).setDepth(30);
    button(this, WIDTH - 26, 20, 40, 32, '?', () => openHowTo(this), { fill: PALETTE.gold }).setDepth(30);
    this.btnFlee = button(this, 34, 20, 60, 32, 'Flee', () => this.openFlee(), { fill: PALETTE.cream }).setDepth(30);
    // Banners for both sides.
    b.sides.forEach((sd, i) => {
      const x = i === 0 ? 10 : WIDTH - 10;
      const org = i === 0 ? 0 : 1;
      const g = this.add.rectangle(i === 0 ? 0 : WIDTH, 70, 170, 46, hex(PALETTE.ink), 0.65).setOrigin(org, 0.5).setDepth(20);
      void g;
      if (sd.hero) {
        const p = sprite(this, i === 0 ? x + 18 : x - 18, 70, ['heroIcons', sd.hero.portrait[0], sd.hero.portrait[1], 16, 16], 2).setDepth(21);
        if (i === 1) p.setFlipX(true);
      }
      const nx = sd.hero ? (i === 0 ? x + 40 : x - 40) : x;
      text(this, nx, 60, sd.name, { origin: [org, 0.5], color: i === this.human ? PALETTE.gold : PALETTE.cream }).setDepth(21);
      const m = text(this, nx, 80, '', { origin: [org, 0.5], color: PALETTE.lavender }).setDepth(21);
      sd.manaText = m;
    });
    this.infoText = text(this, WIDTH / 2, 508, '', { color: PALETTE.cream }).setDepth(30);
    this.queueC = this.add.container(0, 0).setDepth(30);
    const y = 608;
    this.btnSpell = button(this, 47, y, 84, 44, 'Spell', () => this.openSpells(), { fill: PALETTE.lavender });
    this.btnWait = button(this, 136, y, 84, 44, 'Wait', () => this.humanAct({ type: 'wait' }));
    this.btnDef = button(this, 225, y, 84, 44, 'Defend', () => this.humanAct({ type: 'defend' }));
    this.btnAuto = button(this, 314, y, 84, 44, 'Auto', () => this.toggleAuto(), { fill: PALETTE.gold });
    for (const bt of [this.btnSpell, this.btnWait, this.btnDef, this.btnAuto]) bt.setDepth(30);
  }

  toggleAuto() {
    this.auto = !this.auto;
    this.btnAuto.setLabel(this.auto ? 'Stop' : 'Auto');
    this.btnAuto.body.setFillStyle(hex(this.auto ? PALETTE.orange : PALETTE.gold));
    this.cancelSpell();
    // Auto battles play at double speed.
    this.tweens.timeScale = this.auto ? 2 : 1;
    this.time.timeScale = this.auto ? 2 : 1;
    if (this.auto && !this.busy) this.next();
  }

  // ---------- Display sync ----------

  syncAll() {
    const b = this.b;
    for (const s of b.stacks) {
      const c = this.sprites.get(s.id);
      if (!c) continue;
      if (!s.alive) { if (c.alpha > 0.2 && !c.dying) c.setVisible(false); continue; }
      c.setPosition(cx(s.x), cy(s.y));
      c.setDepth(10 + s.y * 3 + 1);
      c.n.setText(`${s.count}`);
      c.badge.width = Math.max(26, c.n.width + 8);
    }
    b.sides.forEach((sd) => { if (sd.hero) sd.manaText.setText(`Mana ${sd.hero.mana}${sd.cast ? ' (cast)' : ''}`); else sd.manaText.setText(''); });
    this.roundText.setText(`Round ${b.round}`);
    this.drawQueue();
    this.highlight();
    this.syncButtons();
  }

  drawQueue() {
    const b = this.b;
    this.queueC.removeAll(true);
    const ids = [b.activeId, ...b.queue, ...b.waitQueue].filter((id) => { const s = C.getStack(b, id); return s && s.alive; }).slice(0, 8);
    this.queueC.add(text(this, 8, 550, 'Next', { origin: [0, 0.5], color: PALETTE.lavender }));
    ids.forEach((id, i) => {
      const s = C.getStack(b, id);
      const x = 64 + i * 38; const y = 550;
      const g = this.add.graphics();
      g.fillStyle(hex(i === 0 ? PALETTE.gold : SIDE_COLORS[s.side === this.human ? 0 : 1])).fillRect(x - 17, y - 17, 34, 34);
      g.fillStyle(hex(PALETTE.night)).fillRect(x - 15, y - 15, 30, 30);
      const img = sprite(this, x, y - 1, unitFrame(CREATURES[s.type].sprite, 'idle', 0), 2);
      if (s.side === 1) img.setFlipX(true);
      this.queueC.add([g, img]);
    });
  }

  myTurn() {
    const s = C.active(this.b);
    return s && s.side === this.human && !this.auto && !this.b.over;
  }

  syncButtons() {
    const mine = this.myTurn() && !this.busy;
    this.btnSpell.setEnabled(mine && C.castable(this.b, this.human).length > 0);
    this.btnWait.setEnabled(mine);
    this.btnDef.setEnabled(mine);
    this.btnFlee.setEnabled(mine && C.fleeOptions(this.b, this.human).retreat);
  }

  openFlee() {
    if (!this.myTurn() || this.busy) return;
    const opt = C.fleeOptions(this.b, this.human);
    if (!opt.retreat) return;
    const foeHero = !!this.b.sides[1 - this.human].hero;
    const lines = ['Retreat: your hero escapes, but the whole army is lost. Hire the hero again at any Tavern.'];
    const btns = [['Retreat', () => this.humanAct({ type: 'retreat' }), PALETTE.orange]];
    if (opt.surrender !== null) {
      lines.push(`Surrender: pay ${opt.surrender} gold and leave with your army. The hero waits at the Tavern.`);
      btns.push([`Surrender (${opt.surrender}g)`, () => this.humanAct({ type: 'surrender' }), PALETTE.gold]);
    } else {
      lines.push({ text: foeHero ? 'Not enough gold to surrender.' : 'Monsters don\'t accept surrender.', color: PALETTE.lavender });
    }
    btns.push(['Keep fighting', null, PALETTE.lavender]);
    modal(this, 'Flee?', lines, btns);
  }

  highlight() {
    const g = this.hl; g.clear();
    const b = this.b;
    const s = C.active(b);
    if (!s || b.over) { this.infoText.setText(''); return; }
    // Active stack marker.
    g.lineStyle(3, hex(PALETTE.gold)).strokeRect(OX + s.x * CELL + 2, OY + s.y * CELL + 2, CELL - 4, CELL - 4);
    const def = CREATURES[s.type];
    if (this.spellMode) {
      const sp = this.spellMode;
      for (const t of C.spellTargets(b, this.human, sp)) {
        g.fillStyle(hex(SPELLS[sp].target === 'ally' ? PALETTE.leaf : PALETTE.plum), 0.35).fillRect(OX + t.x * CELL + 2, OY + t.y * CELL + 2, CELL - 4, CELL - 4);
      }
      this.infoText.setText(`${SPELLS[sp].name}: tap a ${SPELLS[sp].target === 'area' ? 'square' : 'target'}`);
      return;
    }
    if (s.side !== this.human || this.auto) {
      this.infoText.setText(`${s.side === this.human ? 'Auto: ' : ''}${def.name} (${s.count})`);
      return;
    }
    for (const k of C.reachable(b, s).keys()) {
      const [x, y] = k.split(',').map(Number);
      g.fillStyle(hex(PALETTE.cream), 0.22).fillRect(OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2);
    }
    const shoot = C.canShoot(b, s);
    const melee = new Set(C.meleeOptions(b, s).map((o) => o.target));
    for (const e of C.alive(b, 1 - s.side)) {
      if (shoot || melee.has(e.id)) {
        g.lineStyle(3, hex(shoot ? PALETTE.orange : PALETTE.red)).strokeRect(OX + e.x * CELL + 3, OY + e.y * CELL + 3, CELL - 6, CELL - 6);
      }
    }
    this.infoText.setText(`${def.name} (${s.count}): ${shoot ? `shoot (${s.shots} left)` : 'move or attack'}`);
  }

  // ---------- Turn loop ----------

  next() {
    if (this.busy) return;
    const b = this.b;
    this.syncAll();
    if (b.over) { this.finish(); return; }
    const s = C.active(b);
    if (!s) return;
    const sd = b.sides[s.side];
    if (sd.ai || this.auto) {
      this.busy = true;
      this.syncButtons();
      this.time.delayedCall(this.auto ? 200 : 380, () => {
        // On auto, your side fights to the end (fleeing is always your own call).
        const params = sd.ai ? (sd.owner === null ? C.TACTIC_PRESETS.normal : this.aiTactics) : { ...C.TACTIC_PRESETS.hard, flee: 0 };
        let a = C.chooseAction(b, params);
        let ev = C.act(b, a);
        if (!ev.length) { a = { type: 'defend' }; ev = C.act(b, a); }
        this.play(ev).then(() => { this.busy = false; this.next(); });
      });
    }
  }

  humanAct(action) {
    if (!this.myTurn() || this.busy) return;
    const ev = C.act(this.b, action);
    if (!ev.length) { sfx('error'); return; }
    this.cancelSpell();
    this.busy = true;
    this.syncButtons();
    this.play(ev).then(() => { this.busy = false; this.next(); });
  }

  tap(p) {
    if (this.busy || document.getElementById('howto')) return;
    if (this.children.list.some((c) => c.depth >= 100 && c.active)) return;
    const x = Math.floor((p.x - OX) / CELL); const y = Math.floor((p.y - OY) / CELL);
    if (!C.inGrid(x, y)) return;
    const b = this.b;
    const s = C.active(b);
    const target = C.stackAt(b, x, y);
    if (this.spellMode) {
      const sp = this.spellMode;
      const t = C.spellTargets(b, this.human, sp).find((tt) => tt.x === x && tt.y === y);
      if (!t) { this.cancelSpell(); return; }
      this.humanAct({ type: 'cast', spell: sp, target: t.id ? { id: t.id, x, y } : { x, y } });
      return;
    }
    if (!this.myTurn()) { if (target) creatureInfo(this, target.type, target.count); return; }
    if (target && target.side !== s.side) {
      if (C.canShoot(b, s)) { this.humanAct({ type: 'shoot', target: target.id }); return; }
      const opts = C.meleeOptions(b, s).filter((o) => o.target === target.id);
      if (!opts.length) { toast(this, 'Out of reach', 466); sfx('error'); return; }
      // Attack from the side of the enemy you tapped, if possible.
      const fx = (p.x - OX) / CELL - x - 0.5; const fy = (p.y - OY) / CELL - y - 0.5;
      const want = { x: x + (fx < -0.17 ? -1 : fx > 0.17 ? 1 : 0), y: y + (fy < -0.17 ? -1 : fy > 0.17 ? 1 : 0) };
      let pick = opts.find((o) => o.x === s.x && o.y === s.y);
      const exact = opts.find((o) => o.x === want.x && o.y === want.y);
      if (exact) pick = exact;
      if (!pick) pick = opts.sort((a, c) => C.dist(a, s) - C.dist(c, s) || (Math.abs(a.x - want.x) + Math.abs(a.y - want.y)) - (Math.abs(c.x - want.x) + Math.abs(c.y - want.y)))[0];
      this.humanAct({ type: 'attack', target: target.id, x: pick.x, y: pick.y });
      return;
    }
    if (target) { creatureInfo(this, target.type, target.count); return; }
    if (C.reachable(b, s).has(`${x},${y}`)) this.humanAct({ type: 'move', x, y });
  }

  // ---------- Spells ----------

  openSpells() {
    if (!this.myTurn() || this.busy) return;
    const list = C.castable(this.b, this.human);
    if (!list.length) return;
    const h = this.b.sides[this.human].hero;
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive());
    const rows = Math.ceil(list.length / 1);
    const hgt = 90 + rows * 52 + 56;
    const top = Math.round((HEIGHT - hgt) / 2);
    c.add(panel(this, 20, top, WIDTH - 40, hgt));
    c.add(text(this, WIDTH / 2, top + 28, `Spells (mana ${h.mana})`, { color: PALETTE.gold }));
    list.forEach((sp, i) => {
      const y = top + 74 + i * 52;
      const bt = button(this, WIDTH / 2, y, WIDTH - 80, 44, `${SPELLS[sp].name} (${C.spellCost(h, sp)})`, () => { c.destroy(); this.startSpell(sp); }, { fill: PALETTE.lavender, icon: sprite(this, 0, 0, spellFrame(SPELLS[sp].icon), 2) });
      c.add(bt);
    });
    c.add(button(this, WIDTH / 2, top + hgt - 34, 160, 40, 'Cancel', () => c.destroy(), { fill: PALETTE.cream }));
  }

  startSpell(sp) {
    this.spellMode = sp;
    this.highlight();
  }

  cancelSpell() { if (this.spellMode) { this.spellMode = null; this.highlight(); } }

  // ---------- Animation of events ----------

  async play(events) {
    for (const ev of events) {
      // eslint-disable-next-line no-await-in-loop
      await this.playOne(ev);
    }
    this.syncAll();
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  float(x, y, msg, color = PALETTE.cream) {
    const t = text(this, x, y, msg, { color }).setDepth(60);
    const bg = this.add.rectangle(x, y, t.width + 8, 20, hex(PALETTE.ink), 0.7).setDepth(59);
    this.tweens.add({ targets: [t, bg], y: y - 26, alpha: 0, delay: 500, duration: 500, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  async playOne(ev) {
    const b = this.b;
    const c = ev.id ? this.sprites.get(ev.id) : null;
    const st = ev.id ? C.getStack(b, ev.id) : null;
    switch (ev.type) {
      case 'move': {
        sfx('move');
        c.anim = 'walk';
        const def = CREATURES[st.type];
        let k = 0;
        for (const p of ev.path) {
          c.img.setTexture(...frame(this, unitFrame(def.sprite, 'walk', k++ % 4)));
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => this.tweens.add({ targets: c, x: cx(p.x), y: cy(p.y), duration: def.fly ? 200 : 110, onComplete: r }));
          c.setDepth(10 + p.y * 3 + 1);
        }
        c.anim = 'idle';
        break;
      }
      case 'attack': case 'retaliate': {
        const t = this.sprites.get(ev.target);
        const dx = (t.x - c.x) * 0.35; const dy = (t.y - c.y) * 0.35;
        this.playAnim(st, 'attack', 240);
        await new Promise((r) => this.tweens.add({ targets: c, x: c.x + dx, y: c.y + dy, duration: 110, yoyo: true, onComplete: r }));
        await this.hit(ev);
        break;
      }
      case 'shoot': {
        const t = this.sprites.get(ev.target);
        this.playAnim(st, 'attack', 240);
        sfx('shoot');
        const pr = sprite(this, c.x, c.y - 8, projectileFrame(projectileFor(st.type)), 3).setDepth(50);
        pr.setRotation(Math.atan2(t.y - c.y, t.x - c.x));
        if (st.side === 1 && [4, 5].includes(projectileFor(st.type))) pr.setFlipY(true);
        await new Promise((r) => this.tweens.add({ targets: pr, x: t.x, y: t.y - 8, duration: 260, onComplete: r }));
        pr.destroy();
        await this.hit(ev);
        break;
      }
      case 'splash': await this.hit(ev, true); break;
      case 'drain': this.float(c.x, c.y - 30, `+${ev.amount} hp`, PALETTE.leaf); break;
      case 'regen': this.float(c.x, c.y - 30, 'Regenerates', PALETTE.leaf); await this.wait(200); break;
      case 'wait': this.float(c.x, c.y - 30, 'Waits', PALETTE.lavender); await this.wait(250); break;
      case 'defend': this.float(c.x, c.y - 30, 'Defends', PALETTE.lavender); sfx('place'); await this.wait(250); break;
      case 'cast': {
        const sp = SPELLS[ev.spell];
        sfx('power');
        const icon = sprite(this, cx(ev.x), cy(ev.y) - 4, spellFrame(sp.icon), 2).setDepth(60).setAlpha(0);
        const ring = this.add.circle(cx(ev.x), cy(ev.y), 10, hex(PALETTE.gold), 0.5).setDepth(59);
        this.tweens.add({ targets: ring, radius: sp.target === 'area' ? 72 : 30, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
        await new Promise((r) => this.tweens.add({ targets: icon, alpha: 1, scale: 3, duration: 250, yoyo: true, onComplete: () => { icon.destroy(); r(); } }));
        const side = b.sides[ev.side];
        this.float(WIDTH / 2, OY + 14, `${side.name} casts ${sp.name}`, PALETTE.gold);
        for (const h of ev.hits) {
          const tc = this.sprites.get(h.target);
          if (h.dmg !== undefined) await this.hit({ ...h, target: h.target }, true);
          else if (h.healed !== undefined) this.float(tc.x, tc.y - 30, `+${h.healed} hp`, PALETTE.leaf);
          else this.float(tc.x, tc.y - 30, sp.name, PALETTE.leaf);
        }
        break;
      }
      case 'flee': {
        const side = b.sides[ev.side];
        sfx('lose');
        this.float(WIDTH / 2, OY + 14, `${side.name} ${ev.how === 'retreat' ? 'retreats' : 'surrenders'}!`, PALETTE.orange);
        for (const st2 of b.stacks) {
          const c2 = this.sprites.get(st2.id);
          if (st2.side === ev.side && st2.alive && c2) this.tweens.add({ targets: c2, alpha: 0, x: ev.side === 0 ? -40 : WIDTH + 40, duration: 500 });
        }
        await this.wait(600);
        break;
      }
      case 'round': {
        const t = text(this, WIDTH / 2, OY + C.GRID_H * CELL / 2, `Round ${ev.round}`, { size: 32, color: PALETTE.gold }).setDepth(70);
        this.tweens.add({ targets: t, alpha: 0, delay: 400, duration: 300, onComplete: () => t.destroy() });
        await this.wait(250);
        break;
      }
      default: break;
    }
  }

  async hit(ev, quiet = false) {
    const ts = C.getStack(this.b, ev.target);
    const tc = this.sprites.get(ev.target);
    if (!tc) return;
    if (!quiet) sfx(ev.dead ? 'capture' : 'hit');
    else sfx('smallBoom');
    this.float(tc.x, tc.y - 30, `-${ev.dmg}${ev.killed ? ` (${ev.killed} die)` : ''}`, ev.dead ? PALETTE.orange : PALETTE.cream);
    tc.n.setText(`${Math.max(0, ts.count)}`);
    if (ev.dead) {
      tc.dying = true;
      await this.playAnim(ts, 'death', 360);
      this.tweens.add({ targets: tc, alpha: 0, duration: 300, onComplete: () => tc.setVisible(false) });
    } else {
      tc.img.setTintFill(0xffffff);
      this.time.delayedCall(80, () => tc.img.clearTint());
      await this.playAnim(ts, 'hit', 200);
    }
  }

  // ---------- End ----------

  finish() {
    if (this.done) return;
    this.done = true;
    const res = C.result(this.b);
    const won = res.winner === this.human;
    sfx(won ? 'win' : 'lose');
    const label = won ? (res.fled ? 'They fled!' : 'Victory!') : (res.fled ? (res.fled.how === 'retreat' ? 'Retreat' : 'Surrender') : 'Defeat');
    const t = text(this, WIDTH / 2, OY + 190, label, { size: 32, color: won ? PALETTE.gold : PALETTE.orange }).setDepth(80);
    const bg = this.add.rectangle(WIDTH / 2, OY + 190, WIDTH, 60, hex(PALETTE.ink), 0.7).setDepth(79);
    void t; void bg;
    this.time.delayedCall(1100, () => {
      this.scene.stop();
      this.scene.wake('Adventure');
      store.battleDone?.(res);
    });
  }
}
