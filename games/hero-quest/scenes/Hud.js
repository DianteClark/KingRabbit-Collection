import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { save } from '../save.js';
import { skillLabel } from '../adaptive.js';
import { ITEM } from '../art.js';
import { DUNGEONS } from '../logic/constants.js';
import { objective } from '../logic/story.js';
import { musicOn, setMusicOn } from '../music.js';
import { ROOMS } from '../logic/data.js';
// Landscape layout (see layout.js): the room fills the middle, full height. Left margin: pause,
// hearts, gems, keys and the stick. Right margin: help, then SWAP / ITEM / SWORD for the thumb.
import { VIEW, LEFT, RIGHT, MID as MARGIN_R, STICK, SWORD, ITEMB, SWAP, PAUSE_BTN, HELP_BTN, stickZone, hitSword, hitItem, hitSwap } from '../layout.js';

const { WIDTH, HEIGHT } = LANDSCAPE;       // 640 x 360

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
    // ------------------------------------------------ side margins
    this.add.rectangle(0, 0, LEFT, HEIGHT, hex(PALETTE.night)).setOrigin(0).setDepth(-1);
    this.add.rectangle(RIGHT, 0, WIDTH - RIGHT, HEIGHT, hex(PALETTE.night)).setOrigin(0).setDepth(-1);
    button(this, PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.w, PAUSE_BTN.h, '<', () => this.pauseMenu(), { size: 32, fill: PALETTE.cream });
    button(this, HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h, '?', () => this.help(), { size: 32, fill: PALETTE.gold });
    this.hearts = [];
    for (let i = 0; i < 10; i++) this.hearts.push(this.add.image(24 + (i % 5) * 24, 62 + Math.floor(i / 5) * 20, 'heart').setScale(2));
    this.gemIcon = this.add.image(26, 108, 'items', itemFrame('gem')).setScale(1.25);
    this.gemText = text(this, 40, 108, '0', { color: PALETTE.cream, origin: [0, 0.5] });
    this.keyIcon = this.add.image(84, 108, 'items', itemFrame('key'));
    this.keyText = text(this, 94, 108, '0', { color: PALETTE.cream, origin: [0, 0.5] });
    this.bossKey = this.add.image(124, 108, 'items', itemFrame('bigkey'));
    // frame around the room
    const fr = this.add.graphics();
    fr.lineStyle(2, hex(PALETTE.ink)).strokeRect(VIEW.x - 1, VIEW.y - 1, VIEW.w + 2, VIEW.h + 2);

    // ------------------------------------------------ controls
    this.pad = this.add.graphics();
    this.swordLabel = text(this, SWORD.x, SWORD.y, 'SWORD', { color: PALETTE.night });
    this.itemIcon = this.add.image(ITEMB.x, ITEMB.y - 2, 'items', 0).setScale(2);
    this.itemLabel = text(this, ITEMB.x, ITEMB.y, 'ITEM', { color: PALETTE.night });
    this.itemCount = text(this, ITEMB.x + 26, ITEMB.y + 24, '', { color: PALETTE.cream });
    this.swapLabel = text(this, SWAP.x, SWAP.y, 'SWAP', { color: PALETTE.night });
    this.stickHint = text(this, STICK.x, STICK.y - 70, 'MOVE', { color: PALETTE.lavender });

    // ------------------------------------------------ overlays
    this.flash = this.add.rectangle(VIEW.x, VIEW.y, VIEW.w, VIEW.h, 0xd8343a, 0).setOrigin(0).setDepth(30);
    this.bannerText = text(this, MARGIN_R, VIEW.y + 26, '', { size: 32, color: PALETTE.cream }).setDepth(31).setAlpha(0);
    this.bannerBg = this.add.rectangle(MARGIN_R, VIEW.y + 26, VIEW.w, 44, hex(PALETTE.ink), 0.6).setDepth(30).setAlpha(0);

    this.setupInput();
    this.refresh();
    this.ready = true;
    this.play.banner(true);
    this.play.hintGoal();
    // A brand-new adventure: the elder starts talking by himself (after the How to Play sheet
    // the very first time), so nobody has to guess what to do in the first room.
    const intro = () => this.time.delayedCall(450, () => this.play.startIntro());
    if (!save.get('seenHelp')) {
      save.set('seenHelp', true);
      this.time.delayedCall(500, () => this.help(intro));
    } else intro();
  }

  /** One-time pointers at the controls, right after you get the sword. */
  coach() {
    if (save.get('coached')) return;
    save.set('coached', true);
    const items = [];
    const tag = (x, y, msg) => {
      const t = text(this, x, y, msg, { color: PALETTE.night }).setDepth(45);
      const bg = this.add.rectangle(x, y, t.width + 14, t.height + 8, hex(PALETTE.gold)).setDepth(44).setStrokeStyle(2, hex(PALETTE.ink));
      items.push(t, bg);
    };
    tag(STICK.x + 6, STICK.y - 72, 'Drag here\nto walk');
    tag(SWORD.x - 8, SWORD.y - 62, 'Tap to swing');
    this.tweens.add({ targets: items, y: '-=4', yoyo: true, repeat: 7, duration: 380 });
    this.time.delayedCall(6500, () => this.tweens.add({ targets: items, alpha: 0, duration: 400, onComplete: () => items.forEach((o) => o.destroy()) }));
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.input.addPointer(3);
    this.input.on('pointerdown', (p) => {
      if (this.dialog) { this.dialogTapAt = this.time.now; this.advanceDialog(); return; }
      if (this.modal || (p.y < 48 && (p.x < 60 || p.x > WIDTH - 60))) return;
      if (hitSword(p.x, p.y)) { this.down.sword.add(p.id); this.press.attack = true; return; }
      if (hitItem(p.x, p.y)) { this.down.item.add(p.id); this.press.item = true; return; }
      if (this.swapVisible && hitSwap(p.x, p.y)) { this.press.cycle = true; return; }
      if (stickZone(p.x, p.y) && this.stick.id === null) this.stick = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
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
    // browser tests can drive the controls (window.__botInput returns an input object)
    if (window.__botInput && !this.modal && !this.dialog) return { ...out, ...window.__botInput() };
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
    const t = text(this, MARGIN_R, 0, msg, { color: PALETTE.gold, wrap: VIEW.w - 30 }).setDepth(41);
    const y = HEIGHT - 12 - t.height / 2;
    t.setY(Math.round(y));
    const bg = this.add.rectangle(MARGIN_R, y, Math.min(VIEW.w - 4, t.width + 20), t.height + 10, hex(PALETTE.ink), 0.75).setDepth(40);
    this.lastToast = t; this.lastToastBg = bg;
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: Math.min(4500, 1300 + msg.length * 45), duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  // ------------------------------------------------------------------ dialog box

  showDialog(lines, item, onDone) {
    this.closeDialogBox();
    const c = this.add.container(0, 0).setDepth(50);
    // over the lower part of the room, a little wider than it
    const x0 = LEFT - 24; const w = VIEW.w + 48;
    // keep the speaker in sight: if the player is low on screen, the box goes to the top
    const cam = this.play.cameras.main;
    const py = VIEW.y + (this.g.p.y - (cam.midPoint.y - VIEW.h / 4)) * 2;
    const top = py > HEIGHT - 140 ? 4 : HEIGHT - 128; // only when the bottom box would cover you
    c.add(panel(this, x0, top, w, 124, { fill: PALETTE.night, inner: PALETTE.cream }));
    const body = text(this, x0 + 16, top + 14, '', { color: PALETTE.cream, origin: [0, 0], align: 'left', wrap: w - 40 });
    const more = text(this, x0 + w - 22, top + 104, 'v', { color: PALETTE.gold });
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
    if (this.g.s.items.sword && !this.dialog && this.g.mode === 'play') this.coach();
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

  /** A tap that just advanced or closed a dialog must not also press a HUD button on release. */
  justTapped() { return this.dialog || (this.dialogTapAt && this.time.now - this.dialogTapAt < 400); }

  pauseMenu() {
    if (this.justTapped()) return;
    if (this.modal || this.dialog || this.play.busy) return;
    this.scene.pause('Play');
    const m = this.openModal((c) => {
      // two columns: what's going on (left), what to do (right)
      const top = 8; const L = 176; const R = 466;
      c.add(panel(this, 16, top, WIDTH - 32, HEIGHT - 16));
      c.add(text(this, L, top + 26, 'Paused', { size: 32, color: PALETTE.gold }));
      const s = this.g.s;
      const done = DUNGEONS.filter((d) => s.flags[`boss:${d}`]).length;
      c.add(text(this, L, top + 58, `Dungeons ${done}/3   Hearts ${s.maxHp / 2}`, { color: PALETTE.cream }));
      c.add(text(this, L, top + 78, `Enemy pace ${skillLabel()}/10`, { color: PALETTE.lavender }));
      c.add(text(this, L, top + 116, `Next: ${objective(s)}`, { color: PALETTE.sand, wrap: 290 }));
      this.drawMap(c, L, top + 262);
      const half = (x, label, fn) => { const b = button(this, x, 0, 104, 42, label, () => fn(b), { fill: PALETTE.lavender }); return b; };
      const rows = [['Resume', () => m.close(), PALETTE.gold]];
      if (this.g.hasBlocks()) rows.push(['Reset blocks', () => { m.close(); this.play.resetRoom(); }, PALETTE.cream]);
      rows.push(['How to Play', () => { m.close(); this.help(); }]);
      rows.push(['audio']);
      rows.push(['Save & Title', () => { this.play.saveNow(); m.close(); this.scene.stop('Play'); this.scene.start('Title'); }]);
      rows.push(['All Games', () => { this.play.saveNow(); window.location.href = '../'; }]);
      const step = rows.length > 5 ? 52 : 58; const y0 = top + 34 + (6 - rows.length) * 14;
      rows.forEach(([label, fn, fill], i) => {
        const y = y0 + i * step;
        if (label === 'audio') {
          const sb = half(R - 56, isMuted() ? 'Sound off' : 'Sound on', (b) => { setMuted(!isMuted()); b.setLabel(isMuted() ? 'Sound off' : 'Sound on'); });
          const mb = half(R + 56, musicOn() ? 'Music on' : 'Music off', (b) => { setMusicOn(!musicOn()); b.setLabel(musicOn() ? 'Music on' : 'Music off'); });
          sb.y = y; mb.y = y;
          c.add([sb, mb]);
          return;
        }
        c.add(button(this, R, y, 216, 42, label, fn, { fill: fill || PALETTE.lavender }));
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
    const name = { ow: 'Fernwick Vale  (1-3: dungeons)', d1: 'Mossy Hollow', d2: 'Ember Lab', d3: 'Hollow Keep' }[area];
    c.add(text(this, cx, cy - 66, name, { color: PALETTE.cream }));
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
        // overworld: number the dungeon entrances so you know where you're headed
        const dun = r.warps.find((w) => w.to.startsWith('d'));
        if (dun && !here) c.add(text(this, px + cw / 2, py + ch / 2, dun.to[1], { color: g.flags[`boss:d${dun.to[1]}`] ? PALETTE.leaf : PALETTE.red }));
        if (here) c.add(this.add.image(px + cw / 2, py + ch / 2, 'items', itemFrame('sword')));
      }
    }
  }

  help(onClose = null) {
    if (!onClose && this.justTapped()) return;
    if (document.getElementById('howto')) return;
    this.scene.pause('Play');
    const sections = [...RULES.sections];
    sections.splice(sections.length - 2, 0, {
      heading: 'Enemies adapt to you',
      text: `Enemy pace is at ${skillLabel()} of 10 for you right now. Falling eases the enemies off; beating bosses with hearts to spare speeds them up. Only their speed, reactions and heart drops change.`,
    });
    showHowTo({ ...RULES, sections }, () => { if (!this.modal) this.scene.resume('Play'); onClose?.(); });
  }

  deathModal(onContinue) {
    this.openModal((c) => {
      const top = 70;
      c.add(panel(this, WIDTH / 2 - 160, top, 320, 220, { fill: PALETTE.wine }));
      c.add(text(this, WIDTH / 2, top + 40, 'You fell...', { size: 32, color: PALETTE.cream }));
      c.add(text(this, WIDTH / 2, top + 96, 'You wake at the last entrance\nwith everything you found.', { color: PALETTE.sand }));
      c.add(button(this, WIDTH / 2, top + 170, 200, 48, 'Get up', () => c.close(), { fill: PALETTE.gold }));
    }, onContinue);
  }

  openShop() {
    const g = this.g;
    this.scene.pause('Play');
    const m = this.openModal((c) => {
      const top = 8; const h = HEIGHT - 16; const x0 = 96; const w = WIDTH - 192;
      c.add(panel(this, x0, top, w, h));
      c.add(text(this, WIDTH / 2, top + 28, "Odo's Shop", { size: 32, color: PALETTE.gold }));
      const gems = text(this, WIDTH / 2, top + 60, '', { color: PALETTE.cream });
      const msg = text(this, x0 + 24, top + h - 34, 'Tap a price to buy.', { color: PALETTE.lavender, origin: [0, 0.5] });
      c.add([gems, msg]);
      const rows = [];
      const draw = () => {
        gems.setText(`You have ${g.s.gems} gems   Potions ${g.s.potions}/3`);
        g.shopStock().forEach((it, i) => rows[i]?.sync(it));
      };
      g.shopStock().forEach((it, i) => {
        const y = top + 104 + i * 66;
        const icon = it.id === 'heart' ? this.add.image(x0 + 44, y, 'heartBig').setScale(2) : this.add.image(x0 + 44, y, 'items', itemFrame(it.id)).setScale(2.5);
        const name = text(this, x0 + 76, y - 11, it.name, { color: PALETTE.cream, origin: [0, 0.5] });
        const desc = text(this, x0 + 76, y + 11, it.desc, { color: PALETTE.lavender, origin: [0, 0.5] });
        const b = button(this, x0 + w - 60, y, 84, 44, `${it.price}`, () => {
          const res = g.buy(it.id);
          msg.setText(res.msg).setColor(res.ok ? PALETTE.gold : PALETTE.sand);
          sfx(res.ok ? 'coin' : 'error');
          this.play.saveNow();
          draw();
        }, { fill: PALETTE.gold });
        c.add([icon, name, desc, b]);
        rows.push({ sync: (cur) => { const short = !cur.why && g.s.gems < cur.price;
          desc.setText(cur.why || (short ? `Need ${cur.price - g.s.gems} more gems` : cur.desc)).setColor(cur.why || short ? PALETTE.sand : PALETTE.lavender);
          b.setEnabled(!cur.why && !short); } });
      });
      c.add(button(this, x0 + w - 90, top + h - 34, 144, 40, 'Thanks!', () => m.close(), { fill: PALETTE.lavender }));
      draw();
    }, () => { g.closeShop(); this.scene.resume('Play'); });
  }
}
