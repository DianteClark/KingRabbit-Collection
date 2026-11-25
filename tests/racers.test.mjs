// Tiny Town Racers: track geometry, car physics, the computer drivers, laps and positions, cups,
// ghosts, the daily challenge, the adaptive level and the touch layout, all in node.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/racers/', import.meta.url).href;
const { buildTrack, validate, locate, pointAt, racingLine } = await import(base + 'logic/track.js');
const { TRACKS, CUPS, LAYOUTS, trackDef, LAPS } = await import(base + 'logic/tracks.js');
const { newCar, stepCar, placeCar, collideTrack, respawn, physics, MODELS, modelById, DT, forwardSpeed, speedOf, CAR_R } = await import(base + 'logic/car.js');
const { Race, simulate, getTrack, rubberBand, COUNTDOWN } = await import(base + 'logic/race.js');
const getAI = await import(base + 'logic/ai.js');
const { tune } = getAI;
const CUP = await import(base + 'logic/cup.js');
const { paintTrack, placeScenery, gridSlots, C } = await import(base + 'logic/raster.js');
const { layout, steerFromX, inCircle, W, H } = await import(base + 'layout.js');

const rivals = (skills, models = ['hatch', 'buggy', 'coupe', 'muscle', 'rally']) => skills.map((s, k) => ({ name: `AI${k}`, model: models[k % models.length], colour: 'red', skill: s, lane: (k - 2) * 3 }));

// ------------------------------------------------------------------ tracks

test('there are 12 tracks in 3 cups of 4, covering every theme in day, night and rain', () => {
  assert.equal(TRACKS.length, 12);
  assert.equal(CUPS.length, 3);
  for (const c of CUPS) assert.equal(c.tracks.length, 4);
  for (const th of ['downtown', 'harbor', 'park', 'highway']) assert.ok(TRACKS.some((t) => t.theme === th));
  for (const m of ['day', 'night', 'rain']) assert.ok(TRACKS.filter((t) => t.mood === m).length >= 3);
  assert.ok(Object.keys(LAYOUTS).length >= 8);
});

test('every track is a clean closed loop: no folds, no parts of the corridor touching', () => {
  for (const tr of TRACKS) {
    const t = buildTrack(trackDef(tr.id));
    assert.deepEqual(validate(t), [], tr.id);
    assert.ok(t.length > 2400 && t.length < 4200, `${tr.id} length ${t.length}`);
    assert.ok(t.W <= 2048 && t.H <= 2048, `${tr.id} texture ${t.W}x${t.H}`);
    // evenly sampled, start/finish on a straight
    for (let i = 0; i < t.n; i++) {
      const j = (i + 1) % t.n;
      assert.ok(Math.abs(Math.hypot(t.x[j] - t.x[i], t.y[j] - t.y[i]) - t.step) < 0.5);
    }
    for (let i = t.n - 25; i < t.n + 10; i++) assert.ok(Math.abs(t.curv[i % t.n]) < 1 / 150, `${tr.id}: start should be on a straight`);
  }
});

test('reversed tracks run the same road the other way from the same line', () => {
  const a = buildTrack(trackDef('downtown'));
  const b = buildTrack(trackDef('downtown-r'));
  assert.ok(Math.abs(a.length - b.length) < 30);
  assert.ok(Math.hypot(a.x[0] - b.x[0], a.y[0] - b.y[0]) < 2);
  assert.ok(a.tx[0] * b.tx[0] + a.ty[0] * b.ty[0] < -0.95);
});

test('locate only looks near the hint, so progress can never jump across to another part', () => {
  const t = buildTrack(trackDef('harbor'));
  const far = Math.floor(t.n / 2);
  const p = pointAt(t, far, 0);
  const near = locate(t, p.x, p.y, 10);
  assert.ok(Math.abs(near.i - 10) <= 15, 'stays near the hint');
  const any = locate(t, p.x, p.y);
  assert.ok(Math.abs(any.i - far) <= 1, 'a full search finds it');
});

