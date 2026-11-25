// Mini Golf ball physics. Pure and deterministic (fixed time step) so the game, the solver and the
// node tests all run exactly the same simulation.
//
// A hole (see holes.js) is compiled once with compileHole(), then a ball is moved with step().
// World units are pixels at zoom 1. Moving obstacles depend only on the world time t.

export const BALL_R = 5;
export const CUP_R = 8;
export const TELE_R = 10;
export const DT = 1 / 120;
export const MAX_SPEED = 600;       // ball speed at full power
export const CAPTURE_SPEED = 340;   // faster than this and the ball skips over the cup
export const MAX_SIM_TIME = 25;     // seconds; a ball still moving after this is stopped

// Rolling resistance per surface: speed drops by (a + b * speed) per second.
export const SURFACES = {
  grass: { a: 55, b: 0.8 },
  sand: { a: 420, b: 3.2 },
  ice: { a: 9, b: 0.1 },
};
const WALL_E = 0.78;          // bounciness of walls
const BUMPER_KICK = 1.25;     // bumpers give back more than they take
const BUMPER_MIN = 260;
const BOOST_TARGET = 520;
const BOOST_ACC = 1800;
const CUP_PULL = 520;

// ------------------------------------------------------------------ shapes

/** Shapes in hole data: { r: [x, y, w, h] } | { c: [x, y, r] } | { p: [[x, y], ...] }. */
export function shapeOf(s) {
  if (s.r) return { kind: 'rect', x: s.r[0], y: s.r[1], w: s.r[2], h: s.r[3] };
  if (s.c) return { kind: 'circle', x: s.c[0], y: s.c[1], rad: s.c[2] };
  if (s.p) return { kind: 'poly', pts: s.p };
  throw new Error('bad shape');
}

export function contains(sh, x, y) {
  if (sh.kind === 'rect') return x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h;
  if (sh.kind === 'circle') return (x - sh.x) ** 2 + (y - sh.y) ** 2 <= sh.rad * sh.rad;
  return inPoly(sh.pts, x, y);
}

export function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyOf(sh) {
  if (sh.kind === 'poly') return sh.pts;
  if (sh.kind === 'rect') return [[sh.x, sh.y], [sh.x + sh.w, sh.y], [sh.x + sh.w, sh.y + sh.h], [sh.x, sh.y + sh.h]];
  const n = 16;
  return Array.from({ length: n }, (_, k) => [sh.x + Math.cos((k / n) * Math.PI * 2) * sh.rad, sh.y + Math.sin((k / n) * Math.PI * 2) * sh.rad]);
}

function edges(pts, out, tag) {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]; const [bx, by] = pts[(i + 1) % pts.length];
    out.push({ ax, ay, bx, by, tag });
  }
}

export function bbox(pts) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ------------------------------------------------------------------ moving obstacles

const smooth = (u) => u * u * (3 - 2 * u);

/** 0..1 travel of a slider at time t. hold > 0 makes it pause at each end (gates). */
export function sliderPos(m, t) {
  const u = (((t / m.period + (m.phase || 0)) % 1) + 1) % 1;
  const hold = m.hold || 0;
  if (!hold) return 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
  const move = 0.5 - hold;
  if (u < hold) return 0;
  if (u < 0.5) return smooth((u - hold) / move);
  if (u < 0.5 + hold) return 1;
  return 1 - smooth((u - 0.5 - hold) / move);
}

/** The rectangle of a slider at time t, with its velocity. */
export function sliderRect(m, t) {
  const k = sliderPos(m, t);
  const e = 1e-3;
  const dk = (sliderPos(m, t + e) - sliderPos(m, t - e)) / (2 * e);
  return { x: m.r[0] + m.to[0] * k, y: m.r[1] + m.to[1] * k, w: m.r[2], h: m.r[3], vx: m.to[0] * dk, vy: m.to[1] * dk };
}

/** Angle of windmill blade k at time t. */
export const bladeAngle = (m, t, k) => (m.phase || 0) + m.speed * t + (k * Math.PI * 2) / (m.blades || 4);

// ------------------------------------------------------------------ compile

/** Turn hole data into a world ready for step(). */
export function compileHole(h) {
  const bounds = h.bounds.r
    ? polyOf(shapeOf(h.bounds))
    : h.bounds.p;
  const segs = [];
  edges(bounds, segs, 'wall');
  const blocks = (h.blocks || []).map((b) => polyOf(shapeOf(b)));
  for (const b of blocks) edges(b, segs, 'wall');
  const zones = (h.zones || []).map((z) => ({ ...z, shape: shapeOf(z) }));
  const bumpers = (h.bumpers || []).map(([x, y, r]) => ({ x, y, r: r || 9 }));
  const teleports = (h.teleports || []).map((tp) => ({ a: tp.a, b: tp.b }));
  const movers = (h.movers || []).map((m) => ({ ...m }));
  return {
    hole: h, bounds, blocks, segs, zones, bumpers, teleports, movers,
    cup: { x: h.cup[0], y: h.cup[1] }, tee: { x: h.tee[0], y: h.tee[1] },
    box: bbox(bounds),
  };
}

