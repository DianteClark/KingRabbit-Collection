import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/soccer/logic/', import.meta.url).href;
const { Match, PHASE } = await import(base + 'match.js');
const C = await import(base + 'constants.js');
const { dirIndex } = await import(base + 'frames.js');
const P = await import(base + 'penalties.js');
const Cup = await import(base + 'cup.js');
const T = await import(base + 'teams.js');
const { makeRng, tune } = await import(base + 'util.js');
const { PRESETS, ballPosAt } = await import(base + 'ai.js');

const DT = 1 / 60;

/** Play a whole match; `onStep(m)` may return a human input. Collects health checks as it goes. */
function play(opts, onStep = null) {
  const m = new Match(opts);
  const health = { maxEdgeT: 0, maxUntouched: 0, nan: false, steps: 0 };
  const edgeT = new Map();
  let untouched = 0; let lastTouch = null;
  while (m.phase !== PHASE.OVER && health.steps < 60 * 60 * 12) {
    const input = onStep ? onStep(m) : null;
    m.step(DT, input);
    m.events.length = 0;
    health.steps++;
    for (const p of m.players) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) health.nan = true;
      // Pinned against the outer edge of the run-off area (where keepOnField clamps)?
      const atEdge = p.x <= -C.MARGIN + 6.5 || p.x >= C.W + C.MARGIN - 6.5 || p.y <= -C.MARGIN + 6.5 || p.y >= C.L + C.MARGIN - 6.5;
      const ai = !(m.humanSide !== null && p === m.active);
      const t = atEdge && ai && m.phase === PHASE.PLAY ? (edgeT.get(p) || 0) + DT : 0;
      edgeT.set(p, t);
      health.maxEdgeT = Math.max(health.maxEdgeT, t);
    }
    const b = m.ball;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) health.nan = true;
    if (m.phase === PHASE.PLAY) {
      const touch = b.owner ? `o${b.owner.id}` : b.lastTouch ? `t${b.lastTouch.id}:${Math.round(b.x)},${Math.round(b.y)}` : '';
      if (b.owner || touch !== lastTouch) untouched = 0; else untouched += DT;
      if (!b.owner && Math.hypot(b.vx, b.vy) > 4) untouched = 0;
      lastTouch = touch;
      health.maxUntouched = Math.max(health.maxUntouched, untouched);
    }
  }
  return { m, health };
}

test('soccer: facing vectors map to the sheet rows (down, down-right, right ... down-left)', () => {
  assert.equal(dirIndex(0, 1), 0);
  assert.equal(dirIndex(1, 1), 1);
  assert.equal(dirIndex(1, 0), 2);
  assert.equal(dirIndex(1, -1), 3);
  assert.equal(dirIndex(0, -1), 4);
  assert.equal(dirIndex(-1, -1), 5);
  assert.equal(dirIndex(-1, 0), 6);
  assert.equal(dirIndex(-1, 1), 7);
});

test('soccer: side helpers and the penalty box', () => {
  assert.equal(C.attackDir(0), -1);
  assert.equal(C.ownGoalY(0), C.L);
  assert.equal(C.depthOf(0, C.L), 0);
  assert.equal(C.depthOf(1, C.L), 1);
  assert.ok(C.inBox(0, C.W / 2, C.L - 10));
  assert.ok(!C.inBox(0, C.W / 2, C.L / 2));
  assert.ok(C.inBox(1, C.W / 2 + 40, 20));
});

test('soccer: rolling ball prediction slows down and stops', () => {
  const b = { x: 0, y: 0, z: 0, vx: 100, vy: 0, vz: 0 };
  const p1 = ballPosAt(b, 0.5); const p2 = ballPosAt(b, 1); const p3 = ballPosAt(b, 5); const p4 = ballPosAt(b, 9);
  assert.ok(p1.x > 0 && p2.x > p1.x && p3.x >= p2.x);
  assert.ok(p2.x - p1.x < p1.x, 'decelerating');
  assert.equal(p3.x, p4.x, 'stopped');
});

