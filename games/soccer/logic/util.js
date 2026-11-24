// Small maths helpers and a seeded random generator (so CPU-vs-CPU tests are repeatable).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export function norm(x, y) {
  const d = Math.hypot(x, y);
  return d > 1e-6 ? { x: x / d, y: y / d, d } : { x: 0, y: 0, d: 0 };
}

/** Distance from point p to segment a-b, and how far along (0..1) the closest point is. */
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return { d: Math.hypot(ax + dx * t - px, ay + dy * t - py), t };
}

/** mulberry32: fast seeded RNG returning [0, 1). */
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

/** Roughly normal noise, mean 0, sd about 1. */
export const gauss = (rng) => (rng() + rng() + rng() + rng() - 2) * 1.73;

/**
 * Blend calibrated presets { easy, normal, hard } at skill s (0 = easy, 0.5 = normal, 1 = hard).
 * Same idea as game-night/adaptive.js tune(), kept here so the logic has no browser imports.
 */
export function tune(presets, s) {
  const { easy, normal, hard } = presets;
  const out = {};
  for (const k of Object.keys(normal)) {
    const a = easy[k]; const b = normal[k]; const c = hard[k];
    out[k] = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
  }
  return out;
}