/** Which zone (sand, water, ice, slope, boost, ramp) is under a point; later zones sit on top. */
export function zoneAt(W, x, y) {
  for (let i = W.zones.length - 1; i >= 0; i--) if (contains(W.zones[i].shape, x, y)) return W.zones[i];
  return null;
}

/** Is a resting ball here somewhere sensible (inside the course, not in a wall or obstacle)? */
export function validSpot(W, x, y, t = 0) {
  if (!inPoly(W.bounds, x, y)) return false;
  for (const b of W.blocks) if (inPoly(b, x, y)) return false;
  for (const bp of W.bumpers) if (Math.hypot(x - bp.x, y - bp.y) < bp.r + BALL_R - 1) return false;
  for (const m of W.movers) {
    if (m.t === 'slider') {
      const r = sliderRect(m, t);
      if (x > r.x - 1 && x < r.x + r.w + 1 && y > r.y - 1 && y < r.y + r.h + 1) return false;
    }
  }
  const z = zoneAt(W, x, y);
  if (z && z.t === 'water') return false;
  return true;
}

// ------------------------------------------------------------------ ball

export function newBall(x, y) {
  return { x, y, vx: 0, vy: 0, moving: false, air: 0, airDur: 0, simT: 0, slow: 0, teleLock: -1, fromX: x, fromY: y };
}

/** Hit the ball. power 0..1 maps to 0..MAX_SPEED. */
export function shoot(b, angle, power) {
  const sp = Math.max(0, Math.min(1, power)) * MAX_SPEED;
  b.fromX = b.x; b.fromY = b.y;
  b.vx = Math.cos(angle) * sp; b.vy = Math.sin(angle) * sp;
  b.moving = true; b.simT = 0; b.slow = 0; b.air = 0; b.airDur = 0;
}

function closest(s, x, y) {
  const dx = s.bx - s.ax; const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  let u = len2 ? ((x - s.ax) * dx + (y - s.ay) * dy) / len2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return [s.ax + dx * u, s.ay + dy * u];
}

/** Push the ball out of a segment and bounce it. (ux, uy) is the obstacle's own velocity. */
function hitSeg(b, s, ux, uy, ev, tag) {
  const [qx, qy] = closest(s, b.x, b.y);
  let nx = b.x - qx; let ny = b.y - qy;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R) return false;
  if (d < 1e-6) { nx = -(s.by - s.ay); ny = s.bx - s.ax; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; } else { nx /= d; ny /= d; }
  b.x += nx * (BALL_R - d); b.y += ny * (BALL_R - d);
  const rvx = b.vx - ux; const rvy = b.vy - uy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx -= (1 + WALL_E) * vn * nx; b.vy -= (1 + WALL_E) * vn * ny;
    // a little scrub along the wall
    const tx = -ny; const ty = nx;
    const vt = (b.vx - ux) * tx + (b.vy - uy) * ty;
    b.vx -= vt * 0.04 * tx; b.vy -= vt * 0.04 * ty;
    if (ev && -vn > 25) ev.push({ type: tag, speed: -vn });
  }
  return true;
}

function hitCircle(b, cx, cy, r, ev, kick) {
  let nx = b.x - cx; let ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= r + BALL_R) return false;
  if (d < 1e-6) { nx = 1; ny = 0; } else { nx /= d; ny /= d; }
  b.x = cx + nx * (r + BALL_R); b.y = cy + ny * (r + BALL_R);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    if (kick) {
      b.vx -= vn * nx * (1 + BUMPER_KICK); b.vy -= vn * ny * (1 + BUMPER_KICK);
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < BUMPER_MIN) { b.vx += nx * (BUMPER_MIN - sp); b.vy += ny * (BUMPER_MIN - sp); }
      ev?.push({ type: 'bumper', x: cx, y: cy });
    } else {
      b.vx -= (1 + WALL_E) * vn * nx; b.vy -= (1 + WALL_E) * vn * ny;
      if (ev && -vn > 25) ev.push({ type: 'wall', speed: -vn });
    }
  }
  return true;
}

