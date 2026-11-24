// Darkhold balance: a simple bot plays whole runs with fixed seeds through the same actions a
// player has. It explores, fights whatever is next to it, drinks unknown potions when desperate
// and keeps its torch fed. These bounds say "winnable, but not a walk in the park" for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/darkhold/logic/', import.meta.url).href;
const Bot = await import(L + 'bot.js');

function batch(mode, perClass, seed0) {
  const out = [];
  for (const cls of ['knight', 'rogue', 'mage']) {
    for (let s = 0; s < perClass; s++) out.push({ cls, ...Bot.playRun({ cls, mode, seed: seed0 + s, skill: 0.35 }) });
  }
  return out;
}

test('normal mode: the bot clears a fair share of runs and every run ends', () => {
  const runs = batch('normal', 5, 300);
  for (const r of runs) assert.ok(r.st.over, `${r.cls} run got stuck on floor ${r.depth}`);
  const wins = runs.filter((r) => r.won).length;
  const avgDepth = runs.reduce((a, r) => a + r.depth, 0) / runs.length;
  assert.ok(wins >= 4, `only ${wins}/${runs.length} wins`);
  assert.ok(wins <= runs.length - 1, 'never loses: too easy');
  assert.ok(avgDepth >= 6, `average depth ${avgDepth.toFixed(1)}`);
  for (const cls of ['knight', 'rogue', 'mage']) assert.ok(runs.some((r) => r.cls === cls && r.depth >= 5), `${cls} never got past floor 4`);
});

test('Lantern mode is clearly easier', () => {
  const runs = batch('lantern', 3, 500);
  for (const r of runs) assert.ok(r.st.over, `${r.cls} run got stuck`);
  const wins = runs.filter((r) => r.won).length;
  assert.ok(wins >= 6, `only ${wins}/${runs.length} Lantern wins`);
});

test('harder monster awareness costs the bot more runs than easier awareness', () => {
  const play = (skill) => {
    let depth = 0; let wins = 0;
    for (let s = 0; s < 6; s++) {
      const r = Bot.playRun({ cls: ['knight', 'rogue', 'mage'][s % 3], mode: 'normal', seed: 900 + s, skill });
      depth += r.depth + (r.won ? 3 : 0); if (r.won) wins++;
    }
    return { depth, wins };
  };
  const easy = play(0);
  const hard = play(1);
  assert.ok(easy.depth >= hard.depth, `easy ${JSON.stringify(easy)} vs hard ${JSON.stringify(hard)}`);
});
