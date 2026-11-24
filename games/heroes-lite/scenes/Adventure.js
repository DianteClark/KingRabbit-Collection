import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, HEIGHT, store, go, modal, toast, resourceBar, bar, setBackground, openHowTo,
} from './common.js';
import { openHeroPanel, levelUpFlow } from './heroPanel.js';
import * as G from '../logic/game.js';
import { aiTurn, aiParams } from '../logic/ai.js';
import { autoResolve, TACTIC_PRESETS } from '../logic/combat.js';
import {
  CREATURES, MINES, PILES, BOOSTS, MAP_DWELLINGS, ARTIFACTS, sizeWord, armyValue,
} from '../logic/data.js';
import {
  frame, sprite, unitFrame, heroFrame, townFrame, groundFrame, DECOR, waterFrame, treeFrame, mountainFrame,
  CHEST, CAMPFIRE, artifactFrame,
} from '../frames.js';
import { saveGame, clearGame, recordResult, submitEndless } from '../save.js';
import { getSkill, reportResult, SKILL_ID } from '../adaptive.js';

const T = 32;              // tile size on screen (16px art at 2x)
const MAP_TOP = 80;
const MAP_BOTTOM = 546;
const MAP_H = MAP_BOTTOM - MAP_TOP;

export class Adventure extends Phaser.Scene {
  constructor() { super('Adventure'); }

  init(data) { this.fresh = !!data?.fresh; }

  create() {
    this.s = store.state;
    if (!this.s) { this.scene.start('Menu'); return; }
    setBackground(this, PALETTE.night);
    this.busy = false;
    this.selected = G.heroesOf(this.s, 0)[0]?.id ?? null;
    this.plan = null;

    this.world = this.add.container(0, MAP_TOP).setDepth(0);
    this.buildGround();
    this.objLayer = this.add.container(0, 0);
    this.heroLayer = this.add.container(0, 0);
    this.pathG = this.add.graphics();
    this.fogG = this.add.graphics();
    this.world.add([this.objLayer, this.heroLayer, this.pathG, this.fogG]);
    this.refreshObjects();
    this.refreshHeroes();
    this.drawFog();

    this.buildUi();
    this.setupInput();
    const h = this.hero();
    if (h) this.centerOn(h.x, h.y, false);
    else { const t = G.townsOf(this.s, 0)[0]; if (t) this.centerOn(t.x, t.y, false); }
    this.refreshUi();

    this.events.on('wake', () => this.onWake());
    // Testing hook.
    window.__heroes = { scene: this, store, G };

    if (this.fresh) {
      const scn = this.s;
      modal(this, scn.name, [
        scn.mode === 'endless' ? 'Enemy waves arrive every week from the map edges. Hold on to your town!' : 'Capture every enemy town to win.',
        'Tap a tile to plan a route, tap it again to march. Tap End Day when your heroes are done.',
      ], [['Begin', () => this.showNews()]]);
    } else this.checkOver();
  }

  // ---------- Map drawing ----------

