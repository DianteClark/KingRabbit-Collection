// Penalty shoot-out: 5 kicks each, alternating, decided early when one side can't catch up,
// then sudden death. Kicks are resolved from where the shot is aimed and which way the keeper dives.

import { clamp } from './util.js';

export function newShootout(first = 0) {
  return { first, kicks: [[], []], done: false, winner: null };
}

export const goals = (so, side) => so.kicks[side].filter(Boolean).length;

/** Whose turn it is. */
export function nextKicker(so) {
  const [a, b] = [so.kicks[so.first].length, so.kicks[1 - so.first].length];
  return a <= b ? so.first : 1 - so.first;
}

export function recordKick(so, side, scored) {
  so.kicks[side].push(Boolean(scored));
  const n0 = so.kicks[0].length; const n1 = so.kicks[1].length;
  const g0 = goals(so, 0); const g1 = goals(so, 1);
  if (n0 <= 5 && n1 <= 5) {
    const left0 = 5 - n0; const left1 = 5 - n1;
    if (g0 > g1 + left1) { so.done = true; so.winner = 0; }
    else if (g1 > g0 + left0) { so.done = true; so.winner = 1; }
    else if (n0 === 5 && n1 === 5 && g0 !== g1) { so.done = true; so.winner = g0 > g1 ? 0 : 1; }
  } else if (n0 === n1 && g0 !== g1) {
    so.done = true; so.winner = g0 > g1 ? 0 : 1;
  }
  return so;
}

/** -1 left third, 0 middle, 1 right third of the goal. */
export const zoneOf = (aim) => (aim < -0.34 ? -1 : aim > 0.34 ? 1 : 0);

/**
 * aim: -1..1 across the goal (beyond +-1 is wide). power 0..1. dive: -1 / 0 / 1.
 * keeper 0..1 how good the keeper is. Returns 'goal' | 'save' | 'miss'.
 */
export function resolveKick({ aim, power = 0.7, dive, keeper = 0.5, rng }) {
  if (Math.abs(aim) > 1) return 'miss';
  if (power > 0.92 && rng() < (power - 0.92) * 4) return 'miss';     // blazed over
  const zone = zoneOf(aim);
  if (dive !== zone) {
    // Wrong way, but a soft shot near the middle can still be reached with a foot.
    if (Math.abs(aim) < 0.2 && power < 0.4 && rng() < 0.5) return 'save';
    return 'goal';
  }
  const corner = clamp((Math.abs(aim) - 0.6) / 0.4, 0, 1);
  let save = 0.5 + 0.3 * keeper - 0.4 * corner + (0.6 - power) * 0.3;
  if (zone === 0) save = 0.8 + keeper * 0.15;
  return rng() < clamp(save, 0.05, 0.95) ? 'save' : 'goal';
}

/** Where a CPU taker aims: better takers go closer to the corners without missing. */
export function cpuKick(skill, rng) {
  const side = rng() < 0.5 ? -1 : 1;
  const r = rng();
  let aim;
  if (r < 0.15) aim = (rng() - 0.5) * 0.5;                            // down the middle
  else aim = side * (0.5 + rng() * (0.35 + skill * 0.15) + (rng() < 0.12 - skill * 0.1 ? 0.25 : 0));
  return { aim, power: 0.55 + rng() * 0.3 };
}

/** Which way a CPU keeper goes; a sharper keeper reads the taker more often. */
export function cpuDive(skill, aim, rng) {
  if (rng() < 0.15 + skill * 0.3) return zoneOf(aim);
  const r = rng();
  return r < 0.42 ? -1 : r < 0.84 ? 1 : 0;
}
