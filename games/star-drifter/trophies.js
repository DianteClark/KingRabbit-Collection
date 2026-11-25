// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'star-drifter';

export const TROPHIES = [
  { id: 'first-kill', name: 'First Kill', desc: 'Win your first ship battle', tier: 'bronze' },
  { id: 'crew-win', name: 'Boarding Party', desc: 'Win a fight by defeating the enemy crew', tier: 'silver' },
  { id: 'sector-4', name: 'Deep Space', desc: 'Reach sector 4', tier: 'bronze' },
  { id: 'sector-8', name: 'Throne Gate', desc: 'Reach the final sector', tier: 'silver' },
  { id: 'victory', name: 'Flagship Down', desc: 'Destroy the Iron Verdict', tier: 'gold' },
  { id: 'normal-win', name: 'Hard Light', desc: 'Win a run in Normal mode', tier: 'gold' },
  { id: 'corvid-win', name: 'Black Wings', desc: 'Win a run flying the Corvid', tier: 'gold' },
  { id: 'all-hands', name: 'All Hands', desc: 'Win a run without losing any crew', tier: 'gold' },
  { id: 'scrap-300', name: 'Scrap Baron', desc: 'Hold 300 scrap at once', tier: 'bronze' },
  { id: 'full-crew', name: 'Full House', desc: 'Have six crew aboard', tier: 'silver' },
  { id: 'fled', name: 'Live to Fight', desc: 'Jump away from a losing fight', tier: 'bronze' },
  { id: 'daily', name: 'Daily Drifter', desc: 'Finish a Daily Run', tier: 'bronze' },
  { id: 'daily-sector-5', name: 'Day Tripper', desc: 'Reach sector 5 on a Daily Run', tier: 'silver' },
  { id: 'one-hull', name: 'By a Thread', desc: 'Win a fight with 1 hull left', tier: 'silver', secret: true },
];

export const DAILY = { title: 'Daily Run', desc: 'Same galaxy and ship for everyone' };

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
