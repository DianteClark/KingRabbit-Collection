// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'pangea';

export const TROPHIES = [
  { id: 'first-city', name: 'Foundations', desc: 'Found a city', tier: 'bronze' },
  { id: 'cities-6', name: 'Growing Empire', desc: 'Rule six cities at once', tier: 'silver' },
  { id: 'pop-10', name: 'Metropolis', desc: 'Grow a city to size 10', tier: 'silver' },
  { id: 'tech', name: 'Bright Idea', desc: 'Discover a technology', tier: 'bronze' },
  { id: 'techs-all', name: 'Age of Wonders', desc: 'Discover every technology', tier: 'gold' },
  { id: 'wonder', name: 'Wonder Builder', desc: 'Complete a wonder', tier: 'silver' },
  { id: 'captured', name: 'Conqueror', desc: 'Capture an enemy city', tier: 'bronze' },
  { id: 'held', name: 'Stand Firm', desc: 'Beat off an attack', tier: 'bronze' },
  { id: 'pact', name: 'Trade Partners', desc: 'Sign a trade pact', tier: 'bronze' },
  { id: 'tutorial', name: 'Quick Study', desc: 'Finish the guided first game', tier: 'bronze' },
  { id: 'win-score', name: 'Best of Ages', desc: 'Win on score', tier: 'silver' },
  { id: 'win-conquest', name: 'World Ruler', desc: 'Win by conquest', tier: 'gold' },
  { id: 'win-science', name: 'To the Stars', desc: 'Win by launching the Space Ark', tier: 'gold' },
  { id: 'comeback', name: 'Phoenix', desc: 'Win a game after losing a city', tier: 'silver', secret: true },
  { id: 'rich', name: 'Gold Mountain', desc: 'Hold 1000 gold in the treasury', tier: 'bronze', secret: true },
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
