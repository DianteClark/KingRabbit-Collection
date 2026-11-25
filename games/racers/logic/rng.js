// Small deterministic helpers: seeded random numbers, integer hashing and smooth value noise.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash two ints (and a seed) to [0, 1). */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1) at the given cell size. */
export function noise2(x, y, cell, seed = 0) {
  const gx = x / cell; const gy = y / cell;
  const x0 = Math.floor(gx); const y0 = Math.floor(gy);
  const fx = gx - x0; const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed); const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed); const d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * The same smooth noise as noise2(), with the lattice worked out once for a W x H area: much
 * cheaper when it is sampled for every pixel of a big picture.
 */
export function noiseField(W, H, cell, seed = 0) {
  const gw = Math.ceil(W / cell) + 3; const gh = Math.ceil(H / cell) + 3;
  const lat = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) lat[y * gw + x] = hash2(x - 1, y - 1, seed);
  const inv = 1 / cell;
  return (x, y) => {
    const gx = x * inv; const gy = y * inv;
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const fx = gx - x0; const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
    const cx = Math.min(gw - 2, Math.max(0, x0 + 1)); const cy = Math.min(gh - 2, Math.max(0, y0 + 1));
    const k = cy * gw + cx;
    const a = lat[k]; const b = lat[k + 1]; const c = lat[k + gw]; const d = lat[k + gw + 1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}
