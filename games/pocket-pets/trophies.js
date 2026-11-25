// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'pocket-pets';

export const TROPHIES = [
  { id: 'first-win', name: 'Rookie Tamer', desc: 'Win your first battle', tier: 'bronze' },
  { id: 'first-catch', name: 'Gotcha!', desc: 'Catch your first wild pet', tier: 'bronze' },
  { id: 'evolve', name: 'Growing Up', desc: 'Watch a pet evolve', tier: 'bronze' },
  { id: 'full-party', name: 'Full Team', desc: 'Have six pets in your party', tier: 'bronze' },
  { id: 'badge', name: 'Badge Bearer', desc: 'Earn your first badge', tier: 'bronze' },
  { id: 'badges-4', name: 'Four Badges', desc: 'Earn all four badges', tier: 'silver' },
  { id: 'champion', name: 'Champion', desc: 'Beat Champion Aria at the Summit', tier: 'gold' },
  { id: 'rematch', name: 'Rematch Ace', desc: 'Beat a Hall leader in a rematch', tier: 'silver' },
  { id: 'level-30', name: 'Strong Bond', desc: 'Raise a pet to level 30', tier: 'silver' },
  { id: 'dex-half', name: 'Field Notes', desc: 'Catch half of the PetDex', tier: 'silver' },
  { id: 'dex-full', name: 'Complete PetDex', desc: 'Catch every kind of pet', tier: 'gold' },
  { id: 'nickname', name: 'Name Giver', desc: 'Give a caught pet a nickname', tier: 'bronze', secret: true },
  { id: 'blackout', name: 'Rough Day', desc: 'Have all your pets faint', tier: 'bronze', secret: true },
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
