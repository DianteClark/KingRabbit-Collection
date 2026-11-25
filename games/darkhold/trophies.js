// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today } from '../../shared/core/trophies.js';

export const GAME_ID = 'darkhold';

export const TROPHIES = [
  { id: 'first-blood', name: 'First Blood', desc: 'Slay your first monster', tier: 'bronze' },
  { id: 'floor-5', name: 'Deeper Still', desc: 'Reach floor 5', tier: 'bronze' },
  { id: 'floor-10', name: 'Bottom Rung', desc: 'Reach floor 10', tier: 'silver' },
  { id: 'great-hall', name: 'Throne Room', desc: "Step into the Hollow King's hall", tier: 'silver' },
  { id: 'dawn', name: 'Dawn Breaks', desc: 'Defeat the Hollow King', tier: 'gold' },
  { id: 'normal-win', name: 'No Night Light', desc: 'Win a run in Normal mode', tier: 'gold' },
  { id: 'lantern-win', name: 'Lamplighter', desc: 'Win a run in Lantern mode', tier: 'silver' },
  { id: 'all-heroes', name: 'Full Party', desc: 'Win with the Knight, Rogue and Mage', tier: 'gold' },
  { id: 'level-8', name: 'Seasoned', desc: 'Reach hero level 8', tier: 'silver' },
  { id: 'secrets-3', name: 'Wall Tapper', desc: 'Find 3 secrets in one run', tier: 'bronze' },
  { id: 'rich', name: 'Heavy Purse', desc: 'Carry 300 gold at once', tier: 'bronze' },
  { id: 'score-5k', name: 'Torchbearer', desc: 'Score 5000 in one run', tier: 'silver' },
  { id: 'daily', name: 'Daily Delver', desc: 'Finish a Daily Run', tier: 'bronze' },
  { id: 'daily-win', name: 'Dawn of the Day', desc: 'Win a Daily Run', tier: 'gold' },
  { id: 'mimic', name: 'Not a Chest', desc: 'Slay a mimic', tier: 'bronze', secret: true },
  { id: 'snuffed', name: 'Lights Out', desc: 'Let your torch burn out', tier: 'bronze', secret: true },
];

export const DAILY = { title: 'Daily Run', desc: 'Same dungeon for everyone today' };

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
