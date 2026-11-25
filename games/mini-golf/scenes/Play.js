import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { reportDaily, today, dailySeed } from '../../../shared/core/trophies.js';
import { WIDTH, HEIGHT, header, go, setBackground, fit, toast, modal, starRow } from './common.js';
import {
  compileHole, newBall, shoot, step, simulate, zoneAt, validSpot, sliderRect, bladeAngle, inPoly, contains,
  DT, BALL_R, CUP_R, TELE_R,
} from '../logic/physics.js';
import { grabs, aimFromDrag, CANCEL_R, FULL_DRAG } from '../logic/aim.js';
import { hit, down, stick, usingPad } from '../../../shared/core/padkit.js';
import { COURSES, holeById, holesOf, strokeCap, starsFor, scoreName, coursePar, dailyHole } from '../logic/holes.js';
import { THEMES, SHADE, BALL_COLORS, decorSheet } from '../art.js';
import { play } from '../sounds.js';
import {
  save, award, stat, bestFor, recordHole, recordRound, holeTrophies, roundTrophies, holeUnlocked, courseUnlocked, GAME_ID,
} from '../save.js';
import { newRound, startPlay } from './flow.js';

const TOP = 80;
const BOTTOM = 580;
const VP = { x: 0, y: TOP, w: WIDTH, h: BOTTOM - TOP };
const MARGIN = 26;

