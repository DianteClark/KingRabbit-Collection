// Pocket Pets: the whole game is completable. A bot plays the journey through the pure logic
// modules (no Phaser), the way a sensible player would: grind in the grass, catch a team, heal at
// clinics, buy potions, beat the tamers and the leaders in order, then the Champion.
// The helpers are also used by pocket-pets.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const base = '../games/pocket-pets/logic/';
const imp = (f) => import(new URL(`${base}${f}`, import.meta.url).href);
const G = await imp('game.js');
const B = await imp('battle.js');
const A = await imp('ai.js');
const P = await imp('pet.js');
const D = await imp('data.js');
const W = await imp('world.js');
const { makeRng } = await imp('rng.js');
const { typeMult } = await imp('types.js');

export { G, B, A, P, D, W };

/** Fight one battle to the end with the bot. Returns the battle. */
export function playBattle(state, setup, rng, { skill = 0.5, catchItem = null } = {}) {
  const b = B.createBattle({
    kind: setup.kind, party: state.party, bag: state.bag, foeParty: setup.foeParty, foe: setup.foe, rng,
    ai: setup.kind === 'trainer' ? A.makeAI(skill, rng) : null,
  });
  let guard = 0;
  while (b.phase !== 'over' && guard++ < 500) {
    if (b.phase === 'switch') { B.sendOut(b, A.bestSwitch(b, 0).idx); continue; }
    const ev = B.takeTurn(b, A.botAction(b, rng, { catchItem }));
    for (const e of ev) {
      if (e.t !== 'learn' || e.auto) continue;
      const pet = state.party.find((p) => p.uid === e.uid);
      // Replace the weakest move if the new one hits harder.
      let worst = 0; let wp = Infinity;
      pet.moves.forEach((m, i) => { const pw = D.MOVES[m.id].power || 30; if (pw < wp) { wp = pw; worst = i; } });
      if ((D.MOVES[e.move].power || 30) > wp) P.learnMove(pet, e.move, worst);
    }
  }
  if (b.phase !== 'over') throw new Error('battle did not finish');
  const caught = b.result === 'caught' ? B.active(b, 1) : null;
  const out = G.afterBattle(state, setup, b.result, caught);
  for (const pet of G.pendingEvolutions(state)) G.evolvePet(state, pet);
  b.out = out;
  return b;
}

const avgTop = (state, n = 3) => {
  const lv = state.party.map((p) => p.lv).sort((a, b) => b - a).slice(0, n);
  return lv.reduce((a, x) => a + x, 0) / lv.length;
};

/** Keep the six best pets in the party (by level, preferring type variety). */
function organise(state) {
  const all = [...state.party, ...state.box].sort((a, b) => b.lv - a.lv);
  const party = []; const types = new Set();
  for (const p of all) if (party.length < 6 && !types.has(P.petType(p))) { party.push(p); types.add(P.petType(p)); }
  for (const p of all) if (party.length < 6 && !party.includes(p)) party.push(p);
  state.party = party;
  state.box = all.filter((p) => !party.includes(p));
}

function shopFor(state, stock) {
  const want = [['superpotion', 6], ['potion', 6], ['curedrop', 2], ['capsule', 6], ['supercap', 4], ['revive', 2]];
  const items = G.shopStock(state, stock);
  for (const [it, n] of want) {
    if (!items.includes(it)) continue;
    while ((state.bag[it] || 0) < n && state.coins >= D.ITEMS[it].price + 100) G.buy(state, it, 1);
  }
}

/**
 * Play the whole game. Returns a report { done, battles, blackouts, levels, log }.
 * skill: the adaptive tamer skill to use for every computer tamer (0 easy .. 1 hard).
 */
