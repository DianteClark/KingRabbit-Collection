// A race: the track, six cars (or one in time trial), the countdown, laps, positions, gentle
// rubber-banding, stuck-car respawns and the finishing order. Fixed 60 Hz steps, no Phaser.
import { buildTrack, racingLine, locate } from './track.js';
import { trackDef, LAPS } from './tracks.js';
import { newCar, stepCar, collideCars, collideTrack, respawn, modelById, DT, forwardSpeed, speedOf } from './car.js';
import { newDriver, drive } from './ai.js';
import { gridSlots } from './raster.js';

export const COUNTDOWN = 3;       // seconds of 3-2-1 before GO
const STUCK_AFTER = 2.2;          // seconds nearly still while trying to go -> respawn
export const FINISH_WINDOW = 25;  // seconds you get after the last rival finishes

const cache = new Map();
/** Track geometry and racing line are pure functions of the track id: build each once. */
export function getTrack(id) {
  if (!cache.has(id)) {
    const def = trackDef(id);
    const t = buildTrack(def);
    cache.set(id, { def, t, line: racingLine(t) });
  }
  return cache.get(id);
}

/**
 * Gentle rubber band: a rival well ahead of you eases off a little, one well behind pushes a
 * little. gap = rival's distance minus yours (px). Never more than 5% either way.
 */
export function rubberBand(gap) {
  if (gap > 140) return 1 - Math.min(0.05, (gap - 140) / 3000);
  if (gap < -160) return 1 + Math.min(0.04, (-gap - 160) / 3000);
  return 1;
}

export class Race {
  /**
   * opts: { trackId, laps, player: { model, colour } | null, rivals: [{ name, model, colour, skill }],
   *         grid: player's slot (0 pole .. 5 back), mode, record (ghost frames) }
   */
  constructor(opts) {
    this.opts = opts;
    const { def, t, line } = getTrack(opts.trackId);
    this.def = def; this.t = t; this.line = line;
    this.laps = opts.laps ?? LAPS;
    this.time = -COUNTDOWN;          // race clock: negative during the countdown
    this.phase = 'countdown';
    this.cars = [];
    this.order = [];                 // finishing order (cars)
    this.events = [];
    this.steps = 0;
    const rivals = opts.rivals || [];
    const slots = gridSlots(t, Math.max(1, rivals.length + (opts.player ? 1 : 0)));
    const pSlot = opts.player ? Math.min(slots.length - 1, opts.grid ?? slots.length - 1) : -1;
    let r = 0;
    for (let k = 0; k < slots.length; k++) {
      const sl = slots[k];
      let car;
      if (k === pSlot) {
        car = newCar(modelById(opts.player.model), sl.x, sl.y, sl.heading, { human: true, name: 'You', colour: opts.player.colour });
        this.player = car;
      } else {
        const rv = rivals[r++];
        car = newCar(modelById(rv.model), sl.x, sl.y, sl.heading, { human: false, name: rv.name, colour: rv.colour });
        car.driver = newDriver(t, line, car, { skill: rv.skill, lane: rv.lane ?? 0, seed: 17 + k * 31 });
        car.skill = rv.skill;
      }
      car.idx = sl.i;
      const loc = locate(t, car.x, car.y, sl.i);
      car.idx = loc.i; car.s = loc.s; car.lat = loc.lat;
      // start behind the line: distance is negative until you cross it
      car.dist = loc.s > t.length / 2 ? loc.s - t.length : loc.s;
      car.sInit = true;
      car.lapStart = 0;
      car.grid = k;
      this.cars.push(car);
    }
    this.record = opts.record ? { frames: [], laps: [] } : null;
    this.stats = { minPosLap2: 1, wallHitsLap: 0, cleanLap: false, longestDrift: 0, boosts: 0, wrongWay: 0 };
  }

  get running() { return this.phase === 'race'; }

