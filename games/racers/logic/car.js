// Top-down arcade car physics. One step function for you and the computer drivers alike.
// Units: world pixels and seconds. Heading 0 points right (+x), angles grow clockwise on screen.
import { locate, wrapAngle, pointAt, wrapIdx } from './track.js';

export const DT = 1 / 60;
export const CAR_R = 5;            // collision radius (cars are about 16 x 9 px)

// Garage. Stats are 1-5 for the bars; physics() turns them into numbers.
export const MODELS = [
  { id: 'hatch', name: 'Pocket Hatch', stats: { speed: 3, accel: 3, grip: 3, drift: 3 }, unlock: null },
  { id: 'buggy', name: 'Dune Buggy', stats: { speed: 2, accel: 5, grip: 4, drift: 2 }, unlock: null },
  { id: 'coupe', name: 'Street Coupe', stats: { speed: 4, accel: 2, grip: 2, drift: 4 }, unlock: null },
  { id: 'muscle', name: 'Muscle Car', stats: { speed: 5, accel: 3, grip: 2, drift: 3 }, unlock: 'sunny' },
  { id: 'rally', name: 'Rally Star', stats: { speed: 4, accel: 4, grip: 4, drift: 4 }, unlock: 'moon' },
  { id: 'gold', name: 'Golden Arrow', stats: { speed: 5, accel: 5, grip: 4, drift: 5 }, unlock: 'champ' },
];

export const COLOURS = [
  { id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }, { id: 'yellow', name: 'Yellow' },
  { id: 'green', name: 'Green' }, { id: 'purple', name: 'Purple' }, { id: 'white', name: 'White' },
  { id: 'orange', name: 'Orange' }, { id: 'black', name: 'Black' },
];

export const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[0];

/** Physics numbers for a model. */
export function physics(model) {
  const s = (model.stats || model);
  return {
    top: 150 + s.speed * 6,            // px/s (156-180)
    accel: 70 + s.accel * 14,          // px/s^2 at a standstill
    grip: 6 + s.grip * 1.3,            // how fast sideways slip dies away (1/s)
    turn: 2.05 + s.grip * 0.06,        // rad/s at speed
    driftTurn: 3.2,                    // rad/s while drifting
    driftGrip: 1.6,
    driftGain: 0.33 + s.drift * 0.05,  // boost meter per second of full drift
    brake: 260,
  };
}

export function newCar(model, x, y, heading, extra = {}) {
  return {
    model: model.id || model, p: physics(model),
    x, y, h: heading, vx: 0, vy: 0, w: 0,
    idx: null, lat: 0, s: 0, dist: 0, maxDist: 0, lap: 0, lapStart: 0, lapTimes: [],
    boost: 0,               // meter 0..1
    boostT: 0,              // seconds of boost left
    padT: 0,
    drifting: false, driftT: 0, driftDir: 0,
    offRoad: false, wallHit: 0, stuckT: 0, ghostT: 0, wrongT: 0, puddle: 0,
    finished: false, finishTime: null, respawns: 0,
    ...extra,
  };
}

/** Put a car on the track at sample index i (fractional ok), lateral offset lat, standing still. */
export function placeCar(t, car, i, lat = 0) {
  const p = pointAt(t, i, lat);
  car.x = p.x; car.y = p.y; car.h = p.heading; car.vx = 0; car.vy = 0; car.w = 0;
  car.idx = wrapIdx(t, Math.floor(i));
  const loc = locate(t, car.x, car.y, car.idx);
  car.idx = loc.i; car.lat = loc.lat; car.s = loc.s;
}

export const speedOf = (c) => Math.hypot(c.vx, c.vy);
export const forwardSpeed = (c) => c.vx * Math.cos(c.h) + c.vy * Math.sin(c.h);

/**
 * One physics step. input = { steer -1..1, gas 0..1, brake bool, drift bool, boost bool }.
 * `drift` is the brake/drift button: held while steering at speed it starts a slide, held
 * otherwise it brakes (and reverses from a standstill). env = { grip multiplier, speedMul }.
 * Returns a list of events ('wall', 'boost', 'pad', 'driftEnd', 'respawn').
 */
