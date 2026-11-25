import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { sfx } from '../../../shared/core/sfx.js';
import { Match, PHASE } from '../logic/match.js';
import {
  W, L, GOAL_W, BOX_W, BOX_D, SIX_W, SIX_D, CIRCLE_R, PEN_D, DT,
} from '../logic/constants.js';
import { teamById, keeperKits } from '../logic/teams.js';
import { kitTexture, dirIndex, ANIM } from '../sprites.js';
import { markStarted } from '../flow.js';
import { OX, OY, toScreen, dirToScreen, goalScreenX } from '../logic/view.js';
import { sound } from '../sound.js';
import { earn } from '../trophies.js';

// Landscape: the pitch runs horizontally (see logic/view.js for the mapping). World pixels are
// drawn at 2x, so the camera sees 320x180 of the 512x312 world.
export { OX, OY };
const WORLD_W = L + OX * 2;
const WORLD_H = W + OY * 2;
const ZOOM = 2;
const HUD_H = 22;   // the scoreboard bar covers this many world pixels at the top
const CORNER_SLACK = 48;
// Screen areas (640x360) taken by the thumb controls; the camera keeps the ball out of them.
const KEEP_OUT = [
  { x0: 466, y0: 214, x1: 640, y1: 360 },   // Shoot / Pass
  { x0: 0, y0: 232, x1: 172, y1: 360 },     // stick ghost
];

/** The match itself: pitch, players and ball. Controls and scoreboard live in the Hud scene. */
export class MatchScene extends Phaser.Scene {
  constructor() { super('MatchScene'); }

  init(data) {
    this.data0 = data;
    this.home = teamById(data.home);
    this.away = teamById(data.away);
    this.match = new Match({
      skills: [0.5, data.skill ?? 0.5],
      humanSide: 0,
      halfSeconds: data.half ?? 90,
      seed: (Math.random() * 1e9) | 0,
    });
    this.acc = 0;
    this.paused = false;
    this.finished = false;
  }

  create() {
    document.body.style.background = '#3c8a2c';
    const cam = this.cameras.main;
    cam.setBackgroundColor('#4aa33a');
    cam.setZoom(ZOOM);
    // Room above the top touchline for the scoreboard bar, and below the bottom one so play
    // there can rise clear of the thumb controls in the corners.
    // Extra slack past the corners lets the camera lift play there clear of the thumb controls.
    cam.setBounds(-CORNER_SLACK, OY - HUD_H - 8, WORLD_W + CORNER_SLACK * 2, W + HUD_H + 8 + 34 + CORNER_SLACK);
    cam.roundPixels = true;
    cam.fadeIn(200);

    this.drawPitch();
    this.makePlayers();
    this.ballShadow = this.add.ellipse(0, 0, 5, 2, 0x000000, 0.35).setDepth(1);
    this.ball = this.add.image(0, 0, 'ball').setDepth(2);
    this.marker = this.add.graphics().setDepth(100000);
    this.camPos = { x: OX + L / 2, y: OY + W / 2 };
    cam.centerOn(this.camPos.x, this.camPos.y);

    markStarted(this.data0);
    this.scene.launch('Hud', { matchScene: this });
    this.hud = this.scene.get('Hud');
    window.__soccer = this;
    this.sync(0);
  }

  // ------------------------------------------------------------------ drawing the pitch

