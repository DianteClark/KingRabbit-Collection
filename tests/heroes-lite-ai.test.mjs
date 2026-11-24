// Computer-player tests: whole games simulated with the AI on both sides.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/heroes-lite/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const { aiTurn, aiParams, runAuto } = await import(new URL(`${base}logic/ai.js`, import.meta.url).href);
const { scenarioById } = await import(new URL(`${base}logic/scenarios.js`, import.meta.url).href);

/**
 * Play a scenario with the computer on both sides. Player 0 is still the "human" slot (fog of war,
 * battles against it go through the same hand-off the real game uses). vision: reveal the map for player 0.
 */
function simulate(id, seed, s0, s1, { days = 120, vision = false, onDay } = {}) {
  const st = G.newGame(scenarioById(id), { seed });
  if (vision) st.players[0].explored.fill(1);
  const P = [aiParams(s0), aiParams(s1)];
  for (let d = 0; d < days && !st.over; d++) {
    for (const p of st.players) {
      if (!p.alive || st.over) continue;
      runAuto(aiTurn(st, p.id, P[p.id]), st, P[0].tactics, P[1].tactics);
    }
    if (!st.over) G.newDay(st);
    onDay?.(st);
  }
  return st;
}

test('ai: makes progress in the first two weeks (mines, buildings, army, levels)', () => {
  let snap = null;
  const st0 = G.newGame(scenarioById('valley'), { seed: 11 });
  const town0 = st0.objects.find((o) => o.kind === 'town' && o.owner === 1);
  const builtAtStart = Object.keys(town0.built).length;
  simulate('valley', 11, 0.5, 0.5, { days: 14, onDay: (st) => { if (st.day === 15 || st.over) snap ??= JSON.parse(JSON.stringify(st)); } });
  assert.ok(snap, 'game still running at day 15 or ended');
  const st = snap;
  const mines = st.objects.filter((o) => o.kind === 'mine' && o.owner === 1).length;
  const town = st.objects.find((o) => o.id === town0.id);
  const heroes = st.heroes.filter((h) => h.owner === 1);
  if (town.owner === 1) {
    assert.ok(Object.keys(town.built).length >= builtAtStart + 4, 'the AI builds most days');
  }
  assert.ok(mines >= 2, `AI flagged ${mines} mines`);
  assert.ok(heroes.some((h) => h.level >= 2 || G.heroArmyValue(h) > 400), 'AI heroes grow');
});

test('ai: computer-vs-computer games end with a winner on every scenario', () => {
  for (const id of ['valley', 'desert', 'frontier']) {
    let ended = 0;
    for (let seed = 1; seed <= 4; seed++) if (simulate(id, seed, 0.5, 0.5).over) ended++;
    assert.ok(ended >= 3, `${id}: only ${ended}/4 games finished`);
  }
});

test('ai: a hard computer beats an easy one most of the time', () => {
  let hardWins = 0; let n = 0;
  for (const id of ['valley', 'desert', 'frontier']) {
    for (let seed = 1; seed <= 6; seed++) {
      const st = simulate(id, seed, 0.1, 0.9);
      n++;
      if (st.over?.winner === 'ai') hardWins++;
    }
  }
  assert.ok(hardWins >= Math.ceil(n * 0.65), `hard won ${hardWins}/${n}`);
});

test('ai: every scenario is winnable by a strong player against the default enemy', () => {
  for (const id of ['valley', 'desert', 'frontier']) {
    let wins = 0;
    for (let seed = 1; seed <= 6 && !wins; seed++) if (simulate(id, seed, 0.9, 0.35, { vision: true }).over?.winner === 'human') wins++;
    assert.ok(wins >= 1, `${id} was never won`);
  }
});

test('ai: endless waves can be held off for weeks, but not forever', () => {
  const st = simulate('endless', 2, 0.6, 0.35, { days: 220, vision: true });
  assert.ok(st.endless.wave >= 6, `only ${st.endless.wave} waves survived`);
  assert.ok(st.over, 'the waves eventually win');
});

test('ai: turns are deterministic, so a reloaded save plays out the same', () => {
  const st = simulate('desert', 5, 0.5, 0.5, { days: 6 });
  const copy = G.deserialize(G.serialize(st));
  const P = aiParams(0.5);
  runAuto(aiTurn(st, 1, P), st, P.tactics, P.tactics);
  runAuto(aiTurn(copy, 1, P), copy, P.tactics, P.tactics);
  assert.equal(G.serialize(st), G.serialize(copy));
});

test('ai: presets get bolder and smarter with skill', () => {
  const e = aiParams(0); const n = aiParams(0.5); const h = aiParams(1);
  assert.ok(e.noise > n.noise && n.noise > h.noise);
  assert.ok(e.buildSmart < h.buildSmart);
  assert.ok(e.maxHeroes < h.maxHeroes);
  assert.ok(e.tactics.retal < h.tactics.retal && e.tactics.noise > h.tactics.noise);
});
