// Seeded random numbers. The state lives in the game object (s.rng) so a saved game carries on
// with the same sequence and tests are repeatable.
export function next(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rand = (s, a = 0, b = 1) => a + next(s) * (b - a);
export const randInt = (s, a, b) => a + Math.floor(next(s) * (b - a + 1));
export const chance = (s, p) => next(s) < p;
export const pick = (s, arr) => arr[Math.floor(next(s) * arr.length)];
export function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export function weighted(s, list) {
  const total = list.reduce((a, e) => a + Math.max(0, e.w), 0);
  if (total <= 0) return null;
  let r = next(s) * total;
  for (const e of list) { r -= Math.max(0, e.w); if (r < 0) return e; }
  return list[list.length - 1];
}