export function stepCar(t, car, input, dt = DT, env = {}) {
  const ev = [];
  const P = car.p;
  const cos = Math.cos(car.h); const sin = Math.sin(car.h);
  let vf = car.vx * cos + car.vy * sin;
  let vr = -car.vx * sin + car.vy * cos;
  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  let brake = !!input.brake;
  // brake/drift button: a slide when turning at speed, brakes otherwise
  const wantDrift = !!input.drift && Math.abs(steer) > 0.2 && vf > 60;
  if (input.drift && !wantDrift && !car.drifting) brake = true;
  if (wantDrift && !car.drifting) { car.drifting = true; car.driftT = 0; car.driftDir = Math.sign(steer); }
  if (car.drifting && (!input.drift || vf < 40)) {
    car.drifting = false;
    ev.push({ type: 'driftEnd', t: car.driftT });
  }

  // boost: the button burns meter; pads give a free burst
  if (input.boost && car.boost >= 0.25 && car.boostT <= 0) {
    car.boostT = 0.6 + car.boost * 1.0;
    car.boost = 0;
    ev.push({ type: 'boost' });
  }
  const boosting = car.boostT > 0 || car.padT > 0;
  if (car.boostT > 0) car.boostT -= dt;
  if (car.padT > 0) car.padT -= dt;

  const grip = (env.grip ?? 1) * (car.puddle > 0 ? 0.45 : 1);
  let top = P.top * (env.speedMul ?? 1) * (car.offRoad ? 0.72 : 1);
  if (boosting) top *= 1.32;

  // engine
  const gas = Math.max(0, Math.min(1, input.gas ?? 0));
  if (brake) {
    if (vf > 5) vf -= P.brake * dt;
    else vf = Math.max(-45, vf - 90 * dt);          // reverse slowly
  } else if (gas > 0 || boosting) {
    const g = boosting ? 1 : gas;
    if (vf < top) vf += P.accel * (boosting ? 1.8 : 1) * g * Math.max(0.15, 1 - vf / top) * dt;
    else vf -= (vf - top) * 1.5 * dt;
  } else {
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), 40 * dt);   // rolling
  }
  if (vf > top) vf -= (vf - top) * 2 * dt;
  if (car.drifting) vf -= vf * 0.12 * dt;              // slides scrub a little speed

  // steering: needs some speed, reverses when going backwards
  const speedFac = Math.min(1, Math.abs(vf) / 45);
  const rate = car.drifting ? P.driftTurn : P.turn;
  let wantW = steer * rate * speedFac * Math.sign(vf || 1);
  if (car.drifting) wantW = (0.55 * car.driftDir + 0.6 * steer) * rate * speedFac;   // held in the slide
  // steering assist (yours only, switchable): with no steering held, the car gently lines itself
  // up with the road, so a late or missed correction doesn't end in the wall
  if (input.assist && Math.abs(steer) < 0.1 && !car.drifting && vf > 30 && car.idx != null) {
    const err = wrapAngle(Math.atan2(t.ty[car.idx], t.tx[car.idx]) - car.h);
    if (Math.abs(err) < 1.2) wantW += Math.max(-input.assist, Math.min(input.assist, err * 3));
  }
  car.w += (wantW - car.w) * Math.min(1, dt * 14);
  car.h = wrapAngle(car.h + car.w * dt);

  // sideways grip: the slide dies away (slowly while drifting)
  const g = (car.drifting ? P.driftGrip : P.grip) * grip;
  vr *= Math.exp(-g * dt);
  if (car.drifting) {
    car.driftT += dt;
    car.boost = Math.min(1, car.boost + P.driftGain * dt * Math.min(1, Math.abs(vf) / 120));
  }

  const c2 = Math.cos(car.h); const s2 = Math.sin(car.h);
  // velocity re-expressed against the new heading keeps most of its forward part (arcade feel)
  car.vx = vf * c2 - vr * s2;
  car.vy = vf * s2 + vr * c2;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  collideTrack(t, car, ev);
  if (car.ghostT > 0) car.ghostT -= dt;
  return ev;
}

