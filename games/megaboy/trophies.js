// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'megaboy';

export const TROPHIES = [
  { id: 'first-boss', name: 'Weapon Get', desc: 'Beat your first robot boss', tier: 'bronze' },
  { id: 'bosses-3', name: 'Halfway Hero', desc: 'Beat three robot bosses', tier: 'bronze' },
  { id: 'bosses-6', name: 'Full Arsenal', desc: 'Beat all six robot bosses', tier: 'silver' },
  { id: 'gate', name: 'Gate Crasher', desc: 'Break through the fortress gate', tier: 'silver' },
  { id: 'null', name: 'Null and Void', desc: 'Defeat Doctor Null', tier: 'gold' },
  { id: 'weak', name: 'Weak Spot', desc: "Hit a boss with its weakness", tier: 'bronze' },
  { id: 'etank', name: 'Spare Battery', desc: 'Find an Energy Tank', tier: 'bronze' },
  { id: 'no-death', name: 'One Take', desc: 'Clear a stage without losing a life', tier: 'silver' },
  { id: 'full-hp', name: 'Untouchable', desc: 'Beat a boss with full health', tier: 'gold' },
  { id: 'speed', name: 'Speed Runner', desc: 'Finish the game in under 30 minutes', tier: 'gold' },
  { id: 'twice', name: 'Encore', desc: 'Finish the game twice', tier: 'silver' },
  { id: 'buster-only', name: 'Buster Purist', desc: 'Clear a robot stage with only the buster', tier: 'silver', secret: true },
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
