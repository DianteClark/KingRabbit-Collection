// Adaptive difficulty numbers (same blend as game-night/adaptive.js tune()).
// skill 0 = easy, 0.5 = normal, 1 = hard. Only enemy pace, reactions and aggression change;
// damage numbers, hit points and the puzzles are the same for everyone.

export const PRESETS = {
  easy: { speed: 0.8, aggro: 0.45, cooldown: 1.45, projectile: 0.8, windup: 1.35, heartDrop: 1.5 },
  normal: { speed: 1.0, aggro: 1.0, cooldown: 1.0, projectile: 1.0, windup: 1.0, heartDrop: 1.0 },
  hard: { speed: 1.2, aggro: 1.5, cooldown: 0.75, projectile: 1.2, windup: 0.8, heartDrop: 0.75 },
};

export function tune(presets, s, ints = []) {
  const { easy, normal, hard } = presets;
  const out = {};
  for (const k of Object.keys(normal)) {
    const a = easy[k]; const b = normal[k]; const c = hard[k];
    const v = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
    out[k] = ints.includes(k) ? Math.round(v) : v;
  }
  return out;
}

/** Small seeded random number generator (mulberry32) so tests are repeatable. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
