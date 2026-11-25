// Paints a whole track into one RGBA pixel buffer (ground, road, kerbs, walls, start line,
// boost pads, puddles), pixel by pixel so every edge is crisp pixel art. Also places the
// scenery (buildings, trees, parked cars) and applies night or rain lighting. Pure JS: the game
// copies the buffer into a canvas texture; node tests and the preview tool use it directly.
import { hash2, noise2, mulberry32 } from './rng.js';

// DawnBringer-style colours shared with the Tiny Town art.
export const C = {
  ink: [20, 12, 28], asphalt: [78, 74, 78], asphalt2: [70, 66, 71], line: [222, 238, 214],
  side: [133, 149, 161], side2: [118, 132, 146], grass: [109, 170, 44], grass2: [52, 101, 36],
  water: [89, 125, 206], water2: [72, 104, 184], red: [208, 70, 72], yellow: [218, 212, 94],
  orange: [210, 125, 44], brown: [133, 76, 48], sand: [210, 170, 153], navy: [48, 52, 109],
  concrete: [117, 113, 97], dirt: [133, 76, 48], dirt2: [112, 62, 40],
};

export const THEME_STYLE = {
  downtown: { verge: 'side', barrier: ['red', 'line'], center: 'line', ground: 'plaza' },
  harbor: { verge: 'concrete', barrier: ['yellow', 'ink'], center: 'yellow', ground: 'dock' },
  park: { verge: 'grass2', barrier: ['grass2', 'grass'], center: null, ground: 'park' },
  highway: { verge: 'side', barrier: ['line', 'side'], center: 'lanes', ground: 'fields' },
};

/**
 * Distance fields round the centreline.
 * Exact (every pixel within `near` of the road): distance, signed lateral offset, arc length.
 * Coarse (8 px cells, up to `far`): distance only, for scenery and water.
 */
export function fields(t, near = t.wall + 6, far = 260) {
  const W = t.W; const H = t.H;
  const fd = new Float32Array(W * H).fill(1e9);
  const fl = new Float32Array(W * H);
  const fs = new Float32Array(W * H);
  const CELL = 8;
  const cw = Math.ceil(W / CELL); const ch = Math.ceil(H / CELL);
  const cd = new Float32Array(cw * ch).fill(1e9);
  for (let i = 0; i < t.n; i++) {
    const j = (i + 1) % t.n;
    const ax = t.x[i]; const ay = t.y[i]; const dx = t.x[j] - ax; const dy = t.y[j] - ay;
    const L2 = dx * dx + dy * dy || 1; const L = Math.sqrt(L2);
    const nx = -dy / L; const ny = dx / L;
    const x0 = Math.max(0, Math.floor(Math.min(ax, ax + dx) - near));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, ax + dx) + near));
    const y0 = Math.max(0, Math.floor(Math.min(ay, ay + dy) - near));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, ay + dy) + near));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const qx = px + 0.5 - ax; const qy = py + 0.5 - ay;
        let f = (qx * dx + qy * dy) / L2;
        if (f < 0) f = 0; else if (f > 1) f = 1;
        const ex = qx - dx * f; const ey = qy - dy * f;
        const d = Math.sqrt(ex * ex + ey * ey);
        const k = py * W + px;
        if (d < fd[k]) { fd[k] = d; fl[k] = ex * nx + ey * ny; fs[k] = (i + f) * t.step; }
      }
    }
    if (i % 2) continue;
    const r = Math.ceil(far / CELL);
    const cx = Math.floor(ax / CELL); const cy = Math.floor(ay / CELL);
    for (let gy = Math.max(0, cy - r); gy <= Math.min(ch - 1, cy + r); gy++) {
      for (let gx = Math.max(0, cx - r); gx <= Math.min(cw - 1, cx + r); gx++) {
        const d = Math.hypot((gx + 0.5) * CELL - ax, (gy + 0.5) * CELL - ay);
        const k = gy * cw + gx;
        if (d < cd[k]) cd[k] = d;
      }
    }
  }
  // bilinear between cell centres, so water edges and scenery limits follow smooth curves
  const at = (gx, gy) => cd[Math.min(ch - 1, Math.max(0, gy)) * cw + Math.min(cw - 1, Math.max(0, gx))];
  const coarse = (x, y) => {
    const gx = x / CELL - 0.5; const gy = y / CELL - 0.5;
    const x0 = Math.floor(gx); const y0 = Math.floor(gy); const fx = gx - x0; const fy = gy - y0;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  return { W, H, fd, fl, fs, coarse };
}

