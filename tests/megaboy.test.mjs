// MegaBoy Run: physics, stage data, weapons, enemies, bosses, progression, adaptive tuning and
// the touch layout, all through the pure logic modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../games/megaboy/', import.meta.url).href;
const C = await import(base + 'logic/constants.js');
const { Level, moveY } = await import(base + 'logic/level.js');
const { newPlayer, stepPlayer, hurtPlayer } = await import(base + 'logic/player.js');
const { World } = await import(base + 'logic/game.js');
const { STAGES, ROBOT_STAGES } = await import(base + 'logic/stages.js');
const { BOSSES, ROBOT_BOSSES, bossDamage, makeBoss } = await import(base + 'logic/bosses.js');
const { makeEnemy, blocks } = await import(base + 'logic/enemies.js');
const { tuneFor, PRESETS } = await import(base + 'logic/tune.js');
const PR = await import(base + 'logic/progress.js');
const L = await import(base + 'layout.js');

const { TILE, DT, P, T } = C;

// A little test room: floor at row 12, walls at both ends, extra rows set per test.
function room(rows = {}, { width = 40, extra } = {}) {
  const map = [];
  for (let r = 0; r < 15; r++) {
    let row = r >= 12 ? '#'.repeat(width) : '#' + '.'.repeat(width - 2) + '#';
    if (rows[r]) row = rows[r].padEnd(width, '.').slice(0, width);
    map.push(row);
  }
  if (!map.some((r) => r.includes('P'))) map[11] = map[11].slice(0, 4) + 'P' + map[11].slice(5);
  return { id: 'test', boss: 'ember', theme: 'orange', map, ...extra };
}
const run = (p, lv, frames, inp = {}) => {
  let t = 0; const evs = [];
  for (let i = 0; i < frames; i++) { t += DT; evs.push(...stepPlayer(p, typeof inp === 'function' ? inp(i, p) : inp, lv, t, DT)); }
  return evs;
};

// ------------------------------------------------------------------ physics

test('a full jump rises about 3.4 tiles and a tap jump much less', () => {
  const lv = new Level(room());
  const p = newPlayer(80, 96);
  let top = p.y;
  run(p, lv, 60, (i) => ({ jump: true, jumpP: i === 0 }));
  // measure the peak during a fresh jump
  const q = newPlayer(80, 96); let peak = q.y;
  run(q, lv, 60, (i) => { peak = Math.min(peak, q.y); return { jump: true, jumpP: i === 0 }; });
  const rise = (96 - P.h) - peak;
  assert.ok(rise > 3 * TILE && rise < 3.6 * TILE, `rise ${rise}`);
  const r = newPlayer(80, 96); let peak2 = r.y;
  run(r, lv, 60, (i) => { peak2 = Math.min(peak2, r.y); return { jump: i < 4, jumpP: i === 0 }; });
  assert.ok((96 - P.h) - peak2 < rise * 0.5, 'letting go early gives a short hop');
  assert.ok(top !== undefined);
});

test('running jump clears a 4-tile pit and lands; falling in a pit is reported', () => {
  const map = room({ 12: '#'.repeat(14) + '....' + '#'.repeat(22), 13: '#'.repeat(14) + '....' + '#'.repeat(22), 14: '#'.repeat(14) + '....' + '#'.repeat(22) });
  const lv = new Level(map);
  const p = newPlayer(8 * TILE, 96);
  let jumped = -1;
  const ev = run(p, lv, 140, (i, q) => {
    if (jumped < 0 && q.x > 14 * TILE - 2) jumped = i;   // take off right at the edge
    return { r: true, jump: jumped >= 0, jumpP: i === jumped };
  });
  assert.ok(!ev.includes('pit'));
  assert.ok(p.onGround && p.x > 18 * TILE, `landed at ${p.x}`);
  const q = newPlayer(15 * TILE + 4, 96 - 30);
  const ev2 = run(q, lv, 120, {});
  assert.ok(ev2.includes('pit'));
});