test('racing line stays inside the road and is smoother than the centreline', () => {
  for (const id of ['downtown', 'park2' in LAYOUTS ? 'moonpark' : 'park']) {
    const t = buildTrack(trackDef(id));
    const line = racingLine(t);
    let kc = 0; let kl = 0;
    for (let i = 0; i < t.n; i++) {
      assert.ok(Math.abs(line.off[i]) <= t.hw - 8);
      kc += Math.abs(t.curv[i]); kl += line.k[i];
    }
    assert.ok(kl < kc, `${id}: line ${kl} vs centre ${kc}`);
  }
});

// ------------------------------------------------------------------ physics

// A long, wide oval: two 3000 px straights for the physics tests.
const OVAL = { id: 'oval', points: [[0, 0], [1500, 0], [3000, 0], [3000, 700], [1500, 700], [0, 700]], width: 60, pads: [], puddles: [] };

function onStraight(id = null) {
  const t = buildTrack(id ? trackDef(id) : OVAL);
  const car = newCar(modelById('hatch'), 0, 0, 0);
  placeCar(t, car, 2, 0);
  return { t, car };
}

test('cars accelerate to their top speed and the faster model is faster', () => {
  const tops = {};
  for (const m of ['buggy', 'muscle']) {
    const t = buildTrack(OVAL);
    const car = newCar(modelById(m), 0, 0, 0);
    placeCar(t, car, 0, 0);
    let steps = 0;
    while (steps < 60 * 4) { stepCar(t, car, { gas: 1 }); steps++; }
    tops[m] = forwardSpeed(car);
    assert.ok(tops[m] > physics(modelById(m)).top * 0.85, `${m} ${tops[m]}`);
  }
  assert.ok(tops.muscle > tops.buggy);
});

test('boost needs meter, empties it, and lifts the top speed; pads boost for free', () => {
  const { t, car } = onStraight();
  for (let i = 0; i < 240; i++) stepCar(t, car, { gas: 1 });
  const v0 = forwardSpeed(car);
  const ev0 = stepCar(t, car, { gas: 1, boost: true });
  assert.ok(!ev0.some((e) => e.type === 'boost'), 'no meter, no boost');
  car.boost = 1;
  const ev = stepCar(t, car, { gas: 1, boost: true });
  assert.ok(ev.some((e) => e.type === 'boost'));
  assert.equal(car.boost, 0);
  for (let i = 0; i < 60; i++) stepCar(t, car, { gas: 1 });
  assert.ok(forwardSpeed(car) > v0 * 1.1, `${forwardSpeed(car)} vs ${v0}`);
});

test('drifting needs steering and speed, fills the boost meter and turns tighter', () => {
  const run = (drift) => {
    const { t, car } = onStraight();
    for (let i = 0; i < 150; i++) stepCar(t, car, { gas: 1 });
    const h0 = car.h;
    for (let i = 0; i < 30; i++) stepCar(t, car, { gas: 1, steer: 1, drift });
    return { car, turned: Math.abs(car.h - h0) };
  };
  const plain = run(false); const slide = run(true);
  assert.ok(slide.car.boost > 0.1, `meter ${slide.car.boost}`);
  assert.equal(plain.car.boost, 0);
  assert.ok(slide.turned > plain.turned);
  // without steering the same button is a brake
  const { t, car } = onStraight();
  for (let i = 0; i < 150; i++) stepCar(t, car, { gas: 1 });
  const v = forwardSpeed(car);
  for (let i = 0; i < 30; i++) stepCar(t, car, { gas: 1, drift: true });
  assert.ok(!car.drifting && forwardSpeed(car) < v - 60);
});

