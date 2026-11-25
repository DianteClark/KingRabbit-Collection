// Every game's trophy list is valid, every trophy is earned somewhere in that game's code, and the
// wrappers are harmless in node (tests and bots never show toasts or touch the profile).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../games/', import.meta.url));
const GAMES = ['game-night', 'city-chief', 'soccer', 'heroes-lite', 'spire-roguelite', 'sand-tactics', 'pocket-pets',
  'robbox', 'alchemist', 'star-drifter', 'pangea', 'megaboy', 'darkhold', 'town-builder'];
const TIERS = new Set(['bronze', 'silver', 'gold']);
// One line on the launcher's Trophies page on a 360px-wide phone.
const MAX_NAME = 20;
const MAX_DESC = 40;

function sources(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!['assets', 'public', 'atlas'].includes(f)) out.push(...sources(p)); } else if (f.endsWith('.js') && f !== 'trophies.js') out.push(p);
  }
  return out;
}

const { GAMES: LISTED } = await import(new URL('../shared/games.js', import.meta.url));

for (const id of GAMES) {
  test(`${id}: trophy list is valid`, async () => {
    const m = await import(new URL(`../games/${id}/trophies.js`, import.meta.url));
    assert.equal(m.GAME_ID, id);
    assert.ok(LISTED.some((g) => g.id === id), 'game id is in shared/games.js');
    const defs = m.TROPHIES;
    const [min, max] = id === 'game-night' ? [45, 60] : [10, 16];
    assert.ok(defs.length >= min && defs.length <= max, `${defs.length} trophies`);
    const ids = defs.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length, 'unique ids');
    for (const d of defs) {
      assert.match(d.id, /^[a-z0-9-]+$/, d.id);
      assert.ok(TIERS.has(d.tier), `${d.id} tier ${d.tier}`);
      assert.ok(d.name && d.name.length <= MAX_NAME, `${d.id} name "${d.name}" (${d.name.length})`);
      assert.ok(d.desc && d.desc.length <= MAX_DESC, `${d.id} desc "${d.desc}" (${d.desc.length})`);
      assert.ok(!/\n/.test(d.name + d.desc));
    }
    for (const tier of TIERS) assert.ok(defs.some((d) => d.tier === tier), `has a ${tier} trophy`);
    const secrets = defs.filter((d) => d.secret).length;
    assert.ok(secrets >= 1 && secrets <= 3, `${secrets} secret trophies`);
    assert.equal(new Set(defs.map((d) => d.name)).size, defs.length, 'unique names');
    if (m.DAILY) assert.ok(m.DAILY.title && m.DAILY.desc, 'daily has a title and a description');
  });

  test(`${id}: every trophy is awarded in the code, and only known ones`, async () => {
    const m = await import(new URL(`../games/${id}/trophies.js`, import.meta.url));
    const ids = new Set(m.TROPHIES.map((d) => d.id));
    const code = sources(join(ROOT, id)).map((p) => readFileSync(p, 'utf8')).join('\n');
    assert.match(code, /initTrophies\(\)/, 'initTrophies() is called at boot');
    for (const [, used] of code.matchAll(/\bearn\('([^']+)'\)/g)) assert.ok(ids.has(used), `earn('${used}') is not a trophy`);
    // Ids built at run time (earn(`world-${w}`), earn(s.mode)) still appear as text somewhere.
    for (const t of ids) {
      const tail = t.slice(t.lastIndexOf('-'));
      const literal = code.includes(`'${t}'`) || code.includes(`\`${t.replace(/-\d+$/, '-${')}`) || code.includes(`}${tail}\``);
      assert.ok(literal, `trophy '${t}' is never awarded`);
    }
  });
}

test('trophy wrappers are no-ops in node', async () => {
  for (const id of GAMES) {
    const m = await import(new URL(`../games/${id}/trophies.js`, import.meta.url));
    assert.doesNotThrow(() => m.initTrophies());
    assert.equal(m.earn(m.TROPHIES[0].id), false);
    assert.doesNotThrow(() => m.stat('anything', 2));
    assert.equal(m.daily(10), null);
    assert.equal(typeof m.todaySeed(), 'number');
  }
});
