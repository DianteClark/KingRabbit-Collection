import Phaser from 'phaser';
import {
  PALETTE, hex, text, button, WIDTH, HEIGHT, DARK, go, setBackground, helpButton, backButton, modal,
  toast, outlined, creature, itemImage, overlayOpen, bar,
} from './common.js';
import * as G from '../logic/game.js';
import { MONSTERS, CLASSES, MAX_FUEL, TRAPS } from '../logic/data.js';
import { QUARTERS } from '../art.js';
import { save, saveRun, recordRun } from '../save.js';
import { getSkill, report } from '../adaptive.js';
import { playMusic, fx, musicOn, setMusicOn, syncVolume } from '../music.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { bagPanel, shopPanel, heroPanel, mapPanel, perkPanel, logPanel } from './panels.js';
import { DEBUG } from '../debug.js';
import { earn, stat, daily } from '../trophies.js';
import { hit, rep, down, hideWhilePad } from '../padkit.js';

const T = 32;             // tile size on screen (16px art at 2x)
const TOP = 52;           // top bar
const BOT = 468;          // bottom of the map view
const MSG_TOP = 426;      // message band
const VIEW_CY = Math.round((TOP + MSG_TOP) / 2);
const { W, H } = G;
const STEP_MS = 120;

const modeKey = (st) => (st.daily ? 'daily' : st.mode);

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  init(data) {
    this.st = data.run;
    this.fresh = !!data.fresh;
  }

  create() {
    setBackground(this, DARK.void);
    const st = this.st;
    this._overlays = 0;
    this.busy = false;
    this.walk = null;
    this.held = null;
    this.aim = null;
    this.ended = false;
    this.hintQueue = [];
    this.knownMons = new Set();

    this.world = this.add.container(0, 0).setDepth(0);
    if (this.textures.exists('dhmap')) this.textures.remove('dhmap');
    this.mapTex = this.textures.createCanvas('dhmap', W * 16, H * 16);
    this.lit = document.createElement('canvas');
    this.dim = document.createElement('canvas');
    for (const c of [this.lit, this.dim]) { c.width = W * 16; c.height = H * 16; }
    this.mapImg = this.add.image(0, 0, 'dhmap').setOrigin(0).setScale(2);
    this.objLayer = this.add.container(0, 0);
    this.monLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.pathLayer = this.add.container(0, 0);
    this.world.add([this.mapImg, this.pathLayer, this.objLayer, this.monLayer, this.fxLayer]);
    this.player = creature(this, 0, 0, CLASSES[st.cls].spr, 2);
    this.monLayer.add(this.player);
    this.monSprites = new Map();
    this.flameFrame = 0;

    this.buildHud();
    this.buildPad();
    // The map takes taps only where nothing else is (topOnly input), and only if the press began on it.
    const zone = this.add.zone(0, TOP, WIDTH, MSG_TOP - TOP).setOrigin(0).setInteractive().setDepth(1);
    zone.on('pointerdown', () => { this.zoneDown = true; });
    zone.on('pointerout', () => { this.zoneDown = false; });
    zone.on('pointerup', (p) => { if (this.zoneDown) this.onMapTap(p); this.zoneDown = false; });

    this.bake();
    this.placeActors(true);
    this.drawObjects();
    this.redraw();
    this.refreshHud();
    this.centerCamera(true);

    this.time.addEvent({ delay: 170, loop: true, callback: () => this.flicker() });
    this.input.keyboard?.on('keydown', (e) => this.onKey(e));
    // Controller: the gold menu frame only works inside popups; the scene reads the rest itself.
    this.padNav = 'modal';
    this.padModalDepth = 100;
    this.padStart = () => { if (!overlayOpen(this)) this.pauseMenu(); };
    this.events.on('update', () => this.padTick());
    // When a popup closes: ignore map taps for a moment (a double tap must not walk), then show
    // any level-up choice or tip that was waiting.
    this.events.on('overlayClosed', () => {
      this.quietUntil = this.time.now + 250;
      this.time.delayedCall(60, () => { if (this.st.levelUp) this.showPerks(); else this.nextHint(); });
    });
    this.events.once('shutdown', () => { this.stopWalk(); this.held = null; });
    playMusic(st.f.boss ? 'boss' : 'deep');

    if (DEBUG) {
      window.__dark.scene = this;
      window.__dark.st = st;
    }
    this.time.delayedCall(250, () => {
      this.firstHints();
      if (st.levelUp) this.showPerks();
    });
  }

  // ------------------------------------------------------------------ drawing the map

  /** Bake the lit and remembered versions of every floor cell. */
  bake() {
    const lc = this.lit.getContext('2d');
    const dc = this.dim.getContext('2d');
    lc.clearRect(0, 0, W * 16, H * 16);
    dc.clearRect(0, 0, W * 16, H * 16);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.bakeCell(x, y);
  }

  bakeCell(x, y) {
    const st = this.st;
    const c = G.tile(st, x, y);
    const srcL = this.textures.get('tiles').getSourceImage();
    const srcD = this.textures.get('tilesDim').getSourceImage();
    const lc = this.lit.getContext('2d');
    const dc = this.dim.getContext('2d');
    lc.clearRect(x * 16, y * 16, 16, 16);
    dc.clearRect(x * 16, y * 16, 16, 16);
    if (c === '#' || c === 'S') return;
    const wall = (ax, ay) => { const t = G.tile(st, ax, ay); return t === '#' || t === 'S'; };
    for (const [q, dx, dy] of [['TL', -1, -1], ['TR', 1, -1], ['BL', -1, 1], ['BR', 1, 1]]) {
      const v = wall(x + dx, y); const h = wall(x, y + dy); const d = wall(x + dx, y + dy);
      const kind = v && h ? 'both' : v ? 'v' : h ? 'h' : d ? 'post' : 'none';
      const [sx, sy] = QUARTERS[q][kind];
      const ox = x * 16 + (q[1] === 'L' ? 0 : 8); const oy = y * 16 + (q[0] === 'T' ? 0 : 8);
      lc.drawImage(srcL, sx, sy, 8, 8, ox, oy, 8, 8);
      dc.drawImage(srcD, sx, sy, 8, 8, ox, oy, 8, 8);
    }
    const obj = (name) => {
      const [sx, sy] = { ladder: [112, 0], crack: [0, 16], rubble: [32, 16], pebbles: [32, 80] }[name];
      lc.drawImage(srcL, sx, sy, 16, 16, x * 16, y * 16, 16, 16);
      dc.drawImage(srcD, sx, sy, 16, 16, x * 16, y * 16, 16, 16);
    };
    if (c === '>') obj('ladder');
    const deco = st.f.deco.find((d) => d.x === x && d.y === y);
    if (deco && c === '.') obj(['crack', 'rubble', 'pebbles'][deco.f]);
  }

  /** Compose the visible map: lit cells with torchlight falloff, remembered cells dim. */
  redraw(jitter = 1) {
    const st = this.st;
    const v = G.view(st);
    const ctx = this.mapTex.getContext();
    ctx.fillStyle = DARK.void;
    ctx.fillRect(0, 0, W * 16, H * 16);
    const R = v.R;
    const px = st.p.x + 0.5; const py = st.p.y + 0.5;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!st.f.seen[i]) continue;
        const c = st.f.t[i];
        if (c === '#' || c === 'S') continue;
        if (v.vis[i]) {
          ctx.drawImage(this.lit, x * 16, y * 16, 16, 16, x * 16, y * 16, 16, 16);
          // Light per 8px quarter, so the torch fades smoothly.
          for (let q = 0; q < 4; q++) {
            const qx = x + (q & 1 ? 0.75 : 0.25); const qy = y + (q & 2 ? 0.75 : 0.25);
            const d = Math.hypot(qx - px, qy - py);
            const torch = d <= R + 0.6 ? Math.max(0, 1 - 0.8 * (d / (R + 1)) ** 2) * jitter : 0;
            const L = Math.max(v.ambient[i], torch, 0.22);
            const a = Math.min(0.9, Math.round((0.06 + (1 - L) * 0.88) * 8) / 8);
            const sx = x * 16 + (q & 1 ? 8 : 0); const sy = y * 16 + (q & 2 ? 8 : 0);
            if (a > 0) { ctx.fillStyle = `rgba(8,7,13,${a})`; ctx.fillRect(sx, sy, 8, 8); }
            if (torch > 0.05) { ctx.fillStyle = `rgba(216,128,56,${(0.12 * torch).toFixed(3)})`; ctx.fillRect(sx, sy, 8, 8); }
          }
        } else {
          ctx.drawImage(this.dim, x * 16, y * 16, 16, 16, x * 16, y * 16, 16, 16);
        }
      }
    }
    this.mapTex.refresh();
  }

  flicker() {
    if (!this.st || this.st.over) return;
    this.flameFrame ^= 1;
    for (const f of this.flames || []) f.setTexture(`flame${this.flameFrame}`);
    if (this.walk || this.busy) return;
    this.redraw(0.94 + Math.random() * 0.1);
  }

  /** Doors, braziers, traps, items, the merchant: rebuilt every turn. */
  drawObjects() {
    const st = this.st;
    const v = G.view(st);
    this.objLayer.removeAll(true);
    this.flames = [];
    const seen = (x, y) => st.f.seen[y * W + x];
    const lit = (x, y) => v.vis[y * W + x];
    const put = (img, x, y) => { img.setPosition(x * T + 16, y * T + 16); if (!lit(x, y)) img.setTint(0x5a5288); this.objLayer.add(img); return img; };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = st.f.t[y * W + x];
        if ((c === '+' || c === "'") && seen(x, y)) put(this.add.image(0, 0, 'tiles', c === '+' ? 'o:door' : 'o:doorOpen').setScale(2), x, y);
      }
    }
    for (const t of st.f.traps) if (t.found && seen(t.x, t.y)) put(this.add.image(0, 0, `trap:${t.type}`).setScale(2), t.x, t.y);
    for (const it of st.f.items) {
      if (!seen(it.x, it.y)) continue;
      const img = put(itemImage(this, 0, 0, G.itemIcon(st, it.item), 2), it.x, it.y);
      if (!lit(it.x, it.y)) img.setTint(0x5a5288);
    }
    for (const b of st.f.braziers) {
      if (!seen(b.x, b.y)) continue;
      put(this.add.image(0, 0, 'tiles', 'o:urn').setScale(2), b.x, b.y);
      if (b.lit) {
        const f = this.add.image(b.x * T + 16, b.y * T + 2, `flame${this.flameFrame}`).setScale(2);
        this.objLayer.add(f);
        this.flames.push(f);
      }
    }
    const s = st.f.shop;
    if (s && seen(s.x, s.y)) {
      put(creature(this, 0, 0, [1, 4], 2), s.x, s.y);
      const sign = outlined(this, s.x * T + 16, s.y * T - 8, 'SHOP', { color: PALETTE.gold });
      if (!lit(s.x, s.y)) sign.setAlpha(0.5);
      this.objLayer.add(sign);
    }
  }

  /** Put monsters and the player where the run says (instant, or tweened). */
  placeActors(instant) {
    const st = this.st;
    const p = st.p;
    if (instant) this.player.setPosition(p.x * T + 16, p.y * T + 16);
    const alive = new Set();
    for (const m of st.mons) {
      alive.add(m.id);
      let s = this.monSprites.get(m.id);
      const k = MONSTERS[m.kind];
      if (!s) {
        s = this.add.container(m.x * T + 16, m.y * T + 16);
        s.img = m.kind === 'king' ? creature(this, 0, 0, 'king', 2).setOrigin(0.5, 0.75) : creature(this, 0, 0, k.spr, 2);
        s.hp = this.add.rectangle(-12, 15, 24, 3, hex(DARK.blood)).setOrigin(0, 0.5);
        s.zz = outlined(this, 10, -16, 'z', { color: PALETTE.lavender });
        s.add([s.img, s.hp, s.zz]);
        this.monLayer.add(s);
        this.monSprites.set(m.id, s);
        s.setPosition(m.x * T + 16, m.y * T + 16);
      }
      const seen = G.canSeeMon(st, m);
      s.setVisible(seen);
      if (m.disguised) s.img.setTexture('tiles', 'o:chest');
      else if (m.kind !== 'king') s.img.setTexture('cre', `c:${k.spr[0]},${k.spr[1]}`);
      const vis = G.view(st).vis[m.y * W + m.x];
      if (seen && !vis) s.img.setTint(0x9070c0); else s.img.clearTint();
      s.hp.setVisible(m.hp < m.maxHp && !m.disguised);
      s.hp.width = Math.max(1, Math.round(24 * m.hp / m.maxHp));
      s.zz.setVisible(m.st === 'sleep');
      if (instant) s.setPosition(m.x * T + 16, m.y * T + 16);
    }
    for (const [id, s] of this.monSprites) if (!alive.has(id) && !s.dying) { s.destroy(); this.monSprites.delete(id); }
    this.monLayer.bringToTop(this.player);
  }

  centerCamera(instant) {
    const st = this.st;
    const tx = Math.round(WIDTH / 2 - (st.p.x * T + 16));
    const ty = Math.round(VIEW_CY - (st.p.y * T + 16));
    this.tweens.killTweensOf(this.world);
    if (instant) this.world.setPosition(tx, ty);
    else this.tweens.add({ targets: this.world, x: tx, y: ty, duration: STEP_MS - 20 });
  }

  // ------------------------------------------------------------------ HUD

  buildHud() {
    const D = 50;
    this.add.rectangle(0, 0, WIDTH, TOP, hex(PALETTE.ink)).setOrigin(0).setDepth(D - 1);
    backButton(this, () => this.pauseMenu());
    this.hpBar = bar(this, 48, 5, 134, 21, DARK.blood, D);
    this.fuelBar = bar(this, 48, 28, 134, 21, DARK.flame, D);
    this.floorText = text(this, 190, 14, '', { origin: [0, 0.5], color: PALETTE.cream }).setDepth(D);
    this.lvlText = text(this, 312, 14, '', { origin: [1, 0.5], color: PALETTE.gold }).setDepth(D);
    this.xpBg = this.add.rectangle(190, 26, 122, 4, hex(DARK.navy)).setOrigin(0, 0.5).setDepth(D);
    this.xpFg = this.add.rectangle(190, 26, 0, 4, hex(PALETTE.gold)).setOrigin(0, 0.5).setDepth(D);
    this.add.image(198, 40, 'items', 'i:5,2').setDepth(D);
    this.goldText = text(this, 208, 40, '', { origin: [0, 0.5], color: PALETTE.gold }).setDepth(D);
    this.ammoText = text(this, 312, 40, '', { origin: [1, 0.5], color: PALETTE.lavender }).setDepth(D);
    helpButton(this, WIDTH - 22, 26);
    this.statusText = outlined(this, 8, TOP + 4, '', { origin: [0, 0], color: PALETTE.orange, wrap: WIDTH - 20, align: 'left' }).setDepth(D);

    // Message band (tap for the log).
    this.add.rectangle(0, MSG_TOP, WIDTH, BOT - MSG_TOP, hex(DARK.void), 0.82).setOrigin(0).setDepth(D - 1)
      .setInteractive().on('pointerup', () => { if (!overlayOpen(this)) logPanel(this, this.st); });
    this.msgOld = text(this, 8, MSG_TOP + 11, '', { origin: [0, 0.5], color: DARK.purple, align: 'left' }).setDepth(D);
    this.msgNew = text(this, 8, MSG_TOP + 31, '', { origin: [0, 0.5], color: PALETTE.cream, align: 'left' }).setDepth(D);
  }

  refreshHud() {
    const st = this.st;
    const p = st.p;
    const mx = G.maxHp(st);
    this.hpBar.set(p.hp / mx, `HP ${p.hp}/${mx}`, p.hp <= mx * 0.3 ? PALETTE.red : DARK.blood);
    const fuel = Math.round((p.fuel / MAX_FUEL) * 100);
    this.fuelBar.set(p.fuel / MAX_FUEL, `Torch ${fuel}%`, p.fuel <= MAX_FUEL * 0.25 ? '#8a5a30' : DARK.flame);
    this.floorText.setText(st.depth >= G.BOSS_DEPTH ? 'The Hall' : `Floor ${st.depth}`);
    this.lvlText.setText(`Lv ${p.lvl}`);
    this.xpFg.width = Math.round(122 * G.xpProgress(st));
    this.goldText.setText(String(p.gold));
    const bow = p.eq.ranged && (p.arrows > 0 || st.cls !== 'mage');
    this.ammoText.setText(bow ? `Arrows ${p.arrows}` : st.cls === 'mage' ? `MP ${p.mana}/${G.manaMax(st)}` : '');
    if (this.ammoText.width > 100) this.ammoText.setText(bow ? `${p.arrows}` : `MP ${p.mana}`);
    const tags = [];
    const h = G.hungerState(st);
    if (h) tags.push(h);
    if (p.fx.poison > 0) tags.push('Poisoned');
    if (p.fx.haste > 0) tags.push('Fast');
    if (p.fx.sight > 0) tags.push('Sight');
    if (p.fx.blaze > 0) tags.push('Blazing');
    if (p.fuel <= 0) tags.push('No light!');
    this.statusText.setText(tags.join('  '));
    if (this.statusText.width > WIDTH - 20) this.statusText.setText(tags.join(' '));
    // Messages: the newest one (colour by kind), and the one before if there's room.
    const log = st.log;
    const color = { good: '#9be36b', bad: PALETTE.orange, info: PALETTE.cream }[log[log.length - 1]?.c] || PALETTE.cream;
    const fit = (t, s) => {
      t.setText(s);
      if (t.width <= WIDTH - 16) return true;
      let n = s.length;
      while (n > 4 && t.width > WIDTH - 16) { n--; t.setText(`${s.slice(0, n).trimEnd()}...`); }
      return false;
    };
    const newest = log[log.length - 1]?.text || '';
    const prev = log[log.length - 2]?.text || '';
    this.msgNew.setColor(color);
    // A long newest message uses both lines.
    this.msgOld.setColor(DARK.purple);
    if (!fit(this.msgNew, newest)) {
      const words = newest.split(' ');
      let a = '';
      let k = 0;
      for (; k < words.length; k++) {
        this.msgOld.setText(`${a}${words[k]} `);
        if (this.msgOld.width > WIDTH - 16) break;
        a += `${words[k]} `;
      }
      this.msgOld.setText(a.trimEnd()).setColor(color);
      fit(this.msgNew, words.slice(k).join(' '));
    } else fit(this.msgOld, prev);
    // Context button.
    const onStairs = G.tile(st, p.x, p.y) === '>';
    const items = G.itemsAt(st, p.x, p.y).length > 0;
    this.ctxMode = onStairs ? 'descend' : items ? 'pickup' : 'search';
    this.ctxBtn.setLabel({ descend: 'Descend', pickup: 'Pick up', search: 'Search' }[this.ctxMode]);
    this.ctxBtn.body.setFillStyle(hex(onStairs ? PALETTE.gold : items ? PALETTE.sand : PALETTE.cream));
    const ra = G.rangedAttack(st);
    this.fireBtn.setAlpha(ra ? 1 : 0.5);
    const castNext = st.cls === 'mage' && !(p.eq.ranged && p.arrows > 0);
    this.fireBtn.setLabel(this.aim ? 'Cancel' : castNext ? 'Cast' : 'Fire');
  }

  buildPad() {
    const D = 50;
    this.add.rectangle(0, BOT, WIDTH, HEIGHT - BOT, hex(DARK.navy)).setOrigin(0).setDepth(D - 1);
    this.add.rectangle(0, BOT, WIDTH, 3, hex(PALETTE.ink)).setOrigin(0).setDepth(D - 1);
    const cx = 80; const cy = 556;
    const touchPad = [];
    const pad = [['up', cx, cy - 52, 0, -1], ['left', cx - 54, cy, -1, 0], ['right', cx + 54, cy, 1, 0], ['down', cx, cy + 52, 0, 1]];
    touchPad.push(this.add.rectangle(cx, cy, 52, 52, hex(DARK.blue)).setDepth(D));
    for (const [dir, x, y, dx, dy] of pad) {
      const c = this.add.container(x, y).setDepth(D + 1);
      const sh = this.add.rectangle(0, 3, 50, 48, hex(PALETTE.ink));
      const face = this.add.rectangle(0, 0, 50, 48, hex(PALETTE.lavender)).setStrokeStyle(3, hex(PALETTE.ink));
      const g = this.add.graphics();
      g.fillStyle(hex(PALETTE.night));
      // A chunky arrow pointing dir.
      const pts = { up: [[0, -10], [-10, 6], [10, 6]], down: [[0, 10], [-10, -6], [10, -6]], left: [[-10, 0], [6, -10], [6, 10]], right: [[10, 0], [-6, -10], [-6, 10]] }[dir];
      g.fillTriangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      c.add([sh, face, g]);
      c.setSize(52, 52).setInteractive({ useHandCursor: true });
      touchPad.push(c);
      c.on('pointerdown', () => { face.y = 2; g.y = 2; this.startHold(dx, dy); });
      const up = () => { face.y = 0; g.y = 0; if (this.held && this.held.dx === dx && this.held.dy === dy) this.held = null; };
      c.on('pointerup', up);
      c.on('pointerout', up);
    }
    touchPad.push(button(this, cx, cy, 50, 46, 'Wait', () => { if (this.canAct()) { this.stopWalk(); this.doAct({ type: 'wait' }); } }, { fill: DARK.purple, color: PALETTE.cream, silent: true }).setDepth(D + 1));
    // The arrow pad hides while a controller is in use (the action buttons stay: they show labels).
    hideWhilePad(this, touchPad);

    this.bagBtn = button(this, 212, 502, 94, 44, 'Bag', () => this.openBag(), { fill: PALETTE.cream }).setDepth(D);
    this.fireBtn = button(this, 310, 502, 94, 44, 'Fire', () => this.pressFire(), { fill: PALETTE.orange }).setDepth(D);
    this.ctxBtn = button(this, 212, 556, 94, 44, 'Search', () => this.pressContext(), { fill: PALETTE.cream }).setDepth(D);
    button(this, 310, 556, 94, 44, 'Rest', () => this.rest(), { fill: PALETTE.lavender }).setDepth(D);
    button(this, 212, 610, 94, 44, 'Map', () => { if (this.canAct(true)) mapPanel(this, this.st); }, { fill: PALETTE.lavender }).setDepth(D);
    button(this, 310, 610, 94, 44, 'Hero', () => { if (this.canAct(true)) heroPanel(this, this.st); }, { fill: PALETTE.lavender }).setDepth(D);
  }

  // ------------------------------------------------------------------ input

  canAct(menuOnly = false) {
    if (this.ended || this.st.over || overlayOpen(this) || this._leaving) return false;
    if (menuOnly) { this.stopWalk(); return true; }
    if (this.busy) return false;
    if (this.st.levelUp) { this.showPerks(); return false; }
    return true;
  }

  /**
   * Controller, once a frame: d-pad steps (repeating while held, but a held direction stops
   * when something needs attention, like walking does), A = pick up / descend here, else wait.
   * B = search, X = fire, Y = bag, L = rest, R = hero, Select = map, Start = pause menu.
   */
  padTick() {
    if (!this.st || this.ended || overlayOpen(this) || document.getElementById('howto')) return;
    const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
    if (this.padStop && !dirs.some(([n]) => down(n))) this.padStop = false;
    for (const [n, dx, dy] of dirs) {
      if (this.padStop || !rep(n, 260, STEP_MS + 50)) continue;
      const first = hit(n);
      if (!this.canAct()) break;
      this.stopWalk();
      this.cancelAim();
      const before = this.snapshot();
      const ok = this.doAct({ type: 'move', dx, dy });
      if (!first && (!ok || this.alarming(before))) this.padStop = true;
      if (first && this.alarming(before)) this.padStop = true;
      return;
    }
    if (hit('a')) {
      if (this.ctxMode === 'descend' || this.ctxMode === 'pickup') this.pressContext();
      else if (this.canAct()) { this.stopWalk(); this.doAct({ type: 'wait' }); }
    } else if (hit('b')) this.pressContext();
    else if (hit('x2')) this.pressFire();
    else if (hit('y2')) this.openBag();
    else if (hit('l')) this.rest();
    else if (hit('r')) { if (this.canAct(true)) heroPanel(this, this.st); } else if (hit('select')) { if (this.canAct(true)) mapPanel(this, this.st); }
  }

  onKey(e) {
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    if (dirs[e.key]) { this.stopWalk(); this.doAct({ type: 'move', dx: dirs[e.key][0], dy: dirs[e.key][1] }); return; }
    if (e.key === ' ' || e.key === '.') this.doAct({ type: 'wait' });
    if (e.key === 'f') this.pressFire();
    if (e.key === 'Enter') this.pressContext();
  }

  startHold(dx, dy) {
    if (this.walk) { this.stopWalk(); return; }
    if (!this.canAct()) return;
    this.cancelAim();
    this.held = { dx, dy };
    const go1 = () => {
      if (!this.held || this.held.dx !== dx || this.held.dy !== dy) return;
      if (this.busy) { this.time.delayedCall(30, go1); return; }
      const before = this.snapshot();
      const ok = this.doAct({ type: 'move', dx, dy });
      // Keep walking while held, unless something needs attention.
      if (!ok || this.alarming(before) || this.st.over) { this.held = null; return; }
      this.time.delayedCall(STEP_MS + 40, go1);
    };
    go1();
  }

  snapshot() {
    const st = this.st;
    return { hp: st.p.hp, mons: new Set(G.visibleMonsters(st).filter((m) => !m.disguised && m.st !== 'sleep').map((m) => m.id)), log: st.log.length, depth: st.depth, items: st.p.inv.length };
  }

  /** Did the last step bring something worth stopping for? */
  alarming(before) {
    const st = this.st;
    if (st.p.hp < before.hp || st.depth !== before.depth || st.levelUp) return true;
    const now = G.visibleMonsters(st).filter((m) => !m.disguised && m.st !== 'sleep');
    if (now.some((m) => !before.mons.has(m.id))) return true;
    if (st.log.slice(before.log).some((l) => l.c === 'bad' || /Stairs|secret|spot|find/.test(l.text))) return true;
    return false;
  }

  onMapTap(p) {
    if (this.time.now < (this.quietUntil || 0)) return;
    if (!this.canAct()) { if (this.walk) this.stopWalk(); return; }
    const st = this.st;
    const x = Math.floor((p.x - this.world.x) / T);
    const y = Math.floor((p.y - this.world.y) / T);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (this.walk) { this.stopWalk(); return; }
    const m = G.monAt(st, x, y);
    const visibleM = m && G.canSeeMon(st, m) ? m : null;
    if (this.aim) {
      if (visibleM && this.aim.ids.includes(visibleM.id)) { this.cancelAim(); this.doAct({ type: 'fire', target: visibleM.id }); } else this.cancelAim();
      return;
    }
    const dx = x - st.p.x; const dy = y - st.p.y;
    if (dx === 0 && dy === 0) { this.pressContext(); return; }
    if (Math.abs(dx) + Math.abs(dy) === 1) { this.doAct({ type: 'move', dx, dy }); return; }
    if (visibleM) { this.monsterCard(visibleM); return; }
    const path = G.pathTo(st, x, y) || G.pathTo(st, x, y, { ignoreMonsters: true });
    if (!path || !path.length) {
      toast(this, st.f.seen[y * W + x] ? 'You can\'t walk there.' : 'You haven\'t seen that place yet.', VIEW_CY - 60, PALETTE.lavender);
      return;
    }
    this.startWalk(path);
  }

  startWalk(path) {
    this.walk = { path: [...path] };
    this.pathLayer.removeAll(true);
    for (const [x, y] of path) this.pathLayer.add(this.add.image(x * T + 16, y * T + 16, 'dot').setScale(2).setAlpha(0.7));
    const stepOnce = () => {
      if (!this.walk || this.ended) return;
      if (this.busy) { this.walkTimer = this.time.delayedCall(30, stepOnce); return; }
      const next = this.walk.path.shift();
      if (!next) { this.stopWalk(); return; }
      const st = this.st;
      const dx = next[0] - st.p.x; const dy = next[1] - st.p.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) { this.stopWalk(); return; }
      const m = G.monAt(st, next[0], next[1]);
      if (m && G.canSeeMon(st, m) && this.walk.path.length) { this.stopWalk(); return; }
      const before = this.snapshot();
      const ok = this.doAct({ type: 'move', dx, dy });
      if (this.pathLayer.list[0]) this.pathLayer.list[0].destroy();
      if (!ok || this.alarming(before) || st.over || (st.p.x !== next[0] || st.p.y !== next[1])) { this.stopWalk(); return; }
      this.walkTimer = this.time.delayedCall(STEP_MS + 10, stepOnce);
    };
    stepOnce();
  }

  stopWalk() {
    this.walk = null;
    this.walkTimer?.remove();
    this.walkTimer = null;
    this.pathLayer?.removeAll(true);
  }

  rest() {
    if (this.walk) { this.stopWalk(); return; } // a second tap stops resting
    if (!this.canAct()) return;
    const st = this.st;
    if (G.danger(st)) { toast(this, 'Not with monsters about!', VIEW_CY - 60, PALETTE.orange); return; }
    const full = () => st.p.hp >= G.maxHp(st) && (st.cls !== 'mage' || st.p.mana >= G.manaMax(st));
    if (full()) { toast(this, 'You are already rested.', VIEW_CY - 60, PALETTE.lavender); return; }
    let n = 0;
    this.walk = { path: [] }; // reuse the walk lock so a tap stops resting
    const tick = () => {
      if (!this.walk || this.ended) return;
      if (this.busy) { this.walkTimer = this.time.delayedCall(30, tick); return; }
      const before = this.snapshot();
      const ok = this.doAct({ type: 'wait' }, { quiet: true });
      n++;
      if (!ok || this.alarming(before) || full() || n >= 40 || G.danger(st)) {
        this.stopWalk();
        if (full()) toast(this, 'You feel rested.', VIEW_CY - 60, '#9be36b');
        else if (n >= 40) toast(this, 'You rest a while.', VIEW_CY - 60, PALETTE.lavender);
        return;
      }
      this.walkTimer = this.time.delayedCall(60, tick);
    };
    tick();
  }

  pressContext() {
    if (this.walk) { this.stopWalk(); return; }
    if (!this.canAct()) return;
    this.cancelAim();
    if (this.ctxMode === 'descend') this.confirmDescend();
    else if (this.ctxMode === 'pickup') this.doAct({ type: 'pickup' });
    else this.doAct({ type: 'search' });
  }

  confirmDescend() {
    const st = this.st;
    const last = st.depth === G.BOSS_DEPTH - 1;
    const m = modal(this, last ? 'Go down to the hall?' : `Go down to floor ${st.depth + 1}?`, last ? 'The Hollow King waits below. There is no way back up.' : 'There is no way back up.', [
      ['Descend', () => { m.destroy(); this.descend(); }],
      ['Stay', () => m.destroy()],
    ]);
  }

  descend() {
    const st = this.st;
    report(modeKey(st), 'floor', st.p.hp / G.maxHp(st));
    st.skill = st.daily ? 0.5 : getSkill(modeKey(st));
    fx('stairs');
    this.busy = true;
    this.cameras.main.fadeOut(220, 8, 7, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const ev = G.act(st, { type: 'descend' });
      this.trophies(ev, new Map());
      for (const s of this.monSprites.values()) s.destroy();
      this.monSprites.clear();
      this.bake();
      this.placeActors(true);
      this.drawObjects();
      this.redraw();
      this.refreshHud();
      this.centerCamera(true);
      saveRun(st);
      playMusic(st.f.boss ? 'boss' : 'deep');
      this.cameras.main.fadeIn(260, 8, 7, 13);
      this.busy = false;
      this.floorHints();
      void ev;
    });
  }

  pressFire() {
    if (this.walk) { this.stopWalk(); return; }
    if (!this.canAct()) return;
    const st = this.st;
    if (this.aim) { this.cancelAim(); return; }
    const ra = G.rangedAttack(st);
    if (!ra) { toast(this, G.fireBlocked(st) || 'Nothing to shoot with.', VIEW_CY - 60, PALETTE.orange); return; }
    const ts = G.targets(st);
    if (!ts.length) { toast(this, 'No monster in range that you can see.', VIEW_CY - 60, PALETTE.lavender); return; }
    if (ts.length === 1) { this.doAct({ type: 'fire', target: ts[0].id }); return; }
    // Several: let the player pick (tap one), or tap Fire... again for the nearest.
    this.aim = { ids: ts.map((m) => m.id) };
    for (const m of ts) {
      const r = this.add.image(m.x * T + 16, m.y * T + 16, 'reticle').setScale(2);
      this.tweens.add({ targets: r, scale: 2.3, duration: 300, yoyo: true, repeat: -1 });
      this.fxLayer.add(r);
      (this.aim.marks ||= []).push(r);
    }
    toast(this, 'Tap a target to shoot it', VIEW_CY - 60, PALETTE.orange);
    this.refreshHud();
  }

  cancelAim() {
    if (!this.aim) return;
    for (const r of this.aim.marks || []) r.destroy();
    this.aim = null;
    this.refreshHud();
  }

  monsterCard(m) {
    const st = this.st;
    const inf = G.monsterInfo(st, m);
    const canShoot = G.targets(st).some((t) => t.id === m.id);
    const k = MONSTERS[m.kind];
    const body = m.disguised ? 'A closed chest. Walk into it to open it.' : `${inf.state}. HP ${inf.hp}/${inf.maxHp}.\n${inf.desc}`;
    const buttons = [];
    if (canShoot) buttons.push([G.rangedAttack(st).kind === 'fire' ? 'Cast Firebolt' : 'Shoot', (c) => { c.destroy(); this.doAct({ type: 'fire', target: m.id }); }, PALETTE.orange]);
    buttons.push(['Close', (c) => c.destroy(), PALETTE.lavender]);
    modal(this, inf.name, body, buttons, { art: { creature: m.disguised ? [3, 4] : m.kind === 'king' ? 'king' : k.spr, scale: m.kind === 'king' ? 2 : 4 } });
  }

  openBag() {
    if (!this.canAct(true)) return;
    bagPanel(this, this.st, { onAction: (a) => this.doAct(a) });
  }

  // ------------------------------------------------------------------ doing things

  /** Run one action, animate it and save. Returns true if anything happened. */
  doAct(a, { quiet = false } = {}) {
    if (a.type !== 'perk' && a.type !== 'buy' && a.type !== 'sell' && !this.canAct()) return false;
    const st = this.st;
    const turnBefore = st.turn;
    const hpBefore = st.p.hp;
    const kinds = new Map(st.mons.map((m) => [m.id, m.kind]));
    const ev = G.act(st, a);
    this.trophies(ev, kinds);
    const happened = st.turn !== turnBefore || ev.some((e) => ['shop', 'buy', 'sell'].includes(e.t)) || a.type === 'perk';
    this.animate(ev, quiet);
    if (st.turn !== turnBefore || a.type === 'buy' || a.type === 'sell' || a.type === 'perk') saveRun(st);
    if (ev.some((e) => e.t === 'shop')) this.openShop();
    if (st.p.hp < hpBefore) this.cameras.main.shake(90, 0.004);
    if (st.over) this.finish();
    else if (st.levelUp && a.type !== 'perk') this.time.delayedCall(300, () => this.showPerks());
    this.eventHints(ev);
    return happened;
  }

  animate(ev, quiet) {
    const st = this.st;
    this.busy = true;
    let longest = STEP_MS;
    let stepped = false;
    for (const e of ev) {
      const spr = e.id === 'p' ? this.player : this.monSprites.get(e.id);
      switch (e.t) {
        case 'move': {
          if (e.id === 'p') {
            stepped = true;
            if (e.x !== e.from[0]) this.player.setFlipX(e.x < e.from[0]);
            this.tweens.add({ targets: this.player, x: e.x * T + 16, y: e.y * T + 16, duration: STEP_MS - 20 });
          } else if (spr) {
            this.tweens.add({ targets: spr, x: e.x * T + 16, y: e.y * T + 16, duration: STEP_MS - 20 });
          }
          break;
        }
        case 'teleport': case 'blink':
          if (e.t === 'teleport') { this.tweens.killTweensOf(this.player); this.player.setPosition(e.x * T + 16, e.y * T + 16).setAlpha(0); this.tweens.add({ targets: this.player, alpha: 1, duration: 250 }); }
          if (spr) { spr.setPosition(e.x * T + 16, e.y * T + 16); spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: 1, duration: 250 }); }
          if (e.id === 'p' || e.t === 'teleport') fx('secret');
          break;
        case 'attack': {
          const src = e.id === 'p' ? this.player : spr;
          if (!src) break;
          const ox = src.x; const oy = src.y;
          const tx = e.x * T + 16; const ty = e.y * T + 16;
          this.tweens.add({ targets: src, x: ox + (tx - ox) * 0.35, y: oy + (ty - oy) * 0.35, duration: 60, yoyo: true });
          break;
        }
        case 'shot': {
          const img = this.add.image(e.fx * T + 16, e.fy * T + 16, e.kind === 'fire' ? 'bolt' : 'arrow').setScale(2);
          img.setRotation(Math.atan2(e.y - e.fy, e.x - e.fx));
          this.fxLayer.add(img);
          const d = Math.hypot(e.x - e.fx, e.y - e.fy) * 40;
          this.tweens.add({ targets: img, x: e.x * T + 16, y: e.y * T + 16, duration: d, onComplete: () => img.destroy() });
          longest = Math.max(longest, d + 40);
          fx('shoot');
          break;
        }
        case 'dmg': {
          const color = e.target === 'p' ? PALETTE.orange : e.crit ? PALETTE.gold : PALETTE.cream;
          this.floatText(e.x, e.y, String(e.n), color);
          const target = e.target === 'p' ? this.player : this.monSprites.get(e.target)?.img;
          if (target) { target.setTintFill(0xffffff); this.time.delayedCall(80, () => target.active && target.clearTint()); }
          fx(e.target === 'p' ? 'thud' : 'hit');
          break;
        }
        case 'miss': this.floatText(e.x, e.y, 'miss', PALETTE.lavender); break;
        case 'block': this.floatText(e.x, e.y, 'block', PALETTE.lavender); fx('bounce'); break;
        case 'die': {
          const s = this.monSprites.get(e.id);
          if (s) {
            s.dying = true;
            this.monSprites.delete(e.id);
            this.tweens.add({ targets: s, alpha: 0, scaleX: 1.4, scaleY: 0.2, duration: 220, onComplete: () => s.destroy() });
          }
          fx('capture');
          break;
        }
        case 'door': fx('door'); break;
        case 'brazier': fx('ignite'); break;
        case 'fuel': fx('ignite'); break;
        case 'pickup': fx(e.k === 'gold' ? 'coin' : 'select'); break;
        case 'secret': fx('secret'); this.bakeAround(e.x, e.y); break;
        case 'trapFound': fx('select'); break;
        case 'trap': fx('trap'); this.flash(0xa13d3b); break;
        case 'drink': fx('gulp'); break;
        case 'read': fx('scroll'); break;
        case 'eat': fx('place'); break;
        case 'equip': fx('place'); break;
        case 'level': fx('power'); this.floatText(st.p.x, st.p.y, 'Level up!', PALETTE.gold); break;
        case 'shriek': fx('shriek'); this.flash(0xe3bf8f); break;
        case 'snuff': fx('snuff'); this.flash(0x000000); break;
        case 'flash': fx('boom'); this.flash(0xf9f5ef); break;
        case 'mapped': this.bake(); break;
        case 'dawn': this.flash(0xf0d472); break;
        case 'reveal': fx('error'); break;
        case 'split': {
          const s = this.monSprites.get(e.id);
          if (s) s.setPosition(e.from[0] * T + 16, e.from[1] * T + 16);
          break;
        }
        case 'search': this.searchRipple(); break;
        default: break;
      }
    }
    if (stepped && !quiet) fx('step');
    // New sprites (split slimes, summons) appear where they are.
    this.placeActors(false);
    for (const e of ev) {
      if (e.t === 'move' && e.id !== 'p') {
        const s = this.monSprites.get(e.id);
        if (s && !s.dying) { this.tweens.killTweensOf(s); s.setPosition(e.from[0] * T + 16, e.from[1] * T + 16); this.tweens.add({ targets: s, x: e.x * T + 16, y: e.y * T + 16, duration: STEP_MS - 20 }); }
      }
      if (e.t === 'split') { const s = this.monSprites.get(e.id); if (s) this.tweens.add({ targets: s, x: e.x * T + 16, y: e.y * T + 16, duration: 120 }); }
    }
    this.drawObjects();
    this.redraw();
    this.refreshHud();
    this.centerCamera(false);
    this.time.delayedCall(quiet && longest === STEP_MS ? 50 : longest, () => { this.busy = false; });
  }

  bakeAround(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.bakeCell(x + dx, y + dy);
  }

  floatText(x, y, str, color) {
    // Several numbers on one spot in the same moment stack instead of overlapping.
    const key = `${x},${y}`;
    const now = this.time.now;
    this.floats = (this.floats || []).filter((f) => now - f.t < 300);
    const n = this.floats.filter((f) => f.k === key).length;
    this.floats.push({ k: key, t: now });
    const t = outlined(this, x * T + 16, y * T + 4 - n * 16, str, { color });
    this.fxLayer.add(t);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: 250, duration: 450, onComplete: () => t.destroy() });
  }

  flash(color) {
    const r = this.add.rectangle(0, TOP, WIDTH, MSG_TOP - TOP, color, 0.35).setOrigin(0).setDepth(40);
    this.tweens.add({ targets: r, alpha: 0, duration: 300, onComplete: () => r.destroy() });
  }

  searchRipple() {
    const p = this.st.p;
    const r = this.add.rectangle(p.x * T + 16, p.y * T + 16, T * 5, T * 5).setStrokeStyle(2, hex(DARK.sand), 0.8);
    this.fxLayer.add(r);
    r.setScale(0.3);
    this.tweens.add({ targets: r, scale: 1, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  // ------------------------------------------------------------------ popups

  showPerks() {
    if (!this.st.levelUp || overlayOpen(this) || this.ended) return;
    perkPanel(this, this.st, (id) => {
      this.doAct({ type: 'perk', id });
      if (this.st.levelUp) this.time.delayedCall(200, () => this.showPerks());
      else this.hint('perk', 'Perks', 'Perks last for the whole run. Check them any time with the Hero button.');
    });
  }

  openShop() {
    if (overlayOpen(this)) return;
    this.stopWalk();
    shopPanel(this, this.st, { onAction: (a) => this.doAct(a) });
    this.hint('shop', 'The merchant', 'Tap something to buy it. Anything bought here is named, so you also learn what that kind of potion or scroll is.');
  }

  pauseMenu() {
    if (overlayOpen(this) || this.ended) return;
    this.stopWalk();
    const st = this.st;
    const m = modal(this, 'Paused', `${CLASSES[st.cls].name}, ${st.daily ? `Daily ${st.daily}` : st.mode === 'lantern' ? 'Lantern mode' : 'Normal mode'}\nFloor ${st.depth}, turn ${st.turn}.\nYour run is saved after every turn.`, [
      ['Resume', () => m.destroy()],
      [`Music: ${musicOn() ? 'on' : 'off'}`, (c) => { setMusicOn(!musicOn()); c.buttons[1].setLabel(`Music: ${musicOn() ? 'on' : 'off'}`); }, PALETTE.lavender],
      [`Sound: ${isMuted() ? 'off' : 'on'}`, (c) => { setMuted(!isMuted()); syncVolume(); c.buttons[2].setLabel(`Sound: ${isMuted() ? 'off' : 'on'}`); }, PALETTE.lavender],
      ['Save & quit', () => { saveRun(st); m.destroy(); go(this, 'Title'); }, PALETTE.lavender],
      ['Abandon run', () => {
        m.destroy();
        const sure = modal(this, 'Abandon this run?', 'It ends here and counts as a loss.', [
          ['Abandon', () => { sure.destroy(); st.over = 'dead'; st.killedBy = 'giving up'; st.abandoned = true; this.finish(); }, PALETTE.red, PALETTE.cream],
          ['Keep playing', () => sure.destroy()],
        ]);
      }, PALETTE.red, PALETTE.cream],
    ]);
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.stopWalk();
    this.held = null;
    const st = this.st;
    if (st.over === 'won') report(modeKey(st), 'win');
    else if (!st.abandoned) report(modeKey(st), 'death', st.depth);
    const result = recordRun(st);
    this.runTrophies(st, result);
    playMusic(null);
    fx(st.over === 'won' ? 'win' : 'lose');
    if (st.over !== 'won') this.tweens.add({ targets: this.player, alpha: 0.2, angle: 90, duration: 500 });
    this.time.delayedCall(st.abandoned ? 100 : 1300, () => go(this, 'End', { run: st, result }));
  }

  // ------------------------------------------------------------------ trophies

  /** Trophies and stats for one action's events. kinds: monster id -> kind from before the action. */
  trophies(ev, kinds) {
    const st = this.st;
    let kills = 0;
    for (const e of ev) {
      if (e.t === 'die') {
        kills++;
        earn('first-blood');
        if (kinds.get(e.id) === 'mimic') earn('mimic');
      } else if (e.t === 'floor') {
        stat('floors descended');
        if (e.depth >= 5) earn('floor-5');
        if (e.depth >= 10) earn('floor-10');
        if (e.depth >= G.BOSS_DEPTH) earn('great-hall');
      } else if (e.t === 'snuff') earn('snuffed');
    }
    stat('monsters slain', kills);
    if (st.p.lvl >= 8) earn('level-8');
    if (st.stats.secrets >= 3) earn('secrets-3');
    if (st.p.gold >= 300) earn('rich');
  }

  /** Trophies for a finished run (after it is recorded). Also feeds the shared Daily page. */
  runTrophies(st, result) {
    const won = st.over === 'won';
    stat('runs');
    if (won) {
      stat('wins');
      earn('dawn');
      if (st.mode === 'lantern') earn('lantern-win'); else earn('normal-win');
      const w = result.records.winsBy;
      if (w.knight && w.rogue && w.mage) earn('all-heroes');
    }
    if (result.score >= 5000) earn('score-5k');
    if (st.daily && !st.abandoned) {
      earn('daily');
      if (won) earn('daily-win');
    }
    if (st.daily) daily(result.score, st.daily);
  }

  // ------------------------------------------------------------------ first-time tips

  hint(key, title, body) {
    const seen = save.get('hints') || {};
    if (seen[key] || this.hintQueue.some((h) => h.key === key)) return;
    this.hintQueue.push({ key, title, body });
    this.nextHint();
  }

  nextHint() {
    if (overlayOpen(this) || this.ended || !this.hintQueue.length) return;
    if (this.st.levelUp) { this.showPerks(); return; }
    const h = this.hintQueue.shift();
    save.set('hints', { ...(save.get('hints') || {}), [h.key]: true });
    this.stopWalk();
    this.held = null;
    const m = modal(this, h.title, h.body, [['Got it', () => m.destroy()]], { depth: 320 });
  }

  firstHints() {
    this.hint('start', 'Welcome to the Darkhold', 'Tap a spot on the map to walk there, or use the arrow pad. Walk into monsters to fight them. Find the stairs down on every floor.');
    this.hint('torch', 'Keep your torch alight', 'The orange bar is your torch. It burns down as you walk, and your light shrinks with it. Oil, fresh torches and braziers refill it.');
    this.floorHints();
  }

  floorHints() {
    const st = this.st;
    if (st.depth === 2) this.hint('secret', 'Secret doors', 'Some walls hide secret doors, often with treasure behind them. Tap Search near dead ends to look for them.');
    if (G.SHOP_DEPTHS.includes(st.depth)) this.hint('shopfloor', 'A merchant!', 'Someone has set up shop on this floor. Find the SHOP sign and walk into the merchant to trade.');
    if (st.f.boss) this.hint('boss', 'The Hollow King', 'He can only really be hurt while he stands in brazier light, and he keeps blowing the braziers out. Walk into a brazier to light it again, and fight him beside one.');
  }

  eventHints(ev) {
    const st = this.st;
    const vis = G.visibleMonsters(st).filter((m) => !m.disguised);
    if (vis.length) this.hint('monster', 'A monster!', 'Walk into it to attack. Tap a monster that is further away to see what it is. Monsters only move when you do.');
    if (vis.some((m) => MONSTERS[m.kind].tags.includes('fearLight'))) this.hint('shade', 'Creatures of the dark', 'Shades and Wraiths fear bright light. They lurk at the edge of your torchlight and strike when it burns low.');
    if (ev.some((e) => e.t === 'pickup' && e.k !== 'gold')) this.hint('item', 'Your bag', 'Things you find go in your Bag. Potions and scrolls are a mystery until you try one. Most are helpful, a few are not.');
    const v = G.view(st);
    if (st.f.stairs && v.vis[st.f.stairs.y * W + st.f.stairs.x]) this.hint('stairs', 'Stairs down', 'Step onto the stairs, then tap Descend to go deeper. You cannot come back up.');
    if (st.f.braziers.some((b) => !b.lit && v.vis[b.y * W + b.x])) this.hint('brazier', 'A brazier', 'Walk into it to light it. It feeds your torch and lights up the room for good.');
    if (ev.some((e) => e.t === 'trap' || e.t === 'trapFound')) this.hint('trap', 'Traps', 'Found traps are marked on the floor. Walking by tapping goes around them.');
    if (st.p.fuel < MAX_FUEL * 0.3) this.hint('lowfuel', 'Your torch is low', 'Open your Bag and use a Flask of Oil, or walk into a brazier. In the dark you can barely see, and some monsters grow bold.');
    if (G.hungerState(st)) this.hint('hunger', 'Hungry', 'Open your Bag and eat something. If you starve you slowly lose HP.');
    if (ev.some((e) => e.t === 'secret')) this.hint('secretfound', 'A secret door!', 'Secret doors become normal doors once found. Treasure often waits behind them.');
    if (st.p.inv.some((it) => it.k === 'ranged' || it.k === 'arrows') || (st.cls !== 'knight' && st.turn > 3)) this.hint('fire', 'Shooting', st.cls === 'mage' ? 'Cast shoots a Firebolt at the nearest monster you can see (it uses mana, which refills as you walk). Tap a monster for more options.' : 'Fire shoots the nearest monster you can see with your bow, if you have arrows. Tap a monster for more options.');
    void TRAPS;
  }
}