test('walls hold every car inside the track, whatever it does', () => {
  for (const id of ['downtown', 'storm', 'wetway']) {
    const t = buildTrack(trackDef(id));
    const car = newCar(modelById('muscle'), 0, 0, 0);
    placeCar(t, car, 5, 0);
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    let inp = {};
    for (let i = 0; i < 60 * 60; i++) {
      if (i % 30 === 0) inp = { gas: 1, steer: rnd() * 2 - 1, drift: rnd() < 0.3, boost: rnd() < 0.1 };
      if (i % 200 === 0) car.boost = 1;
      stepCar(t, car, inp);
      assert.ok(Math.abs(car.lat) <= t.wall - CAR_R + 1.5, `${id} step ${i} lat ${car.lat}`);
    }
  }
});

test('a car shoved across a gap cannot skip ahead: it is pushed back where it was', () => {
  const t = buildTrack(trackDef('park'));
  const car = newCar(modelById('hatch'), 0, 0, 0);
  placeCar(t, car, 40, 0);
  car.sInit = true;
  const d0 = car.dist;
  // find a far-away bit of track that is close in a straight line
  let best = null;
  for (let j = 0; j < t.n; j++) {
    const arc = Math.min(Math.abs(j - 40), t.n - Math.abs(j - 40)) * t.step;
    if (arc < 600) continue;
    const d = Math.hypot(t.x[j] - t.x[40], t.y[j] - t.y[40]);
    if (!best || d < best.d) best = { j, d };
  }
  car.x = t.x[best.j]; car.y = t.y[best.j];
  collideTrack(t, car);
  assert.ok(Math.abs(car.dist - d0) < 150, `progress moved ${car.dist - d0}`);
  assert.ok(car.dist - d0 < 60, 'no gain from the shove');
  assert.ok(Math.abs(car.idx - 40) < 40);
});

test('a stuck car is put back on the road facing the right way, progress kept', () => {
  const { t, car } = onStraight('downtown');
  car.idx = 100; placeCar(t, car, 100, 0);
  car.dist = 400; car.s = 100 * t.step;
  car.h += Math.PI;   // facing backwards
  respawn(t, car);
  assert.ok(Math.abs(car.lat) < 2);
  assert.ok(Math.cos(car.h) * t.tx[car.idx] + Math.sin(car.h) * t.ty[car.idx] > 0.9);
  assert.ok(Math.abs(car.dist - 400) < 20);
  assert.ok(car.ghostT > 0);
});

test('the race respawns a car that sits nose-in to a wall', () => {
  const race = new Race({ trackId: 'downtown', player: { model: 'hatch', colour: 'red' }, rivals: [], grid: 0 });
  for (let i = 0; i < (COUNTDOWN + 0.1) / DT; i++) race.step({});
  const p = race.player;
  // point it straight at the wall and keep the gas down
  const nx = -race.t.ty[p.idx]; const ny = race.t.tx[p.idx];
  p.h = Math.atan2(ny, nx);
  let respawned = false;
  for (let i = 0; i < 60 * 6; i++) {
    const ev = race.step({ gas: 1 });
    if (ev.some((e) => e.type === 'respawn')) { respawned = true; break; }
  }
  assert.ok(respawned);
});

// ------------------------------------------------------------------ AI, laps, positions

test('the computer finishes every track at every skill level, laps counted correctly', () => {
  for (const tr of TRACKS) {
    const race = simulate({ trackId: tr.id, rivals: rivals([0, 0.25, 0.5, 0.75, 1, 0.5]) }, 200);
    const L = race.t.length;
    for (const c of race.cars) {
      assert.ok(c.finished, `${tr.id}: ${c.name} did not finish (dist ${c.dist})`);
      assert.equal(c.lap, LAPS);
      assert.equal(c.lapTimes.length, LAPS);
      const sum = c.lapTimes.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - c.finishTime) < 0.05, `${tr.id} lap times add up`);
      assert.ok(c.finishDist >= LAPS * L && c.finishDist < LAPS * L + 10);
      assert.ok(c.lapTimes.every((x) => x > 12 && x < 45), `${tr.id} ${c.lapTimes}`);
      assert.ok(c.respawns <= 1, `${tr.id}: ${c.name} respawned ${c.respawns}x`);
    }
    // never faster than physically possible along the centreline (no shortcuts)
    const fastest = Math.min(...race.cars.map((c) => Math.min(...c.lapTimes.slice(1))));
    assert.ok(fastest > (L * 0.8) / (physics(modelById('rally')).top * 1.32), `${tr.id} lap ${fastest}`);
  }
});

