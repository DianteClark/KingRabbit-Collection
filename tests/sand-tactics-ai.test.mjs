// Sand Tactics computer player: tactics in small set-ups and whole AI-vs-AI battles.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/sand-tactics/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const AI = await import(new URL(`${base}logic/ai.js`, import.meta.url).href);
const M = await import(new URL(`${base}logic/maps.js`, import.meta.url).href);

const HARD = AI.aiParams(1);
const NORMAL = AI.aiParams(0.5);

/** A test map where Red (side 1) is to move. */
function redToMove(rows, units, extra = {}) {
  const s = G.newGame({ id: `t${Math.random()}`, name: 'T', rows, units, funds: [0, 0], ...extra }, { seed: 3 });
  G.endTurn(s);
  return s;
}

function battle(def, skills, seed, maxDays = 60) {
  const s = G.newGame(def, { seed });
  return AI.simulate(s, skills, { maxDays });
}

test('ai: foot soldiers capture a nearby city', () => {
  const s = redToMove(['h....', '.n...', '.....', '....H'], ['.i...', '.....', '.....', '....I']);
  AI.playTurn(s, 1, HARD);
  const city = G.propAt(s, 1, 1);
  assert.ok(city.capBy, 'the infantry started capturing');
  assert.equal(city.cap, 10);
});

test('ai: focuses fire to finish a hurt unit instead of spreading damage', () => {
  // Two blue tanks; one is badly hurt. Red has two tanks that can reach both.
  for (let seed = 0; seed < 3; seed++) {
    const s = redToMove(['.......', '.......', '.......', '.......', '.......'], ['.......', '.T...T.', '.......', '..t.t..', '.......']);
    s.rng.s = seed;
    const hurt = G.unitAt(s, 1, 1); hurt.hp = 40;
    AI.playTurn(s, 1, HARD);
    assert.equal(G.unitAt(s, 1, 1), null, 'the hurt tank was finished off');
  }
});

test('ai: never throws a unit away on a hopeless attack', () => {
  // A lone infantry next to a heavy tank: attacking does ~1% and the counter kills it.
  for (const skill of [0, 0.5, 1]) {
    const s = redToMove(['.....', '.....', '.....'], ['.....', '.iK..', '.....']);
    const inf = G.unitAt(s, 1, 1);
    inf.hp = 30;
    const step = AI.aiStep(s, 1, AI.aiParams(skill));
    assert.ok(!(step?.kind === 'act' && step.cmd.action === 'attack'), `skill ${skill} attacked`);
  }
});

test('ai: artillery fires before anyone else and is not left alone next to enemies', () => {
  const s = redToMove(
    ['.........', '.........', '.........', '.........', '.........', '.........'],
    ['....a....', '...t.t...', '.........', '....T....', '.........', '.........'],
  );
  const first = AI.aiStep(s, 1, HARD);
  assert.equal(first.cmd.action, 'attack');
  assert.equal(G.unitById(s, first.cmd.id).type, 'arty', 'the gun shoots first');
  assert.deepEqual(first.cmd.to, [4, 0], 'without moving');
  AI.playTurn(s, 1, HARD);
  const arty = G.unitsOf(s, 1).find((u) => u.type === 'arty');
  const guards = G.unitsOf(s, 1).filter((u) => u.type === 'tank' && G.dist(u.x, u.y, arty.x, arty.y) <= 2);
  assert.ok(guards.length >= 1, 'a tank stays near the gun');
});

test('ai: goes after enemy foot soldiers closing on its HQ', () => {
  const s = redToMove(['....h....', '.........', '.........', '.........', '.........', '....H....'], ['.........', '....I....', '.........', '...t.....', '.........', '.........']);
  // Blue infantry is next to the red HQ: the red tank must deal with it.
  AI.playTurn(s, 1, NORMAL);
  const inf = G.unitsOf(s, 0).find((u) => u.type === 'inf');
  assert.ok(!inf || inf.hp < 100, 'the raider was attacked');
});

