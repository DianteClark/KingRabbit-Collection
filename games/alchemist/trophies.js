// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'alchemist';

export const TROPHIES = [
  { id: 'first-brew', name: 'Bubbling', desc: 'Brew your first potion', tier: 'bronze' },
  { id: 'first-sale', name: 'Open for Business', desc: 'Sell your first potion', tier: 'bronze' },
  { id: 'three-star', name: 'Perfect Stir', desc: 'Brew a 3-star potion', tier: 'bronze' },
  { id: 'recipes-10', name: 'Recipe Book', desc: 'Discover 10 potions', tier: 'silver' },
  { id: 'all-recipes', name: 'Master Brewer', desc: 'Discover every potion', tier: 'gold' },
  { id: 'forest', name: 'Into the Woods', desc: 'Open the forest for gathering', tier: 'bronze' },
  { id: 'cave', name: 'Deep Delver', desc: 'Open the cave for gathering', tier: 'silver' },
  { id: 'apprentice', name: 'Extra Hands', desc: 'Hire an apprentice', tier: 'bronze' },
  { id: 'big-day', name: 'Rush Hour', desc: 'Take 150 coins in one day', tier: 'silver' },
  { id: 'happy-day', name: 'All Smiles', desc: 'Make every customer happy in a day (5+)', tier: 'silver' },
  { id: 'festival', name: 'Festival Champion', desc: 'Beat Madame Vex at the festival', tier: 'gold' },
  { id: 'day-60', name: 'Old Hand', desc: 'Keep the shop open to day 60', tier: 'gold' },
  { id: 'sludge', name: 'Murky Business', desc: 'Brew a pot of sludge', tier: 'bronze', secret: true },
  { id: 'sold-sludge', name: 'Snake Oil', desc: 'Sell someone a sludge', tier: 'silver', secret: true },
];

export const DAILY = null;

const live = typeof document !== 'undefined';
const got = new Set();

/** Call once per launch. */
export function initTrophies() {
  if (!live) return;
  registerTrophies(GAME_ID, TROPHIES);
  if (DAILY) registerDaily(GAME_ID, DAILY);
  recordPlay(GAME_ID);
}

/** Earn a trophy (shows a toast the first time). */
export function earn(id) {
  if (!live || got.has(id)) return false;
  got.add(id);
  return award(GAME_ID, id);
}

/** Add to a lifetime counter shown on the launcher's Trophies page. */
export function stat(key, n = 1) { if (live && n) bumpStat(GAME_ID, key, n); }

/** Today's daily seed: the same for everyone all day. */
export const todaySeed = () => dailySeed(GAME_ID);
export { today };

/** Record a daily result; one started on an earlier day (resumed after midnight) doesn't count. */
export function daily(score, day = today(), opts) {
  return live && DAILY && day === today() ? reportDaily(GAME_ID, score, opts) : null;
}
