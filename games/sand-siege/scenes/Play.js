import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import { reportDaily } from '../../../shared/core/trophies.js';
import {
  WIDTH, HEIGHT, store, go, modal, toast, setBackground, openHowTo, fit, money, tapZone, howToOpen, drawStar,
} from './common.js';
import * as S from '../logic/sim.js';
import {
  TOWERS, TOWER_ORDER, ENEMIES, POWERS, POWER_ORDER, towerStats, TARGETS, TARGET_NAMES, starsFor, AIRSTRIKE_RADIUS,
} from '../logic/data.js';
import { COLS, ROWS, CAMPAIGN, mapById, waveSummary } from '../logic/maps.js';
import { img, footFrame, vehFrame, isFoot, BIG, TILE, tile } from '../frames.js';
import {
  save, saveGame, loadGame, clearGame, recordWin, recordEndless, campaign, powersUnlocked,
} from '../save.js';
import { hpScale, reportResult } from '../adaptive.js';
import { checkLive, checkEnd, stat, GAME_ID } from '../trophies.js';

const T = 32;
const OX = 4;
const TOP = 40;
const BOTTOM = TOP + ROWS * T; // 520
const BLUE = 0x5b8fd8;

// How each tower looks: art on the atlas and the colour of its pad edge.
const LOOK = {
  mg: { foot: 'hinf', edge: 0x8a8fc4 },
  cannon: { veh: 'tank', scale: 2, edge: 0xd88038 },
  aa: { bld: 'bs_b_4', edge: 0x5b8fd8 },
  slow: { bld: 'bs_b_5', edge: 0x6c8c50 },
  sniper: { foot: 'scout', single: true, edge: 0xe3d245 },
  arty: { veh: 'arty', scale: 1, edge: 0xa13d3b },
  bank: { bld: 'bs_b_6', edge: 0xf0d472 },
};
const POWER_LABEL = { airstrike: 'Air', sandstorm: 'Storm', repair: 'Fix' };

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  create() {
    const start = store.start;
    store.start = null;
    this.s = start?.state ? S.deserialize(S.serialize(start.state)) : S.deserialize(loadGame());
    if (!this.s) { this.scene.start('Menu'); return; }
    const s = this.s;
    this.fresh = !!start?.fresh;
    setBackground(this, '#3b2a2a');
    this.mode = 'build'; // build | place | tower | aim
    this.placeType = null;
    this.ghostCell = null;
    this.selected = null;
    this.acc = 0;
    this.holds = new Set(); // reasons the game is paused
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.sndAt = {};
    this.lastSave = 0;
    this.lastLive = 0;
    this.finished = false;
    this.coachStep = (s.mode === 'campaign' && s.mapId === 'outpost' && !save.get('coach') && save.get('tips') !== false) ? 0 : -1;
    this.coachSeen = {};

    this.drawGround();
    this.routeG = this.add.graphics().setDepth(1);
    this.cellsG = this.add.graphics().setDepth(1);
    this.rangeG = this.add.graphics().setDepth(2);
    this.drawBase();
    this.towerLayer = this.add.container(0, 0).setDepth(5);
    this.enemyLayer = this.add.container(0, 0).setDepth(6);
    this.airLayer = this.add.container(0, 0).setDepth(7);
    this.shellG = this.add.graphics().setDepth(8);
    this.fxLayer = this.add.container(0, 0).setDepth(8);
    this.ghost = this.add.container(0, 0).setDepth(9).setVisible(false);
    this.stormFx = this.add.rectangle(OX, TOP, COLS * T, ROWS * T, 0xf0d472, 0).setOrigin(0).setDepth(9);

    this.buildHud();
    this.buildBottom();
    this.setupInput();
    for (const t of s.towers) this.makeTowerView(t);
    this.drawRoute();
    this.setMode('build');

    this.events.on('howto', (open) => this.hold('howto', open));
    this.onHide = () => {
      if (document.hidden) { this.saveNow(); if (!this.s.over && this.s.wave > 0) this.pauseMenu(); }
    };
    this.onPageHide = () => this.saveNow();
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onHide);
      window.removeEventListener('pagehide', this.onPageHide);
      document.getElementById('howto')?.remove();
    });

    window.__siege = { scene: this, S, get s() { return this.scene.s; } };
    this.refreshHud();
    if (s.over) { this.finish(); return; }
    if (!this.fresh) this.welcomeBack();
    else if (this.coachStep < 0) this.time.delayedCall(250, () => toast(this, s.kind === 'maze' ? 'Build your maze, then Send Wave' : 'Build towers, then tap Send Wave', TOP + 60, PALETTE.gold, 1800));
  }

  // ---------------------------------------------------------------- pausing

  hold(reason, on) { if (on) this.holds.add(reason); else this.holds.delete(reason); }
  modalOpen() { return howToOpen() || this.children.list.some((c) => c.depth >= 100 && c.active); }
  /** A modal that also pauses the game while it is open. */
  pausingModal(title, lines, buttons, opts = {}) {
    const key = `m${Math.random()}`;
    this.hold(key, true);
    return modal(this, title, lines, buttons, { ...opts, onClose: () => { this.hold(key, false); opts.onClose?.(); } });
  }

  welcomeBack() {
    const s = this.s;
    const what = s.mode === 'endless' ? `Endless, wave ${s.wave}` : `Wave ${s.wave} of ${s.totalWaves}`;
    this.pausingModal('Welcome back', [`${s.name}: ${what}.`, `${s.lives} lives, ${money(s.funds)} funds.`, { text: 'The game is paused.', color: PALETTE.lavender }], [['Continue', () => sfx('select')]]);
  }

  pauseMenu() {
    if (this.modalOpen() || this.finished) return;
    const tipsOn = save.get('tips') !== false;
    this.pausingModal('Paused', [{ text: 'Your game is saved as you play.', color: PALETTE.lavender }], [
      ['Resume', null],
      ['Restart map', () => this.confirmRestart()],
      [`Sound: ${isMuted() ? 'off' : 'on'}`, () => { setMuted(!isMuted()); sfx('tap'); this.pauseMenu(); }],
      [`Tips: ${tipsOn ? 'on' : 'off'}`, () => { save.set('tips', !tipsOn); if (tipsOn) this.endCoach(); toast(this, `Tips ${tipsOn ? 'off' : 'on'}`, TOP + 60); }],
      ['Quit to menu', () => { this.saveNow(); go(this, 'Menu'); }],
    ]);
  }

  confirmRestart() {
    this.pausingModal('Restart?', ['Start this map again from wave 1?'], [['Restart', () => this.restart()], ['Cancel', null]], { row: true });
  }

  restart() {
    const s = this.s;
    let def;
    if (s.mode === 'daily') def = { ...s.def, id: s.mapId, name: s.name, kind: s.kind, rows: s.rows, mods: s.mods };
    else def = mapById(s.mapId);
    const normal = s.mode === 'campaign' && !s.hard;
    const fresh = S.newGame(def, { mode: s.mode, hard: s.hard, hpScale: normal ? hpScale() : 1, powers: powersUnlocked() });
    saveGame(S.serialize(fresh));
    store.start = { state: fresh, fresh: true };
    go(this, 'Play');
  }

  flushStats() {
    if (this.pendingKills) { stat('kills', this.pendingKills); this.pendingKills = 0; }
  }

  saveNow() {
    this.flushStats();
    if (!this.s || this.finished || this.s.over) return;
    saveGame(S.serialize(this.s));
    this.lastSave = this.time.now;
  }

  // ---------------------------------------------------------------- map drawing

  cellXY(x, y) { return [OX + x * T + T / 2, TOP + y * T + T / 2]; }

  drawGround() {
    const s = this.s;
    const rt = this.add.renderTexture(OX, TOP, COLS * 16, ROWS * 16).setOrigin(0).setScale(2).setDepth(0);
    let seed = (s.mapId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + s.rows.join('').length) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const put = (tx, ty, px, py) => rt.drawFrame('atlas', tile(tx, ty), px, py);
    const kind = (x, y) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
      const ch = s.rows[y][x];
      if ('#SB'.includes(ch) && s.kind !== 'maze') return 'road';
      return { r: 'mesa', w: 'water', o: 'oasis' }[ch] || 'sand';
    };
    // Autotile one 8x8 quarter of a cell from a 3x3 ring block. Off-map counts as "same" for the road
    // (so it runs off the edge), as different for everything else.
    const ring = ([bx, by], x, y, qx, qy, k, fill) => {
      const same = (o) => o === k || (o == null && k === 'road');
      const hx = qx === 0 ? x - 1 : x + 1; const vy = qy === 0 ? y - 1 : y + 1;
      const col = !same(kind(hx, y)) ? (qx === 0 ? 0 : 2) : 1;
      const row = !same(kind(x, vy)) ? (qy === 0 ? 0 : 2) : 1;
      if (col === 1 && row === 1) { put(...fill, x * 16 + qx * 8, y * 16 + qy * 8); return; }
      put(bx + col * 8, by + row * 8, x * 16 + qx * 8, y * 16 + qy * 8);
    };
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const k = kind(x, y);
        for (let q = 0; q < 4; q++) {
          const qx = q % 2; const qy = q >> 1;
          const px = x * 16 + qx * 8; const py = y * 16 + qy * 8;
          put(...pick(TILE.sand), px, py);
          if (k === 'sand' && rnd() < 0.06) put(...pick(TILE.sandDecal), px, py);
          if (k === 'road') ring(TILE.dunesRing, x, y, qx, qy, 'road', pick(TILE.dunesFill));
          if (k === 'mesa') { put(...TILE.mesaFill[0], px, py); ring(TILE.mesaRing, x, y, qx, qy, 'mesa', TILE.mesaFill[rnd() < 0.8 ? 0 : 1]); }
          if (k === 'water') { const deep = rnd() < 0.7 ? [72, 24] : [80, 24]; put(...deep, px, py); ring(TILE.waterRing, x, y, qx, qy, 'water', deep); }
          if (k === 'oasis') put(...pick(TILE.oasis), px, py);
        }
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const k = kind(x, y);
        const bx = x * 16; const by = y * 16;
        if (k === 'oasis') {
          rt.fill(0x1e5f66, 1, bx + 3, by + 9, 7, 4); rt.fill(0x2a8a8a, 1, bx + 4, by + 9, 5, 3);
          put(...TILE.shrub, bx + 7, by + 1); put(...TILE.shrub, bx + 1, by + 2);
        }
        if (k === 'mesa') put(...pick(TILE.rocks), bx + 3 + Math.floor(rnd() * 3), by + 3 + Math.floor(rnd() * 3));
      }
    }
    // A faint grid on buildable sand so tiles are easy to aim at.
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x000000, 0.1);
    for (let x = 1; x < COLS; x++) g.lineBetween(OX + x * T, TOP, OX + x * T, BOTTOM);
    for (let y = 1; y < ROWS; y++) g.lineBetween(OX, TOP + y * T, OX + COLS * T, TOP + y * T);
    // Gates: red arrows where the enemy comes in.
    for (const [sx] of S.spawns(s)) {
      const [cx] = this.cellXY(sx, 0);
      g.fillStyle(hex(PALETTE.ink)).fillTriangle(cx - 10, TOP + 2, cx + 10, TOP + 2, cx, TOP + 16);
      g.fillStyle(0xd0453f).fillTriangle(cx - 7, TOP + 3, cx + 7, TOP + 3, cx, TOP + 13);
    }
  }

  drawBase() {
    const [bx, by] = S.baseCell(this.s);
    const [cx, cy] = this.cellXY(bx, by);
    this.baseImg = img(this, cx, cy + T / 2, 'bl_b_0', 2).setOrigin(0.5, 1).setDepth(5);
  }

  /** Dotted line along the route enemies will walk (maze maps, where it changes as you build). */
  drawRoute() {
    const g = this.routeG;
    g.clear();
    if (this.s.kind !== 'maze') return;
    for (const sp of S.spawns(this.s)) {
      const r = S.route(this.s, sp);
      for (let i = 1; i < r.length; i++) {
        const [ax, ay] = this.cellXY(...r[i - 1]); const [bx, by] = this.cellXY(...r[i]);
        for (let k = 0; k < 4; k++) {
          const t = k / 4;
          g.fillStyle(0xf9f5ef, 0.55).fillRect(Math.round(ax + (bx - ax) * t) - 1, Math.round(ay + (by - ay) * t) - 1, 3, 3);
        }
      }
    }
  }

  // ---------------------------------------------------------------- towers

  makeTowerView(t) {
    this.towerViews.get(t.id)?.c.destroy();
    const [cx, cy] = this.cellXY(t.x, t.y);
    const c = this.add.container(cx, cy);
    const look = LOOK[t.type];
    const pad = this.add.rectangle(0, 0, T - 4, T - 4, 0x1c1618, 0.35).setStrokeStyle(2, look.edge, 0.9);
    c.add(pad);
    const v = { c, t, sprs: [], look, attackUntil: 0 };
    if (look.foot) {
      if (look.single) v.sprs.push(img(this, 0, -2, footFrame(look.foot, 'b', 'idle', 0), 2));
      else v.sprs.push(img(this, -6, -5, footFrame(look.foot, 'b', 'idle', 0), 2), img(this, 6, 2, footFrame(look.foot, 'b', 'idle', 1), 2));
    } else if (look.veh) v.sprs.push(img(this, 0, -1, vehFrame(look.veh, 'b', t.dir || 'u'), look.scale));
    else v.sprs.push(img(this, 0, 0, look.bld, 2));
    c.add(v.sprs);
    // Level pips (gold), and a star for a specialty.
    const lv = this.add.graphics();
    if (t.level >= 3) drawStar(lv, -10, 10, 6, hex(PALETTE.gold));
    else for (let i = 0; i < t.level; i++) lv.fillStyle(hex(PALETTE.ink)).fillRect(-13 + i * 7, 9, 6, 6).fillStyle(hex(PALETTE.gold)).fillRect(-12 + i * 7, 10, 4, 4);
    c.add(lv);
    this.towerLayer.add(c);
    this.towerLayer.sort('y');
    this.towerViews.set(t.id, v);
    return v;
  }

  syncTowers(now) {
    for (const [id, v] of this.towerViews) {
      const t = S.towerById(this.s, id);
      if (!t) { v.c.destroy(); this.towerViews.delete(id); continue; }
      if (v.look.veh) v.sprs[0].setFrame(vehFrame(v.look.veh, 'b', t.dir || 'u'));
      if (v.look.foot) {
        const anim = now < v.attackUntil ? 'attack' : 'idle';
        const flip = t.dir && t.dir.includes('l');
        v.sprs.forEach((sp, k) => sp.setFrame(footFrame(v.look.foot, 'b', anim, Math.floor(now / 140) + k)).setFlipX(!!flip));
      }
    }
  }

  // ---------------------------------------------------------------- enemies

  makeEnemyView(e) {
    const def = ENEMIES[e.type];
    const layer = e.air ? this.airLayer : this.enemyLayer;
    const c = this.add.container(0, 0);
    const v = { c, e, foot: isFoot(def.art), art: def.art, flip: false };
    const scale = def.scale ? (BIG.has(def.art) ? 2 : 3) : (BIG.has(def.art) ? 1 : 2);
    if (e.air) c.add(this.add.ellipse(0, 14, 18 * (def.scale ? 2 : 1), 6, 0x000000, 0.25));
    v.spr = v.foot ? img(this, 0, -2, footFrame(def.art, 'r', 'walk', e.id), 2) : img(this, 0, 0, vehFrame(def.art, 'r', 'd'), scale);
    c.add(v.spr);
    if (e.maxShield) { v.bubble = this.add.circle(0, -2, 13, 0x5b8fd8, 0.25).setStrokeStyle(2, 0x8fc0ff, 0.9); c.add(v.bubble); }
    if (def.heal) { const p = this.add.graphics(); p.fillStyle(0xffffff).fillRect(-2, -14, 5, 11).fillRect(-5, -11, 11, 5); p.fillStyle(0x6c8c50).fillRect(-1, -13, 3, 9).fillRect(-4, -10, 9, 3); c.add(p); }
    const w = e.boss ? 40 : 22;
    const by = e.boss ? -30 : (e.air ? -16 : -16);
    v.barW = w;
    v.barBg = this.add.rectangle(-w / 2 - 1, by - 1, w + 2, 5, 0x040303).setOrigin(0);
    v.bar = this.add.rectangle(-w / 2, by, w, 3, 0x7fd858).setOrigin(0);
    c.add([v.barBg, v.bar]);
    if (e.maxShield) { v.sbar = this.add.rectangle(-w / 2, by - 3, w, 2, 0x8fc0ff).setOrigin(0); c.add(v.sbar); }
    layer.add(c);
    this.enemyViews.set(e.id, v);
    return v;
  }

  syncEnemies(now) {
    const alive = new Set();
    for (const e of this.s.enemies) {
      alive.add(e.id);
      const v = this.enemyViews.get(e.id) || this.makeEnemyView(e);
      v.c.setPosition(Math.round(OX + e.x * T), Math.round(TOP + e.y * T));
      v.c.setVisible(e.y > -0.4);
      if (v.foot) {
        if (e.hx < -0.1) v.flip = true; else if (e.hx > 0.1) v.flip = false;
        v.spr.setFrame(footFrame(v.art, 'r', 'walk', Math.floor(now / 150) + e.id)).setFlipX(v.flip);
      } else v.spr.setFrame(vehFrame(v.art, 'r', S.facing(e.hx, e.hy)));
      const slowed = e.slow > 0;
      if (slowed) v.spr.setTint(0xb08a68); else v.spr.clearTint();
      const f = Math.max(0, e.hp / e.maxHp);
      v.bar.width = Math.max(1, Math.round(v.barW * f));
      v.bar.fillColor = f > 0.5 ? 0x7fd858 : f > 0.25 ? 0xe3d245 : 0xd0453f;
      if (v.sbar) {
        const sf = e.maxShield ? e.shield / e.maxShield : 0;
        v.sbar.width = Math.max(0, Math.round(v.barW * sf));
        v.sbar.setVisible(sf > 0.01);
        v.bubble.setVisible(sf > 0.01 && e.jamT <= 0).setAlpha(0.4 + sf * 0.6);
      }
    }
    for (const [id, v] of this.enemyViews) if (!alive.has(id)) { v.c.destroy(); this.enemyViews.delete(id); }
    this.enemyLayer.sort('y');
  }

  // ---------------------------------------------------------------- effects

  snd(name, gap = 70) {
    const now = this.time.now;
    if ((this.sndAt[name] || 0) + gap > now) return;
    this.sndAt[name] = now;
    sfx(name);
  }

  anim(x, y, frames, scale = 2, ms = 70) {
    const o = img(this, x, y, frames[0], scale);
    this.fxLayer.add(o);
    let i = 0;
    this.time.addEvent({ delay: ms, repeat: frames.length - 1, callback: () => { i++; if (i >= frames.length) o.destroy(); else o.setFrame(frames[i]); } });
  }

  tracer(x1, y1, x2, y2, color = 0xfff3a0, width = 2, ms = 70) {
    const g = this.add.graphics().setDepth(8);
    g.lineStyle(width, color, 0.95).lineBetween(x1, y1, x2, y2);
    this.time.delayedCall(ms, () => g.destroy());
  }

  floatText(x, y, str, color = PALETTE.gold) {
    const t = text(this, x, y, str, { color }).setDepth(12);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  handleEvents(events) {
    const s = this.s;
    const now = this.time.now;
    for (const ev of events) {
      switch (ev.k) {
        case 'fire': {
          const t = S.towerById(s, ev.id);
          if (!t) break;
          const [cx, cy] = this.cellXY(t.x, t.y);
          const ex = OX + ev.tx * T; const ey = TOP + ev.ty * T;
          const v = this.towerViews.get(t.id);
          if (v) v.attackUntil = now + 300;
          if (t.type === 'mg') { this.tracer(cx, cy - 6, ex, ey - 4, 0xfff3a0, 1, 50); this.snd('shoot', 110); }
          if (t.type === 'sniper') { this.tracer(cx, cy - 6, ex, ey - 4, 0xffffff, 2, 90); this.snd('hit', 150); }
          if (t.type === 'aa') { this.tracer(cx - 5, cy - 12, ex, ey, 0x8fe0ff, 2, 70); this.tracer(cx + 5, cy - 12, ex, ey, 0x8fe0ff, 2, 70); this.snd('shoot', 120); }
          if (t.type === 'cannon') { this.anim(cx, cy - 8, ['shot_0', 'shot_1', 'shot_2', 'shot_3'], 2, 40); this.snd('thud', 120); }
          if (t.type === 'arty') { this.anim(cx, cy - 10, ['shot_0', 'shot_1', 'shot_2', 'shot_3'], 2, 50); this.snd('thud', 200); }
          break;
        }
        case 'burst': {
          const x = OX + ev.x * T; const y = TOP + ev.y * T;
          const sc = Math.max(2, Math.round(ev.r * 2.5));
          this.anim(x, y, ['boom_0', 'boom_1', 'boom_2', 'boom_3'], sc, 70);
          this.snd(ev.big ? 'boom' : 'smallBoom', 120);
          break;
        }
        case 'pulse': {
          const t = S.towerById(s, ev.id);
          if (!t) break;
          const [cx, cy] = this.cellXY(t.x, t.y);
          const ring = this.add.circle(cx, cy, 6, ev.jam ? 0x8fc0ff : 0x3a2418, 0).setStrokeStyle(3, ev.jam ? 0x8fc0ff : 0x5a3a20, 0.7).setDepth(3);
          this.tweens.add({ targets: ring, radius: ev.r * T, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
          break;
        }
        case 'die': {
          const x = OX + ev.x * T; const y = TOP + ev.y * T;
          const art = ENEMIES[ev.type].art;
          if (isFoot(art)) this.anim(x, y - 2, [12, 13, 14, 15].map((i) => `${art}_r_${i}`), 2, 90);
          else this.anim(x, y, ['boom_0', 'boom_1', 'boom_2', 'boom_3'], ev.boss ? 6 : 3, 80);
          this.floatText(x, y - 14, `+${ev.reward}`);
          this.snd(ev.boss ? 'boom' : 'capture', 90);
          if (ev.boss) { this.cameras.main.shake(300, 0.01); toast(this, 'Boss destroyed!', TOP + 120, PALETTE.gold, 1500); }
          this.pendingKills = (this.pendingKills || 0) + 1;
          break;
        }
        case 'leak': {
          this.cameras.main.shake(160, 0.006);
          this.baseImg.setTint(0xff7070);
          this.time.delayedCall(160, () => this.baseImg.clearTint());
          const [bx, by] = this.cellXY(...S.baseCell(s));
          this.floatText(bx, by - 40, `-${ev.lives}`, '#ff8080');
          this.snd('error', 150);
          break;
        }
        case 'wave': {
          this.banner(s.totalWaves ? `Wave ${ev.wave} of ${s.totalWaves}` : `Wave ${ev.wave}`, ev.income ? `+${ev.income} funds` : '');
          this.snd('goal', 200);
          this.introduceEnemies(ev.wave - 1);
          stat('waves', 1);
          break;
        }
        case 'strike': {
          const x = OX + ev.x * T; const y = TOP + ev.y * T;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.time.delayedCall(k * 50, () => this.anim(x + Math.cos(a) * 22, y + Math.sin(a) * 22, ['boom_0', 'boom_1', 'boom_2', 'boom_3'], 4, 70));
          }
          this.anim(x, y, ['boom_0', 'boom_1', 'boom_2', 'boom_3'], 6, 90);
          this.cameras.main.shake(250, 0.012);
          sfx('boom');
          break;
        }
        case 'power': {
          if (ev.id === 'airstrike') {
            const x = OX + ev.x * T; const y = TOP + ev.y * T;
            const m = this.add.circle(x, y, AIRSTRIKE_RADIUS * T, 0xd0453f, 0.15).setStrokeStyle(2, 0xd0453f, 0.9).setDepth(9);
            this.tweens.add({ targets: m, alpha: 0.3, duration: 200, yoyo: true, repeat: 1, onComplete: () => m.destroy() });
            this.snd('shoot');
          }
          if (ev.id === 'sandstorm') { sfx('roll'); toast(this, 'Sandstorm!', TOP + 120, PALETTE.sand); }
          if (ev.id === 'repair') { sfx('power'); this.baseImg.setTint(0x9fff9f); this.time.delayedCall(300, () => this.baseImg.clearTint()); }
          break;
        }
        case 'over': this.finish(); break;
        default: break;
      }
    }
  }

  banner(title, sub) {
    const c = this.add.container(WIDTH / 2, TOP + 110).setDepth(40);
    const bg = this.add.rectangle(0, 0, 260, sub ? 62 : 44, hex(PALETTE.ink), 0.8);
    c.add(bg);
    c.add(text(this, 0, sub ? -12 : 0, title, { size: 32, color: PALETTE.gold }));
    if (sub) c.add(text(this, 0, 18, sub, { color: PALETTE.cream }));
    this.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 400, onComplete: () => c.destroy() });
  }

  introduceEnemies(w) {
    const seen = new Set(save.get('seen') || []);
    const fresh = [...new Set(S.groupsFor(this.s, w).map((g) => g.type))].filter((t) => t !== 'rifle' && !seen.has(t));
    if (!fresh.length) return;
    const type = fresh[0];
    seen.add(type);
    save.set('seen', [...seen]);
    const def = ENEMIES[type];
    this.pausingModal(`New: ${def.name}`, [def.blurb, { text: this.counterTip(type), color: PALETTE.gold }], [['Got it', null]], {
      extra: 56,
      content: (c, y) => {
        const big = def.scale ? (BIG.has(def.art) ? 2 : 3) : (BIG.has(def.art) ? 2 : 3);
        const fr = isFoot(def.art) ? footFrame(def.art, 'r', 'idle', 0) : vehFrame(def.art, 'r', 'd');
        c.add(img(this, WIDTH / 2, y + 26, fr, big));
      },
    });
  }

  counterTip(type) {
    return {
      raider: 'Machine Guns and Tar Sprayers catch fast units.',
      tank: 'Cannons, Snipers and Artillery beat armour.',
      drone: 'Only Machine Guns, Anti-Air, Tar and Snipers hit flyers.',
      shield: 'Shields soak damage. Steady fire keeps them down.',
      medic: 'Set a tower to Strong to hit medics first. Jammers stop healing.',
      heavy: 'Thick armour: bring big guns or AP Rounds.',
      behemoth: 'Boss! It costs 10 lives if it gets in. Use everything.',
      gunship: 'Flying boss! You need plenty of Anti-Air.',
    }[type] || '';
  }

  // ---------------------------------------------------------------- HUD

  buildHud() {
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, TOP);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, TOP - 2, WIDTH, 2);
    g.fillStyle(hex(PALETTE.night)).fillRect(0, BOTTOM, WIDTH, HEIGHT - BOTTOM);
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, BOTTOM, WIDTH, 2);
    // Heart and coin icons.
    g.fillStyle(0xd0453f).fillRect(56, 14, 5, 5).fillRect(63, 14, 5, 5).fillRect(55, 17, 14, 5).fillRect(57, 22, 10, 3).fillRect(60, 25, 4, 2);
    g.fillStyle(hex(PALETTE.ink)).fillCircle(116, 20, 8);
    g.fillStyle(hex(PALETTE.gold)).fillCircle(116, 20, 6);
    g.fillStyle(hex(PALETTE.orange)).fillRect(115, 16, 2, 8);
    this.backBtn = button(this, 24, 20, 40, 36, '<', () => this.pauseMenu(), { size: 32, fill: PALETTE.cream }).setDepth(21);
    this.livesT = text(this, 74, 20, '', { origin: [0, 0.5] }).setDepth(21);
    this.fundsT = text(this, 128, 20, '', { origin: [0, 0.5], color: PALETTE.gold }).setDepth(21);
    // Wave counter: tap it for the next wave's line-up.
    this.waveBg = this.add.rectangle(254, 20, 104, 34, hex(PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink)).setDepth(20);
    this.waveT = text(this, 254, 20, '', {}).setDepth(21);
    tapZone(this.add.zone(254, 20, 104, 40).setInteractive().setDepth(21), () => { if (!this.modalOpen()) { sfx('tap'); this.wavePreview(); } });
    button(this, 336, 20, 40, 36, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold }).setDepth(21);
    // Coach strip (first map only).
    this.coachBg = this.add.rectangle(WIDTH / 2, TOP + 4, WIDTH - 8, 52, hex(PALETTE.ink), 0.85).setOrigin(0.5, 0).setDepth(30).setVisible(false);
    this.coachT = text(this, WIDTH / 2, TOP + 30, '', { wrap: WIDTH - 24, color: PALETTE.sand }).setDepth(31).setVisible(false);
    // Bouncing arrow: the container is moved to the target, the triangle inside bobs.
    this.coachArrow = this.add.container(0, 0).setDepth(31).setVisible(false);
    const tri = this.add.triangle(0, 0, 0, 0, 24, 0, 12, 18, hex(PALETTE.gold)).setOrigin(0.5, 1).setStrokeStyle(2, hex(PALETTE.ink));
    this.coachArrow.add(tri);
    this.tweens.add({ targets: tri, y: -6, yoyo: true, repeat: -1, duration: 300 });
  }

  wavePreview() {
    const s = this.s;
    if (!S.moreWaves(s)) { toast(this, 'No more waves: clear the field!', TOP + 60); return; }
    const groups = S.groupsFor(s, s.wave);
    const lines = [{ text: waveSummary(groups), color: PALETTE.cream }];
    const types = [...new Set(groups.map((g) => g.type))];
    for (const t of types) lines.push({ text: `${ENEMIES[t].name}: ${ENEMIES[t].blurb}`, color: PALETTE.lavender });
    if (s.wave === 0) lines.push({ text: 'Tap Send Wave when you are ready.', color: PALETTE.gold });
    else if (s.nextIn != null) lines.push({ text: `Arrives in ${Math.ceil(s.nextIn)}s. Send it now for +${S.earlyBonus(s)} funds.`, color: PALETTE.gold });
    this.pausingModal(`Next: wave ${s.wave + 1}`, lines, [['OK', null]]);
  }

  refreshHud() {
    const s = this.s;
    this.livesT.setText(`${s.lives}`);
    this.fundsT.setText(money(s.funds));
    const w = s.totalWaves ? `Wave ${Math.min(s.wave, s.totalWaves)}/${s.totalWaves}` : `Wave ${s.wave}`;
    this.waveT.setText(w);
    fit(this.waveT, 96);
    this.refreshControls();
  }

  // ---------------------------------------------------------------- bottom panel

  buildBottom() {
    const s = this.s;
    // Tower palette.
    this.palette = this.add.container(0, 0).setDepth(21);
    this.palBtns = {};
    const bw = 48; const gap = 2; const x0 = Math.round((WIDTH - (TOWER_ORDER.length * bw + (TOWER_ORDER.length - 1) * gap)) / 2);
    TOWER_ORDER.forEach((type, i) => {
      const x = x0 + i * (bw + gap); const y = BOTTOM + 6;
      const c = this.add.container(0, 0);
      const bg = this.add.rectangle(x, y, bw, 56, hex(PALETTE.indigo)).setOrigin(0).setStrokeStyle(2, hex(PALETTE.ink));
      const look = LOOK[type];
      let icon;
      if (look.foot) icon = img(this, x + bw / 2, y + 20, footFrame(look.foot, 'b', 'idle', 0), 2);
      else if (look.veh) icon = img(this, x + bw / 2, y + 20, vehFrame(look.veh, 'b', 'u'), look.scale === 1 ? 1 : 2);
      else icon = img(this, x + bw / 2, y + 20, look.bld, 2).setScale(1.5);
      const cost = text(this, x + bw / 2, y + 45, `${S.towerCost(s, type)}`, { color: PALETTE.gold });
      const z = this.add.zone(x, y, bw, 56).setOrigin(0).setInteractive({ useHandCursor: true });
      tapZone(z, () => this.tapPalette(type));
      c.add([bg, icon, cost, z]);
      this.palette.add(c);
      this.palBtns[type] = { bg, cost, z, c };
    });

    // Controls: send wave, speed, powers.
    this.controls = this.add.container(0, 0).setDepth(21);
    const cy = BOTTOM + 94;
    this.waveBtn = button(this, 4 + 68, cy, 136, 44, 'Send Wave', () => this.tapWave(), { fill: PALETTE.gold, silent: true });
    this.speedBtn = button(this, 4 + 136 + 6 + 24, cy, 48, 44, '1x', () => this.toggleSpeed(), { fill: PALETTE.cream });
    this.controls.add([this.waveBtn, this.speedBtn]);
    this.powerBtns = {};
    POWER_ORDER.forEach((p, i) => {
      const b = button(this, 4 + 136 + 6 + 48 + 6 + 24 + i * 52, cy, 48, 44, POWER_LABEL[p], () => this.tapPower(p), { fill: PALETTE.lavender, silent: true });
      fit(b.label, 42);
      this.powerBtns[p] = b;
      this.controls.add(b);
    });

    // Placing: build / cancel.
    this.placeC = this.add.container(0, 0).setDepth(21);
    this.placeInfo = text(this, 12, cy, '', { origin: [0, 0.5], wrap: 190, align: 'left', color: PALETTE.cream });
    this.buildBtn = button(this, 252, cy, 112, 44, 'Build', () => this.confirmBuild(), { fill: PALETTE.gold, silent: true });
    this.cancelBtn = button(this, 334, cy, 44, 44, 'X', () => this.setMode('build'), { fill: PALETTE.cream });
    this.placeC.add([this.placeInfo, this.buildBtn, this.cancelBtn]);

    // Selected tower.
    this.towerC = this.add.container(0, 0).setDepth(21);
    this.tName = text(this, 12, BOTTOM + 20, '', { origin: [0, 0.5], color: PALETTE.gold });
    this.tKills = text(this, WIDTH - 12, BOTTOM + 20, '', { origin: [1, 0.5], color: PALETTE.lavender });
    this.tStats = text(this, 12, BOTTOM + 46, '', { origin: [0, 0.5], color: PALETTE.cream });
    this.upBtn = button(this, 4 + 58, cy, 116, 44, 'Upgrade', () => this.tapUpgrade(), { fill: PALETTE.gold, silent: true });
    this.aimBtn = button(this, 4 + 116 + 4 + 48, cy, 96, 44, 'Aim First', () => this.tapAim(), { fill: PALETTE.lavender });
    this.sellBtn = button(this, 4 + 116 + 4 + 96 + 4 + 42, cy, 84, 44, 'Sell', () => this.tapSell(), { fill: PALETTE.orange, silent: true });
    this.closeBtn = button(this, WIDTH - 26, cy, 44, 44, 'X', () => this.setMode('build'), { fill: PALETTE.cream });
    this.towerC.add([this.tName, this.tKills, this.tStats, this.upBtn, this.aimBtn, this.sellBtn, this.closeBtn]);
  }

  /** Show or hide a group of controls, turning their input off too so hidden buttons can't be hit. */
  show(cont, on) {
    cont.setVisible(on);
    const walk = (o) => {
      if (o.input) o.input.enabled = on;
      if (o.list) o.list.forEach(walk);
    };
    cont.list.forEach(walk);
  }

  setMode(mode, arg) {
    this.mode = mode;
    if (mode !== 'place') { this.placeType = null; this.ghostCell = null; this.ghost.setVisible(false); this.cellsG.clear(); }
    if (mode !== 'tower') this.selected = null;
    if (mode === 'place') { this.placeType = arg; this.ghostCell = null; this.ghost.setVisible(false); this.drawValidCells(); }
    if (mode === 'tower') this.selected = arg;
    this.show(this.palette, mode === 'build' || mode === 'place' || mode === 'aim');
    this.show(this.controls, mode === 'build' || mode === 'aim');
    this.show(this.placeC, mode === 'place');
    this.show(this.towerC, mode === 'tower');
    for (const [type, b] of Object.entries(this.palBtns)) b.bg.setFillStyle(hex(type === this.placeType ? PALETTE.gold : PALETTE.indigo));
    this.drawRange();
    this.refreshControls();
  }

  refreshControls() {
    const s = this.s;
    if (!this.palBtns) return;
    for (const [type, b] of Object.entries(this.palBtns)) b.c.setAlpha(s.funds >= S.towerCost(s, type) ? 1 : 0.5);
    // Wave button.
    let label; let on = S.canCall(s);
    if (s.over) { label = 'Over'; on = false; } else if (s.wave === 0) label = 'Send Wave';
    else if (s.nextIn != null) label = `Next ${Math.ceil(s.nextIn)}s +${S.earlyBonus(s)}`;
    else if (!S.moreWaves(s)) label = 'Last wave';
    else label = `Wave ${s.wave}...`;
    if (this.waveBtn.label.text !== label) { this.waveBtn.setLabel(label); fit(this.waveBtn.label, 126); }
    this.waveBtn.setEnabled(on);
    this.speedBtn.setLabel(s.fast ? '2x' : '1x');
    this.speedBtn.body.setFillStyle(hex(s.fast ? PALETTE.gold : PALETTE.cream));
    for (const p of POWER_ORDER) {
      const b = this.powerBtns[p];
      const have = p in s.powers;
      if (!have) { b.setLabel('-'); b.setAlpha(0.35); continue; }
      const cd = s.powers[p];
      const lbl = cd > 0 ? `${Math.ceil(cd)}` : POWER_LABEL[p];
      if (b.label.text !== lbl) { b.setLabel(lbl); fit(b.label, 42); }
      b.setAlpha(S.canUsePower(s, p) || (this.mode === 'aim' && p === 'airstrike') ? 1 : 0.5);
      b.body.setFillStyle(hex(this.mode === 'aim' && p === 'airstrike' ? PALETTE.red : PALETTE.lavender));
    }
    if (this.mode === 'place') this.refreshPlace();
    if (this.mode === 'tower') this.refreshTower();
  }

  tapPalette(type) {
    if (this.modalOpen() || this.s.over) return;
    if (this.mode === 'place' && this.placeType === type) { sfx('tap'); this.setMode('build'); return; }
    sfx('select');
    this.setMode('place', type);
  }

  refreshPlace() {
    const s = this.s;
    const d = TOWERS[this.placeType];
    const cost = S.towerCost(s, this.placeType);
    let info = `${d.name}: ${d.blurb}`;
    if (this.ghostCell) {
      const p = S.canPlace(s, ...this.ghostCell);
      if (!p.ok) info = p.reason;
      else if (s.funds < cost) info = `Need ${cost - s.funds} more funds`;
    } else info = s.funds < cost ? `${d.name}: need ${cost - s.funds} more funds` : `${d.name}: tap a sand tile`;
    if (this.placeInfo.text !== info && this.placeInfoSrc !== info) {
      // Two lines at most: drop the tower's name, then the description, until it fits.
      this.placeInfoSrc = info;
      this.placeInfo.setText(info);
      if (this.placeInfo.height > 44 && info.startsWith(`${d.name}: `)) this.placeInfo.setText(info.slice(d.name.length + 2));
      if (this.placeInfo.height > 44) this.placeInfo.setText(d.name);
    }
    const ok = this.ghostCell && S.canPlace(s, ...this.ghostCell).ok && s.funds >= cost;
    const lbl = `Build ${cost}`;
    if (this.buildBtn.label.text !== lbl) this.buildBtn.setLabel(lbl);
    this.buildBtn.setEnabled(!!ok);
  }

  drawValidCells() {
    const g = this.cellsG;
    g.clear();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!S.canPlace(this.s, x, y).ok) continue;
        g.lineStyle(1, 0xf9f5ef, 0.35).strokeRect(OX + x * T + 3, TOP + y * T + 3, T - 6, T - 6);
      }
    }
  }

  setGhost(x, y) {
    this.ghostCell = [x, y];
    this.ghost.removeAll(true);
    const [cx, cy] = this.cellXY(x, y);
    this.ghost.setPosition(cx, cy).setVisible(true);
    const ok = S.canPlace(this.s, x, y).ok;
    const look = LOOK[this.placeType];
    this.ghost.add(this.add.rectangle(0, 0, T, T, ok ? 0x7fd858 : 0xd0453f, 0.35).setStrokeStyle(2, ok ? 0x7fd858 : 0xd0453f));
    let spr;
    if (look.foot) spr = img(this, 0, -2, footFrame(look.foot, 'b', 'idle', 0), 2);
    else if (look.veh) spr = img(this, 0, 0, vehFrame(look.veh, 'b', 'u'), look.scale);
    else spr = img(this, 0, 0, look.bld, 2);
    this.ghost.add(spr.setAlpha(0.75));
    this.drawRange();
    this.refreshPlace();
  }

  drawRange() {
    const g = this.rangeG;
    g.clear();
    let x; let y; let st; let range;
    if (this.mode === 'place' && this.ghostCell) {
      [x, y] = this.ghostCell; st = towerStats(this.placeType, 0); range = st.range;
    } else if (this.mode === 'tower' && this.selected) {
      const t = S.towerById(this.s, this.selected);
      if (!t) return;
      x = t.x; y = t.y; st = towerStats(t.type, t.level, t.branch); range = S.rangeOf(this.s, t);
    } else return;
    if (!range) return;
    const [cx, cy] = this.cellXY(x, y);
    g.fillStyle(0xf9f5ef, 0.14).fillCircle(cx, cy, range * T);
    g.lineStyle(2, 0xf9f5ef, 0.8).strokeCircle(cx, cy, range * T);
    if (st.minRange) { g.fillStyle(0xd0453f, 0.18).fillCircle(cx, cy, st.minRange * T); g.lineStyle(1, 0xd0453f, 0.7).strokeCircle(cx, cy, st.minRange * T); }
  }

  confirmBuild() {
    if (this.modalOpen() || this.mode !== 'place' || !this.ghostCell) return;
    const r = S.build(this.s, this.placeType, ...this.ghostCell);
    if (!r.ok) { sfx('error'); toast(this, r.reason, BOTTOM - 30); this.setGhost(...this.ghostCell); return; }
    sfx('place');
    this.makeTowerView(r.tower);
    this.drawRoute();
    stat('towers', 1);
    this.coachSeen.built = true;
    this.afterChange();
    this.setMode('build');
  }

  refreshTower() {
    const s = this.s;
    const t = S.towerById(s, this.selected);
    if (!t) { this.setMode('build'); return; }
    const st = towerStats(t.type, t.level, t.branch);
    const name = t.level >= 3 ? `${st.name}` : `${TOWERS[t.type].name} Lv ${t.level + 1}`;
    this.tName.setText(name);
    this.tKills.setText(TOWERS[t.type].money ? '' : `Kills ${t.kills}`);
    let line;
    if (st.income) line = `Pays ${st.income} funds each wave${st.salvage ? ', kills nearby x2' : ''}`;
    else if (st.pulse) line = `Slows ${Math.round(st.slow * 100)}%  Range ${S.rangeOf(s, t).toFixed(1)}${st.jam ? '  Jams' : ''}`;
    else line = `Dmg ${st.dmg}${st.shots ? 'x3' : ''}  Range ${S.rangeOf(s, t).toFixed(1)}  ${(1 / st.rate).toFixed(1)}/s`;
    if (this.tStats.text !== line) { this.tStats.setText(line); fit(this.tStats, WIDTH - 24); }
    const price = S.upgradePrice(s, t, 0);
    let ul;
    if (price == null) ul = 'Maxed';
    else if (t.level === 2) ul = 'Specialize';
    else ul = `Upgrade ${price}`;
    if (this.upBtn.label.text !== ul) { this.upBtn.setLabel(ul); fit(this.upBtn.label, 106); }
    const cheapest = t.level === 2 ? Math.min(S.upgradePrice(s, t, 0), S.upgradePrice(s, t, 1)) : price;
    // Stays tappable when you can't afford it, so a tap can say how much more you need.
    this.upBtn.setEnabled(price != null);
    if (price != null) this.upBtn.setAlpha(s.funds >= cheapest ? 1 : 0.6);
    const aim = TOWERS[t.type].money || st.pulse ? '-' : `Aim ${TARGET_NAMES[t.prio]}`;
    if (this.aimBtn.label.text !== aim) this.aimBtn.setLabel(aim);
    this.aimBtn.setEnabled(aim !== '-');
    const armed = this.sellArmed && this.sellArmed.id === t.id && this.time.now < this.sellArmed.until;
    const sl = armed ? `Sure? ${S.sellValue(s, t)}` : `Sell ${S.sellValue(s, t)}`;
    this.sellBtn.body.setFillStyle(hex(armed ? PALETTE.red : PALETTE.orange));
    this.sellBtn.label.setColor(armed ? PALETTE.cream : PALETTE.night);
    if (this.sellBtn.label.text !== sl) { this.sellBtn.setLabel(sl); fit(this.sellBtn.label, 76); }
  }

  tapUpgrade() {
    if (this.modalOpen()) return;
    const s = this.s;
    const t = S.towerById(s, this.selected);
    if (!t) return;
    if (t.level === 2) { this.chooseBranch(t); return; }
    const r = S.upgrade(s, t.id);
    if (!r.ok) { sfx('error'); toast(this, r.reason === 'Not enough funds' ? `Need ${S.upgradePrice(s, t) - s.funds} more funds` : r.reason, BOTTOM - 30); return; }
    sfx('power');
    this.makeTowerView(t);
    this.afterChange();
    this.setMode('tower', t.id);
  }

  chooseBranch(t) {
    const d = TOWERS[t.type];
    const s = this.s;
    const lines = d.branches.map((b, i) => ({ text: `${b.name} (${S.upgradePrice(s, t, i)}): ${b.desc}`, color: i ? PALETTE.lavender : PALETTE.cream }));
    lines.push({ text: `You have ${money(s.funds)} funds.`, color: PALETTE.gold });
    const pick = (i) => {
      const r = S.upgrade(s, t.id, i);
      if (!r.ok) { sfx('error'); toast(this, r.reason, BOTTOM - 30); return; }
      sfx('power');
      this.makeTowerView(t);
      this.afterChange();
      this.setMode('tower', t.id);
    };
    this.pausingModal('Specialty', lines, [
      [`${d.branches[0].name} ${S.upgradePrice(s, t, 0)}`, () => pick(0), s.funds >= S.upgradePrice(s, t, 0) ? PALETTE.gold : PALETTE.indigo],
      [`${d.branches[1].name} ${S.upgradePrice(s, t, 1)}`, () => pick(1), s.funds >= S.upgradePrice(s, t, 1) ? PALETTE.gold : PALETTE.indigo],
      ['Cancel', null, PALETTE.cream],
    ]);
  }

  tapAim() {
    const t = S.towerById(this.s, this.selected);
    if (!t || this.modalOpen()) return;
    const i = TARGETS.indexOf(t.prio);
    S.setPriority(this.s, t.id, TARGETS[(i + 1) % TARGETS.length]);
    this.refreshTower();
  }

  tapSell() {
    if (this.modalOpen()) return;
    const s = this.s;
    const t = S.towerById(s, this.selected);
    if (!t) return;
    // Two taps to sell, so a stray tap never throws a tower away.
    if (!this.sellArmed || this.sellArmed.id !== t.id || this.time.now > this.sellArmed.until) {
      this.sellArmed = { id: t.id, until: this.time.now + 2500 };
      sfx('select');
      this.refreshTower();
      return;
    }
    this.sellArmed = null;
    const value = S.sellValue(s, t);
    const r = S.sell(s, t.id);
    if (!r.ok) { sfx('error'); if (r.reason) toast(this, r.reason, BOTTOM - 30); return; }
    sfx('coin');
    const [cx, cy] = this.cellXY(t.x, t.y);
    this.floatText(cx, cy - 10, `+${value}`);
    this.towerViews.get(t.id)?.c.destroy();
    this.towerViews.delete(t.id);
    this.drawRoute();
    this.afterChange();
    this.setMode('build');
  }

  tapWave() {
    if (this.modalOpen()) return;
    const r = S.callWave(this.s);
    if (!r.ok) { sfx('error'); return; }
    if (r.bonus) { this.snd('coin'); this.floatText(this.waveBtn.x, this.waveBtn.y - 30, `+${r.bonus}`); }
    this.handleEvents(S.drain(this.s));
    this.afterChange();
  }

  toggleSpeed() {
    this.s.fast = !this.s.fast;
    this.refreshControls();
  }

  tapPower(p) {
    if (this.modalOpen()) return;
    const s = this.s;
    if (!(p in s.powers)) { sfx('error'); toast(this, `${POWERS[p].name}: unlocks after campaign map ${POWERS[p].unlock}`, BOTTOM - 30, PALETTE.gold, 1600); return; }
    if (p === 'airstrike' && this.mode === 'aim') { sfx('tap'); this.setMode('build'); return; }
    if (!S.canUsePower(s, p)) {
      sfx('error');
      const why = s.powers[p] > 0 ? `${POWERS[p].name} ready in ${Math.ceil(s.powers[p])}s` : p === 'repair' ? 'The base is not damaged' : 'Send the first wave first';
      toast(this, why, BOTTOM - 30);
      return;
    }
    if (p === 'airstrike') { sfx('select'); this.setMode('aim'); toast(this, 'Tap the map to call the airstrike', TOP + 60, PALETTE.gold, 1400); return; }
    S.usePower(s, p);
    this.handleEvents(S.drain(s));
    this.afterChange();
  }

  afterChange() {
    this.refreshHud();
    this.saveNow();
  }

  // ---------------------------------------------------------------- input

  setupInput() {
    let down = null;
    this.input.on('pointerdown', (p) => {
      down = null;
      if (this.modalOpen() || this.finished) return;
      if (p.y < TOP || p.y >= BOTTOM || p.x < OX || p.x >= OX + COLS * T) return;
      down = { x: p.x, y: p.y, id: p.id };
    });
    this.input.on('pointerup', (p) => {
      if (!down || down.id !== p.id) return;
      const d = down; down = null;
      if (this.modalOpen() || this.finished) return;
      if (Math.hypot(p.x - d.x, p.y - d.y) > 16) return;
      // Use where the press started: a finger that rolls a little still hits the tile it meant.
      const x = Math.floor((d.x - OX) / T); const y = Math.floor((d.y - TOP) / T);
      if (!S.inMap(x, y)) return;
      this.tapMap(x, y, (d.x - OX) / T, (d.y - TOP) / T);
    });
  }

  tapMap(x, y, fx, fy) {
    const s = this.s;
    if (this.mode === 'aim') {
      const r = S.usePower(s, 'airstrike', fx, fy);
      if (r.ok) { this.handleEvents(S.drain(s)); this.setMode('build'); this.afterChange(); } else { sfx('error'); this.setMode('build'); }
      return;
    }
    const t = S.towerAt(s, x, y);
    if (this.mode === 'place') {
      if (t) { sfx('select'); this.setMode('tower', t.id); return; }
      if (this.ghostCell && this.ghostCell[0] === x && this.ghostCell[1] === y) { this.confirmBuild(); return; }
      const p = S.canPlace(s, x, y);
      if (!p.ok && s.rows[y][x] !== '.') { sfx('error'); toast(this, p.reason, BOTTOM - 30, PALETTE.gold, 900); return; }
      sfx('tap');
      this.setGhost(x, y);
      return;
    }
    if (t) {
      if (this.mode === 'tower' && this.selected === t.id) { this.setMode('build'); return; }
      sfx('select');
      this.coachSeen.selected = true;
      this.setMode('tower', t.id);
      return;
    }
    if (this.mode === 'tower') { this.setMode('build'); return; }
    if (S.canPlace(s, x, y).ok && !this.hintedPalette) {
      this.hintedPalette = true;
      toast(this, 'Pick a tower at the bottom first', BOTTOM - 30, PALETTE.gold, 1200);
    }
  }

  // ---------------------------------------------------------------- coach (first map)

  coach() {
    if (this.coachStep < 0) return;
    const s = this.s;
    const mg = this.palBtns.mg;
    const waveArrow = this.mode === 'build' ? [this.waveBtn.x, this.waveBtn.y - 22] : null;
    // Steps move forward as you do each thing; a step never goes back.
    const steps = [
      { msg: 'Welcome, commander! Tap the Machine Gun at the bottom.', arrow: [mg.bg.x + 24, mg.bg.y - 4], done: () => this.mode === 'place' || s.towers.length },
      { msg: 'Tap a sand tile next to the road. The circle shows how far it shoots.', done: () => this.ghostCell || s.towers.length },
      { msg: 'Tap Build (or the same tile again) to build it there.', done: () => s.towers.length },
      { msg: 'Nice! Build a couple more along the road.', done: () => s.towers.length >= 3 || s.funds < 50 || s.wave > 0 },
      { msg: 'Ready? Tap Send Wave.', arrow: waveArrow, done: () => s.wave > 0 },
      { msg: 'They follow the road to your base. Each one that gets in costs a life.', done: () => s.t - (this.coachAt || 0) > 6 },
      { msg: 'Kills pay funds. Tap one of your towers to upgrade it.', done: () => this.mode === 'tower' },
      { msg: 'Upgrade makes it stronger. The aim button picks who it shoots first.', done: () => this.mode !== 'tower' || s.towers.some((t) => t.level > 0) },
      { msg: 'After each wave a timer runs on the button. Send the next wave early for bonus funds!', arrow: S.canCall(s) ? waveArrow : null, done: () => s.wave >= 2 },
    ];
    while (this.coachStep < steps.length && steps[this.coachStep].done()) {
      this.coachStep++;
      this.coachAt = s.t;
    }
    if (this.coachStep >= steps.length) { this.endCoach(); return; }
    const st = steps[this.coachStep];
    this.coachBg.setVisible(true);
    this.coachT.setVisible(true);
    if (this.coachT.text !== st.msg) {
      this.coachT.setText(st.msg);
      const h = this.coachT.height + 14;
      this.coachBg.height = h;
      this.coachBg.setSize(WIDTH - 8, h);
      this.coachT.setY(TOP + 4 + h / 2);
    }
    this.coachArrow.setVisible(!!st.arrow);
    if (st.arrow) this.coachArrow.setPosition(st.arrow[0], st.arrow[1]);
  }

  endCoach() {
    if (this.coachStep < 0) return;
    this.coachStep = -1;
    save.set('coach', true);
    this.coachBg.setVisible(false); this.coachT.setVisible(false); this.coachArrow.setVisible(false);
  }

  // ---------------------------------------------------------------- loop

  update(time, delta) {
    const s = this.s;
    if (!s) return;
    const running = !s.over && !this.finished && this.holds.size === 0 && !howToOpen();
    if (running) {
      this.acc += Math.min(delta, 100) / 1000 * (s.fast ? 2 : 1);
      let n = 0;
      while (this.acc >= S.DT && n++ < 8) {
        this.acc -= S.DT;
        S.step(s);
        this.handleEvents(S.drain(s));
        if (s.over) break;
      }
      if (time - this.lastLive > 1000) { this.lastLive = time; checkLive(s); }
      if (time - this.lastSave > 2500) this.saveNow();
    }
    this.syncEnemies(time);
    this.syncTowers(time);
    this.drawShells();
    this.stormFx.fillAlpha = s.storm > 0 ? 0.12 + 0.05 * Math.sin(time / 120) : 0;
    if (this.mode === 'tower' || this.mode === 'place') this.drawRange();
    this.refreshHud();
    this.coach();
  }

  drawShells() {
    const g = this.shellG;
    g.clear();
    for (const sh of this.s.shells) {
      const k = Math.min(1, sh.t / sh.dur);
      const x = OX + (sh.from[0] + (sh.to[0] - sh.from[0]) * k) * T;
      const arc = (sh.big ? 40 : 10) * Math.sin(Math.PI * k);
      const y = TOP + (sh.from[1] + (sh.to[1] - sh.from[1]) * k) * T - arc;
      g.fillStyle(0x040303).fillCircle(x, y, sh.big ? 4 : 3);
      g.fillStyle(0xf0d472).fillCircle(x - 1, y - 1, sh.big ? 2 : 1);
    }
  }

  // ---------------------------------------------------------------- the end

  finish() {
    if (this.finished) return;
    this.finished = true;
    const s = this.s;
    this.flushStats();
    clearGame();
    this.setMode('build');
    const win = s.over === 'win';
    let c = campaign();
    if (s.mode === 'campaign' && win) {
      const st = starsFor(s.lives, s.maxLives);
      recordWin(s.mapId, s.hard ? Math.max(1, c.stars[s.mapId] || 1) : st, s.hard, s.lives);
      c = campaign();
    }
    if (s.mode === 'campaign' && !s.hard) reportResult(win ? 1 : 0, win ? s.lives / s.maxLives : 1 - s.wave / s.totalWaves);
    // Record daily and endless results straight away (the result card shows a moment later).
    if (s.mode === 'daily') this.dailyResult = { score: S.dailyScore(s), ...reportDaily(GAME_ID, S.dailyScore(s)) };
    if (s.mode === 'endless') this.endlessBest = recordEndless(s.mapId, S.wavesCleared(s));
    checkEnd(s, c.stars);
    this.time.delayedCall(win ? 700 : 900, () => this.resultModal(c));
    sfx(win ? 'win' : 'lose');
  }

  resultModal(c) {
    const s = this.s;
    const win = s.over === 'win';
    const idx = CAMPAIGN.findIndex((m) => m.id === s.mapId);
    const lines = [];
    let buttons;
    if (s.mode === 'daily') {
      const r = this.dailyResult;
      const { score } = r;
      lines.push(win ? `You held all ${s.totalWaves} waves with ${s.lives} lives left.` : `The base fell on wave ${s.wave}.`);
      lines.push({ text: `Score ${score}${r.isBest ? '  (best today!)' : `  (best ${r.best})`}`, color: PALETTE.gold });
      lines.push({ text: `Daily streak: ${r.streak} day${r.streak === 1 ? '' : 's'}. New map tomorrow.`, color: PALETTE.lavender });
      buttons = [['Try again', () => this.restart()], ['Menu', () => go(this, 'Menu')]];
    } else if (s.mode === 'endless') {
      const held = S.wavesCleared(s);
      const best = this.endlessBest;
      lines.push(`You held ${held} wave${held === 1 ? '' : 's'}.`);
      lines.push({ text: best ? 'A new best for this map!' : `Best: ${campaign().endless[s.mapId] || held}`, color: PALETTE.gold });
      buttons = [['Again', () => this.restart()], ['Menu', () => go(this, 'Menu', { view: 'campaign' })]];
    } else if (win) {
      const st = starsFor(s.lives, s.maxLives);
      lines.push(`${s.name} holds with ${s.lives} of ${s.maxLives} lives.`);
      if (s.hard) lines.push({ text: 'Won on Hard!', color: PALETTE.orange });
      if (st < 3 && !s.hard) lines.push({ text: 'Lose 2 lives or fewer for 3 stars.', color: PALETTE.lavender });
      const newPower = POWER_ORDER.find((p) => POWERS[p].unlock === idx + 1);
      if (newPower && !s.hard) lines.push({ text: `New support power: ${POWERS[newPower].name}! ${POWERS[newPower].desc}`, color: PALETTE.gold });
      if (idx === CAMPAIGN.length - 1) lines.push({ text: 'The Scorpions are broken. Campaign complete!', color: PALETTE.gold });
      buttons = [];
      if (idx < CAMPAIGN.length - 1) buttons.push(['Next map', () => go(this, 'Menu', { view: 'campaign', brief: CAMPAIGN[idx + 1].id })]);
      buttons.push(['Replay', () => this.restart()], ['Menu', () => go(this, 'Menu', { view: 'campaign' })]);
      modal(this, 'Victory!', lines, buttons, {
        extra: s.hard ? 0 : 34,
        content: (cont, y) => {
          if (s.hard) return;
          const g = this.add.graphics();
          for (let i = 0; i < 3; i++) drawStar(g, WIDTH / 2 + (i - 1) * 40, y + 16, 14, hex(i < st ? PALETTE.gold : PALETTE.indigo));
          cont.add(g);
        },
      });
      return;
    } else {
      lines.push(`The base fell on wave ${s.wave} of ${s.totalWaves}.`);
      lines.push({ text: 'Try a different mix: cannons for groups and armour, Tar to slow, Anti-Air for flyers.', color: PALETTE.lavender });
      if (!s.hard) lines.push({ text: 'Enemies will be a little weaker next time.', color: PALETTE.lavender });
      buttons = [['Retry', () => this.restart()], ['Menu', () => go(this, 'Menu', { view: 'campaign' })]];
    }
    modal(this, win ? 'Victory!' : s.mode === 'endless' ? 'Overrun' : 'Base destroyed', lines, buttons);
  }
}
