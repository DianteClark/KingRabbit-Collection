import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import * as Wd from '../logic/world.js';
import { W, H, N, T, P, Z, TILE, TPH, TPD, BUILDS, ITEMS, DAILY_DAYS } from '../logic/data.js';
import { idx, tx, ty, inMap } from '../logic/map.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import * as PN from './panels.js';
import { give, stat, adapt, finishDaily, todayKey } from '../progress.js';
import { playMusic, currentMusic, musicOn } from '../music.js';
import { botStep } from '../logic/bot.js';

const VIEW = { y: 98, h: 446 };
const INFO_Y = 544;
const BAR_Y = 580;
const MW = W * TILE; const MH = H * TILE;
const SPEEDS = [0, 1, 3, 8];
const DRAG_PX = 10;
const TICK_MS = 100;

const CATS = [
  { id: 'look', label: 'Look', icon: 'sel' },
  { id: 'orders', label: 'Orders', icon: 'm:chop' },
  { id: 'build', label: 'Build', icon: 'bed' },
  { id: 'zones', label: 'Zones', icon: 'zstock' },
  { id: 'craft', label: 'Craft', icon: 'i:tools' },
  { id: 'menu', label: 'Menu', icon: 'menu' },
];
const TRAYS = {
  orders: [
    { id: 'chop', label: 'Chop', icon: 'su:tree0', hint: 'Chop: drag over trees for wood.' },
    { id: 'mine', label: 'Mine', icon: 'su:ore', hint: 'Mine: drag over rock (stone) and ore (metal).' },
    { id: 'harvest', label: 'Pick', icon: 'su:bushB', hint: 'Pick: drag over berry bushes and herbs. Bushes regrow.' },
    { id: 'hunt', label: 'Hunt', icon: 'm:hunt', hint: 'Hunt: drag over animals. Boars and foxes fight back.' },
    { id: 'cancel', label: 'Cancel', icon: 'm:alert', hint: 'Cancel: drag to clear orders and unbuilt blueprints.' },
  ],
  build: [
    { id: 'wall', icon: 'wall0', label: 'Wall' },
    { id: 'swall', icon: 'swall0', label: 'Stone' },
    { id: 'door', icon: 'door', label: 'Door' },
    { id: 'bed', icon: 'bed', label: 'Bed' },
    { id: 'campfire', icon: 'campfire', label: 'Fire' },
    { id: 'stove', icon: 'stoveLit', label: 'Stove' },
    { id: 'workbench', icon: 'workbench', label: 'Bench' },
    { id: 'storage', icon: 'storage', label: 'Crate' },
    { id: 'radio', icon: 'radio', label: 'Radio' },
    { id: 'remove', icon: 'm:mine', label: 'Remove', hint: 'Remove: drag over buildings to take them down (you get most materials back).' },
  ],
  zones: [
    { id: 'stock', icon: 'zstock', label: 'Stock', hint: 'Stockpile: drag a box. Settlers bring loose items here.' },
    { id: 'farm', icon: 'crop1', label: 'Farm', hint: 'Farm: drag a field. Corn is sown in spring to fall.' },
    { id: 'clear', icon: 'm:alert', label: 'Clear', hint: 'Clear: drag to remove stockpile and farm zones.' },
  ],
};
const RECT_TOOLS = new Set(['chop', 'mine', 'harvest', 'hunt', 'cancel', 'remove', 'stock', 'farm', 'clear']);
const LINE_TOOLS = new Set(['wall', 'swall']);
const isDrag = (t) => RECT_TOOLS.has(t) || LINE_TOOLS.has(t);
const costText = (k) => Object.entries(BUILDS[k].cost).map(([i, n]) => `${n} ${ITEMS[i].name.toLowerCase()}`).join(', ');