const TIPS = {
  sand: (th) => `${th.sandName === 'snow' ? 'Snow' : 'Sand'} slows the ball right down.`,
  ice: () => 'Ice! The ball hardly slows down.',
  slope: () => 'A slope: the ball rolls the way the arrows point.',
  boost: () => 'Boost pad: the ball speeds up.',
  ramp: () => 'Ramp! A fast ball jumps into the air.',
  teleport: () => 'Portal: the ball pops out of its twin.',
  bumper: () => 'Bumpers kick the ball away, faster.',
  windmill: () => 'The windmill sails knock the ball back.',
  mover: () => 'Moving blocks push the ball. Time your putt.',
};

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  create() {
    setBackground(this, PALETTE.night);
    window.__golf = this;
    let r = save.get('round');
    if (r && r.mode === 'daily' && r.day !== today()) {
      r = newRound({ mode: 'daily', holes: [dailyHole(dailySeed(GAME_ID)).id] });
      save.set('round', r);
    }
    if (!r || !holeById(r.holes?.[r.hi])) { save.set('round', null); this.scene.start('Menu'); return; }
    this.r = r;
    this.touches = new Map();
    this.aiming = null; this.pan = null; this.pinch = null;
    this.state = 'intro';
    this.acc = 0;
    this.worldT = 0;
    this.ev = [];
    this.lastWallSound = 0;

    this.buildHud();
    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));
    // Controller: the gold menu frame only works in popups; the stick aims and A putts (below).
    this.padNav = 'modal';
    this.padAngle = null; this.padCharge = null;
    const drop = () => this.dropTouches();
    this.events.on('pause', drop);
    this.events.on('resume', drop);
    this.events.once('shutdown', () => {
      this.events.off('pause', drop); this.events.off('resume', drop);
      this.input.removeAllListeners();
      this.W = null;
    });
    this.startHole(true);
  }

  // ------------------------------------------------------------------ HUD

  buildHud() {
    const barTop = this.add.rectangle(0, 0, WIDTH, TOP, hex(PALETTE.night)).setOrigin(0).setDepth(100).setInteractive();
    this.add.rectangle(0, TOP - 2, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setDepth(100);
    const barBot = this.add.rectangle(0, BOTTOM, WIDTH, HEIGHT - BOTTOM, hex(PALETTE.night)).setOrigin(0).setDepth(100).setInteractive();
    this.add.rectangle(0, BOTTOM, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setDepth(100);
    void barTop; void barBot;
    const hd = header(this, 'Hole', () => this.leave(), { y: 24 });
    [hd.back, hd.title, hd.help].forEach((o) => o?.setDepth(110));
    this.titleText = hd.title;
    this.strokesText = text(this, 12, 60, '', { origin: [0, 0.5] }).setDepth(110);
    this.midText = text(this, WIDTH / 2, 60, '', { color: PALETTE.gold }).setDepth(110);
    this.rightText = text(this, WIDTH - 12, 60, '', { origin: [1, 0.5], color: PALETTE.lavender }).setDepth(110);

    const solo = this.r.mode === 'practice' || this.r.mode === 'daily';
    this.leftBtn = button(this, 52, 612, 92, 44, solo ? 'Restart' : 'Card', () => (solo ? this.askRestart() : this.showCard()), { fill: PALETTE.lavender }).setDepth(110);
    fit(this.leftBtn.label, 80);
    this.viewBtn = button(this, WIDTH - 52, 612, 92, 44, 'View', () => this.toggleView(), { fill: PALETTE.lavender }).setDepth(110);
    this.statusText = text(this, WIDTH / 2, 600, '', { color: PALETTE.cream }).setDepth(110);
    this.powerG = this.add.graphics().setDepth(110);
    this.aimS = this.add.graphics().setDepth(60);
  }

  syncHud() {
    const h = this.hole; const r = this.r;
    const p = r.players[r.cur];
    const label = r.mode === 'daily' ? `Daily  Par ${h.par}` : `Hole ${h.index + 1}  Par ${h.par}`;
    this.titleText.setText(label).setScale(1);
    fit(this.titleText, WIDTH - 130);
    this.strokesText.setText(`Putts ${r.strokes}`);
    if (r.mode === 'party') {
      this.midText.setText(p.name).setColor(BALL_COLORS[p.color]);
      const tot = p.scores.reduce((a, b) => a + b, 0);
      this.rightText.setText(`Total ${tot}`);
    } else {
      this.midText.setText('');
      if (r.mode === 'round') {
        const done = p.scores.length;
        const diff = p.scores.reduce((a, b) => a + b, 0) - holesOf(r.course).slice(0, done).reduce((a, x) => a + x.par, 0);
        this.rightText.setText(`${diff === 0 ? 'Even' : diff > 0 ? `+${diff}` : diff}  ${done + 1}/9`);
      } else {
        const b = bestFor(h.id);
        this.rightText.setText(b == null ? '' : `Best ${b}`);
      }
    }
  }

  status(msg, color = PALETTE.cream) { this.statusText.setText(msg).setColor(color).setScale(1); fit(this.statusText, 150); }

  // ------------------------------------------------------------------ hole setup

  startHole(intro) {
    const r = this.r;
    this.coachHand?.destroy(); this.coachHand = null;
    this.hole = holeById(r.holes[r.hi]);
    this.theme = THEMES[this.hole.theme] || THEMES.meadow;
    this.W = compileHole(this.hole);
    this.Wpreview = { ...this.W, movers: [] };
    document.body.style.background = this.theme.page;
    this.cameras.main.setBackgroundColor(this.theme.page);
    this.wc?.destroy();
    this.wc = this.add.container(0, 0).setDepth(0);
    this.drawHole();
    const [bx, by] = r.ball && validSpot(this.W, r.ball[0], r.ball[1], 0) ? r.ball : [this.W.tee.x, this.W.tee.y];
    this.ball = newBall(bx, by);
    this.ballImg = this.add.image(bx, by, `ball${r.players[r.cur].color}`);
    this.shadow = this.add.ellipse(bx + 1, by + 3, 11, 6, hex(PALETTE.ink), 0.3);
    this.wc.add([this.shadow, this.ballImg]);
    this.aimW = this.add.graphics();
    this.fx = this.add.graphics();
    this.wc.add([this.aimW, this.fx]);
    this.shotEvents = { bumpers: 0, teleport: false };
    this.moveTime = 0;
    this.holedAnim = null;
    this.syncHud();

    // camera: overview first, then glide to the ball
    const b = this.W.box;
    this.fitS = Math.min(VP.w / (b.w + MARGIN * 2), VP.h / (b.h + MARGIN * 2));
    this.playS = this.fitS >= 1 ? Math.min(this.fitS, 1.35) : 1;
    this.canZoom = this.fitS < this.playS - 0.02;
    this.overview = false;
    this.manualCam = false;
    this.syncViewBtn();
    this.cam = { s: this.fitS, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
    this.applyCam();
    this.userS = this.playS;
    this.state = 'intro';
    this.status('');
    if (intro) this.introCard(); else this.beginPlay();
  }

  introCard() {
    const h = this.hole; const r = this.r;
    const c = this.add.container(0, 0).setDepth(200);
    const lines = [];
    if (r.mode === 'party') lines.push({ t: `${r.players[r.cur].name}, you're up`, color: BALL_COLORS[r.players[r.cur].color] });
    lines.push({ t: h.name, color: PALETTE.cream, size: 32 });
    lines.push({ t: `Par ${h.par}`, color: PALETTE.gold });
    if (h.tip) lines.push({ t: h.tip, color: PALETTE.lavender });
    let y = TOP + 16;
    const objs = lines.map((l) => { const o = text(this, WIDTH / 2, 0, l.t, { size: l.size || 16, color: l.color, wrap: 300 }).setOrigin(0.5, 0); fit(o, 310); return o; });
    const hgt = objs.reduce((a, o) => a + o.height + 6, 0) + 18;
    const bg = this.add.rectangle(WIDTH / 2, y, 330, hgt, hex(PALETTE.ink), 0.85).setOrigin(0.5, 0).setStrokeStyle(2, hex(this.theme.rail));
    c.add(bg);
    y += 10;
    for (const o of objs) { o.setY(y); c.add(o); y += o.height + 6; }
    this.intro = c;
    this.introTimer = this.time.delayedCall(1500, () => this.beginPlay());
  }

  beginPlay() {
    if (this.state !== 'intro') return;
    this.introTimer?.remove();
    if (this.intro) { const c = this.intro; this.intro = null; this.tweens.add({ targets: c, alpha: 0, duration: 400, delay: 1200, onComplete: () => c.destroy() }); }
    this.state = 'ready';
    this.cam.s = this.fitS;
    this.tweenCam(this.playS, this.ball.x, this.ball.y);
    this.readyStatus();
    this.coach();
  }

  readyStatus() {
    const p = this.r.players[this.r.cur];
    this.status(this.r.mode === 'party' ? `${p.name} to putt` : 'Your putt', PALETTE.cream);
  }

  // ------------------------------------------------------------------ drawing

  drawHole() {
    const W = this.W; const th = this.theme; const b = W.box;
    const g = this.add.graphics();
    this.wc.add(g);
    // ground around the course
    const ax = b.x - 420; const ay = b.y - 420; const aw = b.w + 840; const ah = b.h + 840;
    g.fillStyle(th.bg).fillRect(ax, ay, aw, ah);
    const rnd = mulberry(hash(this.hole.id));
    for (let k = 0; k < (aw * ah) / 900; k++) g.fillStyle(th.bgDot).fillRect(Math.round(ax + rnd() * aw), Math.round(ay + rnd() * ah), 2, 2);
    if (this.hole.theme === 'castle') {
      for (let y = ay; y < ay + ah; y += 24) for (let x = ax + ((y / 24) % 2) * 12; x < ax + aw; x += 24) g.fillStyle(0x241f2c).fillRect(x, y, 23, 1).fillRect(x, y, 1, 23);
    }
    // decorations outside the course
    const decor = [];
    for (let k = 0; k < 80; k++) {
      const x = b.x - 150 + rnd() * (b.w + 300); const y = b.y - 150 + rnd() * (b.h + 300);
      if (this.nearCourse(x, y, 20)) continue;
      if (decor.some((d) => Math.abs(d.x - x) < 18 && Math.abs(d.y - y) < 18)) continue;
      const f = th.decor[Math.floor(rnd() * th.decor.length)];
      decor.push({ x, y, f });
    }
    decor.sort((p, q) => p.y - q.y);
    for (const d of decor) {
      const img = this.add.image(Math.round(d.x), Math.round(d.y), decorSheet(d.f), d.f).setScale(2);
      if (th.tint && !d.f.startsWith('rock')) img.setTint(th.tint);
      this.wc.add(img);
    }
    const cg = this.add.graphics();
    this.wc.add(cg);
    const pts = W.bounds.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    const vec = (poly) => poly.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    // rails: the outline pushed outwards, so the ball rolls right up to them
    cg.fillStyle(hex(PALETTE.ink), 0.35).fillPoints(vec(offsetPoly(W.bounds, 10).map(([x, y]) => [x + 3, y + 4])), true);
    cg.fillStyle(hex(PALETTE.ink)).fillPoints(vec(offsetPoly(W.bounds, 10)), true);
    cg.fillStyle(th.rail).fillPoints(vec(offsetPoly(W.bounds, 8)), true);
    cg.fillStyle(th.railDark).fillPoints(vec(offsetPoly(W.bounds, 2)), true);
    cg.fillStyle(th.felt).fillPoints(pts, true);
    if (W.bounds.every(([x, y], i) => { const [x2, y2] = W.bounds[(i + 1) % W.bounds.length]; return x === x2 || y === y2; })) {
      for (let y = b.y; y < b.y + b.h; y += 24) {
        const mid = y + 6;
        const xs = scan(W.bounds, mid);
        for (let i = 0; i + 1 < xs.length; i += 2) cg.fillStyle(th.feltStripe).fillRect(xs[i], y, xs[i + 1] - xs[i], Math.min(12, b.y + b.h - y));
      }
    }
    // zones
    for (const z of W.zones) this.drawZone(cg, z);
    // tee mat
    cg.fillStyle(hex(PALETTE.ink), 0.35).fillRect(W.tee.x - 12, W.tee.y - 8, 24, 16);
    cg.lineStyle(2, hex(PALETTE.cream), 0.5).strokeRect(W.tee.x - 12, W.tee.y - 8, 24, 16);
    // blocks
    for (const bl of W.blocks) {
      const bp = bl.map(([x, y]) => new Phaser.Math.Vector2(x, y));
      const sp = bl.map(([x, y]) => new Phaser.Math.Vector2(x + 3, y + 4));
      cg.fillStyle(hex(PALETTE.ink), 0.3).fillPoints(sp, true);
      cg.fillStyle(th.block).fillPoints(bp, true);
      const bb = boxOf(bl);
      cg.fillStyle(th.blockTop).fillRect(bb.x + 2, bb.y + 2, bb.w - 4, 3);
      if (this.hole.theme === 'castle') for (let y = bb.y + 10; y < bb.y + bb.h - 2; y += 10) cg.fillStyle(SHADE.stoneLine, 0.6).fillRect(bb.x + 2, y, bb.w - 4, 1);
      if (this.hole.theme === 'meadow') for (let y = bb.y + 9; y < bb.y + bb.h - 2; y += 8) cg.fillStyle(hex(PALETTE.wine), 0.35).fillRect(bb.x + 2, y, bb.w - 4, 1);
      cg.lineStyle(2, hex(PALETTE.ink)).strokePoints(bp, true, true);
    }
    // cup
    cg.fillStyle(hex(PALETTE.ink)).fillCircle(W.cup.x, W.cup.y, CUP_R);
    cg.lineStyle(2, 0xffffff, 0.35).strokeCircle(W.cup.x, W.cup.y, CUP_R + 1);
    this.dyn = this.add.graphics();
    this.wc.add(this.dyn);
    this.pole = this.add.image(W.cup.x + 1, W.cup.y - 15, 'pole');
    this.flag = this.add.triangle(W.cup.x + 2, W.cup.y - 30, 0, 0, 16, 5, 0, 10, hex(PALETTE.red)).setOrigin(0, 0);
    this.tweens.add({ targets: this.flag, scaleX: 0.7, yoyo: true, repeat: -1, duration: 600 });
    this.wc.add([this.pole, this.flag]);
  }

  nearCourse(x, y, pad) {
    const W = this.W;
    if (inPoly(W.bounds, x, y)) return true;
    for (let i = 0; i < W.bounds.length; i++) {
      const [ax, ay] = W.bounds[i]; const [bx, by] = W.bounds[(i + 1) % W.bounds.length];
      if (segDist(x, y, ax, ay, bx, by) < pad) return true;
    }
    return false;
  }

  drawZone(g, z) {
    const th = this.theme; const sh = z.shape;
    const fill = (c, a = 1) => {
      g.fillStyle(c, a);
      if (sh.kind === 'rect') g.fillRect(sh.x, sh.y, sh.w, sh.h);
      else if (sh.kind === 'circle') g.fillCircle(sh.x, sh.y, sh.rad);
      else g.fillPoints(sh.pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    };
    const bb = sh.kind === 'rect' ? sh : sh.kind === 'circle' ? { x: sh.x - sh.rad, y: sh.y - sh.rad, w: sh.rad * 2, h: sh.rad * 2 } : boxOf(sh.pts);
    const pattern = (dx, dy, fn) => { for (let y = bb.y + dy / 2; y < bb.y + bb.h; y += dy) for (let x = bb.x + ((Math.round(y / dy) % 2) * dx) / 2; x < bb.x + bb.w; x += dx) if (contains(sh, x, y)) fn(x, y); };
    switch (z.t) {
      case 'grass': fill(th.felt); break;
      case 'sand':
        fill(th.sand);
        pattern(7, 6, (x, y) => g.fillStyle(th.sandDot).fillRect(Math.round(x), Math.round(y), 2, 1));
        break;
      case 'water':
        fill(th.water);
        pattern(18, 10, (x, y) => g.fillStyle(th.waterLine).fillRect(Math.round(x), Math.round(y), 6, 1));
        break;
      case 'ice':
        fill(SHADE.ice);
        pattern(22, 16, (x, y) => { if (contains(sh, x + 8, y - 8)) g.lineStyle(1, SHADE.iceLine).lineBetween(x, y, x + 8, y - 8); });
        break;
      case 'slope': fill(hex(PALETTE.ink), 0.12); break;
      case 'boost': fill(hex(PALETTE.orange)); g.lineStyle(2, hex(PALETTE.ink)).strokeRect(bb.x, bb.y, bb.w, bb.h); break;
      case 'ramp': {
        fill(hex(PALETTE.orange));
        const [dx, dy] = z.dir;
        // stripes across the ramp, light at the lip
        for (let k = 4; k < (dy ? bb.h : bb.w); k += 6) {
          if (dy) g.fillStyle(hex(PALETTE.wine), 0.5).fillRect(bb.x, dy < 0 ? bb.y + bb.h - k : bb.y + k, bb.w, 2);
          else g.fillStyle(hex(PALETTE.wine), 0.5).fillRect(dx < 0 ? bb.x + bb.w - k : bb.x + k, bb.y, 2, bb.h);
        }
        g.fillStyle(hex(PALETTE.cream));
        if (dy < 0) g.fillRect(bb.x, bb.y, bb.w, 3); else if (dy > 0) g.fillRect(bb.x, bb.y + bb.h - 3, bb.w, 3);
        else if (dx > 0) g.fillRect(bb.x + bb.w - 3, bb.y, 3, bb.h); else g.fillRect(bb.x, bb.y, 3, bb.h);
        g.lineStyle(2, hex(PALETTE.ink)).strokeRect(bb.x, bb.y, bb.w, bb.h);
        break;
      }
      default: break;
    }
  }

  /** Everything that moves or glows, redrawn every frame. */
  drawDynamic() {
    const g = this.dyn; const W = this.W; const t = this.worldT; const th = this.theme;
    g.clear();
    // slope and boost arrows drift the way they push
    for (const z of W.zones) {
      if (z.t !== 'slope' && z.t !== 'boost') continue;
      const [dx, dy] = z.t === 'slope' ? norm(z.g) : z.dir;
      const sh = z.shape; const bb = sh.kind === 'rect' ? sh : boxOf(sh.kind === 'poly' ? sh.pts : [[sh.x - sh.rad, sh.y - sh.rad], [sh.x + sh.rad, sh.y + sh.rad]]);
      const gap = z.t === 'boost' ? 14 : 30;
      const off = ((t * (z.t === 'boost' ? 40 : 14)) % gap);
      const onIce = z.t === 'slope' && W.zones.some((q) => q.t === 'ice' && contains(q.shape, z.shape.x ?? 0, z.shape.y ?? 0));
      const col = z.t === 'boost' ? hex(PALETTE.gold) : onIce ? hex(PALETTE.indigo) : 0xffffff;
      const alpha = z.t === 'boost' ? 1 : onIce ? 0.55 : 0.3;
      g.lineStyle(z.t === 'boost' ? 3 : 2, col, alpha);
      for (let y = bb.y + 10; y < bb.y + bb.h - 4; y += z.t === 'boost' ? 14 : 30) {
        for (let x = bb.x + 10; x < bb.x + bb.w - 4; x += z.t === 'boost' ? 20 : 34) {
          const cx = x + dx * off; const cy = y + dy * off;
          if (!contains(sh, cx + dx * 4, cy + dy * 4) || !contains(sh, cx - dx * 4, cy - dy * 4)) continue;
          const px = -dy; const py = dx;
          g.lineBetween(cx - dx * 3 + px * 5, cy - dy * 3 + py * 5, cx + dx * 3, cy + dy * 3);
          g.lineBetween(cx - dx * 3 - px * 5, cy - dy * 3 - py * 5, cx + dx * 3, cy + dy * 3);
        }
      }
    }
    // portals
    W.teleports.forEach((tp) => {
      for (const [p, col, dir] of [[tp.a, hex(PALETTE.plum), 1], [tp.b, hex(PALETTE.lavender), -1]]) {
        g.fillStyle(hex(PALETTE.ink), 0.8).fillCircle(p[0], p[1], TELE_R + 1);
        g.lineStyle(3, col);
        for (let k = 0; k < 3; k++) {
          const a = dir * t * 3 + (k * Math.PI * 2) / 3;
          g.beginPath(); g.arc(p[0], p[1], TELE_R - 1, a, a + 1.4); g.strokePath();
        }
        g.fillStyle(col, 0.6).fillCircle(p[0], p[1], 3 + Math.sin(t * 4) * 1.2);
      }
    });
    // bumpers
    for (const bp of W.bumpers) {
      const lit = bp.lit && this.time.now - bp.lit < 160;
      g.fillStyle(hex(PALETTE.ink), 0.3).fillCircle(bp.x + 2, bp.y + 3, bp.r);
      g.fillStyle(hex(PALETTE.ink)).fillCircle(bp.x, bp.y, bp.r + 1);
      g.fillStyle(lit ? 0xffffff : hex(PALETTE.red)).fillCircle(bp.x, bp.y, bp.r - 1);
      g.fillStyle(lit ? hex(PALETTE.gold) : hex(PALETTE.cream)).fillCircle(bp.x, bp.y, bp.r * 0.45);
    }
    // moving obstacles
    for (const m of W.movers) {
      if (m.t === 'slider') {
        const r = sliderRect(m, t);
        const x0 = Math.max(r.x, W.box.x); const x1 = Math.min(r.x + r.w, W.box.x + W.box.w);
        const y0 = Math.max(r.y, W.box.y); const y1 = Math.min(r.y + r.h, W.box.y + W.box.h);
        if (x1 <= x0 || y1 <= y0) continue;
        const gate = !!m.hold;
        g.fillStyle(hex(PALETTE.ink), 0.3).fillRect(x0 + 3, y0 + 4, x1 - x0, y1 - y0);
        g.fillStyle(gate ? hex(PALETTE.wine) : hex(PALETTE.plum)).fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle(gate ? hex(PALETTE.red) : 0xb75a9a);
        if (gate) for (let x = x0 + 3; x < x1 - 3; x += 8) g.fillRect(x, y0 + 2, 3, y1 - y0 - 4);
        else g.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, 3);
        g.lineStyle(2, hex(PALETTE.ink)).strokeRect(x0, y0, x1 - x0, y1 - y0);
      } else if (m.t === 'windmill') {
        const n = m.blades || 4;
        for (let k = 0; k < n; k++) {
          const a = bladeAngle(m, t, k);
          const ex = m.x + Math.cos(a) * m.len; const ey = m.y + Math.sin(a) * m.len;
          g.lineStyle(7, hex(PALETTE.ink)).lineBetween(m.x, m.y, ex, ey);
          g.lineStyle(4, hex(PALETTE.cream)).lineBetween(m.x + Math.cos(a) * 6, m.y + Math.sin(a) * 6, ex - Math.cos(a) * 1, ey - Math.sin(a) * 1);
          g.lineStyle(2, hex(PALETTE.wine)).lineBetween(m.x + Math.cos(a) * 12, m.y + Math.sin(a) * 12, ex - Math.cos(a) * 3, ey - Math.sin(a) * 3);
        }
        g.fillStyle(hex(PALETTE.ink)).fillCircle(m.x, m.y, 6);
        g.fillStyle(th === THEMES.castle ? hex(PALETTE.gold) : hex(PALETTE.red)).fillCircle(m.x, m.y, 4);
      }
    }
  }

  drawBall() {
    const b = this.ball;
    const z = b.air > 0 ? Math.sin((1 - b.air / b.airDur) * Math.PI) : 0;
    let s = 1 + z * 0.6;
    let alpha = 1;
    if (this.holedAnim) { const k = Math.min(1, (this.time.now - this.holedAnim) / 260); s = 1 - k * 0.6; alpha = 1 - k; }
    this.ballImg.setPosition(b.x, b.y - z * 16).setScale(s).setAlpha(alpha);
    this.shadow.setPosition(b.x + 1 + z * 4, b.y + 3).setScale(1 - z * 0.3).setVisible(!this.holedAnim);
  }

  // ------------------------------------------------------------------ camera

  applyCam() {
    const c = this.cam; const b = this.W.box;
    const hw = VP.w / 2 / c.s; const hh = VP.h / 2 / c.s;
    if (b.w + MARGIN * 2 <= hw * 2) c.cx = b.x + b.w / 2; else c.cx = Phaser.Math.Clamp(c.cx, b.x - MARGIN + hw, b.x + b.w + MARGIN - hw);
    if (b.h + MARGIN * 2 <= hh * 2) c.cy = b.y + b.h / 2; else c.cy = Phaser.Math.Clamp(c.cy, b.y - MARGIN + hh, b.y + b.h + MARGIN - hh);
    this.wc.setScale(c.s);
    this.wc.setPosition(VP.x + VP.w / 2 - c.cx * c.s, VP.y + VP.h / 2 - c.cy * c.s);
  }

  tweenCam(s, cx, cy, ms = 600) {
    this.camTween?.stop();
    this.camTween = this.tweens.add({ targets: this.cam, s, cx, cy, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => this.applyCam() });
  }

  toScreen(x, y) { return { x: this.wc.x + x * this.cam.s, y: this.wc.y + y * this.cam.s }; }

  toggleView() {
    if (this.state === 'intro') return;
    if (this.manualCam && !this.overview) {
      // looked around (or pinched): back to the ball
      this.manualCam = false;
      this.userS = this.playS;
      this.tweenCam(this.playS, this.ball.x, this.ball.y, 400);
      this.syncViewBtn();
      return;
    }
    if (!this.canZoom) return;
    this.overview = !this.overview;
    const b = this.W.box;
    if (this.overview) this.tweenCam(this.fitS, b.x + b.w / 2, b.y + b.h / 2, 400);
    else { this.manualCam = false; this.tweenCam(this.userS, this.ball.x, this.ball.y, 400); }
    this.syncViewBtn();
  }

  syncViewBtn() {
    const label = this.overview ? 'Close' : this.manualCam ? 'Ball' : 'View';
    if (this.viewBtn.label.text !== label) this.viewBtn.setLabel(label);
    this.viewBtn.setEnabled(this.canZoom || this.manualCam);
  }

  followBall(dt) {
    if (this.manualCam || this.overview || this.camTween?.isPlaying()) return;
    const c = this.cam;
    const k = 1 - Math.pow(0.02, dt);
    c.cx += (this.ball.x - c.cx) * k; c.cy += (this.ball.y - c.cy) * k;
    this.applyCam();
  }

  // ------------------------------------------------------------------ input

  dropTouches() {
    this.touches.clear();
    this.aiming = null; this.pan = null; this.pinch = null;
    this.aimW?.clear(); this.aimS?.clear(); this.powerG?.clear();
    if (this.state === 'aiming') { this.state = 'ready'; this.readyStatus(); }
  }

  blocked() { return this.leaving || this.popup || document.getElementById('howto'); }

  onDown(p, over) {
    if (this.blocked() || over?.length) return;
    if (p.y < TOP || p.y > BOTTOM) return;
    this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.state === 'intro') { this.beginPlay(); this.touches.delete(p.id); return; }
    if (this.touches.size >= 2) {
      // second finger: pinch zoom, and whatever the first finger was doing is cancelled
      if (this.aiming) { this.aiming = null; this.aimW.clear(); this.aimS.clear(); this.powerG.clear(); this.state = 'ready'; this.readyStatus(); }
      this.pan = null;
      const [a, b] = [...this.touches.values()];
      this.pinch = { d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), s0: this.cam.s };
      this.camTween?.stop();
      return;
    }
    const bs = this.toScreen(this.ball.x, this.ball.y);
    if (this.state === 'ready' && grabs(bs.x, bs.y, p.x, p.y)) {
      this.aiming = { id: p.id, fx: p.x, fy: p.y, max: 0 };
      this.state = 'aiming';
      this.coachHand?.destroy(); this.coachHand = null;
      return;
    }
    this.pan = { id: p.id, x: p.x, y: p.y, cx: this.cam.cx, cy: this.cam.cy, moved: false };
  }

  onMove(p) {
    if (!this.touches.has(p.id)) return;
    this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.pinch) {
      if (this.touches.size < 2) return;
      const [a, b] = [...this.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const s = Phaser.Math.Clamp(this.pinch.s0 * (d / this.pinch.d0), this.fitS * 0.95, 2.2);
      this.cam.s = s; this.userS = s;
      this.overview = false;
      this.manualCam = true;
      this.syncViewBtn();
      this.applyCam();
      return;
    }
    if (this.aiming && p.id === this.aiming.id) {
      this.aiming.fx = p.x; this.aiming.fy = p.y;
      const bs = this.toScreen(this.ball.x, this.ball.y);
      this.aiming.max = Math.max(this.aiming.max, Math.hypot(p.x - bs.x, p.y - bs.y));
      this.drawAim();
      return;
    }
    if (this.pan && p.id === this.pan.id) {
      const dx = p.x - this.pan.x; const dy = p.y - this.pan.y;
      if (!this.pan.moved && Math.hypot(dx, dy) < 10) return;
      this.pan.moved = true;
      this.overview = false;
      this.manualCam = true;
      this.syncViewBtn();
      this.camTween?.stop();
      this.cam.cx = this.pan.cx - dx / this.cam.s; this.cam.cy = this.pan.cy - dy / this.cam.s;
      this.applyCam();
    }
  }

  onUp(p) {
    if (!this.touches.has(p.id)) return;
    this.touches.delete(p.id);
    if (this.pinch) { if (this.touches.size < 2) this.pinch = null; return; }
    if (this.aiming && p.id === this.aiming.id) {
      const a = this.aiming; this.aiming = null;
      this.aimW.clear(); this.aimS.clear(); this.powerG.clear();
      if (this.state !== 'aiming') return;
      this.state = 'ready';
      const bs = this.toScreen(this.ball.x, this.ball.y);
      const shot = aimFromDrag(bs.x, bs.y, a.fx, a.fy, a.max);
      if (shot.cancelled) {
        this.readyStatus();
        if (a.max < 18) this.hint('Pull back from the ball to aim');
        return;
      }
      this.putt(shot.angle, shot.power);
      return;
    }
    if (this.pan && p.id === this.pan.id) {
      const moved = this.pan.moved; this.pan = null;
      if (!moved && this.state === 'ready') this.hint('Start your drag on the ball');
    }
  }

  hint(msg) {
    if (this.time.now - (this.lastHint || 0) < 1200) return;
    this.lastHint = this.time.now;
    toast(this, msg, BOTTOM - 40, PALETTE.gold, 1400);
  }

  drawAim() {
    const a = this.aiming;
    const bs = this.toScreen(this.ball.x, this.ball.y);
    const shot = aimFromDrag(bs.x, bs.y, a.fx, a.fy, a.max);
    this.aimW.clear(); this.aimS.clear(); this.powerG.clear();
    // the pull: a band from the ball to the finger
    this.aimS.lineStyle(2, hex(PALETTE.cream), 0.5).lineBetween(bs.x, bs.y, a.fx, a.fy);
    this.aimS.fillStyle(hex(PALETTE.cream), 0.5).fillCircle(a.fx, a.fy, 5);
    if (shot.cancelled) {
      this.aimS.lineStyle(2, hex(PALETTE.lavender)).strokeCircle(bs.x, bs.y, 18);
      this.status('Let go to cancel', PALETTE.lavender);
      return;
    }
    // the first part of the path, bounces included
    const r = simulate(this.Wpreview, this.ball.x, this.ball.y, this.worldT, shot.angle, shot.power, { path: true, stopAfter: 40 + shot.power * 170 });
    let acc = 0; let next = 8; let n = 0;
    const pts = r.path;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= next) {
        next += 9; n++;
        const fade = Math.max(0.25, 1 - acc / (60 + shot.power * 170));
        this.aimW.fillStyle(hex(PALETTE.ink), 0.5 * fade).fillCircle(pts[i][0] + 0.6, pts[i][1] + 0.8, 2.2);
        this.aimW.fillStyle(0xffffff, fade).fillCircle(pts[i][0], pts[i][1], 1.8);
      }
    }
    // power bar
    const x0 = WIDTH / 2 - 64; const y0 = 616;
    this.powerG.fillStyle(hex(PALETTE.ink)).fillRect(x0 - 2, y0 - 2, 132, 14);
    this.powerG.fillStyle(hex(PALETTE.indigo)).fillRect(x0, y0, 128, 10);
    this.powerG.fillStyle(hex(shot.power > 0.85 ? PALETTE.red : shot.power > 0.55 ? PALETTE.orange : PALETTE.gold)).fillRect(x0, y0, Math.round(128 * shot.power), 10);
    this.status(`Power ${Math.round(shot.power * 100)}%`, PALETTE.gold);
  }

  // ------------------------------------------------------------------ playing

  putt(angle, power) {
    const r = this.r;
    this.coachHand?.destroy(); this.coachHand = null;
    r.strokes++;
    play('putt', power);
    shoot(this.ball, angle, power);
    this.state = 'moving';
    this.moveTime = 0;
    this.manualCam = false;
    if (this.overview) this.toggleView();
    this.syncViewBtn();
    this.shotEvents = { bumpers: 0, teleport: false };
    stat('putts');
    r.ball = [this.ball.fromX, this.ball.fromY];
    save.set('round', r);
    this.syncHud();
    this.status('');
    if (!save.get('coached') && r.strokes === 1) this.time.delayedCall(700, () => { if (this.scene.isActive()) toast(this, 'Nice putt! Get it in the cup by the flag.', BOTTOM - 40, PALETTE.gold, 2000); });
  }

  /**
   * Controller putting: the stick (or d-pad) points where the ball should go, hold A to build
   * power, let go to putt. B cancels a putt you're charging. It uses the same aim line and power
   * bar as a finger drag.
   */
  padPutt(delta) {
    const mine = this.aiming?.id === 'pad';
    const drop = () => { if (mine) { this.aiming = null; this.aimW.clear(); this.aimS.clear(); this.powerG.clear(); this.state = 'ready'; } this.padCharge = null; };
    if (!usingPad() || this.blocked()) { drop(); return; }
    if (this.state === 'intro') { if (hit('a')) this.beginPlay(); return; }
    if ((this.state !== 'ready' && this.state !== 'aiming') || (this.aiming && !mine)) return;
    const s = stick();
    if (Math.hypot(s.x, s.y) > 0.5) this.padAngle = Math.atan2(s.y, s.x);
    if (this.padAngle == null) { if (!hit('a')) return; this.padAngle = -Math.PI / 2; }
    if (hit('b') && this.padCharge != null) { drop(); this.readyStatus(); return; }
    if (hit('a')) this.padCharge = 0;
    if (this.padCharge != null && down('a')) this.padCharge = Math.min(1, this.padCharge + delta / 1400);
    const power = this.padCharge ?? 0.12;
    const dist = CANCEL_R + 2 + power * (FULL_DRAG - CANCEL_R);
    const bs = this.toScreen(this.ball.x, this.ball.y);
    this.aiming = { id: 'pad', fx: bs.x - Math.cos(this.padAngle) * dist, fy: bs.y - Math.sin(this.padAngle) * dist, max: 999 };
    this.state = 'aiming';
    this.drawAim();
    if (this.padCharge != null && !down('a')) {
      // Like a finger, a quick tap of A never putts.
      if (this.padCharge < 0.08) { drop(); this.readyStatus(); return; }
      const shot = aimFromDrag(bs.x, bs.y, this.aiming.fx, this.aiming.fy, 999);
      drop();
      this.coachHand?.destroy(); this.coachHand = null;
      this.putt(shot.angle, shot.power);
    }
  }

  update(_, delta) {
    if (!this.W) return;
    this.padPutt(delta);
    const dt = Math.min(delta, 50) / 1000;
    this.acc += dt;
    let loops = 0;
    while (this.acc >= DT && loops++ < 10) {
      this.acc -= DT;
      if (this.state === 'ready' || this.state === 'aiming' || this.state === 'moving') {
        const st = step(this.W, this.ball, this.worldT, this.ev);
        if (this.state !== 'moving' && st === 'moving') {
          // a mover shoved the resting ball: wait for it to settle before the next putt
          if (this.aiming) { this.aiming = null; this.aimW.clear(); this.aimS.clear(); this.powerG.clear(); }
          this.ball.fromX = this.r.ball?.[0] ?? this.ball.x; this.ball.fromY = this.r.ball?.[1] ?? this.ball.y;
          this.state = 'moving';
          this.moveTime = 0;
          this.status('');
        }
        if (this.state === 'moving' && st !== 'moving') { this.worldT += DT; this.onStop(st); break; }
      }
      this.worldT += DT;
    }
    if (this.acc > DT * 10) this.acc = 0;
    if (this.state === 'moving') {
      this.moveTime += dt;
      this.checkTips();
      if (this.moveTime > 30) { this.ball.moving = false; this.onStop('reset'); }
    }
    this.handleEvents();
    this.drawDynamic();
    this.drawBall();
    if (this.state === 'moving' || this.state === 'ready') this.followBall(dt);
  }

  checkTips() {
    const b = this.ball;
    if (b.air > 0) return;
    const z = zoneAt(this.W, b.x, b.y);
    if (z && TIPS[z.t]) this.tip(z.t);
  }

  tip(kind) {
    const tips = save.get('tips');
    if (tips[kind] || !TIPS[kind]) return;
    save.set('tips', { ...tips, [kind]: true });
    toast(this, TIPS[kind](this.theme), TOP + 24, PALETTE.gold, 2200);
  }

  handleEvents() {
    const ev = this.ev;
    if (!ev.length) return;
    for (const e of ev) {
      switch (e.type) {
        case 'wall': case 'mover': case 'windmill':
          if (this.time.now - this.lastWallSound > 70) { this.lastWallSound = this.time.now; play(e.type === 'windmill' ? 'mill' : 'wall', Math.min(1, (e.speed || 100) / 400)); }
          if (e.type !== 'wall') this.tip(e.type);
          break;
        case 'bumper': {
          play('bumper');
          const bp = this.W.bumpers.find((q) => q.x === e.x && q.y === e.y);
          if (bp) bp.lit = this.time.now;
          this.shotEvents.bumpers++;
          if (this.shotEvents.bumpers >= 4) award('pinball');
          this.tip('bumper');
          break;
        }
        case 'teleport': play('portal'); this.shotEvents.teleport = true; this.tip('teleport'); this.manualCam = false; this.syncViewBtn(); break;
        case 'boost': play('boost'); break;
        case 'ramp': play('jump'); this.tip('ramp'); break;
        case 'land': play('land'); break;
        default: break;
      }
    }
    ev.length = 0;
  }

  onStop(st) {
    const r = this.r; const b = this.ball;
    this.handleEvents();
    if (st === 'holed') { this.holed(); return; }
    if (st === 'water') {
      r.strokes++;
      this.state = 'penalty';
      const lava = this.theme.waterName === 'lava';
      play(lava ? 'sizzle' : 'splash');
      award('splash');
      this.splash(b.x, b.y);
      this.ballImg.setVisible(false); this.shadow.setVisible(false);
      toast(this, `${lava ? 'Lava' : 'Splash'}! +1 stroke`, TOP + 24, PALETTE.gold, 1200);
      this.syncHud();
      r.ball = [b.fromX, b.fromY];
      save.set('round', r);
      this.time.delayedCall(900, () => {
        if (!this.scene.isActive() || this.state !== 'penalty') return;
        this.placeBall(b.fromX, b.fromY);
        this.afterRest();
      });
      return;
    }
    if (st === 'reset') {
      toast(this, 'Ball stuck. It goes back to where you hit it.', TOP + 24, PALETTE.gold, 1600);
      this.placeBall(b.fromX, b.fromY);
    }
    this.afterRest();
  }

  placeBall(x, y) {
    const b = this.ball;
    b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.moving = false; b.air = 0;
    this.ballImg.setVisible(true); this.shadow.setVisible(true);
    this.manualCam = false;
    this.syncViewBtn();
  }

  afterRest() {
    const r = this.r;
    r.ball = [this.ball.x, this.ball.y];
    save.set('round', r);
    this.syncHud();
    if (r.strokes >= strokeCap(this.hole)) {
      this.state = 'done';
      toast(this, `Ball picked up at ${strokeCap(this.hole)} putts`, TOP + 24, PALETTE.gold, 1500);
      this.time.delayedCall(1100, () => { if (this.scene.isActive()) this.finishHole(strokeCap(this.hole), true); });
      return;
    }
    this.state = 'ready';
    this.readyStatus();
  }

  splash(x, y) {
    const lava = this.theme.waterName === 'lava';
    const ring = this.add.circle(x, y, 4).setStrokeStyle(2, lava ? hex(PALETTE.gold) : hex(PALETTE.cream)).setFillStyle();
    this.wc.add(ring);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    for (let k = 0; k < 6; k++) {
      const d = this.add.rectangle(x, y, 3, 3, lava ? hex(PALETTE.orange) : hex(PALETTE.cream));
      this.wc.add(d);
      const a = (k / 6) * Math.PI * 2;
      this.tweens.add({ targets: d, x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 12 - 10, alpha: 0, duration: 500, onComplete: () => d.destroy() });
    }
  }

  holed() {
    this.state = 'done';
    this.holedAnim = this.time.now;
    play('cup');
    if (this.shotEvents.teleport) award('wormhole');
    const r = this.r;
    const strokes = r.strokes;
    this.time.delayedCall(450, () => { if (this.scene.isActive()) this.finishHole(strokes, false); });
    // a little burst of confetti
    for (let k = 0; k < 10; k++) {
      const d = this.add.rectangle(this.W.cup.x, this.W.cup.y, 3, 3, hex([PALETTE.gold, PALETTE.cream, PALETTE.red, PALETTE.lavender][k % 4]));
      this.wc.add(d);
      const a = (k / 10) * Math.PI * 2;
      this.tweens.add({ targets: d, x: d.x + Math.cos(a) * 26, y: d.y + Math.sin(a) * 20 - 14, alpha: 0, duration: 700, onComplete: () => d.destroy() });
    }
  }

  // ------------------------------------------------------------------ results

  finishHole(score, picked) {
    const r = this.r; const h = this.hole;
    const p = r.players[r.cur];
    p.scores[r.hi] = score;
    stat('holes');
    if (score === 1) stat('aces');
    const solo = r.mode !== 'party';
    let rec = null;
    if (solo && r.mode !== 'daily') rec = recordHole(h, score);
    if (solo && !picked) holeTrophies(h, score);
    if (!save.get('coached')) save.set('coached', true);
    let daily = null;
    if (r.mode === 'daily') { daily = reportDaily(GAME_ID, score, { lower: true }); award('daily'); }

    // move the saved round on, so leaving now resumes at the right place
    const lastPlayer = r.cur >= r.players.length - 1;
    const lastHole = r.hi >= r.holes.length - 1;
    const roundOver = lastPlayer && lastHole;
    r.strokes = 0; r.ball = null;
    if (!lastPlayer) r.cur++;
    else if (!lastHole) { r.hi++; r.cur = 0; }
    save.set('round', roundOver ? null : r);

    const lines = [];
    const name = picked ? 'Picked up' : scoreName(score, h.par);
    lines.push({ text: `${r.mode === 'party' ? `${p.name}: ` : ''}${score} putt${score === 1 ? '' : 's'}, par ${h.par}`, color: PALETTE.cream });
    if (rec?.newRecord && rec.prev != null) lines.push({ text: `New best! (was ${rec.prev})`, color: PALETTE.gold });
    if (daily) lines.push({ text: `Today's best ${daily.best}.  Streak ${daily.streak} day${daily.streak === 1 ? '' : 's'}`, color: PALETTE.gold });
    const stars = starsFor(score, h.par);
    const buttons = [];
    if (r.mode === 'round' || r.mode === 'party') {
      if (roundOver) buttons.push(['Final scorecard', () => this.finalCard()]);
      else if (!lastPlayer) buttons.push([`${r.players[r.cur].name}'s turn`, () => this.passPhone()]);
      else buttons.push([`Hole ${r.hi + 1}`, () => this.nextHole()], ['Scorecard', () => this.showCard(() => this.nextHole())]);
    } else if (r.mode === 'practice') {
      const next = holesOf(h.course)[h.index + 1];
      if (next && holeUnlocked(next)) buttons.push([`Next: hole ${next.index + 1}`, () => startPlay(this, { mode: 'practice', course: h.course, holes: [next.id] })]);
      buttons.push(['Play it again', () => startPlay(this, { mode: 'practice', course: h.course, holes: [h.id] })]);
      buttons.push(['Courses', () => go(this, 'Courses', { course: h.course })]);
    } else {
      buttons.push(['Try again', () => startPlay(this, { mode: 'daily', holes: [h.id] })]);
      buttons.push(['Menu', () => go(this, 'Menu')]);
    }
    this.popup = modal(this, name, lines, buttons, {
      extra: 34,
      content: (c, y) => c.add(starRow(this, WIDTH / 2, y + 14, stars, { gap: 32 })),
      onClose: () => { this.popup = null; },
    });
    sfx(picked ? 'lose' : score <= h.par ? 'win' : 'coin');
  }

  nextHole() { this.startHole(true); }

  passPhone() {
    const p = this.r.players[this.r.cur];
    this.popup = modal(this, 'Pass the phone', [{ text: `${p.name}, it's your turn on hole ${this.r.hi + 1}.`, color: BALL_COLORS[p.color] }], [['Ready!', () => this.startHole(true)]], { onClose: () => { this.popup = null; } });
  }

  /** The scorecard table: one row per hole, one column per player. */
  cardContent(c, top) {
    const r = this.r;
    const holes = r.holes.map((id) => holeById(id));
    const n = r.players.length;
    const left = 30; const colW = Math.floor((WIDTH - 60 - 90) / n);
    const colX = (i) => left + 90 + colW * i + colW / 2;
    const row = 21;
    c.add(text(this, left + 22, top + 8, 'Hole', { color: PALETTE.lavender }));
    c.add(text(this, left + 68, top + 8, 'Par', { color: PALETTE.lavender }));
    r.players.forEach((p, i) => c.add(fit(text(this, colX(i), top + 8, n > 1 ? `P${i + 1}` : 'You', { color: BALL_COLORS[p.color] }), colW - 4)));
    holes.forEach((h, k) => {
      const y = top + 8 + (k + 1) * row;
      if (k === r.hi && !this.roundOverShown) c.add(this.add.rectangle(WIDTH / 2, y, WIDTH - 56, row - 2, hex(PALETTE.indigo)));
      c.add(text(this, left + 22, y, `${k + 1}`, { color: PALETTE.cream }));
      c.add(text(this, left + 68, y, `${h.par}`, { color: PALETTE.cream }));
      r.players.forEach((p, i) => {
        const s = p.scores[k];
        const col = s == null ? PALETTE.lavender : s < h.par ? PALETTE.gold : s === h.par ? PALETTE.cream : PALETTE.orange;
        c.add(text(this, colX(i), y, s == null ? '-' : `${s}`, { color: col }));
      });
    });
    const y = top + 8 + (holes.length + 1) * row + 4;
    c.add(this.add.rectangle(WIDTH / 2, y - row / 2 - 1, WIDTH - 60, 2, hex(PALETTE.lavender)));
    c.add(text(this, left + 22, y + 2, 'Tot', { color: PALETTE.gold }));
    c.add(text(this, left + 68, y + 2, `${holes.reduce((a, h) => a + h.par, 0)}`, { color: PALETTE.gold }));
    r.players.forEach((p, i) => c.add(text(this, colX(i), y + 2, `${p.scores.reduce((a, b) => a + (b || 0), 0)}`, { color: PALETTE.gold })));
  }

  cardHeight() { return 8 + (this.r.holes.length + 2) * 21 + 16; }

  showCard(after) {
    if (this.popup || this.state === 'moving' || this.state === 'aiming') return;
    this.dropTouches();
    this.popup = modal(this, 'Scorecard', [], [['Close', () => after?.()]], {
      extra: this.cardHeight(), content: (c, y) => this.cardContent(c, y), onClose: () => { this.popup = null; },
    });
  }

  finalCard() {
    const r = this.r;
    this.roundOverShown = true;
    const totals = r.players.map((p) => p.scores.reduce((a, b) => a + b, 0));
    const par = r.holes.reduce((a, id) => a + holeById(id).par, 0);
    const lines = [];
    let title = 'Round complete';
    if (r.mode === 'party') {
      award('party');
      const best = Math.min(...totals);
      const winners = r.players.filter((_, i) => totals[i] === best);
      title = winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins!`;
      lines.push({ text: r.players.map((p, i) => `${p.name} ${totals[i]}`).join('   '), color: PALETTE.cream });
    } else {
      const total = totals[0];
      const rec = recordRound(r.course, total);
      roundTrophies(r.course, total);
      stat('rounds');
      const d = total - par;
      title = d < 0 ? 'Under par!' : d === 0 ? 'Level par!' : 'Round complete';
      lines.push({ text: `${total} putts, par ${par} (${d === 0 ? 'even' : d > 0 ? `+${d}` : d})`, color: PALETTE.cream });
      if (rec.newRecord && rec.prev != null) lines.push({ text: `New best round! (was ${rec.prev})`, color: PALETTE.gold });
      const next = r.course + 1;
      if (COURSES[next] && courseUnlocked(next) && !save.get('tips')[`open${next}`]) {
        save.set('tips', { ...save.get('tips'), [`open${next}`]: true });
        lines.push({ text: `${COURSES[next].name} is open!`, color: PALETTE.gold });
      }
    }
    const buttons = [];
    if (r.mode === 'round' && COURSES[r.course + 1] && courseUnlocked(r.course + 1)) buttons.push([`Play ${COURSES[r.course + 1].name}`, () => startPlay(this, { mode: 'round', course: r.course + 1 })]);
    buttons.push(['Play again', () => startPlay(this, { mode: r.mode, course: r.course, players: r.players.length })]);
    buttons.push(['Menu', () => go(this, 'Menu')]);
    sfx('win');
    this.popup = modal(this, title, lines, buttons, {
      extra: this.cardHeight(), content: (c, y) => this.cardContent(c, y), onClose: () => { this.popup = null; },
    });
  }

  askRestart() {
    if (this.popup || this.state === 'moving' || this.state === 'intro') return;
    this.dropTouches();
    this.popup = modal(this, 'Restart hole?', ['Back to the tee with no putts.'], [
      ['Restart', () => { this.r.strokes = 0; this.r.ball = null; save.set('round', this.r); this.startHole(false); }],
      ['Keep playing', () => {}],
    ], { row: true, onClose: () => { this.popup = null; } });
  }

  leave() {
    if (this.leaving) return;
    // the round is saved after every putt, so it can be continued from the menu
    if (this.state === 'moving' && this.r) { this.r.ball = [this.ball.fromX, this.ball.fromY]; save.set('round', this.r); }
    go(this, 'Menu');
  }

  /** First-time lesson: a ghost finger pulls back from the ball. */
  coach() {
    if (save.get('coached') || this.r.strokes > 0 || this.coachHand) return;
    const c = this.add.container(0, 0).setDepth(70);
    const ring = this.add.circle(0, 0, 9).setStrokeStyle(3, hex(PALETTE.gold));
    const dot = this.add.circle(0, 0, 4, hex(PALETTE.gold));
    const line = this.add.graphics();
    const label = text(this, WIDTH / 2, BOTTOM - 26, 'Put your finger on the ball,\npull back, then let go', { color: PALETTE.gold }).setDepth(71);
    const bg = this.add.rectangle(WIDTH / 2, BOTTOM - 26, 300, label.height + 10, hex(PALETTE.ink), 0.8).setDepth(70);
    c.add([line, ring, dot]);
    const st = { k: 0 };
    const tw = this.tweens.add({
      targets: st, k: 1, duration: 1600, repeat: -1, repeatDelay: 300, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const bs = this.toScreen(this.ball.x, this.ball.y);
        const pull = Math.min(st.k * 1.4, 1) * 80;
        ring.setPosition(bs.x, bs.y + pull); dot.setPosition(bs.x, bs.y + pull);
        line.clear();
        if (pull > 4) {
          line.lineStyle(2, hex(PALETTE.cream), 0.6).lineBetween(bs.x, bs.y, bs.x, bs.y + pull);
          for (let d = 10; d < pull * 1.2; d += 10) line.fillStyle(0xffffff, 0.8).fillCircle(bs.x, bs.y - d * this.cam.s, 2);
        }
        c.setAlpha(st.k > 0.85 ? (1 - st.k) / 0.15 : 1);
      },
    });
    this.coachHand = { destroy: () => { tw.remove(); c.destroy(); label.destroy(); bg.destroy(); } };
  }
}

// ------------------------------------------------------------------ helpers

/** The polygon grown outwards by d (mitred corners). */
function offsetPoly(pts, d) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
  const sgn = area > 0 ? 1 : -1;
  const n = pts.length;
  const normal = (a, b) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; return [(dy / l) * sgn, (-dx / l) * sgn]; };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i - 1 + n) % n], p); const n2 = normal(p, pts[(i + 1) % n]);
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [p[0] + ((n1[0] + n2[0]) / k) * d, p[1] + ((n1[1] + n2[1]) / k) * d];
  });
}

function scan(poly, y) {
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]; const [x2, y2] = poly[(i + 1) % poly.length];
    if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  return xs.sort((a, b) => a - b);
}

function boxOf(pts) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - dx * u, py - ay - dy * u);
}

const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