test('ladders: up to the top and stand on it, down again; jumping lets go', () => {
  const rows = {};
  for (let r = 6; r <= 11; r++) rows[r] = '#' + '.'.repeat(9) + 'HH' + '.'.repeat(27) + '#';
  rows[6] = '#' + '#'.repeat(9) + 'HH' + '.'.repeat(27) + '#';
  const lv = new Level(room(rows));
  const p = newPlayer(10 * TILE + 8, 96);
  const ev = run(p, lv, 200, { u: true });
  assert.ok(ev.includes('ladderTop'));
  assert.equal(p.y + p.h, 6 * TILE, 'standing on the ladder top');
  assert.equal(p.climb, null);
  run(p, lv, 20, { l: true });
  assert.equal(p.y + p.h, 6 * TILE, 'walk onto the ledge');
  run(p, lv, 20, { r: true });
  run(p, lv, 240, { d: true });
  assert.equal(p.y + p.h, 96, 'climbed back down');
  const q = newPlayer(10 * TILE + 8, 96);
  run(q, lv, 30, { u: true });
  assert.notEqual(q.climb, null);
  run(q, lv, 2, (i) => ({ jump: true, jumpP: i === 0 }));
  assert.equal(q.climb, null);
});

test('conveyors push, spikes hurt, knockback and blinking protect', () => {
  const lv = new Level(room({ 12: '#'.repeat(5) + '>'.repeat(20) + '#'.repeat(15) }));
  const p = newPlayer(8 * TILE, 96);
  const x0 = p.x; run(p, lv, 60, {});
  assert.ok(p.x - x0 > 20, 'carried right');
  const lv2 = new Level(room({ 12: '#'.repeat(10) + '^^' + '#'.repeat(28) }));
  const q = newPlayer(10 * TILE + 4, 96);
  const ev = run(q, lv2, 2, {});
  assert.ok(ev.includes('spike'));
  assert.ok(hurtPlayer(q, P.spikeDmg, q.x + 20));
  assert.equal(q.hp, P.maxHp - P.spikeDmg);
  assert.ok(!hurtPlayer(q, 5, q.x), 'no damage while blinking');
  assert.ok(q.kb > 0 && q.kbDir === -1, 'pushed away from the hit');
});

test('moving platforms carry the player and appearing blocks come and go in turn', () => {
  const rows = { 12: '#'.repeat(5) + '.'.repeat(30) + '#'.repeat(5), 13: '#'.repeat(5) + '.'.repeat(30) + '#'.repeat(5), 14: '#'.repeat(40) };
  rows[11] = '#....M' + '.'.repeat(33) + '#';
  const lv = new Level(room(rows, { extra: { movers: [{ dx: 80, period: 4 }] } }));
  const p = newPlayer(5 * TILE + 12, 88);
  let t = 0;
  for (let i = 0; i < 120; i++) { t += DT; stepPlayer(p, {}, lv, t, DT); }
  assert.ok(p.x > 5 * TILE + 40, `carried to ${p.x}`);
  assert.ok(p.onGround);
  const lv2 = new Level(room({ 10: '#.....1....2....#', 12: '#'.repeat(40) }, { extra: { blink: { period: 4, on: 2.2, groups: 2 } } }));
  const [a, b] = lv2.blinks;
  assert.ok(lv2.blinkOn(a, 0.5) && !lv2.blinkOn(b, 0.5));
  assert.ok(lv2.blinkOn(a, 2.1) && lv2.blinkOn(b, 2.1), 'they overlap a little');
  assert.ok(!lv2.blinkOn(a, 3) && lv2.blinkOn(b, 3));
});

// ------------------------------------------------------------------ stages

