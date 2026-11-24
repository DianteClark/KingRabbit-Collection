import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import { TILE, MAP_W, MAP_H, T, PLACE, TRAYS, TOOL_INFO, ZONE_INFO, MILESTONES, LINE_COST } from '../logic/defs.js';
import { lPath, rectTiles, idx, inMap, N4, bfs } from '../logic/map.js';
import { tutStep, tutCheck, STEPS } from '../logic/tutorial.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import { CARS } from './Boot.js';
import * as P from './panels.js';
import { createBot, botStep } from '../logic/bot.js';

const VIEW = { y: 72, h: 468 };
const INFO_Y = 540;
const BAR_Y = 580;
const MW = MAP_W * TILE; const MH = MAP_H * TILE;
const MONTH_MS = 8000; // one game month at 1x
const SPEEDS = [0, 1, 3];
const DRAG_PX = 9;

const CATS = [
  { id: 'look', label: 'Look', icon: 34 },
  { id: 'road', label: 'Road', icon: 1 },
  { id: 'zone', label: 'Zone', icon: 10 },
  { id: 'util', label: 'Power', icon: 3 },
  { id: 'svc', label: 'Civic', icon: 5 },
  { id: 'park', label: 'Park', icon: 15 },
  { id: 'doze', label: 'Doze', icon: 0 },
  { id: 'more', label: 'More', icon: 31 },
];
const MORE = [
  { id: 'money', label: 'Money', icon: 28 }, { id: 'maps', label: 'Maps', icon: 23 }, { id: 'tips', label: 'Tips', icon: 32 },
  { id: 'city', label: 'City', icon: 25 }, { id: 'risks', label: 'Risks', icon: 27 }, { id: 'sound', label: 'Sound', icon: 35 },
];
const GOAL_ITEM = { id: 'goal', label: 'Goal', icon: 30 };
const LINE_TOOLS = new Set(['road', 'line']);
const RECT_TOOLS = new Set(['zone:R', 'zone:C', 'zone:I', 'zone:F', 'dezone', 'bulldoze']);
const isDrag = (t) => LINE_TOOLS.has(t) || RECT_TOOLS.has(t);

const short = (n) => (n >= 1000 ? `$${n % 1000 === 0 ? n / 1000 : (n / 1000).toFixed(1)}k` : `$${n}`);
const toolCost = (t) => (PLACE[t] ? PLACE[t].cost : TOOL_INFO[t]?.cost ?? 0);
const toolName = (t) => (PLACE[t] ? PLACE[t].name : TOOL_INFO[t]?.name || t);
const toolDesc = (t) => (PLACE[t] ? PLACE[t].desc : TOOL_INFO[t]?.desc || '');
const tex = (f) => { const [a, b] = f.split(':'); return [a, b]; };
const hash = (i) => { const h = Math.imul(i + 1, 2654435761) >>> 0; return ((h ^ (h >>> 13)) >>> 0) % 1000; };

// Lane offsets so cars drive on the right.
const LANE = { R: [0, 3], L: [0, -3], D: [-3, 0], U: [3, 0] };

