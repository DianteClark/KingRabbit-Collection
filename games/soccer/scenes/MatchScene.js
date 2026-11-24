import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { sfx } from '../../../shared/core/sfx.js';
import { Match, PHASE } from '../logic/match.js';
import {
  W, L, GOAL_W, BOX_W, BOX_D, SIX_W, SIX_D, CIRCLE_R, PEN_D, DT,
} from '../logic/constants.js';
import { teamById, keeperKits } from '../logic/teams.js';
import { kitTexture, dirIndex, ANIM } from '../sprites.js';

// World layout: the pitch's (0, 0) corner sits at (OX, OY) in world pixels; the camera draws at 2x.
export const OX = 48;
export const OY = 72;
const WORLD_W = W + OX * 2;
const WORLD_H = L + OY * 2;
const ZOOM = 2;

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
    // Extra room at the bottom so play near your goal can sit above the thumb buttons.
    cam.setBounds(-8, 8, WORLD_W + 16, WORLD_H + 100);
    cam.roundPixels = true;
    cam.fadeIn(200);

    this.drawPitch();
    this.makePlayers();
    this.ballShadow = this.add.ellipse(0, 0, 5, 2, 0x000000, 0.35).setDepth(1);
    this.ball = this.add.image(0, 0, 'ball').setDepth(2);
    this.marker = this.add.graphics().setDepth(100000);
    this.camPos = { x: OX + W / 2, y: OY + L / 2 };
    cam.centerOn(this.camPos.x, this.camPos.y);

    this.scene.launch('Hud', { matchScene: this });
    this.hud = this.scene.get('Hud');
    window.__soccer = this;
    this.sync(0);
  }

  // ------------------------------------------------------------------ drawing the pitch

  drawPitch() {
    // Grass covers the run-off too; tile scale 1 keeps the art's own pixels.
    this.add.tileSprite(-40, -40, WORLD_W + 80, WORLD_H + 160, 'grassTile').setOrigin(0).setDepth(-100);
    const g = this.add.graphics().setDepth(-90);
    const white = 0xffffff;
    const line = (x, y, w, h) => g.fillStyle(white).fillRect(OX + x, OY + y, w, h);
    // Touchlines and goal lines
    line(0, 0, W, 1); line(0, L, W + 1, 1); line(0, 0, 1, L); line(W, 0, 1, L);
    line(0, L / 2, W, 1);
    // Boxes
    for (const top of [true, false]) {
      const y0 = top ? 0 : L;
      const s = top ? 1 : -1;
      const box = (w, d) => {
        const x = W / 2 - w / 2;
        const y = top ? y0 : y0 - d;
        line(x, y, 1, d); line(x + w, y, 1, d);
        line(x, top ? y0 + d : y0 - d, w + 1, 1);
      };
      box(BOX_W, BOX_D);
      box(SIX_W, SIX_D);
      // Penalty spot
      line(W / 2, y0 + s * PEN_D, 1, 1);
      // The D: arc of radius 22 round the spot, outside the box only
      this.pixelArc(g, OX + W / 2, OY + y0 + s * PEN_D, 22, (px, py) => (top ? py > OY + BOX_D : py < OY + L - BOX_D));
      // Corner arcs
      for (const cx of [0, W]) this.pixelArc(g, OX + cx, OY + y0, 4, (px, py) => px >= OX && px <= OX + W && py >= OY && py <= OY + L);
    }
    // Centre circle and spot
    this.pixelArc(g, OX + W / 2, OY + L / 2, CIRCLE_R, () => true);
    g.fillStyle(white).fillRect(OX + W / 2 - 1, OY + L / 2 - 1, 2, 2);

    // Goals cut from the field art (rebuilt at our goal width). Both sit behind the players so
    // the keepers stay readable in front of their nets.
    this.add.image(OX + W / 2, OY + 1, 'goalTop').setOrigin(0.5, 1).setDepth(OY - 40);
    this.add.image(OX + W / 2, OY + L - 15, 'goalBottom').setOrigin(0.5, 0).setDepth(OY - 40);
  }

  /** Crisp 1-pixel circle (only the pixels that pass keep()). */
  pixelArc(g, cx, cy, r, keep) {
    g.fillStyle(0xffffff);
    const seen = new Set();
    const steps = Math.ceil(r * 8);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(a) * r); const py = Math.round(cy + Math.sin(a) * r);
      const k = `${px},${py}`;
      if (seen.has(k) || !keep(px, py)) continue;
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
        case 'pass': case 'throw': case 'cross': sfx('move'); break;
        case 'shot': case 'header': sfx('shoot'); break;
        case 'tackle': case 'steal': sfx('capture'); break;
        case 'slide': sfx('flip'); break;
        case 'post': case 'bar': sfx('hit'); this.cameras.main.shake(120, 0.004); this.hud.toast(e.type === 'post' ? 'Off the post!' : 'Off the bar!'); break;
        case 'save': sfx('thud'); this.hud.toast(e.caught ? 'Great save!' : 'Saved!'); break;
        case 'block': sfx('bounce'); break;
        case 'hurdle': sfx('flip'); break;
        case 'goal': this.onGoal(e); break;
        case 'whistle': sfx(e.kind === 'kickoff' ? 'select' : 'power'); if (e.kind === 'half') this.hud.banner('HALF TIME'); if (e.kind === 'full') this.hud.banner('FULL TIME'); break;
        case 'throwin': this.hud.toast(e.side === 0 ? 'Your throw-in' : 'Their throw-in'); break;
        case 'corner': this.hud.toast(e.side === 0 ? 'Corner to you' : 'Corner to them'); break;
        case 'goalkick': this.hud.toast('Goal kick'); break;
        case 'out': sfx('tap'); break;
        case 'switch': sfx('tap'); break;
        default: break;
      }
    }
    m.events.length = 0;
  }

  onGoal(e) {
    const mine = e.side === 0;
    sfx(mine ? 'goal' : 'lose');
    this.cameras.main.shake(260, 0.008);
    this.cameras.main.flash(200, mine ? 255 : 160, mine ? 230 : 60, mine ? 120 : 60);
    this.hud.goal(e);
    this.confetti(mine ? this.home.shirt : this.away.shirt, e);
  }

  confetti(color, e) {
    const top = this.match.ends[e.side] === 0;   // scored in the top goal
    const gy = top ? OY : OY + L;
    for (let i = 0; i < 26; i++) {
      const c = i % 3 === 0 ? 0xffffff : hex(color);
      const r = this.add.rectangle(OX + W / 2 + (Math.random() - 0.5) * GOAL_W, gy, 2, 2, c).setDepth(99999);
      this.tweens.add({
        targets: r, x: r.x + (Math.random() - 0.5) * 120, y: gy + (top ? 1 : -1) * (20 + Math.random() * 90),
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
      const x = Math.round(OX + p.x); const y = Math.round(OY + p.y);
      s.img.setPosition(x, y).setDepth(OY + p.y);
      s.shadow.setPosition(x, y + 0.5);
      s.img.setFrame(this.frameFor(p, t));
    }
    const b = m.ball;
    const bx = OX + b.x; const by = OY + b.y;
    this.ball.setPosition(Math.round(bx), Math.round(by - b.z - 2)).setDepth(OY + b.y + 0.5);
    this.ballShadow.setPosition(Math.round(bx), Math.round(by)).setVisible(true);

    // Gold arrow over the player you control, plus a ring at his feet.
    this.marker.clear();
    const a = m.active;
    if (a && m.phase !== PHASE.GOAL && m.phase !== PHASE.OVER) {
      const ax = Math.round(OX + a.x); const ay = Math.round(OY + a.y);
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
      this.marker.lineStyle(1, 0xffffff, 0.6).strokeEllipse(Math.round(OX + q.x), Math.round(OY + q.y) + 0.5, 10, 4);
    }
    this.followCamera(dt);
  }

  frameFor(p, t) {
    const m = this.match;
    const d = dirIndex(p.fx, p.fy);
    const loop = (frames, fps, phase = 0) => frames[Math.floor((t + phase) * fps) % frames.length];
    const ph = p.id * 0.13;
    let col;
    if (p.celebrate && m.phase === PHASE.GOAL) col = loop(ANIM.jump, 8, ph);
    else if (p.dejected && m.phase === PHASE.GOAL) return `0_${loop(ANIM.ohno, 5, ph)}`;
    else if (p.stunT > 0 && p.tackleCool > 0 && !p.won && p.role !== 'GK') return `${dirIndex(p.slideX, p.slideY)}_${ANIM.tackle[3]}`;
    else if (p.stunT > 0) return `0_${ANIM.damage[Math.min(3, Math.floor((0.7 - p.stunT) * 8))] || 21}`;
    else if (p.diveT > 0) return `${p.diveVx > 0 ? 2 : 6}_${ANIM.tackle[Math.min(3, Math.floor((0.45 - p.diveT) * 10))]}`;
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
    // Lead the ball a little and keep it above the thumb controls.
    // Near the top goal look further up so the goal clears the scoreboard.
    const up = Math.max(0, Math.min(1, (L * 0.45 - b.y) / (L * 0.35)));
    let tx = OX + W / 2 + (b.x - W / 2) * 0.75 + b.vx * 0.12;
    // Mirror for the bottom goal (you attack it after half time): lift play clear of the buttons.
    const down = Math.max(0, Math.min(1, (b.y - L * 0.6) / (L * 0.3)));
    let ty = OY + b.y + b.vy * 0.2 + 18 - up * 52 + down * 40;
    if (m.phase === PHASE.GOAL) { tx = OX + b.x; ty = OY + b.y + (b.y < L / 2 ? 50 : -30); }
    const k = dt > 0 ? Math.min(1, dt * 5) : 1;
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    cam.centerOn(Math.round(this.camPos.x), Math.round(this.camPos.y));
  }
}
