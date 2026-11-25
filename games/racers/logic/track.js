// Track geometry: a closed centreline (Catmull-Rom spline through control points) resampled at an
// even spacing, with tangents, normals, curvature and arc length. Cars live in a corridor around
// it: the road is ±half width, a sidewalk/verge runs out to the wall, and the wall is solid.
// Everything here is plain JS so node tests can drive whole races.

export const SPACING = 4;          // world px between centreline samples
export const SIDE = 8;             // verge between the road edge and the wall
export const MARGIN = 150;         // scenery beyond the track's outermost point

/** Centripetal Catmull-Rom through closed control points -> dense polyline. */
function spline(points, perSeg = 24) {
  const n = points.length;
  const out = [];
  const P = (i) => points[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1); const p1 = P(i); const p2 = P(i + 1); const p3 = P(i + 2);
    const d = (a, b) => Math.max(1e-3, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0; const t1 = t0 + d(p0, p1); const t2 = t1 + d(p1, p2); const t3 = t2 + d(p2, p3);
    for (let k = 0; k < perSeg; k++) {
      const t = t1 + ((t2 - t1) * k) / perSeg;
      const lerp = (a, b, ta, tb) => [
        ((tb - t) / (tb - ta)) * a[0] + ((t - ta) / (tb - ta)) * b[0],
        ((tb - t) / (tb - ta)) * a[1] + ((t - ta) / (tb - ta)) * b[1],
      ];
      const A1 = lerp(p0, p1, t0, t1); const A2 = lerp(p1, p2, t1, t2); const A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2); const B2 = lerp(A2, A3, t1, t3);
      out.push(lerp(B1, B2, t1, t2));
    }
  }
  return out;
}

/** Resample a closed polyline at an even spacing. */
function resample(poly, spacing) {
  const n = poly.length;
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const a = poly[i - 1]; const b = poly[i % n];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[n];
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = k * step;
    while (cum[j + 1] < s) j++;
    const a = poly[j]; const b = poly[(j + 1) % n];
    const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return { pts: out, step, total };
}

/** Ease off any corner tighter than minR (so the inner wall never folds over itself). */
function relax(r, minR) {
  let { pts } = r;
  for (let it = 0; it < 80; it++) {
    const n = pts.length;
    const bad = new Uint8Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 2 + n) % n]; const p = pts[i]; const b = pts[(i + 2) % n];
      const h0 = Math.atan2(p[1] - a[1], p[0] - a[0]); const h1 = Math.atan2(b[1] - p[1], b[0] - p[0]);
      const ds = (Math.hypot(p[0] - a[0], p[1] - a[1]) + Math.hypot(b[0] - p[0], b[1] - p[1])) / 2 || 1;
      if (Math.abs(wrapAngle(h1 - h0)) / ds > 1 / (minR + 2)) {
        for (let k = -8; k <= 8; k++) bad[(i + k + n) % n] = 1;
        any = true;
      }
    }
    if (!any) break;
    const next = pts.map((p, i) => {
      if (!bad[i]) return p;
      const a = pts[(i - 3 + n) % n]; const b = pts[(i + 3) % n];
      return [p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25];
    });
    r = resample(next, SPACING);
    pts = r.pts;
  }
  return r;
}

/**
 * Build a track from a definition { points, width, reverse?, pads?, puddles? }.
 * Returns sample arrays and helpers; samples go in the racing direction.
 */