  drawPitch() {
    // Grass covers the run-off too; tile scale 1 keeps the art's own pixels.
    this.add.tileSprite(-80, -40, WORLD_W + 160, WORLD_H + 160, 'grassTile').setOrigin(0).setDepth(-100);
    const g = this.add.graphics().setDepth(-90);
    // Markings are described in pitch coordinates (x across, y along) and rotated onto the screen.
    const line = (x, y, w, h) => {
      const a = toScreen(x, y + h);
      g.fillStyle(0xffffff).fillRect(a.x, a.y, h, w);
    };
    line(0, 0, W + 1, 1); line(0, L, W + 1, 1); line(0, 0, 1, L + 1); line(W, 0, 1, L + 1);
    line(0, L / 2, W, 1);
    for (const near of [true, false]) {
      const y0 = near ? 0 : L;
      const s = near ? 1 : -1;
      const box = (w, d) => {
        const x = W / 2 - w / 2;
        const y = near ? y0 : y0 - d;
        line(x, y, 1, d); line(x + w, y, 1, d);
        line(x, near ? y0 + d : y0 - d, w + 1, 1);
      };
      box(BOX_W, BOX_D);
      box(SIX_W, SIX_D);
      line(W / 2, y0 + s * PEN_D, 1, 1);
      // The D outside the box, and the corner arcs.
      this.pixelArc(g, W / 2, y0 + s * PEN_D, 22, (x, y) => (near ? y > BOX_D : y < L - BOX_D));
      for (const cx of [0, W]) this.pixelArc(g, cx, y0, 4, (x, y) => x >= 0 && x <= W && y >= 0 && y <= L);
    }
    this.pixelArc(g, W / 2, L / 2, CIRCLE_R, () => true);
    const c = toScreen(W / 2, L / 2);
    g.fillStyle(0xffffff).fillRect(c.x - 1, c.y - 1, 2, 2);

    // Goals cut from the field art, turned on their side: nets point away from the pitch.
    this.add.image(goalScreenX(0) - 1, OY + W / 2, 'goalTop').setOrigin(0.5, 1).setAngle(90).setDepth(-50);
    this.add.image(goalScreenX(L) + 1, OY + W / 2, 'goalTop').setOrigin(0.5, 1).setAngle(-90).setDepth(-50);
  }

