// The whole match simulation: players, ball physics, rules, restarts and the clock.
// Pure JavaScript (no Phaser) so it runs in node for the CPU-vs-CPU tests.
//
// Usage: const m = new Match({ skills: [0.5, 0.5], humanSide: 0 }); every frame call
// m.step(DT, input) where input = { mx, my, pass, shoot } (stick -1..1, buttons held).
// Read m.players, m.ball, m.score, m.phase, m.clock; drain m.events for sounds and messages.

import {
  W, L, MARGIN, GOAL_W, GOAL_D, BAR, POST_R, BALL_R, PLAYER_R, RUN, G, FRICTION, DT, ROLES,
  CIRCLE_R, attackDir, ownGoalY, oppGoalY, inBox, SIX_D,
} from './constants.js';
import { clamp, dist, norm, makeRng } from './util.js';
import {
  aiParams, teamThink, playerAI, keeperAI, ownerAI, takerAI, formationSpot,
  passOptions, passTo, passIntoSpace, shoot, ballPosAt, intercept as interceptPoint,
} from './ai.js';

export const TACKLE_T = 0.32;

export const PHASE = { SETUP: 'setup', TAKING: 'taking', PLAY: 'play', GOAL: 'goal', HALF: 'half', OVER: 'over' };

// Seconds of real time per half by match length setting.
export const LENGTHS = { short: 60, normal: 90, long: 150 };