test('every stage map is well formed: 15 rows, start, checkpoint, shutter and a wide flat arena', () => {
  const bosses = new Set();
  for (const [id, st] of Object.entries(STAGES)) {
    const lv = new Level(st);
    assert.equal(lv.rows, 15, id);
    assert.ok(lv.start, `${id} start`);
    assert.ok(lv.checkpoints.length >= 1, `${id} checkpoint`);
    assert.ok(lv.doorCol > 0, `${id} door`);
    const arenaCols = lv.cols - lv.doorCol - 1;
    assert.ok(arenaCols * TILE >= C.VIEW_W, `${id} arena fills the screen (${arenaCols} cols)`);
    const floor = lv.bossAt.y / TILE;
    assert.equal(floor, 10, `${id} floor sits at row 10, just above the touch buttons`);
    for (let c = lv.doorCol; c < lv.cols; c++) assert.equal(lv.at(c, floor), T.SOLID, `${id} arena floor at ${c}`);
    assert.ok(lv.bossAt && lv.bossAt.x > lv.arena.x0, `${id} boss inside arena`);
    assert.ok(lv.start.x > 8 * TILE, `${id} start is clear of the d-pad`);
    const periods = new Set([...lv.movers.map((m) => m.period), ...(lv.blinks.length ? [lv.blink.period] : [])]);
    assert.ok(periods.size <= 1, `${id} moving things share one cycle`);
    assert.ok(BOSSES[st.boss], `${id} boss`);
    bosses.add(st.boss);
    for (const s of lv.spawns) assert.ok(s.x < lv.doorCol * TILE, `${id} no enemies in the arena`);
  }
  assert.equal(bosses.size, Object.keys(STAGES).length, 'one boss per stage');
  assert.deepEqual([...ROBOT_STAGES].map((s) => STAGES[s].boss).sort(), [...ROBOT_BOSSES].sort());
});

test('first-time tips cover each stage\'s new hazards and fit in a toast', () => {
  for (const [id, st] of Object.entries(STAGES)) {
    assert.ok(st.hints.some((h) => h.id === 'door'), `${id} door tip`);
    assert.ok(st.hints.some((h) => h.id === 'checkpoint'), `${id} checkpoint tip`);
    for (const h of st.hints) assert.ok(h.text.length <= 84, `${h.id} is short`);
  }
  assert.ok(STAGES.jungle.hints.some((h) => h.id === 'mover'));
  assert.ok(STAGES.cryo.hints.some((h) => h.id === 'blink'));
  assert.ok(STAGES.mine.hints.some((h) => h.id === 'crack'));
});

// ------------------------------------------------------------------ world flow

function world(stage = 'foundry', o = {}) { return new World({ stage: STAGES[stage], seed: 3, ...o }); }
const stepN = (w, n, inp = {}) => { for (let i = 0; i < n; i++) w.step(typeof inp === 'function' ? inp(i) : inp); };

test('READY, then play; the camera never shows the boss room before the shutter', () => {
  const w = world();
  assert.equal(w.mode, 'ready');
  stepN(w, 61);
  assert.equal(w.mode, 'play');
  w.p.x = w.lv.doorCol * TILE - 40; stepN(w, 1);
  assert.ok(w.camX + C.VIEW_W <= (w.lv.doorCol + 1) * TILE + 0.01);
});

test('touching the shutter opens it, walks you in, closes it and starts the boss', () => {
  const w = world();
  stepN(w, 61);
  w.p.x = w.lv.doorCol * TILE - 20;
  let modes = new Set();
  stepN(w, 400, (i) => { modes.add(w.mode); return { r: w.mode === 'play' }; });
  assert.ok(modes.has('door') && modes.has('bossIntro'));
  assert.equal(w.mode, 'boss');
  assert.ok(w.p.x > w.lv.arena.x0);
  assert.equal(w.lv.doorOpen, false, 'shut behind you');
  assert.equal(w.boss.hp, C.BOSS_HP);
  assert.ok(w.boss.onGround, 'the boss dropped onto the floor');
  assert.ok(w.camX >= w.lv.doorCol * TILE - 0.01, 'camera locked on the arena');
});

test('losing a life restarts at the checkpoint; the last life ends in game over', () => {
  const w = world('foundry', { lives: 1 });
  stepN(w, 61);
  const cp = w.lv.checkpoints[0];
  w.p.x = cp.x + 4; stepN(w, 2);
  assert.equal(w.cp, 0);
  w.die(false);
  stepN(w, 120);
  assert.equal(w.lives, 0);
  assert.ok(Math.abs(w.p.x + w.p.w / 2 - cp.x) < 1, 'back at the flag');
  stepN(w, 61);
  w.die(true);
  stepN(w, 120);
  assert.equal(w.mode, 'gameover');
});