test('higher skill drives faster on average', () => {
  let low = 0; let high = 0;
  for (const id of ['downtown', 'park', 'neon', 'storm']) {
    const race = simulate({ trackId: id, rivals: [0.1, 0.9].map((s, k) => ({ name: `s${k}`, model: 'hatch', colour: 'red', skill: s, lane: k ? 6 : -6 })) }, 200);
    low += race.cars[0].finishTime; high += race.cars[1].finishTime;
  }
  assert.ok(high < low * 0.97, `high ${high} low ${low}`);
  assert.ok(tune(0).pace < tune(0.5).pace && tune(0.5).pace < tune(1).pace);
});

test('rubber banding is gentle: never more than 5%', () => {
  for (let gap = -3000; gap <= 3000; gap += 50) {
    const m = rubberBand(gap);
    assert.ok(m >= 0.95 && m <= 1.04);
  }
  assert.equal(rubberBand(0), 1);
  assert.ok(rubberBand(800) < 1 && rubberBand(-800) > 1);
});

test('driving backwards over the line does not count a lap, and a full lap counts once', () => {
  const race = new Race({ trackId: 'downtown', player: { model: 'hatch', colour: 'red' }, rivals: [], grid: 0 });
  const p = race.player;
  for (let i = 0; i < (COUNTDOWN + 0.1) / DT; i++) race.step({});
  const d0 = p.dist;
  for (let i = 0; i < 120; i++) race.step({ drift: true });   // reverse
  assert.ok(p.dist < d0);
  assert.equal(p.lap, 0);
  // now let the computer drive it round
  const { newDriver, drive } = getAI;
  const brain = newDriver(race.t, race.line, p, { skill: 1 });
  const laps = [];
  for (let i = 0; i < 60 * 120 && !p.finished; i++) {
    const ev = race.step(drive(race.t, race.line, brain, p, race.cars, race.time));
    for (const e of ev) if (e.type === 'lap' || e.type === 'finish') laps.push(e.type);
  }
  assert.deepEqual(laps, ['lap', 'lap', 'finish']);
  assert.equal(race.phase, 'done');
  assert.equal(race.results()[0].human, true);
});
test('positions follow distance, finishers first; results estimate the rest', () => {
  const race = new Race({ trackId: 'park', player: { model: 'gold', colour: 'red' }, rivals: rivals([0.5, 0.5, 0.5, 0.5, 0.5]), grid: 5 });
  assert.equal(race.cars.length, 6);
  assert.equal(race.positionOf(race.player), 6, 'starts at the back');
  const brain = getAI.newDriver(race.t, race.line, race.player, { skill: 1 });
  let p2Last = false;
  for (let i = 0; i < 60 * 200 && !race.player.finished; i++) {
    race.step(getAI.drive(race.t, race.line, brain, race.player, race.cars, race.time));
    const st = race.standings();
    for (let k = 1; k < st.length; k++) if (!st[k].finished && !st[k - 1].finished) assert.ok(st[k - 1].dist >= st[k].dist);
    if (race.player.lap === 1 && race.positionOf(race.player) === 6) p2Last = true;
  }
  assert.ok(race.player.finished);
  const res = race.results();
  assert.deepEqual(res.map((r) => r.place), [1, 2, 3, 4, 5, 6]);
  for (let k = 1; k < res.length; k++) assert.ok(res[k].time >= res[k - 1].time);
  void p2Last;
});

test('grid slots sit behind the line on the road, two abreast', () => {
  for (const tr of TRACKS) {
    const t = buildTrack(trackDef(tr.id));
    const slots = gridSlots(t, 6);
    for (const s of slots) {
      const loc = locate(t, s.x, s.y);
      assert.ok(Math.abs(loc.lat) < t.hw - 6);
      assert.ok(loc.s > t.length - 120, `${tr.id} slot behind the line`);
    }
  }
});