export class Match {
  /**
   * @param {object} o
   * @param {number[]} [o.skills]   CPU skill 0..1 for each side (the human side's teammates use theirs too)
   * @param {0|1|null} [o.humanSide] which side the touch controls drive (null = CPU vs CPU)
   * @param {number} [o.halfSeconds]
   * @param {number} [o.seed]
   */
  constructor({ skills = [0.5, 0.5], humanSide = null, halfSeconds = 90, seed = 1 } = {}) {
    this.rng = makeRng(seed);
    this.params = [aiParams(skills[0]), aiParams(skills[1])];
    this.humanSide = humanSide;
    this.halfSeconds = halfSeconds;
    this.players = [];
    this.teams = [{ side: 0, players: [] }, { side: 1, players: [] }];
    let id = 0;
    for (const side of [0, 1]) {
      for (const role of ROLES) {
        const p = makePlayer(id++, side, role);
        this.players.push(p);
        this.teams[side].players.push(p);
      }
    }
    this.ball = { x: W / 2, y: L / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, lastTouch: null, intended: null, shotBy: null, inNet: false };
    this.score = [0, 0];
    this.half = 1;
    this.clock = 0;          // seconds played in this half
    this.time = 0;           // total simulated seconds
    this.events = [];
    this.stats = { shots: [0, 0], onTarget: [0, 0], passes: [0, 0], tackles: [0, 0], saves: [0, 0], restarts: {}, possession: [0, 0], nudges: 0 };
    this.active = null;      // the player the human controls
    this.charge = 0;         // shot power being built up by holding Shoot (0..1)
    this.charging = false;
    this.prevInput = { pass: false, shoot: false };
    this.buffer = null;      // one-touch action queued while a pass is on its way
    this.switchCool = 0;
    this.stillT = 0;
    this.firstKick = this.rng() < 0.5 ? 0 : 1;
    this.setPiece('kickoff', this.firstKick);
    if (humanSide !== null) this.active = this.teams[humanSide].players[4];
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  /** Display minute: each half is shown as 45 minutes. */
  get minute() {
    return Math.min(45, Math.floor((this.clock / this.halfSeconds) * 45)) + (this.half === 2 ? 45 : 0);
  }

  get winner() {
    if (this.score[0] === this.score[1]) return null;
    return this.score[0] > this.score[1] ? 0 : 1;
  }

  isHuman(p) { return this.humanSide !== null && p === this.active && p.side === this.humanSide; }

  // ---------------------------------------------------------------- main loop

  step(dt = DT, input = null) {
    if (this.phase === PHASE.OVER) return;
    this.time += dt;
    this.input = input || { mx: 0, my: 0, pass: false, shoot: false };
    const pressed = { pass: this.input.pass && !this.prevInput.pass, shoot: this.input.shoot && !this.prevInput.shoot, shootUp: !this.input.shoot && this.prevInput.shoot };
    this.prevInput = { pass: this.input.pass, shoot: this.input.shoot };

    for (const p of this.players) tickTimers(p, dt);
    if (this.switchCool > 0) this.switchCool -= dt;
    if (this.buffer && (this.buffer.t -= dt) <= 0) this.buffer = null;

    switch (this.phase) {
      case PHASE.SETUP: this.stepSetup(dt); break;
      case PHASE.TAKING: this.stepTaking(dt, pressed); break;
      case PHASE.PLAY: this.stepPlay(dt, pressed); break;
      case PHASE.GOAL: this.stepGoal(dt); break;
      case PHASE.HALF: this.stepHalf(dt); break;
      default: break;
    }
  }

  runClock(dt) {
    this.clock += dt;
    if (this.clock < this.halfSeconds) return false;
    this.clock = this.halfSeconds;
    if (this.half === 1) {
      this.phase = PHASE.HALF;
      this.phaseT = 2.2;
      this.ball.owner = null; this.ball.held = false;
      this.emit('whistle', { kind: 'half' });
    } else {
      this.phase = PHASE.OVER;
      this.ball.owner = null; this.ball.held = false;
      this.emit('whistle', { kind: 'full' });
    }
    return true;
  }

  stepPlay(dt, pressed) {
    if (this.runClock(dt)) return;
    const b = this.ball;
    if (b.owner) this.stats.possession[b.owner.side] += dt;

    teamThink(this, 0, dt);
    teamThink(this, 1, dt);
    if (this.humanSide !== null) this.chooseActive();

    for (const p of this.players) {
      if (this.isHuman(p)) this.humanControl(p, dt, pressed);
      else if (p.role === 'GK') keeperAI(this, p, dt);
      else if (b.owner === p) ownerAI(this, p, dt);
      else playerAI(this, p, dt);
    }
    this.movePlayers(dt);
    this.moveBall(dt);
    if (this.phase !== PHASE.PLAY) return;
    this.touches(dt);
    this.watchdog(dt);
  }

  // ---------------------------------------------------------------- set pieces

  /** Start a restart: everyone walks to their spots, then the taker plays the ball. */
  setPiece(type, side, x = W / 2, y = L / 2) {
    const b = this.ball;
    b.owner = null; b.held = false; b.intended = null; b.shotBy = null; b.inNet = false;
    b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0;
    this.buffer = null; this.charge = 0; this.charging = false;
    const team = this.teams[side].players;
    let spot; let takerPos; let taker;
    const dirIn = attackDir(side);
    if (type === 'kickoff') {
      spot = { x: W / 2, y: L / 2 };
      taker = team[4];
      takerPos = { x: W / 2, y: L / 2 - dirIn * 5 };
    } else if (type === 'goalkick') {
      spot = { x: W / 2 + (x < W / 2 ? -18 : 18), y: side === 0 ? L - SIX_D : SIX_D };
      taker = team[0];
      takerPos = { x: spot.x, y: spot.y - dirIn * 5 };
    } else if (type === 'corner') {
      spot = { x: x < W / 2 ? 1 : W - 1, y: oppGoalY(side) === 0 ? 1 : L - 1 };
      const out = { x: spot.x < W / 2 ? -1 : 1, y: spot.y < L / 2 ? -1 : 1 };
      takerPos = { x: spot.x + out.x * 4, y: spot.y + out.y * 4 };
      taker = nearestTo(team.filter((p) => p.role !== 'GK'), spot);
    } else { // throw-in
      spot = { x: x < W / 2 ? 0.5 : W - 0.5, y: clamp(y, 10, L - 10) };
      takerPos = { x: spot.x < W / 2 ? -5 : W + 5, y: spot.y };
      taker = nearestTo(team.filter((p) => p.role !== 'GK'), spot);
    }
    this.sp = { type, side, spot, taker, takerPos, t: 0 };
    b.x = spot.x; b.y = spot.y;
    this.stats.restarts[type] = (this.stats.restarts[type] || 0) + 1;
    this.phase = PHASE.SETUP;
    this.phaseT = type === 'kickoff' ? 1.4 : 0.7;
    for (const p of this.players) {
      p.ai.setup = p === taker ? takerPos : this.setupSpot(p);
      p.tackleT = 0; p.diveT = 0; p.stunT = 0; p.celebrate = 0; p.dejected = 0;
    }
    if (this.humanSide === side && taker.role !== 'GK') this.active = taker;
    if (type !== 'kickoff') this.emit(type, { side });
  }

  setupSpot(p) {
    const { type, side, spot } = this.sp;
    if (p.role === 'GK') return { x: W / 2, y: ownGoalY(p.side) + attackDir(p.side) * 6 };
    const attacking = p.side === side;
    let s = formationSpot(this, p, { ballX: spot.x, ballY: spot.y, attacking });
    if (type === 'kickoff') {
      // Own half only; the defending side also keeps out of the centre circle.
      const lim = L / 2 - attackDir(p.side) * 10;
      if (p.side === 0) s.y = Math.max(s.y, lim); else s.y = Math.min(s.y, lim);
      if (p.role === 'LM' || p.role === 'RM') s.y = p.side === 0 ? Math.max(s.y, L / 2 + 16) : Math.min(s.y, L / 2 - 16);
      if (!attacking || p.role !== 'FWD') {
        const d = norm(s.x - W / 2, s.y - L / 2);
        if (d.d < CIRCLE_R + 6) s = { x: W / 2 + (d.d > 0 ? d.x : 0) * (CIRCLE_R + 6), y: L / 2 + (d.d > 0 ? d.y : -attackDir(p.side)) * (CIRCLE_R + 6) };
      }
      if (attacking && p.role === 'FWD') s = { x: W / 2 + 14, y: L / 2 - attackDir(p.side) * 3 };
      if (attacking && p.role === 'DEF') s = { x: W / 2 - 22, y: L / 2 - attackDir(p.side) * 28 };
    } else if (type === 'corner' && attacking) {
      const gy = oppGoalY(side); const inward = attackDir(side) * -1;
      const near = spot.x < W / 2 ? -1 : 1;
      if (p.role === 'FWD') s = { x: W / 2 + near * 14, y: gy + inward * 22 };
      else if (p.role === 'LM') s = { x: W / 2 - near * 16, y: gy + inward * 28 };
      else if (p.role === 'RM') s = { x: W / 2, y: gy + inward * 50 };
    } else if (type === 'corner') {
      // Defenders crowd the box
      const gy = ownGoalY(p.side); const inward = attackDir(p.side);
      const xs = { DEF: W / 2 - 10, LM: W / 2 + 14, RM: W / 2 - 24, FWD: W / 2 + 4 };
      const ds = { DEF: 18, LM: 24, RM: 34, FWD: 60 };
      s = { x: xs[p.role], y: gy + inward * ds[p.role] };
    }
    if (!attacking) {
      // Opponents keep their distance from the ball.
      const d = norm(s.x - spot.x, s.y - spot.y);
      const need = type === 'kickoff' ? CIRCLE_R + 4 : 22;
      if (d.d < need) {
        const dir = d.d > 0 ? d : { x: 0, y: attackDir(p.side) * -1 };
        s = { x: spot.x + dir.x * need, y: spot.y + dir.y * need };
      }
    }
    s.x = clamp(s.x, 6, W - 6); s.y = clamp(s.y, 6, L - 6);
    return s;
  }

  stepSetup(dt) {
    this.phaseT -= dt;
    for (const p of this.players) {
      const t = p.ai.setup;
      steer(p, t.x, t.y, RUN * 1.7, dt);
    }
    this.movePlayers(dt, true);
    const allThere = this.players.every((p) => dist(p.x, p.y, p.ai.setup.x, p.ai.setup.y) < 2);
    if (this.phaseT <= 0 && (allThere || this.phaseT < -0.8)) this.beginTaking();
  }

  beginTaking() {
    const sp = this.sp;
    // Snap everybody into place (kickoffs) or just the taker (quick restarts).
    for (const p of this.players) {
      if (sp.type === 'kickoff' || p === sp.taker) { p.x = p.ai.setup.x; p.y = p.ai.setup.y; }
      p.vx = 0; p.vy = 0;
    }
    const t = sp.taker;
    const f = norm(sp.spot.x - t.x, sp.spot.y - t.y);
    if (f.d > 0) { t.fx = f.x; t.fy = f.y; }
    // Opponents who are too close get moved back.
    const need = sp.type === 'kickoff' ? CIRCLE_R + 2 : 18;
    for (const p of this.players) {
      if (p.side === sp.side || p.role === 'GK') continue;
      const d = norm(p.x - sp.spot.x, p.y - sp.spot.y);
      if (d.d < need) {
        const dir = d.d > 0 ? d : { x: 0, y: -attackDir(p.side) };
        p.x = clamp(sp.spot.x + dir.x * need, 4, W - 4); p.y = clamp(sp.spot.y + dir.y * need, 4, L - 4);
      }
    }
    const b = this.ball;
    b.x = sp.spot.x; b.y = sp.spot.y; b.z = 0; b.vx = b.vy = b.vz = 0;
    b.owner = t; b.held = sp.type === 'goalkick'; b.lastTouch = t;
    sp.t = 0;
    sp.delay = 0.45 + this.params[sp.side].react * 2 + this.rng() * 0.4;
    if (sp.type === 'kickoff') sp.delay += 0.4;
    this.phase = PHASE.TAKING;
    if (sp.type === 'kickoff') this.emit('whistle', { kind: 'kickoff' });
  }

  stepTaking(dt, pressed) {
    const sp = this.sp;
    sp.t += dt;
    const t = sp.taker;
    const humanTakes = this.humanSide === sp.side && t.role !== 'GK';
    // Everyone but the taker keeps walking to position (kickoffs: everybody waits).
    if (sp.type !== 'kickoff') {
      if (sp.type !== 'kickoff') this.runClock(dt);
      if (this.phase !== PHASE.TAKING) return;
      for (const p of this.players) {
        if (p === t) continue;
        if (this.isHuman(p) && !humanTakes) { this.humanMove(p, dt); continue; }
        steer(p, p.ai.setup.x, p.ai.setup.y, RUN * 0.9, dt);
      }
      this.movePlayers(dt, true);
    }
    // Keep the ball on the spot; taker can turn to aim.
    const b = this.ball;
    b.x = sp.spot.x; b.y = sp.spot.y;
    if (humanTakes) {
      this.active = t;
      const s = this.stick();
      if (s) { t.fx = s.x; t.fy = s.y; }
      if (sp.type === 'kickoff' && s && s.d > 0.5) {
        // Kick off by just running with it.
        this.startPlay();
        return;
      }
      if (this.input.shoot) this.charging = true;
      if (this.charging && this.input.shoot) this.charge = Math.min(1, this.charge + dt / 0.75);
      if (pressed.pass) { this.takeKick('pass', s); return; }
      if (pressed.shootUp && this.charging) { this.takeKick('shoot', s, this.charge); return; }
      if (sp.t > 6) { takerAI(this, t); this.startPlay(); }
      return;
    }
    if (sp.t >= sp.delay) {
      takerAI(this, t);
      this.startPlay();
    }
  }

  /** Human taker plays the set piece in the stick (or facing) direction. */
  takeKick(kind, s, power = 0.5) {
    const t = this.sp.taker;
    const dir = s && s.d > 0.3 ? s : { x: t.fx, y: t.fy };
    const type = this.sp.type;
    let d = { ...dir };
    if (type === 'throwin') {
      const inward = this.sp.spot.x < W / 2 ? 1 : -1;
      if (d.x * inward < 0.25) d = norm(inward * 0.5, d.y || attackDir(t.side) * 0.8);
    }
    if (kind === 'pass') {
      const opts = passOptions(this, t, { dir: d, maxDist: type === 'throwin' ? 110 : 170 });
      if (opts.length) passTo(this, t, opts[0], { thrown: type === 'throwin' });
      else passIntoSpace(this, t, d, type === 'throwin' ? 70 : 90, { thrown: type === 'throwin' });
    } else if (type === 'corner' || type === 'throwin') {
      // Shoot on a corner = a high cross toward the goal mouth; on a throw-in = a long throw.
      if (type === 'corner') {
        const gy = oppGoalY(t.side);
        const tx = W / 2 + d.x * 30; const ty = gy - attackDir(t.side) * (14 + power * 30);
        const v = norm(tx - t.x, ty - t.y);
        const sp = 120 + power * 60;
        kickBall(this, t, v.x * sp, v.y * sp, 70 + power * 30);
      } else {
        passIntoSpace(this, t, d, 70 + power * 60, { thrown: true });
      }
    } else {
      shoot(this, t, { power, aimX: d.x });
    }
    this.startPlay();
  }

  startPlay() {
    this.phase = PHASE.PLAY;
    this.charge = 0; this.charging = false;
    this.ball.held = false;
    for (const p of this.players) p.ai.thinkT = 0;
  }

  // ---------------------------------------------------------------- goals and halves

  stepGoal(dt) {
    this.phaseT -= dt;
    const b = this.ball;
    // Ball settles in the net.
    b.vx *= 0.9; b.vy *= 0.9;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.x = clamp(b.x, W / 2 - GOAL_W / 2 + 2, W / 2 + GOAL_W / 2 - 2);
    if (b.y < L / 2) b.y = clamp(b.y, -GOAL_D + 2, -1); else b.y = clamp(b.y, L + 1, L + GOAL_D - 2);
    if (b.z > 0) { b.vz -= G * dt; b.z = Math.max(0, b.z + b.vz * dt); }
    const scorer = this.lastGoal.side;
    const hero = this.lastGoal.scorer;
    for (const p of this.players) {
      if (p.side === scorer) {
        p.celebrate = 1;
        const tgt = p === hero ? { x: clamp(hero.x, 20, W - 20), y: L / 2 + (scorer === 0 ? 60 : -60) } : { x: hero.x + (p.id % 3 - 1) * 10, y: hero.y + (p.id % 2 ? 8 : -8) };
        steer(p, tgt.x, tgt.y, RUN * 0.8, dt);
      } else {
        p.dejected = 1;
        steer(p, p.x, p.y, 0, dt);
      }
    }
    this.movePlayers(dt, true);
    if (this.phaseT <= 0) this.setPiece('kickoff', 1 - scorer);
  }

  stepHalf(dt) {
    this.phaseT -= dt;
    for (const p of this.players) steer(p, p.x, p.y + (p.side === 0 ? 8 : -8), RUN * 0.3, dt);
    this.movePlayers(dt, true);
    if (this.phaseT <= 0) {
      this.half = 2; this.clock = 0;
      this.setPiece('kickoff', 1 - this.firstKick);
    }
  }

  // ---------------------------------------------------------------- human control

  stick() {
    const { mx = 0, my = 0 } = this.input;
    const d = Math.hypot(mx, my);
    if (d < 0.2) return null;
    return { x: mx / d, y: my / d, d: Math.min(1, d) };
  }

  /** Auto-switch the controlled player to whoever should be playing the ball. */
  chooseActive() {
    const side = this.humanSide;
    const b = this.ball;
    const team = this.teams[side].players;
    const cur = this.active;
    if (b.owner && b.owner.side === side && b.owner.role !== 'GK') { this.setActive(b.owner); return; }
    if (b.intended && b.intended.side === side && b.intended.role !== 'GK') { this.setActive(b.intended); return; }
    if (b.owner && b.owner.side === side) return; // our keeper has it: stay
    if (cur && (cur.tackleT > 0 || this.switchCool > 0)) return;
    if (b.owner === cur) return;
    let best = null; let bd = Infinity;
    for (const p of team) {
      if (p.role === 'GK') continue;
      const d = dist(p.x, p.y, b.x, b.y) + (p.stunT > 0 ? 40 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    if (!cur || cur.role === 'GK') { this.setActive(best); return; }
    const curD = dist(cur.x, cur.y, b.x, b.y);
    if (best !== cur && bd < curD - 12) this.setActive(best);
  }

  setActive(p) {
    if (p === this.active) return;
    this.active = p;
    this.switchCool = 0.35;
    this.emit('switch');
  }

  humanMove(p, dt) {
    const s = this.stick();
    if (p.stunT > 0 || p.tackleT > 0) return;
    const sp = (this.ball.owner === p ? 0.9 : 1) * RUN * 1.05 * (p.recoverT > 0 ? 0.35 : 1);
    if (s) {
      p.tvx = s.x * sp * Math.min(1, s.d * 1.4);
      p.tvy = s.y * sp * Math.min(1, s.d * 1.4);
    } else { p.tvx = 0; p.tvy = 0; }
    p.accel = 14;
  }

  humanControl(p, dt, pressed) {
    const b = this.ball;
    this.humanMove(p, dt);
    // Stick idle while a pass is on its way to you: run onto it automatically.
    if (!this.stick() && b.intended === p && p.stunT <= 0 && p.tackleT <= 0) {
      const ic = interceptPoint(this, p);
      steer(p, ic.x, ic.y, RUN * 1.05, dt);
    }
    const s = this.stick();
    const dir = s ? { x: s.x, y: s.y } : { x: p.fx, y: p.fy };
    const comingToMe = b.intended === p || (!b.owner && dist(p.x, p.y, b.x, b.y) < 26 && b.lastTouch && b.lastTouch.side === p.side && b.lastTouch !== p);
    if (this.input.shoot && !this.charging && (pressed.shoot) && (b.owner === p || comingToMe)) this.charging = true;
    if (this.charging && b.owner !== p && !comingToMe) { this.charging = false; this.charge = 0; }   // lost it
    if (this.charging && this.input.shoot) this.charge = Math.min(1, this.charge + dt / 0.75);

    if (b.owner === p) {
      if (pressed.pass) { this.humanPass(p, dir); return; }
      if (pressed.shootUp && this.charging) { this.humanShoot(p, s, this.charge); return; }
      return;
    }
    if (pressed.pass) {
      if (comingToMe) this.buffer = { kind: 'pass', t: 0.6, dir };
      else tackle(this, p, s ? dir : norm(b.x - p.x, b.y - p.y));
    }
    if (pressed.shootUp && this.charging) {
      if (comingToMe) this.buffer = { kind: 'shoot', t: 0.6, power: this.charge, stick: s };
      this.charging = false; this.charge = 0;
    } else if (pressed.shoot && !comingToMe) {
      // Shoot while defending: switch to the next teammate nearest the ball.
      const others = this.teams[p.side].players.filter((q) => q !== p && q.role !== 'GK');
      const n = nearestTo(others, b);
      if (n) { this.active = n; this.switchCool = 0.6; this.emit('switch'); }
    }
  }

  humanPass(p, dir) {
    const opts = passOptions(this, p, { dir, maxDist: 190 });
    if (opts.length) passTo(this, p, opts[0]);
    else passIntoSpace(this, p, dir, 80);
    this.charging = false; this.charge = 0;
  }

  humanShoot(p, s, power) {
    // Pointing back toward your own goal makes it a big clearance in that direction.
    const back = s && s.y * attackDir(p.side) < -0.5;
    if (back) passIntoSpace(this, p, s, 90 + power * 80, { lofted: true });
    // Stick roughly straight (or idle): aim away from the keeper; pushed sideways: aim that way.
    else shoot(this, p, { power, aimX: s && Math.abs(s.x) > 0.3 ? s.x : null, human: true });
    this.charging = false; this.charge = 0;
  }

  /** Run a queued one-touch pass or shot the moment the ball arrives. */
  runBuffer(p) {
    const buf = this.buffer;
    this.buffer = null;
    if (buf.kind === 'pass') this.humanPass(p, this.stick() || buf.dir);
    else this.humanShoot(p, buf.stick || this.stick(), buf.power);
  }

  // ---------------------------------------------------------------- movement

  movePlayers(dt, noCollide = false) {
    for (const p of this.players) {
      if (p.stunT > 0) { p.tvx = 0; p.tvy = 0; }
      if (p.tackleT > 0) {
        p.vx = p.slideX * (35 + 125 * p.tackleT / TACKLE_T);
        p.vy = p.slideY * (35 + 125 * p.tackleT / TACKLE_T);
      } else if (p.diveT > 0) {
        p.vx = p.diveVx; p.vy = p.diveVy;
      } else {
        const k = Math.min(1, (p.accel || 10) * dt);
        p.vx += (p.tvx - p.vx) * k;
        p.vy += (p.tvy - p.vy) * k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 8 && p.tackleT <= 0 && p.diveT <= 0) { p.fx = p.vx / sp; p.fy = p.vy / sp; }
    }
    if (!noCollide) this.separate();
    for (const p of this.players) keepOnField(p);
  }

  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]; const c = ps[j];
        const dx = c.x - a.x; const dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = PLAYER_R * 2 - 1;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / 2;
        const nx = d2 > 0 ? dx / d : (i % 2 ? 1 : -1); const ny = d2 > 0 ? dy / d : 0;
        a.x -= nx * push; a.y -= ny * push;
        c.x += nx * push; c.y += ny * push;
      }
    }
  }

  // ---------------------------------------------------------------- ball

  moveBall(dt) {
    const b = this.ball;
    if (b.owner) {
      const p = b.owner;
      if (b.held) {
        b.x = p.x + p.fx * 3; b.y = p.y + p.fy * 3; b.z = 6; b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      } else {
        const tx = p.x + p.fx * 5; const ty = p.y + p.fy * 5;
        const k = Math.min(1, 22 * dt);
        b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
        b.z = 0; b.vz = 0; b.vx = p.vx; b.vy = p.vy;
      }
      p.holdT += dt;
      this.checkOut();
      return;
    }
    const px = b.x; const py = b.y; const pz = b.z;
    if (b.z > 0 || b.vz > 0) {
      b.vz -= G * dt;
      b.z += b.vz * dt;
      b.vx *= 1 - 0.15 * dt; b.vy *= 1 - 0.15 * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -45) { b.vz = -b.vz * 0.45; b.vx *= 0.85; b.vy *= 0.85; this.emit('bounce'); }
        else b.vz = 0;
      }
    } else {
      const s = Math.hypot(b.vx, b.vy);
      if (s > 0) {
        const ns = Math.max(0, s - (FRICTION + s * 0.35) * dt);
        b.vx *= ns / s; b.vy *= ns / s;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    this.posts(px, py);
    this.crossLine(px, py, pz);
  }

  posts() {
    const b = this.ball;
    if (b.z > BAR + 1) return;
    for (const gy of [0, L]) {
      for (const sx of [-1, 1]) {
        const px = W / 2 + sx * GOAL_W / 2;
        const dx = b.x - px; const dy = b.y - gy;
        const d = Math.hypot(dx, dy);
        const min = POST_R + BALL_R;
        if (d < min) {
          const nx = d > 0 ? dx / d : 0; const ny = d > 0 ? dy / d : 1;
          b.x = px + nx * min; b.y = gy + ny * min;
          const along = b.vx * nx + b.vy * ny;
          if (along < 0) { b.vx -= 1.6 * along * nx; b.vy -= 1.6 * along * ny; }
          b.intended = null;
          if (Math.abs(along) > 40) this.emit('post');
        }
      }
    }
  }

  /** Goal, crossbar, or the ball going out over a line. */
  crossLine(px, py, pz) {
    const b = this.ball;
    for (const [gy, defSide] of [[0, 1], [L, 0]]) {
      const crossed = gy === 0 ? (py >= 0 && b.y < 0) : (py <= L && b.y > L);
      if (!crossed) continue;
      const inMouth = Math.abs(b.x - W / 2) < GOAL_W / 2 - BALL_R + 0.5;
      if (!inMouth) continue;
      const z = Math.max(b.z, pz);
      if (b.z < BAR - 1.5) { this.goal(1 - defSide); return; }
      if (b.z < BAR + 2.5) {
        // Off the crossbar.
        b.y = gy === 0 ? 0.5 : L - 0.5;
        b.vy = -b.vy * 0.5; b.vz = Math.abs(b.vz) * 0.3 + 20;
        b.intended = null;
        this.emit('bar');
        return;
      }
      void z;
    }
    this.checkOut();
  }

  checkOut() {
    const b = this.ball;
    if (this.phase !== PHASE.PLAY) return;
    const last = b.lastTouch ? b.lastTouch.side : 0;
    if (b.x < -BALL_R || b.x > W + BALL_R) {
      this.emit('out');
      this.setPiece('throwin', 1 - last, b.x, b.y);
      return;
    }
    if (b.y < -BALL_R || b.y > L + BALL_R) {
      if (b.owner && Math.abs(b.x - W / 2) < GOAL_W / 2) {
        // Dribbled into the goal mouth: that's a goal too.
        const side = b.y < 0 ? 0 : 1;
        this.goal(side);
        return;
      }
      const defSide = b.y < 0 ? 1 : 0;
      this.emit('out');
      if (last === defSide) this.setPiece('corner', 1 - defSide, b.x, b.y);
      else this.setPiece('goalkick', defSide, b.x, b.y);
    }
  }

  goal(side) {
    const b = this.ball;
    const last = b.lastTouch;
    this.score[side]++;
    const own = last && last.side !== side;
    const scorer = last && !own ? last : this.teams[side].players[4];
    this.lastGoal = { side, scorer, own, minute: this.minute };
    b.owner = null; b.held = false; b.intended = null; b.inNet = true;
    this.phase = PHASE.GOAL;
    this.phaseT = 2.8;
    this.emit('goal', { side, own, scorer: scorer.id });
  }

  // ---------------------------------------------------------------- contact with the ball

  touches(dt) {
    const b = this.ball;
    if (b.held) return;
    // Keepers first: they can use their hands in their own box.
    for (const k of [this.teams[0].players[0], this.teams[1].players[0]]) {
      if (b.owner || k.stunT > 0 || k.kickCool > 0) continue;
      if (!inBox(k.side, b.x, b.y, 2) || !inBox(k.side, k.x, k.y, 6)) continue;
      const prm = this.params[k.side];
      const reach = (k.diveT > 0 ? 10 : 7) * prm.keeperReach;
      const d = dist(k.x, k.y, b.x, b.y);
      if (d > reach || b.z > (k.diveT > 0 ? 12 : 17)) continue;
      const speed = Math.hypot(b.vx, b.vy);
      const wasShot = b.shotBy && b.shotBy.side !== k.side;
      const catchMax = (k.diveT > 0 ? 130 : 170) + 130 * prm.keeperHands;
      if (speed < catchMax) {
        this.gain(k, true);
        if (wasShot) { this.stats.saves[k.side]++; this.emit('save', { side: k.side, caught: true }); }
        else this.emit('catch', { side: k.side });
      } else {
        const away = attackDir(k.side);
        const r = this.rng();
        if (r < 0.4) {
          // Tipped round the post (or over the bar): it carries on past the goal for a corner.
          const sideX = Math.sign(b.x - W / 2) || (this.rng() < 0.5 ? -1 : 1);
          b.vx = sideX * (60 + Math.abs(b.vy) * 0.25);
          b.vy *= 0.55;
          b.vz = b.z > 7 ? 70 : 25;
        } else {
          // Parried back into play.
          b.vy = Math.abs(b.vy) * 0.35 * away + away * 30;
          b.vx = b.vx * 0.4 + (this.rng() - 0.5) * 160;
          b.vz = 40;
        }
        b.intended = null; b.shotBy = null;
        b.lastTouch = k;
        k.kickCool = 0.35;
        this.stats.saves[k.side]++;
        this.emit('save', { side: k.side, caught: false });
      }
    }
    if (b.held) return;

    const near = this.players
      .map((p) => ({ p, d: dist(p.x, p.y, b.x, b.y) }))
      .filter((o) => o.d < 10)
      .sort((u, v) => u.d - v.d);
    for (const { p, d } of near) {
      if (p.stunT > 0) continue;
      // Slide tackle: wins the ball from anyone, or pokes a loose ball on.
      if (p.tackleT > 0 && d < (b.owner ? 6.5 : 7.5) && b.z < 5 && (!b.owner || b.owner.side !== p.side)) {
        const victim = b.owner;
        // Whether a slide on a dribbler connects: the tackler's timing against the dribbler's
        // skill at hopping over it.
        if (victim && !p.slideRolled) {
          p.slideRolled = true;
          const hit = this.isHuman(p) ? 0.72 : 0.42 + 0.3 * this.params[p.side].tackle / 1.7;
          const evade = this.isHuman(victim) ? 0.12 : this.humanSide === victim.side ? 0.15 : 0.08 + 0.3 * (1 - this.params[victim.side].react / 0.4);
          if (this.rng() > hit * (1 - evade)) { p.missed = true; this.emit('hurdle', { side: victim.side }); }
        }
        if (victim && p.missed) continue;
        p.won = true;
        if (victim) { victim.stunT = 0.7; victim.holdT = 0; }
        b.owner = null;
        const sp = 70 + this.rng() * 30;
        b.vx = p.slideX * sp + (this.rng() - 0.5) * 30; b.vy = p.slideY * sp + (this.rng() - 0.5) * 30;
        b.lastTouch = p; b.intended = null; b.shotBy = null;
        p.kickCool = 0.12;
        if (victim) { this.stats.tackles[p.side]++; this.emit('tackle', { side: p.side }); }
        return;
      }
      if (p.kickCool > 0 || p.tackleT > 0 || p.diveT > 0) continue;
      if (b.owner) {
        // Shoulder-to-shoulder: a defender at the ball can nick it.
        if (b.owner === p || b.owner.side === p.side || p.stealCool > 0 || b.owner.stealCool > 0) continue;
        if (d > 6 || p.role === 'GK') continue;
        const prm = this.params[p.side];
        const rate = this.isHuman(p) ? 1.6 : prm.steal;
        const resist = this.isHuman(b.owner) ? 1.25 : 1;
        if (this.rng() < rate * dt * 2.2 / resist) {
          const victim = b.owner;
          victim.stealCool = 0.7; p.stealCool = 0.5;
          victim.recoverT = 0.3;
          this.gain(p);
          this.stats.tackles[p.side]++;
          this.emit('steal', { side: p.side });
        }
        return;
      }
      // Loose ball
      if (b.z < 6 && d < 6) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 215 && b.intended !== p && this.rng() < 0.45) {
          // Too hot to control: it deflects off them.
          b.vx = -b.vx * 0.25 + (this.rng() - 0.5) * 80;
          b.vy = -b.vy * 0.25 + (this.rng() - 0.5) * 80;
          b.lastTouch = p; b.intended = null; b.shotBy = null;
          p.kickCool = 0.25;
          this.emit('block');
          return;
        }
        this.gain(p);
        return;
      }
      if (b.z >= 6 && b.z < 17 && d < 6 && p.role !== 'GK') {
        this.header(p);
        return;
      }
    }
  }

  gain(p, hands = false) {
    const b = this.ball;
    b.owner = p; b.held = hands; b.intended = null; b.shotBy = null;
    b.lastTouch = p; b.z = hands ? 6 : 0; b.vz = 0;
    p.holdT = 0;
    p.ai.thinkT = this.isHuman(p) ? 0 : 0.08 + this.params[p.side].react * 0.6;
    if (this.isHuman(p) || (this.humanSide === p.side && this.buffer && p.role !== 'GK')) {
      if (this.buffer && p.role !== 'GK') { this.active = p; this.runBuffer(p); return; }
    }
    this.emit('control', { side: p.side });
  }

  header(p) {
    const b = this.ball;
    const gy = oppGoalY(p.side);
    const dGoal = dist(p.x, p.y, W / 2, gy);
    if (dGoal < 95) {
      // Head it at goal.
      const prm = this.params[p.side];
      const err = this.isHuman(p) ? 10 : prm.shotErr * 50;
      const tx = W / 2 + (this.rng() - 0.5) * (GOAL_W * 0.7 + err);
      const v = norm(tx - b.x, gy - b.y);
      const sp = 150 + this.rng() * 40;
      b.vx = v.x * sp; b.vy = v.y * sp; b.vz = 10;
      b.shotBy = p;
      this.stats.shots[p.side]++;
      this.emit('header', { side: p.side });
    } else {
      // Cushion it down.
      b.vx *= 0.25; b.vy *= 0.25; b.vz = 15;
      this.emit('bounce');
    }
    b.lastTouch = p; b.intended = null;
    p.kickCool = 0.3; p.kickT = 0.25;
  }

  /** Safety net: a dead, untouched ball gets nudged back into play (never expected to fire). */
  watchdog(dt) {
    const b = this.ball;
    const moving = b.owner || Math.hypot(b.vx, b.vy) > 4;
    this.stillT = moving ? 0 : this.stillT + dt;
    if (this.stillT > 5) {
      this.stillT = 0;
      const d = norm(W / 2 - b.x, L / 2 - b.y);
      b.vx = d.x * 60; b.vy = d.y * 60;
      this.stats.nudges++;
    }
  }
}