test('an E-tank is collected once, saved by id, and refills health from the pause menu', () => {
  const w = world('foundry');
  stepN(w, 61);
  const tank = w.drops.find((d) => d.kind === 'etank');
  assert.ok(tank);
  w.p.x = tank.x; w.p.y = tank.y - 2;
  stepN(w, 2);
  assert.equal(w.etanks, 1);
  assert.ok(w.found.has(tank.placed));
  w.p.hp = 5;
  assert.ok(w.useEtank());
  assert.equal(w.p.hp, P.maxHp);
  assert.equal(w.etanks, 0);
  const again = world('foundry', { found: [...w.found] });
  assert.ok(!again.drops.some((d) => d.kind === 'etank'), 'not there next visit');
});

// ------------------------------------------------------------------ weapons

function arena(weapons = C.WEAPON_ORDER) {
  const w = new World({ stage: room({}, { width: 60 }), weapons, seed: 2 });
  stepN(w, 61);
  return w;
}
const addEnemy = (w, kind, x) => { const e = makeEnemy(kind, { id: 0, x, y: 96 }, w, w.id()); w.enemies.push(e); w.spawnState[0] = { alive: true }; return e; };

test('buster: three pellets at most, holding charges a stronger shot', () => {
  const w = arena();
  w.spawnState = [{ alive: true }];
  for (let i = 0; i < 10; i++) { w.step({ shoot: true }); w.step({}); }
  assert.ok(w.count('pellet') <= 3);
  const v = arena();
  stepN(v, Math.ceil(P.chargeFull / DT) + 2, { shoot: true });
  v.step({});
  assert.ok(v.shots.some((s) => s.kind === 'full' && s.dmg === 3));
});

test('each boss weapon behaves differently and spends energy', () => {
  const fire = (name) => { const w = arena(); w.selectWeapon(name); w.step({ shoot: true }); return w; };
  const e = fire('ember'); assert.ok(e.shots[0].vy < 0, 'ember is lobbed'); assert.equal(e.energy.ember, C.MAX_ENERGY - 2);
  const v = fire('volt'); assert.equal(v.shots.length, 3, 'three sparks'); assert.ok(new Set(v.shots.map((s) => Math.sign(s.vy))).size === 3);
  const t = fire('thorn'); assert.equal(t.shots.length, 4); assert.ok(t.shots.every((s) => s.orbit));
  t.step({}); t.step({ shoot: true });
  assert.ok(t.shots.every((s) => !s.orbit && s.vx !== 0), 'second press throws the ring');
  assert.equal(t.energy.thorn, C.MAX_ENERGY - 3, 'throwing is free');
  // ice pierces two enemies in a row
  const ice = arena(); ice.selectWeapon('ice');
  const a = addEnemy(ice, 'walker', ice.p.x + 40); const b = addEnemy(ice, 'walker', ice.p.x + 70);
  a.hp = 1; b.hp = 1;
  ice.step({ shoot: true }); stepN(ice, 30);
  assert.ok(a.gone && b.gone, 'both down');
  // gale comes back
  const g = fire('gale'); let far = 0;
  for (let i = 0; i < 120; i++) { g.step({}); if (g.shots[0]) far = Math.max(far, Math.abs(g.shots[0].x - g.p.x)); }
  assert.ok(far > 20 && g.shots.length === 0, 'out and back');
  // empty
  const z = arena(); z.selectWeapon('drill'); z.energy.drill = 1; z.step({ shoot: true });
  assert.ok(z.events.some((ev) => ev.type === 'empty'));
});

test('the Drill Seeker breaks cracked blocks', () => {
  const w = new World({ stage: room({ 10: '#' + '.'.repeat(14) + '%%%' + '.'.repeat(42) + '#', 11: '#...P' + '.'.repeat(10) + '%%%' + '.'.repeat(42) + '#' }, { width: 60 }), weapons: ['drill'], seed: 1 });
  stepN(w, 61);
  w.selectWeapon('drill');
  w.step({ shoot: true }); stepN(w, 120);
  assert.ok(w.lv.broken.size >= 2);
  assert.equal(w.lv.at(15, 11), T.EMPTY);
});

test('the thorn ring eats enemy bullets', () => {
  const w = arena(); w.selectWeapon('thorn'); w.step({ shoot: true });
  const b = w.bullet({ x: w.p.x + w.p.w / 2 + 30, y: w.p.y + w.p.h / 2, vx: -60, vy: 0, dmg: 3 });
  stepN(w, 40);
  assert.ok(!w.bullets.includes(b));
  assert.equal(w.p.hp, P.maxHp);
});

