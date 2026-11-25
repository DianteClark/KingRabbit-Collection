// Pixel Quest trophies and the Daily Arena registration (shared/core/trophies.js).
import { registerTrophies, award, recordPlay, registerDaily } from '../../shared/core/trophies.js';
import { chestCounts } from './logic/game.js';

export const GAME = 'pixel-quest';

export const DEFS = [
  { id: 'first-win', name: 'First Victory', desc: 'Win your first battle', tier: 'bronze' },
  { id: 'earth', name: 'Earth Chime', desc: 'Defeat Stonehide in the Mole Cave', tier: 'bronze' },
  { id: 'party', name: 'Party of Four', desc: 'Travel with all four heroes', tier: 'bronze' },
  { id: 'sky', name: 'Sky Chime', desc: 'Defeat Galewing atop the Wind Tower', tier: 'silver' },
  { id: 'fire', name: 'Fire Chime', desc: 'Defeat Pyrescorp in the Ember Cave', tier: 'silver' },
  { id: 'hero', name: 'Dawnbringer', desc: 'Defeat Vesper and bring back the sun', tier: 'gold' },
  { id: 'normal', name: 'True Hero', desc: 'Finish the story on Normal', tier: 'gold' },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Open every treasure chest', tier: 'silver' },
  { id: 'thief', name: 'Sticky Fingers', desc: 'Steal 15 items', tier: 'bronze' },
  { id: 'lv20', name: 'Seasoned', desc: 'Reach level 20', tier: 'silver' },
  { id: 'flawless', name: 'Flawless', desc: 'Beat a boss without anyone falling', tier: 'silver' },
  { id: 'daily', name: 'Arena Champion', desc: 'Clear all five waves of a Daily Arena', tier: 'bronze' },
  { id: 'goldooze', name: 'Gold Rush', desc: 'Defeat a Gold Ooze', tier: 'silver', secret: true },
  { id: 'secret', name: 'Hidden Path', desc: 'Find a secret passage', tier: 'bronze', secret: true },
  { id: 'hive', name: 'Queen Slayer', desc: 'Defeat the hidden Hive Queen', tier: 'gold', secret: true },
];

export function initTrophies() {
  registerTrophies(GAME, DEFS);
  registerDaily(GAME, { title: 'Daily Arena', desc: 'Five seeded waves with a ready-made party' });
  recordPlay(GAME);
}

export const give = (id) => award(GAME, id);

/** Award everything the save already qualifies for (cheap; call after big moments). */
export function checkTrophies(st) {
  if (!st) return;
  const f = st.flags;
  if (st.wins > 0) give('first-win');
  if (st.party.length >= 4) give('party');
  if (f.stonehide) give('earth');
  if (f.galewing) give('sky');
  if (f.pyrescorp) give('fire');
  if (f.vesper) { give('hero'); if (st.difficulty === 'normal' && !st.everStory) give('normal'); }
  if (f.hive) give('hive');
  if (f.goldooze) give('goldooze');
  if ((st.steals || 0) >= 15) give('thief');
  if (st.party.some((m) => m.lv >= 20)) give('lv20');
  if (Object.keys(f).some((k) => k.startsWith('secret_'))) give('secret');
  const c = chestCounts(st);
  if (c.open >= c.total) give('treasure');
}
