// The adaptive skill pattern (same as Game Night / Pocket Pets): blend calibrated presets
// { easy, normal, hard } at skill s (0 = easy, 0.5 = normal, 1 = hard). Numbers are interpolated;
// keys listed in `ints` are rounded.
export function tune(presets, s, ints = []) {
  const { easy, normal, hard } = presets;
  const out = {};
  const keys = new Set([...Object.keys(easy), ...Object.keys(normal), ...Object.keys(hard)]);
  for (const k of keys) {
    const a = easy[k] ?? 0; const b = normal[k] ?? 0; const c = hard[k] ?? 0;
    const v = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
    out[k] = ints.includes(k) ? Math.round(v) : v;
  }
  return out;
}

// How demanding customers are. Only what they ask for and how much they will pay changes;
// prices, rent, ingredients and your brewing are never touched.
export const CUSTOMER_PRESETS = {
  easy: { tol: 0.45, starsChance: 0.1, elChance: 0.35, patience: 3, rival: 19 },
  normal: { tol: 0.3, starsChance: 0.3, elChance: 0.25, patience: 2, rival: 23 },
  hard: { tol: 0.18, starsChance: 0.55, elChance: 0.15, patience: 2, rival: 27 },
};
export const customerTune = (skill) => tune(CUSTOMER_PRESETS, skill, ['patience']);
