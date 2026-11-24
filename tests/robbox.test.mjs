// Robbox: the interpreter rules, every level's known solution, and solver checks on the 3-star targets.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/robbox/';
const E = await import(new URL(`${base}logic/engine.js`, import.meta.url).href);
const { LEVELS, WORLDS } = await import(new URL(`${base}logic/levels.js`, import.meta.url).href);
const S = await import(new URL(`${base}logic/solver.js`, import.meta.url).href);

const lvl = (map, start = [0, 0, 'E'], extra = {}) => E.parseLevel({ id: 't', map, start, ...extra });
const run = (lv, code) => E.runProgram(lv, E.programFrom(typeof code === 'string' ? { main: code } : code));

// ------------------------------------------------------------------ interpreter

test('move, turn and light a lamp', () => {
  const lv = lvl(['ooL']);
  assert.equal(run(lv, 'F F A').won, true);
  assert.equal(run(lv, 'F F').fail, 'ended', 'stopping short is "out of moves"');
  const once = run(lv, 'F F A A');
  assert.equal(once.won, true, 'the level is won the moment the last lamp lights');
  assert.equal(once.steps, 3, 'and the rest of the program does not run');
  const off = lvl(['LL']);
  assert.equal(run(off, 'A A F A').fail, 'ended', 'Action on a lit lamp switches it off again');
  const r = E.act(lv, E.initState(lv), 'L');
  assert.equal(r.state.d, 0, 'left from east faces north');
  assert.equal(E.act(lv, E.initState(lv), 'R').state.d, 2);
});

test('falling off, bumping walls and crates', () => {
  assert.equal(run(lvl(['oL']), 'L F').fail, 'fell');
  assert.equal(run(lvl(['o.L']), 'F').fail, 'fell');
  assert.equal(run(lvl(['o#L']), 'F').fail, 'wall');
  assert.equal(run(lvl(['oCL']), 'F').fail, 'crate');
  const r = E.act(lvl(['o#L']), E.initState(lvl(['o#L'])), 'F');
  assert.equal(r.state.x, 0, 'a bump leaves the robot where it was');
  assert.equal(r.path[0].how, 'bump');
});

test('heights: move stays level, jump climbs one or drops any', () => {
  const lv = lvl(['oooL'], [0, 0, 'E'], { height: ['0130'] });
  assert.equal(run(lv, 'F').fail, 'ledgeUp');
  const down = lvl(['oo'], [0, 0, 'E'], { height: ['10'] });
  assert.equal(E.act(down, E.initState(down), 'F').fail, 'ledgeDown');
  assert.equal(E.act(down, E.initState(down), 'J').state.x, 1, 'jump drops down');
  assert.equal(run(lv, 'J J').fail, 'tooHigh', 'a 2-level climb is too high');
  const flat = lvl(['oo']);
  const hop = E.act(flat, E.initState(flat), 'J');
  assert.equal(hop.state.x, 0, 'jump on flat ground hops in place');
  assert.equal(hop.path[0].how, 'hop');
  assert.equal(run(lvl(['ooL'], [0, 0, 'E'], { height: ['031'] }), 'J').fail, 'tooHigh');
  assert.equal(run(lvl(['ooL'], [0, 0, 'E'], { height: ['310'] }), 'J J A').won, true, 'jump down two levels, then up one');
});

test('crates: pick up in front, drop in front, pads need crates', () => {
  const lv = lvl(['oCoX']);
  assert.equal(run(lv, 'A F F A').won, true);
  const s1 = E.act(lv, E.initState(lv), 'A').state;
  assert.equal(s1.carrying, true);
  assert.deepEqual(s1.crates, []);
  assert.equal(run(lv, 'A F F').fail, 'ended');
  // Can't drop onto a wall, a lamp or another crate: nothing happens.
  const blocked = lvl(['oC#'], [1, 0, 'E']);
  const st = { ...E.initState(blocked), carrying: true, crates: [] };
  const r = E.act(blocked, st, 'A');
  assert.equal(r.state.carrying, true);
  assert.equal(r.events[0].type, 'nothing');
  // Won only when every pad has a crate and the robot isn't holding one.
  const two = lvl(['XCoCX'], [2, 0, 'W']);
  assert.equal(run(two, 'A F A').won, false);
  assert.equal(run(two, 'A F A L L F A F A').won, true);
});

test('gears open gates; without one the gate is locked', () => {
  const lv = lvl(['oKDL']);
  assert.equal(run(lv, 'F F F A').won, true);
  const nokey = lvl(['ooDL']);
  assert.equal(run(nokey, 'F F').fail, 'locked');
  const two = lvl(['oKDDL']);
  assert.equal(run(two, 'F F F').fail, 'locked', 'one gear opens one gate');
});

