import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../games/city-chief/logic/sim.js');
const { findPath } = await import('../games/city-chief/logic/city.js');

function play(mode, seed, days, smart) {
  const s = S.newGame(mode, seed);
  for (let d = 0; d < days && !s.over; d++) {
    while (!s.dayOver && !s.over) {
      S.tick(s, 5);
      if (s.pendingMajor) S.resolveMajor(s, 0);
      if (smart) for (const inc of s.incidents) if (!inc.chosen && inc.status === 'new' && inc.d >= 2) S.dispatch(s, inc.id, Math.ceil(inc.d));
    }
    if (s.over) break;
    const r = S.endDay(s);
    if (smart) {
      for (const b of r.briefing) if (b.kind === 'promote') S.promote(s, b.officer, 'sergeant');
      if (r.meeting) S.mayorMeeting(s, 'modest');
      for (const id of ['car', 'hire', 'gear']) if (s.money > 2600) S.buy(s, id);
    } else if (r.meeting) S.mayorMeeting(s, 'none');
  }
  return s;
}

test('city chief: every building can be reached by road from HQ', () => {
  const c = S.city();
  const hq = c.landmark('hq').door;
  for (const lot of c.lots) assert.ok(findPath(c.roads, hq, lot.door), `lot ${lot.id}`);
  for (const k of ['hq', 'bank', 'fire', 'hospital', 'jail']) assert.ok(c.landmark(k), k);
});

test('city chief: a saved game survives JSON and keeps running', () => {
  const s = play('career', 7, 2, true);
  const copy = JSON.parse(JSON.stringify(s));
  S.tick(copy, 120);
  assert.ok(copy.minute > s.minute);
});

test('city chief: a careful chief keeps the job for 12 days', () => {
  for (const seed of [1, 2, 3]) {
    const s = play('career', seed, 12, true);
    assert.equal(s.over, null, `seed ${seed}: ${s.over?.reason}`);
    assert.ok(s.today && s.day >= 12);
  }
});

test('city chief: a chief who never decides anything gets fired in career', () => {
  let fired = 0;
  for (const seed of [4, 5, 6]) if (play('career', seed, 30, false).over) fired++;
  assert.ok(fired >= 2, `fired ${fired}/3`);
});

test('city chief: endless mode never ends', () => {
  const s = play('endless', 9, 20, false);
  assert.equal(s.over, null);
  assert.ok(s.trust >= 10 && s.safety >= 10);
});

test('city chief: units never get stuck without a route', () => {
  const s = S.newGame('career', 11);
  const seen = new Map();
  for (let k = 0; k < 600; k++) {
    S.tick(s, 2);
    if (s.pendingMajor) S.resolveMajor(s, 0);
    if (s.dayOver) S.endDay(s);
    for (const u of s.units) {
      if (u.task.type !== 'respond') { seen.delete(u.id); continue; }
      const key = `${u.task.inc}`;
      const prev = seen.get(u.id);
      if (prev && prev.key === key) prev.n++; else seen.set(u.id, { key, n: 0 });
      assert.ok(seen.get(u.id).n < 60, `unit ${u.id} responding for 120 minutes`);
    }
  }
});