export function playThrough({ seed = 1, starter = 'embit', skill = 0.5, maxBattles = 4000 } = {}) {
  const state = G.newGame(seed);
  const rng = makeRng(seed * 7 + 3);
  const log = [];
  G.chooseStarter(state, starter);
  let battles = 0;
  const heal = () => G.healAll(state);
  const grindIn = (mapId, target, catchNew = true) => {
    const map = W.MAPS[mapId];
    let n = 0;
    while (avgTop(state, Math.min(3, state.party.length)) < target && n < 600 && battles < maxBattles) {
      const { sp, lv } = G.rollWild(map.wild.grass, rng);
      const setup = G.wildSetup(state, sp, lv);
      const fresh = catchNew && !state.dex.caught[sp];
      const cap = ['ultracap', 'supercap', 'capsule'].find((c) => state.bag[c] > 0);
      playBattle(state, setup, rng, { skill, catchItem: fresh ? cap : null });
      battles += 1; n += 1;
      organise(state);
      if (state.party.some((p) => p.hp < P.maxHp(p) * 0.5) || state.party.some((p) => p.st)) heal();
    }
    return n;
  };
  const fight = (setup, label, retryMap, retryTarget) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      heal();
      const b = playBattle(state, JSON.parse(JSON.stringify(setup)), rng, { skill });
      battles += 1;
      if (b.result === 'win') { log.push(`${label}: won (attempt ${attempt + 1}, top lv ${avgTop(state).toFixed(1)})`); heal(); return true; }
      log.push(`${label}: lost (top lv ${avgTop(state).toFixed(1)})`);
      grindIn(retryMap, retryTarget + 2 * (attempt + 1));
    }
    return false;
  };
  const npc = (mapId, id) => G.npcsOn(state, mapId).find((n) => n.id === id) || W.MAPS[mapId].npcs.find((n) => n.id === id);
  const tamer = (mapId, id, grindMap, target) => fight(G.trainerSetup(state, npc(mapId, id)), id, grindMap, target);
  const leader = (id, grindMap, target) => fight(G.leaderSetup(state, id), id, grindMap, target);

  const steps = [
    () => tamer('sproutvale', 'rival1', 'route1', 6),
    () => { grindIn('route1', 7); shopFor(state, 'basic'); return tamer('route1', 'r1_pip', 'route1', 7) && tamer('route1', 'r1_mae', 'route1', 8); },
    () => { grindIn('route1', 12); shopFor(state, 'town'); return leader('fern', 'route1', 13); },
    () => { grindIn('woods', 14); shopFor(state, 'town'); return tamer('woods', 'wd_ivy', 'woods', 14) && tamer('woods', 'wd_rook', 'woods', 15) && tamer('woods', 'wd_ash', 'woods', 15); },
    () => { grindIn('cave', 18); return tamer('cave', 'cv_dig', 'cave', 17) && tamer('cave', 'cv_volt', 'cave', 18) && leader('cinder', 'cave', 19); },
    () => { shopFor(state, 'city'); grindIn('cave', 22); return tamer('peakside', 'rival2', 'cave', 22) && leader('marina', 'cave', 24); },
    () => { grindIn('trail', 27); shopFor(state, 'city'); return ['tr_lee', 'tr_sol', 'tr_bo', 'tr_ada'].every((id) => tamer('trail', id, 'trail', 28)); },
    () => { grindIn('trail', 30); shopFor(state, 'city'); return leader('rocco', 'trail', 31); },
    () => { grindIn('trail', 33); shopFor(state, 'city'); return leader('aria', 'trail', 35); },
  ];
  let done = true;
  for (const s of steps) { if (!s()) { done = false; break; } }
  return {
    done, battles, state, log,
    blackouts: state.stats.blackouts,
    levels: state.party.map((p) => `${P.petName(p)} ${p.lv}`),
    badges: state.badges.length, champion: state.champion,
  };
}

export { typeMult };

// ---------------------------------------------------------------- the whole game

// Only when this file is run itself (pocket-pets.test.mjs imports the helpers above).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
for (const starter of isMain ? D.STARTERS : []) {
  for (const skill of [0.35, 1]) {
    test(`completable: ${starter} beats all four leaders and the Champion (tamer skill ${skill})`, () => {
      const r = playThrough({ seed: 11, starter, skill });
      assert.ok(r.done, r.log.join('\n'));
      assert.equal(r.badges, 4);
      assert.ok(r.champion);
      assert.ok(r.battles < 700, `took ${r.battles} battles`);
    });
  }
}
