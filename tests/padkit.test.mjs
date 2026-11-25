// Controller support: every game's padkit.js is the same file, and it loads in node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const GAMES = ['soccer', 'megaboy', 'darkhold', 'pocket-pets', 'game-night', 'star-drifter', 'robbox'];
const file = (g) => new URL(`../games/${g}/padkit.js`, import.meta.url);

test('every wired game has the same padkit.js', () => {
  const first = readFileSync(file(GAMES[0]), 'utf8');
  for (const g of GAMES) {
    assert.ok(existsSync(file(g)), `${g}/padkit.js`);
    assert.equal(readFileSync(file(g), 'utf8'), first, `${g}/padkit.js differs from soccer's`);
    const main = readFileSync(new URL(`../games/${g}/main.js`, import.meta.url), 'utf8');
    assert.match(main, /\.then\(installPad\)/, `${g} installs the controller at boot`);
    const rules = readFileSync(new URL(`../games/${g}/rules.js`, import.meta.url), 'utf8');
    assert.match(rules, /Controller/, `${g} mentions the controller in How to play`);
  }
});

test('padkit is harmless without a controller (and in node)', async () => {
  const m = await import(file('soccer'));
  assert.equal(m.down('a'), false);
  assert.equal(m.hit('a'), false);
  assert.equal(m.rep('left'), false);
  assert.deepEqual(m.stick(), { x: 0, y: 0 });
  assert.equal(m.usingPad(), false);
});
