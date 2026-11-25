// Computer drivers. Each one follows the track's racing line (with its own lane offset), slows
// for corners using a speed profile worked out from its car's turning ability, drifts through
// tight bends, uses boost on straights and steers round cars in front. How well it does all
// this blends between easy / normal / hard presets by a skill number from 0 to 1.
import { speedProfile, wrapIdx, wrapAngle } from './track.js';
import { forwardSpeed } from './car.js';

export const PRESETS = {
  easy: { pace: 0.8, corner: 0.84, boostUse: 0.25, wobble: 5, react: 0.7 },
  normal: { pace: 0.905, corner: 0.93, boostUse: 0.65, wobble: 2.5, react: 0.85 },
  hard: { pace: 0.985, corner: 1.0, boostUse: 1, wobble: 0.8, react: 1 },
};

export function tune(s) {
  const { easy, normal, hard } = PRESETS;
  const out = {};
  for (const k of Object.keys(normal)) {
    const a = easy[k]; const b = normal[k]; const c = hard[k];
    out[k] = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
  }
  return out;
}

/** Make a driver brain for one car. line = racingLine(track). */
export function newDriver(t, line, car, { skill = 0.5, lane = 0, seed = 1 } = {}) {
  const k = tune(Math.max(0, Math.min(1, skill)));
  const P = car.p;
  const prof = speedProfile(t, line, { top: P.top, turnRate: P.turn * 0.93 * k.corner, brake: P.brake * 0.6 });
  return { k, prof, lane, phase: (seed % 100) / 16, avoid: 0, think: 0, wantBoost: false, rnd: seed };
}

function rand(d) { d.rnd = (Math.imul(d.rnd, 1103515245) + 12345) >>> 0; return d.rnd / 4294967296; }

/**
 * Work out this step's controls. others = every car (to steer round them).
 * env.paceMul gently stretches or squeezes the pace (rubber band).
 */
export function drive(t, line, d, car, others, time, env = {}) {
  const v = forwardSpeed(car);
  const i = car.idx ?? 0;
  const k = d.k;
  // lane: racing line + personal offset + a slow wobble + dodging cars ahead
  const lim = t.hw - 7;
  const wob = Math.sin(time * 0.7 + d.phase) * k.wobble;
  d.think -= 1;
  if (d.think <= 0) {
    d.think = 6;
    d.avoid *= 0.8;
    const fx = Math.cos(car.h); const fy = Math.sin(car.h);
    for (const o of others) {
      if (o === car || o.ghostT > 0) continue;
      const dx = o.x - car.x; const dy = o.y - car.y;
      const ahead = dx * fx + dy * fy; const side = -dx * fy + dy * fx;
      if (ahead > 4 && ahead < 34 && Math.abs(side) < 11 && forwardSpeed(o) < v + 5) {
        // pass on the side with more room
        const room = o.lat > 0 ? -1 : 1;
        d.avoid = room * 14 * k.react;
      }
    }
  }
  const la = Math.round((14 + Math.abs(v) * 0.22) / t.step);
  const j = wrapIdx(t, i + la);
  const off = Math.max(-lim, Math.min(lim, line.off[j] + d.lane + wob + d.avoid));
  const tx = t.x[j] - t.ty[j] * off; const ty = t.y[j] + t.tx[j] * off;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const err = wrapAngle(want - car.h);
  let steer = Math.max(-1, Math.min(1, err * 2.6));

  // speed: the profile a little ahead, scaled by pace
  const pace = k.pace * (env.paceMul ?? 1);
  let target = Infinity;
  for (let q = 0; q <= 6; q += 2) target = Math.min(target, d.prof[wrapIdx(t, i + q)]);
  target = Math.min(target * (env.paceMul ?? 1), car.p.top * pace);
  let gas = 1; let brake = false;
  if (v > target + 4) { gas = 0; if (v > target + 14) brake = true; }

  // drift through tight bends (also fills the meter), never from a crawl
  const tight = Math.abs(line.k[wrapIdx(t, i + 4)]) > 1 / 70;
  const drift = !brake && tight && Math.abs(steer) > 0.45 && v > 95 && k.react > 0.75;

  // boost on a straight when the meter is decent
  let boost = false;
  if (car.boost > 0.6 && !tight) {
    let straight = true;
    for (let q = 0; q < 50; q += 5) if (d.prof[wrapIdx(t, i + q)] < car.p.top * 0.95) { straight = false; break; }
    if (straight && rand(d) < k.boostUse * 0.1) boost = true;
  }
  // facing the wrong way (after a spin): turn round hard
  if (Math.abs(err) > 2.2 && v < 30) steer = Math.sign(err);
  return { steer, gas, brake, drift, boost };
}
