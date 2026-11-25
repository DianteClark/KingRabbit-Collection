// Hollow Crown: saves from the old tall-room layout (v1) load into the wide-room world (v2),
// nothing a player could have in storage makes the game crash, and trophies fire at the right moments.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/hero-quest/logic/', import.meta.url).href;
const { ROOMS } = await import(base + 'data.js');
const { Game, VERSION } = await import(base + 'game.js');
const { migrate, areaStart } = await import(base + 'migrate.js');
const W = await import(base + 'world.js');
const S = await import(base + 'solver.js');

// A real v1 save: Mossy Hollow beaten, Ember Lab half done, the lake cave opened, standing in the lab.
const V1 = {
  v: 1, maxHp: 10, hp: 7, gems: 133, potions: 1, bombs: 6,
  items: { sword: true, boomerang: true, bombs: true },
  keys: { d1: 0, d2: 1, d3: 0 }, bigKeys: { d1: true, d2: false, d3: false },
  flags: {
    'boss:d1': true, 'hc:d1': true, 'seen:d1:1,2': true, 'trig:ow:2,1:crystal': true, 'trig:d1:2,2:switch': true,
    'door:d1:1,1v': true, 'door:d1:1,0v': true, 'door:d2:1,1v': true,
    'chest:d1:0,2:5,5': true, 'chest:d1:2,1:5,5': true, 'chest:d1:0,1:2,5': true, 'chest:d2:0,1:5,5': true,
    'chest:in:cave:5,5': true, 'cell:ow:2,2:4,10': true, 'bought:heart': true,
  },
  respawn: { room: 'd2:1,2', x: 5, y: 11, dir: 'up' },
  selected: 'bombs', deaths: 3, time: 1234, kills: 80, done: false,
};

test('a v1 save keeps items, hearts, gems, keys and progress, and restarts at its dungeon entrance', () => {
  const s = migrate(JSON.parse(JSON.stringify(V1)));
  assert.equal(s.v, VERSION);
  assert.deepEqual([s.maxHp, s.hp, s.gems, s.potions, s.bombs], [10, 7, 133, 1, 6]);
  assert.deepEqual(s.items, { sword: true, boomerang: true, bombs: true });
  assert.equal(s.keys.d2, 1);
  assert.ok(s.bigKeys.d1);
  for (const f of ['boss:d1', 'hc:d1', 'trig:ow:2,1:crystal', 'door:d1:1,1v', 'bought:heart']) assert.ok(s.flags[f], f);
  assert.deepEqual(s.respawn, areaStart('d2:1,2'));
  assert.equal(s.respawn.room, 'd2:1,2');
  // chests are found again by what they held
  const opened = (rid, item) => {
    const r = ROOMS[rid];
    const [xy] = Object.entries(r.chests).find(([, c]) => c.item === item);
    const [x, y] = xy.split(',').map(Number);
    return !!s.flags[W.chestFlag(r, x, y)];
  };
  assert.ok(opened('d1:2,1', 'boomerang') && opened('d1:0,1', 'bigkey') && opened('d2:0,1', 'bombs') && opened('in:cave', 'heart'));
  assert.ok(!opened('d2:2,1', 'key'), 'unopened stays unopened');
  // the bombed lake rock is still open
  const lake = ROOMS['ow:2,2'];
  const [cx, cy] = lake.map.flatMap((row, y) => [...row].map((c, x) => (c === 'c' ? [x, y] : null))).find(Boolean);
  assert.ok(s.flags[W.cellFlag(lake, cx, cy)]);
  // and it loads and plays
  const g = new Game({ state: s, instant: true });
  assert.equal(g.room.id, 'd2:1,2');
  for (let i = 0; i < 30; i++) g.update(1 / 60, { my: -1 });
  assert.equal(g.mode, 'play');
});

test('a migrated save can still finish the adventure', () => {
  const s = migrate(JSON.parse(JSON.stringify(V1)));
  const seen = S.reachable(s.flags, s.respawn);
  assert.ok(seen.has('d2:1,1|8,5') || [...seen].some((k) => k.startsWith('d2:1,1|')), 'the Ember Lab hub is reachable with its key spent');
  assert.ok([...seen].some((k) => k.startsWith('ow:0,2|')), 'the way home is open');
});

test('overworld and early saves restart sensibly', () => {
  const ow = migrate({ ...V1, respawn: { room: 'ow:1,1', x: 5, y: 6, dir: 'down' } });
  assert.equal(ow.respawn.room, 'ow:0,2');
  const fresh = migrate({ v: 1, items: { sword: false }, flags: {}, respawn: { room: 'in:elder', x: 5, y: 8 } });
  assert.equal(fresh.respawn.room, 'in:elder', 'before the sword you wake in the elder\'s house');
  new Game({ state: fresh, instant: true });
});

