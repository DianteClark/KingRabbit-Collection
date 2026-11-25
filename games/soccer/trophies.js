// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'soccer';

export const TROPHIES = [
  { id: 'first-goal', name: 'Off the Mark', desc: 'Score your first goal', tier: 'bronze' },
  { id: 'first-win', name: 'Three Points', desc: 'Win a match', tier: 'bronze' },
  { id: 'clean-sheet', name: 'Clean Sheet', desc: 'Win without conceding a goal', tier: 'bronze' },
  { id: 'five-goals', name: 'Goal Rush', desc: 'Score 5 goals in one match', tier: 'silver' },
  { id: 'rout', name: 'Rout', desc: 'Win a match by 5 goals or more', tier: 'silver' },
  { id: 'giant-killer', name: 'Giant Killer', desc: 'Beat the Coral Kings', tier: 'silver' },
  { id: 'all-teams', name: 'Grand Tour', desc: 'Beat all eight teams', tier: 'gold' },
  { id: 'pens', name: 'Ice Cold', desc: 'Win a penalty shoot-out', tier: 'bronze' },
  { id: 'cup', name: 'Cup Winners', desc: 'Win the Cup', tier: 'gold' },
  { id: 'cup-3', name: 'Dynasty', desc: 'Win the Cup three times', tier: 'gold' },
  { id: 'endless-5', name: 'On a Roll', desc: 'Win 5 in a row in Endless', tier: 'silver' },
  { id: 'endless-10', name: 'Unstoppable', desc: 'Win 10 in a row in Endless', tier: 'gold' },
  { id: 'daily', name: 'Matchday', desc: 'Play the Daily Match', tier: 'bronze' },
  { id: 'daily-win', name: 'Match of the Day', desc: 'Win the Daily Match', tier: 'silver' },
  { id: 'goal-fest', name: 'Goal Fest', desc: 'Play a match with 10 or more goals', tier: 'silver', secret: true },
];

export const DAILY = { title: 'Daily Match', desc: "Today's opponent at a fixed level; best goal difference" };

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