// -------------------------------------------------------------------- helpers shared with ai.js

export function makePlayer(id, side, role) {
  return {
    id, side, role,
    x: W / 2, y: side === 0 ? L * 0.75 : L * 0.25,
    vx: 0, vy: 0, tvx: 0, tvy: 0, accel: 10,
    fx: 0, fy: side === 0 ? -1 : 1,
    tackleT: 0, slideX: 0, slideY: 0, tackleCool: 0, recoverT: 0, stunT: 0, stealCool: 0,
    kickCool: 0, kickT: 0, diveT: 0, diveVx: 0, diveVy: 0, holdT: 0, celebrate: 0, dejected: 0,
    ai: { thinkT: 0, tx: W / 2, ty: L / 2, speed: 1, setup: { x: W / 2, y: L / 2 } },
  };
}

function tickTimers(p, dt) {
  for (const k of ['tackleT', 'tackleCool', 'recoverT', 'stunT', 'stealCool', 'kickCool', 'kickT', 'diveT']) {
    if (p[k] > 0) {
      p[k] -= dt;
      if (p[k] <= 0) {
        p[k] = 0;
        // A slide that didn't win the ball leaves you on the floor for a moment.
        if (k === 'tackleT') { if (p.won) p.recoverT = 0.3; else { p.stunT = 0.45; p.vx = 0; p.vy = 0; } }
        if (k === 'diveT') { p.stunT = 0.35; p.vx = 0; p.vy = 0; }
      }
    }
  }
}

