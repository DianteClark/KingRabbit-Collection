// Daily Arena: a seeded party fights five waves. Same seed, same challenge for everyone all day.
import { makeRng } from './rng.js';
import { newMember, statsOf } from './stats.js';
import { AREAS } from './data.js';

const LOADOUTS = {
  warrior: [['knight', 'mithril'], ['steel', 'plate'], ['knight', 'plate']],
  cleric: [['holymace', 'silk'], ['holymace', 'chain'], ['crystal', 'silk']],
  thief: [['assassin', 'mithril'], ['kukri', 'garb'], ['assassin', 'garb']],
  mage: [['crystal', 'silk'], ['crystal', 'robe'], ['ashstaff', 'silk']],
};
const CHARMS = ['speedring', 'powerband', 'magiccharm', 'guard', null, null];
const FIELD = ['desert', 'embercave', 'frost', 'castle'];
const BOSSES_MID = ['galewing', 'pyrescorp'];
const BOSSES_END = ['wyvern', 'hive', 'pyrescorp'];

export const WAVES = 5;

export function dailySetup(seed) {
  const rng = makeRng(seed);
  const lv = 21 + rng.int(0, 2);
  const party = ['warrior', 'cleric', 'thief', 'mage'].map((cls) => {
    const m = newMember(cls, lv);
    [m.eq.w, m.eq.a] = rng.pick(LOADOUTS[cls]);
    m.eq.c = rng.pick(CHARMS);
    const s = statsOf(m); m.hp = s.hp; m.mp = s.mp;
    return m;
  });
  const group = (area, n) => Array.from({ length: n }, () => rng.weighted(AREAS[area].mons));
  const waves = [
    group(rng.pick(FIELD.slice(0, 2)), 3),
    group(rng.pick(FIELD.slice(1, 3)), 4),
    [rng.pick(BOSSES_MID)],
    group(rng.pick(FIELD.slice(2)), 4),
    [rng.pick(BOSSES_END)],
  ];
  const bag = { tonic: 3 + rng.int(0, 2), ether: 2 + rng.int(0, 1), lifeleaf: 1 + rng.int(0, 1), bomb: rng.int(0, 2), salts: 2 };
  if (rng.chance(0.4)) bag.elixir = 1;
  return { lv, party, bag, waves, seed };
}

/** Between waves the party catches its breath: a quarter of HP and MP back. */
export function breather(party) {
  for (const m of party) {
    if (m.hp <= 0) continue;
    const s = statsOf(m);
    m.hp = Math.min(s.hp, m.hp + Math.round(s.hp * 0.25));
    m.mp = Math.min(s.mp, m.mp + Math.round(s.mp * 0.2));
  }
}

/** Score: 1000 per wave, up to 500 for HP left, up to 300 for speed. */
export function dailyScore({ cleared, party, rounds }) {
  const hp = party.reduce((s, m) => s + Math.max(0, m.hp), 0);
  const max = party.reduce((s, m) => s + statsOf(m).hp, 0);
  return cleared * 1000 + (cleared >= WAVES ? Math.round(500 * hp / max) + Math.max(0, 300 - rounds * 4) : 0);
}
