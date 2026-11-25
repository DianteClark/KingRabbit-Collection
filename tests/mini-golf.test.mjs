// Mini Golf: ball physics, aiming rules, hole data, and a known way to hole every hole within par + 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/mini-golf/logic/', import.meta.url);
const P = await import(new URL('physics.js', base));
const A = await import(new URL('aim.js', base));
const H = await import(new URL('holes.js', base));
const S = await import(new URL('solver.js', base));
const { SOLUTIONS } = await import(new URL('solutions.js', base));

const UP = -Math.PI / 2;
const lane = (extra = {}) => P.compileHole({ id: 't', par: 2, bounds: { r: [0, 0, 120, 1400] }, tee: [60, 1300], cup: [60, 40], ...extra });
const run = (W, power, angle = UP, from = [60, 1300], t0 = 0) => P.simulate(W, from[0], from[1], t0, angle, power, { path: true });

// ------------------------------------------------------------------ physics

test('a putt rolls, slows and stops; harder goes further', () => {
  const W = lane();
  const soft = run(W, 0.3); const hard = run(W, 0.7);
  assert.equal(soft.status, 'rest');
  assert.equal(hard.status, 'rest');
  assert.ok(1300 - soft.y > 60, 'a soft putt still travels');
  assert.ok(1300 - hard.y > (1300 - soft.y) * 1.8, 'more power, much further');
  assert.ok(Math.abs(soft.x - 60) < 0.01, 'a straight putt stays straight');
  assert.ok(soft.t < 8, 'and settles in a few seconds');
});

test('the same putt always ends in the same place (deterministic)', () => {
  const W = P.compileHole(H.holeById('1-4'));
  const a = P.simulate(W, 120, 370, 0, -1.3, 0.8); const b = P.simulate(W, 120, 370, 0, -1.3, 0.8);
  assert.deepEqual([a.x, a.y, a.status], [b.x, b.y, b.status]);
});

test('sand stops the ball sooner, ice lets it run', () => {
  const grass = run(lane(), 0.5);
  const sand = run(lane({ zones: [{ r: [0, 0, 120, 1400], t: 'sand' }] }), 0.5);
  const ice = run(lane({ zones: [{ r: [0, 0, 120, 1400], t: 'ice' }] }), 0.5);
  const d = (r) => 1300 - r.y;
  assert.ok(d(sand) < d(grass) * 0.5, `sand ${d(sand)} vs grass ${d(grass)}`);
  assert.ok(d(ice) > d(grass) * 1.5, `ice ${d(ice)} vs grass ${d(grass)}`);
});

test('walls bounce the ball back, losing a little speed', () => {
  const W = P.compileHole({ id: 't', par: 2, bounds: { r: [0, 0, 400, 120] }, tee: [200, 60], cup: [380, 100] });
  const b = P.newBall(200, 60);
  P.shoot(b, Math.PI, 0.5); // left, toward the wall at x = 0
  const ev = [];
  let t = 0;
  while (b.vx < 0 && t < 3) { P.step(W, b, t, ev); t += P.DT; }
  assert.ok(b.vx > 0, 'heading right after the bounce');
  assert.ok(b.vx < 300, 'slower than it hit');
  assert.ok(b.x >= P.BALL_R - 0.01, 'never inside the wall');
  assert.ok(ev.some((e) => e.type === 'wall'));
});

test('bumpers kick the ball away faster', () => {
  const W = lane({ bumpers: [[60, 1220, 10]] });
  const b = P.newBall(60, 1300);
  P.shoot(b, UP, 0.4);
  const ev = []; let t = 0;
  while (!ev.some((e) => e.type === 'bumper') && t < 3) { P.step(W, b, t, ev); t += P.DT; }
  assert.ok(ev.some((e) => e.type === 'bumper'));
  assert.ok(b.vy > 0, 'sent back down');
  assert.ok(Math.hypot(b.vx, b.vy) >= 250, 'with a kick');
});

test('water is a hazard; a ramp jumps a fast ball over it', () => {
  const moat = lane({ zones: [{ r: [0, 900, 120, 70], t: 'water' }, { r: [30, 970, 60, 26], t: 'ramp', dir: [0, -1] }] });
  assert.equal(run(moat, 0.75).status, 'water', 'too slow off the ramp: splash');
  const jump = run(moat, 1);
  assert.ok(jump.events.some((e) => e.type === 'ramp'));
  assert.notEqual(jump.status, 'water', 'full power clears the moat');
  assert.ok(jump.y < 900);
  const around = run(moat, 1, UP, [15, 1300]);
  assert.equal(around.status, 'water', 'missing the ramp ends in the water');
});

