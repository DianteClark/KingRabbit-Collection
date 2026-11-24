import { test } from 'node:test';
import assert from 'node:assert/strict';

const A = await import(new URL('../games/game-night/adaptive.js', import.meta.url).href);

test('adaptive: skill settles where you win about half the time', () => {
  // A player who beats the CPU 90% at skill 0 and 10% at skill 1 (50% at 0.5).
  let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const history = [];
  for (let g = 0; g < 300; g++) {
    const s = A.getSkill('test');
    const pWin = 0.9 - 0.8 * s;
    A.reportResult('test', rng() < pWin ? 1 : 0, 0.5);
    history.push(A.getSkill('test'));
  }
  const late = history.slice(150);
  const avg = late.reduce((a, b) => a + b, 0) / late.length;
  assert.ok(avg > 0.35 && avg < 0.65, `settled at ${avg.toFixed(2)}`);
  // Skill always stays in range.
  assert.ok(history.every((v) => v >= 0 && v <= 1));
});

test('adaptive: tune blends presets and rounds integer settings', () => {
  const P = { easy: { depth: 1, noise: 60 }, normal: { depth: 3, noise: 8 }, hard: { depth: 5, noise: 0 } };
  assert.deepEqual(A.tune(P, 0, ['depth']), { depth: 1, noise: 60 });
  assert.deepEqual(A.tune(P, 0.5, ['depth']), { depth: 3, noise: 8 });
  assert.deepEqual(A.tune(P, 1, ['depth']), { depth: 5, noise: 0 });
  assert.equal(A.tune(P, 0.75, ['depth']).depth, 4);
  assert.equal(A.tune(P, 0.25).noise, 34);
  A.resetSkill('x');
  assert.equal(A.skillLabel('x'), 4);
});
