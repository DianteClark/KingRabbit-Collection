import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/game-night/logic/', import.meta.url).href;
const B = await import(L + 'bowling.js');

test('bowling: classic scores', () => {
  assert.equal(B.totalScore(new Array(12).fill(10)), 300);
  assert.equal(B.totalScore(new Array(21).fill(5)), 150);
  assert.equal(B.totalScore(new Array(20).fill(0)), 0);
  assert.equal(B.totalScore(new Array(20).fill(4)), 80);
  // Strike, then 3 + 4: 17 + 7
  assert.equal(B.totalScore([10, 3, 4]), 24);
  // Spare then 5: 15 + 5 (second frame incomplete)
  assert.equal(B.totalScore([6, 4, 5]), 15);
  // A known game: 10, 7/3, 9/0, 10, 0/8, 8/2, 0/6, 10, 10, 10/8/1 = 167
  assert.equal(B.totalScore([10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1]), 167);
});

test('bowling: position tracking through the tenth frame', () => {
  assert.deepEqual(B.position([]), { frame: 0, ball: 0, freshRack: true, over: false });
  assert.equal(B.position([3]).ball, 1);
  assert.equal(B.position([10]).frame, 1);
  const nine = new Array(18).fill(4);
  assert.equal(B.position(nine).frame, 9);
  assert.equal(B.position([...nine, 3, 4]).over, true);
  assert.equal(B.position([...nine, 3, 7]).over, false);       // spare earns a third ball
  assert.equal(B.position([...nine, 3, 7]).freshRack, true);
  assert.equal(B.position([...nine, 10, 10, 10]).over, true);
  assert.equal(B.position([...nine, 10]).freshRack, true);
  assert.equal(B.position([...nine, 10, 5]).freshRack, false);
});

test('bowling: frame marks', () => {
  assert.deepEqual(B.marks([10], false), ['X']);
  assert.deepEqual(B.marks([7, 3], false), ['7', '/']);
  assert.deepEqual(B.marks([0, 5], false), ['-', '5']);
  assert.deepEqual(B.marks([10, 10, 10], true), ['X', 'X', 'X']);
  assert.deepEqual(B.marks([7, 3, 10], true), ['7', '/', 'X']);
});

test('mole runner: every gem on every level can be reached', async () => {
  const { LEVELS, parse, reachable, COLS, ROWS } = await import('../games/game-night/logic/molerunner.js');
  LEVELS.forEach((L, i) => {
    assert.equal(L.length, ROWS, `level ${i} rows`);
    const lv = parse(L);
    const seen = reachable(lv.grid, lv.player.r, lv.player.c);
    lv.grid.forEach((t, k) => { if (t === '*') assert.ok(seen.has(k), `level ${i} gem at ${Math.floor(k / COLS)},${k % COLS}`); });
  });
});