  /** Advance one fixed step. input: the player's controls. Returns this step's events. */
  step(input = {}) {
    const ev = [];
    this.events = ev;
    const dt = DT;
    this.steps++;
    if (this.phase === 'countdown') {
      const before = Math.ceil(-this.time);
      this.time += dt;
      const after = Math.ceil(-this.time);
      if (after !== before) ev.push(after > 0 ? { type: 'count', n: after } : { type: 'go' });
      if (this.time >= 0) { this.time = 0; this.phase = 'race'; }
      return ev;
    }
    if (this.phase === 'done') this.time += dt;
    else this.time += dt;
    const leaderDist = Math.max(...this.cars.map((c) => c.dist));
    for (const car of this.cars) {
      if (car.finishedHidden) continue;
      let inp;
      if (car.human && !car.finished) inp = input;
      else if (car.human) inp = { steer: 0, gas: 0, brake: true };
      else {
        // rubber band, kept gentle: at most a few percent either way
        const ref = this.player && !this.player.finished ? this.player.dist : null;
        const paceMul = ref != null ? rubberBand(car.dist - ref) : 1;
        inp = drive(this.t, this.line, car.driver, car, this.cars, this.time, { paceMul });
        if (car.finished) { inp = { ...inp, boost: false }; }
      }
      const env = { grip: this.def.mood === 'rain' ? 0.82 : 1 };
      const evs = stepCar(this.t, car, inp, dt, env);
      for (const e of evs) ev.push({ ...e, car });
      // stuck: trying to move but not getting anywhere (nose in a wall, spun round in traffic)
      const trying = (inp.gas > 0 || inp.brake) && !car.finished;
      if (trying && speedOf(car) < 8) car.stuckT += dt; else car.stuckT = Math.max(0, car.stuckT - dt * 2);
      if (car.stuckT > STUCK_AFTER) { respawn(this.t, car); ev.push({ type: 'respawn', car }); }
      // wrong way
      const tdot = Math.cos(car.h) * this.t.tx[car.idx] + Math.sin(car.h) * this.t.ty[car.idx];
      if (tdot < -0.4 && forwardSpeed(car) > 20) car.wrongT += dt; else car.wrongT = 0;
      if (car.drifting && car.driftT > this.stats.longestDrift && car.human) this.stats.longestDrift = car.driftT;
    }
    collideCars(this.cars);
    for (const car of this.cars) collideTrack(this.t, car, []);
    for (const car of this.cars) this.laps_(car, ev);
    // once every rival is home you get a little while to finish, then the race is called
    const p = this.player;
    if (p && !p.finished && this.cars.length > 1 && this.cars.every((c) => c.human || c.finished)) {
      if (this.deadline == null) this.deadline = this.time + FINISH_WINDOW;
      if (this.time >= this.deadline) {
        p.finished = true; p.dnf = true; p.finishTime = this.time;
        this.order.push(p);
        this.phase = 'done';
        ev.push({ type: 'finish', car: p, place: this.order.length, dnf: true });
      }
    }
    if (this.record && this.player && !this.player.finished && this.steps % 2 === 0) {
      const p = this.player;
      this.record.frames.push(Math.round(p.x * 2), Math.round(p.y * 2), Math.round(p.h * 100));
    }
    if (this.player) this.trackPlayerStats();
    return ev;
  }

  laps_(car, ev) {
    const L = this.t.length;
    if (car.finished) return;
    if (car.dist >= (car.lap + 1) * L) {
      const lapTime = this.time - car.lapStart;
      car.lapTimes.push(lapTime);
      car.lap++;
      car.lapStart = this.time;
      if (car.human) {
        this.stats.cleanLap = this.stats.cleanLap || this.stats.wallHitsLap === 0;
        this.stats.wallHitsLap = 0;
        if (this.record) {
          this.record.laps.push({ time: lapTime, frames: this.record.frames });
          this.record.frames = [];
        }
      }
      if (car.lap >= this.laps) {
        car.finished = true; car.finishTime = this.time; car.finishDist = car.dist;
        this.order.push(car);
        ev.push({ type: 'finish', car, place: this.order.length });
        if (car.human) this.phase = 'done';
      } else ev.push({ type: 'lap', car, lap: car.lap, time: lapTime });
    }
  }

  trackPlayerStats() {
    const p = this.player;
    if (p.lap === 1 && this.positionOf(p) > this.stats.minPosLap2) this.stats.minPosLap2 = this.positionOf(p);
    if (this.events.some((e) => e.type === 'wall' && e.car === p)) this.stats.wallHitsLap++;
    if (this.events.some((e) => e.type === 'boost' && e.car === p)) this.stats.boosts++;
    if (p.wrongT > this.stats.wrongWay) this.stats.wrongWay = p.wrongT;
  }

  /** Cars in race order: finishers first (in order), then by distance driven. */
  standings() {
    const fin = this.order;
    const rest = this.cars.filter((c) => !c.finished).sort((a, b) => b.dist - a.dist);
    return [...fin, ...rest];
  }

  positionOf(car) { return this.standings().indexOf(car) + 1; }

  /**
   * Final results once you have finished. Cars still racing get an estimated time from their
   * average pace so far (the race doesn't make you wait for them).
   */
  results() {
    const L = this.t.length;
    const rows = this.cars.map((c) => {
      let time = c.finishTime;
      let est = false;
      if (time == null) {
        const done = Math.max(1, c.dist);
        const pace = done / Math.max(1, this.time);
        time = this.time + Math.max(0, this.laps * L - c.dist) / Math.max(40, pace);
        est = true;
      }
      return { car: c, name: c.name, human: !!c.human, time, est, dnf: !!c.dnf, best: c.lapTimes.length ? Math.min(...c.lapTimes) : null };
    });
    // finishers keep their order; the rest by estimated time (never ahead of a real finisher)
    const fin = this.order.map((c) => rows.find((r) => r.car === c));
    const rest = rows.filter((r) => !r.car.finished).sort((a, b) => a.time - b.time);
    const lastFin = fin.length ? fin[fin.length - 1].time : 0;
    for (const r of rest) if (r.time <= lastFin) r.time = lastFin + 0.1;
    return [...fin, ...rest].map((r, i) => ({ ...r, place: i + 1 }));
  }
}

/** Run the computer for every car (no human) until all finish or time runs out. For tests. */
export function simulate(opts, maxSeconds = 400) {
  const race = new Race({ ...opts, player: null });
  const steps = Math.round((maxSeconds + COUNTDOWN) / DT);
  for (let k = 0; k < steps; k++) {
    race.step();
    if (race.cars.every((c) => c.finished)) break;
  }
  return race;
}
