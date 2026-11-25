// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'sand-tactics';

export const TROPHIES = [
  { id: 'first-mission', name: 'First Orders', desc: 'Win your first campaign mission', tier: 'bronze' },
  { id: 'mission-4', name: 'Field Commander', desc: 'Win campaign mission 4', tier: 'silver' },
  { id: 'campaign', name: 'Dune Liberator', desc: 'Complete the campaign', tier: 'gold' },
  { id: 'skirmish', name: 'Skirmisher', desc: 'Beat the CPU in a skirmish', tier: 'bronze' },
  { id: 'all-maps', name: 'Map Master', desc: 'Win a skirmish on every map', tier: 'gold' },
  { id: 'worthy-foe', name: 'Worthy Foe', desc: 'Beat the CPU at level 8 or higher', tier: 'gold' },
  { id: 'hq', name: 'Flag Raiser', desc: 'Win by capturing the enemy HQ', tier: 'bronze' },
  { id: 'rout', name: 'Clean Sweep', desc: 'Win by destroying every enemy unit', tier: 'silver' },
  { id: 'blitz', name: 'Blitz', desc: 'Beat the CPU by day 8', tier: 'silver' },
  { id: 'versus', name: 'Hot Seat', desc: 'Finish a 2-player battle', tier: 'bronze' },
  { id: 'daily', name: 'Daily Dispatch', desc: 'Win the Daily Skirmish', tier: 'silver' },
  { id: 'no-losses', name: 'Not One Lost', desc: 'Beat the CPU without losing a unit', tier: 'gold', secret: true },
  { id: 'captor', name: 'Land Grab', desc: 'Capture 10 buildings in one battle', tier: 'bronze', secret: true },
];

export const DAILY = { title: 'Daily Skirmish', desc: 'Same map and CPU for everyone; win in the fewest days' };

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
