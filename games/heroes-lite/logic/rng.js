// Small seeded random number generator (mulberry32). The state lives in a plain object so it
// can be saved with the game and every run is reproducible.

export function makeRng(seed) {
  const st = { s: seed >>> 0 };
  return rngFrom(st);
}

/** Wrap a saved { s } state object; advancing the rng updates it in place. */
export function rngFrom(st) {
  const next = () => {
    st.s = (st.s + 0x6d2b79f5) >>> 0;
    let t = st.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (a, b) => a + Math.floor(next() * (b - a + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  next.state = st;
  return next;
}