// ------------------------------------------------------------------ cups, unlocks, ghosts, daily

test('cup points, table and the next track', () => {
  let cup = CUP.newCup(0);
  assert.equal(CUP.nextTrack(cup), 'downtown');
  const order = ['Ace', 'You', 'Rosa', 'Ziggy', 'Max', 'Dot'];
  cup = CUP.addRace(cup, order);
  assert.equal(cup.points.Ace, 10); assert.equal(cup.points.You, 8); assert.equal(cup.points.Dot, 3);
  for (let r = 0; r < 3; r++) cup = CUP.addRace(cup, ['You', 'Ace', 'Rosa', 'Ziggy', 'Max', 'Dot']);
  assert.ok(CUP.cupOver(cup));
  assert.equal(CUP.playerPlace(cup), 1);
  assert.equal(CUP.table(cup)[0].points, 38);
});

test('cups and cars unlock in order', () => {
  let prog = { cups: [null, null, null] };
  assert.ok(CUP.cupUnlocked(prog, 0));
  assert.ok(!CUP.cupUnlocked(prog, 1));
  assert.ok(!CUP.trackUnlocked(prog, 'neon'));
  let r = CUP.finishCup(prog, 0, 4);
  assert.equal(r.newCup, null); assert.equal(r.newCar, null);
  r = CUP.finishCup(r.progress, 0, 3);
  assert.equal(r.newCup.id, 'moon'); assert.equal(r.newCar, null);
  assert.ok(CUP.trackUnlocked(r.progress, 'neon'));
  r = CUP.finishCup(r.progress, 0, 1);
  assert.equal(r.newCar.id, 'muscle'); assert.equal(r.newCup, null);
  assert.ok(CUP.carUnlocked(r.progress, 'muscle'));
  assert.ok(!CUP.carUnlocked(r.progress, 'gold'));
  // a worse finish later never takes anything away
  r = CUP.finishCup(r.progress, 0, 6);
  assert.equal(r.progress.cups[0], 1);
  assert.equal(MODELS.filter((m) => !m.unlock).length, 3);
});

test('rivals: five of them, never in your colour, stronger in later cups', () => {
  const a = CUP.rivalsFor(0.5, { cup: 0, avoidColour: 'blue' });
  assert.equal(a.length, 5);
  assert.ok(a.every((r) => r.colour !== 'blue'));
  const b = CUP.rivalsFor(0.5, { cup: 2 });
  assert.ok(b.every((r, i) => r.skill >= a[i].skill));
  assert.ok(CUP.rivalsFor(1, { cup: 2 }).every((r) => r.skill <= 1));
});

test('ghost laps pack to a short string and play back where you drove', () => {
  const race = new Race({ trackId: 'downtown', player: { model: 'hatch', colour: 'red' }, rivals: [], grid: 0, record: true });
  const brain = getAI.newDriver(race.t, race.line, race.player, { skill: 0.8 });
  for (let i = 0; i < 60 * 120 && !race.player.finished; i++) race.step(getAI.drive(race.t, race.line, brain, race.player, race.cars, race.time));
  const laps = race.record.laps;
  assert.equal(laps.length, 3);
  const lap = laps[1];
  const str = CUP.packGhost(lap.frames);
  assert.ok(str.length < 9000, `ghost ${str.length} chars`);
  const back = CUP.unpackGhost(str);
  assert.equal(back.length, lap.frames.length);
  assert.ok(back.every((v, i) => v === lap.frames[i]));
  const g = CUP.ghostAt(back, 1.0);
  assert.ok(g && Number.isFinite(g.x) && Number.isFinite(g.h));
  const loc = locate(race.t, g.x, g.y);
  assert.ok(Math.abs(loc.lat) < race.t.wall);
  assert.equal(CUP.ghostAt(back, lap.time + 5), null);
});

