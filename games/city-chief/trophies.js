// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'city-chief';

export const TROPHIES = [
  { id: 'first-solve', name: 'First Collar', desc: 'Solve your first call', tier: 'bronze' },
  { id: 'chase', name: 'End of the Road', desc: 'Catch a suspect in a car chase', tier: 'bronze' },
  { id: 'promote', name: 'Moving Up', desc: 'Promote one of your officers', tier: 'bronze' },
  { id: 'week', name: 'One Week In', desc: 'Make it through your first week', tier: 'bronze' },
  { id: 'clean-shift', name: 'Clean Shift', desc: 'Solve every call in a day (10 or more)', tier: 'silver' },
  { id: 'gang', name: 'Gang Buster', desc: 'Bust a gang with a raid', tier: 'silver' },
  { id: 'solves-100', name: 'Case Load', desc: 'Solve 100 calls in one game', tier: 'silver' },
  { id: 'trust-90', name: "Mayor's Favorite", desc: 'Reach 90 trust', tier: 'silver' },
  { id: 'safety-90', name: 'Safe Streets', desc: 'Reach 90 safety', tier: 'silver' },
  { id: 'career', name: 'Chief for Life', desc: 'Complete a 30-day career', tier: 'gold' },
  { id: 'endless-60', name: 'Long Watch', desc: 'Last 60 days in Endless', tier: 'gold' },
  { id: 'everyone-home', name: 'Everyone Home', desc: 'Finish a career with no officer deaths', tier: 'gold', secret: true },
  { id: 'fired', name: 'Pink Slip', desc: 'Get removed as chief', tier: 'bronze', secret: true },
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