test('conveyors carry the robot; warps move it to their twin', () => {
  const lv = lvl(['o>>oL']);
  const r = E.act(lv, E.initState(lv), 'F');
  assert.deepEqual([r.state.x, r.path.map((p) => p.how)], [3, ['walk', 'slide', 'slide']]);
  assert.equal(run(lvl(['o>>.']), 'F').fail, 'fell', 'a belt off the edge drops you');
  const stop = E.act(lvl(['o>#L']), E.initState(lvl(['o>#L'])), 'F');
  assert.equal(stop.state.x, 1, 'a belt into a wall just stops');
  assert.equal(stop.fail, null);
  const loop = lvl(['o>v', '.^<']);
  const lr = E.act(loop, E.initState(loop), 'F');
  assert.equal(lr.fail, null, 'a ring of belts stops instead of spinning forever');
  const warp = lvl(['oA.AL']);
  const w = E.act(warp, E.initState(warp), 'F');
  assert.equal(w.state.x, 3);
  assert.equal(w.path.at(-1).how, 'tele');
  assert.equal(run(warp, 'F F A').won, true);
});

test('functions, calls and tail-call loops', () => {
  const lv = lvl(['oLLLLLLLL']);
  assert.equal(run(lv, { main: '1', f1: 'F A 1' }).won, true, 'a function calling itself loops');
  const r = run(lvl(['oooL']), { main: '1 A', f1: 'F F F' });
  assert.equal(r.won, true, 'after a call, MAIN carries on');
  const forever = run(lvl(['oL', 'oo']), { main: '1', f1: 'L 1' });
  assert.equal(forever.fail, 'long', 'spinning forever stops at the step limit');
  assert.equal(forever.steps, E.STEP_LIMIT);
  const deep = run(lvl(['oL']), { main: '1', f1: '1 A' });
  assert.equal(deep.fail, 'deep', 'calls that never return run out of room');
  assert.equal(E.hasLoop(E.programFrom({ f1: 'F 1' })), true);
  assert.equal(E.hasLoop(E.programFrom({ f1: '2', f2: '1' })), true);
  assert.equal(E.hasLoop(E.programFrom({ main: '1 1', f1: '2', f2: 'F' })), false);
});

test('each step reports where it is in the program', () => {
  const lv = lvl(['oooL']);
  const r = E.createRun(lv, E.programFrom({ main: 'F 1', f1: 'F F A' }));
  const where = [];
  while (!r.done) { const s = E.stepRun(r); where.push(`${s.slot}:${s.index}:${s.op}`); }
  assert.deepEqual(where, ['main:0:F', 'main:1:1', 'f1:0:F', 'f1:1:F', 'f1:2:A']);
  assert.equal(r.won, true);
});

test('colour checks: painted commands only run on matching tiles', () => {
  const lv = lvl(['ooo', '..L'], [0, 0, 'E'], { paint: ['..b', '...'] });
  assert.equal(run(lv, { main: '1', f1: 'F b:R A 1' }).won, true);
  const r = E.createRun(lv, E.programFrom({ main: 'b:R' }));
  const s = E.stepRun(r);
  assert.equal(s.skipped, true, 'skipped on a plain tile');
  assert.equal(r.state.d, 1);
  assert.equal(E.codeString(E.parseCode('F b:R o:J 1')), 'F b:R o:J 1');
  assert.throws(() => E.parseCode('X'));
});

test('stars: 3 at the target, 2 a little over, 1 otherwise', () => {
  assert.equal(E.starsFor(6, 6), 3);
  assert.equal(E.starsFor(5, 6), 3);
  assert.equal(E.starsFor(8, 6), 2);
  assert.equal(E.starsFor(9, 6), 1);
  assert.equal(E.starsFor(19, 15), 2);
  assert.equal(E.starsFor(21, 15), 1);
});

// ------------------------------------------------------------------ levels

