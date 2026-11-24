// Game Night polish pass: regression tests for rules and CPU fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/game-night/logic/', import.meta.url).href;
const Checkers = await import(L + 'checkers.js');
const Dom = await import(L + 'dominoes.js');
const Sea = await import(L + 'seabattle.js');

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('checkers: Hard CPU stays inside its time budget in a king ending', () => {
  // Four kings each: the old fixed-depth search took several seconds here.
  const b = new Array(64).fill(null);
  for (const i of [1, 3, 5, 7]) b[i] = 'L';
  for (const i of [56, 58, 60, 62]) b[i] = 'D';
  for (const i of [26, 28]) b[i] = 'l';
  for (const i of [35, 37]) b[i] = 'd';
  const t0 = Date.now();
  const m = Checkers.cpuMove(b, 'l', { cfg: Checkers.LEVELS.hard, rng: seeded(3) });
  const took = Date.now() - t0;
  assert.ok(took < Checkers.LEVELS.hard.timeMs + 800, `took ${took}ms`);
  const legal = Checkers.legalMoves(b, 'l');
  assert.ok(legal.some((x) => JSON.stringify(x) === JSON.stringify(m)), 'returns one of the legal moves');
});

test('checkers: CPU takes a winning double jump and plays the only move instantly', () => {
  const b = new Array(64).fill(null);
  b[10] = 'l';          // row 1, col 2
  b[19] = 'd';          // row 2, col 3
  b[35] = 'd';          // row 4, col 3
  const moves = Checkers.legalMoves(b, 'l');
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].captured, [19, 35]);
  const t0 = Date.now();
  assert.deepEqual(Checkers.cpuMove(b, 'l', { cfg: Checkers.LEVELS.hard }), moves[0]);
  assert.ok(Date.now() - t0 < 50);
});

test('dominoes: the table layout never overlaps or runs off the board', () => {
  const area = { x0: 10, x1: 350, y0: 128, y1: 398 };
  const center = { x: 180, y: 262 };
  const rng = seeded(11);
  let shrunk = 0;
  for (let g = 0; g < 1500; g++) {
    let r = Dom.newRound(rng);
    let guard = 0;
    while (!Dom.roundResult(r) && guard++ < 200) {
      const p = r.turn;
      const c = Dom.cpuChoice(r, p, { level: g % 2 ? 'easy' : 'hard', rng });
      if (c) r = Dom.playTile(r, p, c.i, c.side); else if (r.boneyard.length) r = Dom.draw(r, p); else r = Dom.passTurn(r);
      if (!r.center) continue;
      const lay = Dom.layoutTable(r, area, center);
      if (lay.h < 15) shrunk++;
      const h = lay.h;
      const box = (s) => { const w = s.vertical ? h : 2 * h; const ht = s.vertical ? 2 * h : h; return [s.x - w / 2, s.x + w / 2, s.y - ht / 2, s.y + ht / 2]; };
      const boxes = [box({ x: center.x, y: center.y, vertical: r.spinner })];
      const open = new Set(Dom.ends(r).map((e) => e.side));
      for (const side of Dom.SIDES) {
        const n = r.arms[side].length + (open.has(side) ? 1 : 0);
        for (const s of lay.arms[side].slice(0, n)) {
          const b = box(s);
          assert.ok(b[0] >= area.x0 - 0.5 && b[1] <= area.x1 + 0.5 && b[2] >= area.y0 - 0.5 && b[3] <= area.y1 + 0.5, 'inside the table');
          for (const o of boxes) assert.ok(!(b[0] < o[1] - 0.5 && o[0] < b[1] - 0.5 && b[2] < o[3] - 0.5 && o[2] < b[3] - 0.5), 'no overlap');
          boxes.push(b);
        }
      }
    }
  }
  assert.ok(shrunk > 0, 'long rounds do get smaller tiles');
});

test('sea battle: every CPU level finishes a fleet without repeating a shot', () => {
  const rng = seeded(5);
  for (const level of ['easy', 'normal', 'hard']) {
    let total = 0;
    for (let g = 0; g < 150; g++) {
      const fleet = Sea.randomFleet(rng);
      const shots = new Map(); const sunk = new Set();
      let n = 0;
      while (!Sea.allSunk(fleet)) {
        const remaining = fleet.filter((s) => s.hits < s.cells.length).map((s) => s.cells.length);
        const c = Sea.cpuTarget(shots, sunk, remaining, rng, level);
        assert.ok(c >= 0 && c < 100 && !shots.has(c), 'a fresh square');
        const r = Sea.fire(fleet, shots, c);
        if (r.result === 'sunk') r.ship.cells.forEach((x) => sunk.add(x));
        n++;
      }
      total += n;
    }
    const avg = total / 150;
    if (level === 'hard') assert.ok(avg < 50, `hard averages ${avg} shots`);
    if (level === 'easy') assert.ok(avg > 52, `easy averages ${avg} shots`);
  }
});

test('sea battle: a line of hits is chased along its length', () => {
  const shots = new Map([[44, 'hit'], [45, 'hit'], [43, 'miss']]);
  for (let k = 0; k < 30; k++) {
    const c = Sea.cpuTarget(shots, new Set(), [5, 4, 3, 3, 2], Math.random, 'normal');
    assert.equal(c, 46);
  }
});
