import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, header, go, modal, modalOpen, toast, store, persist, pin, fit, fmt, img, flushAwards } from './common.js';
import { ATLAS } from '../art.js';
import * as G from '../logic/game.js';
import * as D from '../logic/data.js';
import { MAPS, tileAt, buildingAt, doorOf } from '../logic/maps.js';
import { TUTORIAL } from '../logic/game.js';
import { playMusic, jingle, swish } from '../music.js';
import {
  blocking, closeAll, usePanelScene, bagPanel, shipPanel, shopPanel, craftPanel, boardPanel, letterPanel,
  friendsPanel, pickItemPanel, menuPanel, summaryPanel, animalPanel, weatherText,
} from './panels.js';

const T = 32;
const VIEW_TOP = 54;
const VIEW_BOTTOM = 452;
const BAR_Y = 477;
const DIALOG_TOP = 330;
const STEP_MS = 140;
const MS_PER_TICK = 4500; // ten game minutes
const SLIME_MS = 650;
const PAD = { x: 70, y: 574 };
const DIR_NAME = { down: 'Down', up: 'Up', left: 'Left', right: 'Right' };
const SLIME_COLOR = { green: 'Green', blue: 'Blue', red: 'Red' };

const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

export class World extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) { this.opts = data || {}; }

  create() {
    closeAll();
    usePanelScene(this);
    this.s = store.state;
    if (!this.s) { this.scene.start('Title'); return; }
    const s = this.s;
    if (s.map === 'mine' && !s.mine) G.leaveMine(s);
    this.cameras.main.setBackgroundColor(s.map === 'mine' ? '#1c1618' : '#2f5a2c').fadeIn(180);
    document.body.style.background = PALETTE.night;
    this.busy = false; this.moving = false; this.path = null; this.held = null; this.pending = null;
    this.dialog = null; this.acc = 0; this.slimeAcc = 0; this.animalAcc = 0; this.hunt = null;
    // restart() reuses this object, so clear every one-shot flag
    this.sleeping = false; this.__modal = null; this.__toasts = []; this.npcDots = [];

    this.mapDef = G.mapOf(s);
    this.drawMap();
    this.objSprites = new Map();
    this.drawAllObjects();
    this.npcSprites = new Map();
    this.syncNpcs(true);
    this.animalSprites = new Map();
    this.syncAnimals(true);
    this.slimeSprites = new Map();
    if (s.map === 'mine') this.drawMine();
    this.player = this.add.image(0, 0, ATLAS, 'pIdleDown0').setScale(2);
    this.placePlayer();
    this.weatherLayer();
    this.cameraTo(true);

    this.hud();
    this.input.on('pointerup', (p) => this.onTap(p));
    const release = (p) => { if (this.held && p.id === this.heldId) { this.held = null; this.showDir?.(null); } };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => { this.held = null; this.showDir?.(null); });
    this.input.keyboard?.on('keydown', (e) => this.onKey(e, true));
    this.input.keyboard?.on('keyup', (e) => this.onKey(e, false));

    const away = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', persist);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', away); window.removeEventListener('pagehide', persist); closeAll(); });

    window.__hv = {
      scene: this, G, D, get s() { return store.state; },
      act: (x, y) => this.act(x, y), tapTile: (x, y) => this.tapTile(x, y), say: () => this.advanceDialog(),
      sleepNow: () => this.goToBed(), select: (i) => this.selectSlot(i),
    };
    this.music();
    this.time.delayedCall(200, () => this.arrive());
  }

  // ------------------------------------------------------------ drawing the world

  drawMap() {
    const s = this.s;
    const m = this.mapDef;
    this.water = [];
    const se = s.season;
    m.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const h = hash(x, y) % 12;
        const grass = h < 9 ? `grass${se}` : h < 11 ? `grassb${se}` : `grassc${se}`;
        let frame = grass; let over = null;
        if (ch === '=') frame = 'path';
        else if (ch === '#') frame = 'plaza';
        else if (ch === 's') frame = 'sand';
        else if (ch === '~') frame = 'water0';
        else if (ch === 'T') frame = `forest${se}`;
        else if (ch === 'X') frame = h % 2 ? 'cliff' : 'cliffb';
        else if (ch === ':') frame = h < 9 ? 'mineFloor' : 'mineFloorb';
        else if (ch === '|') over = 'fenceV';
        else if (ch === '-') over = 'fenceH';
        const im = this.add.image(x * T, y * T, ATLAS, frame).setOrigin(0).setScale(2).setDepth(0);
        if (ch === '~') this.water.push(im);
        if (over) this.add.image(x * T, y * T, ATLAS, over).setOrigin(0).setScale(2).setDepth(y * T + 10);
        if (ch === '.' && s.map === 'town' && h === 3 && y > 15) this.add.image(x * T, y * T, ATLAS, 'flowers').setOrigin(0).setScale(2).setDepth(1);
      }
    });
    if (this.water.length) this.time.addEvent({ delay: 700, loop: true, callback: () => { this.wf = !this.wf; for (const w of this.water) w.setFrame(this.wf ? 'water1' : 'water0'); } });
    if (s.map === 'mine') return;
    for (const b of m.buildings || []) {
      const look = b.kind === 'hall' && !s.hallRestored ? 'hallRuin' : b.look;
      this.add.image(b.x * T, b.y * T, ATLAS, look).setOrigin(0).setScale(2).setDepth((b.y + b.h) * T - 2);
      // a little name plate under the eaves
      const label = text(this, (b.x + b.w / 2) * T, (b.y + b.h) * T - 70, shortName(b), { color: PALETTE.cream });
      fit(label, b.w * T - 16);
      const lb = this.add.rectangle(label.x, label.y, label.displayWidth + 10, 20, hex(PALETTE.ink), 0.6).setDepth((b.y + b.h) * T - 1);
      label.setDepth((b.y + b.h) * T);
      lb.setDepth((b.y + b.h) * T - 1);
    }
    this.fixtures = new Map();
    for (const f of m.fixtures || []) this.drawFixture(f);
  }

  drawFixture(f) {
    const s = this.s;
    let frame = { mailbox: G.unread(s) ? 'o_mailboxNew' : 'o_mailbox', bin: 'o_bin', board: 'o_board', cave: 'caveDoor' }[f.id];
    if (f.id.startsWith('trough')) {
      const want = s.animals.filter((a) => D.ANIMALS[a.kind].home === f.home).length;
      frame = want && s.troughs[f.home] >= want ? 'o_troughFull' : 'o_trough';
    }
    const old = this.fixtures.get(f.id);
    if (old) { old.setFrame(frame); return; }
    const im = this.add.image(f.x * T + 16, f.y * T + 32, ATLAS, frame).setOrigin(0.5, 1).setScale(2).setDepth(f.y * T + 20);
    this.fixtures.set(f.id, im);
  }

  refreshFixtures() { for (const f of this.mapDef.fixtures || []) this.drawFixture(f); }

  drawAllObjects() {
    const s = this.s;
    if (s.map === 'farm') for (const k of Object.keys(s.soil)) this.drawTile(k);
    for (const k of Object.keys(s.objs[s.map] || {})) this.drawTile(k);
  }

  /** (Re)draw whatever sits on one tile: soil, crop, debris, forage, machine. */
  drawTile(k) {
    const s = this.s;
    const old = this.objSprites.get(k);
    if (old) { old.forEach((o) => o.destroy()); this.objSprites.delete(k); }
    const [x, y] = k.split(',').map(Number);
    const out = [];
    const so = G.soilAt(s, s.map, x, y);
    const cx = x * T + 16; const by = y * T + 32;
    if (so) {
      out.push(this.add.image(x * T, y * T, ATLAS, so.wet ? 'soilWet' : 'soil').setOrigin(0).setScale(2).setDepth(1));
      if (so.compost) out.push(this.add.rectangle(x * T + 4, y * T + 4, 6, 6, 0x6cb83c).setOrigin(0).setDepth(2));
      if (so.crop) {
        const st = G.cropStage(so.crop);
        const frame = { seed: 'cropSeed', sprout: 'cropSprout', young: 'cropYoung', grown: 'cropGrown', tall: 'cropTall', ready: D.CROPS[so.crop.id].tall ? 'cropTall' : 'cropGrown', dead: 'cropDead' }[st];
        out.push(this.add.image(cx, by, ATLAS, frame).setOrigin(0.5, 1).setScale(2).setDepth(y * T + 14));
        if (st === 'ready') {
          const ic = this.add.image(cx, y * T + 6, ATLAS, `i_${so.crop.id}`).setScale(2).setDepth(y * T + 15);
          this.tweens.add({ targets: ic, y: ic.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          out.push(ic);
        }
      }
    }
    const o = G.objAt(s, s.map, x, y);
    if (o) {
      const se = s.season;
      if (o.k === 'forage') {
        const ic = this.add.image(cx, y * T + 18, ATLAS, D.ITEMS[o.item].icon).setScale(2).setDepth(y * T + 14);
        this.tweens.add({ targets: ic, y: ic.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (x * 97) % 600 });
        out.push(ic);
      } else {
        const frame = { rock: 'rock', twig: 'o_twig', stump: 'o_stump', bush: `bush${se}`, weed: hash(x, y) % 2 ? `weed${se}` : `weedb${se}`, tall: `tall${se}` }[o.k]
          || (D.MACHINES[o.k] ? (o.job ? D.MACHINES[o.k].busyIcon : D.MACHINES[o.k].icon) : D.ITEMS[o.k]?.icon);
        out.push(this.add.image(cx, by, ATLAS, frame).setOrigin(0.5, 1).setScale(2).setDepth(y * T + 14));
        if (D.MACHINES[o.k] && o.job && G.absMin(s) >= o.job.ready) {
          const bub = this.add.image(cx, y * T - 8, ATLAS, D.ITEMS[o.job.out].icon).setScale(2).setDepth(y * T + 30);
          this.tweens.add({ targets: bub, y: bub.y - 3, duration: 500, yoyo: true, repeat: -1 });
          out.push(bub);
        }
      }
    }
    if (out.length) this.objSprites.set(k, out);
  }

  drawMine() {
    const m = this.s.mine;
    this.rockSprites = new Map();
    const tint = { stone: 0xffffff, copper: 0xffa070, iron: 0xd8e0ff, gold: 0xffe040, gem: 0xe080ff };
    for (const r of m.rocks) {
      const im = this.add.image(r.x * T + 16, r.y * T + 32, ATLAS, 'rock').setOrigin(0.5, 1).setScale(2).setDepth(r.y * T + 14).setTint(tint[r.kind]);
      this.rockSprites.set(`${r.x},${r.y}`, im);
      if (r.kind === 'gem') this.tweens.add({ targets: im, alpha: 0.75, duration: 500, yoyo: true, repeat: -1 });
    }
    this.add.image(m.up.x * T, m.up.y * T, ATLAS, 'ladderUp').setOrigin(0).setScale(2).setDepth(2);
    this.ladderImg = this.add.image(m.ladder?.x * T || 0, m.ladder?.y * T || 0, ATLAS, 'stairs').setOrigin(0).setScale(2).setDepth(2).setVisible(!!m.ladderOpen);
    if (m.chest) this.chestImg = this.add.image(m.chest.x * T + 16, m.chest.y * T + 32, ATLAS, this.s.flags[`chest${m.floor}`] ? 'chestOpen' : 'chest').setOrigin(0.5, 1).setScale(2).setDepth(m.chest.y * T + 14);
    for (const sl of m.slimes) this.addSlime(sl);
    // the mine is dim
    this.add.rectangle(0, VIEW_TOP, WIDTH, VIEW_BOTTOM - VIEW_TOP, 0x100818, 0.25).setOrigin(0).setScrollFactor(0).setDepth(3000);
  }

  addSlime(sl) {
    const c = SLIME_COLOR[sl.kind];
    const im = this.add.image(sl.x * T + 16, sl.y * T + 16, ATLAS, `slime${c}Idle0`).setScale(2).setDepth(sl.y * T + 15);
    im.f = 0;
    this.slimeSprites.set(sl, im);
  }

  placePlayer() {
    const s = this.s;
    this.player.setPosition(s.x * T + 16, s.y * T + 14).setDepth(s.y * T + 16);
    this.player.setFrame(`pIdle${DIR_NAME[s.face]}0`);
  }

  weatherLayer() {
    const s = this.s;
    this.night = this.add.rectangle(0, VIEW_TOP, WIDTH, VIEW_BOTTOM - VIEW_TOP, 0x141040, 1).setOrigin(0).setAlpha(0).setScrollFactor(0).setDepth(3001);
    this.rain = null;
    if (s.map !== 'mine' && ['rain', 'storm', 'snow'].includes(s.weather)) {
      this.rain = this.add.graphics().setScrollFactor(0).setDepth(3002);
      this.drops = Array.from({ length: s.weather === 'snow' ? 40 : 55 }, () => ({ x: Math.random() * WIDTH, y: VIEW_TOP + Math.random() * (VIEW_BOTTOM - VIEW_TOP), v: 0.6 + Math.random() * 0.6 }));
    }
    this.syncNight();
  }

  syncNight() {
    const s = this.s;
    if (s.map === 'mine') return;
    const t = s.time;
    const a = t < 1080 ? 0 : Math.min(0.5, (t - 1080) / 240 * 0.5);
    this.night.setAlpha(a + (s.weather === 'storm' || s.weather === 'rain' ? 0.08 : 0));
  }

  cameraTo(instant) {
    const cam = this.cameras.main;
    const m = this.mapDef;
    const mw = m.tiles[0].length * T; const mh = m.tiles.length * T;
    const bottom = this.dialog ? DIALOG_TOP : VIEW_BOTTOM;
    const viewH = bottom - VIEW_TOP;
    const sx = mw <= WIDTH ? (mw - WIDTH) / 2 : Phaser.Math.Clamp(this.player.x - WIDTH / 2, 0, mw - WIDTH);
    const sy = mh <= viewH ? (mh - viewH) / 2 - VIEW_TOP : Phaser.Math.Clamp(this.player.y - VIEW_TOP - viewH / 2, -VIEW_TOP, mh - bottom);
    if (instant) { cam.scrollX = Math.round(sx); cam.scrollY = Math.round(sy); return; }
    cam.scrollX = Math.round(cam.scrollX + (sx - cam.scrollX) * 0.3);
    cam.scrollY = Math.round(cam.scrollY + (sy - cam.scrollY) * 0.3);
  }

  // ------------------------------------------------------------ people and animals

  /** Put villagers where their schedule says (called on every clock tick). */
  syncNpcs(instant = false) {
    const s = this.s;
    if (s.map === 'mine') return;
    const here = new Map(G.villagersOn(s).map((v) => [v.id, v]));
    for (const [id, spr] of this.npcSprites) {
      if (!here.has(id)) { spr.destroy(); this.npcSprites.delete(id); }
    }
    for (const [id, v] of here) {
      let spr = this.npcSprites.get(id);
      if (!spr) {
        spr = this.add.image(v.x * T + 16, v.y * T + 14, ATLAS, `npc${D.VILLAGERS[id].row}_0`).setScale(2).setDepth(v.y * T + 16);
        spr.f = Math.floor(Math.random() * 4);
        this.npcSprites.set(id, spr);
        if (!instant) { spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: 1, duration: 300 }); }
      }
      if (spr.tx !== v.x || spr.ty !== v.y) {
        spr.tx = v.x; spr.ty = v.y;
        if (instant || !spr.visible) spr.setPosition(v.x * T + 16, v.y * T + 14);
        else this.tweens.add({ targets: spr, x: v.x * T + 16, y: v.y * T + 14, duration: 600 });
        spr.setDepth(v.y * T + 16);
      }
    }
    this.markHeartDots();
  }

  markHeartDots() {
    this.npcDots?.forEach((d) => d.destroy());
    this.npcDots = [];
    const s = this.s;
    for (const [id, spr] of this.npcSprites) {
      if (s.friends[id].talk === G.dayIndex(s)) continue;
      const d = text(this, spr.tx * T + 16, spr.ty * T - 16, '!', { color: PALETTE.gold }).setDepth(4000);
      this.tweens.add({ targets: d, y: d.y - 3, duration: 400, yoyo: true, repeat: -1 });
      this.npcDots.push(d);
    }
  }

  npcAt(x, y) {
    for (const [id, spr] of this.npcSprites) if (spr.tx === x && spr.ty === y) return id;
    return null;
  }

  syncAnimals(instant = false) {
    const s = this.s;
    if (s.map !== 'farm') return;
    for (const a of s.animals) {
      let spr = this.animalSprites.get(a.id);
      const frames = D.ANIMALS[a.kind].frames;
      const brown = a.brown ? (a.kind === 'chicken' ? 'chickenB' : 'cowB') : a.kind;
      if (!spr) {
        spr = this.add.image(a.x * T + 16, a.y * T + 30, ATLAS, `${brown}0`).setOrigin(0.5, 1).setScale(2);
        spr.bub = this.add.image(0, 0, ATLAS, 'i_egg').setScale(2).setVisible(false);
        this.tweens.add({ targets: spr.bub, scale: 2.3, duration: 400, yoyo: true, repeat: -1 });
        this.animalSprites.set(a.id, spr);
      }
      spr.base = brown;
      spr.setFlipX(a.dir === -1);
      if (instant) spr.setPosition(a.x * T + 16, a.y * T + 30);
      else this.tweens.add({ targets: spr, x: a.x * T + 16, y: a.y * T + 30, duration: 500 });
      spr.setDepth(a.y * T + 15);
      spr.bub.setVisible(!!a.product).setPosition(a.x * T + 16, a.y * T - 10).setDepth(4000);
      if (a.product) spr.bub.setFrame(D.ITEMS[a.product].icon);
      void frames;
    }
  }

  occupied(x, y) {
    if (this.npcAt(x, y)) return true;
    const s = this.s;
    if (G.animalAt(s, x, y)) return true;
    if (s.map === 'mine' && s.mine.slimes.some((sl) => sl.x === x && sl.y === y)) return true;
    return false;
  }

  // ------------------------------------------------------------ HUD

  hud() {
    const s = this.s;
    const D0 = 5000;
    const fix = (o) => pin(o).setDepth(D0 + 1);
    header(this, '', () => this.leave());
    this.clockText = fix(text(this, WIDTH / 2, 15, '', { color: PALETTE.cream }));
    this.infoText = fix(text(this, WIDTH / 2, 38, '', { color: PALETTE.sand }));
    // task line
    this.taskBg = fix(this.add.rectangle(WIDTH / 2, VIEW_TOP + 14, WIDTH, 26, hex(PALETTE.ink), 0.7));
    this.taskText = fix(text(this, WIDTH / 2, VIEW_TOP + 14, '', { color: PALETTE.gold }));
    this.marker = text(this, 0, 0, 'v', { size: 32, color: PALETTE.gold }).setDepth(4500).setVisible(false);
    this.tweens.add({ targets: this.marker, y: '-=6', duration: 350, yoyo: true, repeat: -1 });

    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, HEIGHT - VIEW_BOTTOM, hex(PALETTE.night)).setOrigin(0).setScrollFactor(0).setDepth(D0);
    this.add.rectangle(0, VIEW_BOTTOM, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setScrollFactor(0).setDepth(D0);

    // tool bar: 6 tools + 2 hand slots
    this.slots = [];
    for (let i = 0; i < 8; i++) {
      const x = 22 + i * 45;
      const c = this.add.container(x, BAR_Y).setScrollFactor(0).setDepth(D0 + 1);
      const edge = this.add.rectangle(0, 0, 42, 42, hex(PALETTE.ink));
      const face = this.add.rectangle(0, 0, 36, 36, hex(i < 6 ? 0x4a4038 : 0x3a3450));
      const icon = this.add.image(0, -1, ATLAS, 'i_stone').setScale(2);
      const n = text(this, 17, 11, '', { color: PALETTE.cream, origin: [1, 0.5] });
      const lv = this.add.rectangle(-14, -14, 6, 6, 0xd88038).setVisible(false);
      c.add([edge, face, icon, n, lv]);
      c.edge = edge; c.icon = icon; c.n = n; c.lv = lv;
      const zone = this.add.zone(x, BAR_Y, 45, 48).setScrollFactor(0).setDepth(D0 + 2).setInteractive();
      zone.on('pointerup', () => this.selectSlot(i, true));
      this.slots.push(c);
    }

    // thumb pad (one big zone, direction from the thumb's position), like Pocket Pets
    const pad = [['up', PAD.x, PAD.y - 44, '^'], ['left', PAD.x - 46, PAD.y, '<'], ['right', PAD.x + 46, PAD.y, '>'], ['down', PAD.x, PAD.y + 44, 'v']];
    this.add.rectangle(PAD.x, PAD.y, 40, 40, hex(PALETTE.indigo)).setScrollFactor(0).setDepth(D0);
    const faces = {};
    for (const [dir, x, y, label] of pad) {
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(D0 + 1);
      const sh = this.add.rectangle(0, 3, 44, 40, hex(PALETTE.ink));
      const face = this.add.rectangle(0, 0, 44, 40, hex(PALETTE.lavender)).setStrokeStyle(3, hex(PALETTE.ink));
      const t = text(this, 0, -2, label, { size: 32, color: PALETTE.night });
      c.add([sh, face, t]);
      pin(c);
      faces[dir] = (on) => { face.y = on ? 2 : 0; t.y = on ? 0 : -2; face.setFillStyle(hex(on ? PALETTE.gold : PALETTE.lavender)); };
    }
    this.showDir = (dir) => Object.entries(faces).forEach(([d, f]) => f(d === dir));
    const dirFrom = (p) => {
      const dx = p.x - PAD.x; const dy = p.y - PAD.y;
      if (Math.hypot(dx, dy) < 10) return this.held;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    const zone = this.add.zone(PAD.x, PAD.y, 140, 136).setScrollFactor(0).setDepth(D0 + 2).setInteractive();
    zone.on('pointerdown', (p) => {
      if (this.dialog) { this.advanceDialog(); return; }
      if (blocking() || modalOpen(this) || this.busy) return;
      const dir = dirFrom(p) || 'down';
      this.held = dir; this.heldId = p.id; this.path = null; this.pending = null;
      this.showDir(dir);
      if (!this.moving) this.tryStep(dir);
    });
    this.input.on('pointermove', (p) => {
      if (!this.held || p.id !== this.heldId || !p.isDown) return;
      const dir = dirFrom(p);
      if (dir && dir !== this.held) { this.held = dir; this.showDir(dir); }
    });

    this.aBtn = fix(button(this, 182, 556, 64, 54, 'A', () => this.pressA(), { size: 32, fill: PALETTE.gold, silent: true }));
    // energy and health
    this.energyBar = fix(this.add.graphics());
    this.eLabel = fix(text(this, 148, 604, 'E', { color: PALETTE.cream }));
    this.hpLabel = fix(text(this, 148, 624, 'HP', { color: PALETTE.cream })).setVisible(false);
    fix(button(this, 298, 526, 112, 42, 'Bag', () => this.openBag(), { fill: PALETTE.cream }));
    fix(button(this, 298, 574, 112, 42, 'Craft', () => this.openCraft(), { fill: PALETTE.cream }));
    this.menuBtn = fix(button(this, 298, 622, 112, 36, 'Menu', () => this.openMenu(), { fill: PALETTE.lavender }));
    this.refreshHud();
  }

  refreshHud() {
    const s = this.s;
    this.clockText.setText(`${D.SEASON_SHORT[s.season]} ${s.day} ${D.WEEKDAYS[G.weekday(s)]}  ${G.clockText(s.time)}`);
    fit(this.clockText, 226);
    const where = s.map === 'mine' ? `Mine floor ${s.mine.floor}` : weatherText(s.weather);
    this.infoText.setText(`${where}   ${fmt(s.gold)}g`);
    fit(this.infoText, 226);
    // bar
    for (let i = 0; i < 8; i++) {
      const c = this.slots[i];
      let frame = null; let n = ''; let lv = 0;
      if (i < 6) { const t = D.TOOLS[i]; frame = D.TOOL_INFO[t].icon; lv = s.tools[t]; if (t === 'can') n = String(s.water); }
      else { const id = s.hand[i - 6]; if (id && s.inv[id]) { frame = D.ITEMS[id].icon; n = String(s.inv[id]); } }
      c.icon.setVisible(!!frame);
      if (frame) c.icon.setFrame(frame);
      c.n.setText(i >= 6 && !frame ? '+' : n).setScale(1);
      if (i >= 6 && !frame) c.n.setPosition(0, 0).setOrigin(0.5); else c.n.setPosition(18, 12).setOrigin(1, 0.5);
      fit(c.n, 34);
      c.lv.setVisible(lv > 0).setFillStyle(lv === 2 ? 0xd8e0ff : 0xd88038);
      c.edge.setFillStyle(hex(i === s.slot ? PALETTE.gold : PALETTE.ink));
    }
    // energy / health bars
    const g = this.energyBar;
    g.clear();
    const bar = (y, frac, color) => {
      g.fillStyle(hex(PALETTE.ink)).fillRect(160, y - 7, 70, 14);
      g.fillStyle(0x3a3a3a).fillRect(162, y - 5, 66, 10);
      g.fillStyle(color).fillRect(162, y - 5, Math.round(66 * Math.max(0, Math.min(1, frac))), 10);
    };
    const ef = s.energy / D.MAX_ENERGY;
    bar(604, ef, ef > 0.5 ? 0x5fbf4a : ef > 0.2 ? 0xe3b23c : 0xd84848);
    const inMine = s.map === 'mine';
    this.hpLabel.setVisible(inMine);
    if (inMine) bar(624, s.hp / D.MAX_HP, 0xd84848);
    this.refreshTask();
  }

  refreshTask() {
    const s = this.s;
    const tut = G.tutorial(s);
    let msg = tut?.text || '';
    if (this.hunt) msg = `Eggs: ${this.hunt.got}/${this.hunt.total}   Time: ${Math.ceil(this.hunt.left)}s`;
    else if (!msg && G.festivalOpen(s) && s.map !== 'town') msg = `${G.festivalToday(s).name} in town until 2pm!`;
    else if (!msg && s.map === 'mine') msg = s.mine.ladderOpen ? 'The ladder down is open!' : 'Find the ladder under a rock';
    this.taskText.setText(msg);
    fit(this.taskText, WIDTH - 16);
    this.taskBg.setVisible(!!msg && !this.dialog);
    this.taskText.setVisible(!!msg && !this.dialog);
    // marker over the tutorial target
    const tg = tut?.target;
    if (tg && tg.map === s.map && !this.dialog) this.marker.setVisible(true).setPosition(tg.x * T + 16, tg.y * T - 18);
    else if (tut && tut.step === 4 && s.map === 'farm') this.marker.setVisible(true).setPosition(22 * T + 16, 7 * T - 18);
    else this.marker.setVisible(false);
    // pulse the slot the tutorial wants
    const want = tut ? { 1: 0, 2: 6, 3: 1 }[tut.step] : undefined;
    this.slots.forEach((c, i) => { c.setAlpha(want != null && i === want && s.slot !== i ? (Date.now() % 800 < 400 ? 0.5 : 1) : 1); });
  }

  selectSlot(i, tapped = false) {
    const s = this.s;
    if (this.dialog || blocking() || modalOpen(this)) return;
    if (i >= 6 && (!s.hand[i - 6] || !s.inv[s.hand[i - 6]] || (tapped && s.slot === i))) {
      bagPanel(s, { forSlot: i - 6, onChange: () => this.refreshHud() });
      return;
    }
    s.slot = i;
    sfx('select');
    const sel = G.selected(s);
    toast(this, sel.tool ? `${D.TOOL_LEVELS[s.tools[sel.tool]]}${D.TOOL_INFO[sel.tool].name}: ${D.TOOL_INFO[sel.tool].tip}` : sel.item ? D.ITEMS[sel.item].name : '', { ms: 900 });
    this.refreshHud();
  }

  canMenu() { return !this.busy && !this.dialog && !this.moving && !blocking() && !modalOpen(this) && !this.hunt; }
  openBag() { if (!this.canMenu()) return; bagPanel(this.s, { onChange: () => this.refreshHud() }); }
  openCraft() { if (!this.canMenu()) return; craftPanel(this.s, { onChange: (m) => { this.refreshHud(); if (m) toast(this, m); } }); }
  openMenu() {
    if (!this.canMenu()) return;
    menuPanel(this.s, {
      onFriends: () => friendsPanel(this.s),
      onBoard: () => this.openBoard(),
      onTitle: () => this.leave(),
      onChange: () => this.music(true),
    });
  }

  leave() {
    if (this.busy || this.dialog || this.hunt || modalOpen(this)) { sfx('error'); return; }
    persist();
    go(this, 'Title');
  }

  // ------------------------------------------------------------ input

  onKey(e, down) {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
    if (dir) { if (down) { if (!this.dialog && !blocking() && !modalOpen(this)) { this.held = dir; this.path = null; } } else if (this.held === dir) this.held = null; return; }
    if (!down) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') { if (this.dialog) this.advanceDialog(); else this.pressA(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 8) this.selectSlot(n - 1);
  }

  onTap(p) {
    if (blocking() || modalOpen(this)) return;
    if (Date.now() - (this.__modalClosedAt || 0) < 250) return;
    if (p.y < VIEW_TOP || p.y > VIEW_BOTTOM) return;
    if (this.dialog) { this.advanceDialog(); return; }
    if (this.busy) return;
    const wx = p.x + this.cameras.main.scrollX; const wy = p.y + this.cameras.main.scrollY;
    // people are drawn a little above their tile: a tap on the sprite counts as a tap on them
    for (const [, spr] of this.npcSprites) if (Math.abs(wx - spr.x) <= 16 && Math.abs(wy - spr.y) <= 18) { this.tapTile(spr.tx, spr.ty); return; }
    this.tapTile(Math.floor(wx / T), Math.floor(wy / T));
  }

  /** Tap on a tile: use it if it's next to you, walk up to it and use it, or walk there. */
  tapTile(tx, ty) {
    const s = this.s;
    if (!this.canAct()) return;
    const m = this.mapDef;
    if (!G.inBounds(m, tx, ty)) return;
    if (tx === s.x && ty === s.y) return;
    const dist = Math.abs(tx - s.x) + Math.abs(ty - s.y);
    if (dist === 1) { this.path = null; this.act(tx, ty); return; }
    const b = s.map !== 'mine' && buildingAt(m, tx, ty);
    if (b) { const d = doorOf(b); this.walkThen(d.x, d.y + 1, false, { x: d.x, y: d.y }); return; }
    const walk = G.walkable(s, tx, ty) && !this.occupied(tx, ty);
    const tile = s.map === 'mine' ? m.tiles[ty][tx] : tileAt(m, tx, ty);
    const sel = G.selected(s);
    if (!walk) {
      if (G.interactable(s, tx, ty)) { this.walkThen(tx, ty, true); return; }
      if (tile === 'T' || tile === 'X' || tile === '|' || tile === '-') { sfx('error'); return; }
      if (tile === '~' && sel.tool !== 'rod' && sel.tool !== 'can') { sfx('error'); toast(this, 'Pick the rod to fish, or the can to fill it.', { ms: 1200 }); return; }
      this.walkThen(tx, ty, true);
      return;
    }
    if (this.hunt) { this.walkTo(tx, ty); return; }
    if (this.wouldAct(sel, tx, ty)) { this.walkThen(tx, ty, true); return; }
    this.walkTo(tx, ty);
  }

  /** Would the selected tool or item do something on this (walkable) tile? */
  wouldAct(sel, x, y) {
    const s = this.s;
    if (s.map !== 'farm') return false;
    const so = G.soilAt(s, 'farm', x, y);
    if (so?.crop && G.cropStage(so.crop) === 'ready') return true;
    if (sel.tool === 'hoe') return !so && tileAt(MAPS.farm, x, y) !== '=';
    if (sel.tool === 'can') return !!so && !so.wet;
    if (sel.tool === 'sword') return !!so?.crop?.dead;
    if (sel.item) {
      const it = D.ITEMS[sel.item];
      if (it.kind === 'seed') return !!so && !so.crop;
      if (it.kind === 'fertilizer') return !!so && !so.compost && !so.crop;
      if (it.kind === 'place') return !so;
    }
    return false;
  }

  walkTo(tx, ty) {
    const path = G.findPath(this.s, tx, ty, { blocked: (x, y) => this.occupied(x, y) });
    if (!path) { sfx('error'); return; }
    this.path = path; this.pending = null;
    this.tapMarker(tx, ty);
  }

  walkThen(tx, ty, adjacent, use = { x: tx, y: ty }) {
    const s = this.s;
    const path = G.findPath(s, tx, ty, { adjacent, blocked: (x, y) => this.occupied(x, y) });
    if (!path) { sfx('error'); return; }
    this.path = path;
    this.pending = use;
    this.tapMarker(use.x, use.y);
    if (!path.length) this.finishPath();
  }

  tapMarker(tx, ty) {
    const mk = this.add.rectangle(tx * T + 16, ty * T + 16, 24, 24).setStrokeStyle(3, 0xf9f5ef).setDepth(4000);
    this.tweens.add({ targets: mk, scale: 0.4, alpha: 0, duration: 450, onComplete: () => mk.destroy() });
  }

  finishPath() {
    const use = this.pending;
    this.pending = null;
    if (!use) return;
    const s = this.s;
    if (Math.abs(use.x - s.x) + Math.abs(use.y - s.y) !== 1) return;
    this.act(use.x, use.y);
  }

  canAct() { return !this.busy && !this.dialog && !blocking() && !modalOpen(this); }

  pressA() {
    if (this.dialog) { this.advanceDialog(); return; }
    if (!this.canAct() || this.moving) return;
    const f = G.facing(this.s);
    this.act(f.x, f.y);
  }

  // ------------------------------------------------------------ movement and the clock

  update(time, delta) {
    if (!this.s || !this.player) return;
    this.cameraTo(false);
    this.animate(delta);
    const paused = this.busy || this.dialog || blocking() || modalOpen(this) || !!document.getElementById('howto');
    if (this.hunt && !paused) this.huntTick(delta);
    if (!paused && !this.hunt) this.clock(delta);
    if (!paused && this.s.map === 'mine') this.slimeTick(delta);
    if (!paused && this.s.map === 'farm') {
      this.animalAcc += delta;
      if (this.animalAcc > 2200) { this.animalAcc = 0; G.wanderAnimals(this.s); this.syncAnimals(); }
    }
    if (paused || this.moving) return;
    if (this.path && this.path.length) {
      const [nx, ny] = this.path.shift();
      const dir = G.dirTo(this.s.x, this.s.y, nx, ny);
      if (!this.tryStep(dir)) { this.path = null; this.pending = null; }
      return;
    }
    if (this.path && !this.path.length) { this.path = null; this.finishPath(); return; }
    if (this.held) this.tryStep(this.held);
  }

  animate(delta) {
    this.animT = (this.animT || 0) + delta;
    if (this.animT < 180) return;
    this.animT = 0;
    for (const [id, spr] of this.npcSprites) { spr.f = (spr.f + 1) % 4; spr.setFrame(`npc${D.VILLAGERS[id].row}_${spr.f}`); }
    this.animTick = (this.animTick || 0) + 1;
    if (this.animTick % 3 === 0) for (const [, spr] of this.animalSprites) spr.setFrame(`${spr.base}${(this.animTick / 3) % 2}`);
    for (const [sl, im] of this.slimeSprites) { if (im.hurt) continue; im.f = (im.f + 1) % 4; im.setFrame(`slime${SLIME_COLOR[sl.kind]}Idle${im.f}`); }
    if (this.rain) {
      const g = this.rain; g.clear();
      const snow = this.s.weather === 'snow';
      g.lineStyle(2, snow ? 0xffffff : 0x9ec8f0, snow ? 0.9 : 0.6);
      for (const d of this.drops) {
        d.y += (snow ? 8 : 26) * d.v; d.x += snow ? Math.sin(d.y / 30) * 2 : -4;
        if (d.y > VIEW_BOTTOM) { d.y = VIEW_TOP; d.x = Math.random() * WIDTH + 20; }
        if (snow) g.fillStyle(0xffffff, 0.9).fillRect(d.x, d.y, 3, 3);
        else g.lineBetween(d.x, d.y, d.x - 4, d.y + 12);
      }
    }
    this.refreshTask();
  }

  clock(delta) {
    this.acc += delta;
    if (this.acc < MS_PER_TICK) return;
    this.acc -= MS_PER_TICK;
    const s = this.s;
    const wasFest = !!G.festivalOpen(s);
    const r = G.passTime(s, 10);
    this.refreshHud();
    this.syncNight();
    if (s.map !== 'mine') this.syncNpcs();
    this.music();
    // machines finishing
    if (s.map === 'farm') for (const [k, o] of Object.entries(s.objs.farm)) if (o.job && G.absMin(s) >= o.job.ready && !o.shown) { o.shown = true; this.drawTile(k); }
    if (wasFest && !G.festivalOpen(s) && s.map === 'town') toast(this, 'The festival is over for today.');
    if (r.midnight) toast(this, "It's midnight! Head home to bed.", { color: PALETTE.gold, ms: 2500 });
    if (s.time === 23 * 60) toast(this, "It's getting late...", { ms: 2000 });
    if (r.passOut) this.passOut();
  }

  tryStep(dir) {
    const s = this.s;
    const before = { x: s.x, y: s.y, map: s.map };
    if (s.face !== dir) { s.face = dir; this.player.setFrame(`pIdle${DIR_NAME[dir]}0`); }
    const res = G.step(s, dir, (x, y) => this.occupied(x, y));
    if (!res.moved) return false;
    this.moving = true;
    const tx = (res.exit ? before.x + G.DIRS[dir][0] : s.x) * T + 16;
    const ty = (res.exit ? before.y + G.DIRS[dir][1] : s.y) * T + 14;
    this.walkFrame = ((this.walkFrame || 0) + 1) % 4;
    this.player.setFrame(`pWalk${DIR_NAME[dir]}${this.walkFrame}`);
    this.tweens.add({
      targets: this.player, x: tx, y: ty, duration: STEP_MS,
      onUpdate: () => this.player.setDepth(this.player.y + 2),
      onComplete: () => {
        this.moving = false;
        if (res.exit) { this.changeMap(); return; }
        this.player.setFrame(`pWalk${DIR_NAME[dir]}${(this.walkFrame + 1) % 4}`);
        this.time.delayedCall(90, () => { if (!this.moving) this.player.setFrame(`pIdle${DIR_NAME[s.face]}0`); });
        this.placePlayer();
        this.afterStep();
      },
    });
    return true;
  }

  afterStep() {
    const s = this.s;
    if (this.hunt) this.huntCheck();
    // time passes a little as you walk
    this.acc += 60;
    void s;
  }

  changeMap() {
    this.busy = true; this.path = null; this.held = null;
    persist();
    this.cameras.main.fadeOut(160, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ arrived: true }));
  }

  music(force = false) {
    const s = this.s;
    let name = ['spring', 'summer', 'fall', 'winter'][s.season];
    if (s.map === 'mine') name = 'mine';
    else if (this.hunt || (G.festivalOpen(s) && s.map === 'town')) name = 'festival';
    else if (s.time >= 20 * 60) name = 'night';
    if (force) playMusic(null);
    playMusic(name);
  }

  // ------------------------------------------------------------ arriving

  arrive() {
    const s = this.s;
    const o = this.opts;
    flushAwards();
    if (o.intro) {
      this.say([
        'Mayor Alder: Welcome to Hearth Farm! It\'s a bit overgrown, but the soil is good.',
        'Mayor Alder: I left a letter in your mailbox. Read it, then let\'s get some radishes in the ground.',
      ], 2, () => this.refreshHud());
      return;
    }
    if (o.summary) {
      jingle('morning');
      summaryPanel(s, o.summary, { onClose: () => this.afterMorning() });
      return;
    }
    if (o.ending) { this.say(['Mayor Alder: Thank you, from all of Emberbrook. The hall is ours again!'], 2); return; }
    if (o.knocked) {
      const lost = o.knocked.lost.map(([id, n]) => `${n} ${D.ITEMS[id].name}`).join(', ');
      jingle('sad');
      this.say(['You blacked out in the mine...', `Bram found you and carried you home.${lost ? ` You lost ${lost}.` : ''}`], null);
      return;
    }
    if (s.map === 'town' && G.festivalOpen(s)) { this.festivalPrompt(); return; }
    if (s.map === 'woods' && o.arrived && !s.flags.woodsHint) { s.flags.woodsHint = true; toast(this, 'Whisperwood: forage, chop trees, fish the lake. The mine is up north.', { ms: 3000 }); }
  }

  afterMorning() {
    const s = this.s;
    if (s.yearReview && !s.yearReview.shown) {
      s.yearReview.shown = true;
      persist();
      const r = s.yearReview;
      jingle(r.restored ? 'fanfare' : 'sad');
      modal(this, `Year ${r.year} is over`, r.restored
        ? ['Mayor Alder: What a year! The hall stands proud again, all thanks to you.', `You earned ${fmt(r.earned)}g from the bin. A new spring begins.`]
        : [`Mayor Alder: A whole year already! The hall still needs ${D.BUNDLES.length - r.bundles} bundle${D.BUNDLES.length - r.bundles === 1 ? '' : 's'}.`, 'Don\'t worry, there\'s no rush. We\'ll keep at it together.', `You earned ${fmt(r.earned)}g from the bin.`],
      [['A new spring!', () => this.afterMorning()]]);
      return;
    }
    if (G.unread(s)) toast(this, 'You have mail!', { color: PALETTE.gold });
    const f = G.festivalToday(s);
    if (f && !s.fest[`${s.year}-${f.id}`]) toast(this, `Today: the ${f.name} in town, 9am-2pm!`, { color: PALETTE.gold, ms: 2600 });
    flushAwards();
  }

  // ------------------------------------------------------------ dialogue

  say(lines, faceRow, done) {
    if (!lines || !lines.length) { done?.(); return; }
    this.dialog?.c.destroy();
    this.path = null; this.held = null; this.showDir?.(null);
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(6000);
    const top = DIALOG_TOP; const h = 118;
    c.add(panel(this, 6, top, WIDTH - 12, h, { fill: PALETTE.cream, inner: PALETTE.night, border: PALETTE.ink }));
    let tx = 22;
    if (faceRow != null) {
      c.add(this.add.rectangle(46, top + h / 2, 62, 62, 0xe9dcc0).setStrokeStyle(3, hex(PALETTE.ink)));
      c.add(this.add.image(46, top + h / 2, ATLAS, `npc${faceRow}_0`).setScale(3.4));
      tx = 86;
    }
    const t = text(this, tx, top + 14, '', { origin: 0, align: 'left', color: PALETTE.night, wrap: WIDTH - tx - 24 });
    const more = text(this, WIDTH - 24, top + h - 16, 'v', { color: PALETTE.red });
    this.tweens.add({ targets: more, y: more.y + 3, duration: 300, yoyo: true, repeat: -1 });
    c.add([t, more]);
    pin(c);
    this.dialog = { c, t, lines: [...lines], done };
    this.showLine();
    this.refreshTask();
  }

  showLine() {
    const d = this.dialog;
    const line = d.lines.shift();
    d.t.setText(line);
    if (d.t.height > 94) {
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
    if (!d || Date.now() - d.shownAt < 200) return;
    sfx('tap');
    if (d.lines.length) { this.showLine(); return; }
    d.c.destroy();
    this.dialog = null;
    this.refreshTask();
    d.done?.();
  }

  // ------------------------------------------------------------ doing things

  faceTo(x, y) {
    const s = this.s;
    if (Math.abs(x - s.x) + Math.abs(y - s.y) === 1) s.face = G.dirTo(s.x, s.y, x, y);
    this.player.setFrame(`pIdle${DIR_NAME[s.face]}0`);
  }

  /** Use the tile next to you (A button, tap, or the end of a walk). */
  act(x, y) {
    const s = this.s;
    if (!this.canAct()) return;
    this.faceTo(x, y);
    const sel = G.selected(s);
    const npc = this.npcAt(x, y);
    if (npc) {
      if (sel.item && G.giftable(sel.item)) this.offerGift(npc, sel.item); else this.talkTo(npc);
      return;
    }
    const animal = G.animalAt(s, x, y);
    if (animal) { this.petAnimal(animal); return; }
    if (this.hunt) { this.huntCheck(x, y); return; }
    if (s.map === 'mine') { this.mineAct(x, y, sel); return; }
    const it = G.interactable(s, x, y);
    if (it) { this.handle(it, x, y); return; }
    if (sel.tool) this.useTool(sel.tool, x, y);
    else if (sel.item) this.useItem(sel.item, x, y);
    else { sfx('error'); toast(this, 'Pick a tool or an item in the bar first.'); }
  }

  swing(tool, x, y, then) {
    const s = this.s;
    this.busy = true;
    const dir = DIR_NAME[s.face];
    let f = 0;
    this.player.setFrame(`pHit${dir}0`);
    const ic = this.add.image(x * T + 16, y * T + 10, ATLAS, D.TOOL_INFO[tool]?.icon || 'i_sword').setScale(2).setDepth(4000).setAngle(-40);
    this.tweens.add({ targets: ic, angle: 40, duration: 180, onComplete: () => ic.destroy() });
    this.time.addEvent({ delay: 55, repeat: 3, callback: () => { f++; if (f < 4) this.player.setFrame(`pHit${dir}${f}`); } });
    this.time.delayedCall(220, () => { this.busy = false; this.player.setFrame(`pIdle${dir}0`); then?.(); });
  }

  useTool(tool, x, y) {
    const s = this.s;
    const r = G.useTool(s, tool, x, y);
    if (!r.ok) { sfx('error'); if (r.msg) toast(this, r.msg); return; }
    if (r.fish) { this.swing('rod', x, y, () => this.startFishing(r.fish)); this.refreshHud(); return; }
    this.swing(tool, x, y, () => {
      const snd = { till: () => sfx('thud'), water: () => swish('water'), refill: () => swish('water'), chop: () => sfx('hit'), smash: () => sfx('smallBoom'), hitRock: () => sfx('hit'), cut: () => swish('cut'), pickup: () => sfx('place'), pick: () => sfx('select') }[r.fx];
      snd?.();
      if (r.msg && r.fx === 'refill') toast(this, r.msg, { ms: 900 });
      if (r.fx === 'chop' || r.fx === 'hitRock') this.shake(x, y);
      for (const k of this.tilesAround(tool, x, y)) this.drawTile(k);
      this.gotItems(r.got, x, y);
      this.refreshHud();
      flushAwards();
    });
  }

  tilesAround(tool, x, y) { return G.toolArea(this.s, tool, x, y).map(([a, b]) => `${a},${b}`); }

  shake(x, y) {
    const sp = this.objSprites.get(`${x},${y}`);
    if (sp) for (const o of sp) this.tweens.add({ targets: o, x: o.x + 3, duration: 40, yoyo: true, repeat: 1 });
  }

  gotItems(got, x, y) {
    if (!got?.length) return;
    got.forEach(([id, n], i) => {
      const ic = this.add.image(x * T + 16, y * T + 8, ATLAS, D.ITEMS[id].icon).setScale(2).setDepth(4500);
      this.tweens.add({ targets: ic, y: ic.y - 30 - i * 10, alpha: 0, duration: 700, delay: i * 120, onComplete: () => ic.destroy() });
    });
    toast(this, got.map(([id, n]) => `+${n} ${D.ITEMS[id].name}`).join('  '), { ms: 1000 });
  }

  useItem(id, x, y) {
    const s = this.s;
    const r = G.useItem(s, id, x, y);
    if (r.eat) { this.offerEat(id); return; }
    if (r.stair) return;
    if (!r.ok) { sfx('error'); if (r.msg) toast(this, r.msg); return; }
    sfx('place');
    this.drawTile(`${x},${y}`);
    this.refreshHud();
  }

  offerEat(id) {
    const it = D.ITEMS[id];
    modal(this, `Eat ${it.name}?`, [`+${it.energy} energy, +${Math.ceil(it.energy / 2)} health.`, `Energy now ${this.s.energy}/${D.MAX_ENERGY}.`], [
      ['Eat it', () => { if (G.eat(this.s, id)) { sfx('power'); this.refreshHud(); } }],
      ['Not now', null],
    ]);
  }

  handle(it, x, y) {
    const s = this.s;
    switch (it.t) {
      case 'door': this.door(it.b); break;
      case 'mail': this.readMail(); break;
      case 'bin': sfx('select'); shipPanel(s, { onChange: () => this.refreshHud() }); break;
      case 'board': this.openBoard(); break;
      case 'trough': {
        const r = G.feedTrough(s, it.home);
        if (r.fed) { sfx('place'); toast(this, r.full ? 'The trough is full. Your animals will eat tonight.' : `Added ${r.fed} hay. Not enough for everyone!`); } else { sfx('error'); toast(this, r.msg); }
        this.refreshFixtures(); this.refreshHud();
        break;
      }
      case 'machine': {
        const r = G.useMachine(s, it.k);
        if (r.got) { sfx('coin'); this.gotItems([[r.got, 1]], x, y); }
        else if (r.started) { sfx('place'); toast(this, `Started: ${D.ITEMS[r.started.out].name} in ${r.started.mins / 60} hours.`); }
        else { sfx('error'); toast(this, r.msg); }
        this.drawTile(it.k); this.refreshHud();
        break;
      }
      case 'harvest': {
        const r = G.harvest(s, x, y);
        if (r) { jingle('harvest'); this.gotItems([[r.id, r.n]], x, y); this.drawTile(`${x},${y}`); this.refreshHud(); flushAwards(); }
        break;
      }
      case 'forage': {
        const r = G.forage(s, x, y);
        if (r.ok) { sfx('select'); this.gotItems(r.got, x, y); this.drawTile(`${x},${y}`); this.refreshHud(); }
        break;
      }
      case 'cave': this.caveMenu(); break;
      default: break;
    }
  }

  door(b) {
    const s = this.s;
    sfx('select');
    if (b.kind === 'house') {
      modal(this, 'Go to bed?', [`It's ${G.clockText(s.time)}. Sleeping ends the day and saves your game.`, G.binValue(s) ? `The bin will pay ${fmt(G.binValue(s))}g overnight.` : 'The shipping bin is empty.'], [
        ['Sleep', () => this.goToBed()], ['Not yet', null],
      ]);
      return;
    }
    if (b.kind === 'shop') {
      if (this.hunt) return;
      const o = G.shopOpen(s, b.shop);
      if (!o.open) { toast(this, o.why); return; }
      shopPanel(s, b.shop, {
        onChange: (m) => { this.refreshHud(); if (m) toast(this, m); },
        onAnimal: (a) => {
          this.refreshHud();
          toast(this, `${a.name} the ${D.ANIMALS[a.kind].name.toLowerCase()} is waiting on your farm!`, { color: PALETTE.gold, ms: 2500 });
        },
      });
      return;
    }
    if (b.kind === 'hall') { this.openBoard(); return; }
    if (b.kind === 'coop' || b.kind === 'barn') { animalPanel(s, b.kind); return; }
    if (b.kind === 'cottage') toast(this, 'Nobody answers. Mira and Pip live here.');
  }

  openBoard() {
    const s = this.s;
    if (!this.canMenu()) return;
    G.boardSeen(s);
    this.refreshHud();
    boardPanel(s, {
      onBundle: (r, b) => {
        jingle('bundle');
        this.refreshHud();
        flushAwards();
        persist();
        if (r.hall) { this.time.delayedCall(400, () => go(this, 'Ending', {})); return; }
        modal(this, 'Bundle complete!', [`${b.name}: done!`, `Reward: ${r.reward}.`, G.goalText(s)], [['Great!', () => this.openBoard()]]);
      },
    });
  }

  readMail() {
    const s = this.s;
    const l = G.readMail(s);
    if (!l) { toast(this, 'No new mail.'); return; }
    sfx('card');
    this.refreshFixtures(); this.refreshHud();
    letterPanel(l, { more: G.unread(s) > 0, onNext: () => this.readMail() });
  }

  caveMenu() {
    const s = this.s;
    if (!G.mineUnlocked(s)) { toast(this, 'Fallen rocks block the mine. Bram says it opens on Spring 5.'); return; }
    if (s.energy < 4) { toast(this, 'You are too tired to go mining.'); return; }
    const floors = G.checkpoints(s);
    const btns = floors.slice(-3).map((f) => [`Floor ${f}`, () => this.enterMine(f)]);
    btns.push(['Not now', null, PALETTE.indigo, PALETTE.cream]);
    modal(this, 'The Old Mine', [`Deepest floor: ${s.mineDeepest || 'none yet'}. Break rocks to find the ladder down.`], btns);
  }

  enterMine(floor) {
    G.enterMine(this.s, floor);
    sfx('thud');
    flushAwards();
    this.changeMap();
  }

  // ------------------------------------------------------------ the mine

  mineAct(x, y, sel) {
    const s = this.s;
    const m = s.mine;
    const sl = m.slimes.find((q) => q.x === x && q.y === y);
    if (sl) {
      if (sel.tool !== 'sword' && sel.tool !== 'pick') { sfx('error'); toast(this, 'Pick your sword to fight!'); return; }
      this.swing(sel.tool, x, y, () => {
        const r = G.hitSlime(s, sl, sel.tool);
        sfx('hit');
        const im = this.slimeSprites.get(sl);
        if (im) {
          im.hurt = true; im.setFrame(`slime${SLIME_COLOR[sl.kind]}Hit1`); im.setTintFill(0xffffff);
          this.time.delayedCall(120, () => { im.clearTint(); im.hurt = false; });
        }
        if (r.dead) {
          sfx('smallBoom');
          if (im) { this.tweens.add({ targets: im, alpha: 0, scale: 2.6, duration: 250, onComplete: () => im.destroy() }); this.slimeSprites.delete(sl); }
          this.gotItems(r.got, x, y);
          if (r.ladder) { this.ladderImg.setPosition(m.ladder.x * T, m.ladder.y * T).setVisible(true); sfx('power'); toast(this, 'A ladder appeared!', { color: PALETTE.gold }); }
        }
        this.refreshHud();
      });
      return;
    }
    const rock = m.rocks.find((r) => r.x === x && r.y === y);
    if (rock) {
      if (sel.tool !== 'pick') { sfx('error'); toast(this, 'Pick the pickaxe to break rocks.'); return; }
      this.swing('pick', x, y, () => {
        const r = G.mineRock(s, x, y);
        if (!r.ok) { sfx('error'); toast(this, r.msg); return; }
        const im = this.rockSprites.get(`${x},${y}`);
        if (!r.broke) { sfx('hit'); if (im) this.tweens.add({ targets: im, x: im.x + 3, duration: 40, yoyo: true, repeat: 1 }); this.refreshHud(); return; }
        sfx('smallBoom');
        im?.destroy(); this.rockSprites.delete(`${x},${y}`);
        this.gotItems(r.got, x, y);
        if (r.ladder) { this.ladderImg.setPosition(x * T, y * T).setVisible(true); sfx('power'); toast(this, 'You found the ladder down!', { color: PALETTE.gold }); }
        this.refreshHud();
      });
      return;
    }
    const it = G.interactable(s, x, y);
    if (it?.t === 'down') { this.descend(); return; }
    if (it?.t === 'up') {
      modal(this, 'Leave the mine?', ['Climb back up to Whisperwood.'], [['Climb up', () => { G.leaveMine(s); this.changeMap(); }], ['Stay', null]]);
      return;
    }
    if (it?.t === 'chest') {
      const k = `chest${m.floor}`;
      if (s.flags[k]) { toast(this, 'The chest is empty.'); return; }
      s.flags[k] = true;
      const loot = m.floor >= 20 ? [['diamond', 1], ['goldbar', 3]] : [['ironbar', 2], ['aquamarine', 1]];
      for (const [id, n] of loot) G.give(s, id, n);
      jingle('fanfare');
      this.chestImg.setFrame('chestOpen');
      this.gotItems(loot, x, y);
      return;
    }
    if (sel.item === 'staircase') {
      if (m.floor >= G.MINE_FLOORS) { toast(this, 'This is the bottom of the mine.'); return; }
      G.take(s, 'staircase');
      this.descend();
      return;
    }
    if (sel.item && D.ITEMS[sel.item].energy) { this.offerEat(sel.item); return; }
  }

  descend() {
    const s = this.s;
    const next = s.mine.floor + 1;
    if (next > G.MINE_FLOORS) { toast(this, 'This is the bottom of the mine.'); return; }
    G.passTime(s, 10);
    G.enterMine(s, next);
    sfx('thud');
    flushAwards();
    this.changeMap();
  }

  slimeTick(delta) {
    const s = this.s;
    this.slimeAcc += delta;
    if (this.slimeAcc < SLIME_MS) return;
    this.slimeAcc = 0;
    for (const sl of [...s.mine.slimes]) {
      const im = this.slimeSprites.get(sl);
      const d = Math.abs(sl.x - s.x) + Math.abs(sl.y - s.y);
      if (d === 1 && !this.moving) {
        sl.cool = (sl.cool || 0) + 1;
        if (sl.cool >= 2) {
          sl.cool = 0;
          if (im) this.tweens.add({ targets: im, x: im.x + (s.x - sl.x) * 10, y: im.y + (s.y - sl.y) * 10, duration: 90, yoyo: true });
          const dead = G.hurt(s, G.slimeDamage(sl));
          sfx('capture');
          this.cameras.main.shake(120, 0.008);
          this.player.setTintFill(0xff6060);
          this.time.delayedCall(120, () => this.player.clearTint());
          this.refreshHud();
          if (dead) { this.knockOut(); return; }
        }
        continue;
      }
      const to = G.slimeStep(s, sl, Math.random, (x, y) => s.mine.slimes.some((o) => o !== sl && o.x === x && o.y === y));
      if (to) {
        sl.x = to.x; sl.y = to.y;
        if (im) this.tweens.add({ targets: im, x: to.x * T + 16, y: to.y * T + 16, duration: 300, onUpdate: () => im.setDepth(im.y) });
      }
    }
  }

  knockOut() {
    const s = this.s;
    this.busy = true; this.path = null; this.held = null;
    const r = G.knockedOut(s);
    persist();
    this.cameras.main.fadeOut(400, 120, 20, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ knocked: r }));
  }

  // ------------------------------------------------------------ animals and people

  petAnimal(a) {
    const r = G.petAnimal(this.s, a);
    if (r.got) { sfx('coin'); this.gotItems([[r.got, 1]], a.x, a.y); flushAwards(); }
    else if (r.petted) { sfx('select'); this.hearts(a.x, a.y); toast(this, `You pet ${a.name}.`, { ms: 900 }); }
    else toast(this, r.msg, { ms: 900 });
    this.syncAnimals(true);
    this.refreshHud();
  }

  hearts(x, y) {
    const h = this.add.image(x * T + 16, y * T, ATLAS, 'heart').setScale(3).setDepth(4500);
    this.tweens.add({ targets: h, y: h.y - 24, alpha: 0, duration: 800, onComplete: () => h.destroy() });
  }

  talkTo(id) {
    const s = this.s;
    const spr = this.npcSprites.get(id);
    const v = D.VILLAGERS[id];
    const before = G.hearts(s, id);
    const r = G.talk(s, id);
    sfx('select');
    if (spr) this.hearts(spr.tx, spr.ty);
    if (r.event) jingle('heart');
    const lines = [...r.lines];
    if (r.reward?.length) lines.push(`You received ${r.reward.map(([rid, n]) => (rid === 'gold' ? `${n}g` : `${n} ${D.ITEMS[rid].name}`)).join(' and ')}.`);
    this.say(lines, v.row, () => {
      this.markHeartDots();
      this.refreshHud();
      const after = G.hearts(s, id);
      if (after > before) toast(this, `${v.name}: ${after} heart${after > 1 ? 's' : ''}!`, { color: PALETTE.gold });
      else if (!s.flags.giftTip) { s.flags.giftTip = true; toast(this, 'Tip: hold an item in a hand slot, then tap someone to give it as a gift.', { ms: 3200 }); }
      flushAwards();
    });
  }

  offerGift(id, item) {
    const s = this.s;
    const v = D.VILLAGERS[id];
    if (!G.canGift(s, id)) { toast(this, `You already gave ${v.name} a gift today.`); this.talkTo(id); return; }
    modal(this, `Give to ${v.name}?`, [`${D.ITEMS[item].name}${G.isBirthday(s, id) ? ' (birthday gift!)' : ''}`], [
      ['Give it', () => this.giveGift(id, item)],
      ['Just talk', () => this.talkTo(id)],
      ['Cancel', null, PALETTE.indigo, PALETTE.cream],
    ]);
  }

  giveGift(id, item) {
    const s = this.s;
    const v = D.VILLAGERS[id];
    const before = G.hearts(s, id);
    const r = G.giveGift(s, id, item);
    if (r.msg) { toast(this, r.msg); return; }
    sfx(r.taste === 'hate' ? 'error' : 'coin');
    if (r.taste === 'love') jingle('heart');
    this.refreshHud();
    this.say([r.line], v.row, () => {
      this.markHeartDots();
      const after = G.hearts(s, id);
      if (after > before) toast(this, `${v.name}: ${after} heart${after > 1 ? 's' : ''}!`, { color: PALETTE.gold });
      flushAwards();
    });
  }

  // ------------------------------------------------------------ fishing

  startFishing(where) {
    this.busy = true;
    this.scene.launch('Fish', { where, mode: 'normal' });
    this.scene.pause();
  }

  /** Called by the Fish scene when it closes. */
  fishDone(res) {
    const s = this.s;
    this.busy = false;
    G.passTime(s, 10);
    if (res?.mode === 'derby') { this.derbyDone(res); return; }
    this.refreshHud();
    flushAwards();
  }

  // ------------------------------------------------------------ the day

  goToBed() {
    if (this.sleeping) return;
    this.sleeping = true;
    this.busy = true;
    this.cameras.main.fadeOut(500, 10, 8, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const sum = G.sleep(this.s);
      persist();
      this.scene.restart({ summary: sum });
    });
  }

  passOut() {
    if (this.sleeping) return;
    this.sleeping = true;
    this.busy = true; this.path = null; this.held = null;
    jingle('sad');
    this.player.setFrame('pDefeat');
    this.cameras.main.fadeOut(900, 10, 8, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const sum = G.sleep(this.s, { passedOut: true });
      persist();
      this.scene.restart({ summary: sum });
    });
  }

  // ------------------------------------------------------------ festivals

  festivalPrompt() {
    const s = this.s;
    const f = G.festivalOpen(s);
    if (!f) return;
    this.music();
    modal(this, f.name, [f.blurb, 'Joining ends your day after the festival.'], [
      ['Join in!', () => this.startFestival(f)],
      ['Not yet', () => toast(this, 'Come back before 2pm to join.')],
    ]);
  }

  startFestival(f) {
    const s = this.s;
    if (f.id === 'egghunt') { this.startEggHunt(); return; }
    if (f.id === 'derby') {
      this.say(['Mira: Welcome to the River Derby! Catch as many fish as you can in 90 seconds.', 'Mira: Four or more wins the prize. Ready? Cast!'], 5, () => {
        this.busy = true;
        this.scene.launch('Fish', { where: 'river', mode: 'derby', seconds: 90 });
        this.scene.pause();
      });
      return;
    }
    if (f.id === 'fair') {
      this.say(['Mayor Alder: Welcome to the Harvest Fair! Show me your finest goods.', 'Mayor Alder: I judge by value: the best displays win the most.'], 2, () => {
        pickItemPanel(s, {
          title: 'Choose your display', sub: 'Pick one item to show the judges.', filter: G.sellable, label: (id) => `${D.ITEMS[id].price}g`,
          onPick: (id) => {
            const r = G.fairJudge(s, id);
            jingle(r.won ? 'fanfare' : 'harvest');
            this.festivalEnd(f, r.won, [`Your ${D.ITEMS[id].name} took ${['', '1st', '2nd', '3rd'][r.place]} place!`, `Prize: ${fmt(r.prize)}g.`]);
          },
          // closing the picker without choosing still ends the fair politely
          onCancel: () => this.festivalEnd(f, false, ['You enjoyed the fair without entering.']),
        });
      });
      return;
    }
    if (f.id === 'star') {
      const friend = G.secretFriend(s);
      const v = D.VILLAGERS[friend];
      this.say([`Mayor Alder: Happy Winter Star, everyone!`, `Your secret friend this year is ${v.name}.`], 2, () => {
        const pickGift = () => pickItemPanel(s, {
          title: `A gift for ${v.name}`, sub: 'Pick something they would like.', filter: G.giftable, label: (id) => ({ love: 'Loves!', like: 'Likes', hate: 'Hates', neutral: '' }[G.taste(friend, id)] || ''),
          onPick: (id) => {
            const r = G.starExchange(s, id);
            jingle('heart');
            this.festivalEnd(f, false, [`${v.name}: ${r.taste === 'love' ? 'I love it!' : r.taste === 'hate' ? 'Oh... thanks.' : 'How kind, thank you!'}`, `${v.name} gave you ${r.gift[1]} ${D.ITEMS[r.gift[0]].name}.`]);
          },
          onCancel: () => this.festivalEnd(f, false, ['You enjoyed the lanterns and cocoa.']),
        });
        pickGift();
      });
    }
  }

  festivalEnd(f, won, lines) {
    const s = this.s;
    if (s.fest[`${s.year}-${f.id}`]) return;
    G.markFestival(s, f, won);
    flushAwards();
    persist();
    this.refreshHud();
    modal(this, f.name, [...lines, 'What a day! You head home in the evening.'], [['Go home', () => this.changeMap()]]);
  }

  startEggHunt() {
    const s = this.s;
    const m = MAPS.town;
    const rnd = G.seeded((s.seed + s.year) >>> 0);
    const spots = [];
    let tries = 0;
    while (spots.length < 12 && tries++ < 500) {
      const x = 1 + Math.floor(rnd() * 24); const y = 5 + Math.floor(rnd() * 13);
      if (!G.walkable(s, x, y, 'town') || this.npcAt(x, y) || (x === s.x && y === s.y) || spots.some((p) => p.x === x && p.y === y)) continue;
      if (Math.abs(x - s.x) + Math.abs(y - s.y) < 3) continue;
      spots.push({ x, y });
    }
    void m;
    this.say(['Mayor Alder: The Egg Hunt begins! Find 9 of the 12 eggs in 60 seconds to win.', 'Walk onto an egg to pick it up. Go!'], 2, () => {
      this.hunt = { eggs: spots.map((p) => ({ ...p, img: this.add.image(p.x * T + 16, p.y * T + 28, ATLAS, 'o_egghunt').setOrigin(0.5, 1).setScale(2).setDepth(p.y * T + 13) })), got: 0, total: spots.length, left: 60 };
      this.music();
      sfx('goal');
    });
  }

  /** Pick up an egg you stand on, or one right next to you that you tapped. */
  huntCheck(tx, ty) {
    const h = this.hunt;
    const s = this.s;
    for (const e of h.eggs) {
      if (!e.got && ((e.x === s.x && e.y === s.y) || (e.x === tx && e.y === ty))) {
        e.got = true; h.got++;
        sfx('coin');
        this.tweens.add({ targets: e.img, y: e.img.y - 20, alpha: 0, duration: 300, onComplete: () => e.img.destroy() });
      }
    }
    if (h.got >= h.total) this.huntEnd();
  }

  huntTick(delta) {
    this.hunt.left -= delta / 1000;
    if (this.hunt.left <= 0) this.huntEnd();
  }

  huntEnd() {
    const h = this.hunt;
    if (!h || h.over) return;
    h.over = true;
    this.path = null; this.held = null;
    for (const e of h.eggs) if (!e.got) e.img.destroy();
    this.hunt = null;
    const won = h.got >= 9;
    jingle(won ? 'fanfare' : 'sad');
    if (won) { this.s.gold += 500; }
    const f = D.FESTIVALS[0];
    this.festivalEnd(f, won, [`You found ${h.got} of ${h.total} eggs.`, won ? 'You win the prize: 500g and the golden ribbon!' : 'Pip found the most eggs this year. Next time!']);
  }

  derbyDone(res) {
    const f = D.FESTIVALS[1];
    const won = res.count >= 4;
    if (won) this.s.gold += 600;
    jingle(won ? 'fanfare' : 'sad');
    this.festivalEnd(f, won, [`You caught ${res.count} fish.`, won ? 'You win the Derby! Prize: 600g.' : 'Mira wins the Derby with 5 fish. So close!']);
  }
}

function shortName(b) {
  return { house: 'Home', coop: 'Coop', barn: 'Barn', market: 'Market', hall: 'Town Hall', forge: 'Forge', ranch: 'Ranch', cottage: 'Cottage' }[b.id] || b.name;
}