/** Set a player's desired velocity toward (tx, ty) at up to `speed`, slowing on arrival. */
export function steer(p, tx, ty, speed, dt) {
  void dt;
  // Behind a goal with somewhere to be on the pitch: go round the net, not into it.
  const span = GOAL_W / 2 + PLAYER_R + 2;
  for (const gy of [0, L]) {
    const behind = gy === 0 ? p.y < gy - 1 : p.y > gy + 1;
    const wantsIn = gy === 0 ? ty > gy : ty < gy;
    if (behind && wantsIn && Math.abs(p.x - W / 2) < span + 2) {
      tx = W / 2 + (Math.sign(p.x - W / 2) || 1) * (span + 6);
      ty = p.y;
    }
  }
  const d = norm(tx - p.x, ty - p.y);
  const s = d.d < 1 ? 0 : speed * Math.min(1, d.d / 10);
  p.tvx = d.x * s; p.tvy = d.y * s;
  p.accel = 10;
}

/** Players may step a little off the pitch but never into the nets or past the posts. */
function keepOnField(p) {
  p.x = clamp(p.x, -MARGIN + 6, W + MARGIN - 6);
  p.y = clamp(p.y, -MARGIN + 6, L + MARGIN - 6);
  for (const gy of [0, L]) {
    const behind = gy === 0 ? p.y < gy + 1 : p.y > gy - 1;
    const inside = Math.abs(p.x - W / 2) < GOAL_W / 2 + PLAYER_R && behind && Math.abs(p.y - gy) < GOAL_D + PLAYER_R + 1;
    if (inside) {
      // Push out the shortest way: back onto the pitch, or out past a side netting.
      const toPitch = Math.abs(p.y - gy) + 1;
      const toSide = GOAL_W / 2 + PLAYER_R - Math.abs(p.x - W / 2);
      const toBack = GOAL_D + PLAYER_R + 1 - Math.abs(p.y - gy);
      if (toPitch <= toSide && toPitch <= toBack) p.y = gy === 0 ? gy + 1 : gy - 1;
      else if (toSide <= toBack) p.x = W / 2 + Math.sign(p.x - W / 2 || 1) * (GOAL_W / 2 + PLAYER_R);
      else p.y = gy === 0 ? gy - GOAL_D - PLAYER_R - 1 : gy + GOAL_D + PLAYER_R + 1;
    }
    for (const sx of [-1, 1]) {
      const px = W / 2 + sx * GOAL_W / 2;
      const d = norm(p.x - px, p.y - gy);
      const min = PLAYER_R + POST_R;
      if (d.d < min) {
        const n = d.d > 0 ? d : { x: 0, y: gy === 0 ? 1 : -1 };
        p.x = px + n.x * min; p.y = gy + n.y * min;
      }
    }
  }
}