/** Is a ground pixel water? (harbor: past a wobbly quay line; park: ponds) */
export function isWater(theme, x, y, dist, seed) {
  if (theme === 'harbor') return dist > 90 + noise2(x, y, 64, seed) * 70;
  if (theme === 'park') return dist > 70 && noise2(x, y, 90, seed + 7) > 0.68;
  return false;
}

/** Paint the track. Returns { W, H, data, f } (f = the distance fields, for scenery placement). */
export function paintTrack(t, { theme = 'downtown', mood = 'day', seed = 1 } = {}) {
  const f = fields(t);
  const { W, H, fd, fl, fs, coarse } = f;
  const st = THEME_STYLE[theme] || THEME_STYLE.downtown;
  const data = new Uint8ClampedArray(W * H * 4);
  const hw = t.hw; const wall = t.wall;
  const set = (k, c) => { const o = k * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const d = fd[k];
      const h = hash2(x, y, seed);
      if (d < wall + 3) {
        const lat = fl[k]; const s = fs[k];
        if (d >= wall) {
          // barrier: two-colour blocks along the lap, ink line on its outer side
          const c = d >= wall + 2 ? C.ink : C[st.barrier[Math.floor(s / 8) % 2]];
          set(k, c);
        } else if (d >= hw) {
          set(k, C[st.verge]);
          if (theme === 'downtown' && Math.floor(s) % 16 === 0) set(k, C.side2);   // paving joints
          if (theme === 'park' && h < 0.15) set(k, C.grass);
        } else {
          let c = h < 0.08 ? C.asphalt2 : C.asphalt;
          if (d >= hw - 3 && d < hw - 1) c = C.line;
          if (st.center === 'line' || st.center === 'yellow') {
            if (Math.abs(lat) < 1 && Math.floor(s / 10) % 2 === 0) c = C[st.center === 'line' ? 'line' : 'yellow'];
          } else if (st.center === 'lanes') {
            const third = hw / 3;
            if ((Math.abs(lat - third) < 1 || Math.abs(lat + third) < 1) && Math.floor(s / 12) % 2 === 0) c = C.line;
          }
          // start / finish: a checker band across the road at s in [0, 8)
          const sm = s < t.length / 2 ? s : s - t.length;
          if (sm >= 0 && sm < 8 && d < hw - 1) c = (Math.floor(sm / 4) + Math.floor((lat + 100) / 4)) % 2 ? C.ink : C.line;
          set(k, c);
        }
        continue;
      }
      // ground
      const dd = d < 1e8 ? d : coarse(x, y);
      if (isWater(theme, x, y, dd, seed)) {
        let c = C.water;
        if (h < 0.004) c = C.line; else if (y % 9 === 0 && noise2(x, y, 10, seed + 3) > 0.62) c = C.water2;
        // a quay edge / bank one or two pixels wide
        if (!isWater(theme, x, y - 2, dd - 2, seed) || !isWater(theme, x - 2, y, dd - 2, seed)) c = theme === 'harbor' ? C.brown : C.sand;
        set(k, c);
        continue;
      }
      set(k, groundColour(st.ground, x, y, h, seed));
    }
  }
  paintGrid(t, data, W);
  for (const p of t.pads) paintPad(p, data, W, H);
  for (const p of t.puddles) paintPuddle(p, data, W, H, seed);
  return { W, H, data, f };
}