export function buildTrack(def) {
  const sc = def.scale || 1;
  const P = def.points.map((p) => [p[0] * sc, p[1] * sc]);
  // Start/finish halfway along the first straight (control points 0 -> 1).
  let pts0 = [[(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], ...P.slice(1), P[0]];
  // Reversed: same start point, the other way round.
  if (def.reverse) pts0 = [pts0[0], ...pts0.slice(1).reverse()];
  const minR = def.width / 2 + SIDE + 8;
  const { pts, step, total } = relax(resample(spline(pts0), SPACING), minR);
  const n = pts.length;
  const x = new Float32Array(n); const y = new Float32Array(n);
  const tx = new Float32Array(n); const ty = new Float32Array(n);
  const curv = new Float32Array(n);
  // Shift the loop so the world starts at (0, 0) with MARGIN of scenery round it.
  let mx = Infinity; let my = Infinity;
  for (const p of pts) { mx = Math.min(mx, p[0]); my = Math.min(my, p[1]); }
  for (let i = 0; i < n; i++) { x[i] = Math.round((pts[i][0] - mx + MARGIN) * 100) / 100; y[i] = Math.round((pts[i][1] - my + MARGIN) * 100) / 100; }
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n; const b = (i + 1) % n;
    const dx = x[b] - x[a]; const dy = y[b] - y[a]; const d = Math.hypot(dx, dy) || 1;
    tx[i] = dx / d; ty[i] = dy / d;
  }
  for (let i = 0; i < n; i++) {
    // signed curvature from the turn of the tangent over a few samples (smoother than one step)
    const a = (i - 2 + n) % n; const b = (i + 2) % n;
    const h0 = Math.atan2(ty[a], tx[a]); const h1 = Math.atan2(ty[b], tx[b]);
    curv[i] = wrapAngle(h1 - h0) / (4 * step);
  }
  const hw = def.width / 2;
  const t = {
    def, n, step, length: total, x, y, tx, ty, curv, hw,
    wall: hw + SIDE,            // lateral distance of the wall from the centreline
    // The start/finish line is at sample 0.
  };
  t.pads = (def.pads || []).map(([f, lat]) => padAt(t, f, lat));
  t.puddles = (def.puddles || []).map(([f, lat, r]) => {
    const i = Math.floor(((f % 1) + 1) % 1 * n);
    return { i, x: x[i] - ty[i] * lat, y: y[i] + tx[i] * lat, r };
  });
  t.bounds = bounds(t);
  t.W = Math.ceil(t.bounds.x1 + MARGIN);
  t.H = Math.ceil(t.bounds.y1 + MARGIN);
  return t;
}

function padAt(t, f, lat) {
  const i = Math.floor(((f % 1) + 1) % 1 * t.n);
  return { i, lat, x: t.x[i] - t.ty[i] * lat, y: t.y[i] + t.tx[i] * lat, tx: t.tx[i], ty: t.ty[i], len: 16, w: 14 };
}

function bounds(t) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (let i = 0; i < t.n; i++) {
    x0 = Math.min(x0, t.x[i]); y0 = Math.min(y0, t.y[i]); x1 = Math.max(x1, t.x[i]); y1 = Math.max(y1, t.y[i]);
  }
  return { x0, y0, x1, y1 };
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const wrapIdx = (t, i) => ((i % t.n) + t.n) % t.n;

/**
 * Where is (px, py) relative to the track? Searches only near `hint` (a sample index the thing
 * was close to last step), so a car can never "jump" to another part of the track that happens to
 * be near by: progress can only change continuously. Without a hint the whole track is searched.
 * Returns { i, f, lat, s }: segment start sample, fraction along it, signed lateral offset
 * (positive to the left of the driving direction... in screen space, +normal = (-ty, tx)),
 * and the arc length s in [0, length).
 */