test('nothing in storage can crash the game', () => {
  const junk = [null, undefined, 0, 'save', [], {}, { v: 1 }, { v: 1, flags: 'oops', items: 5, keys: null },
    { v: 1, respawn: { room: 'nowhere' } }, { v: 99, flags: {} }, { v: VERSION, respawn: { room: 'ow:9,9', x: 1, y: 1 } },
    { v: VERSION, respawn: { room: 'd1:1,2', x: 40, y: 40 }, flags: {}, items: { sword: true } },
    { v: 1, maxHp: 'lots', hp: -5, gems: NaN, flags: { 'chest:d1:0,2:5,5': true } }];
  for (const j of junk) {
    let s;
    assert.doesNotThrow(() => { s = migrate(j); }, `migrate ${JSON.stringify(j)}`);
    if (s) assert.doesNotThrow(() => new Game({ state: s, instant: true }), `load ${JSON.stringify(j)}`);
  }
});

test('trophies: 10-15 of them, all tiers, a couple secret, earned at the right moments', async () => {
  const { TROPHIES, awardsFor } = await import(new URL('../games/hero-quest/trophies.js', import.meta.url).href);
  assert.ok(TROPHIES.length >= 10 && TROPHIES.length <= 15);
  for (const t of ['bronze', 'silver', 'gold']) assert.ok(TROPHIES.some((d) => d.tier === t), t);
  assert.ok(TROPHIES.filter((d) => d.secret).length >= 2);
  assert.equal(new Set(TROPHIES.map((d) => d.id)).size, TROPHIES.length);
  const ids = new Set(TROPHIES.map((d) => d.id));
  const ctx = (s = {}, all = false) => ({ s: { deaths: 0, time: 9999, ...s }, allChestsOpen: () => all });
  const got = (ev, c = ctx()) => awardsFor(ev, c).awards;
  assert.deepEqual(got({ type: 'get', item: 'sword', room: 'in:elder' }), ['sword']);
  assert.deepEqual(got({ type: 'get', item: 'heart', room: 'in:cave' }), ['cave']);
  assert.deepEqual(got({ type: 'get', item: 'heart', room: 'd1:1,0' }), []);
  assert.deepEqual(got({ type: 'get', item: 'gems20', room: 'ow:1,0' }, ctx({}, true)), ['treasure']);
  assert.deepEqual(got({ type: 'bossDown', area: 'd1', hurt: true }), ['slime-king']);
  assert.deepEqual(got({ type: 'bossDown', area: 'd3', hurt: false }), ['untouched']);
  assert.deepEqual(got({ type: 'ending' }, ctx({ deaths: 2, time: 4000 })), ['crown']);
  assert.deepEqual(got({ type: 'ending' }, ctx({ deaths: 0, time: 1200 })), ['crown', 'steady', 'swift']);
  assert.deepEqual(got({ type: 'trigger', kind: 'switch' }), ['puzzle']);
  assert.deepEqual(got({ type: 'trigger', kind: 'crystal' }), []);
  assert.deepEqual(got({ type: 'bought', id: 'heart' }), ['charm']);
  assert.deepEqual(awardsFor({ type: 'die', kind: 'redSlime' }, ctx()).stats, { enemies: 1, slimes: 1 });
  assert.deepEqual(awardsFor({ type: 'die', kind: 'gremlin' }, ctx()).stats, { enemies: 1 });
  for (const ev of [{ type: 'get', item: 'sword', room: 'x' }, { type: 'bossDown', area: 'd2', hurt: false }, { type: 'ending' }]) {
    for (const a of got(ev, ctx({ time: 1 }, true))) assert.ok(ids.has(a), a);
  }
  // counter trophies ('shield', 'slimes') are defined too
  assert.ok(ids.has('shield') && ids.has('slimes'));
});

test('the game emits the events trophies listen for', () => {
  const g = new Game({ instant: true });
  g.s.items.sword = true; g.s.gems = 500;
  g.events.length = 0;
  g.buy('heart');
  assert.ok(g.events.some((e) => e.type === 'bought' && e.id === 'heart'));
  g.enterRoom('d1:2,2', 40, 88, 'right');
  g.fireTrigger('switch');
  assert.ok(g.events.some((e) => e.type === 'trigger' && e.kind === 'switch'));
  assert.equal(g.allChestsOpen(), false);
});