  buildGround() {
    const s = this.s;
    const rt = this.add.renderTexture(0, 0, s.w * 16, s.h * 16).setOrigin(0).setScale(2);
    const draw = (ref, x, y) => { const [k, f] = frame(this, ref); rt.drawFrame(k, f, x * 16, y * 16); };
    const water = (x, y) => !G.inMap(s, x, y) || s.terrain[y][x] === '~';
    let seed = s.seed >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const ch = s.terrain[y][x];
        if (ch === '~') {
          const dx = !water(x - 1, y) ? -1 : !water(x + 1, y) ? 1 : 0;
          const dy = !water(x, y - 1) ? -1 : !water(x, y + 1) ? 1 : 0;
          draw(waterFrame(s.biome, dx, dy), x, y);
          continue;
        }
        draw(groundFrame(s.biome), x, y);
        if (ch === ',' || (ch === '.' && rnd() < 0.07 && !G.objAt(s, x, y))) draw([groundFrame(s.biome)[0], ...DECOR[Math.floor(rnd() * DECOR.length)], 16, 16], x, y);
      }
    }
    // Trees and mountains on top, row by row so they overlap nicely.
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const ch = s.terrain[y][x];
        if (ch === 'T') draw(treeFrame(s.biome, Math.floor(rnd() * 4)), x, y);
        if (ch === 'M') draw(mountainFrame(s.biome), x, y);
      }
    }
    this.world.add(rt);
    this.ground = rt;
  }

  /** (Re)create every map object sprite. Cheap enough to do after any change. */
  refreshObjects() {
    this.objLayer.removeAll(true);
    const s = this.s;
    const list = [];
    for (const o of s.objects) {
      const cx = o.x * T + T / 2; const by = (o.y + 1) * T;
      let img = null;
      const big = (ref) => sprite(this, cx, by, ref, 2).setOrigin(0.5, 1);
      switch (o.kind) {
        case 'town': {
          const lvl = o.built.hall3 ? 3 : o.built.hall2 ? 2 : 1;
          img = big(townFrame(o.faction, lvl));
          break;
        }
        case 'mine': img = big(MINES[o.res].sprite); break;
        case 'dwelling': img = big(MAP_DWELLINGS[o.creature].sprite); break;
        case 'boost': img = BOOSTS[o.boost].big ? big(BOOSTS[o.boost].sprite) : sprite(this, cx, o.y * T + T / 2, BOOSTS[o.boost].sprite); break;
        case 'pile': img = sprite(this, cx, o.y * T + T / 2, PILES[o.res].sprite); break;
        case 'chest': img = sprite(this, cx, o.y * T + T / 2, CHEST); break;
        case 'campfire': img = sprite(this, cx, o.y * T + T / 2, CAMPFIRE); break;
        case 'artifact': img = sprite(this, cx, o.y * T + T / 2, artifactFrame(ARTIFACTS[o.art].icon)); break;
        case 'monster': {
          img = sprite(this, cx, o.y * T + T / 2 - 2, unitFrame(CREATURES[o.type].sprite, 'idle', 0)).setFlipX(true);
          this.animate(img, CREATURES[o.type].sprite, (o.x * 7 + o.y * 3) % 4);
          break;
        }
        default: break;
      }
      if (!img) continue;
      img.setDepth(o.y * 10 + 1);
      list.push(img);
      const owner = o.owner;
      if (owner !== undefined && owner !== null && (o.kind === 'mine' || o.kind === 'town')) {
        const fx = o.kind === 'town' ? cx - 52 : cx - 26; const fy = o.kind === 'town' ? by - 112 : by - 58;
        list.push(this.flag(fx, fy, owner).setDepth(o.y * 10 + 2));
      }
    }
    list.sort((a, b) => a.depth - b.depth);
    this.objLayer.add(list);
  }

  flag(x, y, owner) {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, 3, 22);
    g.fillStyle(hex(PALETTE.ink)).fillRect(x + 2, y, 14, 10);
    g.fillStyle(hex(G.PLAYER_COLORS[owner])).fillRect(x + 3, y + 1, 12, 8);
    return g;
  }

  animate(img, spriteDef, offset = 0) {
    const frames = [0, 1, 2, 3].map((i) => frame(this, unitFrame(spriteDef, 'idle', i)));
    let i = offset;
    this.time.addEvent({ delay: 220, loop: true, callback: () => { if (img.active) { i = (i + 1) % 4; img.setFrame(frames[i][1]); } } });
  }

  refreshHeroes() {
    this.heroLayer.removeAll(true);
    this.heroSprites = new Map();
    for (const h of this.s.heroes) {
      // Heroes under the fog are drawn too; the fog layer above hides them.
      const c = this.add.container(h.x * T + T / 2, h.y * T + T / 2);
      const sel = this.add.ellipse(0, 12, 30, 10, hex(PALETTE.gold), 0.9).setVisible(h.id === this.selected);
      const fl = this.flag(-18, -30, h.owner);
      const img = sprite(this, 0, -2, heroFrame(h.faction === 'necro' ? 'heroN' : 'heroC', h.might, 0));
      if (h.flip) img.setFlipX(true);
      c.add([sel, fl, img]);
      c.img = img; c.sel = sel; c.hero = h;
      c.setDepth(h.y * 10 + 5);
      this.heroLayer.add(c);
      this.heroSprites.set(h.id, c);
    }
    this.heroLayer.sort('depth');
  }

  drawFog() {
    const s = this.s; const g = this.fogG;
    g.clear();
    const ex = s.players[0].explored;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (ex[y * s.w + x]) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; const yy = y + dy;
          if (G.inMap(s, xx, yy) && ex[yy * s.w + xx]) { edge = true; break; }
        }
        g.fillStyle(hex(PALETTE.night), edge ? 0.78 : 1).fillRect(x * T, y * T, T, T);
      }
    }
  }

  drawPath() {
    const g = this.pathG; g.clear();
    if (!this.plan) return;
    const h = this.hero();
    if (!h) return;
    for (const [i, p] of this.plan.path.entries()) {
      const ok = p.cost <= h.mp;
      const last = i === this.plan.path.length - 1;
      const col = hex(ok ? PALETTE.cream : PALETTE.orange);
      const cx = p.x * T + T / 2; const cy = p.y * T + T / 2;
      if (last) {
        g.lineStyle(4, hex(PALETTE.ink)).strokeRect(p.x * T + 3, p.y * T + 3, T - 6, T - 6);
        g.lineStyle(2, ok ? hex(PALETTE.gold) : col).strokeRect(p.x * T + 4, p.y * T + 4, T - 8, T - 8);
      } else {
        g.fillStyle(hex(PALETTE.ink)).fillCircle(cx, cy, 5);
        g.fillStyle(col).fillCircle(cx, cy, 3.5);
      }
    }
  }

  // ---------- Camera ----------

  clampScroll(x, y) {
    const s = this.s;
    const maxX = Math.max(0, s.w * T - WIDTH); const maxY = Math.max(0, s.h * T - MAP_H);
    const cx = s.w * T < WIDTH ? -(WIDTH - s.w * T) / 2 : Phaser.Math.Clamp(x, 0, maxX);
    const cy = s.h * T < MAP_H ? -(MAP_H - s.h * T) / 2 : Phaser.Math.Clamp(y, 0, maxY);
    return [cx, cy];
  }

  scrollTo(x, y) {
    const [cx, cy] = this.clampScroll(x, y);
    this.scroll = { x: cx, y: cy };
    this.world.setPosition(Math.round(-cx), Math.round(MAP_TOP - cy));
  }

  centerOn(tx, ty, smooth = true) {
    const x = tx * T + T / 2 - WIDTH / 2; const y = ty * T + T / 2 - MAP_H / 2;
    if (!smooth) { this.scrollTo(x, y); return; }
    const [cx, cy] = this.clampScroll(x, y);
    const from = { ...this.scroll };
    this.tweens.addCounter({ from: 0, to: 1, duration: 220, onUpdate: (tw) => {
      const v = tw.getValue();
      this.scrollTo(from.x + (cx - from.x) * v, from.y + (cy - from.y) * v);
    } });
  }

  /** Keep a tile inside the view (with a margin) while walking. */
  follow(tx, ty) {
    const px = tx * T + T / 2 - this.scroll.x; const py = ty * T + T / 2 - this.scroll.y;
    const m = 96;
    let nx = this.scroll.x; let ny = this.scroll.y;
    if (px < m) nx -= m - px; if (px > WIDTH - m) nx += px - (WIDTH - m);
    if (py < m) ny -= m - py; if (py > MAP_H - m) ny += py - (MAP_H - m);
    this.scrollTo(nx, ny);
  }

  setupInput() {
    let down = null;
    this.input.on('pointerdown', (p) => {
      if (p.y < MAP_TOP || p.y > MAP_BOTTOM || this.modalOpen()) { down = null; return; }
      down = { x: p.x, y: p.y, sx: this.scroll.x, sy: this.scroll.y, drag: false };
    });
    this.input.on('pointermove', (p) => {
      if (!down || !p.isDown) return;
      const dx = p.x - down.x; const dy = p.y - down.y;
      if (!down.drag && Math.hypot(dx, dy) > 10) down.drag = true;
      if (down.drag) this.scrollTo(down.sx - dx, down.sy - dy);
    });
    this.input.on('pointerup', (p) => {
      if (!down) return;
      const d = down; down = null;
      if (d.drag || this.busy || this.modalOpen()) return;
      const wx = p.x + this.scroll.x; const wy = p.y - MAP_TOP + this.scroll.y;
      this.tapTile(Math.floor(wx / T), Math.floor(wy / T));
    });
  }

  modalOpen() { return this.children.list.some((c) => c.depth >= 100 && c.active && c.visible); }

  // ---------- UI ----------

  buildUi() {
    const top = this.add.graphics().setDepth(10);
    top.fillStyle(hex(PALETTE.night)).fillRect(0, 0, WIDTH, MAP_TOP);
    top.fillStyle(hex(PALETTE.ink)).fillRect(0, MAP_TOP - 4, WIDTH, 4);
    top.fillStyle(hex(PALETTE.night)).fillRect(0, MAP_BOTTOM, WIDTH, HEIGHT - MAP_BOTTOM);
    top.fillStyle(hex(PALETTE.ink)).fillRect(0, MAP_BOTTOM, WIDTH, 4);
    this.uiItems = [];
    const add = (o) => { o.setDepth(11); return o; };
    add(button(this, 30, 24, 48, 36, '<', () => this.leave(), { size: 32, fill: PALETTE.cream }));
    add(button(this, WIDTH - 30, 24, 48, 36, '?', () => this.help(), { size: 32, fill: PALETTE.gold }));
    this.dayText = add(text(this, WIDTH / 2, 16, '', { color: PALETTE.cream }));
    this.subText = add(text(this, WIDTH / 2, 36, '', { color: PALETTE.lavender }));
    this.resBar = resourceBar(this, 60, 11);
    // Info strip just above the bottom panel.
    this.infoBg = this.add.rectangle(WIDTH / 2, MAP_BOTTOM - 14, WIDTH, 28, hex(PALETTE.ink), 0.75).setDepth(11).setVisible(false);
    this.infoText = add(text(this, WIDTH / 2, MAP_BOTTOM - 14, '', { color: PALETTE.cream })).setVisible(false);
    // Bottom panel.
    this.heroBtns = this.add.container(0, 0).setDepth(11);
    this.endBtn = add(button(this, 304, 574, 100, 40, 'End Day', () => this.endDay(), { fill: PALETTE.gold }));
    this.heroBtn = add(button(this, 62, 618, 112, 36, 'Hero', () => this.openHero(), { fill: PALETTE.lavender }));
    this.townBtn = add(button(this, 180, 618, 112, 36, 'Town', () => this.openTown(), { fill: PALETTE.lavender }));
    this.nextBtn = add(button(this, 298, 618, 112, 36, 'Next', () => this.nextHero(), { fill: PALETTE.lavender }));
  }

  refreshUi() {
    const s = this.s; const p = s.players[0];
    const week = Math.floor((s.day - 1) / 7) + 1; const dow = ((s.day - 1) % 7) + 1;
    this.dayText.setText(`Day ${s.day}`);
    this.subText.setText(s.mode === 'endless' ? `Week ${week} - wave in ${Math.max(0, s.endless.nextWave - s.day)}d` : `Week ${week}, day ${dow}`);
    this.resBar.update(p.res);
    this.heroBtns.removeAll(true);
    const heroes = G.heroesOf(s, 0);
    heroes.forEach((h, i) => {
      const x = 30 + i * 52; const y = 572;
      const sel = h.id === this.selected;
      const g = this.add.graphics();
      g.fillStyle(hex(sel ? PALETTE.gold : PALETTE.indigo)).fillRect(x - 22, y - 22, 44, 44);
      g.fillStyle(hex(PALETTE.night)).fillRect(x - 19, y - 19, 38, 38);
      const img = sprite(this, x, y - 2, ['heroIcons', h.portrait[0], h.portrait[1], 16, 16], 2);
      const mp = bar(this, x - 19, y + 15, 38, 5, h.mp / G.heroMaxMp(h), PALETTE.leaf);
      const z = this.add.zone(x, y, 46, 46).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { if (this.busy) return; if (this.selected === h.id) this.openHero(); else this.select(h.id); });
      this.heroBtns.add([g, img, mp, z]);
      if (h.pendingLevels > 0) this.heroBtns.add(text(this, x + 16, y - 18, '+', { color: PALETTE.gold }));
    });
    if (!heroes.length) this.heroBtns.add(text(this, 110, 574, 'No heroes', { color: PALETTE.lavender }));
    this.heroBtn.setEnabled(!!this.hero());
    this.nextBtn.setEnabled(heroes.length > 1);
    this.townBtn.setEnabled(G.townsOf(s, 0).length > 0);
  }

  info(msg) {
    this.infoText.setText(msg || '').setVisible(!!msg);
    this.infoBg.setVisible(!!msg);
    if (msg) this.infoBg.width = Math.min(WIDTH, this.infoText.width + 24);
  }

  hero() { return this.selected ? G.getHero(this.s, this.selected) : null; }

  select(id) {
    this.selected = id;
    this.plan = null;
    this.drawPath();
    this.info('');
    for (const c of this.heroSprites.values()) c.sel.setVisible(c.hero.id === id);
    const h = this.hero();
    if (h) { this.centerOn(h.x, h.y); sfx('select'); }
    this.refreshUi();
  }

  nextHero() {
    const hs = G.heroesOf(this.s, 0);
    if (!hs.length) return;
    const i = hs.findIndex((h) => h.id === this.selected);
    // Prefer heroes that can still move.
    for (let k = 1; k <= hs.length; k++) {
      const h = hs[(i + k) % hs.length];
      if (h.mp > 0 || k === hs.length) { this.select(h.id); return; }
    }
  }

  help() { openHowTo(this); }

  leave() {
    modal(this, 'Leave game?', ['Your game is saved. Tap Continue on the menu to carry on.'], [
      ['Main menu', () => { saveGame(this.s); go(this, 'Menu'); }], ['Stay', null],
    ]);
  }

  // ---------- Tapping the map ----------

  objectAtTile(x, y) {
    const direct = G.objAt(this.s, x, y);
    if (direct) return direct;
    return this.s.objects.find((o) => G.footprint(o).some(([fx, fy]) => fx === x && fy === y));
  }

  describe(o, x, y) {
    const s = this.s;
    const other = G.heroAt(s, x, y);
    if (other && other.owner !== 0) return `Enemy hero ${other.name} (${this.strength(G.heroArmyValue(other))})`;
    if (!o) {
      const g = G.guardAt(s, x, y);
      return g ? `Guarded by ${CREATURES[g.type].name}` : '';
    }
    switch (o.kind) {
      case 'monster': return `${sizeWord(o.count)} ${CREATURES[o.type].name} (${this.strength(armyValue(G.monsterArmy(o)))})`;
      case 'mine': return `${MINES[o.res].name}${o.owner === 0 ? ' (yours)' : o.owner !== null ? ' (enemy)' : ''}`;
      case 'town': return o.owner === 0 ? o.name : `${o.name} (${o.owner === null ? 'neutral' : 'enemy'} town)`;
      case 'pile': return `${o.res[0].toUpperCase()}${o.res.slice(1)}`;
      case 'chest': return 'Treasure chest';
      case 'campfire': return 'Campfire';
      case 'artifact': return ARTIFACTS[o.art].name;
      case 'boost': {
        const b = BOOSTS[o.boost];
        const seen = this.hero() && o.visited.includes(this.hero().id);
        return `${b.name}: ${b.desc}${seen ? ' (visited)' : ''}`;
      }
      case 'dwelling': return `${MAP_DWELLINGS[o.creature].name}: ${o.stock} ${CREATURES[o.creature].name}`;
      default: return '';
    }
  }

  strength(v) {
    const h = this.hero();
    if (!h) return '';
    const r = G.heroArmyValue(h) / Math.max(1, v);
    if (r >= 3) return 'easy';
    if (r >= 1.5) return 'you are stronger';
    if (r >= 0.8) return 'even fight';
    if (r >= 0.5) return 'risky';
    return 'deadly';
  }

  tapTile(x, y) {
    const s = this.s;
    if (!G.inMap(s, x, y)) return;
    if (!G.isExplored(s, 0, x, y)) { this.info('Unexplored'); return; }
    const h = this.hero();
    const own = G.heroAt(s, x, y);
    if (own && own.owner === 0 && own.id !== this.selected) { this.select(own.id); return; }
    const o = this.objectAtTile(x, y);
    // Own town: tapping its buildings opens it; tapping its gate walks there (or opens it if you're in).
    if (o && o.kind === 'town' && o.owner === 0) {
      const atGate = o.x === x && o.y === y;
      if (!atGate || (h && h.x === o.x && h.y === o.y) || !h) { this.openTown(o.id); return; }
    }
    if (own && own.id === this.selected) {
      const t = G.townsOf(s, 0).find((tt) => tt.x === own.x && tt.y === own.y);
      if (t) this.openTown(t.id); else this.openHero();
      return;
    }
    if (!h) { this.info(this.describe(o, x, y)); return; }
    let tx = x; let ty = y;
    if (o && (o.x !== x || o.y !== y)) { tx = o.x; ty = o.y; } // tapped a building: go to its gate
    if (this.plan && this.plan.tx === tx && this.plan.ty === ty) { this.go(); return; }
    const path = G.findPath(s, h, tx, ty);
    if (!path) { this.plan = null; this.drawPath(); this.info(this.describe(o, tx, ty) || 'Can\'t get there'); sfx('error'); return; }
    this.plan = { path, tx, ty };
    this.drawPath();
    const days = Math.ceil(Math.max(0, path[path.length - 1].cost - h.mp) / G.heroMaxMp(h));
    const desc = this.describe(o, tx, ty);
    this.info(`${desc ? `${desc} - ` : ''}${days ? `${days + 1} days` : 'tap again to go'}`);
    sfx('tap');
  }

  // ---------- Moving ----------

  async go() {
    const h = this.hero();
    if (!h || !this.plan) return;
    const plan = G.planMove(this.s, h, this.plan.path);
    if (!plan.steps.length && !plan.trigger) { toast(this, 'No movement left today'); sfx('error'); return; }
    this.busy = true;
    this.info('');
    await this.walk(h, plan.steps);
    G.applySteps(this.s, h, plan.steps);
    // Keep the rest of a multi-day route.
    const rest = this.plan.path.slice(plan.steps.length);
    const reached = !rest.length || plan.trigger;
    if (reached) this.plan = null;
    else {
      const base = plan.steps.length ? plan.steps[plan.steps.length - 1].cost : 0;
      this.plan = { ...this.plan, path: rest.map((p) => ({ ...p, cost: p.cost - base })) };
    }
    this.drawPath();
    if (plan.trigger) await this.trigger(h, plan.trigger);
    this.afterAction();
  }

  walk(h, steps, speed = 110) {
    return new Promise((resolve) => {
      const c = this.heroSprites.get(h.id);
      if (!c || !steps.length) { resolve(); return; }
      let i = 0;
      let px = h.x;
      const frames = [0, 1, 2, 3].map((k) => frame(this, heroFrame(h.faction === 'necro' ? 'heroN' : 'heroC', h.might, k)));
      const stepNext = () => {
        if (i >= steps.length) { c.img.setFrame(frames[0][1]); resolve(); return; }
        const st = steps[i++];
        if (st.x !== px) { h.flip = st.x < px; c.img.setFlipX(h.flip); }
        px = st.x;
        c.img.setFrame(frames[i % 4][1]);
        if (h.owner === 0 || i % 2) sfx('move');
        this.tweens.add({
          targets: c, x: st.x * T + T / 2, y: st.y * T + T / 2, duration: speed,
          onUpdate: () => { if (h.owner === 0) this.follow(c.x / T - 0.5, c.y / T - 0.5); },
          onComplete: () => {
            c.setDepth(st.y * 10 + 5); this.heroLayer.sort('depth');
            if (h.owner === 0) { G.reveal(this.s, 0, st.x, st.y, G.heroSight(h)); this.drawFog(); }
            stepNext();
          },
        });
      };
      stepNext();
    });
  }

  async trigger(h, trig) {
    if (trig.type === 'visit') { await this.visitObj(h, G.getObj(this.s, trig.objId)); return; }
    await this.fight(h, trig);
  }

  async visitObj(h, o) {
    if (!o) return;
    const s = this.s;
    const r = G.visit(s, h, o);
    this.refreshObjects();
    if (r.gain || r.art) sfx('coin');
    else if (r.flag) sfx('power');
    else sfx('select');
    if (r.choice?.kind === 'chest') {
      await new Promise((res) => modal(this, 'Treasure Chest', ['Keep the gold, or share it with your people for experience?'], [
        [`${r.choice.gold} gold`, () => { G.takeChest(s, h, o, 'gold'); sfx('coin'); res(); }],
        [`${r.choice.exp} experience`, () => { G.takeChest(s, h, o, 'exp'); sfx('power'); res(); }],
      ]));
      this.refreshObjects();
      return;
    }
    if (r.choice?.kind === 'dwelling') { await this.dwellingModal(h, o); return; }
    if (r.open === 'town') { this.openTown(o.id); return; }
    if (r.art) {
      await new Promise((res) => modal(this, 'Artifact!', [r.msg], [['Great', res]], {
        extra: 44, content: (c, y) => c.add(sprite(this, WIDTH / 2, y + 20, artifactFrame(ARTIFACTS[r.art].icon), 2)),
      }));
      return;
    }
    toast(this, r.msg);
  }

  dwellingModal(h, o) {
    const c = CREATURES[o.creature];
    const p = this.s.players[0];
    const n = Math.min(o.stock, G.maxAffordable(p.res, c.cost));
    return new Promise((res) => {
      const lines = [`${o.stock} ${c.name} want to join you for ${c.cost.gold} gold each.`];
      if (!G.canAdd(h.army, o.creature)) lines.push({ text: 'Your army has no free slot.', color: PALETTE.orange });
      const btns = [];
      if (n > 0 && G.canAdd(h.army, o.creature)) btns.push([`Recruit ${n} (${n * c.cost.gold}g)`, () => { G.recruitDwelling(this.s, h, o, n); sfx('coin'); res(); }]);
      btns.push(['Leave', res]);
      modal(this, MAP_DWELLINGS[o.creature].name, lines, btns, {
        extra: 50, content: (cc, y) => cc.add(sprite(this, WIDTH / 2, y + 22, unitFrame(c.sprite), 3)),
      });
    });
  }

  // ---------- Battles ----------

  /** The human's hero attacks something. */
  async fight(h, trig) {
    const s = this.s;
    let setup = G.battleSetup(s, h, trig);
    while (setup) {
      if (setup.kind === 'capture') {
        const out = G.applyBattle(s, setup, { winner: 0, sides: [{ survivors: [], killedHp: 0, killedLiving: 0, mana: h.mana }, { survivors: [], killedHp: 0, killedLiving: 0, mana: 0 }] });
        sfx('win');
        this.refreshObjects(); this.refreshHeroes(); this.drawFog();
        await this.say('Town captured!', [out.msgs.filter((m) => !m.includes('gains 0')).pop() || 'The town is yours.']);
        break;
      }
      const { av, dv } = G.setupValues(s, setup);
      const choice = await this.preBattle(setup, av, dv, trig.ambush);
      if (choice === 'retreat') return;
      const res = choice === 'quick' ? this.quick(setup) : await this.playBattle(setup);
      const out = await this.afterBattle(setup, res);
      if (!out.won || !G.getHero(s, h.id)) return;
      if (out.next) { setup = G.battleSetup(s, h, out.next); continue; }
      break;
    }
    if (trig.then && G.getHero(s, h.id)) {
      const o = G.getObj(s, trig.then);
      if (o) await this.visitObj(h, o); // what the monster was guarding
    }
  }

  preBattle(setup, av, dv, ambush) {
    const s = this.s;
    const r = av / Math.max(1, dv);
    const odds = r >= 3 ? 'Easy' : r >= 1.5 ? 'Good' : r >= 0.8 ? 'Even' : r >= 0.5 ? 'Risky' : 'Deadly';
    const defArmy = setup.defArmy.filter(Boolean);
    const total = {};
    for (const st of defArmy) total[st.type] = (total[st.type] || 0) + st.count;
    const lines = Object.entries(total).map(([t, n]) => `${n} ${CREATURES[t].name}`);
    const who = setup.kind === 'hero' ? `${G.getHero(s, setup.heroId).name}'s army` : setup.kind === 'garrison' ? setup.defName : 'Monsters';
    return new Promise((res) => {
      const btns = [['Fight!', () => res('fight')]];
      if (setup.kind === 'monster' && r >= 2.5) btns.push(['Quick battle', () => res('quick'), PALETTE.leaf, PALETTE.cream]);
      if (!ambush) btns.push(['Retreat', () => res('retreat')]);
      modal(this, ambush ? 'Ambush!' : 'Battle', [
        { text: who, color: PALETTE.sand }, lines.join(', '), { text: `Odds: ${odds}`, color: r >= 1.5 ? PALETTE.leaf : r >= 0.8 ? PALETTE.gold : PALETTE.orange },
      ], btns);
    });
  }

  quick(setup) {
    const b = G.makeBattle(this.s, setup);
    return autoResolve(b, TACTIC_PRESETS.hard, TACTIC_PRESETS.normal);
  }

  /** Run the Battle scene and resolve with the result. */
  playBattle(setup) {
    return new Promise((resolve) => {
      const battle = G.makeBattle(this.s, setup);
      store.battleDone = (res) => { store.battleDone = null; resolve(res); };
      this.scene.launch('Battle', { battle, biome: this.s.biome });
      this.scene.sleep();
    });
  }

  onWake() {
    this.s = store.state;
    this.refreshObjects(); this.refreshHeroes(); this.drawFog(); this.refreshUi();
    if (store.townDone) { const f = store.townDone; store.townDone = null; f(); }
  }

  async afterBattle(setup, res) {
    const s = this.s;
    const attacker = G.getHero(s, setup.attacker);
    const humanAttacks = attacker && attacker.owner === 0;
    const vsAi = G.defenderOwner(s, setup) !== null || !humanAttacks;
    const out = G.applyBattle(s, setup, res);
    const humanWon = humanAttacks ? out.won : !out.won;
    if (vsAi) {
      const mine = res.sides[humanAttacks ? 0 : 1];
      const left = mine.survivors.reduce((a, x) => a + armyValue([x]), 0);
      const start = left + mine.lost.reduce((a, x) => a + armyValue([{ type: x.type, count: x.lost }]), 0);
      reportResult(SKILL_ID, humanWon ? 1 : 0, humanWon ? left / Math.max(1, start) : 1 - left / Math.max(1, start), 0.25);
    }
    this.refreshObjects(); this.refreshHeroes(); this.drawFog(); this.refreshUi();
    sfx(humanWon ? 'win' : 'lose');
    const lost = res.sides[humanAttacks ? 0 : 1].lost.map((l) => `${l.lost} ${CREATURES[l.type].name}`);
    const lines = [];
    lines.push({ text: lost.length ? `You lost: ${lost.join(', ')}` : 'No losses!', color: lost.length ? PALETTE.orange : PALETTE.leaf });
    for (const m of out.msgs) if (!m.includes('gains 0')) lines.push(m);
    await this.say(humanWon ? 'Victory!' : 'Defeat', lines);
    saveGame(s);
    return out;
  }

  say(title, lines, btn = 'OK') {
    return new Promise((res) => modal(this, title, lines, [[btn, res]]));
  }

  async afterAction() {
    const s = this.s;
    for (const h of G.heroesOf(s, 0)) if (h.pendingLevels > 0) await levelUpFlow(this, h);
    if (this.selected && !G.getHero(s, this.selected)) this.selected = G.heroesOf(s, 0)[0]?.id ?? null;
    this.refreshObjects(); this.refreshHeroes(); this.drawFog(); this.drawPath(); this.refreshUi();
    saveGame(s);
    this.busy = false;
    this.checkOver();
  }

  // ---------- Towns and heroes ----------

  openTown(id) {
    const towns = G.townsOf(this.s, 0);
    if (!towns.length) return;
    let t = id ? G.getObj(this.s, id) : null;
    if (!t) {
      const h = this.hero();
      t = (h && towns.find((tt) => tt.x === h.x && tt.y === h.y)) || towns[(this.townCycle = ((this.townCycle ?? -1) + 1) % towns.length)];
    }
    if (!t || t.owner !== 0) return;
    this.busy = true;
    store.townDone = () => { this.busy = false; this.afterAction(); };
    this.scene.launch('Town', { townId: t.id });
    this.scene.sleep();
  }

  openHero() {
    const h = this.hero();
    if (!h) return;
    openHeroPanel(this, h, () => this.refreshUi());
  }

  // ---------- Ending the day / computer turns ----------

  async endDay() {
    if (this.busy) return;
    this.busy = true;
    this.plan = null; this.drawPath();
    this.info('Enemy turn...');
    this.endBtn.setEnabled(false);
    const s = this.s;
    const params = aiParams(getSkill(SKILL_ID));
    const news = [];
    for (const p of s.players) {
      if (p.human || !p.alive || s.over) continue;
      const gen = aiTurn(s, p.id, params);
      let r = gen.next();
      while (!r.done) {
        const ev = r.value;
        let answer;
        if (ev.type === 'move') {
          const h = G.getHero(s, ev.heroId);
          const seen = ev.steps.some((st) => G.isExplored(s, 0, st.x, st.y));
          if (h && seen) {
            if (!this.heroSprites.has(h.id)) this.refreshHeroes();
            const vis = this.heroSprites.get(h.id);
            if (vis) {
              vis.setVisible(true);
              this.centerOn(h.x, h.y); await this.wait(160);
              await this.walk(h, ev.steps, 70);
            }
          }
        } else if (ev.type === 'battle') {
          this.refreshHeroes(); this.refreshObjects();
          answer = await this.defend(ev.setup);
        } else if (ev.type === 'news' && ev.msg) {
          news.push(ev.msg);
        }
        r = gen.next(answer);
      }
      this.refreshHeroes(); this.refreshObjects();
    }
    if (!s.over) {
      G.newDay(s);
      news.push(...s.news);
    }
    this.info('');
    this.endBtn.setEnabled(true);
    this.selected = G.getHero(s, this.selected) ? this.selected : (G.heroesOf(s, 0)[0]?.id ?? null);
    this.refreshObjects(); this.refreshHeroes(); this.drawFog(); this.refreshUi();
    saveGame(s);
    this.busy = false;
    if (this.checkOver()) return;
    this.dayBanner();
    this.showNews(news.filter((n) => /Wave|captured|defeated|attack/i.test(n)));
    const h = this.hero(); if (h) this.centerOn(h.x, h.y);
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  dayBanner() {
    const s = this.s;
    const week = s.day % 7 === 1;
    const t = text(this, WIDTH / 2, 300, week ? `Week ${Math.floor((s.day - 1) / 7) + 1}` : `Day ${s.day}`, { size: 32, color: PALETTE.gold }).setDepth(90);
    const t2 = week ? text(this, WIDTH / 2, 336, 'New creatures to recruit!', { color: PALETTE.cream }).setDepth(90) : null;
    const bg = this.add.rectangle(WIDTH / 2, week ? 316 : 300, WIDTH, week ? 84 : 52, hex(PALETTE.ink), 0.7).setDepth(89);
    sfx(week ? 'power' : 'flip');
    this.tweens.add({ targets: [t, t2, bg].filter(Boolean), alpha: 0, delay: 900, duration: 400, onComplete: () => { t.destroy(); t2?.destroy(); bg.destroy(); } });
  }

  showNews(list = this.s.news) {
    if (!list || !list.length) return;
    modal(this, 'News', list.slice(-5), [['OK', null]]);
  }

  /** The computer attacks one of the human's heroes or towns. */
  async defend(setup) {
    const s = this.s;
    const a = G.getHero(s, setup.attacker);
    const what = setup.kind === 'hero' ? G.getHero(s, setup.heroId).name : G.getObj(s, setup.townId).name;
    this.centerOn(a.x, a.y);
    sfx('boom');
    const choice = await new Promise((res) => modal(this, 'Under attack!', [
      `${a.name} attacks ${what}!`,
      `Enemy army: ${a.army.filter(Boolean).map((st) => `${st.count} ${CREATURES[st.type].name}`).join(', ')}`,
    ], [['Fight!', () => res('fight')], ['Auto battle', () => res('auto')]]));
    let res;
    if (choice === 'auto') {
      const b = G.makeBattle(s, setup);
      res = autoResolve(b, aiParams(getSkill(SKILL_ID)).tactics, TACTIC_PRESETS.hard);
    } else res = await this.playBattle(setup);
    // Report and show the result (applyBattle itself is done by the AI generator).
    const humanWon = res.winner === 1;
    const mine = res.sides[1];
    const lost = mine.lost.map((l) => `${l.lost} ${CREATURES[l.type].name}`);
    reportResult(SKILL_ID, humanWon ? 1 : 0, 0.5, 0.25);
    sfx(humanWon ? 'win' : 'lose');
    await this.say(humanWon ? 'Victory!' : 'Defeat', [
      humanWon ? `${a.name} is beaten back!` : `${what} has fallen.`,
      { text: lost.length ? `You lost: ${lost.join(', ')}` : 'No losses!', color: lost.length ? PALETTE.orange : PALETTE.leaf },
    ]);
    return res;
  }

  // ---------- Game over ----------

  checkOver() {
    const s = this.s;
    const over = G.checkOver(s);
    if (!over || this.overShown) return !!over;
    this.overShown = true;
    clearGame();
    const won = over.winner === 'human';
    let lines;
    if (s.mode === 'endless') {
      const best = submitEndless(s.day);
      lines = [`You held out for ${s.day} days and ${s.endless.wave} waves.`, best ? { text: 'New best!', color: PALETTE.gold } : over.reason];
    } else {
      recordResult(s.scenario, won, s.day);
      reportResult(SKILL_ID, won ? 1 : 0, 0.6, 1);
      lines = [won ? `${s.name} is yours, on day ${s.day}.` : over.reason];
    }
    sfx(won ? 'win' : 'lose');
    this.time.delayedCall(300, () => modal(this, won ? 'Victory!' : (s.mode === 'endless' ? 'The End' : 'Defeat'), lines, [
      ['Main menu', () => go(this, 'Menu')],
    ]));
    return true;
  }
}
