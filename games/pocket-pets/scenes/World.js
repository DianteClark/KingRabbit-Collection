import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, header, go, modal, modalOpen, toast, store, persist, petImage, typeChip, pin, fit, LCD } from './common.js';
import { buildingTexture, CASE, TYPE_CASE } from '../art.js';
import * as G from '../logic/game.js';
import { MAPS, LEADERS, BADGES, tileAt, doorOf, buildingAt } from '../logic/world.js';
import * as DATA from '../logic/data.js';
import { SPECIES, ITEMS, STARTERS } from '../logic/data.js';
import { TYPE_INFO } from '../logic/types.js';
import { petName } from '../logic/pet.js';
import { partyPanel, bagPanel, dexPanel, shopPanel, boxPanel, blocking, closeAll } from './panels.js';

const T = 32; // tile size on screen
const VIEW_TOP = 54;
const VIEW_BOTTOM = 504;
const DIALOG_TOP = 384;
const PLAYER_CH = 8;
const STEP_MS = 150;
const TAMER_STEP_MS = 110;

/** Sprite frame for a character facing a way; step = mid-stride. Side views face right (flip for left). */
export function charFrame(ch, face, step = false, alt = false) {
  if (face === 'down') return `c${ch}_${step ? 7 : 6}`;
  if (face === 'up') return `c${ch}_${step ? 9 : 8}`;
  return `c${ch}_${step ? (alt ? 2 : 4) : 1}`;
}

function faceSprite(img, ch, face, step = false, alt = false) {
  img.setFrame(charFrame(ch, face, step, alt));
  if (face === 'left') img.setFlipX(true); else if (face === 'right') img.setFlipX(false); else img.setFlipX(false);
}

