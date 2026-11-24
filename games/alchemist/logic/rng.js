// Seeded random numbers kept inside the saved state, so a resumed game carries on exactly.

/** Next float 0..1 from s.seed (mulberry32), advancing the seed. */
export function rand(s) {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (s, n) => Math.floor(rand(s) * n);
export const pick = (s, arr) => arr[randInt(s, arr.length)];
