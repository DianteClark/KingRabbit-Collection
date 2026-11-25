// Sand Siege's trophies and daily challenge, on top of the collection-wide shared/core/trophies.js.
import {
  registerTrophies, award, hasTrophy, recordPlay, bumpStat, registerDaily,
} from '../../shared/core/trophies.js';
import { GAME_ID, TROPHIES, liveTrophies, endTrophies } from './logic/awards.js';
import { save } from './save.js';

export function setupTrophies() {
  registerTrophies(GAME_ID, TROPHIES);
  registerDaily(GAME_ID, { title: 'Daily Siege', desc: 'A new map and two twists every day. Hold 15 waves.' });
  recordPlay(GAME_ID);
  give(save.get('pendingTrophies') || []); // earned just before the page was closed
}

// The shared toast sits in one spot, so several trophies at once would cover each other:
// hand them out one at a time, a toast's length apart.
const queue = [];
let busy = false;
function pump() {
  if (busy || !queue.length) return;
  const id = queue.shift();
  save.set('pendingTrophies', [...queue]);
  if (!award(GAME_ID, id)) { pump(); return; }
  busy = true;
  setTimeout(() => { busy = false; pump(); }, 3100);
}
function give(ids) {
  const fresh = ids.filter((id) => !queue.includes(id) && !hasTrophy(GAME_ID, id));
  if (!fresh.length) return;
  queue.push(...fresh);
  save.set('pendingTrophies', [...queue]);
  pump();
}

export const checkLive = (s) => give(liveTrophies(s));
export const checkEnd = (s, stars) => give(endTrophies(s, stars));
export const stat = (k, n) => bumpStat(GAME_ID, k, n);
export { GAME_ID };