// ------------------------------------------------------------------ enemies

test('hard hats deflect shots while hiding; guards only from the front', () => {
  const w = arena();
  const h = addEnemy(w, 'hardhat', 200);
  assert.ok(blocks(h, { x: 100, w: 4 }));
  h.shield = false; assert.ok(!blocks(h, { x: 100, w: 4 }));
  const g = addEnemy(w, 'guard', 200); g.face = -1;
  assert.ok(blocks(g, { x: 100, w: 4 }), 'from the front');
  assert.ok(!blocks(g, { x: 300, w: 4 }), 'from behind');
});

test('adaptive presets: easier means slower fire, less chase and more drops; boss HP fixed', () => {
  const e = tuneFor(0); const n = tuneFor(0.5); const h = tuneFor(1);
  assert.ok(e.fire > n.fire && n.fire > h.fire);
  assert.ok(e.aggro < n.aggro && n.aggro < h.aggro);
  assert.ok(e.drop > n.drop && n.drop > h.drop);
  assert.deepEqual(tuneFor(0.5), PRESETS.normal);
  for (const s of [0, 0.5, 1]) {
    const w = new World({ stage: STAGES.foundry, skill: s });
    assert.equal(makeBoss('ember', w).hp, C.BOSS_HP);
    assert.equal(w.lv.cols, new Level(STAGES.foundry).cols, 'layout unchanged');
  }
  // turret fire gaps really stretch
  const gap = (skill) => {
    const w = new World({ stage: room({}, { width: 60 }), skill, seed: 1 }); stepN(w, 61);
    const t = addEnemy(w, 'turret', w.p.x + 60); t.t = 0; let first = null; let second = null;
    for (let i = 0; i < 600 && second === null; i++) { w.step({}); w.p.hp = P.maxHp; w.p.inv = 1; const n = w.bullets.length; if (n && first === null) first = i; else if (first !== null && w.events.some((ev) => ev.type === 'eshot') && i > first) second = i; w.events.length = 0; }
    return second - first;
  };
  assert.ok(gap(0) > gap(1));
});

// ------------------------------------------------------------------ bosses

test('weakness loop: each robot boss is weak to exactly one other robot boss\'s weapon, in one cycle', () => {
  const weaponOf = Object.fromEntries(ROBOT_BOSSES.map((b) => [BOSSES[b].weapon, b]));
  let cur = 'ember'; const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(cur);
    const weak = BOSSES[cur].weak;
    assert.ok(weaponOf[weak] && weaponOf[weak] !== cur, `${cur} weak to another boss's weapon`);
    cur = weaponOf[weak];
  }
  assert.equal(cur, 'ember', 'back to the start');
  assert.equal(new Set(seen).size, 6, 'all six in one loop');
  for (const b of Object.keys(BOSSES)) {
    assert.equal(bossDamage(b, { weapon: BOSSES[b].weak, kind: 'x' }), 4);
    assert.ok(bossDamage(b, { weapon: 'buster', kind: 'pellet' }) === 1);
    if (BOSSES[b].weapon) assert.equal(bossDamage(b, { weapon: BOSSES[b].weapon, kind: 'x' }), 0, 'immune to its own weapon');
  }
});

// ------------------------------------------------------------------ progress and saving

test('progress: weapons from bosses, the fortress after six, the ending after the core', () => {
  let p = PR.newProgress();
  assert.ok(!PR.unlocked(p, 'fort1'));
  assert.equal(PR.suggestion(p), 'foundry');
  for (const id of ROBOT_STAGES) {
    const w = new World({ stage: STAGES[id] });
    p = PR.winStage(p, id, w);
  }
  assert.equal(p.weapons.length, 6);
  assert.ok(PR.unlocked(p, 'fort1') && !PR.unlocked(p, 'fort2'));
  assert.equal(PR.fortressStage(p), 'fort1');
  p = PR.winStage(p, 'fort1', new World({ stage: STAGES.fort1 }));
  assert.equal(PR.fortressStage(p), 'fort2');
  p = PR.winStage(p, 'fort2', new World({ stage: STAGES.fort2 }));
  assert.ok(p.done);
  // after Ember, suggest the boss weak to Ember's weapon
  const q = PR.winStage(PR.newProgress(), 'foundry', new World({ stage: STAGES.foundry }));
  assert.equal(STAGES[PR.suggestion(q)].boss, 'thorn');
});