function groundColour(kind, x, y, h, seed) {
  if (kind === 'plaza') {
    if (x % 16 === 0 || y % 16 === 0) return C.side2;
    return h < 0.05 ? C.side2 : C.side;
  }
  if (kind === 'dock') {
    if (x % 24 === 0 || y % 24 === 0) return C.side2;
    return h < 0.06 ? C.side2 : C.concrete;
  }
  if (kind === 'fields') {
    const n = noise2(x, y, 80, seed + 11);
    if (n > 0.66) return (y % 6 < 2) ? C.dirt2 : C.dirt;        // ploughed fields
    return h < 0.05 ? C.grass2 : C.grass;
  }
  // park: grass with darker tufts
  return h < 0.06 || noise2(x, y, 6, seed + 5) > 0.86 ? C.grass2 : C.grass;
}

/** Start grid slot marks behind the line. */
function paintGrid(t, data, W) {
  for (const g of gridSlots(t)) {
    // a small white bracket in front of each slot
    for (let v = -5; v <= 5; v++) {
      for (let u = 0; u < 2; u++) {
        const x = Math.round(g.x + Math.cos(g.heading) * (u + 8) - Math.sin(g.heading) * v);
        const y = Math.round(g.y + Math.sin(g.heading) * (u + 8) + Math.cos(g.heading) * v);
        const o = (y * W + x) * 4;
        data[o] = C.line[0]; data[o + 1] = C.line[1]; data[o + 2] = C.line[2];
      }
    }
  }
}

/** Six grid slots, two abreast, behind the start line (index 0 = pole). */
export function gridSlots(t, count = 6) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / 2);
    const back = 18 + row * 22 + (k % 2) * 8;
    const i = (t.n - back / t.step) % t.n;
    const lat = (k % 2 ? -1 : 1) * Math.min(11, t.hw / 2.4);
    const i0 = Math.floor(i); const a = i0 % t.n;
    out.push({ x: t.x[a] - t.ty[a] * lat, y: t.y[a] + t.tx[a] * lat, heading: Math.atan2(t.ty[a], t.tx[a]), i: a });
  }
  return out;
}

