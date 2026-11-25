// Small seeded random generator (mulberry32). The state is a plain number so it can live in the
// save file and battles replay the same way in tests.

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = () => next();
  rng.int = (a, b) => a + Math.floor(next() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  rng.chance = (p) => next() < p;
  rng.range = (a, b) => a + next() * (b - a);
  rng.state = () => s;
  rng.weighted = (list) => {
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = next() * total;
    for (const [v, w] of list) { r -= w; if (r < 0) return v; }
    return list[list.length - 1][0];
  };
  return rng;
}
