// MegaBoy Run: proof that nothing is unwinnable.
//  - Every stage can be crossed with the hero's real jump arc (logic/reach.js replays the real
//    player physics: walks, jumps of several heights, ladders, moving platforms and appearing
//    blocks), from the start and from every checkpoint, and every pickup can be reached.
//  - A boss-fighting bot (logic/bot.js) beats every boss through the real simulation, with the
//    plain buster and no Energy Tanks at the default pace (two Energy Tanks at the hardest
//    pace), and with each boss's weakness weapon at any pace.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/megaboy/logic/', import.meta.url).href;
const { STAGES } = await import(base + 'stages.js');
const { reach } = await import(base + 'reach.js');
const { World } = await import(base + 'game.js');
const { fightBoss } = await import(base + 'bot.js');
const { BOSSES } = await import(base + 'bosses.js');
const { Level } = await import(base + 'level.js');
const { WEAPON_ORDER } = await import(base + 'constants.js');

test('the reach checker is not a pushover: an over-wide gap and a too-high ledge fail', () => {
  const mk = (r12, r9 = '') => {
    const map = [];
    for (let r = 0; r < 15; r++) map.push(r >= 12 ? r12 : '#' + '.'.repeat(38) + '#');
    map[11] = '#...P' + '.'.repeat(34) + '#';
    if (r9) map[8] = r9;
    map[10] = map[10].slice(0, 36) + 'D' + map[10].slice(37);
    map[11] = map[11].slice(0, 36) + 'D' + map[11].slice(37);
    return { id: 't', boss: 'ember', theme: 'orange', map };
  };
  const wide = mk('#'.repeat(12) + '.'.repeat(7) + '#'.repeat(21));
  assert.equal(reach(wide).doorReached, false, '7-tile pit');
  const ok = mk('#'.repeat(12) + '...' + '#'.repeat(25));
  assert.equal(reach(ok).doorReached, true, '3-tile pit');
  // a wall five tiles high with nothing to climb
  const wall = mk('#'.repeat(40));
  for (let r = 7; r < 12; r++) wall.map[r] = wall.map[r].slice(0, 20) + '#' + wall.map[r].slice(21);
  assert.equal(reach(wall).doorReached, false, 'wall');
});

for (const [id, st] of Object.entries(STAGES)) {
  test(`${id}: the boss door can be reached from the start and from every checkpoint`, () => {
    const r = reach(st, { breakCracks: true });
    assert.ok(r.doorReached, `from the start (got to x=${Math.round(r.maxX)} of ${r.lv.doorCol * 8})`);
    const plain = reach(st);
    assert.ok(plain.doorReached, 'without breaking any cracked blocks');
    for (const cp of new Level(st).checkpoints) {
      const rc = reach(st, { from: cp });
      assert.ok(rc.doorReached, `from the checkpoint at x=${cp.x}`);
    }
    const lv = new Level(st);
    for (const it of lv.items) assert.ok(r.items.has(it.id), `${it.kind} at ${it.id} reachable`);
  });
}

const ALL = WEAPON_ORDER.filter((w) => w !== 'buster');
for (const [id, st] of Object.entries(STAGES)) {
  test(`${id}: the bot beats ${BOSSES[st.boss].name} with the buster alone, and faster with its weakness`, () => {
    // default pace: buster only, no Energy Tanks; hardest pace: buster plus two Energy Tanks
    for (const [skill, tanks] of [[0.35, 0], [1, 2]]) {
      const w = new World({ stage: st, skill, weapons: [], etanks: tanks, seed: 7 });
      const r = fightBoss(w, { weapon: null, etanks: tanks > 0 });
      assert.ok(r.won, `buster at pace ${skill} with ${tanks} E-tanks: ${JSON.stringify(r)}`);
    }
    // the weakness weapon wins without Energy Tanks even at the hardest pace
    const hard = fightBoss(new World({ stage: st, skill: 1, weapons: ALL, seed: 7 }), { weapon: BOSSES[st.boss].weak, etanks: false });
    assert.ok(hard.won, `weakness at the hardest pace: ${JSON.stringify(hard)}`);
    const weak = BOSSES[st.boss].weak;
    const w = new World({ stage: st, skill: 0.35, weapons: ALL, seed: 7 });
    const r = fightBoss(w, { weapon: weak, etanks: false });
    assert.ok(r.won, `with ${weak}: ${JSON.stringify(r)}`);
    const b = fightBoss(new World({ stage: st, skill: 0.35, weapons: [], seed: 7 }), {});
    assert.ok(r.time < b.time, `weakness (${r.time.toFixed(1)}s) beats buster (${b.time.toFixed(1)}s)`);
  });
}
