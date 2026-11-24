/** Small seeded random number generator (mulberry32). Returns a function giving 0..1. */
export function mulberry(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.state = () => a;
  f.setState = (s) => { a = s >>> 0; };
  return f;
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const between = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const chance = (rng, p) => rng() < p;
