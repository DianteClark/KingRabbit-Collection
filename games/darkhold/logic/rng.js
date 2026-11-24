// Seeded random numbers (mulberry32). An rng is a plain object { s } so it saves as JSON with the
// run and resumes exactly where it left off.

export function makeRng(seed = Date.now()) {
  return { s: (seed >>> 0) || 1 };
}

export function next(r) {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [a, b] inclusive. */
export const int = (r, a, b) => a + Math.floor(next(r) * (b - a + 1));
export const chance = (r, p) => next(r) < p;
export const pick = (r, arr) => arr[Math.floor(next(r) * arr.length)];

export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next(r) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** entries: [[item, weight], ...] */
export function weighted(r, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = next(r) * total;
  for (const [item, w] of entries) {
    x -= w;
    if (x < 0) return item;
  }
  return entries[entries.length - 1][0];
}

/** Stable 32-bit hash of a string (FNV-1a), for seeds like 'daily:2026-11-24'. */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