function paintPad(p, data, W, H) {
  const R = 12;
  for (let y = Math.floor(p.y - R); y <= p.y + R; y++) {
    for (let x = Math.floor(p.x - R); x <= p.x + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const qx = x + 0.5 - p.x; const qy = y + 0.5 - p.y;
      const u = qx * p.tx + qy * p.ty; const v = -qx * p.ty + qy * p.tx;
      if (Math.abs(u) > p.len / 2 || Math.abs(v) > p.w / 2) continue;
      let c = C.orange;
      if (Math.abs(u) > p.len / 2 - 1 || Math.abs(v) > p.w / 2 - 1) c = C.ink;
      else if (((Math.floor(u + Math.abs(v)) % 6) + 6) % 6 < 2) c = C.yellow;
      const o = (y * W + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
    }
  }
}

function paintPuddle(p, data, W, H, seed) {
  for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) {
    for (let x = Math.floor(p.x - p.r * 1.4); x <= p.x + p.r * 1.4; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const e = ((x - p.x) / 1.4) ** 2 + (y - p.y) ** 2;
      const wob = (noise2(x, y, 5, seed + 9) - 0.5) * p.r * 0.6;
      if (Math.sqrt(e) > p.r + wob) continue;
      const c = hash2(x, y, seed + 2) < 0.08 ? C.line : (y + x) % 7 === 0 ? C.water : C.navy;
      const o = (y * W + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
    }
  }
}

// ------------------------------------------------------------------ scenery

/** What can stand beside each theme's tracks: frame names from the atlas, with sizes. */
export function placeScenery(t, f, theme, catalog, seed = 1) {
  const rnd = mulberry32(seed * 31 + 7);
  const { W, H, coarse } = f;
  const occ = new Uint8Array(Math.ceil(W / 4) * Math.ceil(H / 4));
  const ow = Math.ceil(W / 4);
  const items = [];
  const free = (x, y, w, h) => {
    for (let yy = Math.floor(y / 4); yy <= Math.floor((y + h - 1) / 4); yy++) {
      for (let xx = Math.floor(x / 4); xx <= Math.floor((x + w - 1) / 4); xx++) if (occ[yy * ow + xx]) return false;
    }
    return true;
  };
  const take = (x, y, w, h) => {
    for (let yy = Math.floor(y / 4) - 1; yy <= Math.floor((y + h - 1) / 4) + 1; yy++) {
      for (let xx = Math.floor(x / 4) - 1; xx <= Math.floor((x + w - 1) / 4) + 1; xx++) if (yy >= 0 && xx >= 0 && xx < ow) occ[yy * ow + xx] = 1;
    }
  };
  const clear = (x, y, w, h, minD) => {
    if (x < 2 || y < 2 || x + w > W - 2 || y + h > H - 2) return false;
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2], [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2]]) {
      const d = coarse(px, py) - 6;   // coarse cells are 8 px: be conservative
      if (d < minD) return false;
      if (isWater(theme, px, py, d + 6, seed)) return false;
    }
    return true;
  };
  const minD = t.wall + 8;
  const sets = catalog[theme] || [];
  // Several passes: big things first, then fill in with smaller ones.
  for (const set of sets) {
    const tries = Math.round((W * H) / set.every);
    for (let k = 0; k < tries; k++) {
      const name = set.frames[Math.floor(rnd() * set.frames.length)];
      const [w, h] = catalog.sizes[name] || [16, 16];
      const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H);
      const near = coarse(x + w / 2, y + h / 2);
      if (set.maxD && near > set.maxD) continue;
      if (!clear(x, y, w, h, set.minD ?? minD)) continue;
      if (!free(x, y, w, h)) continue;
      take(x, y, w, h);
      items.push({ name, x, y, w, h });
    }
  }
  items.sort((a, b) => a.y + a.h - (b.y + b.h));
  return items;
}

/** Street lamps along the track for night races (alternating sides). */
export function lampSpots(t, every = 120) {
  const out = [];
  const step = Math.round(every / t.step);
  for (let i = 0, k = 0; i < t.n; i += step, k++) {
    const side = k % 2 ? 1 : -1; const lat = side * (t.wall + 5);
    out.push({ x: t.x[i] - t.ty[i] * lat, y: t.y[i] + t.tx[i] * lat });
  }
  return out;
}

/** Night or rain lighting over the finished picture (in place). */
export function light(data, W, H, mood, lamps = [], seed = 1) {
  if (mood === 'day') return;
  if (mood === 'rain') {
    for (let o = 0; o < data.length; o += 4) {
      data[o] = data[o] * 0.7; data[o + 1] = data[o + 1] * 0.75; data[o + 2] = Math.min(255, data[o + 2] * 0.85 + 8);
    }
    return;
  }
  // night: dark blue everywhere, warm pools of light round the lamps (stepped, dithered edges)
  const level = new Uint8Array(W * H);
  for (const l of lamps) {
    const R = 46;
    for (let y = Math.max(0, Math.floor(l.y - R)); y < Math.min(H, l.y + R); y++) {
      for (let x = Math.max(0, Math.floor(l.x - R)); x < Math.min(W, l.x + R); x++) {
        const d = Math.hypot(x - l.x, y - l.y) + (hash2(x, y, seed) - 0.5) * 6;
        const v = d < 26 ? 2 : d < R ? 1 : 0;
        const k = y * W + x;
        if (v > level[k]) level[k] = v;
      }
    }
  }
  const M = [[0.34, 0.38, 0.6], [0.62, 0.62, 0.7], [0.95, 0.9, 0.8]];
  for (let k = 0, o = 0; k < W * H; k++, o += 4) {
    const m = M[level[k]];
    data[o] = data[o] * m[0]; data[o + 1] = data[o + 1] * m[1]; data[o + 2] = data[o + 2] * m[2];
  }
}
