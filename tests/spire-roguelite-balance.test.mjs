// Spire Roguelite balance checks: a simple bot plays fights and whole runs with fixed seeds.
// The bot is a decent but simple player (greedy turn planning, naive deck building), so these
// bounds describe "winnable but not trivial" for it; people who plan ahead do better.
import test from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/spire-roguelite/logic/', import.meta.url).href;
const R = await import(L + 'run.js');
const E = await import(L + 'enemies.js');
const B = await import(L + 'bot.js');
const C = await import(L + 'cards.js');

const HEROES = C.CLASSES;

function starterFight(hero, enemies, kind, seed) {
  const run = R.newRun({ hero, seed });
  R.startFight(run, enemies, kind);
  const before = run.hp;
  const result = B.playFight(run);
  return { win: result === 'win', lost: before - run.combat.player.hp, turns: run.combat.turn };
}

test('act 1 opening fights: always winnable with the starter deck, but they hurt a bit', () => {
  for (const hero of HEROES) {
    let lost = 0;
    let n = 0;
    for (const enc of E.ACTS[0].easy) {
      let encLost = 0;
      for (let s = 0; s < 8; s++) {
        const r = starterFight(hero, enc, 'normal', 100 + s);
        assert.ok(r.win, `${hero} lost to ${enc.join('+')} (seed ${100 + s})`);
        encLost += r.lost;
      }
      assert.ok(encLost / 8 < 18, `${hero} vs ${enc.join('+')} too punishing: ${encLost / 8}`);
      lost += encLost;
      n += 8;
    }
    const avg = lost / n;
    assert.ok(avg >= 2 && avg <= 12, `${hero} average HP lost in opening fights: ${avg.toFixed(1)}`);
  }
});

test('act 1 elites are a real threat for a starter deck', () => {
  for (const hero of HEROES) {
    let lost = 0;
    let wins = 0;
    for (const enc of E.ACTS[0].elites) {
      for (let s = 0; s < 4; s++) {
        const r = starterFight(hero, enc, 'elite', 300 + s);
        lost += r.lost;
        if (r.win) wins++;
      }
    }
    const fights = E.ACTS[0].elites.length * 4;
    assert.ok(lost / fights >= 15, `${hero}: elites too easy (${(lost / fights).toFixed(1)} HP lost)`);
    assert.ok(wins / fights >= 0.6, `${hero}: elites unbeatable with a starter deck (${wins}/${fights})`);
  }
});

test('full runs: winnable but not trivial, for every hero', () => {
  const RUNS = 8;
  let wins = 0;
  let reachedAct2 = 0;
  const perHero = {};
  for (const hero of HEROES) {
    let floors = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = B.playRun({ hero, seed: 7000 + i * 13 });
      assert.ok(!r.stopped, 'run got stuck');
      floors += r.floor;
      if (r.won) wins++;
      if (r.won || r.act >= 2) reachedAct2++;
    }
    perHero[hero] = floors / RUNS;
    assert.ok(perHero[hero] >= 14, `${hero} rarely gets past act 1 (avg floor ${perHero[hero]})`);
  }
  const total = RUNS * HEROES.length;
  console.log(`bot: ${wins}/${total} wins, ${reachedAct2}/${total} beat act 1, avg floor`, perHero);
  assert.ok(wins >= 2, `too hard: the bot won ${wins}/${total}`);
  assert.ok(wins <= total * 0.7, `too easy: the bot won ${wins}/${total}`);
  assert.ok(reachedAct2 >= total * 0.5, `act 1 too hard: ${reachedAct2}/${total}`);
});

test('endless mode is a little easier at first and keeps going', () => {
  let normal = 0;
  let endless = 0;
  let loops = 0;
  for (const hero of HEROES) {
    for (let i = 0; i < 4; i++) {
      const seed = 9100 + i * 31;
      normal += Math.min(B.playRun({ hero, seed }).floor, 39);
      const e = B.playRun({ hero, mode: 'endless', seed, maxFloors: 45 });
      endless += Math.min(e.floor, 39);
      if (e.floor > 39) loops++;
    }
  }
  assert.ok(endless >= normal, `endless (${endless}) should go at least as far as normal (${normal})`);
  console.log(`endless floors ${endless} vs normal ${normal}; ${loops} endless runs reached a second loop`);
});
