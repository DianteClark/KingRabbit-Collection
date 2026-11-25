// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'robbox';

export const TROPHIES = [
  { id: 'first-solve', name: 'Hello, World', desc: 'Solve your first level', tier: 'bronze' },
  { id: 'world-1', name: 'Booted Up', desc: 'Solve every World 1 level', tier: 'bronze' },
  { id: 'world-2', name: 'Function Junction', desc: 'Solve every World 2 level', tier: 'silver' },
  { id: 'world-3', name: 'Hop Scotch', desc: 'Solve every World 3 level', tier: 'silver' },
  { id: 'world-4', name: 'Cargo Master', desc: 'Solve every World 4 level', tier: 'silver' },
  { id: 'world-5', name: 'Core Complete', desc: 'Solve every level in the lab', tier: 'gold' },
  { id: 'three-stars', name: 'Tight Code', desc: 'Earn 3 stars on a level', tier: 'bronze' },
  { id: 'stars-60', name: 'Star Collector', desc: 'Earn 60 stars', tier: 'silver' },
  { id: 'all-stars', name: 'Perfectionist', desc: 'Earn every star', tier: 'gold' },
  { id: 'daily', name: 'Daily Debug', desc: 'Solve the Daily Level', tier: 'bronze' },
  { id: 'daily-3', name: 'Clean Commit', desc: 'Earn 3 stars on the Daily Level', tier: 'silver' },
  { id: 'code-golf', name: 'Code Golf', desc: 'Solve a level under its target length', tier: 'gold', secret: true },
  { id: 'forever', name: 'Infinite Loop', desc: 'Run a program that never stops', tier: 'bronze', secret: true },
  { id: 'fell', name: 'Gravity Check', desc: 'Drive the robot off the edge', tier: 'bronze', secret: true },
];

export const DAILY = { title: 'Daily Level', desc: 'One lab level for everyone; fewest commands wins' };

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