test('soccer: CPU presets get stronger from easy to hard', () => {
  const e = tune(PRESETS, 0); const h = tune(PRESETS, 1);
  assert.ok(h.react < e.react && h.speed > e.speed && h.shotErr < e.shotErr && h.keeperReach > e.keeperReach);
});

test('soccer: CPU vs CPU matches have goals, end on time and never stall', () => {
  let goals = 0; let shots = 0; let restarts = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const { m, health } = play({ skills: [0.5, 0.5], seed, halfSeconds: 60 });
    assert.equal(m.phase, PHASE.OVER);
    assert.equal(m.half, 2);
    assert.ok(!health.nan, 'positions stay finite');
    assert.ok(health.maxEdgeT < 2, `a CPU player was pinned on the edge for ${health.maxEdgeT.toFixed(1)}s (seed ${seed})`);
    assert.ok(health.maxUntouched < 6, `ball sat untouched for ${health.maxUntouched.toFixed(1)}s (seed ${seed})`);
    assert.equal(m.stats.nudges, 0, 'the safety nudge never has to fire');
    goals += m.score[0] + m.score[1];
    shots += m.stats.shots[0] + m.stats.shots[1];
    restarts += Object.values(m.stats.restarts).reduce((a, c) => a + c, 0);
  }
  assert.ok(goals >= 8, `only ${goals} goals in 8 short matches`);
  assert.ok(shots >= 60, `only ${shots} shots in 8 short matches`);
  assert.ok(restarts > 16, 'kick-offs and restarts happen');
});

test('soccer: a stronger CPU wins more', () => {
  let strong = 0; let weak = 0; let gs = 0; let gw = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const flip = seed % 2 === 0;   // play from both ends
    const { m } = play({ skills: flip ? [0.25, 0.75] : [0.75, 0.25], seed: 50 + seed, halfSeconds: 60 });
    const s = flip ? 1 : 0;
    gs += m.score[s]; gw += m.score[1 - s];
    if (m.winner === s) strong++; else if (m.winner === 1 - s) weak++;
  }
  assert.ok(strong >= 7, `strong side won ${strong}/10`);
  assert.ok(strong > weak * 3);
  assert.ok(gs > gw * 2, `goals ${gs} vs ${gw}`);
});

test('soccer: every restart type happens and play resumes from each', () => {
  const seen = {};
  for (let seed = 1; seed <= 6; seed++) {
    const m = new Match({ skills: [0.5, 0.5], seed, halfSeconds: 120 });
    let last = null;
    while (m.phase !== PHASE.OVER) {
      m.step(DT); m.events.length = 0;
      if (m.phase === PHASE.TAKING && m.sp !== last) { last = m.sp; seen[m.sp.type] = (seen[m.sp.type] || 0) + 1; }
      if (m.phase === PHASE.TAKING) assert.ok(m.sp.t < 8, `${m.sp.type} never taken`);
    }
  }
  for (const k of ['kickoff', 'throwin', 'corner', 'goalkick']) assert.ok(seen[k] > 0, `no ${k} seen`);
});

test('soccer: a loose ball in a corner or against a post gets played, not stuck', () => {
  const spots = [[1, 1], [C.W - 1, 1], [1, C.L - 1], [C.W - 1, C.L - 1], [C.W / 2 - C.GOAL_W / 2 + 3, 3], [C.W / 2 + C.GOAL_W / 2 - 3, C.L - 3], [2, C.L / 2]];
  for (const [x, y] of spots) {
    const m = new Match({ skills: [0.5, 0.5], seed: 9, halfSeconds: 60 });
    while (m.phase !== PHASE.PLAY) m.step(DT);
    const b = m.ball;
    Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, intended: null });
    let moved = false;
    for (let i = 0; i < 60 * 6 && !moved; i++) {
      m.step(DT); m.events.length = 0;
      if (m.phase !== PHASE.PLAY || b.owner || Math.hypot(b.x - x, b.y - y) > 20) moved = true;
    }
    assert.ok(moved, `ball at ${x},${y} was left alone`);
  }
});

