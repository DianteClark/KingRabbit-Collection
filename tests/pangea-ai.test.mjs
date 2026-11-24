// Pangea computer rivals: small situations, whole AI-vs-AI games, and the adaptive skill setting.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = '../games/pangea/';
const G = await import(new URL(`${base}logic/game.js`, import.meta.url).href);
const AI = await import(new URL(`${base}logic/ai.js`, import.meta.url).href);
const D = await import(new URL(`${base}logic/data.js`, import.meta.url).href);

const HARD = AI.aiParams(1);
const EASY = AI.aiParams(0);

function blank(n = 2) {
  const s = G.newGame([{ civ: 'verdan' }, { civ: 'kharun' }, { civ: 'thess' }].slice(0, n), { seed: 5 });
  for (const t of s.tiles) { t.t = 'grass'; t.f = null; t.r = null; t.imp = null; t.o = -1; t.c = -1; }
  s.units = []; s.cities = []; s.events = [];
  for (const c of s.civs) { c.explored.fill(1); c.human = false; }
  return s;
}
function cityAt(s, owner, x, y) {
  const prev = s.cur; s.cur = owner;
  const ct = G.foundCity(s, G.addUnit(s, owner, 'settler', x, y));
  s.cur = prev;
  return ct;
}

test('ai: params blend from easy to hard', () => {
  assert.ok(HARD.cities > EASY.cities);
  assert.ok(HARD.attackOdds > EASY.attackOdds);
  assert.ok(HARD.smartBuild > EASY.smartBuild);
  const mid = AI.aiParams(0.5);
  assert.ok(mid.smartBuild > EASY.smartBuild && mid.smartBuild < HARD.smartBuild);
});

test('ai: founds its capital on turn 1, picks research and something to build', () => {
  const s = G.newGame([{ civ: 'verdan' }, { civ: 'kharun' }], { seed: 11 });
  for (const c of s.civs) c.human = false;
  AI.playTurn(s, 0, HARD);
  const cities = G.citiesOf(s, 0);
  assert.equal(cities.length, 1);
  assert.ok(s.civs[0].research);
  assert.ok(cities[0].queue.length > 0);
});

test('ai: expands, improves land and garrisons its cities over the first 60 turns', () => {
  const s = G.newGame([{ civ: 'sunreach' }, { civ: 'lumen' }, { civ: 'thess' }], { seed: 17 });
  for (const c of s.civs) c.human = false;
  while (s.turn <= 60 && !s.over) { AI.playTurn(s, s.cur, HARD); s.offers = []; G.endTurn(s); }
  for (const c of s.civs) {
    const cs = G.citiesOf(s, c.id);
    assert.ok(cs.length >= 3, `${c.name} has ${cs.length} cities`);
    assert.ok(c.techs.length >= 6, `${c.name} knows ${c.techs.length} techs`);
    assert.ok(s.tiles.some((t) => t.o === c.id && t.imp), `${c.name} built farms or mines`);
    const guarded = cs.filter((ct) => s.units.some((u) => u.owner === c.id && !G.isCivilian(u) && G.dist(u.x, u.y, ct.x, ct.y) <= 1));
    assert.ok(guarded.length >= cs.length - 1, `${c.name} guards its cities`);
  }
});

test('ai: never throws a unit at a hopeless attack', () => {
  for (const k of [0, 0.5, 1]) {
    const s = blank();
    cityAt(s, 0, 3, 3); cityAt(s, 1, 15, 15);
    G.declareWar(s, 0, 1);
    const w = G.addUnit(s, 0, 'warrior', 8, 8);
    const sp = G.addUnit(s, 1, 'musketeer', 9, 8);
    G.tileAt(s, 9, 8).f = 'hills';
    sp.fort = true;
    s.cur = 0;
    AI.playTurn(s, 0, AI.aiParams(k));
    assert.ok(G.unitById(s, sp.id), 'the musketeer is untouched');
    assert.ok(G.unitById(s, w.id), `skill ${k} kept its warrior alive`);
  }
});

