// When and what monsters come. All pure: the game asks waveAt(t) every frame and
// eventsBetween(t0, t1) for one-off spawns (elites, swarms, bosses).
import { RUN_SECONDS, BOSSES, MAX_ENEMIES } from './data.js';

// One row per minute: monster types, spawns per second, how many may be alive at once.
export const MINUTES = [
  { types: ['bat', 'rat'], rate: 1.6, cap: 36 },
  { types: ['rat', 'slime', 'bat'], rate: 2.1, cap: 54 },
  { types: ['slime', 'snake', 'bat'], rate: 2.4, cap: 70 },
  { types: ['snake', 'skeleton', 'rat'], rate: 3, cap: 90 },
  { types: ['skeleton', 'hound', 'bat'], rate: 3.6, cap: 110 },
  { types: ['zombie', 'skeleton', 'hound'], rate: 4.2, cap: 130 },
  { types: ['zombie', 'orc', 'bat'], rate: 5, cap: 150 },
  { types: ['orc', 'goblin', 'hound'], rate: 5.6, cap: 170 },
  { types: ['mummy', 'orc', 'goblin'], rate: 6.2, cap: 190 },
  { types: ['mummy', 'vampire', 'hound'], rate: 7, cap: 210 },
  { types: ['vampire', 'crab', 'goblin'], rate: 7.6, cap: 230 },
  { types: ['crab', 'brute', 'vampire'], rate: 8.4, cap: 250 },
  { types: ['brute', 'devil', 'mummy'], rate: 9, cap: 270 },
  { types: ['devil', 'brute', 'crab'], rate: 10, cap: 290 },
  { types: ['devil', 'brute', 'vampire'], rate: 11, cap: MAX_ENEMIES },
];

export const SWARMS = [150, 450, 750];          // a ring of bats closes in
export const EASY = { ramp: 0.8, dmg: 0.6, hp: 1.5 };

/** Difficulty at run time t (seconds). Easy mode ramps on a slower clock. */
export function waveAt(t, easy = false) {
  const te = Math.max(0, easy ? t * EASY.ramp : t);
  const minute = Math.min(MINUTES.length - 1, Math.floor(te / 60));
  const row = MINUTES[minute];
  return {
    minute,
    types: row.types,
    rate: row.rate * (easy ? 0.85 : 1),
    cap: Math.min(MAX_ENEMIES, row.cap),
    hpMul: 1 + (te / 60) * 0.22,
    dmgMul: (1 + (te / 60) * 0.06) * (easy ? EASY.dmg : 1),
  };
}

/** One-off spawns whose time falls in (t0, t1]. Elites every minute that has no boss. */
export function eventsBetween(t0, t1) {
  const out = [];
  for (let m = Math.floor(t0 / 60) + 1; m * 60 <= t1; m++) {
    if (m * 60 > RUN_SECONDS) break;
    const boss = BOSSES.find((b) => b.at === m * 60);
    if (boss) out.push({ kind: 'boss', at: m * 60, boss });
    else out.push({ kind: 'elite', at: m * 60 });
  }
  for (const s of SWARMS) if (s > t0 && s <= t1) out.push({ kind: 'swarm', at: s });
  return out.sort((a, b) => a.at - b.at);
}

/**
 * How many to spawn this frame: accumulates fractional spawns in acc (returned) and never goes
 * over the cap of monsters alive.
 */
export function spawnCount(acc, rate, dt, alive, cap) {
  const a = acc + rate * dt;
  const n = Math.max(0, Math.min(Math.floor(a), cap - alive));
  return { n, acc: n > 0 || alive >= cap ? a - Math.floor(a) : a };
}

export const fmtClock = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