test('progress: broken saves are repaired, game over refills lives', () => {
  assert.deepEqual(PR.normalize(null), PR.newProgress());
  assert.deepEqual(PR.normalize({ v: 7 }), PR.newProgress());
  const fixed = PR.normalize({ v: 1, beaten: ['ember', 'nope', 'ember'], weapons: ['ember', 'laser'], etanks: 99, lives: -3, fort: 9 });
  assert.deepEqual(fixed.beaten, ['ember']);
  assert.deepEqual(fixed.weapons, ['ember']);
  assert.equal(fixed.etanks, C.MAX_ETANKS);
  assert.equal(fixed.lives, 0);
  assert.equal(fixed.fort, 2);
  assert.equal(PR.afterGameOver(fixed).lives, C.START_LIVES);
});

// ------------------------------------------------------------------ touch layout

test('controls fit on screen, are big enough and never overlap', () => {
  const circ = (c, s = 0) => ({ x0: c.x - c.r - s, x1: c.x + c.r + s, y0: c.y - c.r - s, y1: c.y + c.r + s });
  const rect = (r, s = 0) => ({ x0: r.x - r.w / 2 - s, x1: r.x + r.w / 2 + s, y0: r.y - r.h / 2 - s, y1: r.y + r.h / 2 + s });
  const boxes = { pause: rect(L.PAUSE_BTN), help: rect(L.HELP_BTN), shoot: circ(L.SHOOT), jump: circ(L.JUMP), swap: rect(L.SWAP), dpad: circ(L.DPAD) };
  for (const [k, b] of Object.entries(boxes)) {
    assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 640 && b.y1 <= 360, `${k} on screen`);
    assert.ok(b.x1 - b.x0 >= 40 && b.y1 - b.y0 >= 40, `${k} at least 40 px`);
  }
  for (let x = 0; x < 640; x += 2) {
    for (let y = 0; y < 360; y += 2) {
      const n = [L.hitShoot(x, y), L.hitJump(x, y), L.hitSwap(x, y), L.inDpadZone(x, y)].filter(Boolean).length;
      assert.ok(n <= 1, `${x},${y} hits ${n} controls`);
    }
  }
  assert.ok(!L.inDpadZone(L.PAUSE_BTN.x, L.PAUSE_BTN.y));
  // bars sit between the pause and help buttons
  assert.ok(L.BARS.x > L.PAUSE_BTN.x + L.PAUSE_BTN.w / 2);
  assert.ok(L.BOSS_BAR.y > L.HELP_BTN.y + L.HELP_BTN.h / 2 && L.BOSS_BAR.y + L.BOSS_BAR.h < 240);
  // the floor is at screen y 240 (row 10 at 3x): the action buttons stay below it
  for (const c of [L.SHOOT, L.JUMP]) assert.ok(c.y - c.r >= 240, 'buttons below the floor line');
  assert.ok(L.SWAP.y - L.SWAP.h / 2 >= 240 && L.DPAD.y - L.DPAD.r >= 230);
});

test('d-pad: angle from the centre picks the direction, with a dead spot and diagonals', () => {
  const D = L.DPAD;
  assert.deepEqual(L.dpadDir(D.x, D.y), { l: false, r: false, u: false, d: false });
  assert.ok(L.dpadDir(D.x + 40, D.y).r && !L.dpadDir(D.x + 40, D.y).u);
  assert.ok(L.dpadDir(D.x - 40, D.y + 5).l);
  assert.ok(L.dpadDir(D.x, D.y - 40).u && !L.dpadDir(D.x, D.y - 40).r);
  assert.ok(L.dpadDir(D.x + 5, D.y + 40).d);
  const diag = L.dpadDir(D.x + 30, D.y - 30);
  assert.ok(diag.r && diag.u);
  assert.ok(L.dpadDir(200, 160).r, 'far right of the zone still runs right');
});