export function locate(t, px, py, hint = null, window = 14) {
  let best = -1; let bd = Infinity;
  if (hint == null) {
    for (let i = 0; i < t.n; i++) {
      const d = (t.x[i] - px) ** 2 + (t.y[i] - py) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  } else {
    for (let k = -window; k <= window; k++) {
      const i = wrapIdx(t, hint + k);
      const d = (t.x[i] - px) ** 2 + (t.y[i] - py) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  }
  // Project onto the segment before or after the best sample, whichever is closer.
  let res = null;
  for (const i0 of [wrapIdx(t, best - 1), best]) {
    const i1 = wrapIdx(t, i0 + 1);
    const ax = t.x[i0]; const ay = t.y[i0];
    const dx = t.x[i1] - ax; const dy = t.y[i1] - ay;
    const L2 = dx * dx + dy * dy || 1;
    let f = ((px - ax) * dx + (py - ay) * dy) / L2;
    f = Math.max(0, Math.min(1, f));
    const qx = ax + dx * f; const qy = ay + dy * f;
    const d = (px - qx) ** 2 + (py - qy) ** 2;
    if (!res || d < res.d) {
      const L = Math.sqrt(L2);
      // left normal of the segment
      const nx = -dy / L; const ny = dx / L;
      res = { i: i0, f, d, lat: (px - qx) * nx + (py - qy) * ny };
    }
  }
  res.s = (res.i + res.f) * t.step;
  return res;
}

/** World position of the point at sample i (fractional ok) with lateral offset lat. */
export function pointAt(t, i, lat = 0) {
  const i0 = Math.floor(i); const f = i - i0;
  const a = wrapIdx(t, i0); const b = wrapIdx(t, i0 + 1);
  const cx = t.x[a] + (t.x[b] - t.x[a]) * f; const cy = t.y[a] + (t.y[b] - t.y[a]) * f;
  const tx = t.tx[a] + (t.tx[b] - t.tx[a]) * f; const ty = t.ty[a] + (t.ty[b] - t.ty[a]) * f;
  const L = Math.hypot(tx, ty) || 1;
  return { x: cx - (ty / L) * lat, y: cy + (tx / L) * lat, heading: Math.atan2(ty, tx) };
}

/**
 * Racing line: lateral offsets that straighten the path inside the road (iterative smoothing of
 * the points toward their neighbours' midpoint, clamped to the corridor), then a target-speed
 * profile for a car that can turn at `turnRate` rad/s and brake at `brake` px/s^2.
 */
export function racingLine(t, margin = 9, iters = 300) {
  const n = t.n;
  const lim = t.hw - margin;
  const off = new Float32Array(n);
  const px = new Float32Array(n); const py = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = t.x[i]; py[i] = t.y[i]; }
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      const a = (i - 3 + n) % n; const b = (i + 3) % n;
      const mx = (px[a] + px[b]) / 2; const my = (py[a] + py[b]) / 2;
      // move toward the midpoint, but only along the normal of the centreline
      const nx = -t.ty[i]; const ny = t.tx[i];
      const want = (mx - t.x[i]) * nx + (my - t.y[i]) * ny;
      off[i] = Math.max(-lim, Math.min(lim, off[i] + (want - off[i]) * 0.5));
      px[i] = t.x[i] + nx * off[i]; py[i] = t.y[i] + ny * off[i];
    }
  }
  // curvature of the line
  const k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n; const b = (i + 3) % n;
    const h0 = Math.atan2(py[i] - py[a], px[i] - px[a]);
    const h1 = Math.atan2(py[b] - py[i], px[b] - px[i]);
    const ds = Math.hypot(px[b] - px[a], py[b] - py[a]) / 2 || 1;
    k[i] = Math.abs(wrapAngle(h1 - h0)) / ds;
  }
  return { off, x: px, y: py, k };
}

/** Target speed at each sample for a car with this top speed, turn rate and braking. */
export function speedProfile(t, line, { top, turnRate, brake }) {
  const n = t.n;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(top, turnRate / Math.max(1e-4, line.k[i]));
  // backward passes (twice round so the wrap is right): you must be able to brake in time
  for (let pass = 0; pass < 2; pass++) {
    for (let j = n - 1; j >= 0; j--) {
      const nxt = v[(j + 1) % n];
      v[j] = Math.min(v[j], Math.sqrt(nxt * nxt + 2 * brake * t.step));
    }
  }
  return v;
}

/**
 * Geometry checks used by the tests and the track editor: no two far-apart parts of the
 * corridor come close enough to touch, and no corner is so tight that the inner wall folds.
 */
export function validate(t, gap = 10) {
  const problems = [];
  const minR = t.wall + 6;
  for (let i = 0; i < t.n; i++) {
    if (Math.abs(t.curv[i]) > 1 / minR) { problems.push({ type: 'tight', i, r: 1 / Math.abs(t.curv[i]) }); break; }
  }
  const skip = Math.ceil((t.wall * 4) / t.step);
  const need = (2 * t.wall + gap) ** 2;
  outer: for (let i = 0; i < t.n; i += 2) {
    for (let j = i + skip; j < t.n; j += 2) {
      if (t.n - (j - i) < skip) continue;
      const d = (t.x[i] - t.x[j]) ** 2 + (t.y[i] - t.y[j]) ** 2;
      if (d < need) { problems.push({ type: 'close', i, j, d: Math.sqrt(d) }); break outer; }
    }
  }
  return problems;
}
