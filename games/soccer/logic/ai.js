// Team and player AI. Every decision reads the match state and sets a player's target velocity
// or kicks the ball through the helpers in match.js. Strength only changes HOW the CPU plays:
// how fast it reacts and runs, how accurately it passes and shoots, how keen it is to tackle,
// how good its keeper is. The ball physics and rules are the same for everyone.

import {
  W, L, GOAL_W, BOX_W, BOX_D, RUN, FRICTION, G,
  attackDir, ownGoalY, oppGoalY, depthOf, yAtDepth, inBox,
} from './constants.js';
import { clamp, dist, norm, segDist, gauss, tune } from './util.js';
import { kickBall, steer, tackle, nearestTo } from './match.js';

export const PRESETS = {
  easy: {
    react: 0.4, speed: 0.89, passErr: 0.2, shotErr: 0.32, shotRange: 105, tackle: 0.45, steal: 0.45,
    press: 0.72, keeperReach: 0.82, keeperHands: 0.25, keeperReact: 0.3, vision: 0.35, holdMax: 3.2, mark: 0.45,
  },
  normal: {
    react: 0.24, speed: 0.95, passErr: 0.09, shotErr: 0.15, shotRange: 125, tackle: 1.0, steal: 0.85,
    press: 0.9, keeperReach: 1.0, keeperHands: 0.55, keeperReact: 0.16, vision: 0.7, holdMax: 2.5, mark: 0.7,
  },
  hard: {
    react: 0.12, speed: 1.0, passErr: 0.035, shotErr: 0.06, shotRange: 145, tackle: 1.7, steal: 1.3,
    press: 1.0, keeperReach: 1.15, keeperHands: 0.85, keeperReact: 0.07, vision: 1, holdMax: 2.0, mark: 0.9,
  },
};

// The raw presets don't play evenly: CPU-vs-CPU sims showed a 0.2 step below 0.6 was worth
// about +1.1 goals a match but only about +0.45 above it. This remap (measured from cumulative goal
// difference) makes equal skill steps roughly equal changes in strength, so every adaptive step
// feels about the same size.
const CURVE = [[0, 0], [0.2, 0.262], [0.4, 0.417], [0.6, 0.579], [0.8, 0.785], [1, 1]];