function collideMovers(W, b, t, ev) {
  for (const m of W.movers) {
    if (m.t === 'slider') {
      const r = sliderRect(m, t);
      if (b.x < r.x - BALL_R || b.x > r.x + r.w + BALL_R || b.y < r.y - BALL_R || b.y > r.y + r.h + BALL_R) continue;
      const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
      // Ball centre inside the block (it moved onto the ball): push out the short way.
      if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) {
        const opts = [[b.x - r.x, -1, 0], [r.x + r.w - b.x, 1, 0], [b.y - r.y, 0, -1], [r.y + r.h - b.y, 0, 1]].sort((p, q) => p[0] - q[0]);
        const [dd, nx, ny] = opts[0];
        b.x += nx * (dd + BALL_R); b.y += ny * (dd + BALL_R);
        b.vx = r.vx + nx * 60; b.vy = r.vy + ny * 60;
        ev?.push({ type: 'mover' });
        continue;
      }
      let touched = false;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = pts[i]; const [bx, by] = pts[(i + 1) % 4];
        if (hitSeg(b, { ax, ay, bx, by }, r.vx, r.vy, ev, 'mover')) touched = true;
      }
      if (touched) squeeze(W, b, r);
    } else if (m.t === 'windmill') {
      const n = m.blades || 4;
      if (Math.hypot(b.x - m.x, b.y - m.y) > m.len + BALL_R + 2) continue;
      for (let k = 0; k < n; k++) {
        const a = bladeAngle(m, t, k);
        const s = { ax: m.x, ay: m.y, bx: m.x + Math.cos(a) * m.len, by: m.y + Math.sin(a) * m.len };
        const [qx, qy] = closest(s, b.x, b.y);
        // velocity of the blade where it touches: omega x r
        const ux = -m.speed * (qy - m.y); const uy = m.speed * (qx - m.x);
        hitSeg(b, s, ux, uy, ev, 'windmill');
      }
      hitCircle(b, m.x, m.y, 4, ev, false);
    }
  }
}

/** Pinned between a sliding block and a wall: pop the ball out sideways instead of through the wall. */
function squeeze(W, b, r) {
  let pinned = false;
  for (const s of W.segs) {
    const [qx, qy] = closest(s, b.x, b.y);
    if (Math.hypot(b.x - qx, b.y - qy) < BALL_R - 0.5) { pinned = true; break; }
  }
  if (!pinned && !insideSolid(W, b.x, b.y)) return;
  const opts = Math.abs(r.vx) >= Math.abs(r.vy)
    ? [[b.x, r.y - BALL_R - 0.5], [b.x, r.y + r.h + BALL_R + 0.5]]
    : [[r.x - BALL_R - 0.5, b.y], [r.x + r.w + BALL_R + 0.5, b.y]];
  opts.sort((p, q) => Math.hypot(p[0] - b.x, p[1] - b.y) - Math.hypot(q[0] - b.x, q[1] - b.y));
  const ok = opts.find(([x, y]) => !insideSolid(W, x, y)) || opts[0];
  const dx = ok[0] - b.x; const dy = ok[1] - b.y; const d = Math.hypot(dx, dy) || 1;
  b.x = ok[0]; b.y = ok[1];
  b.vx = (dx / d) * 40; b.vy = (dy / d) * 40;
}

function insideSolid(W, x, y) {
  if (!inPoly(W.bounds, x, y)) return true;
  for (const bl of W.blocks) if (inPoly(bl, x, y)) return true;
  return false;
}

/**
 * Advance the ball one DT at world time t. Returns 'moving' | 'rest' | 'holed' | 'water' | 'reset'.
 * ev (optional array) collects events for sounds and trophies.
 */
