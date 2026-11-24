// Star Drifter balance: a simple bot captain plays whole runs with fixed seeds.
// It proves a run can be finished and keeps the difficulty in a sane band. People who plan
// their volleys, crew and upgrades do better than this bot.
import test from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/star-drifter/logic/', import.meta.url).href;
const R = await import(L + 'run.js');
const B = await import(L + 'bot.js');

function play(ship, mode, n, seed0) {
  const out = { wins: 0, sectors: 0, runs: [] };
  for (let k = 0; k < n; k++) {
    const run = R.newRun({ ship, mode, seed: seed0 + k * 13 });
    const end = B.playRun(run);
    assert.ok(end === 'victory' || end === 'dead', `run ends cleanly (got ${end})`);
    if (end === 'victory') out.wins++;
    out.sectors += run.sector;
    out.runs.push(run);
  }
  out.avgSector = out.sectors / n;
  return out;
}

test('bot wins Normal runs at a fair rate with the starting ship', () => {
  const r = play('wayfarer', 'normal', 24, 500);
  assert.ok(r.wins >= 3 && r.wins <= 16, `Wayfarer normal wins ${r.wins}/24`);
  assert.ok(r.avgSector >= 5, `reaches deep sectors (avg ${r.avgSector.toFixed(2)})`);
});

test('Cruise is clearly easier than Normal', () => {
  const n = play('wayfarer', 'normal', 16, 900);
  const c = play('wayfarer', 'cruise', 16, 900);
  assert.ok(c.wins >= n.wins + 3, `cruise ${c.wins} vs normal ${n.wins}`);
  assert.ok(c.wins >= 7, `cruise wins ${c.wins}/16`);
});

test('the unlockable Corvid can win too', () => {
  const r = play('corvid', 'normal', 20, 700);
  assert.ok(r.wins >= 2, `Corvid normal wins ${r.wins}/20`);
});

test('a won run is a real run: every sector, many fights, the flagship', () => {
  const r = play('wayfarer', 'cruise', 8, 1300);
  const won = r.runs.find((run) => run.screen === 'victory');
  assert.ok(won, 'at least one cruise win');
  assert.equal(won.sector, 8);
  assert.ok(won.stats.fights >= 10, `fights ${won.stats.fights}`);
  assert.ok(won.stats.jumps >= 30, `jumps ${won.stats.jumps}`);
});
