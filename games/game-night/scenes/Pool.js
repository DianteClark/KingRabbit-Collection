import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';

// Portrait table. Simplified 8-ball: first ball potted sets your group (solids 1-7 or stripes 9-15),
// pot your group then the 8. Potting the cue ball or hitting nothing is a foul (turn passes, cue respotted).
const T = { x: 52, y: 146, w: 256, h: 420 };
const R = 8;
const POCKET_R = 14;
const POCKETS = [
  [T.x, T.y], [T.x + T.w, T.y], [T.x - 3, T.y + T.h / 2], [T.x + T.w + 3, T.y + T.h / 2], [T.x, T.y + T.h], [T.x + T.w, T.y + T.h],
];
const HEAD = { x: WIDTH / 2, y: T.y + T.h * 0.78 };
const FOOT = { x: WIDTH / 2, y: T.y + T.h * 0.3 };
const MAX_SHOT = 900;
const groupOf = (n) => (n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solids' : 'stripes');

export class Pool extends Phaser.Scene {
  constructor() { super('Pool'); }

  init(data) { this.mode = data.mode ?? 'cpu'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Pool', () => go(this, 'Menu'));
    this.info = [text(this, 96, 78, '', { color: PALETTE.cream }), text(this, WIDTH - 96, 78, '', { color: PALETTE.cream })];
    this.status = text(this, WIDTH / 2, 112, '', { color: PALETTE.gold });
    this.drawTable();
    this.aimG = this.add.graphics().setDepth(8);
    this.ballLayer = this.add.container(0, 0).setDepth(5);
    text(this, WIDTH / 2, T.y + T.h + 44, 'Drag back from the cue ball, release to shoot', { color: PALETTE.lavender });

    this.input.on('pointerdown', (p) => this.aimStart(p));
    this.input.on('pointermove', (p) => this.aimMove(p));
    this.input.on('pointerup', (p) => this.aimEnd(p));
    this.newRack();
  }

  drawTable() {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(T.x - 22, T.y - 22, T.w + 44, T.h + 44);
    g.fillStyle(hex(PALETTE.orange)).fillRect(T.x - 18, T.y - 18, T.w + 36, T.h + 36);
    g.fillStyle(hex(PALETTE.wine)).fillRect(T.x - 12, T.y - 12, T.w + 24, T.h + 24);
    g.fillStyle(hex(PALETTE.leaf)).fillRect(T.x, T.y, T.w, T.h);
    g.fillStyle(hex(PALETTE.ink), 0.25).fillRect(T.x, HEAD.y, T.w, 2);
    g.fillStyle(hex(PALETTE.cream), 0.5).fillRect(FOOT.x - 2, FOOT.y - 2, 4, 4);
    for (const [x, y] of POCKETS) {
      g.fillStyle(hex(PALETTE.ink)).fillCircle(x, y, POCKET_R);
      g.lineStyle(2, hex(PALETTE.indigo)).strokeCircle(x, y, POCKET_R);
    }
  }

  newRack() {
    // Rack the triangle with the 8 in the middle of the third row.
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    const rest = Phaser.Utils.Array.Shuffle(order.filter((n) => n !== 8 && n !== 1 && n !== 9));
    const seq = [1, rest[0], rest[1], rest[2], 8, rest[3], rest[4], rest[5], rest[6], rest[7], 9, rest[8], rest[9], rest[10], rest[11]];
    this.balls = [{ n: 0, x: HEAD.x, y: HEAD.y, vx: 0, vy: 0, in: false }];
    let k = 0;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        this.balls.push({ n: seq[k++], x: FOOT.x + (i - row / 2) * (R * 2 + 0.5), y: FOOT.y - row * (R * 1.74 + 0.5), vx: 0, vy: 0, in: false });
      }
    }
    this.turn = 0;
    this.groups = [null, null];
    this.over = false;
    this.moving = false;
    this.redraw();
    this.startTurn();
  }

  name(p) { return this.mode === 'pvp' ? `Player ${p + 1}` : p === 0 ? 'You' : 'CPU'; }
  isCpu() { return this.mode === 'cpu' && this.turn === 1; }
  cue() { return this.balls[0]; }

  remaining(p) {
    const g = this.groups[p];
    if (!g) return 7;
    return this.balls.filter((b) => !b.in && groupOf(b.n) === g).length;
  }

  redraw() {
    this.ballLayer.removeAll(true);
    for (const b of this.balls) {
      if (b.in) continue;
      this.ballLayer.add(this.add.image(Math.round(b.x), Math.round(b.y), 'pool', `b${b.n}`).setScale(2));
    }
    [0, 1].forEach((p) => {
      const g = this.groups[p];
      this.info[p].setText(`${this.name(p)}${this.turn === p ? ' <' : ''}\n${g ? `${g} ${this.remaining(p)}` : 'open table'}`);
      this.info[p].setColor(this.turn === p ? PALETTE.gold : PALETTE.cream);
    });
  }

  startTurn() {
    this.potted = [];
    this.firstHit = null;
    this.status.setText(this.isCpu() ? 'CPU is lining up...' : `${this.name(this.turn)} to shoot`);
    this.redraw();
    if (this.isCpu()) this.time.delayedCall(900, () => this.cpuShoot());
  }

  // ---------- aiming ----------
  aimStart(p) {
    if (this.over || this.moving || this.isCpu()) return;
    this.aiming = { x: p.x, y: p.y };
  }

  aimMove(p) {
    if (!this.aiming) return;
    this.aiming = { x: p.x, y: p.y };
    this.drawAim();
  }

  shotFromAim() {
    const c = this.cue();
    const dx = c.x - this.aiming.x; const dy = c.y - this.aiming.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return null;
    return { dir: { x: dx / d, y: dy / d }, power: Math.min(1, d / 160) };
  }

  drawAim() {
    this.aimG.clear();
    const shot = this.shotFromAim();
    if (!shot) return;
    const c = this.cue();
    // Guide line to the first ball the cue would touch.
    let end = 600; let hit = null;
    for (const b of this.balls) {
      if (b.in || b.n === 0) continue;
      const t = rayCircle(c, shot.dir, b, R * 2);
      if (t !== null && t < end) { end = t; hit = b; }
    }
    end = Math.min(end, wallDistance(c, shot.dir));
    this.aimG.lineStyle(2, hex(PALETTE.cream), 0.85);
    for (let s = 0; s < end; s += 10) {
      this.aimG.lineBetween(c.x + shot.dir.x * s, c.y + shot.dir.y * s, c.x + shot.dir.x * Math.min(end, s + 5), c.y + shot.dir.y * Math.min(end, s + 5));
    }
    if (hit) this.aimG.strokeCircle(c.x + shot.dir.x * end, c.y + shot.dir.y * end, R);
    // Cue stick behind the ball + power bar.
    const back = 14 + shot.power * 50;
    this.aimG.lineStyle(4, hex(PALETTE.sand)).lineBetween(c.x - shot.dir.x * back, c.y - shot.dir.y * back, c.x - shot.dir.x * (back + 110), c.y - shot.dir.y * (back + 110));
    this.aimG.fillStyle(hex(PALETTE.ink)).fillRect(T.x, T.y + T.h + 18, T.w, 8);
    this.aimG.fillStyle(hex(shot.power > 0.75 ? PALETTE.red : PALETTE.gold)).fillRect(T.x, T.y + T.h + 18, T.w * shot.power, 8);
  }

  aimEnd() {
    if (!this.aiming) return;
    const shot = this.shotFromAim();
    this.aiming = null;
    this.aimG.clear();
    if (!shot || shot.power < 0.06) return;
    this.shoot(shot.dir, shot.power);
  }

  shoot(dir, power) {
    const c = this.cue();
    c.vx = dir.x * power * MAX_SHOT; c.vy = dir.y * power * MAX_SHOT;
    this.moving = true;
    this.status.setText('');
  }

  // ---------- physics ----------
  update(_, ms) {
    if (!this.moving) return;
    const dt = Math.min(ms / 1000, 1 / 30);
    const steps = 8;
    for (let s = 0; s < steps; s++) this.step(dt / steps);
    for (const b of this.balls) {
      const sp = Math.hypot(b.vx, b.vy);
      const ns = Math.max(0, sp * Math.pow(0.62, dt) - 28 * dt);
      if (sp > 0) { b.vx *= ns / sp; b.vy *= ns / sp; }
    }
    this.redraw();
    if (this.balls.every((b) => b.in || Math.hypot(b.vx, b.vy) < 3)) {
      this.balls.forEach((b) => { b.vx = 0; b.vy = 0; });
      this.moving = false;
      this.resolveShot();
    }
  }

  step(h) {
    const live = this.balls.filter((b) => !b.in);
    for (const b of live) {
      b.x += b.vx * h; b.y += b.vy * h;
      for (const [px, py] of POCKETS) {
        if (Math.hypot(b.x - px, b.y - py) < POCKET_R - 2) { b.in = true; b.vx = 0; b.vy = 0; this.potted.push(b.n); break; }
      }
      if (b.in) continue;
      if (b.x < T.x + R) { b.x = T.x + R; b.vx = Math.abs(b.vx) * 0.82; }
      if (b.x > T.x + T.w - R) { b.x = T.x + T.w - R; b.vx = -Math.abs(b.vx) * 0.82; }
      if (b.y < T.y + R) { b.y = T.y + R; b.vy = Math.abs(b.vy) * 0.82; }
      if (b.y > T.y + T.h - R) { b.y = T.y + T.h - R; b.vy = -Math.abs(b.vy) * 0.82; }
    }
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]; const c = live[j];
        if (a.in || c.in) continue;
        const dx = c.x - a.x; const dy = c.y - a.y; const d = Math.hypot(dx, dy);
        if (d >= R * 2 || d === 0) continue;
        const nx = dx / d; const ny = dy / d;
        const ov = (R * 2 - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (rel <= 0) continue;
        a.vx -= rel * nx * 0.97; a.vy -= rel * ny * 0.97;
        c.vx += rel * nx * 0.97; c.vy += rel * ny * 0.97;
        if (this.firstHit === null) {
          if (a.n === 0) this.firstHit = c.n; else if (c.n === 0) this.firstHit = a.n;
        }
      }
    }
  }

  // ---------- rules ----------
  resolveShot() {
    const me = this.turn; const opp = 1 - me;
    const scratch = this.potted.includes(0);
    const noHit = this.firstHit === null;
    const myGroupBefore = this.groups[me];
    // Hitting the wrong group first is also a foul once groups are set.
    const wrongFirst = myGroupBefore && this.firstHit !== null
      && groupOf(this.firstHit) !== myGroupBefore && !(groupOf(this.firstHit) === 'eight' && this.remaining(me) === 0);
    const foul = scratch || noHit || wrongFirst;

    if (this.potted.includes(8)) {
      const cleared = myGroupBefore && this.remaining(me) === 0;
      this.finish(cleared && !scratch ? me : opp, cleared && !scratch ? 'Sank the 8 ball!' : 'The 8 went down early');
      return;
    }
    // Assign groups on the first clean pot.
    if (!myGroupBefore && !foul) {
      const first = this.potted.find((n) => n !== 0);
      if (first) {
        this.groups[me] = groupOf(first);
        this.groups[opp] = this.groups[me] === 'solids' ? 'stripes' : 'solids';
        toast(this, `${this.name(me)}: ${this.groups[me]}`, 360);
      }
    }
    if (scratch) {
      const c = this.cue();
      c.in = false; c.x = HEAD.x; c.y = HEAD.y;
      // Nudge it if something is sitting on the spot.
      while (this.balls.some((b) => b !== c && !b.in && Math.hypot(b.x - c.x, b.y - c.y) < R * 2.2)) c.x += R * 2.2;
    }
    const mine = this.potted.filter((n) => n !== 0 && (!this.groups[me] || groupOf(n) === this.groups[me]));
    if (foul) toast(this, scratch ? 'Scratch! Foul' : noHit ? 'No ball hit - foul' : 'Wrong ball first - foul', 360);
    if (!foul && mine.length) {
      this.startTurn(); // keep shooting
    } else {
      this.turn = opp;
      this.startTurn();
    }
  }

  finish(winner, why) {
    this.over = true;
    this.redraw();
    const title = this.mode === 'cpu' ? (winner === 0 ? 'You win!' : 'CPU wins') : `${this.name(winner)} wins!`;
    this.status.setText(title);
    endGame(this, { id: 'pool', mode: this.mode, title, lines: [why], outcome: winner === 0 ? 'w' : 'l', onAgain: () => this.newRack() });
  }

  // ---------- CPU ----------
  cpuShoot() {
    if (this.over) return;
    const c = this.cue();
    const g = this.groups[1];
    let targets = this.balls.filter((b) => !b.in && b.n !== 0 && b.n !== 8 && (!g || groupOf(b.n) === g));
    if (!targets.length) targets = this.balls.filter((b) => !b.in && b.n === 8);
    let best = null;
    for (const t of targets) {
      for (const [px, py] of POCKETS) {
        const tp = norm(px - t.x, py - t.y);
        const ghost = { x: t.x - tp.x * R * 2, y: t.y - tp.y * R * 2 };
        const cg = norm(ghost.x - c.x, ghost.y - c.y);
        const cut = Math.acos(Math.max(-1, Math.min(1, cg.x * tp.x + cg.y * tp.y)));
        if (cut > 1.2) continue;
        if (!this.clear(c, ghost, [t]) || !this.clear(t, { x: px, y: py }, [t])) continue;
        const dist = Math.hypot(ghost.x - c.x, ghost.y - c.y) + Math.hypot(px - t.x, py - t.y);
        const score = -cut * 220 - dist * 0.4;
        if (!best || score > best.score) best = { score, dir: cg, dist, cut };
      }
    }
    let dir; let power;
    if (best) {
      const err = (Math.random() - 0.5) * 0.035;
      dir = rotate(best.dir, err);
      power = Math.min(1, 0.32 + best.dist / 900 + best.cut * 0.2);
    } else {
      const t = targets.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      dir = norm(t.x - c.x, t.y - c.y);
      power = 0.55;
    }
    // Show the aim briefly, then shoot.
    this.aimG.clear().lineStyle(2, hex(PALETTE.cream), 0.7).lineBetween(c.x, c.y, c.x + dir.x * 120, c.y + dir.y * 120);
    this.time.delayedCall(500, () => { this.aimG.clear(); this.shoot(dir, power); });
  }

  clear(from, to, ignore) {
    const d = norm(to.x - from.x, to.y - from.y);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    for (const b of this.balls) {
      if (b.in || b === from || ignore.includes(b) || b.n === 0) continue;
      const t = rayCircle(from, d, b, R * 2);
      if (t !== null && t < len) return false;
    }
    return true;
  }
}

function norm(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
function rotate(v, a) { return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }; }

/** Distance along ray (from p, direction d) to touch circle (center c, radius r), or null. */
function rayCircle(p, d, c, r) {
  const fx = p.x - c.x; const fy = p.y - c.y;
  const b = fx * d.x + fy * d.y;
  const cc = fx * fx + fy * fy - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function wallDistance(p, d) {
  const ts = [];
  if (d.x > 0) ts.push((T.x + T.w - R - p.x) / d.x);
  if (d.x < 0) ts.push((T.x + R - p.x) / d.x);
  if (d.y > 0) ts.push((T.y + T.h - R - p.y) / d.y);
  if (d.y < 0) ts.push((T.y + R - p.y) / d.y);
  return Math.min(...ts);
}
