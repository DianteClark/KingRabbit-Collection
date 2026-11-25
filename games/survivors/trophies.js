// This game's trophies and daily challenge (shared/core/trophies.js stores and shows them).
import { registerTrophies, award as awardShared, recordPlay, bumpStat, registerDaily } from '../../shared/core/trophies.js';

export const GAME_ID = 'survivors';

export const TROPHIES = [
  { id: 'first-run', name: 'First Night', desc: 'Finish your first run', tier: 'bronze' },
  { id: 'survive-5', name: 'Still Standing', desc: 'Survive 5 minutes', tier: 'bronze' },
  { id: 'boss-1', name: 'Warlord Down', desc: 'Defeat a boss', tier: 'bronze' },
  { id: 'lv10', name: 'Growing Up', desc: 'Reach level 10 in a run', tier: 'bronze' },
  { id: 'kills-500', name: 'Pest Control', desc: 'Defeat 500 monsters in one run', tier: 'bronze' },
  { id: 'evolve', name: 'Evolution', desc: 'Evolve a weapon', tier: 'bronze' },
  { id: 'shopper', name: 'Investor', desc: 'Buy a permanent upgrade', tier: 'bronze' },
  { id: 'daily', name: 'Daily Grind', desc: 'Finish a daily challenge', tier: 'bronze' },
  { id: 'survive-10', name: 'Night Owl', desc: 'Survive 10 minutes', tier: 'silver' },
  { id: 'lv30', name: 'Seasoned', desc: 'Reach level 30 in a run', tier: 'silver' },
  { id: 'kills-2000', name: 'Horde Breaker', desc: 'Defeat 2000 monsters in one run', tier: 'silver' },
  { id: 'arsenal', name: 'Arsenal', desc: 'Hold all six weapons at once', tier: 'silver' },
  { id: 'hero', name: 'New Blood', desc: 'Unlock a new hero', tier: 'silver' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Go 3 minutes without being hit', tier: 'silver', secret: true },
  { id: 'win', name: 'Dawn Breaks', desc: 'Survive all 15 minutes', tier: 'gold' },
  { id: 'slayer', name: 'Kingslayer', desc: 'Defeat the Horned King', tier: 'gold' },
  { id: 'all-heroes', name: 'Full Party', desc: 'Unlock every hero', tier: 'gold' },
];

let started = false;
/** Once per launch. */
export function startTrophies() {
  if (started) return;
  started = true;
  registerTrophies(GAME_ID, TROPHIES);
  registerDaily(GAME_ID, { title: 'Daily Survival', desc: 'Same hero and same horde for everyone today: last as long as you can' });
  recordPlay(GAME_ID);
}

export const award = (id) => awardShared(GAME_ID, id);
export const stat = (key, n = 1) => bumpStat(GAME_ID, key, n);
