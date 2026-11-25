// Sand Siege: a simple bot (logic/bot.js) beats every campaign map, so none of them is impossible.
// It plays at normal health and at the top of the adaptive range (112%).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/sand-siege/';
const S = await import(new URL(`${base}logic/sim.js`, import.meta.url).href);
const M = await import(new URL(`${base}logic/maps.js`, import.meta.url).href);
const B = await import(new URL(`${base}logic/bot.js`, import.meta.url).href);

for (const hp of [1, 1.12]) {
  test(`bot wins every campaign map at ${Math.round(hp * 100)}% enemy health`, () => {
    const results = [];
    for (const def of M.CAMPAIGN) {
      const s = S.newGame(def, { hpScale: hp });
      B.playOut(s);
      results.push(`${def.id}:${s.over === 'win' ? s.lives : 'LOST'}`);
      assert.equal(s.over, 'win', `${def.id} lost at wave ${s.wave} (${results.join(' ')})`);
      assert.equal(s.wave, def.waves);
    }
  });
}

test('bot survives the first waves of a few daily maps', () => {
  for (const seed of [11, 222, 3333]) {
    const s = S.newGame(M.dailyMap(seed), { mode: 'daily' });
    B.playOut(s, { maxT: 240 });
    assert.ok(s.wave >= 5, `seed ${seed}: reached wave ${s.wave}`);
  }
});
