/** Blend calibrated presets { easy, normal, hard } at skill s (0 = easy, 0.5 = normal, 1 = hard). */
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