export class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.s = data.state;
    this.holds = new Set();
    this.speed = 1;
    this.tool = 'look';
    this.cat = 'look';
    this.overlay = '';
    this.ptrs = new Map();
    this.gest = null;
    this.dayT = 0.3;
    this.sig = new Array(MAP_W * MAP_H).fill('');
    this.bImgs = new Map();
    this.cars = []; this.walkers = []; this.trucks = [];
    this.dis = new Map();
    this.lastGrowSfx = 0;
    this.saveDue = false;
    // Phaser reuses the scene object, so reset everything a previous visit may have left behind.
    this.leaving = false; this.ready = false; this.trayOpen = false; this.trayCat = null;
    this.toasts = []; this.homeRoads = null; this.routesDirty = true; this.hiTarget = null;
    this.infoUntil = 0; this.infoShown = null; this.hudTick = -1; this.lineScratch = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1c1618');
    this.world = this.add.container(0, 0);
    this.ground = this.add.renderTexture(0, 0, MW, MH).setOrigin(0);
    this.world.add(this.ground);
    this.bLayer = this.add.container(0, 0);
    this.fx = this.add.graphics();
    this.lifeLayer = this.add.container(0, 0);
    this.disLayer = this.add.container(0, 0);
    this.night = this.add.rectangle(0, 0, MW, MH, 0x0b0a24, 0).setOrigin(0);
    this.lights = this.add.graphics();
    this.carLights = this.add.graphics();
    this.overlayG = this.add.graphics();
    this.markLayer = this.add.container(0, 0);
    this.preview = this.add.graphics();
    this.ghost = this.add.image(0, 0, 'res', '0').setOrigin(0).setAlpha(0.65).setVisible(false);
    this.world.add([this.bLayer, this.fx, this.lifeLayer, this.disLayer, this.night, this.lights, this.carLights, this.overlayG, this.markLayer, this.preview, this.ghost]);

    S.refresh(this.s);
    this.syncMap(true);
    this.zoom = 2;
    // Start where the town is (or where it will start).
    const homes = this.s.blds.filter((b) => b.k === 'grow');
    if (homes.length) this.centerOn(homes.reduce((a, b) => a + b.x + b.w / 2, 0) / homes.length * TILE, homes.reduce((a, b) => a + b.y + b.h / 2, 0) / homes.length * TILE);
    else this.centerOn((this.s.start.x + 3) * TILE, this.s.start.y * TILE);
    this.buildHud();
    this.setupInput();
    this.refreshHud();
    this.updateTutorial(true);

    this.onHide = () => { if (document.hidden) this.save(); };
    document.addEventListener('visibilitychange', this.onHide);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', this.onHide); P.closeAll(); this.save(); this.lineScratch?.destroy(); });
    window.__tb = { S, P, scene: this, store, bot: { createBot, botStep } }; // for browser tests
    this.cameras.main.fadeIn(200, 28, 22, 24);
    const sc = S.scenario(this.s);
    if (sc && this.s.t === 0 && !this.s.goalShown) {
      this.s.goalShown = true;
      this.time.delayedCall(300, () => P.sheet({ title: sc.name, g: this, wrap: 'center', html: `<p class="tb-p">${P.esc(sc.goal)}</p><p class="tb-p" style="color:var(--lavender)">You start with ${P.money(sc.money)}. Check your progress any time under More, then City.</p>`, foot: '<button class="tb-btn gold" data-act="close">Let\'s go</button>' }));
    } else if (this.s.result?.over && !this.s.result.keepGoing) {
      this.time.delayedCall(300, () => P.showResult(this, this.s.result.won, this.s.result.reason));
    }
  }

  // ================================================================ map drawing

  /** Redraw every tile whose look changed, and add or remove building sprites. */
  syncMap(all = false) {
    const s = this.s; const r = S.rt(s);
    const rt = this.ground;
    let began = false;
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      const sig = this.tileSig(i, r);
      if (!all && sig === this.sig[i]) continue;
      if (!began) { rt.beginDraw(); began = true; }
      this.sig[i] = sig;
      this.drawTile(i, r);
    }
    if (began) rt.endDraw();
    this.syncBuildings();
  }

  /** Everything that decides how a tile looks, as a short string: terrain, road, line, zone, masks. */
  tileSig(i, r) {
    const s = this.s;
    const t = s.terrain[i];
    let wm = 0; let cm = 0;
    const x = i % MAP_W; const y = (i - x) / MAP_W;
    if (s.road[i] || s.line[i] || t === T.WATER) {
      N4.forEach(([dx, dy], k) => {
        const bit = [2, 8, 4, 1][k];
        const nx = x + dx; const ny = y + dy;
        if (!inMap(nx, ny)) {
          // Water and roads carry on past the map edge.
          if (t === T.WATER) wm |= bit;
          if (s.road[i]) cm |= bit;
          return;
        }
        const j = idx(nx, ny);
        if (s.terrain[j] === T.WATER) wm |= bit;
        if (s.road[i] ? s.road[j] : (s.line[j] || s.road[j] || r.tileB[j] || s.zone[j])) cm |= bit;
      });
    }
    return `${t}${s.road[i]}${s.line[i]}${r.tileB[i] ? 'b' : s.zone[i] || '.'}${wm}|${cm}`;
  }

  drawTile(i, r) {
    const s = this.s; const rt = this.ground;
    const x = (i % MAP_W) * TILE; const y = Math.floor(i / MAP_W) * TILE;
    const t = s.terrain[i];
    const [wm, m] = this.sig[i].slice(4).split('|').map(Number);
    const h = hash(i);
    if (t === T.WATER) rt.batchDrawFrame('tiles', `w${wm}`, x, y);
    else if (t === T.RUBBLE) rt.batchDrawFrame('tiles', `x${h % 2}`, x, y);
    else if (t !== T.WATER) rt.batchDrawFrame('tiles', `g${h % 7 < 4 ? 0 : h % 4}`, x, y);
    if (s.road[i]) { rt.batchDrawFrame('tiles', `${t === T.WATER ? 'b' : 'r'}${m}`, x, y); }
    else if (t === T.TREE && !r.tileB[i]) rt.batchDrawFrame('trees', `t${h % 5}`, x, y - 1);
    if (!r.tileB[i] && !s.road[i] && s.zone[i]) rt.batchDrawFrame('tiles', s.zone[i] === 'F' && t !== T.TREE ? 'field' : `z${s.zone[i]}`, x, y);
    if (s.line[i]) this.drawLine(i, x, y, m, s.road[i]);
  }

  /** A power line: wires toward linked neighbours and a wooden pole. */
  drawLine(i, x, y, m, onRoad) {
    const g = this.lineScratch || (this.lineScratch = this.make.graphics({ x: 0, y: 0 }, false));
    g.clear();
    const cx = 8; const cy = onRoad ? 2 : 7;
    g.fillStyle(0x2a2226);
    if (m & 1) g.fillRect(cx, 0, 1, cy);
    if (m & 4) g.fillRect(cx, cy, 1, 16 - cy);
    if (m & 8) g.fillRect(0, cy, cx, 1);
    if (m & 2) g.fillRect(cx, cy, 16 - cx, 1);
    g.fillStyle(0x854c30).fillRect(cx - 1, cy - 1, 2, 6);
    g.fillStyle(0x4e282e).fillRect(cx - 3, cy - 1, 6, 1);
    this.ground.batchDraw(g, x, y);
  }

  syncBuildings() {
    const s = this.s;
    const seen = new Set();
    let changed = false;
    for (const b of s.blds) {
      seen.add(b.id);
      let img = this.bImgs.get(b.id);
      if (img && img.frameKey !== b.f) { img.destroy(); img = null; }
      if (!img) {
        const [sheet, fr] = tex(b.f);
        img = this.add.image(b.x * TILE, b.y * TILE, sheet, fr).setOrigin(0);
        img.frameKey = b.f;
        this.bLayer.add(img);
        this.bImgs.set(b.id, img);
        changed = true;
        if (this.ready) { img.setAlpha(0); this.tweens.add({ targets: img, alpha: 1, duration: 300 }); }
      }
    }
    for (const [id, img] of this.bImgs) if (!seen.has(id)) { img.destroy(); this.bImgs.delete(id); changed = true; }
    if (changed) this.drawWindows();
    this.ready = true;
  }

  drawWindows() {
    const g = this.lights;
    g.clear();
    for (const b of this.s.blds) {
      if (b.k === 'grow' && b.z === 'F') continue;
      if (PLACE[b.k]?.svc === 'park' && !PLACE[b.k].landmark) continue;
      const n = Math.min(10, b.w * b.h * (b.tier >= 3 ? 3 : 1) + 1);
      for (let k = 0; k < n; k++) {
        const h = hash(b.id * 31 + k);
        const x = b.x * TILE + 3 + (h % (b.w * TILE - 6));
        const y = b.y * TILE + 3 + (hash(h + 7) % Math.max(1, Math.floor(b.h * TILE * 0.6)));
        g.fillStyle(h % 3 ? 0xf0d472 : 0xf9f5ef, 0.9).fillRect(x, y, 1, 1);
      }
    }
  }

  // ================================================================ view

  clampView() {
    const z = this.zoom;
    const w = MW * z; const h = MH * z;
    let x = this.world.x; let y = this.world.y;
    x = w <= WIDTH ? (WIDTH - w) / 2 : Phaser.Math.Clamp(x, WIDTH - w, 0);
    y = h <= VIEW.h ? VIEW.y + (VIEW.h - h) / 2 : Phaser.Math.Clamp(y, VIEW.y + VIEW.h - h, VIEW.y);
    this.world.setPosition(Math.round(x), Math.round(y)).setScale(z);
  }

  centerOn(wx, wy) {
    this.world.x = WIDTH / 2 - wx * this.zoom;
    this.world.y = VIEW.y + VIEW.h / 2 - wy * this.zoom;
    this.clampView();
  }

  zoomAt(z, sx, sy) {
    const nz = Phaser.Math.Clamp(z, Math.min(WIDTH / MW, VIEW.h / MH), 4);
    const wx = (sx - this.world.x) / this.zoom; const wy = (sy - this.world.y) / this.zoom;
    this.zoom = nz;
    this.world.x = sx - wx * nz; this.world.y = sy - wy * nz;
    this.clampView();
  }

  tileAt(sx, sy) {
    return { x: Math.floor((sx - this.world.x) / this.zoom / TILE), y: Math.floor((sy - this.world.y) / this.zoom / TILE) };
  }

  inView(p) { return p.y >= VIEW.y && p.y < VIEW.y + VIEW.h && !this.bannerHit(p); }

  // ================================================================ input

  setupInput() {
    this.input.addPointer(2);
    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));
    this.input.on('wheel', (p, _o, _dx, dy) => { if (this.inView(p) && !P.blocking()) this.zoomAt(this.zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y); });
  }

  onDown(p, over) {
    if (over.length || P.blocking() || !this.inView(p)) return;
    if (this.trayOpen) { this.closeTray(); return; }
    this.ptrs.set(p.id, { x: p.x, y: p.y });
    if (this.ptrs.size === 1) {
      const tile = this.tileAt(p.x, p.y);
      this.gest = { kind: isDrag(this.tool) ? 'draw' : 'pan', id: p.id, x0: p.x, y0: p.y, wx: this.world.x, wy: this.world.y, moved: 0, a: tile, b: tile };
      if (this.gest.kind === 'draw') this.drawPreview();
      else if (PLACE[this.tool]) this.showGhost(tile);
    } else if (this.ptrs.size === 2) {
      // Two fingers: drop whatever was being drawn and pan/zoom instead.
      this.preview.clear(); this.ghost.setVisible(false);
      const [a, b] = [...this.ptrs.values()];
      this.gest = { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, wx: this.world.x, wy: this.world.y };
      this.setInfoText(this.toolHint());
    }
  }

  onMove(p) {
    if (!this.ptrs.has(p.id)) {
      // Mouse hover: show where a building would go.
      if (!p.isDown && PLACE[this.tool] && this.inView(p) && !P.blocking() && p.wasTouch === false) this.showGhost(this.tileAt(p.x, p.y));
      return;
    }
    this.ptrs.set(p.id, { x: p.x, y: p.y });
    const g = this.gest;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const nz = Phaser.Math.Clamp(g.z0 * (d / g.d0), Math.min(WIDTH / MW, VIEW.h / MH), 4);
      const wx = (g.mx - g.wx) / g.z0; const wy = (g.my - g.wy) / g.z0;
      this.zoom = nz;
      this.world.x = mx - wx * nz; this.world.y = my - wy * nz;
      this.clampView();
      return;
    }
    if (p.id !== g.id) return;
    g.moved = Math.max(g.moved, Math.hypot(p.x - g.x0, p.y - g.y0));
    if (g.kind === 'draw') {
      const t = this.tileAt(Phaser.Math.Clamp(p.x, 0, WIDTH - 1), Phaser.Math.Clamp(p.y, VIEW.y, VIEW.y + VIEW.h - 1));
      t.x = Phaser.Math.Clamp(t.x, 0, MAP_W - 1); t.y = Phaser.Math.Clamp(t.y, 0, MAP_H - 1);
      if (t.x !== g.b.x || t.y !== g.b.y) { g.b = t; this.drawPreview(); }
    } else if (g.moved > DRAG_PX) {
      this.ghost.setVisible(false); this.preview.clear();
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
    if (P.blocking()) { this.cancelGesture(); return; }
    if (g.kind === 'draw') { this.commitDraw(g); return; }
    if (g.moved <= DRAG_PX) this.tapTile(g.a);
    else if (!PLACE[this.tool]) this.preview.clear();
  }

  cancelGesture() {
    this.gest = null; this.ptrs.clear();
    this.preview.clear(); this.ghost.setVisible(false);
    this.setInfoText(this.toolHint());
  }

  tapTile(t) {
    if (!inMap(t.x, t.y)) return;
    if (this.tool === 'look') { sfx('tap'); P.showInfo(this, t.x, t.y); return; }
    if (PLACE[this.tool]) {
      const { w, h } = S.placeSize(this.tool);
      const x = t.x - Math.floor((w - 1) / 2); const y = t.y - Math.floor((h - 1) / 2);
      const res = S.place(this.s, this.tool, x, y);
      this.ghost.setVisible(false); this.preview.clear();
      if (res.ok) {
        sfx('place');
        this.puff(x, y, w, h);
        this.afterChange(`${PLACE[this.tool].name} built for ${P.money(res.cost)}`);
        if (PLACE[this.tool].landmark && !['university'].includes(this.tool)) this.selectTool('look', 'look');
      } else { sfx('error'); this.toast(res.reason); this.flashBad(x, y, w, h); }
    }
  }

  // ---------------------------------------------------------------- drawing tools

  planFor(g) {
    const s = this.s;
    const t = this.tool;
    if (LINE_TOOLS.has(t)) return S.planLine(s, t, lPath(g.a, g.b));
    const tiles = rectTiles(g.a, g.b);
    if (t === 'bulldoze') return S.planBulldoze(s, tiles);
    if (t === 'dezone') return S.planZone(s, '', tiles);
    return S.planZone(s, t.split(':')[1], tiles);
  }

  drawPreview() {
    const g = this.gest; if (!g) return;
    const plan = this.planFor(g);
    const pg = this.preview;
    pg.clear();
    const bad = plan.cost > this.s.money;
    const col = this.tool === 'bulldoze' || this.tool === 'dezone' ? 0xa13d3b : this.tool.startsWith('zone:') ? ZONE_INFO[this.tool[5]].color : 0xe3d245;
    for (const t of plan.tiles) {
      const c = !t.ok ? 0x7a6060 : bad ? 0xa13d3b : col;
      pg.fillStyle(c, t.ok ? 0.5 : 0.25).fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    }
    if (RECT_TOOLS.has(this.tool)) {
      const x0 = Math.min(g.a.x, g.b.x); const y0 = Math.min(g.a.y, g.b.y);
      pg.lineStyle(1 / this.zoom * 2, 0xf9f5ef, 0.9).strokeRect(x0 * TILE, y0 * TILE, (Math.abs(g.a.x - g.b.x) + 1) * TILE, (Math.abs(g.a.y - g.b.y) + 1) * TILE);
    }
    const n = plan.tiles.filter((t) => t.ok && (t.cost > 0 || this.tool === 'dezone')).length;
    this.setInfoText(`${toolName(this.tool)}: ${n} tile${n === 1 ? '' : 's'}, ${P.money(plan.cost)}${bad ? '\nNot enough money!' : '\nLift your finger to build.'}`, bad ? '#f3b0a8' : PALETTE.cream);
  }

  commitDraw(g) {
    const s = this.s;
    const t = this.tool;
    this.preview.clear();
    let res;
    if (LINE_TOOLS.has(t)) res = S.buildLine(s, t, lPath(g.a, g.b));
    else if (t === 'bulldoze') res = S.bulldoze(s, rectTiles(g.a, g.b));
    else if (t === 'dezone') res = S.zoneArea(s, '', rectTiles(g.a, g.b));
    else res = S.zoneArea(s, t.split(':')[1], rectTiles(g.a, g.b));
    if (res.ok) {
      sfx(t === 'bulldoze' ? 'thud' : 'place');
      this.afterChange(res.cost ? `${toolName(t)}: ${P.money(res.cost)}` : '');
    } else {
      if (g.moved > DRAG_PX || res.reason === 'Not enough money') { sfx('error'); this.toast(res.reason); }
      this.setInfoText(this.toolHint());
    }
  }

  showGhost(t) {
    const key = this.tool;
    const { w, h } = S.placeSize(key);
    const x = t.x - Math.floor((w - 1) / 2); const y = t.y - Math.floor((h - 1) / 2);
    const c = S.checkPlace(this.s, key, x, y);
    const [sheet, fr] = tex(PLACE[key].frames[0]);
    this.ghost.setTexture(sheet, fr).setPosition(x * TILE, y * TILE).setVisible(true).setTint(c.ok ? 0xffffff : 0xff8080);
    this.preview.clear().fillStyle(c.ok ? 0x6c8c50 : 0xa13d3b, 0.45).fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
    const r = PLACE[key].r;
    if (r && c.ok) this.preview.lineStyle(2 / this.zoom, 0xf9f5ef, 0.6).strokeCircle((x + w / 2) * TILE, (y + h / 2) * TILE, r * TILE);
    this.setInfoText(c.ok ? `${PLACE[key].name} ${P.money(c.cost)}\nLift your finger to build here.` : `${PLACE[key].name}: ${c.reason}`, c.ok ? PALETTE.cream : '#f3b0a8');
  }

  flashBad(x, y, w, h) {
    const r = this.add.rectangle(x * TILE, y * TILE, w * TILE, h * TILE, 0xa13d3b, 0.6).setOrigin(0);
    this.world.add(r);
    this.tweens.add({ targets: r, alpha: 0, duration: 500, onComplete: () => r.destroy() });
  }

  puff(x, y, w, h) {
    for (let k = 0; k < 6; k++) {
      const c = this.add.circle((x + Math.random() * w) * TILE, (y + h) * TILE - 2, 2 + Math.random() * 2, 0xf9f5ef, 0.8);
      this.world.add(c);
      this.tweens.add({ targets: c, y: c.y - 8 - Math.random() * 6, alpha: 0, scale: 2, duration: 500 + Math.random() * 300, onComplete: () => c.destroy() });
    }
  }

  /** Something on the map changed (an action, undo, growth): redraw and save. */
  afterChange(msg) {
    S.refresh(this.s);
    this.syncMap();
    if (this.overlay) this.drawOverlay();
    this.refreshHud();
    this.updateTutorial();
    this.save();
    if (msg) this.setInfoText(msg);
    this.routesDirty = true;
  }

  // ================================================================ HUD

  buildHud() {
    const d = (o, z = 51) => o.setDepth(z);
    const bg = d(this.add.graphics(), 50);
    bg.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, VIEW.y);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, VIEW.y - 2, WIDTH, 2);
    bg.fillStyle(0x2a2330).fillRect(0, INFO_Y, WIDTH, BAR_Y - INFO_Y);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, INFO_Y, WIDTH, 2);
    bg.fillStyle(hex(PALETTE.night)).fillRect(0, BAR_Y, WIDTH, HEIGHT - BAR_Y);
    bg.fillStyle(hex(PALETTE.ink)).fillRect(0, BAR_Y, WIDTH, 2);
    // Blocks taps on the HUD strips from reaching the map.
    for (const [y, h] of [[0, VIEW.y], [INFO_Y, HEIGHT - INFO_Y]]) d(this.add.zone(0, y, WIDTH, h).setOrigin(0).setInteractive(), 49);

    d(button(this, 25, 19, 42, 34, '<', () => this.toTitle(), { size: 32, fill: PALETTE.cream }));
    this.moneyText = d(text(this, 52, 19, '', { origin: [0, 0.5], color: PALETTE.gold }));
    const popZone = d(this.add.zone(132, 2, 100, 34).setOrigin(0).setInteractive({ useHandCursor: true }));
    popZone.on('pointerup', () => { if (!P.blocking()) { sfx('tap'); P.showStats(this); } });
    d(this.add.image(142, 19, 'icons', 25).setScale(1));
    this.popText = d(text(this, 153, 19, '', { origin: [0, 0.5], color: PALETTE.cream }));
    this.happyIcon = d(this.add.image(242, 19, 'icons', 58));
    this.happyText = d(text(this, 253, 19, '', { origin: [0, 0.5], color: PALETTE.cream }));
    const hz = d(this.add.zone(232, 2, 64, 34).setOrigin(0).setInteractive({ useHandCursor: true }));
    hz.on('pointerup', () => { if (!P.blocking()) { sfx('tap'); P.showStats(this); } });
    d(button(this, 336, 19, 40, 34, '?', () => this.howTo(), { size: 32, fill: PALETTE.gold }));

    this.dateText = d(text(this, 8, 53, '', { origin: [0, 0.5], color: PALETTE.lavender }));
    // RCI meter
    this.rci = d(this.add.graphics());
    ['R', 'C', 'I'].forEach((z, k) => d(text(this, 82 + k * 26, 53, z, { color: ZONE_INFO[z].css })));
    const rz = d(this.add.zone(72, 36, 84, 34).setOrigin(0).setInteractive({ useHandCursor: true }));
    rz.on('pointerup', () => { if (!P.blocking()) { sfx('tap'); P.showDemand(this); } });
    this.speedBtns = SPEEDS.map((v, k) => d(button(this, 208 + k * 50, 52, 46, 34, ['||', '1x', '3x'][k], () => this.setSpeed(k), { fill: PALETTE.lavender })));

    // Info line + undo
    this.infoText = d(text(this, 8, INFO_Y + 21, '', { origin: [0, 0.5], color: PALETTE.cream, wrap: 268, align: 'left' }));
    this.infoText.setLineSpacing(0);
    const iz = d(this.add.zone(0, INFO_Y + 2, 276, 38).setOrigin(0).setInteractive({ useHandCursor: true }), 50);
    iz.on('pointerup', () => { if (!P.blocking() && this.tool === 'look') { sfx('tap'); P.showAdvisors(this); } });
    this.undoBtn = d(button(this, 318, INFO_Y + 19, 76, 34, 'Undo', () => this.doUndo(), { fill: PALETTE.cream }));

    // Toolbar
    this.catBtns = CATS.map((c, k) => this.makeCatButton(c, k));
    // Tray (filled when a category opens)
    this.tray = this.add.container(0, 0).setDepth(60).setVisible(false);
    this.trayOpen = false;
    // Overlay chip, pause tag, tutorial banner, toasts
    this.chip = d(button(this, 0, 0, 150, 36, '', () => this.setOverlay(''), { fill: PALETTE.cream }), 55).setVisible(false);
    this.pauseTag = d(text(this, WIDTH / 2, VIEW.y + 16, 'PAUSED', { color: PALETTE.gold }), 55).setVisible(false);
    this.pauseBg = d(this.add.rectangle(WIDTH / 2, VIEW.y + 16, 84, 24, hex(PALETTE.ink), 0.7), 54).setVisible(false);
    this.banner = this.add.container(0, 0).setDepth(56).setVisible(false);
    this.bannerBg = this.add.rectangle(4, VIEW.y + 4, WIDTH - 8, 60, hex(PALETTE.ink), 0.88).setOrigin(0).setStrokeStyle(2, hex(PALETTE.gold));
    this.bannerText = text(this, 12, VIEW.y + 10, '', { origin: 0, color: PALETTE.cream, wrap: 270, align: 'left' });
    this.bannerStep = text(this, WIDTH - 40, VIEW.y + 12, '', { color: PALETTE.lavender });
    this.bannerSkip = button(this, WIDTH - 40, VIEW.y + 40, 60, 32, 'Skip', () => this.skipTutorial(), { fill: PALETTE.cream });
    this.bannerBg.setInteractive();
    this.banner.add([this.bannerBg, this.bannerText, this.bannerStep, this.bannerSkip]);
    this.hilite = this.add.graphics().setDepth(62);
    this.selectTool('look', 'look', true);
  }

  makeCatButton(c, k) {
    const w = WIDTH / CATS.length;
    // Containers hit-test around their centre, so everything is laid out from the middle.
    const cont = this.add.container(k * w + w / 2, BAR_Y + 31).setDepth(51);
    const bg = this.add.rectangle(0, 0, w - 2, 54, hex(PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
    const icon = this.add.image(0, -9, 'icons', c.icon).setScale(2);
    const lbl = text(this, 0, 16, c.label, { color: PALETTE.cream });
    cont.add([bg, icon, lbl]);
    cont.setSize(w, 58);
    cont.setInteractive({ useHandCursor: true });
    let down = false;
    cont.on('pointerdown', () => { down = true; icon.y = -7; });
    cont.on('pointerout', () => { down = false; icon.y = -9; });
    cont.on('pointerup', () => { icon.y = -9; if (!down || P.blocking()) return; down = false; this.tapCat(c.id); });
    cont.bg = bg; cont.icon = icon; cont.lbl = lbl; cont.cat = c.id;
    return cont;
  }

  tapCat(id) {
    sfx('tap');
    if (id === 'look') { this.selectTool('look', 'look'); this.closeTray(); return; }
    if (id === 'doze') { this.selectTool('bulldoze', 'doze'); this.closeTray(); return; }
    if (this.trayOpen && this.trayCat === id) { this.closeTray(); return; }
    this.openTray(id);
  }

  openTray(cat) {
    const t = this.tray;
    t.removeAll(true);
    this.trayCat = cat;
    const more = S.scenario(this.s) ? [GOAL_ITEM, ...MORE] : MORE;
    const items = cat === 'more' ? more.map((m) => ({ ...m, more: true })) : TRAYS[cat].map((k) => ({ id: k }));
    const perRow = 6; const iw = 60; const ih = 64;
    const rows = Math.ceil(items.length / perRow);
    const h = rows * ih + 10;
    const y0 = INFO_Y - h;
    const bg = this.add.rectangle(0, y0, WIDTH, h, hex(PALETTE.night), 0.96).setOrigin(0).setStrokeStyle(2, hex(PALETTE.ink));
    bg.setInteractive(); // swallows taps between items
    t.add(bg);
    items.forEach((it, k) => {
      const col = k % perRow; const row = Math.floor(k / perRow);
      const n = Math.min(perRow, items.length - row * perRow);
      const x = (WIDTH - n * iw) / 2 + col * iw + iw / 2;
      const y = y0 + 5 + row * ih + ih / 2;
      t.add(this.makeTrayItem(it, x, y, iw - 4, ih - 4));
    });
    t.setVisible(true);
    this.trayOpen = true;
    this.trayH = h;
    this.refreshToolbar();
    this.updateTutorial();
  }

  closeTray() {
    if (!this.trayOpen) return;
    this.tray.setVisible(false);
    this.trayOpen = false;
    this.trayCat = null;
    this.refreshToolbar();
    this.updateTutorial();
  }

  makeTrayItem(it, x, y, w, h) {
    const s = this.s;
    const cont = this.add.container(x, y);
    const id = it.id;
    const locked = !it.more && (S.isLocked(s, id) || S.isBanned(s, id));
    const sel = !it.more && this.tool === id;
    const bg = this.add.rectangle(0, 0, w, h, hex(sel ? PALETTE.gold : PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink));
    cont.add(bg);
    let icon;
    if (it.more) icon = this.add.image(0, -10, 'icons', it.icon).setScale(2);
    else if (id === 'road') icon = this.add.image(0, -10, 'tiles', 'r10').setScale(2);
    else if (id === 'line') icon = this.add.image(0, -10, 'icons', 3).setScale(2);
    else if (id === 'dezone') icon = this.add.image(0, -10, 'icons', 6).setScale(2);
    else if (id.startsWith('zone:')) {
      const f = { R: 'res:0', C: 'com:0', I: 'ind:0', F: 'farm:1' }[id[5]];
      icon = this.add.image(0, -10, ...tex(f)).setScale(id[5] === 'F' ? 1 : 2);
    } else {
      const [sheet, fr] = tex(PLACE[id].frames[0]);
      icon = this.add.image(0, -10, sheet, fr);
      const sc = Math.min(2, 34 / icon.width, 34 / icon.height);
      icon.setScale(sc >= 1 ? Math.floor(sc) : sc);
    }
    cont.add(icon);
    if (id.startsWith('zone:')) {
      const z = id[5];
      cont.add(text(this, -w / 2 + 9, -h / 2 + 10, z, { color: ZONE_INFO[z].css }));
      bg.setStrokeStyle(2, ZONE_INFO[z].color);
    }
    let label;
    if (it.more) label = id === 'sound' ? (isMuted() ? 'Off' : 'Sound') : it.label;
    else if (S.isBanned(s, id)) label = 'Banned';
    else if (S.isLocked(s, id)) label = ['', 'Village', 'Town', 'City', 'Metro'][S.toolUnlock(id)];
    else label = id === 'dezone' ? 'Free' : short(toolCost(id));
    const lt = text(this, 0, h / 2 - 11, label, { color: sel ? PALETTE.night : locked ? PALETTE.lavender : PALETTE.cream });
    cont.add(lt);
    if (locked) icon.setAlpha(0.35);
    cont.setSize(w, h);
    cont.setInteractive();
    let down = false;
    cont.on('pointerdown', () => { down = true; cont.y = y + 2; });
    cont.on('pointerout', () => { down = false; cont.y = y; });
    cont.on('pointerup', () => {
      cont.y = y;
      if (!down || P.blocking()) return;
      down = false;
      if (it.more) { this.closeTray(); this.doMore(id); return; }
      if (locked) {
        sfx('error');
        this.toast(S.isBanned(s, id) ? `${toolName(id)} is banned in this scenario.` : `${toolName(id)} unlocks at ${MILESTONES[S.toolUnlock(id)].name} (${MILESTONES[S.toolUnlock(id)].pop.toLocaleString('en-US')} people).`);
        return;
      }
      sfx('select');
      this.selectTool(id, this.trayCat);
      this.closeTray();
    });
    cont.item = id;
    return cont;
  }

  selectTool(tool, cat, quiet) {
    this.tool = tool;
    this.cat = cat;
    this.ghost.setVisible(false);
    this.preview.clear();
    this.refreshToolbar();
    if (!quiet) this.setInfoText(this.toolHint());
    this.updateTutorial();
  }

  /** Two short lines: name and cost, then what it does. */
  toolHint() {
    const t = this.tool;
    if (t === 'look') return '';
    const cost = toolCost(t);
    const costTxt = t === 'dezone' ? '' : isDrag(t) ? ` ${P.money(cost)}/tile` : ` ${P.money(cost)}`;
    return `${toolName(t)}${costTxt}: ${isDrag(t) ? 'drag' : 'tap map'}\n${toolDesc(t)}`;
  }

  refreshToolbar() {
    for (const b of this.catBtns) {
      const on = (this.trayOpen && this.trayCat === b.cat) || (!this.trayOpen && this.cat === b.cat);
      b.bg.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      b.lbl.setColor(on ? PALETTE.night : PALETTE.cream);
    }
  }

  /** Fit text into the two-line info strip (cut with ... if it is longer). */
  setInfoText(msg, color = PALETTE.cream, holdMs = 2500) {
    this.infoUntil = this.time.now + holdMs;
    this.infoShown = msg;
    const t = this.infoText;
    t.setColor(color);
    t.setText(msg || '');
    let str = msg || '';
    while (t.height > 38 && str.length > 4) { str = `${str.slice(0, -5).trimEnd()}...`; t.setText(str); }
  }

  refreshHud() {
    const s = this.s;
    this.moneyText.setText(P.money(s.money)).setColor(s.money < 0 ? '#f3b0a8' : PALETTE.gold);
    this.popText.setText(s.pop.toLocaleString('en-US'));
    const h = Math.round(s.happy);
    this.happyText.setText(`${h}%`).setColor(h < 40 ? '#f3b0a8' : h < 60 ? PALETTE.sand : '#c9e6a8');
    this.dateText.setText(S.date(s).label);
    const g = this.rci;
    g.clear();
    ['R', 'C', 'I'].forEach((z, k) => {
      const v = s.demand[z];
      const x = 90 + k * 26; const mid = 53;
      g.fillStyle(hex(PALETTE.ink)).fillRect(x, mid - 14, 8, 28);
      const hh = Math.round(Math.abs(v) * 12);
      g.fillStyle(v >= 0 ? ZONE_INFO[z].color : 0xa13d3b).fillRect(x + 1, v >= 0 ? mid - hh : mid, 6, Math.max(1, hh));
      g.fillStyle(0xf9f5ef, 0.6).fillRect(x, mid, 8, 1);
    });
    this.speedBtns.forEach((b, k) => b.body.setFillStyle(hex(k === this.speed ? PALETTE.gold : PALETTE.lavender)));
    const canUndo = S.canUndo(s);
    this.undoBtn.setVisible(canUndo);
    if (this.time.now > (this.infoUntil || 0) && !this.gest) {
      if (this.tool === 'look') {
        const last = s.log.at(-1);
        const msg = last ? last.text : 'Tap Road to start building. Tap here for advice.';
        if (this.infoShown !== msg) this.setInfoText(msg, { bad: '#f3b0a8', good: '#c9e6a8' }[last?.tone] || PALETTE.cream, 0);
      } else {
        const hint = this.toolHint();
        if (this.infoShown !== hint) this.setInfoText(hint, PALETTE.cream, 0);
      }
    }
  }

  setSpeed(k) {
    this.speed = k;
    this.refreshHud();
  }

  howTo() {
    if (P.blocking()) return;
    this.hold('howto');
    showHowTo(RULES, () => this.release('howto'));
  }

  doUndo() {
    if (P.blocking() || this.gest) return;
    const act = S.undo(this.s);
    if (!act) return;
    sfx('flip');
    this.afterChange(`Undid ${act.label}, refunded ${P.money(act.cost)}`);
  }

  doMore(id) {
    sfx('tap');
    if (id === 'money') P.showBudget(this);
    else if (id === 'maps') P.showMaps(this);
    else if (id === 'tips') P.showAdvisors(this);
    else if (id === 'city' || id === 'goal') P.showStats(this);
    else if (id === 'risks') P.showRisks(this);
    else if (id === 'sound') { setMuted(!isMuted()); this.toast(isMuted() ? 'Sound off' : 'Sound on'); if (!isMuted()) sfx('select'); }
  }

  toast(msg) {
    const y = VIEW.y + (this.banner.visible ? 96 : 40);
    const t = text(this, WIDTH / 2, y, msg, { color: PALETTE.gold, wrap: 320 }).setDepth(70);
    const bg = this.add.rectangle(WIDTH / 2, y, Math.min(344, t.width + 16), t.height + 8, hex(PALETTE.ink), 0.85).setDepth(69);
    this.toasts = (this.toasts || []).filter((x) => x.t.active);
    for (const o of this.toasts) { o.t.y += 0; o.t.destroy(); o.bg.destroy(); }
    this.toasts = [{ t, bg }];
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 1800, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  }

  // ---------------------------------------------------------------- overlays

  setOverlay(k) {
    this.overlay = k;
    this.drawOverlay();
    if (k) { sfx('select'); this.chip.setLabel(`${S.OVERLAYS[k]}  X`).setVisible(true); } else this.chip.setVisible(false);
    this.layoutChip();
  }

  layoutChip() {
    const y = VIEW.y + (this.banner.visible ? this.bannerBg.height + 30 : 24);
    this.chip.setPosition(WIDTH - 82, y);
  }

  drawOverlay() {
    const g = this.overlayG;
    g.clear();
    const k = this.overlay;
    if (!k) return;
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      const v = S.overlayValue(this.s, k, i);
      if (v === null) continue;
      const good = ['power', 'water', 'lv', 'police', 'fire', 'health', 'edu'].includes(k);
      const q = good ? v : 1 - v;
      if (good && v === 0 && k !== 'power') { g.fillStyle(0xa13d3b, 0.25).fillRect((i % MAP_W) * TILE, Math.floor(i / MAP_W) * TILE, TILE, TILE); continue; }
      const col = q > 0.66 ? 0x6ec05a : q > 0.33 ? 0xe3d245 : 0xa13d3b;
      g.fillStyle(col, k === 'traffic' ? 0.75 : 0.45).fillRect((i % MAP_W) * TILE, Math.floor(i / MAP_W) * TILE, TILE, TILE);
    }
  }

  // ---------------------------------------------------------------- tutorial

  bannerHit(p) { return this.banner?.visible && p.y < VIEW.y + 4 + this.bannerBg.height && p.y > VIEW.y; }

  updateTutorial(first) {
    const s = this.s;
    const moved = tutCheck(s);
    const step = tutStep(s);
    this.hilite.clear();
    if (!step) {
      this.hiTarget = null;
      if (this.banner.visible) {
        this.banner.setVisible(false); this.layoutChip();
        if (moved) { sfx('goal'); this.toast('Guide done! Your advisors will help from here.'); store.set('guided', true); this.save(); }
      }
      return;
    }
    const k = STEPS.indexOf(step);
    this.bannerText.setText(step.text);
    this.bannerStep.setText(`${k + 1}/${STEPS.length}`);
    const h = Math.max(64, this.bannerText.height + 14);
    this.bannerBg.height = h;
    this.bannerBg.setSize(WIDTH - 8, h);
    this.bannerBg.input.hitArea.setSize(WIDTH - 8, h);
    this.banner.setVisible(true);
    this.layoutChip();
    if (moved && !first) sfx('goal');
    // Point at the next thing to tap.
    let target = null;
    if (step.tray && this.tool !== step.tool && !(step.id === 'jobs' && (this.tool === 'zone:C' || this.tool === 'zone:I'))) {
      if (this.trayOpen && this.trayCat === step.tray) target = this.tray.list.find((c) => c.item === step.tool);
      else target = this.catBtns.find((b) => b.cat === step.tray);
    } else if (step.id === 'grow' && this.speed !== 2) target = this.speedBtns[2];
    this.hiTarget = target;
  }

  drawHilite() {
    const g = this.hilite;
    g.clear();
    const t = this.hiTarget;
    if (!t || !t.visible || P.anyOpen()) return;
    const b = t.getBounds();
    const a = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    g.lineStyle(3, hex(PALETTE.gold), a).strokeRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);
  }

  skipTutorial() {
    if (P.blocking()) return;
    this.s.tut = null;
    store.set('guided', true);
    this.updateTutorial();
    this.banner.setVisible(false);
    this.layoutChip();
    this.save();
  }

  // ================================================================ the clock

  hold(k) { this.holds.add(k); }
  release(k) { this.holds.delete(k); }

  update(_, ms) {
    const s = this.s;
    const over = s.result?.over && !s.result.keepGoing;
    const running = !this.holds.size && SPEEDS[this.speed] > 0 && !over;
    const dt = Math.min(ms, 100);
    if (running) {
      const events = S.advance(s, (dt / MONTH_MS) * SPEEDS[this.speed]);
      if (events.length) this.onEvents(events);
      this.dayT += (dt / 60000) * (this.speed === 2 ? 1.8 : 1);
    }
    const vis = running ? dt * (this.speed === 2 ? 2 : 1) : 0;
    // Day and night
    const c = Math.cos(this.dayT * Math.PI * 2);
    const dark = Phaser.Math.Clamp((c - 0.25) / 0.5, 0, 1);
    this.dark = dark;
    this.night.fillAlpha = dark * 0.45;
    this.lights.setAlpha(dark);
    this.carLights.clear();
    this.stepLife(vis);
    this.drawFires();
    this.drawDisasters(vis);
    this.drawMarkers();
    this.drawHilite();
    const paused = SPEEDS[this.speed] === 0 && !over;
    const blink = paused && Math.floor(this.time.now / 600) % 2 === 0;
    this.pauseTag.setVisible(blink && !this.banner.visible); this.pauseBg.setVisible(blink && !this.banner.visible);
    if (this.saveDue && running) { this.saveDue = false; this.save(); }
    if (Math.floor(this.time.now / 250) !== this.hudTick) { this.hudTick = Math.floor(this.time.now / 250); this.refreshHud(); }
  }

  onEvents(events) {
    let changed = false;
    for (const e of events) {
      switch (e.kind) {
        case 'grow': case 'decline': changed = true;
          if (e.kind === 'grow' && this.time.now - this.lastGrowSfx > 1200) { this.lastGrowSfx = this.time.now; sfx('bounce'); }
          break;
        case 'wreck': changed = true; this.dust(e); break;
        case 'month': this.saveDue = true; changed = true; break;
        case 'milestone': this.save(); P.showMilestone(this, e); this.refreshTrayIfOpen(); break;
        case 'advice': break;
        case 'disaster': this.onDisaster(e); break;
        case 'impact': sfx('boom'); this.cameras.main.shake(300, 0.01); this.impactFx(e); changed = true; break;
        case 'fireOut': sfx('coin'); changed = true; break;
        case 'ufoDown': sfx('hit'); this.toast(e.text); this.ufoDownFx(e); break;
        case 'disasterOver': break;
        case 'win': case 'lose': this.onResult(e); break;
        default: break;
      }
    }
    if (changed) {
      this.syncMap();
      if (this.overlay) this.drawOverlay();
      this.updateTutorial();
      this.routesDirty = true;
    }
  }

  refreshTrayIfOpen() { if (this.trayOpen) this.openTray(this.trayCat); }

  onResult(e) {
    const s = this.s;
    if (e.kind === 'win') {
      const best = store.get('best') || {};
      const months = Math.floor(s.t);
      if (!best[s.mode] || best[s.mode].months > months) { best[s.mode] = { months, pop: s.pop }; store.set('best', best); }
    }
    this.save();
    this.time.delayedCall(400, () => P.showResult(this, e.kind === 'win', e.reason));
  }

  // ================================================================ life on the streets

  buildRoutes() {
    const s = this.s; const r = S.rt(s);
    this.routesDirty = false;
    this.homeRoads = []; this.jobRoads = []; this.edgeRoads = [];
    for (const b of s.blds) {
      const a = r.access.get(b.id);
      if (a === undefined) continue;
      if (b.k === 'grow' && b.z === 'R') this.homeRoads.push(a); else this.jobRoads.push(a);
    }
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      if (!s.road[i]) continue;
      const x = i % MAP_W; const y = (i - x) / MAP_W;
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) this.edgeRoads.push(i);
    }
  }

  routeBetween(a, b) {
    const s = this.s;
    const { parent, dist } = bfs([b], (j) => s.road[j] === 1, 90);
    if (dist[a] < 0) return null;
    const path = [];
    for (let k = a; k >= 0 && path.length < 120; k = parent[k]) path.push(k);
    return path;
  }

  spawnCar() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    let a; let b;
    const roll = Math.random();
    if (this.edgeRoads.length && (roll < 0.25 || !this.homeRoads.length)) { a = pick(this.edgeRoads); b = this.jobRoads.length ? pick(this.jobRoads) : pick(this.edgeRoads); if (Math.random() < 0.5) [a, b] = [b, a]; } else if (this.homeRoads.length && this.jobRoads.length) {
      a = pick(this.homeRoads); b = pick(this.jobRoads); if (Math.random() < 0.5) [a, b] = [b, a];
    } else return;
    if (a === b) return;
    const path = this.routeBetween(a, b);
    if (!path || path.length < 3) return;
    const bus = Math.random() < 0.08;
    const key = bus ? 'bus' : `car${Math.floor(Math.random() * CARS.length)}`;
    const img = this.add.image(0, 0, 'veh', `${key}R`);
    this.lifeLayer.add(img);
    this.cars.push({ img, key, path, k: 0, t: 0, speed: (bus ? 1.6 : 2.2 + Math.random()) / 1000 });
  }

  stepLife(vis) {
    const s = this.s;
    if (this.routesDirty || !this.homeRoads) this.buildRoutes();
    const want = Math.min(48, Math.round(s.pop / 30) + (this.edgeRoads.length ? 3 : 0));
    if (vis > 0 && this.cars.length < want && Math.random() < 0.15) this.spawnCar();
    const pos = (i) => ({ x: (i % MAP_W) * TILE + 8, y: Math.floor(i / MAP_W) * TILE + 8 });
    this.cars = this.cars.filter((c) => {
      if (c.k >= c.path.length - 1) { c.img.destroy(); return false; }
      const a = c.path[c.k]; const b = c.path[c.k + 1];
      if (!s.road[a] || !s.road[b]) { c.img.destroy(); return false; }
      const jam = Math.min(1, S.rt(s).traffic[b]);
      c.t += vis * c.speed * (1 - jam * 0.5);
      while (c.t >= 1 && c.k < c.path.length - 1) { c.t -= 1; c.k++; }
      if (c.k >= c.path.length - 1) { c.img.destroy(); return false; }
      const p = pos(c.path[c.k]); const q = pos(c.path[c.k + 1]);
      const dir = q.x > p.x ? 'R' : q.x < p.x ? 'L' : q.y > p.y ? 'D' : 'U';
      const lx = p.x + (q.x - p.x) * c.t + LANE[dir][0]; const ly = p.y + (q.y - p.y) * c.t + LANE[dir][1];
      c.img.setPosition(Math.round(lx), Math.round(ly) - 2).setFrame(`${c.key}${dir}`);
      if (this.dark > 0.3) {
        const v = { R: [6, 0], L: [-6, 0], D: [0, 6], U: [0, -6] }[dir];
        this.carLights.fillStyle(0xf9f5ef, 0.25 * this.dark).fillCircle(lx + v[0], ly + v[1] - 2, 2.5);
      }
      return true;
    });
    // People strolling along the pavements.
    const wantW = Math.min(30, Math.round(s.pop / 50));
    if (vis > 0 && this.walkers.length < wantW && this.homeRoads.length && Math.random() < 0.1) {
      const i = this.homeRoads[Math.floor(Math.random() * this.homeRoads.length)];
      const img = this.add.image(0, 0, 'people', Math.floor(Math.random() * 48)).setOrigin(0.5, 1);
      this.lifeLayer.add(img);
      const side = [[-6, -5], [6, 5], [-6, 5], [6, -5]][Math.floor(Math.random() * 4)];
      this.walkers.push({ img, i, side, next: i, t: 0, left: 6 + Math.floor(Math.random() * 10) });
    }
    this.walkers = this.walkers.filter((w) => {
      if (!s.road[w.i]) { w.img.destroy(); return false; }
      w.t += vis * 0.0006;
      if (w.t >= 1) {
        w.t = 0; w.i = w.next; w.left--;
        if (w.left <= 0) { w.img.destroy(); return false; }
        const x = w.i % MAP_W; const y = (w.i - x) / MAP_W;
        const opts = N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inMap(nx, ny) && s.road[idx(nx, ny)]);
        w.next = opts.length ? idx(...opts[Math.floor(Math.random() * opts.length)]) : w.i;
      }
      const p = pos(w.i); const q = pos(w.next);
      w.img.setPosition(Math.round(p.x + (q.x - p.x) * w.t + w.side[0]), Math.round(p.y + (q.y - p.y) * w.t + w.side[1] + 2));
      w.img.y -= Math.floor(w.t * 8) % 2;
      return true;
    });
    // Fire trucks and police cars heading to trouble.
    this.trucks = this.trucks.filter((c) => {
      c.t += vis * 0.004;
      while (c.t >= 1 && c.k < c.path.length - 1) { c.t -= 1; c.k++; }
      if (c.k >= c.path.length - 1) { c.wait -= vis; if (c.wait <= 0) { c.img.destroy(); return false; } return true; }
      const p = pos(c.path[c.k]); const q = pos(c.path[c.k + 1]);
      const dir = q.x > p.x ? 'R' : q.x < p.x ? 'L' : q.y > p.y ? 'D' : 'U';
      c.img.setPosition(Math.round(p.x + (q.x - p.x) * c.t + LANE[dir][0]), Math.round(p.y + (q.y - p.y) * c.t + LANE[dir][1]) - 2).setFrame(`${c.key}${dir}`);
      const b = Math.floor(this.time.now / 150) % 2;
      this.carLights.fillStyle(b ? 0xff3030 : 0x3060ff).fillRect(c.img.x - 1, c.img.y - 5, 2, 1);
      return true;
    });
  }

  /** Send a fire truck (or police car) from the nearest station to tile (x, y). */
  dispatch(svc, x, y) {
    const s = this.s; const r = S.rt(s);
    let best = null; let bd = 1e9;
    for (const b of s.blds) {
      if (PLACE[b.k]?.svc !== svc) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd && d < PLACE[b.k].r + 2) { bd = d; best = b; }
    }
    if (!best) return;
    const a = r.access.get(best.id);
    let target = -1; let td = 99;
    for (let ty = y - 3; ty <= y + 3; ty++) for (let tx = x - 3; tx <= x + 3; tx++) {
      if (inMap(tx, ty) && s.road[idx(tx, ty)] && Math.abs(tx - x) + Math.abs(ty - y) < td) { td = Math.abs(tx - x) + Math.abs(ty - y); target = idx(tx, ty); }
    }
    if (a === undefined || target < 0) return;
    const path = this.routeBetween(a, target);
    if (!path || path.length < 2) return;
    const key = svc === 'fire' ? 'firetruck' : 'police';
    const img = this.add.image(0, 0, 'veh', `${key}R`);
    this.lifeLayer.add(img);
    this.trucks.push({ img, key, path, k: 0, t: 0, wait: 2500 });
  }

  // ================================================================ fires, markers, disasters

  drawFires() {
    const g = this.fx;
    g.clear();
    const t = this.time.now;
    for (const f of this.s.fires) {
      const x = (f.i % MAP_W) * TILE; const y = Math.floor(f.i / MAP_W) * TILE;
      for (let k = 0; k < 5; k++) {
        const fx = x + 2 + ((k * 5 + Math.floor(t / 90) * 3) % 12);
        const fh = 3 + ((k * 7 + Math.floor(t / 70)) % 6);
        g.fillStyle(k % 2 ? 0xd88038 : 0xe3d245).fillRect(fx, y + 12 - fh, 2, fh);
        g.fillStyle(0xa13d3b).fillRect(fx, y + 12, 2, 2);
      }
      g.fillStyle(0x4e4a4e, 0.5).fillCircle(x + 8 + Math.sin(t / 300 + f.i) * 3, y - 2 - ((t / 40) % 10), 3);
    }
  }

  drawMarkers() {
    const s = this.s;
    const k = Math.max(0.6, 1.3 / this.zoom);
    const blink = Math.floor(this.time.now / 500) % 2 === 0;
    const list = [];
    if (blink) {
      for (const b of s.blds) if (!b.pw && (b.k !== 'grow' || b.z !== 'F')) list.push([b, 3]);
    }
    for (const f of s.fires) { const b = S.rt(s).byId.get(S.rt(s).tileB[f.i]); if (b) list.push([b, 16]); }
    const pool = this.markLayer.list;
    list.forEach(([b, icon], n) => {
      let img = pool[n];
      if (!img) { img = this.add.image(0, 0, 'icons', icon); this.markLayer.add(img); }
      img.setFrame(icon).setVisible(true).setScale(k).setPosition((b.x + b.w / 2) * TILE, b.y * TILE + 4);
      img.setTint(icon === 3 ? 0xe3d245 : 0xd88038);
    });
    for (let n = list.length; n < pool.length; n++) pool[n].setVisible(false);
  }

  onDisaster(e) {
    sfx(e.what === 'fire' ? 'smallBoom' : 'boom');
    this.toast(e.text);
    // Show where it is.
    this.zoom = Math.max(this.zoom, 1.5);
    this.centerOn((e.x + 1) * TILE, (e.y + 1) * TILE);
    if (e.what === 'quake') {
      this.cameras.main.shake(1500, 0.012);
      for (let k = 0; k < 5; k++) {
        const c = this.add.sprite((e.x + (Math.random() - 0.5) * 12) * TILE, (e.y + (Math.random() - 0.5) * 12) * TILE, 'quake', 0).setAlpha(0.9);
        this.disLayer.add(c);
        c.play('quake');
        this.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 1500, onComplete: () => c.destroy() });
      }
    }
    if (e.what === 'fire' || e.what === 'quake') this.dispatch('fire', e.x, e.y);
    if (e.what === 'ufo') this.dispatch('police', e.x, e.y);
    this.syncMap();
  }

  drawDisasters() {
    const s = this.s;
    const seen = new Set();
    for (const a of s.active) {
      seen.add(a);
      let spr = this.dis.get(a);
      if (!spr) {
        if (a.kind === 'tornado') spr = this.add.sprite(0, 0, 'tornado', 0).setOrigin(0.5, 0.9).play('tornado');
        else if (a.kind === 'ufo') spr = this.add.sprite(0, 0, 'ufoSheet', 'u0').play('ufoFly');
        else spr = this.add.sprite(0, 0, 'meteorSheet', 'm8').play('meteorFly');
        this.disLayer.add(spr);
        this.dis.set(a, spr);
      }
      if (a.kind === 'meteor') {
        const f = Math.max(0, a.left / 0.12);
        spr.setPosition(a.x * TILE + f * 90, a.y * TILE - f * 160).setScale(1.5);
      } else if (a.kind === 'ufo') {
        spr.setPosition(a.x * TILE, a.y * TILE - 14 + Math.sin(this.time.now / 300) * 2);
        const want = a.state === 'zap' ? 'ufoZap' : 'ufoFly';
        if (spr.anims.currentAnim?.key !== want) spr.play(want);
      } else spr.setPosition(a.x * TILE, a.y * TILE + 6);
    }
    for (const [a, spr] of this.dis) if (!seen.has(a)) { spr.destroy(); this.dis.delete(a); }
  }

  impactFx(e) {
    const spr = this.add.sprite(e.x * TILE, e.y * TILE, 'meteorSheet', 'm12').setScale(2).play('meteorHit');
    this.disLayer.add(spr);
    spr.once('animationcomplete', () => spr.destroy());
    this.cameras.main.flash(200, 240, 212, 114);
    this.dispatch('fire', Math.floor(e.x), Math.floor(e.y));
  }

  ufoDownFx(e) {
    const spr = this.add.sprite(e.x * TILE, e.y * TILE - 14, 'ufoSheet', 'u19').play('ufoDown');
    this.disLayer.add(spr);
    spr.once('animationcomplete', () => this.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() }));
  }

  dust(e) {
    sfx('smallBoom');
    this.puff(e.x, e.y, e.w, e.h);
  }

  startDisaster(kind) {
    const ev = [];
    if (S.trigger(this.s, kind, ev)) { this.onEvents(ev); this.afterChange(); if (this.speed === 0) this.setSpeed(1); }
  }

  // ================================================================ saving and leaving

  save() {
    try { store.set('run', S.serialize(this.s)); } catch (e) { console.warn('save failed', e); }
  }

  toTitle() {
    if (this.leaving) return;
    this.leaving = true;
    this.save();
    P.closeAll();
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Title'));
  }

  restart(mode) {
    if (this.leaving) return;
    this.leaving = true;
    const s = S.newGame(mode);
    s.tut = null;
    store.set('run', S.serialize(s));
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ state: s }));
  }
}

export { LINE_COST };
