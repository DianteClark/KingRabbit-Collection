// Controller support: games use the one shared/core/padkit.js, install it at boot and say so in
// How to play, and padkit is harmless in node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAMES = [
  'soccer', 'megaboy', 'darkhold', 'pocket-pets', 'game-night', 'star-drifter', 'robbox',
  'hero-quest', 'hearth-valley', 'pixel-quest', 'gem-quest', 'sand-siege', 'mini-golf', 'colony',
  'city-chief', 'town-builder', 'pangea', 'heroes-lite', 'sand-tactics', 'alchemist', 'spire-roguelite',
];
const ROOT = fileURLToPath(new URL('../games/', import.meta.url));

function files(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!['assets', 'public', 'atlas', 'tools', 'art'].includes(f)) out.push(...files(p)); } else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

test('padkit lives in shared/core and no game keeps its own copy', () => {
  assert.ok(existsSync(new URL('../shared/core/padkit.js', import.meta.url)));
  for (const g of readdirSync(ROOT)) assert.ok(!existsSync(join(ROOT, g, 'padkit.js')), `games/${g}/padkit.js should be gone`);
});

for (const g of GAMES) {
  test(`${g}: installs the shared padkit and documents the controller`, () => {
    const main = readFileSync(join(ROOT, g, 'main.js'), 'utf8');
    assert.match(main, /from '\.\.\/\.\.\/shared\/core\/padkit\.js'/);
    assert.match(main, /\.then\(installPad\)/, 'installs the controller at boot');
    const rules = readFileSync(join(ROOT, g, 'rules.js'), 'utf8');
    assert.match(rules, /Controller/, 'How to play mentions the controller');
    for (const f of files(join(ROOT, g))) {
      const src = readFileSync(f, 'utf8');
      if (/padkit\.js'/.test(src)) assert.match(src, /from '(\.\.\/)+shared\/core\/padkit\.js'/, `${f} imports the shared padkit`);
    }
  });
}

test('padkit is harmless without a controller (and in node)', async () => {
  const m = await import(new URL('../shared/core/padkit.js', import.meta.url));
  assert.equal(m.down('a'), false);
  assert.equal(m.hit('a'), false);
  assert.equal(m.rep('left'), false);
  assert.deepEqual(m.stick(), { x: 0, y: 0 });
  assert.equal(m.usingPad(), false);
  assert.doesNotThrow(() => m.onPadMode(() => {})());
});