test('portals move the ball to their twin and keep its speed', () => {
  const W = P.compileHole({ id: 't', par: 2, bounds: { r: [0, 0, 300, 600] }, blocks: [{ r: [0, 280, 300, 20] }], tee: [60, 560], cup: [240, 40], teleports: [{ a: [60, 400], b: [240, 200] }] });
  const r = P.simulate(W, 60, 560, 0, UP, 0.5);
  assert.ok(r.events.some((e) => e.type === 'teleport'));
  assert.ok(r.y < 280 && r.x > 150, 'ended past the wall, on the far side');
  assert.equal(r.status, 'rest');
});

test('boost pads speed the ball up; slopes roll it downhill', () => {
  const boost = run(lane({ zones: [{ r: [0, 1240, 120, 40], t: 'boost', dir: [0, -1] }] }), 0.35);
  assert.ok(1300 - boost.y > (1300 - run(lane(), 0.35).y) + 150);
  const W = P.compileHole({ id: 't', par: 2, bounds: { r: [0, 0, 400, 100] }, tee: [200, 50], cup: [380, 50], zones: [{ r: [0, 0, 400, 100], t: 'slope', g: [-120, 0] }] });
  const r = P.simulate(W, 200, 50, 0, 0, 0.05);
  assert.ok(r.x < 30, `a weak putt uphill rolls back down to the low wall (x=${r.x})`);
  assert.equal(r.status, 'rest');
});

test('the cup catches a gentle ball, a fast one skips over', () => {
  const W = lane();
  let holed = null;
  for (let p = 0.1; p <= 1; p += 0.01) { if (run(W, p, UP, [60, 300]).status === 'holed') { holed = p; break; } }
  assert.ok(holed, 'some power holes a straight putt');
  // straight at the cup from close range at full power: too fast to drop, it rolls on past
  const fast = P.simulate(W, 60, 140, 0, UP, 1, { stopAfter: 125 });
  assert.equal(fast.status, 'moving');
  assert.ok(fast.y < 40 - P.CUP_R, 'past the cup');
});

test('a windmill sail blocks the way at the right moment', () => {
  const W = lane({ movers: [{ t: 'windmill', x: 60, y: 1200, len: 40, blades: 2, speed: 0, phase: 0 }] });
  // speed 0 and phase 0: a sail lies across the lane (horizontal), so the ball bounces back
  const r = run(W, 0.4, UP, [40, 1300]);
  assert.ok(r.events.some((e) => e.type === 'windmill'));
  assert.ok(r.y > 1200);
  const open = lane({ movers: [{ t: 'windmill', x: 100, y: 1200, len: 40, blades: 2, speed: 0, phase: Math.PI / 2 }] });
  assert.ok(run(open, 0.4, UP, [40, 1300]).y < 1200, 'with the sails upright the ball passes');
});

test('a sliding block shoves a resting ball instead of overlapping it', () => {
  const W = lane({ movers: [{ t: 'slider', r: [0, 600, 40, 20], to: [80, 0], period: 2 }] });
  const b = P.newBall(60, 610);
  let t = 0; let moved = false;
  for (let k = 0; k < 240; k++) { if (P.step(W, b, t) === 'moving') moved = true; t += P.DT; if (!b.moving) continue; while (b.moving) { P.step(W, b, t); t += P.DT; } }
  assert.ok(moved, 'the slider pushed the ball');
  assert.ok(P.validSpot(W, b.x, b.y, t), 'and it ended somewhere legal');
});

test('random putts on every hole always end in a legal state (no soft-locks)', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const h of [...H.HOLES, ...H.DAILY_HOLES]) {
    const W = P.compileHole(h);
    let x = W.tee.x; let y = W.tee.y; let t = 0;
    for (let k = 0; k < 14; k++) {
      const r = P.simulate(W, x, y, t + rnd() * 3, rnd() * Math.PI * 2, 0.1 + rnd() * 0.9);
      assert.ok(['rest', 'holed', 'water', 'reset'].includes(r.status), `${h.id} status ${r.status}`);
      assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y), `${h.id} position`);
      assert.ok(r.t - t < P.MAX_SIM_TIME + 5, `${h.id} putt ended`);
      if (r.status === 'rest') {
        assert.ok(P.validSpot({ ...W, movers: [] }, r.x, r.y), `${h.id}: ball rested in a wall or hazard at ${r.x},${r.y}`);
        x = r.x; y = r.y;
      }
      if (r.status === 'holed') { x = W.tee.x; y = W.tee.y; }
      t = r.t;
    }
  }
});

