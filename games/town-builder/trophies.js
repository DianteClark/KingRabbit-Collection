// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'town-builder';

export const TROPHIES = [
  { id: 'village', name: 'On the Map', desc: 'Grow your hamlet into a Village', tier: 'bronze' },
  { id: 'town', name: 'Proper Town', desc: 'Reach Town size (1,200 people)', tier: 'bronze' },
  { id: 'city', name: 'Big City', desc: 'Reach City size (3,500 people)', tier: 'silver' },
  { id: 'metropolis', name: 'Metropolis', desc: 'Reach Metropolis size (7,500 people)', tier: 'gold' },
  { id: 'landmark', name: 'Landmark', desc: 'Build your first landmark', tier: 'bronze' },
  { id: 'airport', name: 'Jet Set', desc: 'Open an airport', tier: 'silver' },
  { id: 'all-landmarks', name: 'Postcard Town', desc: 'Have every landmark in one city', tier: 'gold' },
  { id: 'cheerful', name: 'Cheerful Town', desc: 'Reach 85% happiness with 1,000+ people', tier: 'silver' },
  { id: 'rich', name: 'Deep Pockets', desc: 'Have $100,000 in the bank', tier: 'silver' },
  { id: 'first', name: 'First Steps', desc: 'Win the First Steps scenario', tier: 'bronze' },
  { id: 'debtfree', name: 'Balanced Books', desc: 'Win the Debt-Free City scenario', tier: 'gold' },
  { id: 'clean', name: 'Fresh Air', desc: 'Win the Clean Air scenario', tier: 'gold' },
  { id: 'firefighter', name: 'Bucket Brigade', desc: 'Put out a fire', tier: 'bronze', secret: true },
  { id: 'ufo', name: 'Close Encounter', desc: 'Shoot down a UFO', tier: 'silver', secret: true },
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