/** Keep the car inside the walls, work out where it is on the lap and what it's driving on. */
export function collideTrack(t, car, ev = []) {
  const prevS = car.s;
  let loc = locate(t, car.x, car.y, car.idx);
  const lim = t.wall - CAR_R + 1;
  if (Math.abs(loc.lat) > lim) {
    // push back inside along the normal, kill the outward speed, scrub some forward speed
    const i0 = loc.i; const i1 = wrapIdx(t, i0 + 1);
    const nx = -(t.ty[i0] + t.ty[i1]) / 2; const ny = (t.tx[i0] + t.tx[i1]) / 2;
    const L = Math.hypot(nx, ny) || 1;
    const sign = Math.sign(loc.lat);
    const over = Math.abs(loc.lat) - lim;
    car.x -= (nx / L) * sign * over; car.y -= (ny / L) * sign * over;
    const vn = (car.vx * nx + car.vy * ny) / L * sign;
    const impact = Math.max(0, vn);
    if (vn > 0) { car.vx -= (nx / L) * sign * vn * 1.25; car.vy -= (ny / L) * sign * vn * 1.25; }
    const scrub = 1 - Math.min(0.35, impact / 300 + 0.004);
    car.vx *= scrub; car.vy *= scrub;
    if (impact > 25) { ev.push({ type: 'wall', impact }); car.wallHit++; }
    loc = locate(t, car.x, car.y, loc.i);
  }
  car.idx = loc.i; car.lat = loc.lat;
  car.offRoad = Math.abs(loc.lat) > t.hw + 1;
  // distance driven along the lap, unwrapped (backwards counts against you)
  let ds = loc.s - prevS;
  if (ds > t.length / 2) ds -= t.length; else if (ds < -t.length / 2) ds += t.length;
  if (car.sInit) car.dist += ds; else car.sInit = true;
  car.s = loc.s;
  // boost pads and puddles
  for (const p of t.pads) {
    const qx = car.x - p.x; const qy = car.y - p.y;
    if (Math.abs(qx * p.tx + qy * p.ty) < p.len / 2 + 2 && Math.abs(-qx * p.ty + qy * p.tx) < p.w / 2 + 2) {
      if (car.padT <= 0.2) ev.push({ type: 'pad' });
      car.padT = 0.9;
    }
  }
  car.puddle = 0;
  for (const p of t.puddles) if (Math.hypot((car.x - p.x) / 1.4, car.y - p.y) < p.r) car.puddle = 1;
  return ev;
}

/** Put a stuck (or lost) car back in the middle of the road where it was, facing the right way. */
export function respawn(t, car) {
  const i = wrapIdx(t, (car.idx ?? 0) - 2);
  const dist = car.dist; const s = car.s;
  placeCar(t, car, i, 0);
  car.dist = dist; car.s = s;  // keep lap progress continuous (placeCar re-locates nearby)
  const loc = locate(t, car.x, car.y, car.idx);
  let ds = loc.s - s;
  if (ds > t.length / 2) ds -= t.length; else if (ds < -t.length / 2) ds += t.length;
  car.dist += ds; car.s = loc.s;
  car.boostT = 0; car.padT = 0; car.drifting = false; car.ghostT = 1.5; car.stuckT = 0; car.respawns++;
}

/** Car-to-car bumps: push apart and trade a little speed along the line between them. */
export function collideCars(cars) {
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a]; const B = cars[b];
      if (A.ghostT > 0 || B.ghostT > 0 || A.finishedHidden || B.finishedHidden) continue;
      const dx = B.x - A.x; const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      const min = CAR_R * 2 + 1;
      if (d >= min || d === 0) continue;
      const nx = dx / d; const ny = dy / d;
      const push = (min - d) / 2;
      A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
      const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
      if (rel < 0) {
        const j = -rel * 0.85;
        A.vx -= nx * j / 2; A.vy -= ny * j / 2; B.vx += nx * j / 2; B.vy += ny * j / 2;
        A.bumped = B.bumped = Math.abs(rel);
      }
    }
  }
}