export function step(W, b, t, ev) {
  if (!b.moving) {
    // A resting ball can still be shoved by a moving obstacle.
    const px = b.x; const py = b.y;
    collideMovers(W, b, t, ev);
    if (Math.hypot(b.vx, b.vy) > 15 || Math.hypot(b.x - px, b.y - py) > 0.5) { b.moving = true; b.simT = 0; b.slow = 0; return 'moving'; }
    b.vx = 0; b.vy = 0;
    return 'rest';
  }
  let sp = Math.hypot(b.vx, b.vy);
  const n = Math.max(1, Math.ceil((sp * DT) / 2));
  const h = DT / n;
  let force = false;
  for (let i = 0; i < n; i++) {
    const tt = t + h * i;
    const z = b.air > 0 ? null : zoneAt(W, b.x, b.y);
    const surf = SURFACES[z?.t] || SURFACES.grass;
    force = false;
    if (z?.t === 'slope') { b.vx += z.g[0] * h; b.vy += z.g[1] * h; force = Math.hypot(z.g[0], z.g[1]) > surf.a; }
    if (z?.t === 'boost') {
      const along = b.vx * z.dir[0] + b.vy * z.dir[1];
      if (along < BOOST_TARGET) { b.vx += z.dir[0] * BOOST_ACC * h; b.vy += z.dir[1] * BOOST_ACC * h; }
      force = true;
      if (!b.boosted) { b.boosted = true; ev?.push({ type: 'boost' }); }
    } else b.boosted = false;
    if (z?.t === 'ramp' && b.air <= 0) {
      const along = b.vx * z.dir[0] + b.vy * z.dir[1];
      if (along > 150) { b.airDur = Math.min(0.9, 0.25 + along / 900); b.air = b.airDur; ev?.push({ type: 'ramp' }); }
    }
    const cdx = W.cup.x - b.x; const cdy = W.cup.y - b.y;
    const cd = Math.hypot(cdx, cdy);
    if (b.air <= 0 && cd < CUP_R + 3 && cd > 0.01) { b.vx += (cdx / cd) * CUP_PULL * h; b.vy += (cdy / cd) * CUP_PULL * h; }
    // rolling resistance
    sp = Math.hypot(b.vx, b.vy);
    if (b.air <= 0 && sp > 0) {
      const ns = Math.max(0, sp - (surf.a + surf.b * sp) * h);
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
    if (b.air > 0) { b.air -= h; if (b.air <= 0) { b.air = 0; ev?.push({ type: 'land' }); } }
    const ox = b.x; const oy = b.y;
    b.x += b.vx * h; b.y += b.vy * h;
    for (const s of W.segs) hitSeg(b, s, 0, 0, ev, 'wall');
    for (const bp of W.bumpers) hitCircle(b, bp.x, bp.y, bp.r, ev, true);
    collideMovers(W, b, tt, ev);
    // Safety net: never let the ball tunnel into a wall or off the course.
    if (insideSolid(W, b.x, b.y)) { b.x = ox; b.y = oy; b.vx *= -0.5; b.vy *= -0.5; }
    // teleporters
    for (let k = 0; k < W.teleports.length; k++) {
      const tp = W.teleports[k];
      if (b.teleLock === k) { if (Math.hypot(b.x - tp.b[0], b.y - tp.b[1]) > TELE_R + BALL_R) b.teleLock = -1; continue; }
      if (b.air <= 0 && Math.hypot(b.x - tp.a[0], b.y - tp.a[1]) < TELE_R - 2) {
        b.x = tp.b[0]; b.y = tp.b[1]; b.teleLock = k;
        ev?.push({ type: 'teleport', k });
        break;
      }
    }
    if (b.air <= 0) {
      const z2 = zoneAt(W, b.x, b.y);
      if (z2?.t === 'water') { b.moving = false; b.vx = 0; b.vy = 0; ev?.push({ type: 'water' }); return 'water'; }
      const d2 = Math.hypot(W.cup.x - b.x, W.cup.y - b.y);
      if (d2 < CUP_R - 1 && Math.hypot(b.vx, b.vy) < CAPTURE_SPEED) {
        b.x = W.cup.x; b.y = W.cup.y; b.vx = 0; b.vy = 0; b.moving = false;
        ev?.push({ type: 'holed' });
        return 'holed';
      }
    }
  }
  b.simT += DT;
  sp = Math.hypot(b.vx, b.vy);
  b.slow = sp < 14 ? b.slow + DT : 0;
  if (b.air <= 0 && ((sp < 4 && !force) || b.slow > 0.6 || b.simT > MAX_SIM_TIME)) {
    b.vx = 0; b.vy = 0; b.moving = false;
    if (!validSpot(W, b.x, b.y, t + DT)) return 'reset';
    return 'rest';
  }
  return 'moving';
}

/**
 * Play a whole shot from (x, y) starting at world time t0. Used by the solver, the tests and the
 * aim preview. Returns { status, x, y, t, events, path? }.
 */
export function simulate(W, x, y, t0, angle, power, { path = false, maxTime = MAX_SIM_TIME, stopAfter } = {}) {
  const b = newBall(x, y);
  shoot(b, angle, power);
  const events = [];
  const pts = path ? [[x, y, 0]] : null;
  let t = t0; let status = 'moving';
  let travelled = 0;
  while (status === 'moving') {
    const px = b.x; const py = b.y;
    status = step(W, b, t, events);
    t += DT;
    travelled += Math.hypot(b.x - px, b.y - py);
    if (pts) pts.push([b.x, b.y, b.air > 0 ? Math.sin((1 - b.air / b.airDur) * Math.PI) : 0]);
    if (stopAfter && travelled >= stopAfter) break;
    if (t - t0 > maxTime + 1) { status = 'rest'; break; }
  }
  return { status, x: b.x, y: b.y, t, events, path: pts, from: [x, y] };
}