export function nearestTo(list, pt) {
  let best = null; let bd = Infinity;
  for (const p of list) {
    const d = dist(p.x, p.y, pt.x, pt.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Kick the ball from player p with the given velocity. */
export function kickBall(m, p, vx, vy, vz = 0) {
  const b = m.ball;
  b.owner = null; b.held = false;
  b.x = p.x + p.fx * 4; b.y = p.y + p.fy * 4;
  if (Math.abs(b.x - p.x) < 0.5 && Math.abs(b.y - p.y) < 0.5) b.y += attackDir(p.side) * 3;
  b.vx = vx; b.vy = vy; b.vz = vz; b.z = vz > 0 ? 1 : 0;
  b.lastTouch = p; b.intended = null; b.shotBy = null;
  p.kickCool = 0.28; p.kickT = 0.25; p.holdT = 0;
  const f = norm(vx, vy);
  if (f.d > 0) { p.fx = f.x; p.fy = f.y; }
}

/** Slide tackle in direction dir. */
export function tackle(m, p, dir) {
  if (p.tackleCool > 0 || p.stunT > 0 || p.tackleT > 0) return false;
  const d = norm(dir.x, dir.y);
  if (d.d === 0) return false;
  p.tackleT = TACKLE_T; p.tackleCool = 0.9; p.slideRolled = false; p.missed = false; p.won = false;
  p.slideX = d.x; p.slideY = d.y; p.fx = d.x; p.fy = d.y;
  m.emit('slide', { side: p.side });
  return true;
}

export { ballPosAt };