const TUT = [
  { text: 'Your settlers just landed. Drag the map to look around, pinch to zoom. They already know how to work.', next: true },
  { text: 'Make a stockpile: tap Zones, then Stock, and drag a box near your settlers.', done: (s) => s.zone.filter((z) => z === Z.STOCK).length >= 4, cat: 'zones' },
  { text: 'Wood! Tap Orders, then Chop, and drag over a few trees.', done: (s) => Object.values(s.des).filter((d) => d === 'chop').length >= 3, cat: 'orders' },
  { text: 'Tap Build, then Fire, and tap an open spot to place a campfire for cooking and warmth.', done: (s) => Object.values(s.blds).some((b) => b.k === 'campfire'), cat: 'build' },
  { text: 'Beds: Build, then Bed. Place one for each settler near the fire.', done: (s) => Object.values(s.blds).filter((b) => b.k === 'bed').length >= Math.min(3, Wd.settlers(s).length), cat: 'build' },
  { text: 'Food for later: Zones, then Farm. Drag a field of about 12 tiles.', done: (s) => s.zone.filter((z) => z === Z.FARM).length >= 8, cat: 'zones' },
  { text: 'Tap a settler (or a face at the top) to see how they feel and what they think.', event: 'settler' },
  { text: 'All set! Settlers work by themselves. Survive two years or build a radio. Use the speed buttons to fast-forward.', next: true, last: true },
];

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  init(data) {
    this.s = data.state;
    this.slot = data.slot || 'run';
    this.holds = new Set();
    this.speed = 1;
    this.tool = 'look';
    this.ptrs = new Map();
    this.gest = null;
    this.acc = 0;
    this.sprites = new Map();
    this.fires = new Map();
    this.glows = new Map();
    this.toasts = [];
    this.selected = null;
    this.selTile = null;
    this.followId = null;
    this.trayOpen = null;
    this.leaving = false;
    this.lastSave = 0;
    this.lastHour = -1;
    this.season = null;
    this.portraitIds = '';
    this.tutShown = -1;
    this.resultShown = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1c1618');
    if (!this.textures.exists('menu')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xf9f5ef); for (const y of [1, 4, 7]) g.fillRect(0, y, 8, 2);
      g.generateTexture('menu', 8, 10); g.destroy();
    }
    this.world = this.add.container(0, 0);
    this.ground = this.add.renderTexture(0, 0, MW, MH).setOrigin(0);
    this.mobLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.night = this.add.rectangle(0, 0, MW, MH, 0x0b0a24, 1).setOrigin(0).setAlpha(0);
    this.glowLayer = this.add.container(0, 0);
    this.preview = this.add.graphics();
    this.selMark = this.add.image(0, 0, 'sel').setVisible(false);
    this.world.add([this.ground, this.mobLayer, this.fxLayer, this.night, this.glowLayer, this.preview, this.selMark]);
    this.zoom = 3;
    const home = this.s.mobs.find((m) => m.kind === 'settler' && !m.dead);
    this.centerOn(((home ? home.x : W / 2)) * TILE, ((home ? home.y : H / 2)) * TILE);
    this.redrawAll();
    this.buildHud();
    this.setupInput();
    this.refreshHud(true);
    this.syncMusic();

    this.onHide = () => { if (document.hidden) this.save(true); };
    document.addEventListener('visibilitychange', this.onHide);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', this.onHide); PN.closeAll(); this.save(true); });
    window.__colony = { S, Wd, PN, scene: this, store, botStep };
    this.cameras.main.fadeIn(200, 28, 22, 24);
    if (this.s.t <= 7 * TPH + 1) stat('colonies');
    if (this.s.result) this.time.delayedCall(300, () => this.showEnd());

  }

  // ================================================================ drawing the map

  frameFor(i) {
    const s = this.s;
    const se = Wd.season(s).id;
    const t = s.ter[i];
    const h = Wd.hash(i);
    const out = [];
    if (t === T.WATER) {
      let m = 0; const x = tx(i); const y = ty(i);
      [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => { const nx = x + dx; const ny = y + dy; if (!inMap(nx, ny) || s.ter[idx(nx, ny)] === T.WATER) m |= bit; });
      out.push([`${se}:w${m}`, 1]);
    } else if (t === T.ROCK) out.push([`${se}:rock`, 1]);
    else if (t === T.ORE) out.push([`${se}:ore`, 1]);
    else if (s.zone[i] === Z.FARM && !s.plant[i]) {
      const c = s.crop[i];
      out.push([c < 0 ? 'soil' : c >= 1 ? 'crop2' : c < 0.33 ? 'crop0' : 'crop1', 1]);
    } else if (t === T.DIRT) out.push([`${se}:dirt`, 1]);
    else out.push([`${se}:g${h < 0.55 ? 0 : h < 0.7 ? 1 : h < 0.8 ? 2 : h < 0.9 ? 3 : 4}`, 1]);
    const pl = s.plant[i];
    if (pl === P.TREE) out.push([`${se}:tree0`, 1]);
    else if (pl === P.PINE) out.push([`${se}:tree1`, 1]);
    else if (pl === P.BUSH) out.push([s.pgrow[i] > 0 || se === 'wi' ? `${se}:bush` : `${se}:bushB`, 1]);
    else if (pl === P.HERB) out.push([s.pgrow[i] > 0 ? `${se}:g1` : `${se}:herb`, 1]);
    if (s.zone[i] === Z.STOCK) out.push(['zstock', 1, true]);
    const b = Wd.bAt(s, i);
    if (b) {
      let f = b.k;
      if (b.k === 'wall' || b.k === 'swall') {
        let m = 0; const x = tx(i); const y = ty(i);
        [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => {
          if (!inMap(x + dx, y + dy)) return;
          const o = Wd.bAt(s, idx(x + dx, y + dy));
          if (o && (o.k === 'wall' || o.k === 'swall' || o.k === 'door') && (o.done || !b.done)) m |= bit;
        });
        f = `${b.k}${m}`;
      } else if (b.k === 'campfire') f = b.done && b.fuel <= 0 ? 'campfireOut' : 'campfire';
      else if (b.k === 'stove') f = b.done && b.fuel > 0 ? 'stoveLit' : 'stove';
      else if (b.k === 'radio') f = s.radio.calling ? 'radioOn' : 'radio';
      if (b.done) out.push([f, 1]);
      else { out.push([f, 0.45]); out.push(['frame', 0.9]); }
    }
    const it = s.items[i];
    if (it && !(b && b.k === 'storage')) out.push([`i:${it.k}`, 1]);
    const d = s.des[i];
    if (d) out.push([d === 'remove' ? 'm:alert' : `m:${d}`, 0.8]);
    return out;
  }

  drawTile(i) {
    const x = tx(i) * TILE; const y = ty(i) * TILE;
    for (const [f, a, own] of this.frameFor(i)) {
      this.ground.batchDrawFrame(own ? 'zstock' : 'co', own ? '__BASE' : f, x, y, a);
    }
  }

  redrawAll() {
    this.ground.beginDraw();
    for (let i = 0; i < N; i++) this.drawTile(i);
    this.ground.endDraw();
    const r = Wd.rt(this.s); r.all = false; r.dirty.clear();
  }

  redrawDirty() {
    const r = Wd.rt(this.s);
    if (r.all) { this.redrawAll(); return; }
    if (!r.dirty.size) return;
    this.ground.beginDraw();
    for (const i of r.dirty) this.drawTile(i);
    this.ground.endDraw();
    r.dirty.clear();
  }

  // ================================================================ creatures and effects

  syncSprites(time) {
    const s = this.s;
    const seen = new Set();
    for (const m of s.mobs) {
      if (m.dead) continue;
      seen.add(m.id);
      let sp = this.sprites.get(m.id);
      if (!sp) {
        const c = this.add.container(0, 0);
        const body = this.add.image(0, 0, 'co', this.bodyFrame(m, 0)).setOrigin(0.5, 0.7);
        const carry = this.add.image(0, -7, 'co', 'i:wood').setScale(0.6).setVisible(false);
        const tag = this.add.image(3, -8, 'co', 'm:zz').setScale(0.6).setVisible(false);
        const bar = this.add.rectangle(-4, 3, 8, 1, 0xe3d245).setOrigin(0, 0.5).setVisible(false);
        c.add([body, carry, tag, bar]);
        c.body = body; c.carry = carry; c.tag = tag; c.bar = bar;
        this.mobLayer.add(c);
        this.sprites.set(m.id, c);
        sp = c;
      }
      const walkF = m.moving ? Math.floor((time + m.id * 97) / 140) % 4 : 0;
      sp.body.setFrame(this.bodyFrame(m, walkF));
      if (m.face) sp.body.setFlipX(m.face < 0);
      const lying = m.kind === 'settler' && (m.downed || m.sleeping);
      const bob = m.kind === 'animal' && !m.moving ? Math.round(Math.sin((time + m.id * 300) / 400)) * 0.5 : 0;
      sp.setPosition(m.x * TILE, m.y * TILE + bob + (lying ? 1 : 0));
      if (m.kind === 'settler') {
        sp.carry.setVisible(!!m.carry);
        if (m.carry) sp.carry.setFrame(`i:${m.carry.k}`);
        const tag = m.downed ? 'm:alert' : m.brk ? 'm:stuck' : m.sick ? 'm:sick' : m.sleeping ? 'm:zz' : null;
        sp.tag.setVisible(!!tag);
        if (tag) sp.tag.setFrame(tag);
        sp.bar.setVisible(m.hp < 100 || m.downed);
        if (sp.bar.visible) sp.bar.setScale(Math.max(0.05, m.hp / 100), 1).setFillStyle(m.hp < 35 ? 0xa13d3b : 0xe3d245);
        sp.setDepth(2);
      } else if (m.kind === 'animal') {
        sp.tag.setVisible(!!m.hunt || !!m.hostile);
        if (m.hunt || m.hostile) sp.tag.setFrame(m.hostile ? 'm:alert' : 'm:hunt');
        sp.bar.setVisible(m.hp < m.def.hp);
        if (sp.bar.visible) sp.bar.setScale(Math.max(0.05, m.hp / m.def.hp), 1).setFillStyle(0xa13d3b);
      } else {
        sp.tag.setVisible(false);
        sp.body.setTint(m.fleeing ? 0xc0a0a0 : 0xff8080);
        sp.bar.setVisible(m.hp < 80);
        if (sp.bar.visible) sp.bar.setScale(Math.max(0.05, m.hp / 80), 1).setFillStyle(0xa13d3b);
      }
    }
    for (const [id, sp] of this.sprites) if (!seen.has(id)) { sp.destroy(); this.sprites.delete(id); }
    this.mobLayer.sort('y');
    // Selection marker
    if (this.selected != null) {
      const sp = this.sprites.get(this.selected);
      if (sp) this.selMark.setVisible(true).setPosition(sp.x, sp.y - 2);
      else { this.selMark.setVisible(false); }
      if (this.followId === this.selected && sp && !this.gest) this.centerOn(sp.x, sp.y, true);
    } else if (this.selTile != null) this.selMark.setVisible(true).setPosition(tx(this.selTile) * TILE + 4, ty(this.selTile) * TILE + 4);
    else this.selMark.setVisible(false);
  }

  bodyFrame(m, f) {
    if (m.kind === 'settler') return m.downed || m.sleeping ? `c${m.look}:x` : `c${m.look}:${f}`;
    if (m.kind === 'raider') return `e${m.look}:${f}`;
    return m.def.sprite.startsWith('e') ? `${m.def.sprite}:${f}` : m.def.sprite;
  }

  syncFires(time) {
    const s = this.s;
    for (const [key, v] of Object.entries(s.fire)) {
      let f = this.fires.get(key);
      if (!f) { f = this.add.image(tx(+key) * TILE + 4, ty(+key) * TILE + 3, 'co', 'fire0'); this.fxLayer.add(f); this.fires.set(key, f); }
      f.setFrame(`fire${Math.floor((time + +key * 50) / 160) % 2}`).setScale(0.7 + v * 0.6);
    }
    for (const [key, f] of this.fires) if (!s.fire[key]) { f.destroy(); this.fires.delete(key); }
    // Flames on lit campfires and glows at night.
    const dark = this.night.alpha;
    const lit = Object.values(s.blds).filter((b) => b.done && BUILDS[b.k].heat && b.fuel > 0);
    const want = new Set(lit.map((b) => b.id));
    for (const b of lit) {
      let g = this.glows.get(b.id);
      if (!g) {
        const glow = this.add.image(tx(b.i) * TILE + 4, ty(b.i) * TILE + 4, 'glow').setBlendMode(Phaser.BlendModes.ADD);
        const flame = b.k === 'campfire' ? this.add.image(tx(b.i) * TILE + 4, ty(b.i) * TILE + 2, 'co', 'fire0') : null;
        this.glowLayer.add(glow); if (flame) this.fxLayer.add(flame);
        g = { glow, flame }; this.glows.set(b.id, g);
      }
      g.glow.setAlpha(dark * 1.6);
      g.flame?.setFrame(`fire${Math.floor((time + b.id * 77) / 170) % 2}`);
    }
    for (const [id, g] of this.glows) if (!want.has(id)) { g.glow.destroy(); g.flame?.destroy(); this.glows.delete(id); }
  }

  darkness() {
    const h = Wd.hour(this.s);
    if (h >= 21 || h < 4.5) return 0.5;
    if (h >= 18) return ((h - 18) / 3) * 0.5;
    if (h < 7) return ((7 - h) / 2.5) * 0.5;
    return 0;
  }

  shot(n) {
    const a = this.s.mobs.find((m) => m.id === n.from); const b = this.s.mobs.find((m) => m.id === n.to);
    if (!a || !b) return;
    const g = this.add.rectangle(a.x * TILE, a.y * TILE - 2, 3, 1, 0xf9f5ef).setOrigin(0.5);
    g.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    this.fxLayer.add(g);
    this.tweens.add({ targets: g, x: b.x * TILE, y: b.y * TILE - 2, duration: 140, onComplete: () => g.destroy() });
  }

  puff(i, color = 0xf9f5ef) {
    for (let k = 0; k < 4; k++) {
      const c = this.add.rectangle(tx(i) * TILE + 2 + Math.random() * 4, ty(i) * TILE + 6, 1.5, 1.5, color, 0.9);
      this.fxLayer.add(c);
      this.tweens.add({ targets: c, y: c.y - 5 - Math.random() * 4, alpha: 0, duration: 450, onComplete: () => c.destroy() });
    }
  }

  // ================================================================ view

  minZoom() { return Math.max(WIDTH / MW, VIEW.h / MH); }

  clampView() {
    const z = this.zoom;
    const w = MW * z; const h = MH * z;
    let x = this.world.x; let y = this.world.y;
    x = w <= WIDTH ? (WIDTH - w) / 2 : Phaser.Math.Clamp(x, WIDTH - w, 0);
    y = h <= VIEW.h ? VIEW.y + (VIEW.h - h) / 2 : Phaser.Math.Clamp(y, VIEW.y + VIEW.h - h, VIEW.y);
    this.world.setPosition(Math.round(x), Math.round(y)).setScale(z);
  }

  centerOn(wx, wy, smooth = false) {
    const tx0 = WIDTH / 2 - wx * this.zoom; const ty0 = VIEW.y + VIEW.h / 2 - wy * this.zoom;
    if (smooth) { this.world.x += (tx0 - this.world.x) * 0.15; this.world.y += (ty0 - this.world.y) * 0.15; }
    else { this.world.x = tx0; this.world.y = ty0; }
    this.clampView();
  }

  jumpTo(i) { this.followId = null; this.centerOn(tx(i) * TILE + 4, ty(i) * TILE + 4); this.selTile = i; this.selected = null; }

  zoomAt(z, sx, sy) {
    const nz = Phaser.Math.Clamp(z, this.minZoom(), 6);
    const wx = (sx - this.world.x) / this.zoom; const wy = (sy - this.world.y) / this.zoom;
    this.zoom = nz;
    this.world.x = sx - wx * nz; this.world.y = sy - wy * nz;
    this.clampView();
  }

  tileAt(sx, sy) {
    const x = Math.floor((sx - this.world.x) / this.zoom / TILE); const y = Math.floor((sy - this.world.y) / this.zoom / TILE);
    return { x: Phaser.Math.Clamp(x, 0, W - 1), y: Phaser.Math.Clamp(y, 0, H - 1), inside: inMap(x, y) };
  }

  inView(p) { return p.y >= VIEW.y && p.y < VIEW.y + VIEW.h && !this.overBanner(p); }
  overBanner(p) {
    for (const b of [this.banner, this.raidBar]) if (b?.visible && b.hit && Phaser.Geom.Rectangle.Contains(b.hit, p.x, p.y)) return true;
    return this.toasts.some((t) => t.bg.getBounds().contains(p.x, p.y));
  }

  // ================================================================ input

  setupInput() {
    this.input.addPointer(2);
    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));
    this.input.on('wheel', (p, _o, _dx, dy) => { if (this.inView(p) && !PN.blocking()) this.zoomAt(this.zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y); });
  }

  onDown(p, over) {
    if (over.length || PN.blocking() || !this.inView(p)) return;
    if (this.trayOpen) { this.closeTray(); return; }
    this.ptrs.set(p.id, { x: p.x, y: p.y });
    if (this.ptrs.size === 1) {
      const t = this.tileAt(p.x, p.y);
      this.gest = { kind: isDrag(this.tool) ? 'draw' : 'pan', id: p.id, x0: p.x, y0: p.y, wx: this.world.x, wy: this.world.y, moved: 0, a: t, b: t };
      if (this.gest.kind === 'draw') this.drawPreview();
      else if (BUILDS[this.tool]) this.showGhost(t);
    } else if (this.ptrs.size === 2) {
      this.preview.clear();
      const [a, b] = [...this.ptrs.values()];
      this.gest = { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, wx: this.world.x, wy: this.world.y };
      this.followId = null;
      this.setInfo(this.toolHint());
    }
  }

  onMove(p) {
    if (!this.ptrs.has(p.id)) return;
    this.ptrs.set(p.id, { x: p.x, y: p.y });
    const g = this.gest;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const nz = Phaser.Math.Clamp(g.z0 * (d / g.d0), this.minZoom(), 6);
      const wx = (g.mx - g.wx) / g.z0; const wy = (g.my - g.wy) / g.z0;
      this.zoom = nz;
      this.world.x = mx - wx * nz; this.world.y = my - wy * nz;
      this.clampView();
      return;
    }
    if (p.id !== g.id) return;
    g.moved = Math.max(g.moved, Math.hypot(p.x - g.x0, p.y - g.y0));
    if (g.kind === 'draw') {
      const t = this.tileAt(p.x, Phaser.Math.Clamp(p.y, VIEW.y, VIEW.y + VIEW.h - 1));
      if (t.x !== g.b.x || t.y !== g.b.y) { g.b = t; this.drawPreview(); }
    } else if (g.moved > DRAG_PX) {
      this.preview.clear();
      this.followId = null;
      this.world.x = g.wx + (p.x - g.x0); this.world.y = g.wy + (p.y - g.y0);
      this.clampView();
    }
  }

  onUp(p) {
    if (!this.ptrs.has(p.id)) return;
    this.ptrs.delete(p.id);
    const g = this.gest;
    if (!g) return;
    if (g.kind === 'pinch') { if (!this.ptrs.size) this.gest = null; return; }
    if (p.id !== g.id) return;
    this.gest = null;
    if (PN.blocking()) { this.preview.clear(); return; }
    if (g.kind === 'draw') {
      // Use where the finger lifted, in case the last move event was not seen.
      if (p.x || p.y) { const t = this.tileAt(p.x, Phaser.Math.Clamp(p.y, VIEW.y, VIEW.y + VIEW.h - 1)); g.b = t; }
      this.commitDraw(g);
      return;
    }
    if (g.moved <= DRAG_PX && g.a.inside) this.tapTile(g.a, p);
    else this.preview.clear();
  }

  tapTile(t, p) {
    const i = idx(t.x, t.y);
    if (this.tool === 'look') {
      // Prefer a creature near the finger.
      const wx = (p.x - this.world.x) / this.zoom / TILE; const wy = (p.y - this.world.y) / this.zoom / TILE;
      let best = null; let bd = 1.1;
      for (const m of this.s.mobs) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - wx, m.y - 0.3 - wy) - (m.kind === 'settler' ? 0.25 : 0);
        if (d < bd) { bd = d; best = m; }
      }
      sfx('tap');
      if (best) this.select(best.id);
      else { this.selected = null; this.selTile = i; this.followId = null; PN.showTile(this, i); }
      return;
    }
    if (BUILDS[this.tool]) {
      const r = S.build(this.s, this.tool, i);
      this.preview.clear();
      if (r.ok) { sfx('place'); this.puff(i); this.afterChange(); this.setInfo(`${BUILDS[this.tool].name} planned. Settlers will bring ${costText(this.tool)}.`); this.tutorialCheck(); }
      else { sfx('error'); this.toast(r.reason); }
    }
  }

  rectTiles(a, b) {
    const out = [];
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push(idx(x, y));
    return out;
  }
  lineTiles(a, b) {
    // An L: along the longer direction first.
    const out = [];
    const horiz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const sx = Math.sign(b.x - a.x); const sy = Math.sign(b.y - a.y);
    let x = a.x; let y = a.y;
    out.push(idx(x, y));
    if (horiz) { while (x !== b.x) { x += sx; out.push(idx(x, y)); } while (y !== b.y) { y += sy; out.push(idx(x, y)); } }
    else { while (y !== b.y) { y += sy; out.push(idx(x, y)); } while (x !== b.x) { x += sx; out.push(idx(x, y)); } }
    return out;
  }

  planFor(g) {
    const s = this.s; const t = this.tool;
    if (LINE_TOOLS.has(t)) return S.planLine(s, t, this.lineTiles(g.a, g.b));
    const tiles = this.rectTiles(g.a, g.b);
    return tiles.map((i) => ({ i, ok: this.rectOk(t, i) }));
  }

  rectOk(t, i) {
    const s = this.s;
    switch (t) {
      case 'chop': return s.plant[i] === P.TREE || s.plant[i] === P.PINE;
      case 'mine': return s.ter[i] === T.ROCK || s.ter[i] === T.ORE;
      case 'harvest': return s.plant[i] === P.BUSH || s.plant[i] === P.HERB;
      case 'hunt': return s.mobs.some((m) => m.kind === 'animal' && !m.dead && m.at === i);
      case 'cancel': return !!s.des[i] || (Wd.bAt(s, i) && !Wd.bAt(s, i).done) || s.mobs.some((m) => m.hunt && m.at === i);
      case 'remove': return !!Wd.bAt(s, i)?.done;
      case 'stock': case 'farm': return S.zoneOk(s, t, i);
      case 'clear': return s.zone[i] !== Z.NONE;
      default: return false;
    }
  }

  drawPreview() {
    const g = this.gest; if (!g) return;
    const plan = this.planFor(g);
    const pg = this.preview;
    pg.clear();
    const red = ['cancel', 'remove', 'clear'].includes(this.tool);
    const col = red ? 0xa13d3b : this.tool === 'stock' ? 0xe3d245 : this.tool === 'farm' ? 0x6c8c50 : 0xf9f5ef;
    let n = 0;
    for (const t of plan) {
      if (t.ok) n++;
      pg.fillStyle(t.ok ? col : 0x404040, t.ok ? 0.45 : 0.2).fillRect(tx(t.i) * TILE, ty(t.i) * TILE, TILE, TILE);
    }
    if (RECT_TOOLS.has(this.tool)) {
      const x0 = Math.min(g.a.x, g.b.x); const y0 = Math.min(g.a.y, g.b.y);
      pg.lineStyle(2 / this.zoom, 0xf9f5ef, 0.9).strokeRect(x0 * TILE, y0 * TILE, (Math.abs(g.a.x - g.b.x) + 1) * TILE, (Math.abs(g.a.y - g.b.y) + 1) * TILE);
    }
    const name = this.toolName();
    this.setInfo(`${name}: ${n} tile${n === 1 ? '' : 's'}${LINE_TOOLS.has(this.tool) ? ` (${n * 3} ${this.tool === 'wall' ? 'wood' : 'stone'})` : ''}. Lift your finger to confirm.`);
  }

  commitDraw(g) {
    const s = this.s; const t = this.tool;
    this.preview.clear();
    let n = 0;
    if (LINE_TOOLS.has(t)) n = S.buildLine(s, t, this.lineTiles(g.a, g.b)).n;
    else {
      const tiles = this.rectTiles(g.a, g.b);
      if (t === 'stock' || t === 'farm' || t === 'clear') n = S.zone(s, t, tiles);
      else n = S.designate(s, t, tiles);
    }
    if (n) {
      sfx(t === 'cancel' || t === 'remove' || t === 'clear' ? 'thud' : 'place');
      this.afterChange();
      this.setInfo(`${this.toolName()}: ${n} tile${n === 1 ? '' : 's'} done. Drag again, or tap Done.`);
      this.tutorialCheck();
    } else {
      sfx('error');
      this.setInfo(`Nothing there for ${this.toolName().toLowerCase()}. ${this.toolHint()}`);
    }
  }

  showGhost(t) {
    const i = idx(t.x, t.y);
    const c = Wd.canPlace(this.s, this.tool, i);
    this.preview.clear().fillStyle(c.ok ? 0x6c8c50 : 0xa13d3b, 0.55).fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    this.preview.lineStyle(1 / this.zoom * 2, 0xf9f5ef, 0.9).strokeRect(t.x * TILE, t.y * TILE, TILE, TILE);
    this.setInfo(c.ok ? `${BUILDS[this.tool].name} (${costText(this.tool)}). Lift to place, drag to move the map.` : `${BUILDS[this.tool].name}: ${c.reason}`);
  }

  // ================================================================ selection

  select(id) {
    if (id == null) { this.selected = null; this.selTile = null; this.followId = null; return; }
    const m = this.s.mobs.find((x) => x.id === id);
    if (!m) return;
    this.selected = id; this.selTile = null;
    if (m.kind === 'settler') {
      PN.showSettler(this, id);
      if (!this.inViewWorld(m)) this.centerOn(m.x * TILE, m.y * TILE);
    } else PN.showCreature(this, id);
  }

  inViewWorld(m) {
    const sx = this.world.x + m.x * TILE * this.zoom; const sy = this.world.y + m.y * TILE * this.zoom;
    return sx > 20 && sx < WIDTH - 20 && sy > VIEW.y + 20 && sy < VIEW.y + VIEW.h * 0.45;
  }

  // ================================================================ HUD

  buildHud() {
    const d = (o, z = 51) => o.setDepth(z);
    const bg = d(this.add.graphics(), 50);
    bg.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, VIEW.y);
    bg.fillStyle(0x2a2330).fillRect(0, 58, WIDTH, VIEW.y - 58);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, 57, WIDTH, 2).fillRect(0, VIEW.y - 2, WIDTH, 2);
    bg.fillStyle(0x2a2330).fillRect(0, INFO_Y, WIDTH, BAR_Y - INFO_Y);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, INFO_Y, WIDTH, 2);
    bg.fillStyle(hex(PALETTE.night)).fillRect(0, BAR_Y, WIDTH, HEIGHT - BAR_Y);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, BAR_Y, WIDTH, 2);
    for (const [y, h] of [[0, VIEW.y], [INFO_Y, HEIGHT - INFO_Y]]) d(this.add.zone(0, y, WIDTH, h).setOrigin(0).setInteractive(), 49);

    d(button(this, 22, 17, 40, 36, '<', () => this.toTitle(), { size: 32, fill: PALETTE.cream }));
    this.dateText = d(text(this, 48, 17, '', { origin: [0, 0.5], color: PALETTE.cream }));
    const dz = d(this.add.zone(44, 0, 104, 34).setOrigin(0).setInteractive({ useHandCursor: true }));
    dz.on('pointerup', () => { if (!PN.blocking()) { sfx('tap'); PN.showMenu(this); } });
    this.speedBtns = SPEEDS.map((v, k) => d(button(this, 170 + k * 42, 17, 40, 36, ['||', '1x', '3x', '8x'][k], () => this.setSpeed(k), { fill: PALETTE.lavender })));
    d(button(this, 338, 17, 40, 36, '?', () => this.howTo(), { size: 32, fill: PALETTE.gold }));
    // Row 2: clock and temperature, then the stock.
    this.clockText = d(text(this, 6, 45, '', { origin: [0, 0.5], color: PALETTE.lavender }));
    this.res = ['meal', 'wood', 'stone', 'metal', 'medicine'].map((k, j) => {
      const x = 128 + j * 47;
      d(this.add.image(x, 45, 'co', `i:${k}`).setScale(2));
      return { k, t: d(text(this, x + 9, 45, '', { origin: [0, 0.5], color: PALETTE.cream })) };
    });
    const rz = d(this.add.zone(118, 34, WIDTH - 118, 24).setOrigin(0).setInteractive({ useHandCursor: true }));
    rz.on('pointerup', () => { if (!PN.blocking()) { sfx('tap'); PN.showStock(this); } });
    // Settler faces
    this.faces = [];
    for (let k = 0; k < 9; k++) {
      const x = 2 + k * 40 + 19; const y = 78;
      const c = d(this.add.container(x, y));
      const bgr = this.add.rectangle(0, 0, 38, 36, hex(PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
      const img = this.add.image(0, -2, 'co', 'c1:p').setScale(3);
      const mood = this.add.rectangle(-16, 15, 32, 3, 0x6c8c50).setOrigin(0, 0.5);
      const tag = this.add.image(12, -10, 'co', 'm:alert').setScale(1.5).setVisible(false);
      const more = text(this, 0, 0, '', { color: PALETTE.gold });
      c.add([bgr, img, mood, tag, more]);
      c.setSize(40, 40).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => { if (PN.blocking()) return; sfx('tap'); if (c.more) PN.showSettlers(this); else if (c.mid != null) { this.followId = null; this.select(c.mid); const m = this.s.mobs.find((x) => x.id === c.mid); if (m) this.centerOn(m.x * TILE, m.y * TILE); } });
      Object.assign(c, { bgr, img, mood, tag, moreT: more });
      this.faces.push(c);
    }
    // Info line and Done button
    this.infoText = d(text(this, 8, INFO_Y + 19, '', { origin: [0, 0.5], color: PALETTE.cream, wrap: 268, align: 'left' }));
    this.infoText.setLineSpacing(0);
    this.doneBtn = d(button(this, 318, INFO_Y + 17, 76, 36, 'Done', () => this.selectTool('look'), { fill: PALETTE.gold })).setVisible(false);
    // Toolbar
    this.catBtns = CATS.map((c, k) => this.makeCat(c, k));
    this.tray = this.add.container(0, 0).setDepth(60).setVisible(false);
    // Raid bar
    this.raidBar = this.add.container(0, 0).setDepth(56).setVisible(false);
    const rb = this.add.rectangle(4, VIEW.y + 2, WIDTH - 8, 46, hex(PALETTE.wine), 0.95).setOrigin(0).setStrokeStyle(2, hex(PALETTE.red));
    this.raidText = text(this, 12, VIEW.y + 26, 'Raid!', { origin: [0, 0.5], color: PALETTE.cream });
    this.fightBtn = button(this, 222, VIEW.y + 24, 76, 36, 'Fight', () => this.setAlert('fight'), { fill: PALETTE.gold });
    this.hideBtn = button(this, 306, VIEW.y + 24, 84, 36, 'Cover', () => this.setAlert('hide'), { fill: PALETTE.cream });
    rb.setInteractive();
    this.raidBar.add([rb, this.raidText, this.fightBtn, this.hideBtn]);
    this.raidBar.hit = new Phaser.Geom.Rectangle(4, VIEW.y + 4, WIDTH - 8, 44);
    // Tutorial banner
    this.banner = this.add.container(0, 0).setDepth(57).setVisible(false);
    this.bannerBg = this.add.rectangle(4, VIEW.y + 4, WIDTH - 8, 84, hex(PALETTE.ink), 0.9).setOrigin(0).setStrokeStyle(2, hex(PALETTE.gold));
    this.bannerBg.setInteractive();
    this.bannerText = text(this, 12, VIEW.y + 10, '', { origin: 0, color: PALETTE.cream, wrap: 262, align: 'left' });
    this.bannerStep = text(this, WIDTH - 42, VIEW.y + 20, '', { color: PALETTE.lavender });
    this.bannerBtn = button(this, WIDTH - 42, VIEW.y + 62, 64, 36, 'Skip', () => this.tutorialButton(), { fill: PALETTE.cream });
    this.banner.add([this.bannerBg, this.bannerText, this.bannerStep, this.bannerBtn]);
    this.pauseTag = d(text(this, WIDTH / 2, VIEW.y + VIEW.h - 16, 'PAUSED', { color: PALETTE.gold }), 55).setVisible(false);
    this.selectTool('look', true);
    this.updateTutorial();
  }

  makeCat(c, k) {
    const w = WIDTH / CATS.length;
    const cont = this.add.container(k * w + w / 2, BAR_Y + 31).setDepth(51);
    const bg = this.add.rectangle(0, 0, w - 2, 56, hex(PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
    const ic = this.add.image(0, -9, c.icon === 'sel' || c.icon === 'menu' || c.icon === 'zstock' ? c.icon : 'co', c.icon === 'sel' || c.icon === 'menu' || c.icon === 'zstock' ? undefined : c.icon).setScale(c.icon === 'sel' ? 2 : 3);
    const lbl = text(this, 0, 16, c.label, { color: PALETTE.cream });
    cont.add([bg, ic, lbl]);
    cont.setSize(w, 60).setInteractive({ useHandCursor: true });
    let down = false;
    cont.on('pointerdown', () => { down = true; ic.y = -7; });
    cont.on('pointerout', () => { down = false; ic.y = -9; });
    cont.on('pointerup', () => { ic.y = -9; if (!down || PN.blocking()) return; down = false; this.tapCat(c.id); });
    cont.bg = bg; cont.cat = c.id; cont.lbl = lbl;
    return cont;
  }

  tapCat(id) {
    sfx('tap');
    if (id === 'look') { this.closeTray(); this.selectTool('look'); return; }
    if (id === 'craft') { this.closeTray(); PN.showCraft(this); return; }
    if (id === 'menu') { this.closeTray(); PN.showMenu(this); return; }
    if (this.trayOpen === id) { this.closeTray(); return; }
    this.openTray(id);
  }

  openTray(cat) {
    const t = this.tray;
    t.removeAll(true);
    const items = TRAYS[cat];
    const perRow = 5; const iw = 66; const ih = 62;
    const rows = Math.ceil(items.length / perRow);
    const h = rows * ih + 10;
    const y0 = INFO_Y - h;
    const bg = this.add.rectangle(0, y0, WIDTH, h, hex(PALETTE.night), 0.97).setOrigin(0).setStrokeStyle(2, hex(PALETTE.ink));
    bg.setInteractive();
    t.add(bg);
    items.forEach((it, k) => {
      const col = k % perRow; const row = Math.floor(k / perRow);
      const n = Math.min(perRow, items.length - row * perRow);
      const x = (WIDTH - n * iw) / 2 + col * iw + iw / 2;
      const y = y0 + 5 + row * ih + ih / 2;
      t.add(this.makeTrayItem(it, x, y, iw - 4, ih - 4));
    });
    t.setVisible(true);
    this.trayOpen = cat;
    this.trayRect = new Phaser.Geom.Rectangle(0, y0, WIDTH, h);
    this.refreshToolbar();
    this.updateTutorial();
  }

  closeTray() {
    if (!this.trayOpen) return;
    this.tray.setVisible(false);
    this.trayOpen = null;
    this.refreshToolbar();
    this.updateTutorial();
  }

  makeTrayItem(it, x, y, w, h) {
    const cont = this.add.container(x, y);
    const sel = this.tool === it.id;
    const locked = BUILDS[it.id]?.req && !Wd.builtOf(this.s, BUILDS[it.id].req).length;
    const bg = this.add.rectangle(0, 0, w, h, hex(sel ? PALETTE.gold : PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
    const own = it.icon === 'zstock';
    const ic = this.add.image(0, -9, own ? 'zstock' : 'co', own ? undefined : it.icon).setScale(3).setAlpha(locked ? 0.4 : 1);
    const lbl = text(this, 0, h / 2 - 11, it.label, { color: sel ? PALETTE.night : locked ? PALETTE.lavender : PALETTE.cream });
    cont.add([bg, ic, lbl]);
    cont.setSize(w, h).setInteractive({ useHandCursor: true });
    let down = false;
    cont.on('pointerdown', () => { down = true; cont.y = y + 2; });
    cont.on('pointerout', () => { down = false; cont.y = y; });
    cont.on('pointerup', () => {
      cont.y = y;
      if (!down || PN.blocking()) return;
      down = false;
      if (locked) { sfx('error'); this.toast(`Build a ${BUILDS[BUILDS[it.id].req].name.toLowerCase()} first.`); return; }
      sfx('select');
      this.selectTool(it.id);
      this.closeTray();
    });
    return cont;
  }

  toolName() {
    const t = this.tool;
    if (BUILDS[t]) return BUILDS[t].name;
    return { chop: 'Chop', mine: 'Mine', harvest: 'Pick', hunt: 'Hunt', cancel: 'Cancel', remove: 'Remove', stock: 'Stockpile', farm: 'Farm', clear: 'Clear zones' }[t] || 'Look';
  }

  toolHint() {
    const t = this.tool;
    if (t === 'look') return 'Tap a settler, animal or tile to see it. Drag to move, pinch to zoom.';
    for (const list of Object.values(TRAYS)) { const it = list.find((x) => x.id === t); if (it?.hint) return `${it.hint} Two fingers move the map.`; }
    if (LINE_TOOLS.has(t)) return `${BUILDS[t].name}: drag to draw a line (${costText(t)} each). Two fingers move the map.`;
    if (BUILDS[t]) return `${BUILDS[t].name} (${costText(t)}): tap a spot. ${BUILDS[t].desc}`;
    return '';
  }

  selectTool(tool, quiet = false) {
    if (!quiet && isDrag(tool) && !store.get('tipPan')) { store.set('tipPan', true); this.toast('One finger marks. Use two fingers to move the map.'); }
    this.tool = tool;
    this.preview.clear();
    this.doneBtn?.setVisible(tool !== 'look');
    if (this.infoText) this.infoText.setWordWrapWidth(tool !== 'look' ? 268 : 344);
    this.setInfo(this.toolHint());
    this.refreshToolbar();
    if (tool !== 'look') { this.select(null); PN.closeKind('info'); }
  }

  refreshToolbar() {
    if (!this.catBtns) return;
    const toolCat = this.tool === 'look' ? 'look' : Object.entries(TRAYS).find(([, l]) => l.some((x) => x.id === this.tool))?.[0];
    for (const c of this.catBtns) {
      const on = this.trayOpen ? c.cat === this.trayOpen : c.cat === toolCat;
      c.bg.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      c.lbl.setColor(on ? PALETTE.night : PALETTE.cream);
    }
  }

  setInfo(msg) { if (this.infoText) this.infoText.setText(msg); }

  setSpeed(k) {
    this.speed = k;
    this.refreshHud(true);
  }

  setAlert(a) {
    if (!Wd.hostiles(this.s).length) return;
    S.setAlert(this.s, a);
    sfx(a === 'fight' ? 'power' : 'select');
    this.refreshHud(true);
  }

  refreshHud(force = false) {
    const s = this.s;
    const se = Wd.season(s);
    this.dateText.setText(`${se.name} ${Wd.dayInSeason(s)}, Y${Wd.yearOf(s)}`);
    this.clockText.setText(`${Wd.clock(s)} ${Math.round(Wd.outdoorTemp(s))}°C`);
    const st = Wd.stock(s);
    for (const p of Wd.settlers(s)) if (p.carry) st[p.carry.k] = (st[p.carry.k] || 0) + p.carry.n;
    for (const r of this.res) {
      const v = r.k === 'meal' ? ['meal', 'berries', 'meat', 'crop'].reduce((a, k) => a + (st[k] || 0), 0) : st[r.k] || 0;
      r.t.setText(v > 999 ? `${Math.floor(v / 1000)}k` : String(v));
      r.t.setColor(r.k === 'meal' && v < Wd.settlers(s).length * 3 ? '#f3b0a8' : PALETTE.cream);
    }
    const paused = this.speed === 0 || this.holds.size > 0;
    this.speedBtns.forEach((b, k) => { b.body.setFillStyle(hex(k === this.speed ? PALETTE.gold : PALETTE.lavender)); });
    this.pauseTag.setVisible(paused && !s.result);
    // Faces
    const ps = Wd.settlers(s);
    const shown = ps.length > 9 ? ps.slice(0, 8) : ps;
    this.faces.forEach((c, k) => {
      const p = shown[k];
      c.more = false;
      if (p) {
        c.setVisible(true); c.mid = p.id;
        c.img.setVisible(true).setFrame(`c${p.look}:p`);
        c.moreT.setText('');
        c.mood.setVisible(true).setScale(Math.max(0.05, p.mood), 1).setFillStyle(p.mood < 0.25 ? 0xa13d3b : p.mood < 0.45 ? 0xd88038 : 0x6c8c50);
        const tag = p.downed ? 'm:alert' : p.brk ? 'm:stuck' : p.sick ? 'm:sick' : p.food < 0.2 ? 'i:meal' : p.cold > 0.4 ? 'i:parka' : null;
        c.tag.setVisible(!!tag); if (tag) c.tag.setFrame(tag);
        c.bgr.setFillStyle(hex(this.selected === p.id ? PALETTE.gold : PALETTE.indigo));
      } else if (k === 8 && ps.length > 9) {
        c.setVisible(true); c.more = true; c.mid = null;
        c.img.setVisible(false); c.mood.setVisible(false); c.tag.setVisible(false);
        c.moreT.setText(`+${ps.length - 8}`);
        c.bgr.setFillStyle(hex(PALETTE.indigo));
      } else c.setVisible(false);
    });
    // Raid bar
    const hs = Wd.hostiles(s);
    const raid = hs.length > 0 && !s.pending;
    this.raidBar.setVisible(raid);
    if (raid) {
      const raiders = hs.filter((m) => m.kind === 'raider').length;
      this.raidText.setText(raiders ? `${raiders} raider${raiders === 1 ? '' : 's'}!` : `${hs.length} wolves!`);
      this.fightBtn.body.setFillStyle(hex(s.alert === 'fight' ? PALETTE.gold : PALETTE.lavender));
      this.hideBtn.body.setFillStyle(hex(s.alert === 'hide' ? PALETTE.gold : PALETTE.lavender));
    }
    this.banner.setVisible(this.tutShown >= 0 && !raid && !this.trayOpen);
  }

  // ================================================================ toasts

  toast(msg, at = null, color = PALETTE.cream) {
    if (this.toasts.some((t) => t.msg === msg)) return;
    const y = VIEW.y + VIEW.h - 30 - this.toasts.length * 40;
    const c = this.add.container(0, 0).setDepth(58);
    const t = text(this, WIDTH / 2, y, msg, { color, wrap: 320 });
    const bg = this.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 8, t.width + 20), t.height + 10, hex(PALETTE.ink), 0.88).setStrokeStyle(2, hex(PALETTE.lavender));
    c.add([bg, t]);
    const item = { c, bg, msg, at };
    if (at != null) { bg.setInteractive({ useHandCursor: true }); bg.on('pointerup', () => { if (!PN.blocking()) this.jumpTo(at); }); }
    this.toasts.push(item);
    while (this.toasts.length > 3) this.dropToast(this.toasts[0]);
    this.time.delayedCall(3200, () => this.dropToast(item));
  }
  dropToast(item) {
    if (!this.toasts.includes(item)) return;
    this.toasts = this.toasts.filter((t) => t !== item);
    item.c.destroy();
    this.toasts.forEach((t, k) => { const y = VIEW.y + VIEW.h - 30 - k * 40; t.c.list.forEach((o) => { o.y = y; }); });
  }

  // ================================================================ the loop

  hold(k) { this.holds.add(k); this.refreshHud(true); }
  release(k) { this.holds.delete(k); this.refreshHud(true); }

  update(time, delta) {
    if (this.leaving) return;
    const s = this.s;
    const paused = this.speed === 0 || this.holds.size > 0 || s.pending || s.result;
    if (!paused) {
      this.acc += Math.min(delta, 250) * SPEEDS[this.speed];
      let n = 0;
      while (this.acc >= TICK_MS && n < 40) {
        S.tick(s); this.acc -= TICK_MS; n++;
        if (s.pending || s.result) { this.acc = 0; break; }
      }
      if (n >= 40) this.acc = 0;
    } else this.acc = 0;
    this.handleNotes();
    const se = Wd.season(s).id;
    if (se !== this.season) { this.season = se; Wd.markAll(s); this.syncMusic(); }
    this.redrawDirty();
    this.night.setAlpha(this.darkness());
    this.syncSprites(time);
    this.syncFires(time);
    if (!this.hudAt || time - this.hudAt > 250) { this.hudAt = time; this.refreshHud(); this.tutorialCheck(); }
    const h = Math.floor(s.t / TPH);
    if (h !== this.lastHour) { this.lastHour = h; if (time - this.lastSave > 5000) this.save(); }
    if (s.pending && !s.result && !PN.isOpen('event')) this.openEvent();
  }

  openEvent() {
    if (!this.s.pending || PN.isOpen('event')) return;
    this.closeTray();
    this.gest = null; this.ptrs.clear(); this.preview.clear();
    PN.showEvent(this);
  }

  resolveEvent(choice) {
    const kind = this.s.pending?.kind;
    S.resolve(this.s, choice);
    if (kind === 'raid' || kind === 'wolves') { this.syncMusic(); this.toast(choice === 'fight' ? 'Fighters, go! Use the bar at the top to change your mind.' : 'Everyone take cover!'); }
    this.save(true);
    this.refreshHud(true);
  }

  /** Effects at high speed would machine-gun: each sound plays at most every 120 ms. */
  sfxT(name) {
    const now = this.time.now;
    this.sfxAt = this.sfxAt || {};
    if (now - (this.sfxAt[name] || 0) < 120) return;
    this.sfxAt[name] = now;
    sfx(name);
  }

  handleNotes() {
    const r = Wd.rt(this.s);
    if (!r.notes.length) return;
    const notes = r.notes.splice(0);
    const s = this.s;
    for (const n of notes) {
      switch (n.type) {
        case 'log':
          if (n.kind === 'bad') this.toast(n.text, n.at, '#f3b0a8');
          else if (n.kind === 'good' && /joined|friends|Contact|ship|raid is over|hunted|made/.test(n.text)) this.toast(n.text, n.at, '#c9e6a8');
          break;
        case 'toast': this.toast(n.text); break;
        case 'sfx': this.sfxT(n.name); break;
        case 'shot': this.shot(n); this.sfxT('shoot'); break;
        case 'swing': break;
        case 'bash': this.sfxT('thud'); break;
        case 'built': this.puff(n.i); this.sfxT('place'); if (n.k === 'bed') this.checkBeds(); break;
        case 'cooked': give('hot-meal'); stat('meals', n.n); break;
        case 'harvest': give('harvest'); break;
        case 'crafted': if (n.k === 'spear' || n.k === 'bow') give('armed'); sfx('coin'); break;
        case 'fireOut': give('firefighter'); break;
        case 'raidWon': give('repelled'); stat('raids'); break;
        case 'winterOver': give('winter'); break;
        case 'joined': if (Wd.settlers(s).length >= 8) give('crowd'); sfx('win'); break;
        case 'bestFriends': give('best-friends'); break;
        case 'year': if (n.n >= 1) give('year'); break;
        case 'day': if (n.day >= 2) give('first-night'); stat('days'); this.save(); break;
        case 'season': this.toast(`${Wd.season(s).name} has arrived.`); if (s.mode !== 'daily' && !s.stats.deaths) adapt(s.mode, 'season'); break;
        case 'death': sfx('lose'); break;
        case 'adapt': if (n.kind !== 'win' && n.kind !== 'lose') adapt(s.mode, n.kind); break;
        case 'music': this.syncMusic(); break;
        case 'radioCalled': sfx('power'); break;
        case 'popup': break;
        case 'end': this.finish(); break;
        default: break;
      }
    }
  }

  checkBeds() {
    const beds = Wd.builtOf(this.s, 'bed').length;
    const pop = Wd.settlers(this.s).length;
    if (pop >= 3 && beds >= pop) give('roof');
  }

  finish() {
    const s = this.s; const r = s.result;
    if (!r || this.resultShown) return;
    sfx(r.won ? 'win' : 'lose');
    playMusic(r.won ? 'calm' : null);
    if (s.mode !== 'daily') adapt(s.mode, r.won ? 'win' : 'lose');
    if (r.won && s.mode !== 'daily') {
      give(r.how === 'rescued' ? 'rescued' : 'survivor');
      if (!s.stats.deaths && s.mode !== 'peaceful') give('ironman');
    }
    let extra = '';
    if (s.mode === 'daily') {
      give('daily');
      const d = finishDaily(r.score);
      extra = `<p class="co-p" style="margin-top:8px">${d.isBest ? 'A new best for today!' : `Today's best: ${d.best}.`} Daily streak: ${d.streak} day${d.streak === 1 ? '' : 's'}.</p>`;
    }
    this.resultExtra = extra;
    this.save(true);
    this.showEnd();
  }

  showEnd() {
    this.resultShown = true;
    this.speed = 0;
    PN.showResult(this, this.s.result, this.resultExtra || '');
  }

  syncMusic() {
    if (!musicOn()) { playMusic(null); return; }
    const s = this.s;
    const want = Wd.hostiles(s).length ? 'danger' : Wd.season(s).id === 'wi' ? 'winter' : 'calm';
    if (currentMusic() !== want) playMusic(want);
  }

  afterChange() {
    Wd.roomsChanged(this.s);
    this.redrawDirty();
    this.refreshHud(true);
    this.save();
  }

  save(force = false) {
    if (!force && this.time.now - this.lastSave < 1500) return;
    this.lastSave = this.time.now;
    try {
      const raw = this.s; // saved as JSON by the store (creature data is not enumerable)
      if (this.slot === 'daily') store.set('daily', { day: store.get('daily')?.day || todayKey(), run: raw });
      else store.set('run', raw);
    } catch (e) { console.warn('save failed', e); }
  }

  howTo() {
    if (PN.blocking()) return;
    this.hold('howto');
    showHowTo(RULES, () => this.release('howto'));
  }

  toTitle(force = false) {
    if (this.leaving) return;
    if (!force && PN.blocking() && !PN.anyOpen()) return;
    this.leaving = true;
    PN.closeAll();
    this.save(true);
    playMusic('calm');
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Title'));
  }

  // ================================================================ guided first minutes

  updateTutorial() {
    const s = this.s;
    if (s.tut == null || s.tut >= TUT.length) { this.tutShown = -1; this.banner?.setVisible(false); this.hilite?.destroy(); this.hilite = null; return; }
    const step = TUT[s.tut];
    this.tutShown = s.tut;
    this.bannerText.setText(step.text);
    this.bannerStep.setText(`${s.tut + 1}/${TUT.length}`);
    this.bannerBtn.setLabel(step.next ? (step.last ? 'OK' : 'Next') : 'Skip');
    const h = Math.max(70, this.bannerText.height + 20);
    this.bannerBg.height = h;
    this.banner.hit = new Phaser.Geom.Rectangle(4, VIEW.y + 4, WIDTH - 8, h);
    this.bannerBtn.y = VIEW.y + h - 24;
    // Point at the toolbar button to use.
    this.hilite?.destroy(); this.hilite = null;
    if (step.cat && !this.trayOpen) {
      const k = CATS.findIndex((c) => c.id === step.cat);
      const w = WIDTH / CATS.length;
      this.hilite = this.add.rectangle(k * w + w / 2, BAR_Y + 31, w - 2, 56).setStrokeStyle(3, hex(PALETTE.gold)).setDepth(59);
      this.tweens.add({ targets: this.hilite, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    }
    this.refreshHud(true);
  }

  tutorialCheck() {
    const s = this.s;
    if (s.tut == null || s.tut >= TUT.length) return;
    const step = TUT[s.tut];
    if (step.done && step.done(s)) { s.tut++; sfx('coin'); this.updateTutorial(); }
  }

  tutorialEvent(kind) {
    const s = this.s;
    if (s.tut == null || s.tut >= TUT.length) return;
    if (TUT[s.tut].event === kind) { s.tut++; this.updateTutorial(); }
  }

  tutorialButton() {
    const s = this.s;
    if (s.tut == null) return;
    const step = TUT[s.tut];
    if (step.next) { s.tut++; if (s.tut >= TUT.length) { s.tut = null; store.set('guided', true); } }
    else { s.tut = null; store.set('guided', true); this.toast('Guide skipped. How to play (?) has everything.'); }
    this.updateTutorial();
    this.save(true);
  }
}
