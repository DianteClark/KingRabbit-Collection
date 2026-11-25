// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'heroes-lite';

export const TROPHIES = [
  { id: 'first-battle', name: 'Steel Drawn', desc: 'Win your first battle', tier: 'bronze' },
  { id: 'flawless', name: 'Not a Scratch', desc: 'Win a battle without losing a creature', tier: 'bronze' },
  { id: 'town', name: 'Banner Raised', desc: 'Capture a town', tier: 'bronze' },
  { id: 'defender', name: 'Hold the Gate', desc: 'Beat back an enemy attack', tier: 'bronze' },
  { id: 'city-hall', name: 'City Hall', desc: 'Build a City Hall in one of your towns', tier: 'silver' },
  { id: 'veteran', name: 'Veteran Hero', desc: 'Raise a hero to level 10', tier: 'silver' },
  { id: 'valley', name: 'Valley Keeper', desc: 'Conquer Green Valley', tier: 'bronze' },
  { id: 'desert', name: 'Sand Walker', desc: 'Conquer Desert Crossing', tier: 'silver' },
  { id: 'frontier', name: 'Frost Conqueror', desc: 'Conquer Frozen Frontier', tier: 'gold' },
  { id: 'both-factions', name: 'Two Banners', desc: 'Conquer a map with each faction', tier: 'gold' },
  { id: 'swift', name: 'Swift Conquest', desc: 'Conquer a map within four weeks', tier: 'silver' },
  { id: 'endless-30', name: 'Holdout', desc: 'Survive 30 days in Last Stand', tier: 'silver' },
  { id: 'endless-60', name: 'Unbroken', desc: 'Survive 60 days in Last Stand', tier: 'gold' },
  { id: 'underdog', name: 'Against the Odds', desc: 'Win a battle against twice your strength', tier: 'silver', secret: true },
  { id: 'bones', name: 'Bone Collector', desc: 'Raise 50 skeletons after one battle', tier: 'bronze', secret: true },
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