test('soccer: a player left behind a goal finds his way back round the net', () => {
  for (const [x, y] of [[C.W / 2, -16], [C.W / 2 + 10, C.L + 16], [C.W / 2 - C.GOAL_W / 2, -8]]) {
    const m = new Match({ skills: [0.5, 0.5], seed: 2, halfSeconds: 60 });
    while (m.phase !== PHASE.PLAY) m.step(DT);
    const p = m.teams[0].players[2];
    p.x = x; p.y = y;
    let back = false;
    for (let i = 0; i < 60 * 4 && !back; i++) {
      m.step(DT); m.events.length = 0;
      if (p.y > 2 && p.y < C.L - 2) back = true;
    }
    assert.ok(back, `stuck behind the net from ${x},${y} (now ${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
});

test('soccer: ball crossing the goal line between the posts under the bar is a goal; over it is not', () => {
  const m = new Match({ skills: [0.5, 0.5], seed: 4, halfSeconds: 60 });
  while (m.phase !== PHASE.PLAY) m.step(DT);
  for (const p of m.players) { p.x = C.W / 2 + (p.id - 5) * 9; p.y = C.L / 2; }
  const b = m.ball;
  Object.assign(b, { owner: null, held: false, x: C.W / 2 + 10, y: 6, z: 2, vx: 0, vy: -200, vz: 0, lastTouch: m.players[5 + 4 - 5] });
  b.lastTouch = m.teams[0].players[4];
  for (let i = 0; i < 20 && m.phase === PHASE.PLAY; i++) m.step(DT);
  assert.equal(m.phase, PHASE.GOAL);
  assert.deepEqual(m.score, [1, 0]);

  const m2 = new Match({ skills: [0.5, 0.5], seed: 4, halfSeconds: 60 });
  while (m2.phase !== PHASE.PLAY) m2.step(DT);
  for (const p of m2.players) { p.x = C.W / 2 + (p.id - 5) * 9; p.y = C.L / 2; }
  Object.assign(m2.ball, { owner: null, held: false, x: C.W / 2, y: 4, z: 30, vx: 0, vy: -200, vz: 0, lastTouch: m2.teams[0].players[4] });
  for (let i = 0; i < 20 && m2.phase === PHASE.PLAY; i++) m2.step(DT);
  assert.deepEqual(m2.score, [0, 0]);
  assert.equal(m2.sp.type, 'goalkick', 'over the bar off an attacker: goal kick');

  const m3 = new Match({ skills: [0.5, 0.5], seed: 4, halfSeconds: 60 });
  while (m3.phase !== PHASE.PLAY) m3.step(DT);
  for (const p of m3.players) { p.x = C.W / 2 + (p.id - 5) * 9; p.y = C.L / 2; }
  Object.assign(m3.ball, { owner: null, held: false, x: C.W - 20, y: 4, z: 0, vx: 0, vy: -150, vz: 0, lastTouch: m3.teams[1].players[2] });
  for (let i = 0; i < 20 && m3.phase === PHASE.PLAY; i++) m3.step(DT);
  assert.equal(m3.sp.type, 'corner', 'wide of the post off a defender: corner');
  assert.equal(m3.sp.side, 0);

  const m4 = new Match({ skills: [0.5, 0.5], seed: 4, halfSeconds: 60 });
  while (m4.phase !== PHASE.PLAY) m4.step(DT);
  Object.assign(m4.ball, { owner: null, held: false, x: 2, y: 100, z: 0, vx: -150, vy: 0, vz: 0, lastTouch: m4.teams[0].players[3] });
  for (let i = 0; i < 20 && m4.phase === PHASE.PLAY; i++) m4.step(DT);
  assert.equal(m4.sp.type, 'throwin');
  assert.equal(m4.sp.side, 1, 'throw-in to the team that did not touch it last');
});

test('soccer: keepers catch soft shots and dive at wide ones', () => {
  let caught = 0; let dived = 0;
  for (let i = 0; i < 10; i++) {
    const m = new Match({ skills: [0.5, 0.5], seed: 30 + i, halfSeconds: 60 });
    while (m.phase !== PHASE.PLAY) m.step(DT);
    // Clear everyone else out of the way.
    for (const p of m.players) if (p.role !== 'GK') { p.x = 20 + p.id * 18; p.y = C.L / 2; }
    const k = m.teams[1].players[0];
    k.x = C.W / 2; k.y = 8;
    const soft = i < 5;
    const tx = soft ? C.W / 2 + 3 : C.W / 2 + C.GOAL_W / 2 - 4;
    const from = { x: C.W / 2 - 20, y: 80 };
    const d = Math.hypot(tx - from.x, 0 - from.y);
    const sp = soft ? 120 : 240;
    Object.assign(m.ball, { owner: null, held: false, x: from.x, y: from.y, z: 0, vz: 0, vx: (tx - from.x) / d * sp, vy: (0 - from.y) / d * sp, lastTouch: m.teams[0].players[4] });
    m.ball.shotBy = m.teams[0].players[4];
    for (let s = 0; s < 90 && m.phase === PHASE.PLAY; s++) {
      m.step(DT);
      if (m.events.some((e) => e.type === 'dive')) dived++;
      m.events.length = 0;
      if (m.ball.owner === k) { caught++; break; }
    }
  }
  assert.ok(caught >= 4, `caught ${caught} of 5 soft shots`);
  assert.ok(dived >= 2, `dived for ${dived} of 5 wide shots`);
});

// ---------------------------------------------------------------- the human side

/** A simple scripted "player" driving the touch inputs: run at goal, shoot in range, tackle. */
function humanBot() {
  let shootHold = 0; let passTap = false; let shotFired = false;
  return (m) => {
    const p = m.active; const b = m.ball;
    const input = { mx: 0, my: 0, pass: false, shoot: false };
    if (!p) return input;
    if (passTap) { passTap = false; return input; }      // release between taps
    if (m.phase === PHASE.TAKING && m.sp.side === 0) { passTap = true; input.pass = true; return input; }
    if (b.owner === p) {
      const gx = C.W / 2 - p.x; const gy = 0 - p.y;
      const d = Math.hypot(gx, gy);
      input.mx = gx / d; input.my = gy / d;
      if (d < 85 || shootHold > 0) {
        shootHold += 1;
        input.shoot = shootHold < 22;
        if (!input.shoot) { shootHold = 0; shotFired = true; }
      }
      return input;
    }
    shootHold = 0;
    const dx = b.x - p.x; const dy = b.y - p.y; const d = Math.hypot(dx, dy) || 1;
    input.mx = dx / d; input.my = dy / d;
    if (b.owner && b.owner.side === 1 && d < 11 && d > 5) { input.pass = true; passTap = true; }
    void shotFired;
    return input;
  };
}

test('soccer: human controls - running, shooting, tackling and restarts all work', () => {
  let goals = 0; let shots = 0; let tackles = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const { m, health } = play({ skills: [0.5, 0.2], humanSide: 0, seed, halfSeconds: 60 }, humanBot());
    assert.equal(m.phase, PHASE.OVER);
    assert.ok(!health.nan);
    goals += m.score[0]; shots += m.stats.shots[0]; tackles += m.stats.tackles[0];
  }
  assert.ok(shots >= 8, `human shots: ${shots}`);
  assert.ok(goals >= 2, `human goals: ${goals}`);
  assert.ok(tackles >= 4, `human tackles: ${tackles}`);
});

test('soccer: an idle human never freezes the match', () => {
  const { m, health } = play({ skills: [0.5, 0.5], humanSide: 0, seed: 12, halfSeconds: 45 }, () => ({ mx: 0, my: 0, pass: false, shoot: false }));
  assert.equal(m.phase, PHASE.OVER);
  assert.ok(m.score[1] >= 1, 'the CPU scores against a statue');
  assert.ok(health.maxUntouched < 8);
});

test('soccer: holding Shoot builds power; Pass with the ball passes; Pass without it slides', () => {
  const m = new Match({ skills: [0.5, 0.5], humanSide: 0, seed: 5, halfSeconds: 60 });
  while (m.phase !== PHASE.TAKING) m.step(DT);
  // Our kick-off? If not, wait for ours.
  let guard = 0;
  while (!(m.phase === PHASE.TAKING && m.sp.side === 0) && guard++ < 60 * 120) m.step(DT, null);
  if (m.sp.side !== 0) return;
  const taker = m.sp.taker;
  for (const p of m.players) if (p.side === 1) { p.x = 10 + p.id * 4; p.y = 20; }
  // Kick off by running.
  m.step(DT, { mx: 0, my: -1, pass: false, shoot: false });
  assert.equal(m.phase, PHASE.PLAY);
  assert.equal(m.ball.owner, taker);
  // Hold shoot 0.4 s
  for (let i = 0; i < 24; i++) m.step(DT, { mx: 0, my: -1, pass: false, shoot: true });
  assert.ok(m.charge > 0.4 && m.charge < 0.7, `charge ${m.charge}`);
  m.step(DT, { mx: 0, my: -1, pass: false, shoot: false });
  assert.equal(m.ball.owner, null, 'released Shoot kicks the ball');
  assert.ok(m.ball.vy < -150, 'shot goes up the pitch');
  // Now without the ball: Pass = slide
  const p = m.active;
  m.step(DT, { mx: 1, my: 0, pass: false, shoot: false });
  m.step(DT, { mx: 1, my: 0, pass: true, shoot: false });
  assert.ok(p !== m.active || p.tackleT > 0 || m.ball.owner === p || m.ball.intended === p);
});

test('soccer: one-touch pass is queued while a pass is on its way', () => {
  const m = new Match({ skills: [0.5, 0.5], humanSide: 0, seed: 21, halfSeconds: 60 });
  while (m.phase !== PHASE.PLAY) m.step(DT, { mx: 0, my: -1, pass: false, shoot: false });
  const team = m.teams[0].players;
  const a = team[2]; const r = team[3];
  for (const p of m.players) { if (p.side === 1) { p.x = 20 + p.id * 8; p.y = 30; } }
  a.x = 60; a.y = 300; r.x = 140; r.y = 290; r.vx = 0; r.vy = 0;
  m.ball.owner = a; m.active = a; m.ball.x = a.x; m.ball.y = a.y - 4;
  m.step(DT, { mx: 1, my: 0, pass: true, shoot: false });
  assert.equal(m.ball.intended, r, 'pass goes to the teammate in the stick direction');
  m.step(DT, { mx: 0, my: 0, pass: false, shoot: false });
  assert.equal(m.active, r, 'control switches to the receiver');
  m.step(DT, { mx: 0, my: -1, pass: true, shoot: false });   // press while ball travels
  assert.ok(m.buffer && m.buffer.kind === 'pass');
  let passedOn = false;
  for (let i = 0; i < 120; i++) {
    m.step(DT, { mx: 0, my: 0, pass: false, shoot: false });   // stick idle: auto-runs onto the pass
    if (m.ball.lastTouch === r && !m.ball.owner && Math.hypot(m.ball.vx, m.ball.vy) > 60) { passedOn = true; break; }
  }
  assert.ok(passedOn, 'the receiver played it first time');
});

// ---------------------------------------------------------------- penalties, cup, endless

test('soccer: penalty shoot-out ends early when one side cannot catch up', () => {
  const so = P.newShootout(0);
  const order = [];
  // Home scores 3, away misses 3: 3-0 with 2 kicks left each is decided after away's third.
  for (let i = 0; i < 6; i++) { const s = P.nextKicker(so); order.push(s); P.recordKick(so, s, s === 0); if (so.done) break; }
  assert.deepEqual(order, [0, 1, 0, 1, 0, 1]);
  assert.ok(so.done);
  assert.equal(so.winner, 0);
});

test('soccer: penalty shoot-out goes to sudden death when level after five', () => {
  const so = P.newShootout(1);
  for (let i = 0; i < 10; i++) P.recordKick(so, P.nextKicker(so), true);
  assert.ok(!so.done);
  P.recordKick(so, P.nextKicker(so), true);   // side 1 scores
  assert.ok(!so.done);
  P.recordKick(so, P.nextKicker(so), false);  // side 0 misses
  assert.ok(so.done);
  assert.equal(so.winner, 1);
});

test('soccer: penalty kicks - wide misses, wrong-way dives concede, right-way dives save some', () => {
  const rng = makeRng(3);
  assert.equal(P.resolveKick({ aim: 1.1, dive: 0, rng }), 'miss');
  let goals = 0; let saves = 0;
  for (let i = 0; i < 400; i++) {
    if (P.resolveKick({ aim: 0.8, power: 0.7, dive: -1, rng }) === 'goal') goals++;
    if (P.resolveKick({ aim: 0.6, power: 0.7, dive: 1, keeper: 0.8, rng }) === 'save') saves++;
  }
  assert.equal(goals, 400);
  assert.ok(saves > 150 && saves < 360, `saves ${saves}`);
  // Better CPU keepers read more kicks.
  let readLo = 0; let readHi = 0;
  for (let i = 0; i < 2000; i++) {
    if (P.cpuDive(0, 0.8, rng) === 1) readLo++;
    if (P.cpuDive(1, 0.8, rng) === 1) readHi++;
  }
  assert.ok(readHi > readLo + 200);
});

test('soccer: cup - 8 different teams including yours, 3 rounds to win it', () => {
  let cup = Cup.newCup(42);
  const ids = cup.rounds[0];
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.ok(ids.includes(T.PLAYER_TEAM.id));
  for (let r = 0; r < 3; r++) {
    assert.ok(Cup.opponentOf(cup));
    cup = Cup.advanceCup(cup, true, [2, 1]);
    assert.equal(cup.alive, true);
  }
  assert.equal(cup.champion, T.PLAYER_TEAM.id);
  assert.equal(cup.results.length, 3);
});

test('soccer: cup - losing ends the run; later rounds are tougher', () => {
  let cup = Cup.newCup(7);
  cup = Cup.advanceCup(cup, true, [1, 1], [4, 3]);
  assert.equal(cup.round, 1);
  assert.equal(cup.rounds[1].length, 4);
  cup = Cup.advanceCup(cup, false, [0, 2]);
  assert.equal(cup.alive, false);
  assert.equal(cup.champion, null);
  const t = T.TEAMS[0];
  assert.ok(Cup.cupSkill(0.4, t, 2) > Cup.cupSkill(0.4, t, 0));
  // JSON round trip (it is saved to localStorage)
  assert.deepEqual(JSON.parse(JSON.stringify(cup)), cup);
});

test('soccer: endless starts easier than a normal match and ramps up', () => {
  const base = 0.5;
  assert.ok(Cup.endlessSkill(base, 0) < base - 0.1);
  let prev = -1;
  for (let s = 0; s < 12; s++) {
    const k = Cup.endlessSkill(base, s);
    assert.ok(k >= prev - 0.05, 'never gets much easier');
    prev = k;
  }
  assert.ok(Cup.endlessSkill(base, 10) > Cup.endlessSkill(base, 0) + 0.3);
});

test('soccer: keeper kits never clash with either team', () => {
  for (const a of [T.PLAYER_TEAM, ...T.TEAMS]) {
    for (const b of T.TEAMS) {
      const [k0, k1] = T.keeperKits(a, b);
      assert.ok(k0 && k1 && k0 !== k1);
      for (const k of [k0, k1]) assert.ok(k !== a.shirt && k !== b.shirt);
    }
  }
  assert.ok(T.TEAMS.every((t) => t.shirt !== T.PLAYER_TEAM.shirt));
});