test('ai: builds units at free factories and spends its funds', () => {
  const s = redToMove(['f...h', '.....', '.....', 'H...F'], ['.....', '..i..', '.....', '.I...'], { funds: [0, 12000] });
  const before = G.unitsOf(s, 1).length;
  AI.playTurn(s, 1, HARD);
  assert.equal(G.unitsOf(s, 1).length, before + 1);
  assert.ok(s.funds[1] < 6000, `left ${s.funds[1]} unspent`);
});

test('ai: a decision step never changes the battle by itself (only its random stream)', () => {
  const s = G.newGame(M.SKIRMISH[1], { seed: 9 });
  for (let i = 0; i < 6; i++) AI.playTurn(s, s.turn, NORMAL);
  const before = JSON.parse(JSON.stringify({ ...s, rng: null }));
  AI.aiStep(s, s.turn, HARD);
  assert.deepEqual(JSON.parse(JSON.stringify({ ...s, rng: null })), before);
});

test('ai: computer-vs-computer battles finish on every skirmish map', () => {
  for (const def of M.SKIRMISH) {
    let ended = 0;
    for (const seed of [1, 2]) {
      const s = battle(def, [0.5, 0.5], seed, 60);
      if (s.over) ended++;
      assert.ok(s.units.length < 200);
    }
    assert.ok(ended >= 1, `${def.id}: no battle finished`);
  }
});

test('ai: the same seed replays the same battle', () => {
  const a = battle(M.SKIRMISH[0], [0.5, 0.7], 4, 12);
  const b = battle(M.SKIRMISH[0], [0.5, 0.7], 4, 12);
  assert.deepEqual(a, b);
});

test('ai: a strong computer beats a weak one most of the time', () => {
  let strong = 0; let n = 0;
  for (const id of ['crossroads', 'twin-lakes']) {
    for (const seed of [1, 2]) {
      for (const seat of [0, 1]) {
        const skills = seat === 0 ? [1, 0] : [0, 1];
        const s = battle(M.skirmishById(id), skills, seed, 45);
        n++;
        if (s.over ? s.winner === seat : G.standing(s, seat) > G.standing(s, 1 - seat)) strong++;
      }
    }
  }
  assert.ok(strong >= Math.ceil(n * 0.7), `strong side won ${strong}/${n}`);
});

test('ai: every campaign mission can be won by a good commander', () => {
  for (const def of M.CAMPAIGN) {
    let won = false;
    for (let seed = 1; seed <= 4 && !won; seed++) {
      const s = battle(def, [1, 0.5], seed, 40);
      won = s.over && s.winner === 0;
    }
    assert.ok(won, `${def.id} (${def.name}) was never won`);
  }
});

test('ai: skill presets blend smoothly', () => {
  const e = AI.aiParams(0); const n = AI.aiParams(0.5); const h = AI.aiParams(1);
  for (const k of Object.keys(AI.PRESETS.normal)) assert.ok(Math.abs(n[k] - AI.PRESETS.normal[k]) < 1e-9, k);
  assert.ok(e.noise > n.noise && n.noise > h.noise);
  assert.ok(e.build < h.build);
  const q = AI.aiParams(0.75);
  assert.ok(Math.abs(q.noise - (n.noise + h.noise) / 2) < 1e-9);
  assert.deepEqual(AI.aiParams(2), h, 'clamped');
});

test('adaptive: wins raise the CPU level, losses lower it, always within 0..1', async () => {
  const A = await import(new URL(`${base}adaptive.js`, import.meta.url).href);
  A.resetSkill();
  const start = A.getSkill();
  A.reportResult(A.SKILL_ID, 1, 0.5);
  const up = A.getSkill();
  assert.ok(up > start);
  A.reportResult(undefined, 0, 1);
  assert.ok(A.getSkill() < up, 'the default id is the CPU skill');
  for (let i = 0; i < 40; i++) A.reportResult(A.SKILL_ID, 1, 1);
  assert.equal(A.getSkill(), 1);
  assert.equal(A.skillLabel(), 10);
  for (let i = 0; i < 40; i++) A.reportResult(A.SKILL_ID, 0, 1);
  assert.equal(A.getSkill(), 0);
});
