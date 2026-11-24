// Adaptive difficulty knobs (the game-night adaptive.js pattern): one skill number from 0 to 1
// is blended between calibrated presets. Only enemy fire rate, aggression, boss pauses and drop
// rates move. Stage layouts, damage and boss HP never change.

export const PRESETS = {
  easy: { fire: 1.45, aggro: 0.78, drop: 1.6, bossPause: 1.3 },
  normal: { fire: 1.0, aggro: 1.0, drop: 1.0, bossPause: 1.0 },
  hard: { fire: 0.75, aggro: 1.22, drop: 0.7, bossPause: 0.82 },
};

/** fire: multiplier on enemy shot intervals (bigger = slower). aggro: speed/chase multiplier.
 *  drop: item drop chance multiplier. bossPause: multiplier on bosses' rests between moves. */
export function tuneFor(skill) {
  const s = Math.max(0, Math.min(1, Number.isFinite(skill) ? skill : 0.35));
  const { easy, normal, hard } = PRESETS;
  const out = {};
  for (const k of Object.keys(normal)) {
    out[k] = s <= 0.5 ? easy[k] + (normal[k] - easy[k]) * (s / 0.5) : normal[k] + (hard[k] - normal[k]) * ((s - 0.5) / 0.5);
  }
  return out;
}

/** Small seeded random generator so a run can be replayed in tests. */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
