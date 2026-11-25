import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT, header, go, modal, busyUi, toast, store, persist, pin, fit, drawBar, hpColor } from './common.js';
import { menuPanel, shopPanel, tipPanel, closeAll } from './panels.js';
import { personFrame } from '../art.js';
import * as G from '../logic/game.js';
import { MAPS, LANDMARKS, GATES, tileDef, chestsOf, leversOf, locksOf, torchesOf } from '../logic/maps.js';
import { CLASSES, MONSTERS, ITEMS, GEAR, KEY_ITEMS } from '../logic/data.js';
import { statsOf } from '../logic/stats.js';
import { playMusic, jingle, fx } from '../music.js';
import { save } from '../save.js';
import { hit, stick, hideWhilePad } from '../../../shared/core/padkit.js';
import { checkTrophies, give } from '../trophies.js';

const T = 32;
const VIEW_TOP = 54;
const VIEW_BOTTOM = 504;
const DIALOG_TOP = 382;
const STEP_MS = 140;
const LEAD = CLASSES.warrior.ch;

export class World extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) { this.opts = data || {}; }

  create() {
    closeAll();
    this.__leaving = false;
    this.state = store.state;
    if (!this.state) { this.scene.start('Title'); return; }
    const st = this.state;
    this.map = MAPS[st.map];
    this.rng = G.rngOf(st);
    this.cameras.main.setBackgroundColor('#0c0a18').fadeIn(180);
    document.body.style.background = PALETTE.night;
    // The scene object is reused on every restart: reset everything a previous visit left behind.
    this.busy = false; this.moving = false; this.path = null; this.held = null; this.pending = null; this.dialog = null;
    this.queuedDir = null; this.queuedTap = null; this.objTimer = null; this.marker = null; this.saveTimer = null;
    this.lastSave = 0;

    this.drawMap();
    this.objects = [];
    this.drawObjects();
    this.npcSprites = new Map();
    this.drawNpcs();
    this.followers = [];
    this.player = this.add.image(0, 0, 'atlas', personFrame(LEAD, st.face)).setScale(2);
    this.trail = [];
    this.makeFollowers();
    this.placePlayer();
    if (this.map.kind !== 'dungeon' && !st.flags.vesper) {
      // The sun has not risen: towns and the world lie in a blue night.
      this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x0c0a30, 0.28).setOrigin(0).setScrollFactor(0).setDepth(4000);
    }
    this.cameraTo(true);

    this.titleText = header(this, G.placeName(st), () => this.backToTitle());
    this.hud();
    this.input.on('pointerup', (p) => this.onTap(p));
    const release = (p) => { if (this.held && p.id === this.heldId) { this.held = null; this.showDir?.(null); } };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => { this.held = null; this.showDir?.(null); });
    this.input.keyboard?.on('keydown', (e) => this.onKey(e, true));
    this.input.keyboard?.on('keyup', (e) => this.onKey(e, false));
    // Controller: the gold menu frame only works in popups (the panels are HTML and always work).
    this.padNav = 'modal';
    this.padStart = () => this.openMenu();

    window.__pq = { scene: this, G, state: st, MAPS, statsOf, restore: () => { G.restoreParty(st); this.refreshHud(); }, tap: (x, y) => this.tapTile(x, y), say: () => this.advanceDialog(), a: () => this.pressA(), step: (d) => this.tryStep(d) };
    playMusic(this.tune());
    persist();
    const away = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', away);
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', away); window.removeEventListener('pagehide', onHide); });
    this.time.delayedCall(220, () => this.arrive());
  }

  tune() {
    const m = this.map;
    if (m.kind === 'world') {
      const z = m.zones.find((r) => this.state.x >= r.x0 && this.state.x <= r.x1 && this.state.y >= r.y0 && this.state.y <= r.y1);
      return { desert: 'desert', frost: 'snow' }[z?.area] || 'field';
    }
    return m.music || 'field';
  }

  backToTitle() {
    if (this.busy || this.moving || this.dialog) { fx('error'); return; }
    persist();
    go(this, 'Title');
  }

  // ------------------------------------------------------------ drawing

  frameFor(ch, x, y, alt) {
    const m = this.map;
    const d = tileDef(m, ch);
    if (d.landmark) { const L = LANDMARKS[d.landmark]; return [L.ground, L.over]; }
    if (d.npc) return [this.groundFrame(this.npcGround(x, y)), null];
    let g = d.g;
    if (g === '$floor') g = m.floor; else if (g === '$wall') g = m.wall; else if (g === '$door' || g === '$lock') g = m.door || 'doorY';
    if (g === 'water' || g === 'dark' || g === 'lava') g = `${g}${alt ? 1 : 0}`;
    let o = d.o || null;
    if (ch === 'x') { g = `water${alt ? 1 : 0}`; o = null; }
    if (GATES[ch] || d.chest || d.lever || d.bar || d.crystal || d.torch || d.lock) o = null;
    return [g, o];
  }

  groundFrame(ch) {
    const d = tileDef(this.map, ch);
    if (d.g === '$floor') return this.map.floor;
    return d.g || this.map.floor;
  }

  npcGround(x, y) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const ch = this.map.tiles[y + dy]?.[x + dx];
      if (ch && '.,;:_-W'.includes(ch)) return ch;
    }
    return '.';
  }

  drawMap() {
    const m = this.map;
    const W = m.tiles[0].length; const H = m.tiles.length;
    this.mapW = W * T; this.mapH = H * T;
    const animated = m.tiles.some((r) => /[~%l]/.test(r)) || m.kind === 'world';
    const rts = [];
    for (const alt of animated ? [0, 1] : [0]) {
      const rt = this.add.renderTexture(0, 0, W * 16, H * 16).setOrigin(0).setScale(2).setDepth(0);
      rt.beginDraw();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const [g, o] = this.frameFor(m.tiles[y][x], x, y, alt);
          if (g) rt.batchDrawFrame('atlas', g, x * 16, y * 16);
          if (o) rt.batchDrawFrame('atlas', o, x * 16, y * 16);
        }
      }
      rt.endDraw();
      rts.push(rt);
    }
    if (rts.length > 1) {
      rts[1].setVisible(false);
      this.time.addEvent({ delay: 560, loop: true, callback: () => { this.alt = !this.alt; rts[0].setVisible(!this.alt); rts[1].setVisible(this.alt); } });
    }
    for (const d of m.decor || []) this.add.image(d.x * T + 16, (d.y + 1) * T, 'atlas', d.frame).setOrigin(0.5, 1).setScale(2).setDepth((d.y + 1) * T);
  }

  /** Chests, levers, locks, barriers, switches, braziers and world gates (they change). */
  drawObjects() {
    for (const o of this.objects) o.img.destroy();
    this.objects = [];
    const m = this.map;
    const st = this.state;
    const add = (x, y, frame, kind, extra = {}) => {
      const img = this.add.image(x * T + 16, y * T + 16, 'atlas', frame).setScale(2).setDepth(y * T + 2);
      this.objects.push({ img, x, y, kind, ...extra });
      return img;
    };
    m.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (m.kind === 'world') {
          if (GATES[ch]) add(x, y, 'broken', 'gate', { ch });
          continue;
        }
        const d = tileDef(m, ch);
        if (d.chest) add(x, y, 'chest0', 'chest', { i: chestsOf(m).findIndex((c) => c.x === x && c.y === y) });
        if (d.lever) add(x, y, 'lever0', 'lever', { i: leversOf(m).findIndex((c) => c.x === x && c.y === y) });
        if (d.lock) add(x, y, m.door?.replace('door', 'lock') || 'lockY', 'lock', { i: locksOf(m).findIndex((c) => c.x === x && c.y === y) });
        if (d.bar) add(x, y, `bar${d.bar === 'R' ? 'R' : 'B'}1`, 'bar', { bar: d.bar });
        if (d.crystal) add(x, y, 'crystalB', 'crystal');
        if (d.torch) add(x, y, 'brazierOff', 'torch', { i: torchesOf(m).findIndex((c) => c.x === x && c.y === y) });
      }
    });
    this.syncObjects();
    if (!this.objTimer) this.objTimer = this.time.addEvent({ delay: 280, loop: true, callback: () => { this.objFrame = !this.objFrame; this.syncObjects(); } });
  }

  syncObjects() {
    const m = this.map; const st = this.state;
    for (const o of this.objects) {
      if (o.kind === 'gate') {
        const open = !!st.flags[GATES[o.ch].flag];
        const frames = { x: open ? 'bridgeH' : 'broken', g: open ? null : `stars${this.objFrame ? 1 : 0}`, r: open ? null : 'mound', b: open ? null : `portal${this.objFrame ? 1 : 0}` };
        const f = frames[o.ch];
        o.img.setVisible(!!f); if (f) o.img.setFrame(f);
      }
      if (o.kind === 'chest') o.img.setFrame(st.opened[`${m.id}:${o.i}`] ? 'chest1' : 'chest0');
      if (o.kind === 'lever') o.img.setFrame(st.flags[m.levers[o.i]] ? 'lever1' : 'lever0');
      if (o.kind === 'lock') o.img.setVisible(!st.flags[m.locks[o.i].flag]);
      if (o.kind === 'bar') { const open = G.barOpen(st, m, o.bar); o.img.setFrame(`bar${o.bar === 'R' ? 'R' : 'B'}${open ? 0 : 1}`); }
      if (o.kind === 'crystal') o.img.setFrame(st.flags[m.bar] ? 'crystalR' : 'crystalB');
      if (o.kind === 'torch') o.img.setFrame(G.torchLit(st, m, o.i) ? `brazier${this.objFrame ? 1 : 0}` : 'brazierOff');
    }
  }

  drawNpcs() {
    for (const s of this.npcSprites.values()) { this.tweens.killTweensOf(s); s.destroy(); }
    this.npcSprites.clear();
    for (const n of G.npcsOn(this.state)) {
      let img;
      if (n.def.boss) {
        const big = typeof MONSTERS[n.def.boss].spr === 'string';
        img = this.add.image(n.x * T + 16, n.y * T + 28, `m_${n.def.boss}`).setOrigin(0.5, 1).setScale(big ? 1.5 : 2.5);
        this.tweens.add({ targets: img, y: img.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      } else {
        img = this.add.image(n.x * T + 16, n.y * T + 12, 'atlas', personFrame(n.def.ch, n.def.face || 'down')).setScale(2);
        if (n.def.face === 'left') img.setFlipX(true);
      }
      img.setDepth(n.y * T + 16);
      img.npc = n;
      this.npcSprites.set(n.letter, img);
    }
    // A bouncing marker over whoever the story needs you to talk to next.
    this.marker?.destroy();
    const key = this.goalNpc();
    const spr = key && this.npcSprites.get(key);
    if (spr) {
      this.marker = text(this, spr.x, spr.y - 30, '!', { size: 32, color: PALETTE.gold }).setDepth(4001).setStroke('#040303', 4);
      this.tweens.add({ targets: this.marker, y: this.marker.y - 6, duration: 360, yoyo: true, repeat: -1 });
    }
  }

  goalNpc() {
    const st = this.state; const f = st.flags;
    if (st.map === 'bw' && !f.quest) return 'r';
    if (st.map === 'fe' && f.stonehide && !st.party.some((m) => m.cls === 'mage')) return 'w';
    if (st.map === 'mc2' && f.mc_cell && !st.party.some((m) => m.cls === 'thief')) return 'k';
    if (st.map === 'fr' && f.pyrescorp && !f.barrier) return 's';
    return null;
  }

  makeFollowers() {
    for (const f of this.followers) f.destroy();
    this.followers = this.state.party.filter((m) => m.cls !== 'warrior').map((m) => {
      const img = this.add.image(0, 0, 'atlas', personFrame(CLASSES[m.cls].ch, this.state.face)).setScale(2);
      img.cls = m.cls;
      return img;
    });
    this.trail = [];
  }

  placePlayer() {
    const { x, y } = this.state;
    this.player.setPosition(x * T + 16, y * T + 12).setDepth(y * T + 17);
    this.facePerson(this.player, LEAD, this.state.face);
    this.followers.forEach((f, k) => {
      const p = this.trail[k] || { x, y, face: this.state.face };
      f.setPosition(p.x * T + 16, p.y * T + 12).setDepth(p.y * T + 16 - k * 0.1);
      f.setVisible(!!this.trail[k]);
      this.facePerson(f, CLASSES[f.cls].ch, p.face);
    });
  }

  facePerson(img, ch, face, stepping = false) {
    img.setFrame(personFrame(ch, face, stepping));
    img.setFlipX(face === 'left');
  }

  cameraTo(instant) {
    const cam = this.cameras.main;
    const bottom = this.dialog ? DIALOG_TOP : VIEW_BOTTOM;
    const viewH = bottom - VIEW_TOP;
    const sx = this.mapW <= WIDTH ? (this.mapW - WIDTH) / 2 : Phaser.Math.Clamp(this.player.x - WIDTH / 2, 0, this.mapW - WIDTH);
    const sy = this.mapH <= viewH ? (this.mapH - viewH) / 2 - VIEW_TOP : Phaser.Math.Clamp(this.player.y - VIEW_TOP - viewH / 2, -VIEW_TOP, this.mapH - bottom);
    if (instant) { cam.scrollX = Math.round(sx); cam.scrollY = Math.round(sy); return; }
    cam.scrollX = Math.round(cam.scrollX + (sx - cam.scrollX) * 0.3);
    cam.scrollY = Math.round(cam.scrollY + (sy - cam.scrollY) * 0.3);
  }

  // ------------------------------------------------------------ HUD

  hud() {
    const D = 5000;
    const fix = (o) => pin(o).setDepth(D + 1);
    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, HEIGHT - VIEW_BOTTOM, hex(PALETTE.night)).setOrigin(0).setScrollFactor(0).setDepth(D);
    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setScrollFactor(0).setDepth(D);
    // One big thumb zone for the arrow pad: the direction comes from where the thumb is relative
    // to the pad's centre, so sliding between directions works without lifting.
    const PX = 76; const PY = 572;
    const touchPad = [this.add.rectangle(PX, PY, 40, 40, hex(PALETTE.indigo)).setScrollFactor(0).setDepth(D)];
    const faces = {};
    for (const [dir, x, y, label] of [['up', PX, PY - 44, '^'], ['left', PX - 46, PY, '<'], ['right', PX + 46, PY, '>'], ['down', PX, PY + 44, 'v']]) {
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(D + 1);
      const sh = this.add.rectangle(0, 3, 44, 40, hex(PALETTE.ink));
      const face = this.add.rectangle(0, 0, 44, 40, hex(PALETTE.lavender)).setStrokeStyle(3, hex(PALETTE.ink));
      const t = text(this, 0, -2, label, { size: 32, color: PALETTE.night });
      c.add([sh, face, t]);
      pin(c);
      touchPad.push(c);
      faces[dir] = (on) => { face.y = on ? 2 : 0; t.y = on ? 0 : -2; face.setFillStyle(hex(on ? PALETTE.gold : PALETTE.lavender)); };
    }
    this.showDir = (dir) => Object.entries(faces).forEach(([d, f]) => f(d === dir));
    const dirFrom = (p) => {
      const dx = p.x - PX; const dy = p.y - PY;
      if (Math.hypot(dx, dy) < 10) return this.held;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    const zone = this.add.zone(PX, PY, 152, 136).setScrollFactor(0).setDepth(D + 2).setInteractive();
    zone.on('pointerdown', (p) => {
      if (this.dialog) { this.advanceDialog(); return; }
      if (busyUi(this) || this.busy) return;
      const dir = dirFrom(p) || 'down';
      this.held = dir; this.heldId = p.id; this.path = null; this.pending = null;
      this.showDir(dir);
      // A quick tap moves one tile, even if it lands while a step is still finishing.
      if (!this.moving) this.tryStep(dir, true); else this.queuedDir = dir;
    });
    this.input.on('pointermove', (p) => {
      if (!this.held || p.id !== this.heldId || !p.isDown) return;
      const dir = dirFrom(p);
      if (dir && dir !== this.held) { this.held = dir; this.showDir(dir); }
    });
    this.aBtn = fix(button(this, 194, 572, 64, 60, 'A', () => this.pressA(), { size: 32, fill: PALETTE.gold, silent: true }));
    // The arrow pad and the A button hide while a controller is in use (back on the next touch).
    hideWhilePad(this, [...touchPad, this.aBtn]);
    fix(button(this, 298, 540, 110, 48, 'Menu', () => this.openMenu(), { fill: PALETTE.cream }));
    this.goldText = fix(text(this, 298, 586, '', { color: PALETTE.gold }));
    this.repelText = fix(text(this, 298, 614, '', { color: PALETTE.lavender }));
    // Party strip over the top of the map.
    this.strip = [];
    const n = 4; const w = WIDTH / n;
    for (let i = 0; i < n; i++) {
      const name = fix(text(this, i * w + 6, 66, '', { origin: [0, 0.5], color: PALETTE.cream }));
      const g = fix(this.add.graphics());
      this.strip.push({ name, g, x: i * w });
    }
    this.stripBg = this.add.rectangle(0, VIEW_TOP, WIDTH, 30, hex(PALETTE.ink), 0.55).setOrigin(0).setScrollFactor(0).setDepth(D);
    this.refreshHud();
  }

  refreshHud() {
    const st = this.state;
    this.goldText.setText(`${st.gold} G`); fit(this.goldText, 110);
    this.repelText.setText(st.repel > 0 ? `Ward ${st.repel}` : '');
    this.strip.forEach((s, i) => {
      const m = st.party[i];
      s.g.clear();
      if (!m) { s.name.setText(''); return; }
      const max = statsOf(m).hp;
      s.name.setText(CLASSES[m.cls].name).setColor(m.hp <= 0 ? PALETTE.red : m.st ? '#d08ad0' : PALETTE.cream);
      drawBar(s.g, s.x + 46, 61, 38, 10, m.hp / max, hpColor(m.hp / max));
    });
  }

  canAct() { return !this.busy && !this.dialog && !this.moving && !busyUi(this); }

  openMenu() {
    if (!this.canAct()) { if (this.dialog) this.advanceDialog(); return; }
    this.held = null; this.path = null;
    fx('select');
    const st = this.state;
    menuPanel(st, {
      playMs: () => st.playMs,
      onSave: () => { persist('slot'); persist('auto'); },
      onTitle: () => { persist(); go(this, 'Title'); },
      onChange: (e) => {
        this.refreshHud();
        persist();
        if (e?.warped) { closeAll(); this.changeMap([e.text]); }
      },
    });
    if (!save.get('tips')?.menu) this.tip('menu');
  }

  // ------------------------------------------------------------ input

  onKey(e, down) {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
    if (dir) { if (down) { if (!this.dialog && !busyUi(this)) { this.held = dir; this.path = null; } } else if (this.held === dir) this.held = null; return; }
    if (down && (e.key === ' ' || e.key === 'Enter' || e.key === 'z')) this.pressA();
  }

  onTap(p) {
    if (busyUi(this) || Date.now() - (this.__modalClosedAt || 0) < 250) return;
    if (p.y < VIEW_TOP || p.y > VIEW_BOTTOM) return;
    if (this.dialog) { this.advanceDialog(); return; }
    if (this.busy) return;
    const wx = p.x + this.cameras.main.scrollX; const wy = p.y + this.cameras.main.scrollY;
    for (const spr of this.npcSprites.values()) {
      if (Math.abs(wx - spr.x) <= 18 && wy <= spr.y + 18 && wy >= spr.y - 30) { this.tapTile(spr.npc.x, spr.npc.y); return; }
    }
    this.tapTile(Math.floor(wx / T), Math.floor(wy / T));
  }

  /** Walk to a tile, or up to a person / chest / switch and use it. */
  tapTile(tx, ty) {
    const st = this.state;
    if (tx === st.x && ty === st.y) return;
    if (this.moving) { this.queuedTap = [tx, ty]; return; }
    const info = G.tileInfo(st, tx, ty);
    if (info.out) { sfx0(); return; }
    const usable = info.npc || ['chest', 'lever', 'lock', 'torch', 'crystal', 'sign', 'bell'].some((k) => info.def?.[k]) || ((info.ch === 'R' || info.ch === 'U') && !info.walk);
    if (usable && !info.walk) {
      // Next to it, or across a shop counter.
      const spots = [];
      for (const [dx, dy] of Object.values(G.DIRS)) {
        spots.push({ x: tx + dx, y: ty + dy, use: { x: tx, y: ty } });
        if (this.map.tiles[ty + dy]?.[tx + dx] === '+') spots.push({ x: tx + dx * 2, y: ty + dy * 2, use: { x: tx + dx, y: ty + dy } });
      }
      let best = null;
      for (const s of spots) {
        if (s.x === st.x && s.y === st.y) { best = { path: [], use: s.use }; break; }
        if (!G.walkable(st, s.x, s.y)) continue;
        const path = G.findPath(st, s.x, s.y);
        if (path && (!best || path.length < best.path.length)) best = { path, use: s.use };
      }
      if (!best) { fx('error'); return; }
      this.path = best.path; this.pending = best.use;
      if (!best.path.length) this.finishPath();
      return;
    }
    if (!info.walk) { fx('error'); return; }
    const path = G.findPath(st, tx, ty);
    if (!path) { fx('error'); return; }
    this.path = path; this.pending = null;
    this.mark(tx, ty);
  }

  mark(tx, ty) {
    const m = this.add.rectangle(tx * T + 16, ty * T + 16, 22, 22).setStrokeStyle(3, 0xf9f5ef).setDepth(3000);
    this.tweens.add({ targets: m, scale: 0.4, alpha: 0, duration: 450, onComplete: () => m.destroy() });
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
    if (!this.canAct()) return;
    const f = G.facing(this.state);
    this.useTile(f.x, f.y);
  }

  // ------------------------------------------------------------ movement

  /** Controller: d-pad / stick walks, A talks / uses / moves messages on, B stops a walk, Start = Menu. */
  padInput() {
    const ps = stick();
    const dir = Math.abs(ps.x) > 0.5 || Math.abs(ps.y) > 0.5 ? (Math.abs(ps.x) > Math.abs(ps.y) ? (ps.x > 0 ? 'right' : 'left') : (ps.y > 0 ? 'down' : 'up')) : null;
    if (busyUi(this)) { if (this.padHeld) { this.held = null; this.padHeld = false; } return; }
    if (this.dialog) { if (hit('a') || hit('b')) this.advanceDialog(); return; }
    if (dir) { if (this.held !== dir) { this.held = dir; this.path = null; this.pending = null; } this.padHeld = true; } else if (this.padHeld) { this.held = null; this.padHeld = false; }
    if (hit('a')) this.pressA();
    else if (hit('b')) { this.path = null; this.pending = null; }
  }

  update(time, delta) {
    if (!this.state || !this.player) return;
    this.padInput();
    if (!this.scene.isPaused() && document.visibilityState !== 'hidden') this.state.playMs = (this.state.playMs || 0) + Math.min(delta, 250);
    this.cameraTo(false);
    if (this.busy || this.moving || this.dialog || busyUi(this)) return;
    if (this.queuedTap) { const [x, y] = this.queuedTap; this.queuedTap = null; this.tapTile(x, y); return; }
    if (this.queuedDir) { const d = this.queuedDir; this.queuedDir = null; if (!this.held) { this.tryStep(d); return; } }
    if (this.path && this.path.length) {
      const [nx, ny] = this.path.shift();
      const dir = G.dirTo(this.state.x, this.state.y, nx, ny);
      if (!this.tryStep(dir)) { this.path = null; this.pending = null; }
      return;
    }
    if (this.path && !this.path.length) { this.path = null; this.finishPath(); return; }
    if (this.held) this.tryStep(this.held, true);
  }

  tryStep(dir) {
    const st = this.state;
    const before = { x: st.x, y: st.y, face: st.face };
    const mapBefore = st.map;
    const res = G.step(st, dir, this.rng);
    this.facePerson(this.player, LEAD, dir);
    if (!res.moved) {
      for (const e of res.events) {
        if (e.t === 'blocked') { this.held = null; this.path = null; this.say(e.lines, null); }
        if (e.t === 'gate') { this.held = null; this.path = null; this.say([gateHint(e.ch)], null); }
      }
      return false;
    }
    this.moving = true;
    const changing = st.map !== mapBefore;
    const tx = (changing ? before.x + G.DIRS[dir][0] : st.x) * T + 16;
    const ty = (changing ? before.y + G.DIRS[dir][1] : st.y) * T + 12;
    this.stepFlip = !this.stepFlip;
    this.facePerson(this.player, LEAD, dir, this.stepFlip);
    // Followers walk into the spot ahead of them.
    if (!changing) {
      this.trail.unshift({ ...before, face: dir });
      this.trail.length = Math.min(this.trail.length, this.followers.length);
    }
    this.followers.forEach((f, k) => {
      const p = this.trail[k];
      if (!p || changing) return;
      f.setVisible(true);
      const prev = k === 0 ? { x: st.x, y: st.y } : this.trail[k - 1];
      const fd = G.dirTo(p.x, p.y, prev.x, prev.y);
      this.facePerson(f, CLASSES[f.cls].ch, k === 0 ? dir : fd, this.stepFlip);
      this.tweens.add({ targets: f, x: p.x * T + 16, y: p.y * T + 12, duration: STEP_MS, onComplete: () => f.setDepth(p.y * T + 16 - k * 0.1) });
    });
    this.tweens.add({
      targets: this.player, x: tx, y: ty, duration: STEP_MS,
      onUpdate: () => this.player.setDepth(this.player.y + 5),
      onComplete: () => {
        this.moving = false;
        if (!changing) this.placePlayer();
        this.afterStep(res.events, changing);
      },
    });
    return true;
  }

  afterStep(events, changing) {
    const now = Date.now();
    if (now - this.lastSave > 1500) { persist(); this.lastSave = now; }
    this.saveTimer?.remove();
    this.saveTimer = this.time.delayedCall(600, () => { persist(); this.lastSave = Date.now(); });
    this.refreshHud();
    if (this.map.kind === 'world') {
      const name = G.placeName(this.state);
      if (name !== this.titleText.text) { this.titleText.setText(name); fit(this.titleText, 220); toast(this, name, 120, PALETTE.cream); playMusic(this.tune()); }
    }
    for (const e of events) {
      if (e.t === 'map') {
        this.held = null; this.path = null; this.pending = null; this.queuedDir = null;
        this.changeMap(e.lines, e.stairs);
        return;
      }
      if (e.t === 'secret') { fx('secret'); jingle('item'); toast(this, 'A secret passage!'); give('secret'); }
      if (e.t === 'battle') { this.held = null; this.path = null; this.pending = null; this.queuedDir = null; this.startBattle({ enemies: e.enemies, area: e.area }); return; }
    }
  }

  changeMap(lines, stairs) {
    this.busy = true;
    persist();
    fx(stairs ? 'stairs' : 'door');
    this.cameras.main.fadeOut(160, 12, 10, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ lines, entered: true }));
  }

  // ------------------------------------------------------------ arrivals and dialogue

  arrive() {
    const o = this.opts; const st = this.state;
    checkTrophies(st);
    if (o.intro) {
      this.say([
        'Brightwater, in the dark before dawn.',
        'For three nights now, the sun has not risen.',
      ], null, () => this.say(['Mom: Ash! Sola! Elder Bram is waiting for you by the Sun Bell, in the town square.'], 1, () => this.tip('move')));
      return;
    }
    if (o.after) { this.afterBattle(o.after); return; }
    if (o.lines?.length) { this.say(o.lines, null); return; }
    if (o.entered) {
      toast(this, G.placeName(this.state), 120, PALETTE.cream);
      if (this.map.kind === 'dungeon' && !save.get('tips')?.dungeon) this.time.delayedCall(400, () => this.tip('dungeon'));
      else if (this.map.kind === 'world' && !save.get('tips')?.world) this.time.delayedCall(300, () => this.tip('world'));
    }
  }

  /** Show lines one by one. face: character row or a monster id for a portrait. */
  say(lines, face, done) {
    if (!lines || !lines.length) { done?.(); return; }
    this.dialog?.c.destroy();
    this.held = null; this.queuedDir = null; this.showDir?.(null);
    const D = 6000;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(D);
    const top = DIALOG_TOP; const h = 118;
    c.add(this.add.rectangle(0, VIEW_TOP, WIDTH, HEIGHT, 0, 0.001).setOrigin(0).setInteractive());
    c.add(panel(this, 6, top, WIDTH - 12, h, { fill: '#211d44', inner: PALETTE.cream, border: PALETTE.ink }));
    let tx = 22;
    if (face != null) {
      c.add(this.add.rectangle(48, top + h / 2, 64, 64, hex(PALETTE.indigo)).setStrokeStyle(3, hex(PALETTE.ink)));
      if (typeof face === 'string') c.add(this.add.image(48, top + h / 2, `m_${face}`).setScale(MONSTERS[face] && typeof MONSTERS[face].spr === 'string' ? 1.6 : 3.2));
      else c.add(this.add.image(48, top + h / 2, 'atlas', `c${face}_0`).setScale(3.5));
      tx = 90;
    }
    const t = text(this, tx, top + 14, '', { origin: 0, align: 'left', color: PALETTE.cream, wrap: WIDTH - tx - 34 });
    const more = text(this, WIDTH - 24, top + h - 18, 'v', { color: PALETTE.gold });
    this.tweens.add({ targets: more, y: more.y + 3, duration: 300, yoyo: true, repeat: -1 });
    c.add([t, more]);
    pin(c);
    this.dialog = { c, t, lines: [...lines], done };
    this.cameraTo(true);
    this.showLine();
  }

  showLine() {
    const d = this.dialog;
    const line = d.lines.shift();
    d.t.setText(line);
    // Too long for the box: show the first part now and the rest on the next tap.
    if (d.t.height > 92) {
      const words = line.split(' ');
      let cut = words.length - 1;
      while (cut > 1) { d.t.setText(words.slice(0, cut).join(' ')); if (d.t.height <= 92) break; cut--; }
      for (let i = cut; i > Math.max(2, cut - 6); i--) if (/[.!?,]$/.test(words[i - 1])) { cut = i; break; }
      d.t.setText(words.slice(0, cut).join(' '));
      d.lines.unshift(words.slice(cut).join(' '));
    }
    d.shownAt = Date.now();
  }

  advanceDialog() {
    const d = this.dialog;
    if (!d || Date.now() - d.shownAt < 200) return;
    fx('tap');
    if (d.lines.length) { this.showLine(); return; }
    d.c.destroy();
    this.dialog = null;
    this.cameraTo(true);
    d.done?.();
  }

  tip(id) {
    const tips = { ...(save.get('tips') || {}) };
    if (tips[id]) return;
    const TIPS = {
      move: ['How to move', ['Hold the arrow pad to walk. Slide your thumb to turn.', 'Or tap anywhere on the map to walk there.', 'Tap a person (or face them and press A) to talk. The gold ! shows who to talk to next.']],
      menu: ['The Menu', ['Your current goal is always at the top of the Menu.', 'Tap a hero to see their stats and spells. Equip new gear, use items and Save here.']],
      world: ['The world', ['Monsters attack at random out here. Win battles to grow stronger.', 'Walk onto a town, cave or tower to go inside. Rest at an inn when you are hurt.']],
      dungeon: ['Dungeons', ['Open chests for treasure. Switches, levers and locked doors block the way: look around!', 'A boss guards each Chime. Heal up before you face it.']],
      thief: ['Kit the Thief', ['Kit is fast and lands critical hits.', 'His Steal skill takes an item from a monster, and bosses carry good ones.']],
      mage: ['Wren the Mage', ['Wren\'s spells hit hard and Blaze hits every monster at once.', 'She is fragile: watch her HP, and keep Ethers for MP.']],
    };
    const t = TIPS[id];
    if (!t) return;
    tips[id] = true;
    save.set('tips', tips);
    this.held = null;
    tipPanel(t[0], t[1]);
  }

  // ------------------------------------------------------------ actions

  useTile(x, y) {
    const action = G.interact(this.state, x, y);
    if (!action) return;
    fx('select');
    if (action.t === 'talk') {
      const spr = this.npcSprites.get(action.npc);
      if (spr && !action.def.boss) {
        const d = G.dirTo(action.at.x, action.at.y, this.state.x, this.state.y);
        this.facePerson(spr, action.def.ch, d);
      }
    }
    this.doAction(action);
  }

  doAction(a) {
    const st = this.state;
    const m = this.map;
    if (a.t === 'msg') { this.say(a.lines, null); return; }
    if (a.t === 'talk') {
      const portrait = a.def.boss || a.def.ch;
      this.say(a.lines, portrait, () => { if (a.do) this.runDo(a.do, a); });
      return;
    }
    if (a.t === 'chest') {
      const r = G.openChest(st, a.idx);
      if (r.mimic) {
        this.say(['The chest snaps open... it\'s a monster!'], null, () => this.startBattle({ enemies: [r.mimic], mimic: r.id }));
        return;
      }
      jingle('item');
      this.syncObjects();
      persist();
      const icon = r.gold ? 'i_coin' : r.item ? `i_${ITEMS[r.item].icon}` : r.gear ? `i_${GEAR[r.gear].icon}` : r.key ? `i_${KEY_ITEMS[r.key].icon}` : null;
      this.showFind(icon, r.text, r.gear ? ['Equip it from the Menu.'] : null);
      checkTrophies(st);
      return;
    }
    if (a.t === 'lever') { const r = G.pullLever(st, a.idx); fx('switch'); this.syncObjects(); persist(); this.say([r.text], null); return; }
    if (a.t === 'unlock') { G.unlock(st, a.idx); fx('door'); this.syncObjects(); persist(); this.say(a.lines, null); return; }
    if (a.t === 'torch') {
      const r = G.toggleTorch(st, a.idx);
      fx(r.solved ? 'secret' : 'fire');
      this.syncObjects(); persist();
      if (r.already) return;
      if (r.solved) this.say(['All four flames blaze at once!', 'With a rumble, the red wall sinks into the floor.'], null);
      return;
    }
    if (a.t === 'crystal') {
      const here = m.tiles[st.y][st.x];
      if (here === 'R' || here === 'U') { this.say(['Better step off the wall tile first!'], null); return; }
      G.toggleCrystal(st); fx('switch'); this.syncObjects(); persist();
      this.cameras.main.flash(120, st.flags[m.bar] ? 161 : 91, st.flags[m.bar] ? 61 : 116, st.flags[m.bar] ? 59 : 208);
    }
  }

  showFind(icon, msg, extra) {
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(7002);
    if (icon) c.add(this.add.image(WIDTH / 2, 330, 'atlas', icon).setScale(3));
    pin(c);
    this.tweens.add({ targets: c, y: -8, duration: 300 });
    this.say([msg, ...(extra || [])], null, () => c.destroy());
  }

  runDo(act, a) {
    const st = this.state;
    const [kind, arg] = act.split(':');
    if (kind === 'inn') {
      const price = G.innPrice(arg);
      modal(this, 'Inn', [`A night's rest costs ${price} gold.`, 'Everyone is healed and revived, and poison is cured.', { text: `You have ${st.gold} gold.`, color: PALETTE.gold }], [
        ['Rest', () => {
          if (!G.rest(st, price)) { this.say(['Innkeeper: Oh dear, you can\'t afford it. Come back with more gold!'], a.def.ch); return; }
          this.restFx(() => this.say([st.flags.vesper ? 'Innkeeper: Good morning! What a sunrise, eh?' : 'Innkeeper: Good morning! Well... it\'s still dark. But you look rested!', 'Your game was saved.'], a.def.ch));
        }],
        ['Not now', null, PALETTE.indigo, PALETTE.cream],
      ]);
      return;
    }
    if (kind === 'shop') { shopPanel(st, arg, { onChange: () => { this.refreshHud(); persist(); } }); return; }
    if (kind === 'boss') {
      this.startBattle({ enemies: [arg], boss: arg, phase2: G.bossSetup(arg).phase2 });
      return;
    }
    if (kind === 'heal') {
      G.runDo(st, act);
      this.restFx(() => this.say(['Everyone is fully rested. Your game was saved.'], null));
      return;
    }
    const lines = G.runDo(st, act) || [];
    if (kind === 'join') {
      jingle('join');
      this.drawNpcs();
      this.makeFollowers();
      this.placePlayer();
      this.refreshHud();
      persist();
      checkTrophies(st);
      this.say(lines, CLASSES[arg].ch, () => this.tip(arg));
      return;
    }
    if (kind === 'quest' || kind === 'barrier') { jingle(kind === 'barrier' ? 'chime' : 'item'); this.drawNpcs(); this.refreshHud(); persist(); this.say(lines, null, () => { if (kind === 'quest') this.tip('menu'); }); return; }
    if (lines.length) this.say(lines, null);
  }

  restFx(done) {
    this.busy = true;
    jingle('inn');
    const cover = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(9000);
    this.tweens.add({
      targets: cover, alpha: 1, duration: 400, yoyo: true, hold: 900,
      onYoyo: () => { this.refreshHud(); },
      onComplete: () => { cover.destroy(); this.busy = false; persist('auto'); persist('slot'); done?.(); },
    });
  }

  startBattle(setup) {
    this.busy = true;
    this.held = null; this.path = null;
    persist();
    fx('encounter');
    const cam = this.cameras.main;
    cam.flash(100, 255, 255, 255);
    this.time.delayedCall(140, () => cam.flash(100, 255, 255, 255));
    const bars = [];
    for (let i = 0; i < 8; i++) bars.push(this.add.rectangle(i % 2 ? WIDTH : 0, i * (HEIGHT / 8), 0, HEIGHT / 8 + 1, 0x0c0a18).setOrigin(i % 2 ? 1 : 0, 0).setScrollFactor(0).setDepth(9000));
    this.tweens.add({
      targets: bars, width: WIDTH, duration: 380, delay: this.tweens.stagger(30), ease: 'Quad.in',
      onComplete: () => this.time.delayedCall(60, () => this.scene.start('Battle', { setup: { ...setup, map: this.map.id } })),
    });
  }

  afterBattle(after) {
    this.refreshHud();
    checkTrophies(this.state);
    const lines = [...(after.lines || [])];
    if (after.wiped) {
      this.say(lines, null);
      return;
    }
    if (lines.length) {
      if (after.boss) jingle('chime');
      this.say(lines, null);
    }
  }
}

function gateHint(ch) {
  return {
    x: 'The bridge has collapsed into the river. It can\'t be crossed for now.',
    g: 'A howling wall of wind blocks the pass. It seems to blow from the tower in the east.',
    r: 'A rockfall blocks the pass. The ground trembles now and then...',
    b: 'A wall of living darkness bars the way to the black castle.',
  }[ch];
}

function sfx0() { fx('error'); }

