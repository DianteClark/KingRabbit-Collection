import { test } from 'node:test';
import assert from 'node:assert/strict';

const { playBot } = await import('../games/colony/logic/bot.js');
const Wd = await import('../games/colony/logic/world.js');
const { DAYS_PER_YEAR, TPH } = await import('../games/colony/logic/data.js');

/** Watches every settler every tick: never on a blocked tile, never frozen in place on a path. */
function watcher() {
  const w = { worst: 0, bad: [], last: new Map() };
  w.each = (s) => {
    for (const p of Wd.settlers(s)) {
      if (!Wd.passSettler(s, p.at)) w.bad.push(`${p.name} on a blocked tile at t=${s.t}`);
      // Walking without moving for a long time = stuck.
      const key = p.id;
      const prev = w.last.get(key);
      const moving = p.path && p.path.length;
      if (moving && prev && prev.x === p.x && prev.y === p.y) {
        prev.n++;
        w.worst = Math.max(w.worst, prev.n);
      } else w.last.set(key, { x: p.x, y: p.y, n: 0 });
    }
  };
  return w;
}

test('colony bot: a hands-off colony survives the first year in Peaceful, nobody gets stuck', () => {
  for (const seed of [1, 2, 3]) {
    const w = watcher();
    const s = playBot('peaceful', seed, DAYS_PER_YEAR, { each: w.each });
    const alive = Wd.settlers(s).length;
    assert.ok(!s.result || s.result.won, `seed ${seed}: ${s.result?.reason}`);
    assert.ok(alive >= 3, `seed ${seed}: ${alive} alive`);
    assert.equal(w.bad.length, 0, w.bad.slice(0, 3).join('; '));
    assert.ok(w.worst < 2 * TPH, `seed ${seed}: a settler stood still on a path for ${w.worst} ticks`);
    assert.ok(Wd.dayOf(s) > DAYS_PER_YEAR, 'a full year passed');
  }
});

test('colony bot: Standard with raids is survivable for a season', () => {
  let survived = 0;
  for (const seed of [4, 5, 6]) {
    const s = playBot('standard', seed, 12);
    if (Wd.settlers(s).length) survived++;
  }
  assert.ok(survived >= 2, `${survived}/3 colonies made it`);
});

test('colony bot: building a radio and calling for help wins the game', () => {
  const s = playBot('peaceful', 8, DAYS_PER_YEAR, { radio: true });
  assert.ok(s.result, 'game ended');
  assert.equal(s.result.won, true);
  assert.equal(s.result.how, 'rescued');
});