test('daily challenge: same config for the same seed, always valid', () => {
  const a = CUP.dailyConfig(12345); const b = CUP.dailyConfig(12345);
  assert.deepEqual(a, b);
  const seen = new Set();
  for (let s = 1; s < 400; s++) {
    const c = CUP.dailyConfig(s * 7919);
    assert.ok(TRACKS.some((t) => t.id === c.trackId));
    assert.ok(MODELS.some((m) => m.id === c.model));
    seen.add(c.trackId);
  }
  assert.ok(seen.size >= 10);
  assert.equal(CUP.fmtTime(83.456), '1:23.46');
  assert.equal(CUP.fmtTime(5), '0:05.00');
});

// ------------------------------------------------------------------ picture and scenery

test('the painted track: asphalt on the centre line, barrier at the wall, scenery off the road', () => {
  const tr = trackDef('downtown');
  const t = buildTrack(tr);
  const r = paintTrack(t, { theme: tr.theme, mood: 'day', seed: 3 });
  assert.equal(r.data.length, t.W * t.H * 4);
  const px = (x, y) => { const o = (Math.round(y) * t.W + Math.round(x)) * 4; return [r.data[o], r.data[o + 1], r.data[o + 2]]; };
  const i = Math.floor(t.n / 3);
  const mid = px(t.x[i] - t.ty[i] * 6, t.y[i] + t.tx[i] * 6);
  assert.ok([C.asphalt, C.asphalt2].some((c) => c.join() === mid.join()), `centre ${mid}`);
  const catalog = { sizes: { a: [24, 32], b: [10, 12] }, downtown: [{ frames: ['a', 'b'], every: 600 }] };
  const items = placeScenery(t, r.f, 'downtown', catalog, 3);
  assert.ok(items.length > 20);
  for (const it of items) {
    for (const [x, y] of [[it.x, it.y], [it.x + it.w, it.y + it.h], [it.x + it.w / 2, it.y + it.h / 2]]) {
      const loc = locate(t, x, y);
      assert.ok(Math.hypot(x - (t.x[loc.i]), y - t.y[loc.i]) > t.wall, 'scenery clear of the road');
    }
  }
});

// ------------------------------------------------------------------ touch layout

test('race controls: big enough, on screen, not overlapping, clear of the top bar and map', () => {
  for (const auto of [true, false]) {
    const L = layout(auto);
    const rects = [];
    for (const [k, b] of Object.entries(L.buttons)) {
      assert.ok(b.r * 2 >= 64, `${k} hit area`);
      assert.ok(b.x - b.r >= 0 && b.x + b.r <= W && b.y + b.r <= H && b.y - b.r > L.bar, k);
      assert.ok(b.x - b.r - 10 > L.steerMaxX, `${k} clear of the steering side`);
      rects.push({ k, x0: b.x - b.r - 10, y0: b.y - b.r - 10, x1: b.x + b.r + 10, y1: b.y + b.r + 10 });
    }
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const A = rects[a]; const B = rects[b];
        // circles with their +10 touch slack must not overlap
        const ba = L.buttons[A.k]; const bb = L.buttons[B.k];
        assert.ok(Math.hypot(ba.x - bb.x, ba.y - bb.y) >= ba.r + bb.r + 4, `${A.k}/${B.k}`);
      }
      const bt = L.buttons[rects[a].k];
      const M = L.map;
      assert.ok(bt.y - bt.r > M.y + M.h || bt.x + bt.r < M.x, 'map clear of buttons');
    }
    for (const p of L.pads) {
      assert.ok(p.w >= 64 && p.h >= 64);
      assert.ok(p.x + p.w / 2 <= L.steerMaxX);
      assert.equal(steerFromX(p.x, L), p.dir);
    }
    assert.equal(steerFromX(10, L), -1);
    assert.equal(steerFromX(L.steerMaxX - 1, L), 1);
    assert.ok(inCircle(L.buttons.boost.x + L.buttons.boost.r + 5, L.buttons.boost.y, L.buttons.boost, 10));
  }
});
