import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { save } from '../save.js';
import { skillLabel } from '../adaptive.js';
import { ITEM } from '../art.js';
import { VIEW } from './Play.js';
import { DUNGEONS } from '../logic/constants.js';
import { ROOMS } from '../logic/data.js';

const BAR_H = 44;
const PAD_TOP = VIEW.y + VIEW.h;            // 464: the touch controls live below the room
const STICK = { x: 84, y: 556, r: 44, knob: 20 };
const SWORD = { x: 298, y: 548, r: 44 };
const ITEMB = { x: 206, y: 594, r: 32 };
const SWAP = { x: 206, y: 514, w: 72, h: 30 };
const itemFrame = (name) => ITEM[name][1] * 8 + ITEM[name][0];

export class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  init({ play }) {
    this.play = play;
    this.stick = { id: null, ox: STICK.x, oy: STICK.y, dx: 0, dy: 0 };
    this.press = { attack: false, item: false, cycle: false };
    this.down = { sword: new Set(), item: new Set() };
    this.modal = null;
    this.dialog = null;
    this.ready = false;
  }

  get g() { return this.play.g; }

  create() {
    // ------------------------------------------------ top bar
    this.add.rectangle(0, 0, WIDTH, BAR_H, hex(PALETTE.night)).setOrigin(0);
    this.add.rectangle(0, BAR_H, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0);
    button(this, 26, 22, 40, 36, '<', () => this.pauseMenu(), { size: 32, fill: PALETTE.cream });
    button(this, WIDTH - 22, 22, 36, 36, '?', () => this.help(), { size: 32, fill: PALETTE.gold });
    this.hearts = [];
    for (let i = 0; i < 10; i++) this.hearts.push(this.add.image(60 + i * 16, 22, 'heart').setScale(2));
    this.gemIcon = this.add.image(224, 22, 'items', itemFrame('gem')).setScale(1.25);
    this.gemText = text(this, 236, 22, '0', { color: PALETTE.cream, origin: [0, 0.5] });
    this.keyIcon = this.add.image(276, 22, 'items', itemFrame('key'));
    this.keyText = text(this, 286, 22, '0', { color: PALETTE.cream, origin: [0, 0.5] });
    this.bossKey = this.add.image(308, 22, 'items', itemFrame('bigkey'));
    // frame around the room
    const fr = this.add.graphics();
    fr.lineStyle(2, hex(PALETTE.ink)).strokeRect(VIEW.x - 1, VIEW.y - 1, VIEW.w + 2, VIEW.h + 2);

    // ------------------------------------------------ control pad
    this.add.rectangle(0, PAD_TOP + 2, WIDTH, HEIGHT - PAD_TOP, hex(PALETTE.night)).setOrigin(0).setDepth(-1);
    this.pad = this.add.graphics();
    this.swordLabel = text(this, SWORD.x, SWORD.y, 'SWORD', { color: PALETTE.night });
    this.itemIcon = this.add.image(ITEMB.x, ITEMB.y - 2, 'items', 0).setScale(2);
    this.itemLabel = text(this, ITEMB.x, ITEMB.y, 'ITEM', { color: PALETTE.night });
    this.itemCount = text(this, ITEMB.x + 22, ITEMB.y + 22, '', { color: PALETTE.cream });
    this.swapLabel = text(this, SWAP.x, SWAP.y, 'SWAP', { color: PALETTE.night });
    this.stickHint = text(this, STICK.x, PAD_TOP + 20, 'MOVE', { color: PALETTE.lavender });

    // ------------------------------------------------ overlays
    this.flash = this.add.rectangle(VIEW.x, VIEW.y, VIEW.w, VIEW.h, 0xd8343a, 0).setOrigin(0).setDepth(30);
    this.bannerText = text(this, WIDTH / 2, VIEW.y + 26, '', { size: 32, color: PALETTE.cream }).setDepth(31).setAlpha(0);
    this.bannerBg = this.add.rectangle(WIDTH / 2, VIEW.y + 26, WIDTH - 8, 44, hex(PALETTE.ink), 0.6).setDepth(30).setAlpha(0);

    this.setupInput();
    this.refresh();
    this.ready = true;
    this.play.banner(true);
    if (!save.get('seenHelp')) {
      save.set('seenHelp', true);
      this.time.delayedCall(500, () => this.help());
    }
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.input.addPointer(3);
    const inCircle = (p, c, extra = 10) => Math.hypot(p.x - c.x, p.y - c.y) < c.r + extra;
    const inSwap = (p) => Math.abs(p.x - SWAP.x) < SWAP.w / 2 + 6 && Math.abs(p.y - SWAP.y) < SWAP.h / 2 + 6;
    this.input.on('pointerdown', (p) => {
      if (this.dialog) { this.advanceDialog(); return; }
      if (this.modal || p.y < BAR_H + 2) return;
      if (inCircle(p, SWORD)) { this.down.sword.add(p.id); this.press.attack = true; return; }
      if (inCircle(p, ITEMB)) { this.down.item.add(p.id); this.press.item = true; return; }
      if (this.swapVisible && inSwap(p)) { this.press.cycle = true; return; }
      if (p.x < 176 && this.stick.id === null) this.stick = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.stick.id) return;
      let dx = p.x - this.stick.ox; let dy = p.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK.r) {
        this.stick.ox += (dx / d) * (d - STICK.r); this.stick.oy += (dy / d) * (d - STICK.r);
        dx = p.x - this.stick.ox; dy = p.y - this.stick.oy;
      }
      this.stick.dx = dx; this.stick.dy = dy;
    });
    const up = (p) => {
      if (p.id === this.stick.id) this.stick = { id: null, ox: STICK.x, oy: STICK.y, dx: 0, dy: 0 };
      this.down.sword.delete(p.id); this.down.item.delete(p.id);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => { this.stick.id = null; this.down.sword.clear(); this.down.item.clear(); });

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
      kb.on('keydown', (e) => {
        if (e.repeat) return;
        const k = e.key.toLowerCase();
        if (this.dialog && [' ', 'enter', 'j', 'k', 'x'].includes(k)) { this.advanceDialog(); return; }
        if (this.modal) { if (k === 'escape') this.modal.close?.(); return; }
        if (k === ' ' || k === 'j') this.press.attack = true;
        if (k === 'k' || k === 'x') this.press.item = true;
        if (k === 'q' || k === 'tab') { this.press.cycle = true; e.preventDefault?.(); }
        if (k === 'escape') this.pauseMenu();
      });
    }
  }

  /** Called by Play each frame. */
  readInput() {
    const out = { mx: 0, my: 0, attack: false, item: false, cycle: false };
    if (this.modal || this.dialog) { this.press = { attack: false, item: false, cycle: false }; return out; }
    if (this.stick.id !== null) {
      out.mx = this.stick.dx / STICK.r; out.my = this.stick.dy / STICK.r;
      if (Math.hypot(out.mx, out.my) < 0.2) { out.mx = 0; out.my = 0; }
    }
    const k = this.keys;
    if (k) {
      const kx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      const ky = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      if (kx || ky) { const d = Math.hypot(kx, ky); out.mx = kx / d; out.my = ky / d; }
    }
    Object.assign(out, this.press);
    this.press = { attack: false, item: false, cycle: false };
    return out;
  }

  // ------------------------------------------------------------------ drawing

  update() { this.refresh(); }

  refresh() {
    const g = this.g; if (!g) return;
    const s = g.s;
    const n = s.maxHp / 2;
    this.hearts.forEach((h, i) => {
      h.setVisible(i < n);
      const v = s.hp - i * 2;
      h.setTexture(v >= 2 ? 'heart' : v === 1 ? 'heartHalf' : 'heartEmpty');
    });
    // low health: the last heart throbs
    const low = s.hp <= 2 && s.hp > 0;
    const li = Math.max(0, Math.ceil(s.hp / 2) - 1);
    this.hearts.forEach((h, i) => h.setScale(low && i === li ? 2 + 0.3 * Math.abs(Math.sin(this.time.now / 160)) : 2));
    this.gemText.setText(String(s.gems));
    const area = g.room.area;
    const dungeon = DUNGEONS.includes(area);
    this.keyIcon.setVisible(dungeon); this.keyText.setVisible(dungeon).setText(String(s.keys[area] || 0));
    this.bossKey.setVisible(dungeon && !!s.bigKeys[area]);

    // controls
    const gpad = this.pad; gpad.clear();
    const st = this.stick; const on = st.id !== null;
    gpad.fillStyle(hex(PALETTE.ink), on ? 0.35 : 0.25).fillCircle(st.ox, st.oy, STICK.r);
    gpad.lineStyle(3, 0xffffff, on ? 0.5 : 0.25).strokeCircle(st.ox, st.oy, STICK.r);
    const d = Math.hypot(st.dx, st.dy); const kk = d > STICK.r ? STICK.r / d : 1;
    gpad.fillStyle(0xffffff, on ? 0.75 : 0.35).fillCircle(st.ox + st.dx * kk, st.oy + st.dy * kk, STICK.knob);
    this.stickHint.setVisible(!on && s.time < 90);

    const label = g.mode === 'play' ? g.actionLabel() : '';
    const btn = (c, down, fill, enabled = true) => {
      gpad.fillStyle(hex(PALETTE.ink), 0.6).fillCircle(c.x, c.y + 4, c.r);
      gpad.fillStyle(hex(fill), enabled ? (down ? 1 : 0.9) : 0.35).fillCircle(c.x, c.y + (down ? 3 : 0), c.r - 2);
      gpad.lineStyle(3, hex(PALETTE.night), 1).strokeCircle(c.x, c.y + (down ? 3 : 0), c.r - 2);
    };
    const swordDown = this.down.sword.size > 0;
    btn(SWORD, swordDown, label === 'SWORD' || !label ? PALETTE.gold : PALETTE.cream, !!label);
    this.swordLabel.setText(label || 'SWORD').setY(SWORD.y + (swordDown ? 3 : 0)).setAlpha(label ? 1 : 0.5);

    const own = g.ownedItems();
    const sel = s.selected && own.includes(s.selected) ? s.selected : null;
    const itemDown = this.down.item.size > 0;
    btn(ITEMB, itemDown, PALETTE.lavender, !!sel);
    this.itemIcon.setVisible(!!sel).setY(ITEMB.y - 1 + (itemDown ? 3 : 0));
    if (sel) this.itemIcon.setFrame(itemFrame(sel));
    this.itemLabel.setVisible(!sel).setAlpha(0.5);
    this.itemCount.setText(sel === 'bombs' ? String(s.bombs) : sel === 'potion' ? String(s.potions) : '');
    this.swapVisible = own.length >= 2;
    this.swapLabel.setVisible(this.swapVisible);
    if (this.swapVisible) {
      gpad.fillStyle(hex(PALETTE.ink), 0.6).fillRoundedRect(SWAP.x - SWAP.w / 2, SWAP.y - SWAP.h / 2 + 3, SWAP.w, SWAP.h, 8);
      gpad.fillStyle(hex(PALETTE.lavender), 0.9).fillRoundedRect(SWAP.x - SWAP.w / 2, SWAP.y - SWAP.h / 2, SWAP.w, SWAP.h, 8);
    }
  }

  flashHurt() {
    this.flash.setAlpha(0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
  }

  banner(name) {
    this.bannerText.setText(name);
    this.tweens.killTweensOf([this.bannerText, this.bannerBg]);
    this.bannerText.setAlpha(1); this.bannerBg.setAlpha(1);
    this.tweens.add({ targets: [this.bannerText, this.bannerBg], alpha: 0, delay: 1400, duration: 400 });
  }

  toast(msg) {
    this.lastToast?.destroy(); this.lastToastBg?.destroy();
    const y = PAD_TOP - 26;
    const t = text(this, WIDTH / 2, y, msg, { color: PALETTE.gold, wrap: 330 }).setDepth(41);
    const bg = this.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 8, t.width + 20), t.height + 10, hex(PALETTE.ink), 0.75).setDepth(40);
    this.lastToast = t; this.lastToastBg = bg;
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1600, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  // ------------------------------------------------------------------ dialog box

  showDialog(lines, item, onDone) {
    this.closeDialogBox();
    const c = this.add.container(0, 0).setDepth(50);
    const top = PAD_TOP + 4;
    c.add(panel(this, 6, top, WIDTH - 12, HEIGHT - top - 6, { fill: PALETTE.night, inner: PALETTE.cream }));
    const body = text(this, 22, top + 18, '', { color: PALETTE.cream, origin: [0, 0], align: 'left', wrap: WIDTH - 44 });
    const more = text(this, WIDTH - 26, HEIGHT - 24, 'v', { color: PALETTE.gold });
    c.add([body, more]);
    this.tweens.add({ targets: more, y: more.y + 3, yoyo: true, repeat: -1, duration: 300 });
    this.dialog = { c, body, more, lines, i: 0, shown: 0, onDone, t0: this.time.now };
    this.typeLine();
  }

  typeLine() {
    const d = this.dialog;
    d.full = d.lines[d.i];
    d.shown = 0;
    d.body.setText('');
    d.timer?.remove();
    d.timer = this.time.addEvent({
      delay: 18, loop: true,
      callback: () => {
        d.shown = Math.min(d.full.length, d.shown + 2);
        d.body.setText(d.full.slice(0, d.shown));
        if (d.shown >= d.full.length) d.timer.remove();
      },
    });
    d.more.setText(d.i < d.lines.length - 1 ? 'v' : 'OK');
  }

  advanceDialog() {
    const d = this.dialog;
    if (!d || this.time.now - d.t0 < 180) return;
    if (d.shown < d.full.length) { d.shown = d.full.length; d.body.setText(d.full); d.timer?.remove(); return; }
    sfx('tap');
    d.i++;
    if (d.i < d.lines.length) { this.typeLine(); return; }
    const done = d.onDone;
    this.closeDialogBox();
    done?.();
  }

  closeDialogBox() {
    if (!this.dialog) return;
    this.dialog.timer?.remove();
    this.dialog.c.destroy();
    this.dialog = null;
  }

  // ------------------------------------------------------------------ modals

  openModal(build, onClose) {
    this.modal?.destroy();
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    this.modal = c;
    c.close = () => { c.destroy(); if (this.modal === c) this.modal = null; onClose?.(); };
    build(c);
    return c;
  }

  pauseMenu() {
    if (this.modal || this.dialog || this.play.busy) return;
    this.scene.pause('Play');
    const m = this.openModal((c) => {
      const top = 52; const h = 556;
      c.add(panel(this, 30, top, 300, h));
      c.add(text(this, WIDTH / 2, top + 30, 'Paused', { size: 32, color: PALETTE.gold }));
      const s = this.g.s;
      const done = DUNGEONS.filter((d) => s.flags[`boss:${d}`]).length;
      c.add(text(this, WIDTH / 2, top + 64, `Dungeons ${done}/3   Hearts ${s.maxHp / 2}`, { color: PALETTE.cream }));
      c.add(text(this, WIDTH / 2, top + 86, `Enemy pace ${skillLabel()}/10`, { color: PALETTE.lavender }));
      this.drawMap(c, WIDTH / 2, top + 178);
      const rows = [
        ['Resume', () => m.close(), PALETTE.gold],
        ['How to Play', () => { m.close(); this.help(); }],
        [isMuted() ? 'Sound: Off' : 'Sound: On', (b) => { setMuted(!isMuted()); b.setLabel(isMuted() ? 'Sound: Off' : 'Sound: On'); }],
        ['Save & Title', () => { this.play.saveNow(); m.close(); this.scene.stop('Play'); this.scene.start('Title'); }],
        ['All Games', () => { this.play.saveNow(); window.location.href = '../'; }],
      ];
      rows.forEach(([label, fn, fill], i) => {
        const b = button(this, WIDTH / 2, top + 270 + i * 54, 220, 44, label, () => fn(b), { fill: fill || PALETTE.lavender });
        c.add(b);
      });
    }, () => this.scene.resume('Play'));
  }

  /** 3x3 map of the area you're in: rooms you've seen, where you are, the boss. */
  drawMap(c, cx, cy) {
    const g = this.g;
    const area = g.room.area === 'in' ? 'ow' : g.room.area;
    const cw = 40; const ch = 30; const gap = 4;
    const gr = this.add.graphics();
    c.add(gr);
    const name = { ow: 'Fernwick Vale', d1: 'Mossy Hollow', d2: 'Ember Lab', d3: 'Hollow Keep' }[area];
    c.add(text(this, cx, cy - 64, name, { color: PALETTE.sand }));
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const id = `${area}:${x},${y}`;
        const r = ROOMS[id];
        if (!r) continue;
        const px = cx + (x - 1) * (cw + gap) - cw / 2; const py = cy + (y - 1) * (ch + gap) - ch / 2;
        const seen = g.flags[`seen:${id}`];
        const here = g.room.id === id;
        gr.fillStyle(hex(PALETTE.ink)).fillRect(px - 1, py - 1, cw + 2, ch + 2);
        gr.fillStyle(hex(here ? PALETTE.gold : seen ? PALETTE.lavender : PALETTE.indigo)).fillRect(px, py, cw, ch);
        if (r.boss && seen) c.add(text(this, px + cw / 2, py + ch / 2, g.flags[`boss:${area}`] ? 'ok' : '!', { color: PALETTE.red }));
        if (here) c.add(this.add.image(px + cw / 2, py + ch / 2, 'items', itemFrame('sword')));
      }
    }
  }

  help() {
    if (document.getElementById('howto')) return;
    this.scene.pause('Play');
    const sections = [...RULES.sections];
    sections.splice(sections.length - 2, 0, {
      heading: 'Enemies adapt to you',
      text: `Enemy pace is at ${skillLabel()} of 10 for you right now. Falling eases the enemies off; beating bosses with hearts to spare speeds them up. Only their speed, reactions and heart drops change.`,
    });
    showHowTo({ ...RULES, sections }, () => { if (!this.modal) this.scene.resume('Play'); });
  }

  deathModal(onContinue) {
    this.openModal((c) => {
      const top = 200;
      c.add(panel(this, 30, top, 300, 220, { fill: PALETTE.wine }));
      c.add(text(this, WIDTH / 2, top + 40, 'You fell...', { size: 32, color: PALETTE.cream }));
      c.add(text(this, WIDTH / 2, top + 96, 'You wake at the last entrance\nwith everything you found.', { color: PALETTE.sand }));
      c.add(button(this, WIDTH / 2, top + 170, 200, 48, 'Get up', () => c.close(), { fill: PALETTE.gold }));
    }, onContinue);
  }

  openShop() {
    const g = this.g;
    this.scene.pause('Play');
    const m = this.openModal((c) => {
      const top = 96; const h = 456;
      c.add(panel(this, 16, top, WIDTH - 32, h));
      c.add(text(this, WIDTH / 2, top + 32, "Odo's Shop", { size: 32, color: PALETTE.gold }));
      const gems = text(this, WIDTH / 2, top + 70, '', { color: PALETTE.cream });
      const msg = text(this, WIDTH / 2, top + h - 92, 'Tap a price to buy.', { color: PALETTE.lavender });
      c.add([gems, msg]);
      const rows = [];
      const draw = () => {
        gems.setText(`You have ${g.s.gems} gems   Potions ${g.s.potions}/3`);
        g.shopStock().forEach((it, i) => rows[i]?.sync(it));
      };
      g.shopStock().forEach((it, i) => {
        const y = top + 120 + i * 78;
        const icon = it.id === 'heart' ? this.add.image(56, y, 'heartBig').setScale(2) : this.add.image(56, y, 'items', itemFrame(it.id)).setScale(2.5);
        const name = text(this, 86, y - 12, it.name, { color: PALETTE.cream, origin: [0, 0.5] });
        const desc = text(this, 86, y + 12, it.desc, { color: PALETTE.lavender, origin: [0, 0.5] });
        const b = button(this, WIDTH - 66, y, 80, 44, `${it.price}`, () => {
          const res = g.buy(it.id);
          msg.setText(res.msg).setColor(res.ok ? PALETTE.gold : PALETTE.sand);
          sfx(res.ok ? 'coin' : 'error');
          this.play.saveNow();
          draw();
        }, { fill: PALETTE.gold });
        c.add([icon, name, desc, b]);
        rows.push({ sync: (cur) => { desc.setText(cur.why || cur.desc); b.setEnabled(!cur.why && g.s.gems >= cur.price); } });
      });
      c.add(button(this, WIDTH / 2, top + h - 40, 180, 44, 'Thanks!', () => m.close(), { fill: PALETTE.lavender }));
      draw();
    }, () => { g.closeShop(); this.scene.resume('Play'); });
  }
}