// ------------------------------------------------------------------ aiming

test('a tap never putts; dragging back onto the ball cancels', () => {
  assert.ok(A.grabs(100, 100, 130, 120), 'touches near the ball pick it up');
  assert.ok(!A.grabs(100, 100, 200, 100));
  assert.equal(A.aimFromDrag(100, 100, 100, 104, 4).cancelled, true, 'a tap');
  assert.equal(A.aimFromDrag(100, 100, 100, 108, 9).cancelled, true, 'a wobble');
  assert.equal(A.aimFromDrag(100, 100, 102, 105, 120).cancelled, true, 'pulled out, then back onto the ball');
  const s = A.aimFromDrag(100, 100, 100, 180, 80);
  assert.equal(s.cancelled, false);
  assert.ok(Math.abs(s.angle - UP) < 1e-9, 'pulling down sends the ball up');
  assert.ok(s.power > 0.3 && s.power < 0.6);
  assert.equal(A.aimFromDrag(100, 100, 100, 600, 500).power, 1, 'power tops out');
});

// ------------------------------------------------------------------ holes

test('three courses of nine holes, plus daily holes', () => {
  assert.equal(H.COURSES.length, 3);
  for (let c = 0; c < 3; c++) assert.equal(H.holesOf(c).length, 9);
  assert.ok(H.DAILY_HOLES.length >= 5);
  const ids = [...H.HOLES, ...H.DAILY_HOLES].map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  const avg = [0, 1, 2].map((c) => H.coursePar(c) / 9);
  assert.ok(avg[0] <= avg[1] && avg[1] <= avg[2], `pars rise gently: ${avg}`);
  const seen = new Set();
  for (let s = 0; s < 400; s++) seen.add(H.dailyHole(s * 7919).id);
  assert.equal(seen.size, H.DAILY_HOLES.length, 'every daily hole comes up');
});

test('every hole: tee and cup in legal spots, cup reachable, fits the phone', () => {
  for (const h of [...H.HOLES, ...H.DAILY_HOLES]) {
    const W = P.compileHole(h);
    assert.ok(P.validSpot(W, W.tee.x, W.tee.y, 0), `${h.id} tee`);
    assert.ok(P.validSpot({ ...W, movers: [] }, W.cup.x, W.cup.y), `${h.id} cup`);
    assert.ok(Math.hypot(W.tee.x - W.cup.x, W.tee.y - W.cup.y) > 120, `${h.id} tee far from cup`);
    assert.ok(h.par >= 2 && h.par <= 5, `${h.id} par`);
    assert.ok(W.box.w <= 340, `${h.id} fits the screen width`);
    assert.ok(S.cupReachable(W), `${h.id}: the cup can be reached from the tee`);
    assert.ok(h.name && h.tip, `${h.id} has a name and a tip`);
  }
});

test('every hole can be holed within par + 1 (known shots replayed with the real physics)', () => {
  for (const h of [...H.HOLES, ...H.DAILY_HOLES]) {
    const shots = SOLUTIONS[h.id];
    assert.ok(shots, `${h.id} has a recorded solution (run node tests/mini-golf-solutions.mjs)`);
    const r = S.replay(P.compileHole(h), shots.map(([angle, power, wait]) => ({ angle, power, wait })));
    assert.ok(r.holed, `${h.id} ${h.name}: replay holed`);
    assert.ok(r.strokes <= h.par + 1, `${h.id}: ${r.strokes} strokes, par ${h.par}`);
  }
});

test('the solver finds a way in on simple holes', () => {
  const easy = S.solve(P.compileHole(H.holeById('1-1')), { limit: 3 });
  assert.ok(easy && easy.strokes <= 2);
  const portal = S.solve(P.compileHole(H.holeById('2-5')), { limit: 3, angles: 48 });
  assert.ok(portal && portal.strokes <= 3, 'through the portal');
});

test('stars and score names', () => {
  assert.equal(H.starsFor(2, 3), 3);
  assert.equal(H.starsFor(3, 3), 3);
  assert.equal(H.starsFor(4, 3), 2);
  assert.equal(H.starsFor(8, 3), 1);
  assert.equal(H.starsFor(null, 3), 0);
  assert.equal(H.scoreName(1, 3), 'Hole in one!');
  assert.equal(H.scoreName(2, 3), 'Birdie!');
  assert.equal(H.scoreName(3, 3), 'Par');
  assert.equal(H.strokeCap({ par: 3 }), 8);
});