test('ai: takes an undefended enemy city and finishes a beaten defender', () => {
  const s = blank();
  cityAt(s, 0, 3, 3);
  const target = cityAt(s, 1, 10, 10);
  cityAt(s, 1, 18, 18);
  G.declareWar(s, 0, 1);
  G.addUnit(s, 0, 'warrior', 3, 3);
  G.addUnit(s, 0, 'knight', 9, 9);
  s.cur = 0;
  AI.playTurn(s, 0, HARD);
  assert.equal(target.owner, 0, 'the empty city was taken');

  const s2 = blank();
  cityAt(s2, 0, 3, 3); cityAt(s2, 1, 18, 18);
  G.declareWar(s2, 0, 1);
  G.addUnit(s2, 0, 'warrior', 3, 3);
  G.addUnit(s2, 0, 'swordsman', 9, 9);
  const hurt = G.addUnit(s2, 1, 'warrior', 10, 9);
  hurt.hp = 2;
  s2.cur = 0;
  AI.playTurn(s2, 0, HARD);
  assert.equal(G.unitById(s2, hurt.id), null);
});

test('ai: an undefended city under threat switches to a defender', () => {
  const s = blank();
  const ct = cityAt(s, 0, 5, 5); cityAt(s, 1, 18, 18);
  ct.pop = 3;
  s.civs[0].techs.push('pottery');
  ct.queue = [{ kind: 'bld', id: 'granary' }];
  G.declareWar(s, 0, 1);
  G.addUnit(s, 1, 'swordsman', 7, 6);
  s.cur = 0;
  AI.playTurn(s, 0, HARD);
  assert.equal(ct.queue[0].kind, 'unit');
  assert.ok(!D.UNITS[ct.queue[0].id].civ);
});

test('ai: offers peace to a human when the war goes badly, and the human can accept', () => {
  const s = blank();
  cityAt(s, 0, 3, 3); cityAt(s, 1, 15, 15);
  s.civs[0].human = true;
  s.civs[0].met[1] = true; s.civs[1].met[0] = true;
  G.declareWar(s, 1, 0);
  s.turn += 30;
  for (let k = 0; k < 6; k++) G.addUnit(s, 0, 'knight', 2 + k, 2);
  s.cur = 1;
  for (let k = 0; k < 30 && !(s.offers || []).length; k++) AI.playTurn(s, 1, HARD);
  const offer = (s.offers || []).find((o) => o.to === 0 && o.kind === 'peace');
  assert.ok(offer);
  assert.ok(AI.answerOffer(s, offer, true));
  assert.equal(G.atWar(s, 0, 1), false);
});

test('ai vs ai: whole games end in a victory', () => {
  const kinds = new Set();
  for (const seed of [3, 8, 13]) {
    const s = G.newGame([{ civ: 'kharun' }, { civ: 'lumen' }, { civ: 'ironvale' }], { seed, maxTurn: 150 });
    AI.simulate(s, [0.5, 0.5, 0.5]);
    assert.ok(s.over, 'the game ended');
    assert.ok(s.civs[s.over.winner], 'with a winner');
    assert.ok(['conquest', 'science', 'score'].includes(s.over.kind));
    assert.ok(s.over.turn <= 150);
    kinds.add(s.over.kind);
  }
  assert.ok(kinds.size >= 1);
});

test('ai vs ai: a quick 100-turn game ends on time', () => {
  const s = G.newGame([{ civ: 'verdan' }, { civ: 'zanbar' }], { seed: 4, maxTurn: 100 });
  AI.simulate(s, [0.5, 0.5]);
  assert.ok(s.over && s.over.turn <= 100);
});

test('ai vs ai: the stronger setting wins more often', () => {
  let wins = 0; let ratio = 0;
  const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const strong = seed % 2;
    const skills = [0, 0]; skills[strong] = 1;
    const s = G.newGame([{ civ: 'verdan' }, { civ: 'kharun' }], { seed: seed * 37 + 5, maxTurn: 150 });
    AI.simulate(s, skills);
    if (s.over.winner === strong) wins++;
    const sc = s.civs.map((c) => G.score(s, c.id));
    ratio += sc[strong] / Math.max(1, sc[1 - strong]);
  }
  assert.ok(wins > N / 2, `hard won ${wins} of ${N}`);
  assert.ok(ratio / N > 1.1, `score ratio ${ratio / N}`);
});