  /** Crisp 1-pixel circle round a pitch point (only the pixels whose pitch spot passes keep()). */
  pixelArc(g, cx, cy, r, keep) {
    g.fillStyle(0xffffff);
    const seen = new Set();
    const steps = Math.ceil(r * 8);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r;
      if (!keep(x, y)) continue;
      const sp = toScreen(x, y);
      const px = Math.round(sp.x); const py = Math.round(sp.y);
      const k = `${px},${py}`;
      if (seen.has(k)) continue;
      seen.add(k);
      g.fillRect(px, py, 1, 1);
    }
  }

  makePlayers() {
    const [gk0, gk1] = keeperKits(this.home, this.away);
    const kits = [this.home, this.away];
    this.sprites = this.match.players.map((p) => {
      const team = kits[p.side];
      const skin = (p.id * 3 + (p.side ? 2 : 0)) % 5;
      const shirt = p.role === 'GK' ? (p.side === 0 ? gk0 : gk1) : team.shirt;
      const shorts = p.role === 'GK' ? '#1c1618' : team.shorts;
      const key = kitTexture(this, shirt, shorts, skin);
      const shadow = this.add.ellipse(0, 0, 9, 3, 0x000000, 0.3).setDepth(0);
      const img = this.add.image(0, 0, key, '0_1').setOrigin(0.5, 14 / 16);
      return { p, img, shadow };
    });
  }

  // ------------------------------------------------------------------ loop

  update(_, deltaMs) {
    if (this.paused) return;
    const m = this.match;
    this.acc += Math.min(deltaMs / 1000, 0.1);
    let steps = 0;
    while (this.acc >= DT && steps < 6) {
      m.step(DT, this.hud?.readInput?.() || null);
      this.acc -= DT;
      steps++;
      this.handleEvents();
      if (m.phase === PHASE.OVER) break;
    }
    this.sync(deltaMs / 1000);
    if (m.phase === PHASE.OVER && !this.finished) {
      this.finished = true;
      this.time.delayedCall(900, () => this.hud.showFullTime());
    }
  }

  handleEvents() {
    const m = this.match;
    for (const e of m.events) {
      switch (e.type) {
        case 'pass': case 'throw': case 'cross': sound('pass'); break;
        case 'shot': case 'header': sound('shot'); break;
        case 'tackle': case 'steal': sfx('capture'); break;
        case 'slide': sfx('flip'); break;
        case 'post': case 'bar': sfx('hit'); this.cameras.main.shake(120, 0.004); this.hud.toast(e.type === 'post' ? 'Off the post!' : 'Off the bar!'); break;
        case 'save': sfx('thud'); this.hud.toast(e.caught ? 'Great save!' : 'Saved!'); break;
        case 'block': sound('touch'); break;
        case 'hurdle': sfx('flip'); break;
        case 'goal': this.onGoal(e); break;
        case 'whistle':
          if (e.kind === 'kickoff') sound('whistle');
          if (e.kind === 'half') { sound('whistleLong'); this.hud.banner('HALF TIME'); }
          if (e.kind === 'full') { sound('whistleFull'); this.hud.banner('FULL TIME'); }
          break;
        case 'ends': this.hud.banner('SECOND HALF', PALETTE.gold, this.match.ends[0] === 1 ? 'Ends swapped: you now attack LEFT' : 'Ends swapped: you now attack RIGHT'); break;
        case 'throwin': sound('whistle'); this.hud.toast(e.side === 0 ? 'Your throw-in' : 'Their throw-in'); break;
        case 'corner': sound('whistle'); this.hud.toast(e.side === 0 ? 'Corner to you' : 'Corner to them'); break;
        case 'goalkick': sound('whistle'); this.hud.toast('Goal kick'); break;
        case 'out': break;
        case 'switch': sfx('tap'); break;
        default: break;
      }
    }
    m.events.length = 0;
  }

  onGoal(e) {
    const mine = e.side === 0;
    if (mine) earn('first-goal');
    sfx(mine ? 'goal' : 'lose');
    this.cameras.main.shake(260, 0.008);
    this.cameras.main.flash(200, mine ? 255 : 160, mine ? 230 : 60, mine ? 120 : 60);
    this.hud.goal(e);
    this.confetti(mine ? this.home.shirt : this.away.shirt, e);
  }

  confetti(color, e) {
    const gy = this.match.ends[e.side] === 0 ? 0 : L;   // the goal line it went in at
    const gx = goalScreenX(gy);
    const inward = gy === 0 ? -1 : 1;                     // toward the pitch on screen
    for (let i = 0; i < 26; i++) {
      const c = i % 3 === 0 ? 0xffffff : hex(color);
      const r = this.add.rectangle(gx, OY + W / 2 + (Math.random() - 0.5) * GOAL_W, 2, 2, c).setDepth(99999);
      this.tweens.add({
        targets: r, x: gx + inward * (20 + Math.random() * 90), y: r.y + (Math.random() - 0.5) * 120,
        alpha: 0, duration: 900 + Math.random() * 700, ease: 'Cubic.easeOut', onComplete: () => r.destroy(),
      });
    }
  }

  // ------------------------------------------------------------------ syncing sprites

  sync(dt) {
    const m = this.match;
    const t = this.time.now / 1000;
    for (const s of this.sprites) {
      const p = s.p;
      const sp = toScreen(p.x, p.y);
      const x = Math.round(sp.x); const y = Math.round(sp.y);
      s.img.setPosition(x, y).setDepth(sp.y);
      s.shadow.setPosition(x, y + 0.5);
      s.img.setFrame(this.frameFor(p, t));
    }
    const b = m.ball;
    const bs = toScreen(b.x, b.y);
    const bx = bs.x; const by = bs.y;
    this.ball.setPosition(Math.round(bx), Math.round(by - b.z - 2)).setDepth(by + 0.5);
    this.ballShadow.setPosition(Math.round(bx), Math.round(by)).setVisible(true);

    // Gold arrow over the player you control, plus a ring at his feet.
    this.marker.clear();
    const a = m.active;
    if (a && m.phase !== PHASE.GOAL && m.phase !== PHASE.OVER) {
      const as = toScreen(a.x, a.y);
      const ax = Math.round(as.x); const ay = Math.round(as.y);
      const bob = Math.round(Math.sin(t * 8));
      this.marker.fillStyle(hex(PALETTE.ink)).fillTriangle(ax - 4, ay - 21 + bob, ax + 4, ay - 21 + bob, ax, ay - 16 + bob);
      this.marker.fillStyle(hex(PALETTE.gold)).fillTriangle(ax - 3, ay - 20 + bob, ax + 3, ay - 20 + bob, ax, ay - 17 + bob);
      this.marker.lineStyle(1, hex(PALETTE.gold), 0.9).strokeEllipse(ax, ay + 0.5, 12, 5);
      if (m.charging && m.charge > 0) {
        this.marker.fillStyle(hex(PALETTE.ink)).fillRect(ax - 9, ay - 27, 18, 4);
        const c = m.charge > 0.85 ? PALETTE.red : m.charge > 0.5 ? PALETTE.orange : PALETTE.gold;
        this.marker.fillStyle(hex(c)).fillRect(ax - 8, ay - 26, Math.round(16 * m.charge), 2);
      }
    }
    // Small marker on the teammate a pass is going to.
    if (b.intended && b.intended.side === 0) {
      const q = b.intended;
      const qs = toScreen(q.x, q.y);
      this.marker.lineStyle(1, 0xffffff, 0.6).strokeEllipse(Math.round(qs.x), Math.round(qs.y) + 0.5, 10, 4);
    }
    this.followCamera(dt);
  }

  frameFor(p, t) {
    const m = this.match;
    const f = dirToScreen(p.fx, p.fy);
    const d = dirIndex(f.x, f.y);
    const loop = (frames, fps, phase = 0) => frames[Math.floor((t + phase) * fps) % frames.length];
    const ph = p.id * 0.13;
    let col;
    if (p.celebrate && m.phase === PHASE.GOAL) col = loop(ANIM.jump, 8, ph);
    else if (p.dejected && m.phase === PHASE.GOAL) return `0_${loop(ANIM.ohno, 5, ph)}`;
    else if (p.stunT > 0 && p.tackleCool > 0 && !p.won && p.role !== 'GK') { const sl = dirToScreen(p.slideX, p.slideY); return `${dirIndex(sl.x, sl.y)}_${ANIM.tackle[3]}`; }
    else if (p.stunT > 0) return `0_${ANIM.damage[Math.min(3, Math.floor((0.7 - p.stunT) * 8))] || 21}`;
    else if (p.diveT > 0) return `${p.diveVx > 0 ? 0 : 4}_${ANIM.tackle[Math.min(3, Math.floor((0.45 - p.diveT) * 10))]}`;
    else if (p.tackleT > 0) col = ANIM.tackle[Math.min(3, Math.floor((0.32 - p.tackleT) * 13))];
    else if (p.role === 'GK' && m.ball.owner === p && m.ball.held) col = ANIM.catch[2];
    else if (p.kickT > 0) col = ANIM.kick[Math.min(3, Math.floor((0.25 - p.kickT) * 16))];
    else {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 38) col = loop(ANIM.run, 11, ph);
      else if (sp > 6) col = loop(ANIM.walk, 9, ph);
      else if (p.role === 'GK' && Math.hypot(m.ball.x - p.x, m.ball.y - p.y) < 50) col = ANIM.gate[0];
      else col = ANIM.idle[0];
    }
    return `${d}_${col}`;
  }

  followCamera(dt) {
    const m = this.match;
    const b = m.ball;
    const cam = this.cameras.main;
    const bs = toScreen(b.x, b.y);
    const v = dirToScreen(b.vx, b.vy);
    // Look ahead along the pitch: where the ball is heading, and further toward the goal your
    // team is attacking while you have it. The bounds stop the camera at either goal.
    const ours = b.owner && b.owner.side === 0;
    const attackX = m.ends[0] === 0 ? 1 : -1;            // you attack right in the first half
    let tx = bs.x + v.x * 0.22 + (ours ? attackX * 28 : 0);
    // Across the pitch, lean toward the middle so both touchlines stay in view, and sit the ball a
    // touch above centre: the stick and buttons live in the bottom corners.
    // Corners lean further toward the middle so the goal mouth is in shot with the taker.
    const corner = m.sp && m.sp.type === 'corner' && (m.phase === PHASE.SETUP || m.phase === PHASE.TAKING);
    let ty = OY + W / 2 + (bs.y - OY - W / 2) * (corner ? 0.45 : 0.8) + v.y * 0.12 + 6;
    if (m.phase === PHASE.GOAL) { tx = bs.x + (b.y < L / 2 ? -60 : 60); ty = bs.y; }
    // Where would the ball land on screen? Keep it out from under the thumb controls: slide the
    // view sideways first (so the goal stays in shot), and lift it only if that isn't enough.
    const bnd = cam.getBounds();
    const clampX = (x) => Math.max(bnd.x + 160, Math.min(bnd.right - 160, x));
    const clampY = (y) => Math.max(bnd.y + 90, Math.min(bnd.bottom - 90, y));
    tx = clampX(tx); ty = clampY(ty);
    for (const k of KEEP_OUT) {
      let sx = (bs.x - (tx - 160)) * ZOOM; const sy = (bs.y - b.z - (ty - 90)) * ZOOM;
      if (!(sx > k.x0 && sx < k.x1 && sy > k.y0 && sy < k.y1)) continue;
      tx = clampX(tx + (k.x0 > 0 ? (sx - k.x0 + 16) : -(k.x1 - sx + 16)) / ZOOM);
      sx = (bs.x - (tx - 160)) * ZOOM;
      if (sx > k.x0 && sx < k.x1) ty = clampY(ty + (sy - k.y0 + 12) / ZOOM);
    }
    const k = dt > 0 ? Math.min(1, dt * 5) : 1;
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    cam.centerOn(Math.round(this.camPos.x), Math.round(this.camPos.y));
  }
}
