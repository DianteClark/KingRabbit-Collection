// The bot plays Pixel Quest start to finish with the real rules (see pixel-quest-bot.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playThrough } from './pixel-quest-bot.mjs';

for (const [difficulty, seed, maxWipes] of [['normal', 4, 10], ['normal', 21, 10], ['story', 7, 3]]) {
  test(`bot beats the game on ${difficulty} (seed ${seed})`, () => {
    const { st, sum } = playThrough({ difficulty, seed });
    assert.ok(sum.done, 'Vesper is beaten');
    assert.ok(st.flags.stonehide && st.flags.galewing && st.flags.pyrescorp && st.flags.barrier);
    assert.equal(st.party.length, 4);
    assert.ok(sum.wipes <= maxWipes, `wipes ${sum.wipes}`);
    // Each boss falls within a few tries at a sensible level.
    for (const [boss, tries] of Object.entries(sum.bossTries)) assert.ok(tries <= 3, `${boss} took ${tries} tries`);
    assert.ok(sum.levels.vesper.every((lv) => lv >= 22 && lv <= 30), `final levels ${sum.levels.vesper}`);
    // Compact but substantial: roughly an hour of optimal bot play, so 2 to 3 hours for a person.
    assert.ok(sum.minutes >= 40 && sum.minutes <= 120, `estimated ${sum.minutes} minutes`);
    assert.ok(sum.chests.open >= sum.chests.total - 1);
  });
}
