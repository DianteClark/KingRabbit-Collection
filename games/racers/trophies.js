// This game's trophies and daily challenge (shared/core/trophies.js stores and shows them).
import { registerTrophies, award as awardShared, recordPlay, bumpStat, registerDaily } from '../../shared/core/trophies.js';

export const GAME_ID = 'racers';

export const TROPHIES = [
  { id: 'first-finish', name: 'Green Light', desc: 'Finish your first race', tier: 'bronze' },
  { id: 'podium', name: 'On the Podium', desc: 'Finish a race in the top three', tier: 'bronze' },
  { id: 'first-win', name: 'Chequered Flag', desc: 'Win a race', tier: 'bronze' },
  { id: 'drift-3', name: 'Sideways', desc: 'Hold one drift for 3 seconds', tier: 'bronze' },
  { id: 'boost-50', name: 'Nitro Fan', desc: 'Use your boost 50 times', tier: 'silver' },
  { id: 'clean-lap', name: 'Clean Lap', desc: 'Drive a whole lap without touching a wall', tier: 'silver' },
  { id: 'cup-sunny', name: 'Sunny Champion', desc: 'Win the Sunny Cup', tier: 'silver' },
  { id: 'cup-moon', name: 'Moonlight Champion', desc: 'Win the Moonlight Cup', tier: 'silver' },
  { id: 'cup-champ', name: 'Champion of Tiny Town', desc: 'Win the Champion Cup', tier: 'gold' },
  { id: 'sweep', name: 'Clean Sweep', desc: 'Win all four races of a cup', tier: 'gold' },
  { id: 'ghost', name: 'Ghost Buster', desc: 'Beat your own best lap in Time Trial', tier: 'bronze' },
  { id: 'daily', name: 'Daily Driver', desc: 'Finish a daily challenge', tier: 'bronze' },
  { id: 'garage', name: 'Full Garage', desc: 'Unlock every car', tier: 'gold' },
  { id: 'comeback', name: 'From the Back', desc: 'Win after running last on lap 2', tier: 'silver', secret: true },
  { id: 'wrong-way', name: 'Wrong Way!', desc: 'Drive the wrong way for 5 seconds', tier: 'bronze', secret: true },
];

let started = false;
/** Once per launch. */
export function startTrophies() {
  if (started) return;
  started = true;
  registerTrophies(GAME_ID, TROPHIES);
  registerDaily(GAME_ID, { title: 'Daily Time Trial', desc: 'Same track and car for everyone today: set the fastest 3 laps' });
  recordPlay(GAME_ID);
}

export const award = (id) => awardShared(GAME_ID, id);
export const stat = (key, n = 1) => bumpStat(GAME_ID, key, n);
