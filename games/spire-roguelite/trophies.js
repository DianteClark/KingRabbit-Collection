// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'spire-roguelite';

export const TROPHIES = [
  { id: 'first-fight', name: 'Blooded', desc: 'Win your first battle', tier: 'bronze' },
  { id: 'elite', name: 'Elite Hunter', desc: 'Defeat an elite enemy', tier: 'bronze' },
  { id: 'boss', name: 'Boss Breaker', desc: 'Defeat an act boss', tier: 'bronze' },
  { id: 'act-3', name: 'Thin Air', desc: 'Reach Act 3', tier: 'silver' },
  { id: 'win', name: 'Top of the Spire', desc: 'Win a Normal run', tier: 'gold' },
  { id: 'all-heroes', name: 'Three Crowns', desc: 'Win with the Knight, Mage and Ranger', tier: 'gold' },
  { id: 'endless-loop', name: 'Round Again', desc: 'Clear all three acts in Endless', tier: 'silver' },
  { id: 'endless-2', name: 'Endless Ascent', desc: 'Clear all three acts twice in Endless', tier: 'gold' },
  { id: 'relics-10', name: 'Curio Cabinet', desc: 'Hold 10 relics at once', tier: 'silver' },
  { id: 'gold-300', name: 'Treasure Pile', desc: 'Hold 300 gold at once', tier: 'bronze' },
  { id: 'lean-win', name: 'Travel Light', desc: 'Win a run with 15 cards or fewer', tier: 'gold' },
  { id: 'daily', name: 'Daily Climber', desc: 'Finish a Daily Climb', tier: 'bronze' },
  { id: 'daily-win', name: 'Peak of the Day', desc: 'Win a Daily Climb', tier: 'silver' },
  { id: 'close-shave', name: 'Close Shave', desc: 'Win a battle on exactly 1 HP', tier: 'silver', secret: true },
  { id: 'flawless-boss', name: 'Untouchable', desc: 'Beat a boss without taking damage', tier: 'gold', secret: true },
];

export const DAILY = { title: 'Daily Climb', desc: 'One seeded spire and hero for everyone' };

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