test('40 levels in 5 worlds of 8, each fits the portrait screen', () => {
  assert.equal(LEVELS.length, 40);
  assert.equal(WORLDS.length, 5);
  for (const w of WORLDS) assert.equal(LEVELS.filter((l) => l.world === w.id).length, 8, `world ${w.id}`);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 40, 'ids are unique');
  for (const l of LEVELS) {
    const lv = E.parseLevel(l);
    assert.ok(lv.w <= 10 && lv.h <= 6, `${l.id} is ${lv.w}x${lv.h}`);
    const startCell = E.cellAt(lv, lv.start.x, lv.start.y);
    assert.ok(startCell && ['floor', 'lamp'].includes(startCell.t), `${l.id} starts on floor`);
    assert.ok(lv.lamps.length + lv.pads.length > 0, `${l.id} has a goal`);
    assert.ok(lv.crates.length >= lv.pads.length, `${l.id} has enough crates`);
    assert.ok(l.hint && l.hint.length > 10, `${l.id} has a hint`);
    assert.ok(l.name.length <= 16, `${l.id} name fits the header`);
    for (const c of lv.cells) assert.ok(c.h >= 0 && c.h <= E.MAX_HEIGHT);
    if (l.height) assert.deepEqual(l.height.map((r) => r.length), l.map.map((r) => r.length), `${l.id} height rows`);
    if (l.paint) assert.deepEqual(l.paint.map((r) => r.length), l.map.map((r) => r.length), `${l.id} paint rows`);
    const capRows = Math.ceil(l.slots.main / 7) + Math.ceil((l.slots.f1 || 0) / 7) + Math.ceil((l.slots.f2 || 0) / 7);
    assert.ok(l.slots.main <= 14 && (l.slots.f1 || 0) <= 7 && (l.slots.f2 || 0) <= 7 && capRows <= 4, `${l.id} slots fit`);
    assert.ok([...l.ops].every((o) => 'FLRJA12'.includes(o)));
    if (l.slots.f1) assert.ok(l.ops.includes('1'), `${l.id} offers F1 calls`);
    if (l.slots.f2) assert.ok(l.ops.includes('2'), `${l.id} offers F2 calls`);
  }
});

test('every level is solvable: its known solution wins and fits the rules', () => {
  for (const l of LEVELS) {
    const lv = E.parseLevel(l);
    const r = E.runProgram(lv, l.solution);
    assert.equal(r.won, true, `${l.id} ${l.name}: solution ${r.fail || ''}`);
    assert.equal(l.target, E.programLength(l.solution), `${l.id} target is the solution length`);
    for (const s of E.SLOTS) {
      assert.ok(l.solution[s].length <= (l.slots[s] || 0), `${l.id} ${s} fits its slot`);
      for (const c of l.solution[s]) {
        assert.ok(l.ops.includes(c.op), `${l.id} uses offered command ${c.op}`);
        assert.ok(!c.cond || l.brushes.includes(c.cond), `${l.id} uses offered colour ${c.cond}`);
      }
    }
    assert.ok(l.loops || !E.hasLoop(l.solution), `${l.id}: loops only from World 5`);
  }
});

test('the world stays the same until a level is solved (nothing is won by doing nothing)', () => {
  for (const l of LEVELS) {
    const lv = E.parseLevel(l);
    assert.equal(E.isWon(lv, E.initState(lv)), false, l.id);
  }
});

test('levels with only MAIN: the target is the true shortest program (BFS)', () => {
  for (const l of LEVELS.filter((x) => !x.slots.f1)) {
    const best = S.shortestPlain(l, l.ops);
    assert.ok(best, `${l.id} reachable`);
    assert.equal(best.length, l.target, `${l.id}: shortest ${best.join(' ')}`);
  }
});

test('3-star targets can\'t be beaten on the shorter levels (exhaustive search)', () => {
  // Every level whose target is small enough to try every shorter program in a few seconds.
  const ids = ['2-1', '2-2', '2-3', '3-3', '3-4', '3-5', '3-6', '3-7', '4-3', '5-1', '5-3', '5-4', '5-5', '5-7', '5-8'];
  for (const id of ids) {
    const l = LEVELS.find((x) => x.id === id);
    assert.equal(S.searchPrograms(l, l.target - 1, { budget: 2e7 }), null, `${id}: found a program shorter than ${l.target}`);
  }
});

test('the search itself finds the known answers (so the check above means something)', () => {
  for (const id of ['1-1', '2-1', '5-1', '5-3']) {
    const l = LEVELS.find((x) => x.id === id);
    const p = S.searchPrograms(l, l.target);
    assert.ok(p, `${id} found`);
    assert.equal(E.programLength(p), l.target);
    assert.equal(E.runProgram(E.parseLevel(l), p).won, true);
  }
});

test('loops are needed in World 5 (a loop-free program can\'t fit)', () => {
  for (const id of ['5-1', '5-5']) {
    const l = LEVELS.find((x) => x.id === id);
    const full = l.slots.main + (l.slots.f1 || 0) + (l.slots.f2 || 0);
    assert.equal(S.searchPrograms({ ...l, loops: false }, full, { budget: 2e7 }), null, id);
  }
});