export class World extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) { this.opts = data || {}; }

  create() {
    closeAll();
    this.state = store.state;
    if (!this.state) { this.scene.start('Title'); return; }
    const st = this.state;
    this.map = MAPS[st.map];
    this.cameras.main.setBackgroundColor(this.map.cave ? '#2e2420' : '#2f5a2c').fadeIn(180);
    document.body.style.background = PALETTE.night;
    this.busy = false; this.moving = false; this.path = null; this.held = null; this.pending = null;
    this.dialog = null;
    this.lastSave = 0;

    this.drawMap();
    this.npcSprites = new Map();
    this.drawNpcs();
    this.itemSprites = new Map();
    this.drawItems();
    this.player = this.add.image(0, 0, 'chars2', `c${PLAYER_CH}_1`).setScale(2);
    this.grassTop = this.add.image(0, 0, 'tiles', 'tallTop').setScale(2).setVisible(false);
    this.placePlayer();
    this.cameraTo(true);

    header(this, this.map.name, () => {
      if (this.busy || this.moving || this.dialog || this.tamerWalk) { sfx('error'); return; }
      persist(); go(this, 'Title');
    });
    this.hud();
    this.input.on('pointerup', (p) => this.onTap(p));
    // Lifting the d-pad finger anywhere (even off the game) stops walking; other fingers don't.
    const release = (p) => { if (this.held && p.id === this.heldId) { this.held = null; this.padFaces?.forEach((f) => f()); } };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => { this.held = null; this.padFaces?.forEach((f) => f()); });
    this.input.keyboard?.on('keydown', (e) => this.onKey(e, true));
    this.input.keyboard?.on('keyup', (e) => this.onKey(e, false));
    window.__pets = { scene: this, G, state: st, tapTile: (x, y) => this.tapTile(x, y), say: () => this.advanceDialog(), data: { ...DATA, MAPS, LEADERS } };

    persist();
    // Save when the phone locks or the tab is closed, too.
    const away = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', persist);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', away); window.removeEventListener('pagehide', persist); });
    this.time.delayedCall(200, () => this.arrive());
  }

  // ------------------------------------------------------------ drawing

  drawMap() {
    const m = this.map;
    this.water = [];
    m.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        let ch = row[x];
        let frame = ch;
        if (ch === '#') frame = m.cave ? ';' : '.';
        if (ch === 'r' && m.cave) frame = 'r_cave';
        const img = this.add.image(x * T, y * T, 'tiles', frame).setOrigin(0).setScale(2).setDepth(0);
        if (ch === '~') this.water.push(img);
      }
    });
    this.time.addEvent({ delay: 600, loop: true, callback: () => { this.waterFrame = !this.waterFrame; for (const w of this.water) w.setFrame(this.waterFrame ? '~1' : '~'); } });
    (m.buildings || []).forEach((b, i) => {
      const key = buildingTexture(this, this.state.map, i, b);
      this.add.image(b.x * T, b.y * T, key).setOrigin(0).setScale(2).setDepth((b.y + b.h) * T - 1);
    });
    for (const s of m.signs || []) this.add.image(s.x * T, s.y * T, 'tiles', 'sign').setOrigin(0).setScale(2).setDepth(s.y * T + 1);
  }

  drawNpcs() {
    for (const s of this.npcSprites.values()) s.destroy();
    this.npcSprites.clear();
    for (const n of G.npcsOn(this.state)) {
      const img = this.add.image(n.x * T + 16, n.y * T + 12, 'chars2', `c${n.ch}_1`).setScale(2).setDepth(n.y * T + 16);
      faceSprite(img, n.ch, n.face || 'down');
      img.ch = n.ch;
      this.npcSprites.set(n.id, img);
      if (n.kind === 'trainer' && !n.beaten || n.kind === 'leader' && !n.beaten) {
        this.tweens.add({ targets: img, y: img.y - 2, duration: 400, yoyo: true, repeat: -1, ease: 'Stepped', delay: (n.x * 97) % 400 });
      }
    }
  }

  drawItems() {
    for (const it of G.itemsOn(this.state)) {
      const img = this.add.image(it.x * T + 16, it.y * T + 16, 'items', it.item).setScale(2).setDepth(it.y * T + 2);
      this.tweens.add({ targets: img, y: img.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.itemSprites.set(it.id, img);
    }
  }

  placePlayer() {
    const { x, y } = this.state;
    this.player.setPosition(x * T + 16, y * T + 12).setDepth(y * T + 16);
    faceSprite(this.player, PLAYER_CH, this.state.face);
    this.syncGrass();
  }

  syncGrass() {
    const on = tileAt(this.map, this.state.x, this.state.y) === ',';
    this.grassTop.setVisible(on).setPosition(this.state.x * T, this.state.y * T).setOrigin(0).setDepth(this.state.y * T + 17);
  }

  cameraTo(instant) {
    const cam = this.cameras.main;
    const mw = this.map.tiles[0].length * T; const mh = this.map.tiles.length * T;
    // While a dialogue box is open, keep the player in the part of the map above it.
    const bottom = this.dialog ? DIALOG_TOP : VIEW_BOTTOM;
    const viewH = bottom - VIEW_TOP;
    const sx = mw <= WIDTH ? (mw - WIDTH) / 2 : Phaser.Math.Clamp(this.player.x - WIDTH / 2, 0, mw - WIDTH);
    const sy = mh <= viewH ? (mh - viewH) / 2 - VIEW_TOP : Phaser.Math.Clamp(this.player.y - VIEW_TOP - viewH / 2, -VIEW_TOP, mh - bottom);
    if (instant) { cam.scrollX = Math.round(sx); cam.scrollY = Math.round(sy); return; }
    cam.scrollX = Math.round(cam.scrollX + (sx - cam.scrollX) * 0.35);
    cam.scrollY = Math.round(cam.scrollY + (sy - cam.scrollY) * 0.35);
  }

  hud() {
    const D = 5000;
    const fix = (o) => pin(o).setDepth(D + 1);
    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, HEIGHT - VIEW_BOTTOM, hex(PALETTE.night)).setOrigin(0).setScrollFactor(0).setDepth(D);
    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setScrollFactor(0).setDepth(D);
    // D-pad: one big thumb zone. The direction comes from where the thumb is relative to the
    // pad's centre, so you can slide between directions without lifting, and drifting a little
    // off the arrows doesn't stop you. Lifting that finger (anywhere) stops walking.
    const PX = 72; const PY = 574;
    const pad = [['up', PX, PY - 44, '^'], ['left', PX - 46, PY, '<'], ['right', PX + 46, PY, '>'], ['down', PX, PY + 44, 'v']];
    this.add.rectangle(PX, PY, 40, 40, hex(PALETTE.indigo)).setScrollFactor(0).setDepth(D);
    const faces = {};
    for (const [dir, x, y, label] of pad) {
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(D + 1);
      const sh = this.add.rectangle(0, 3, 44, 40, hex(PALETTE.ink));
      const face = this.add.rectangle(0, 0, 44, 40, hex(PALETTE.lavender)).setStrokeStyle(3, hex(PALETTE.ink));
      const t = text(this, 0, -2, label, { size: 32, color: PALETTE.night });
      c.add([sh, face, t]);
      pin(c);
      faces[dir] = (on) => { face.y = on ? 2 : 0; t.y = on ? 0 : -2; face.setFillStyle(hex(on ? PALETTE.gold : PALETTE.lavender)); };
    }
    const showDir = (dir) => Object.entries(faces).forEach(([d, f]) => f(d === dir));
    this.padFaces = [() => showDir(null)];
    const dirFrom = (p) => {
      const dx = p.x - PX; const dy = p.y - PY;
      if (Math.hypot(dx, dy) < 10) return this.held; // thumb resting on the centre: keep going
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    const zone = this.add.zone(PX, PY, 148, 140).setScrollFactor(0).setDepth(D + 2).setInteractive();
    zone.on('pointerdown', (p) => {
      if (this.dialog || blocking() || modalOpen(this)) return;
      const dir = dirFrom(p) || 'down';
      this.held = dir; this.heldId = p.id; this.path = null; this.pending = null;
      showDir(dir);
      // A quick tap still moves one tile, even if the finger lifts before the next frame.
      if (!this.moving && !this.busy) this.tryStep(dir, true);
    });
    this.input.on('pointermove', (p) => {
      if (!this.held || p.id !== this.heldId || !p.isDown) return;
      const dir = dirFrom(p);
      if (dir && dir !== this.held) { this.held = dir; showDir(dir); }
    });
    this.aBtn = fix(button(this, 178, 574, 56, 52, 'A', () => this.pressA(), { size: 32, fill: PALETTE.gold }));
    fix(button(this, 296, 530, 116, 38, 'Pets', () => this.openParty(), { fill: PALETTE.cream }));
    fix(button(this, 296, 576, 116, 38, 'Bag', () => this.openBag(), { fill: PALETTE.cream }));
    fix(button(this, 296, 622, 116, 38, 'PetDex', () => { if (!this.canMenu()) return; dexPanel(this.state); }, { fill: PALETTE.cream }));
    this.coinText = fix(text(this, 178, 522, '', { color: PALETTE.gold }));
    this.badgeIcons = BADGES.map((id, i) => fix(this.add.rectangle(154 + i * 16, 624, 10, 10, 0x000000).setAngle(45).setStrokeStyle(2, hex(PALETTE.ink))));
    this.refreshHud();
  }

  refreshHud() {
    this.coinText.setText(`${this.state.coins}c`).setScale(1);
    fit(this.coinText, 76);
    BADGES.forEach((id, i) => {
      const has = this.state.badges.includes(id);
      this.badgeIcons[i].setFillStyle(has ? hex(TYPE_INFO[LEADERS[id].type].color) : hex(PALETTE.indigo));
    });
  }

  canMenu() { return !this.busy && !this.dialog && !this.moving && !blocking() && !modalOpen(this); }

  openParty() {
    if (!this.canMenu()) return;
    if (!this.state.party.length) { toast(this, 'You have no pets yet!'); return; }
    partyPanel(this.state, { onChange: () => persist() });
  }

  openBag() {
    if (!this.canMenu()) return;
    bagPanel(this.state, { onChange: () => { persist(); this.refreshHud(); } });
  }

  // ------------------------------------------------------------ input

  onKey(e, down) {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
    if (dir) { if (down) { if (!this.dialog) { this.held = dir; this.path = null; } } else if (this.held === dir) this.held = null; return; }
    if (down && (e.key === ' ' || e.key === 'Enter' || e.key === 'z')) {
      if (this.dialog) this.advanceDialog(); else this.pressA();
    }
  }

  onTap(p) {
    if (this.tamerWalk) { this.skipWalk = true; return; }
    if (blocking() || modalOpen(this)) return;
    // Taps on the header and the bottom bar belong to their buttons (A also moves the dialogue on).
    if (p.y < VIEW_TOP || p.y > VIEW_BOTTOM) return;
    if (this.dialog) { this.advanceDialog(); return; }
    if (this.busy) return;
    const wx = p.x + this.cameras.main.scrollX; const wy = p.y + this.cameras.main.scrollY;
    // People are drawn a little above their tile, so a tap on a sprite counts as a tap on its person.
    for (const n of G.npcsOn(this.state)) {
      const spr = this.npcSprites.get(n.id);
      if (spr && Math.abs(wx - spr.x) <= 16 && Math.abs(wy - spr.y) <= 18) { this.tapTile(n.x, n.y); return; }
    }
    this.tapTile(Math.floor(wx / T), Math.floor(wy / T));
  }

  /** Walk to a tile, or walk up to a person, sign or door and use it. */
  tapTile(tx, ty) {
    const st = this.state;
    if (tx === st.x && ty === st.y) return;
    const npc = G.npcAt(st, tx, ty);
    const sign = (this.map.signs || []).find((s) => s.x === tx && s.y === ty);
    const b = buildingAt(this.map, tx, ty);
    if (npc || sign) { this.walkThen(tx, ty, true); return; }
    if (b) {
      const d = doorOf(b);
      this.walkThen(d.x, d.y + 1, false, { x: d.x, y: d.y });
      return;
    }
    if (!G.walkable(st, tx, ty)) { sfx('error'); return; }
    const path = G.findPath(st, tx, ty);
    if (!path) { sfx('error'); return; }
    this.path = path; this.pending = null;
    this.marker(tx, ty);
  }

  marker(tx, ty) {
    const m = this.add.rectangle(tx * T + 16, ty * T + 16, 22, 22).setStrokeStyle(3, 0xf9f5ef).setDepth(5);
    this.tweens.add({ targets: m, scale: 0.4, alpha: 0, duration: 450, onComplete: () => m.destroy() });
  }

  /** Walk next to (or onto) a tile, then use the target. */
  walkThen(tx, ty, adjacent, use = { x: tx, y: ty }) {
    const st = this.state;
    const path = adjacent ? G.findPath(st, tx, ty, { adjacent: true }) : G.findPath(st, tx, ty);
    if (!path) { sfx('error'); return; }
    this.path = path;
    this.pending = use;
    if (!path.length) this.finishPath();
  }

  finishPath() {
    const use = this.pending;
    this.pending = null;
    if (!use) return;
    const st = this.state;
    if (Math.abs(use.x - st.x) + Math.abs(use.y - st.y) !== 1) return;
    st.face = G.dirTo(st.x, st.y, use.x, use.y);
    this.placePlayer();
    this.useTile(use.x, use.y);
  }

  pressA() {
    if (this.dialog) { this.advanceDialog(); return; }
    if (!this.canMenu()) return;
    const f = G.facing(this.state);
    this.useTile(f.x, f.y);
  }

  useTile(x, y) {
    const action = G.interact(this.state, x, y);
    if (!action) return;
    sfx('select');
    const npc = action.npc;
    if (npc) {
      const spr = this.npcSprites.get(npc.id);
      if (spr) faceSprite(spr, spr.ch, G.dirTo(npc.x, npc.y, this.state.x, this.state.y));
    }
    this.doAction(action);
  }

  // ------------------------------------------------------------ movement

  update() {
    if (this.player) this.cameraTo(false);
    if (this.busy || this.moving || this.dialog || blocking() || modalOpen(this)) return;
    if (this.path && this.path.length) {
      const [nx, ny] = this.path.shift();
      const dir = G.dirTo(this.state.x, this.state.y, nx, ny);
      if (!this.tryStep(dir)) { this.path = null; this.pending = null; }
      return;
    }
    if (this.path && !this.path.length) { this.path = null; this.finishPath(); return; }
    if (this.held) this.tryStep(this.held, true);
  }

  tryStep(dir, fromPad = false) {
    const st = this.state;
    const before = { x: st.x, y: st.y };
    const res = G.step(st, dir);
    faceSprite(this.player, PLAYER_CH, dir);
    if (!res.moved) {
      // Walking into a door goes inside.
      const f = G.facing(st);
      const b = buildingAt(this.map, f.x, f.y);
      if (fromPad && b) {
        const d = doorOf(b);
        if (d.x === f.x && d.y === f.y) { this.held = null; this.useTile(f.x, f.y); }
      }
      return false;
    }
    this.moving = true;
    const exit = res.events.find((e) => e.t === 'exit');
    const tx = (exit ? before.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0) : st.x) * T + 16;
    const ty = (exit ? before.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0) : st.y) * T + 12;
    this.walkFrame = !this.walkFrame;
    faceSprite(this.player, PLAYER_CH, dir, true, this.walkFrame);
    if (dir === 'up' || dir === 'down') this.player.setFlipX(this.walkFrame);
    this.grassTop.setVisible(false);
    this.tweens.add({
      targets: this.player, x: tx, y: ty, duration: STEP_MS,
      onUpdate: () => this.player.setDepth(this.player.y + 4),
      onComplete: () => {
        faceSprite(this.player, PLAYER_CH, dir);
        this.moving = false;
        if (!exit) this.placePlayer();
        this.afterStep(res.events);
      },
    });
    if (tileAt(this.map, st.x, st.y) === ',' && !exit) sfx('card');
    return true;
  }

  afterStep(events) {
    const now = Date.now();
    if (now - this.lastSave > 1000) { persist(); this.lastSave = now; }
    // ...and once more when you stop walking, so the last steps are never lost.
    this.saveTimer?.remove();
    this.saveTimer = this.time.delayedCall(500, () => { persist(); this.lastSave = Date.now(); });
    for (const e of events) {
      if (e.t === 'exit') {
        this.busy = true; this.path = null; this.held = null;
        persist();
        const spotted = events.find((x) => x.t === 'spotted');
        this.cameras.main.fadeOut(160, 28, 22, 24);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ spotted: spotted?.npc.id }));
        return;
      }
      if (e.t === 'item') {
        sfx('coin');
        const it = G.itemsOn(this.state);
        for (const [id, img] of this.itemSprites) if (!it.find((i) => i.id === id)) { img.destroy(); this.itemSprites.delete(id); }
        toast(this, `Found ${e.n > 1 ? `${e.n} ` : 'a '}${ITEMS[e.item].name}${e.n > 1 ? 's' : ''}!`);
        persist();
      }
      if (e.t === 'spotted') { this.path = null; this.held = null; this.pending = null; this.spotted(e.npc); return; }
      if (e.t === 'wild') { this.path = null; this.held = null; this.pending = null; this.startWild(e.sp, e.lv); return; }
    }
  }

  // ------------------------------------------------------------ arrivals and dialogue

  arrive() {
    const o = this.opts;
    const st = this.state;
    if (o.intro) {
      this.say([
        'Welcome to the world of Pocket Pets!',
        'Little creatures live in the tall grass, the woods and the caves. Tamers catch them, raise them and battle with them.',
        'Prof. Rowan is waiting for you by the north road with a pet of your own. Go and see him!',
      ], null, null);
      return;
    }
    if (o.after) { this.afterBattle(o.after); return; }
    if (o.spotted) {
      const npc = G.npcsOn(st).find((n) => n.id === o.spotted);
      if (npc) this.spotted(npc);
      return;
    }
    // Resumed (or came back from a battle) somewhere a tamer is waiting: they still challenge you.
    if (!o.after) {
      const waiting = G.npcsOn(st).find((n) => n.ambush && !n.beaten && G.canFight(st)) || G.spottedBy(st);
      if (waiting) this.spotted(waiting);
    }
  }

  /** Show lines one by one. face: character row for a portrait. done: callback. */
  say(lines, face, done) {
    if (!lines || !lines.length) { done?.(); return; }
    this.dialog?.c.destroy();
    const D = 6000;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(D);
    const top = DIALOG_TOP; const h = 114;
    c.add(panel(this, 6, top, WIDTH - 12, h, { fill: PALETTE.cream, inner: PALETTE.night, border: PALETTE.ink }));
    let tx = 22;
    if (face != null) {
      c.add(this.add.rectangle(48, top + h / 2, 64, 64, hex(LCD.light)).setStrokeStyle(3, hex(PALETTE.ink)));
      c.add(this.add.image(48, top + h / 2, 'chars2', `c${face}_0`).setScale(3.5));
      tx = 90;
    }
    const t = text(this, tx, top + 14, '', { origin: 0, align: 'left', color: PALETTE.night, wrap: WIDTH - tx - 22 });
    const more = text(this, WIDTH - 24, top + h - 18, 'v', { color: PALETTE.red });
    this.tweens.add({ targets: more, y: more.y + 3, duration: 300, yoyo: true, repeat: -1 });
    c.add([t, more]);
    pin(c);
    this.dialog = { c, t, lines: [...lines], done };
    this.showLine();
  }

  showLine() {
    const d = this.dialog;
    const line = d.lines.shift();
    d.t.setText(line);
    // Too long for the box: show the first part now and the rest on the next tap.
    if (d.t.height > 96) {
      const words = line.split(' ');
      let cut = Math.floor(words.length / 2);
      for (let i = cut; i > 2; i--) if (/[.!?,]$/.test(words[i - 1])) { cut = i; break; }
      d.t.setText(words.slice(0, cut).join(' '));
      d.lines.unshift(words.slice(cut).join(' '));
    }
    d.shownAt = Date.now();
  }

  advanceDialog() {
    const d = this.dialog;
    if (!d || Date.now() - d.shownAt < 180) return;
    sfx('tap');
    if (d.lines.length) { this.showLine(); return; }
    d.c.destroy();
    this.dialog = null;
    d.done?.();
  }

  // ------------------------------------------------------------ actions

  doAction(a) {
    const st = this.state;
    if (a.t === 'talk') { this.say(a.lines, a.npc?.ch ?? null); return; }
    if (a.t === 'gift') {
      this.say([...a.lines, `You got ${a.n > 1 ? `${a.n} ` : 'a '}${ITEMS[a.item].name}${a.n > 1 ? 's' : ''}!`], a.npc?.ch, () => { sfx('coin'); persist(); });
      return;
    }
    if (a.t === 'heal') {
      if (a.home) {
        this.say(['Mom: Welcome home! Have a rest.'], 9, () => this.rest(() => this.say(['Your pets are full of energy again!'], null)));
        return;
      }
      modal(this, a.name, ['Welcome! Shall we rest your pets? It\'s free.', 'The Pet Box keeps the pets you aren\'t carrying.'], [
        ['Rest my pets', () => this.rest(() => this.say(['Nurse: Your pets are fully rested. Come back any time!'], 9))],
        ['Pet Box', () => boxPanel(st, { onChange: () => persist() })],
        ['Leave', null, PALETTE.indigo, PALETTE.cream],
      ]);
      return;
    }
    if (a.t === 'shop') { shopPanel(st, a.stock, a.name, { onChange: () => { persist(); this.refreshHud(); } }); return; }
    if (a.t === 'starter') { this.say(['Prof. Rowan: Ah, there you are! Every new tamer needs a partner.', 'Choose one of these three. Take good care of it!'], 7, () => this.starterPicker()); return; }
    if (a.t === 'battle') { this.challenge(a.setup, a.npc); }
  }

  rest(done) {
    this.busy = true;
    G.restHere(this.state);
    persist();
    sfx('power');
    this.cameras.main.flash(300, 249, 245, 239);
    this.time.delayedCall(500, () => { this.busy = false; done?.(); });
  }

  spotted(npc) {
    this.busy = true;
    this.path = null; this.held = null; this.pending = null;
    const st = this.state;
    const spr = this.npcSprites.get(npc.id);
    sfx('error');
    if (!spr) { this.busy = false; this.challenge(npc.kind === 'leader' ? G.leaderSetup(st, npc.id) : G.trainerSetup(st, npc), npc); return; }
    this.tweens.killTweensOf(spr);
    spr.y = npc.y * T + 12;
    const bang = text(this, spr.x, spr.y - 30, '!', { size: 32, color: PALETTE.red }).setDepth(4000);
    this.tweens.add({ targets: bang, y: bang.y - 6, duration: 160, yoyo: true });
    // The tamer walks up to you (tap to hurry). It goes back to its post after the battle.
    const route = G.findPath({ ...st, x: npc.x, y: npc.y }, st.x, st.y, { adjacent: true }) || [];
    let pos = { x: npc.x, y: npc.y };
    let k = 0;
    const go = () => {
      if (k >= route.length || this.skipWalk) {
        const last = route.length ? route[route.length - 1] : [npc.x, npc.y];
        pos = { x: last[0], y: last[1] };
        spr.setPosition(pos.x * T + 16, pos.y * T + 12).setDepth(pos.y * T + 16);
        faceSprite(spr, spr.ch, G.dirTo(pos.x, pos.y, st.x, st.y));
        st.face = G.dirTo(st.x, st.y, pos.x, pos.y);
        this.placePlayer();
        this.skipWalk = false; this.tamerWalk = false;
        this.time.delayedCall(150, () => {
          this.busy = false;
          this.challenge(npc.kind === 'leader' ? G.leaderSetup(st, npc.id) : G.trainerSetup(st, npc), npc);
        });
        return;
      }
      const [nx, ny] = route[k++];
      const dir = G.dirTo(pos.x, pos.y, nx, ny);
      faceSprite(spr, spr.ch, dir, true, k % 2 === 0);
      pos = { x: nx, y: ny };
      this.tweens.add({ targets: spr, x: nx * T + 16, y: ny * T + 12, duration: TAMER_STEP_MS, onUpdate: () => spr.setDepth(spr.y + 4), onComplete: go });
    };
    this.time.delayedCall(560, () => { bang.destroy(); this.tamerWalk = true; go(); });
  }

  /** Intro lines, then the battle. */
  challenge(setup, npc) {
    const ch = setup.foe.ch ?? npc?.ch ?? null;
    this.say(setup.intro?.length ? setup.intro : [`${setup.foe.title} ${setup.foe.name} wants to battle!`], ch, () => this.startBattle(setup));
  }

  startWild(sp, lv) {
    const setup = G.wildSetup(this.state, sp, lv);
    this.startBattle(setup);
  }

  startBattle(setup) {
    this.busy = true;
    persist();
    sfx(setup.kind === 'wild' ? 'roll' : 'goal');
    const cam = this.cameras.main;
    // A dithered wipe made from the Pocket Pets screen-effect frames.
    const cover = [];
    for (let x = 0; x < WIDTH; x += 40) cover.push(this.add.image(x, 0, 'fade', 'f0').setOrigin(0).setScale(2, HEIGHT / 40).setScrollFactor(0).setDepth(9000).setAlpha(0));
    cam.flash(120, 255, 255, 255);
    this.time.delayedCall(160, () => cam.flash(120, 255, 255, 255));
    let f = 0;
    this.time.addEvent({
      delay: 55, repeat: 7, callback: () => {
        for (const c of cover) c.setAlpha(1).setFrame(`f${Math.min(7, f)}`);
        f += 1;
        if (f >= 8) this.time.delayedCall(80, () => this.scene.start('Battle', { setup }));
      },
    });
  }

  starterPicker() {
    this.busy = true;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(7500);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.85).setOrigin(0).setInteractive());
    c.add(text(this, WIDTH / 2, 120, 'Choose your partner', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 156, 'Tap a pet to meet it', { color: PALETTE.lavender }));
    STARTERS.forEach((sp, i) => {
      const x = 62 + i * 118; const y = 280;
      const s = SPECIES[sp];
      const cs = this.add.image(x, y, 'cases', `case${CASE[TYPE_CASE[s.type]]}`).setScale(1.3);
      const scr = this.add.rectangle(x - 1, y - 1, 51, 49, hex(LCD.light));
      const pet = petImage(this, x - 1, y + 1, sp, 2.5);
      this.tweens.add({ targets: pet, y: pet.y - 2, duration: 300 + i * 60, yoyo: true, repeat: -1, ease: 'Stepped' });
      const nm = text(this, x, y + 70, s.name, { color: PALETTE.cream });
      const chip = typeChip(this, x, y + 96, s.type, { origin: 0.5 });
      const zone = this.add.zone(x, y + 20, 112, 190).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        sfx('select');
        modal(this, s.name, [`A ${TYPE_INFO[s.type].name} pet.`, s.dex, { text: `${TYPE_INFO[s.type].name} ${TYPE_INFO[s.type].why}.`, color: PALETTE.sand }], [
          [`Choose ${s.name}`, () => { c.destroy(); this.gotStarter(sp); }],
          ['Look again', null],
        ]);
      });
      c.add([cs, scr, pet, nm, chip, zone]);
    });
    pin(c);
  }

  gotStarter(sp) {
    const st = this.state;
    const pet = G.chooseStarter(st, sp);
    persist();
    sfx('win');
    this.drawNpcs();
    this.busy = false;
    this.say([`You received ${petName(pet)}!`, 'Prof. Rowan: And take these 5 Capsules. Weaken a wild pet, then throw one to catch it.', 'Head north along Meadow Path to Brookton. Fern, the first Hall leader, waits there.', 'A few Potions from the Pet Shop (blue roof) are a smart buy. Good luck!'], 7, () => {
      const rival = G.npcsOn(st).find((n) => n.id === 'rival1');
      if (rival && !rival.beaten) this.spotted(rival);
    });
  }

  afterBattle(after) {
    this.refreshHud();
    const lines = [...(after.lines || [])];
    const finish = () => {
      if (after.champion) { this.hallOfFame(); return; }
      if (after.badge) {
        const L = LEADERS[after.badge];
        sfx('win');
        modal(this, L.badgeName, [`Badge ${this.state.badges.length} of ${BADGES.length}!`, this.state.badges.length < BADGES.length ? 'On to the next Hall.' : 'Champion Aria waits in the tower at the Summit.'], [['Great!', null]]);
      }
    };
    if (after.blackout) { this.say(lines, null, finish); return; }
    if (lines.length) this.say(lines, null, finish); else finish();
  }

  hallOfFame() {
    sfx('strike');
    const st = this.state;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(7600);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.night), 1).setOrigin(0).setInteractive());
    c.add(text(this, WIDTH / 2, 80, 'HALL OF FAME', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 116, 'You are the new Champion!', { color: PALETTE.cream }));
    st.party.forEach((p, i) => {
      const x = 70 + (i % 3) * 110; const y = 210 + Math.floor(i / 3) * 150;
      c.add(this.add.rectangle(x, y, 84, 84, hex(LCD.light)).setStrokeStyle(3, hex(PALETTE.ink)));
      c.add(petImage(this, x, y, p.sp, 3.5, 1));
      c.add(fit(text(this, x, y + 58, petName(p), { color: PALETTE.cream }), 100));
      c.add(text(this, x, y + 80, `Lv ${p.lv}`, { color: PALETTE.lavender }));
    });
    const dc = G.dexCounts(st);
    c.add(text(this, WIDTH / 2, 520, `PetDex: ${dc.caught} of ${dc.total} caught`, { color: PALETTE.sand }));
    c.add(button(this, WIDTH / 2, 580, 220, 46, 'Keep exploring', () => c.destroy(), { fill: PALETTE.gold }));
    pin(c);
  }
}