export function effectiveSkill(skill) {
  const s = clamp(skill, 0, 1);
  for (let i = 1; i < CURVE.length; i++) {
    const [x0, y0] = CURVE[i - 1]; const [x1, y1] = CURVE[i];
    if (s <= x1) return y0 + ((s - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

export const aiParams = (skill) => tune(PRESETS, effectiveSkill(skill));

// Formation shape: [across 0..1, depth 0..1] when defending and when attacking.
const SHAPE = {
  GK: { def: [0.5, 0.02], atk: [0.5, 0.02] },
  DEF: { def: [0.5, 0.14], atk: [0.5, 0.34] },
  LM: { def: [0.24, 0.3], atk: [0.16, 0.56] },
  RM: { def: [0.76, 0.3], atk: [0.84, 0.56] },
  FWD: { def: [0.5, 0.5], atk: [0.5, 0.8] },
};

/** Where a player should stand given the ball position and who has it. */
export function formationSpot(m, p, { ballX, ballY, attacking }) {
  const sh = SHAPE[p.role][attacking ? 'atk' : 'def'];
  let fx = sh[0];
  if (p.end === 1) fx = 1 - fx;             // mirror so "left" is their left
  const bd = depthOf(p.end, ballY);
  let d = sh[1] + (bd - 0.5) * (attacking ? 0.45 : 0.4);
  if (!attacking) d = Math.min(d, bd - 0.04);   // stay goal-side of the ball when defending
  if (p.role === 'DEF') d = clamp(d, 0.08, attacking ? 0.6 : 0.4);
  else if (p.role === 'FWD') d = clamp(d, attacking ? 0.4 : 0.3, 0.88);
  else d = clamp(d, 0.08, 0.84);
  const shift = p.role === 'DEF' ? 0.35 : 0.45;
  const x = clamp(fx * W + (ballX - W / 2) * shift, 12, W - 12);
  return { x, y: clamp(yAtDepth(p.end, d), 10, L - 10) };
}

/** Where a rolling (or flying) ball will be after t seconds. */
export function ballPosAt(b, t) {
  let x = b.x; let y = b.y; let vx = b.vx; let vy = b.vy;
  let tt = t;
  if (b.z > 0 || b.vz > 0) {
    const tAir = (b.vz + Math.sqrt(Math.max(0, b.vz * b.vz + 2 * G * b.z))) / G;
    const ta = Math.min(tt, tAir);
    x += vx * ta; y += vy * ta; tt -= ta;
    if (tt <= 0) return { x, y };
  }
  const s = Math.hypot(vx, vy);
  if (s < 1) return { x, y };
  // Approximate the friction model (constant + proportional) as constant decel.
  const a = FRICTION + s * 0.2;
  const tStop = s / a;
  const tr = Math.min(tt, tStop);
  const dd = s * tr - 0.5 * a * tr * tr;
  return { x: x + (vx / s) * dd, y: y + (vy / s) * dd };
}

function runSpeed(m, p) {
  const human = m.humanSide === p.side;
  // Your own teammates run at normal pace whatever the CPU level.
  const k = human ? 0.95 : m.params[p.side].speed;
  return RUN * k * (p.recoverT > 0 ? 0.35 : 1);
}

/** Earliest time and place player p can reach the ball. */
export function intercept(m, p) {
  const b = m.ball;
  if (b.owner) return { t: dist(p.x, p.y, b.x, b.y) / runSpeed(m, p), x: b.x, y: b.y };
  const sp = Math.max(20, runSpeed(m, p));
  for (let t = 0; t <= 2.4; t += 0.1) {
    const q = ballPosAt(b, t);
    const qx = clamp(q.x, -2, W + 2); const qy = clamp(q.y, -2, L + 2);
    if (dist(p.x, p.y, qx, qy) - 5 <= sp * t) return { t, x: qx, y: qy };
  }
  const q = ballPosAt(b, 2.4);
  const qx = clamp(q.x, 0, W); const qy = clamp(q.y, 0, L);
  return { t: 2.4 + dist(p.x, p.y, qx, qy) / sp, x: qx, y: qy };
}

// ------------------------------------------------------------------ team-level decisions

/** Every ~0.15 s each team picks a chaser, a cover player and who marks whom. */
export function teamThink(m, side, dt) {
  const team = m.teams[side];
  team.thinkT = (team.thinkT || 0) - dt;
  if (team.thinkT > 0) return;
  team.thinkT = 0.15;
  const b = m.ball;
  const owner = b.owner;
  const weHave = owner && owner.side === side;
  const outfield = team.players.filter((p) => p.role !== 'GK');
  const keeper = team.players[0];
  team.chaser = null; team.cover = null; team.marks = new Map();

  if (weHave) return;
  if (b.intended && b.intended.side === side) { team.chaser = b.intended; return; }

  // Chaser: whoever gets to the ball first. The keeper joins in only inside his box.
  let best = null; let bt = Infinity;
  const cands = [...outfield];
  if (!owner && inBox(m.ends[side], b.x, b.y, -4)) cands.push(keeper);
  for (const p of cands) {
    if (p.stunT > 0.2) continue;
    const ic = intercept(m, p);
    p.ai.icpt = ic;
    const t = ic.t + (p.role === 'GK' ? -0.15 : 0);
    if (t < bt) { bt = t; best = p; }
  }
  team.chaser = best;
  if (!owner) return;

  // They have it: second-nearest covers between ball and goal, the rest mark.
  const gy = ownGoalY(m.ends[side]);
  const rest = outfield.filter((p) => p !== best);
  const danger = Math.max(0, depthOf(m.ends[1 - side], owner.y) - 0.35);
  const cover = nearestTo(rest, { x: (b.x + W / 2) / 2, y: (b.y + gy) / 2 });
  if (cover && danger > 0.1) team.cover = cover;
  const threats = m.teams[1 - side].players
    .filter((o) => o.role !== 'GK' && o !== owner)
    .sort((a, c) => depthOf(m.ends[1 - side], c.y) - depthOf(m.ends[1 - side], a.y));
  const markers = rest.filter((p) => p !== team.cover && p.role !== 'FWD');
  for (const o of threats) {
    if (!markers.length) break;
    const mk = nearestTo(markers, o);
    team.marks.set(mk, o);
    markers.splice(markers.indexOf(mk), 1);
  }
}

// ------------------------------------------------------------------ outfield players

export function playerAI(m, p, dt) {
  const prm = m.params[p.side];
  const team = m.teams[p.side];
  const b = m.ball;
  const sp = runSpeed(m, p);
  if (p.stunT > 0 || p.tackleT > 0) return;
  const owner = b.owner;
  const theyHave = owner && owner.side !== p.side;
  const humanTeam = m.humanSide === p.side;

  if (team.chaser === p) {
    if (theyHave) {
      // Press: aim a little goal-side of the dribbler and tackle when close.
      const gy = ownGoalY(p.end);
      const g = norm(W / 2 - owner.x, gy - owner.y);
      const tx = owner.x + owner.vx * 0.25 + g.x * 3; const ty = owner.y + owner.vy * 0.25 + g.y * 3;
      steer(p, tx, ty, sp * (humanTeam ? 0.95 : prm.press), dt);
      p.ai.thinkT -= dt;
      if (p.ai.thinkT <= 0) {
        p.ai.thinkT = prm.react;
        const d = dist(p.x, p.y, b.x, b.y);
        const rate = humanTeam ? 0.8 : prm.tackle;
        const facing = (b.x - p.x) * p.fx + (b.y - p.y) * p.fy;
        if (d < 13 && d > 4 && facing > 0 && !owner.held && m.rng() < rate * prm.react * 1.6) {
          tackle(m, p, norm(b.x + owner.vx * 0.12 - p.x, b.y + owner.vy * 0.12 - p.y));
        }
      }
      return;
    }
    if (owner && owner.held) { formation(m, p, dt, true); return; }
    // Loose ball: run to where it can be reached.
    p.ai.thinkT -= dt;
    if (p.ai.thinkT <= 0 || !p.ai.icpt) {
      p.ai.thinkT = 0.1;
      p.ai.icpt = intercept(m, p);
    }
    const ic = p.ai.icpt;
    steer(p, clamp(ic.x, -1, W + 1), clamp(ic.y, -1, L + 1), sp, dt);
    if (Math.hypot(p.tvx, p.tvy) < 0.5 && dist(p.x, p.y, b.x, b.y) > 3) steer(p, b.x, b.y, sp, dt);
    return;
  }

  if (theyHave && team.cover === p) {
    const gy = ownGoalY(p.end);
    const t = 0.45;
    steer(p, clamp(b.x + (W / 2 - b.x) * t, 8, W - 8), clamp(b.y + (gy - b.y) * t, 8, L - 8), sp, dt);
    return;
  }
  const mark = team.marks && team.marks.get(p);
  if (theyHave && mark) {
    // Goal-side of the man, blended with the team shape.
    const gy = ownGoalY(p.end);
    const g = norm(W / 2 - mark.x, gy - mark.y);
    const mx = mark.x + g.x * 10; const my = mark.y + g.y * 10;
    const f = formationSpot(m, p, { ballX: b.x, ballY: b.y, attacking: false });
    const k = humanTeam ? 0.65 : prm.mark;
    steer(p, clamp(mx * k + f.x * (1 - k), 6, W - 6), clamp(my * k + f.y * (1 - k), 6, L - 6), sp, dt);
    return;
  }
  const attacking = (owner && owner.side === p.side) || (!owner && b.lastTouch && b.lastTouch.side === p.side);
  formation(m, p, dt, attacking);
}

/** Take up the team shape; when attacking, look for open space near the spot. */
function formation(m, p, dt, attacking) {
  const b = m.ball;
  const sp = runSpeed(m, p);
  p.ai.thinkT -= dt;
  if (p.ai.thinkT <= 0 || p.ai.tx === undefined) {
    p.ai.thinkT = 0.35 + m.rng() * 0.3;
    let s = formationSpot(m, p, { ballX: b.x, ballY: b.y, attacking });
    if (attacking) {
      // Try a few nearby spots and pick the one furthest from defenders (making a run).
      const opp = m.teams[1 - p.side].players;
      let best = s; let bestScore = -Infinity;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + m.rng();
        const r = i === 0 ? 0 : 18 + m.rng() * 10;
        const c = { x: clamp(s.x + Math.cos(a) * r, 10, W - 10), y: clamp(s.y + Math.sin(a) * r, 10, L - 10) };
        let space = 60;
        for (const o of opp) space = Math.min(space, dist(o.x, o.y, c.x, c.y));
        const fwd = depthOf(p.end, c.y) * 20;
        const tooClose = dist(c.x, c.y, b.x, b.y) < 24 ? 25 : 0;
        const score = space + fwd - tooClose - r * 0.2;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      s = best;
    }
    // Don't bunch up with teammates.
    for (const q of m.teams[p.side].players) {
      if (q === p) continue;
      const d = norm(s.x - q.x, s.y - q.y);
      if (d.d < 16 && d.d > 0) { s.x += d.x * (16 - d.d) * 0.6; s.y += d.y * (16 - d.d) * 0.6; }
    }
    p.ai.tx = clamp(s.x, 8, W - 8); p.ai.ty = clamp(s.y, 8, L - 8);
  }
  const far = dist(p.x, p.y, p.ai.tx, p.ai.ty);
  steer(p, p.ai.tx, p.ai.ty, sp * (far > 30 ? 1 : 0.75), dt);
}

// ------------------------------------------------------------------ the player on the ball

export function ownerAI(m, p, dt) {
  const prm = m.params[p.side];
  if (p.stunT > 0) return;
  const sp = runSpeed(m, p) * 0.9;
  // Dribble direction every frame (smooth), decisions every think tick.
  const dir = dribbleDir(m, p);
  steer(p, p.x + dir.x * 30, p.y + dir.y * 30, sp, dt);
  p.accel = 8;
  p.ai.thinkT -= dt;
  if (p.ai.thinkT > 0) return;
  p.ai.thinkT = prm.react * (0.6 + m.rng() * 0.6);

  const shot = shotQuality(m, p);
  const pressure = pressureOn(m, p);
  const space = spaceAhead(m, p);
  const opts = passOptions(m, p, { maxDist: 170 });
  const bestPass = opts[0];
  const roll = m.rng();
  if (shot > 0.06 + roll * 0.28) { shoot(m, p, { power: shotPower(m, p) }); return; }
  if (p.holdT > prm.holdMax) {
    if (shot > 0.02) { shoot(m, p, { power: shotPower(m, p) }); return; }
    if (bestPass) { passTo(m, p, bestPass); return; }
  }
  if (bestPass) {
    // Open grass ahead: keep running with it unless a teammate is clearly better placed.
    const ahead = bestPass.gain > 0.1 && bestPass.score > 1.8;
    if (space > 26 && !(ahead && m.rng() < prm.vision * 0.3)) return;
    if (pressure > 0.65 && bestPass.score > 0.6 && bestPass.gain > -0.12 && m.rng() < 0.25 + prm.vision * 0.4) { passTo(m, p, bestPass); return; }
    if (ahead && m.rng() < prm.vision * 0.4 && p.holdT > 0.4) { passTo(m, p, bestPass); return; }
  }
  // Boxed in near a line with nothing on: clear it upfield.
  if (pressure > 0.85 && !bestPass && edgeDist(p) < 14) {
    passIntoSpace(m, p, { x: (W / 2 - p.x) / W, y: attackDir(p.end) }, 110, { lofted: true });
  }
}

/** Distance to the nearest opponent roughly in front (toward goal). */
function spaceAhead(m, p) {
  const gy = oppGoalY(p.end);
  const g = norm(W / 2 - p.x, gy - p.y);
  let best = 60;
  for (const o of m.teams[1 - p.side].players) {
    const v = norm(o.x - p.x, o.y - p.y);
    if (v.x * g.x + v.y * g.y > 0.35) best = Math.min(best, v.d);
  }
  return best;
}

function edgeDist(p) { return Math.min(p.x, W - p.x, p.y, L - p.y); }

/** Head for goal, swerving round defenders and away from the lines. */
function dribbleDir(m, p) {
  const gy = oppGoalY(p.end);
  const toGoal = norm(W / 2 - p.x, gy - p.y);
  let vx = toGoal.x; let vy = toGoal.y;
  for (const o of m.teams[1 - p.side].players) {
    const d = norm(p.x - o.x, p.y - o.y);
    if (d.d > 34 || d.d === 0) continue;
    const inFront = -(d.x * toGoal.x + d.y * toGoal.y) > 0.2 ? 1.6 : 0.6;
    const w = inFront * (34 - d.d) / 34;
    // Swerve sideways rather than backwards.
    const side = (d.x * toGoal.y - d.y * toGoal.x) >= 0 ? 1 : -1;
    vx += (d.x * 0.5 + toGoal.y * side * 0.8) * w;
    vy += (d.y * 0.5 - toGoal.x * side * 0.8) * w;
  }
  const e = 22;
  if (p.x < e) vx += (e - p.x) / e * 1.5;
  if (p.x > W - e) vx -= (p.x - (W - e)) / e * 1.5;
  if (p.y < e) vy += (e - p.y) / e * 1.2;
  if (p.y > L - e) vy -= (p.y - (L - e)) / e * 1.2;
  const n = norm(vx, vy);
  return n.d > 0 ? n : toGoal;
}

/** 0..1 how close the nearest opponent is (ignoring ones behind). */
function pressureOn(m, p) {
  let best = 0;
  for (const o of m.teams[1 - p.side].players) {
    const d = dist(p.x, p.y, o.x, o.y);
    best = Math.max(best, clamp(1 - (d - 6) / 22, 0, 1));
  }
  return best;
}

function shotQuality(m, p) {
  const prm = m.params[p.side];
  const gy = oppGoalY(p.end);
  const d = dist(p.x, p.y, W / 2, gy);
  const range = m.humanSide === p.side ? 125 : prm.shotRange;
  let q = 1 - d / range;
  if (q <= 0) return 0;
  const depthToGoal = Math.abs(gy - p.y);
  const wide = Math.abs(p.x - W / 2) - GOAL_W / 2;
  if (wide > 0) q -= (wide / Math.max(depthToGoal, 6)) * 0.5;   // tight angle
  for (const o of m.teams[1 - p.side].players) {
    if (o.role === 'GK') continue;
    const s = segDist(o.x, o.y, p.x, p.y, W / 2, gy);
    if (s.d < 7 && s.t > 0.05) q -= 0.22;
  }
  return q;
}

function shotPower(m, p) {
  const d = dist(p.x, p.y, W / 2, oppGoalY(p.end));
  return clamp(0.45 + d / 200 + (m.rng() - 0.5) * 0.15, 0.4, 0.95);
}

/**
 * Score every pass. Options are sorted best first: { to, x, y, d, score, gain, lofted }.
 * dir (optional) limits it to teammates roughly in that direction (the human's stick).
 */
export function passOptions(m, p, { dir = null, maxDist = 160 } = {}) {
  const out = [];
  const opp = m.teams[1 - p.side].players;
  for (const t of m.teams[p.side].players) {
    if (t === p || t.stunT > 0) continue;
    const lead = { x: clamp(t.x + t.vx * 0.35, 6, W - 6), y: clamp(t.y + t.vy * 0.35, 6, L - 6) };
    const d = dist(p.x, p.y, lead.x, lead.y);
    if (d < 16 || d > maxDist) continue;
    let lane = 40; let space = 50;
    for (const o of opp) {
      const s = segDist(o.x, o.y, p.x, p.y, lead.x, lead.y);
      if (s.t > 0.08) lane = Math.min(lane, s.d + s.t * 4);
      space = Math.min(space, dist(o.x, o.y, lead.x, lead.y));
    }
    const gain = depthOf(p.end, lead.y) - depthOf(p.end, p.y);
    let score = gain * 4.5 + Math.min(space, 36) / 36 * 1.2 + Math.min(lane, 18) / 18 * 1.3;
    if (d > 120) score -= (d - 120) / 60;
    if (t.role === 'GK') score -= 1.6;
    const lofted = lane < 7 && d > 45;
    if (lofted) score -= 0.4;
    if (dir) {
      const v = norm(lead.x - p.x, lead.y - p.y);
      const cos = v.x * dir.x + v.y * dir.y;
      if (cos < 0.5) continue;
      score = cos * 4 + score * 0.5 - d / 300;
    }
    out.push({ to: t, x: lead.x, y: lead.y, d, score, gain, lofted });
  }
  out.sort((a, c) => c.score - a.score);
  return out;
}

/** Play a pass to an option from passOptions (ground or lofted, with the CPU's error). */
export function passTo(m, p, opt, { thrown = false } = {}) {
  const human = m.humanSide === p.side;
  const err = human ? 0.03 : m.params[p.side].passErr;
  const ang = gauss(m.rng) * err * 0.5;
  const v0 = norm(opt.x - p.x, opt.y - p.y);
  const c = Math.cos(ang); const s = Math.sin(ang);
  const v = { x: v0.x * c - v0.y * s, y: v0.x * s + v0.y * c };
  const d = opt.d * (1 + gauss(m.rng) * err * 0.3);
  if (opt.lofted || thrown || d > 125) {
    const hs = clamp(d * 1.25, 80, 180);
    const tAir = (d * (thrown ? 0.9 : 0.8)) / hs;
    kickBall(m, p, v.x * hs, v.y * hs, (G * tAir) / 2);
  } else {
    // Ground pass that arrives at a controllable pace.
    const arrive = 45;
    const sp = clamp(Math.sqrt(arrive * arrive + 2 * (FRICTION + 30) * d), 70, 230);
    kickBall(m, p, v.x * sp, v.y * sp, 0);
  }
  m.ball.intended = opt.to;
  m.stats.passes[p.side]++;
  m.emit(thrown ? 'throw' : 'pass', { side: p.side });
}

/** Pass or clear into empty space in direction dir. */
export function passIntoSpace(m, p, dir, d, { lofted = false, thrown = false } = {}) {
  const v = norm(dir.x, dir.y);
  if (v.d === 0) return;
  if (lofted || thrown) {
    const hs = clamp(d * 1.25, 80, 190);
    const tAir = (d * 0.8) / hs;
    kickBall(m, p, v.x * hs, v.y * hs, (G * tAir) / 2);
  } else {
    const sp = clamp(Math.sqrt(40 * 40 + 2 * (FRICTION + 30) * d), 70, 230);
    kickBall(m, p, v.x * sp, v.y * sp, 0);
  }
  m.emit(thrown ? 'throw' : 'pass', { side: p.side });
}

/**
 * Shoot at the goal p attacks. power 0..1. aimX (-1..1) steers left/right for the human;
 * the CPU picks the corner away from the keeper.
 */
export function shoot(m, p, { power = 0.7, aimX = null, human = false } = {}) {
  const gy = oppGoalY(p.end);
  const keeper = m.teams[1 - p.side].players[0];
  let tx;
  const half = GOAL_W / 2 - 4;
  if (human) {
    if (aimX === null) tx = W / 2 + (keeper.x < W / 2 ? 1 : -1) * half * 0.55;
    else tx = W / 2 + clamp(aimX * 1.3, -1, 1) * half;
    tx += gauss(m.rng) * (2 + (power > 0.85 ? 6 : 0));
  } else {
    const prm = m.params[p.side];
    const side = keeper.x < W / 2 ? 1 : -1;
    const spot = m.rng() < 0.75 ? side : -side;
    tx = W / 2 + spot * half * (0.55 + m.rng() * 0.4);
    const d = dist(p.x, p.y, W / 2, gy);
    tx += gauss(m.rng) * prm.shotErr * (20 + d * 0.5);
  }
  const v = norm(tx - p.x, gy - p.y);
  const speed = 175 + 165 * power;
  const vz = 18 + 78 * power * power + (human ? 0 : m.rng() * 10);
  kickBall(m, p, v.x * speed, v.y * speed, vz);
  m.ball.shotBy = p;
  m.stats.shots[p.side]++;
  // On target if it would cross the line between the posts.
  if (Math.abs(tx - W / 2) < GOAL_W / 2) m.stats.onTarget[p.side]++;
  m.emit('shot', { side: p.side, power });
}

// ------------------------------------------------------------------ keepers

export function keeperAI(m, k, dt) {
  const b = m.ball;
  const prm = m.params[k.side];
  const kp = prm;
  if (k.stunT > 0 || k.diveT > 0) return;
  const gy = ownGoalY(k.end);
  const inward = attackDir(k.end);   // from our goal line into the pitch, along y
  const sp = RUN * 1.0;

  if (b.owner === k) {
    // Holding it: look up, then distribute.
    steer(k, k.x, k.y, 0, dt);
    if (k.holdT > 0.9 + kp.react * 2) {
      const opts = passOptions(m, k, { maxDist: 190 }).filter((o) => o.to.role !== 'GK');
      const safe = opts.find((o) => o.score > 0.8) || null;
      if (safe) passTo(m, k, safe);
      else {
        const t = m.teams[k.side].players[4];
        passIntoSpace(m, k, norm(t.x - k.x, (oppGoalY(k.end) - k.y) * 0.3 + (t.y - k.y)), 160, { lofted: true });
      }
    }
    return;
  }

  // Chasing a loose ball in the box (team think picked us).
  const team = m.teams[k.side];
  if (team.chaser === k && !b.owner && inBox(k.end, b.x, b.y, -2)) {
    const ic = k.ai.icpt || { x: b.x, y: b.y };
    const tx = clamp(ic.x, W / 2 - BOX_W / 2 + 2, W / 2 + BOX_W / 2 - 2);
    const ty = k.end === 0 ? clamp(ic.y, L - BOX_D + 2, L - 1) : clamp(ic.y, 1, BOX_D - 2);
    steer(k, tx, ty, sp, dt);
    k.reactT = 0;
    return;
  }

  // Shot (or any fast ball) heading for goal?
  const toward = (gy - b.y) * b.vy > 0 && !b.owner;
  const speed = Math.hypot(b.vx, b.vy);
  if (toward && speed > 70) {
    const tLine = (gy - b.y) / b.vy;
    const crossX = b.x + b.vx * tLine;
    if (tLine > 0 && tLine < 1.6 && Math.abs(crossX - W / 2) < GOAL_W / 2 + 10) {
      k.reactT = (k.reactT || 0) + dt;
      if (k.reactT < kp.keeperReact) { steer(k, k.x, k.y, sp * 0.3, dt); return; }
      const tk = Math.max(0.01, (k.y - b.y) / b.vy);
      const ix = clamp(b.x + b.vx * tk, W / 2 - GOAL_W / 2 - 4, W / 2 + GOAL_W / 2 + 4);
      const need = ix - k.x;
      if (Math.abs(need) > sp * tk + 3 && tk < 0.55) {
        const dv = clamp(Math.abs(need) / Math.max(tk, 0.15), 60, 150 * kp.keeperReach);
        k.diveT = 0.45; k.diveVx = Math.sign(need) * dv; k.diveVy = 0;
        k.fx = Math.sign(need); k.fy = 0;
        m.emit('dive', { side: k.side });
        return;
      }
      steer(k, ix, k.y, sp * 1.2, dt);
      k.accel = 18;
      return;
    }
  }
  k.reactT = 0;

  // Positioning: on the line from goal centre to ball, coming out further as the ball gets close.
  const bd = dist(b.x, b.y, W / 2, gy);
  let out = clamp(7 + bd * 0.06, 6, 18);
  if (b.owner && b.owner.side !== k.side && bd < 60) out = clamp(bd * 0.45, 8, 26);   // narrow the angle
  const dir = norm(b.x - W / 2, b.y - gy);
  let tx = W / 2 + dir.x * out; let ty = gy + dir.y * out;
  if (dir.d === 0) ty = gy - inward * -out;
  tx = clamp(tx, W / 2 - GOAL_W / 2 - 2, W / 2 + GOAL_W / 2 + 2);
  ty = k.end === 0 ? clamp(ty, L - BOX_D + 4, L - 3) : clamp(ty, 3, BOX_D - 4);
  steer(k, tx, ty, sp, dt);
  k.accel = 12;
}

// ------------------------------------------------------------------ set-piece takers

export function takerAI(m, t) {
  const type = m.sp.type;
  if (type === 'kickoff') {
    const opts = passOptions(m, t, { maxDist: 70 });
    if (opts.length) passTo(m, t, opts[0]);
    else passIntoSpace(m, t, { x: 0.4, y: -attackDir(t.end) * 1 }, 40);
    return;
  }
  if (type === 'corner') {
    const gy = oppGoalY(t.end);
    const targets = m.teams[t.side].players.filter((p) => p.role !== 'GK' && p !== t && Math.abs(p.y - gy) < 70);
    if (targets.length && m.rng() < 0.75) {
      const r = targets[Math.floor(m.rng() * targets.length)];
      const err = m.humanSide === t.side ? 0.1 : m.params[t.side].passErr;
      const tx = r.x + gauss(m.rng) * err * 30; const ty = r.y + gauss(m.rng) * err * 30;
      const d = dist(t.x, t.y, tx, ty);
      const hs = clamp(d * 1.3, 90, 170);
      const tAir = d / hs;
      const v = norm(tx - t.x, ty - t.y);
      // Arrive at head height so it can be headed in.
      kickBall(m, t, v.x * hs, v.y * hs, (G * tAir) / 2 + 10 / Math.max(tAir, 0.2));
      m.ball.intended = r;
      m.emit('cross', { side: t.side });
      return;
    }
  }
  const maxDist = type === 'throwin' ? 100 : type === 'goalkick' ? 200 : 160;
  let opts = passOptions(m, t, { maxDist });
  if (type === 'throwin') {
    const inward = m.sp.spot.x < W / 2 ? 1 : -1;
    opts = opts.filter((o) => (o.x - t.x) * inward > 4);
  }
  if (opts.length) passTo(m, t, opts[0], { thrown: type === 'throwin' });
  else {
    const inward = t.x < W / 2 ? 1 : -1;
    passIntoSpace(m, t, { x: type === 'throwin' ? inward * 0.6 : (W / 2 - t.x) / W, y: attackDir(t.end) }, type === 'goalkick' ? 150 : 60, { lofted: type === 'goalkick', thrown: type === 'throwin' });
  }
}
