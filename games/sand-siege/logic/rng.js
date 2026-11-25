// Small seeded random numbers (mulberry32) whose state is one number, so it saves with the game.
export function makeRng(seed) {
  const r = { s: seed >>> 0 };
  r.next = () => {
    r.s = (r.s + 0x6d2b79f5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (n) => Math.floor(r.next() * n);
  return r;
}
