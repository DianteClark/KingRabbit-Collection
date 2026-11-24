import { createSave } from '../../shared/core/save.js';
import { serialize, deserialize } from './logic/game.js';

// game: the game in progress (serialized), so closing the page never loses anything.
// record: results against the computer. tutorialDone: the guided first game was finished or skipped.
export const save = createSave('pangea', {
  game: null, record: { w: 0, l: 0, best: 0 }, skill: {}, skillGames: {}, tutorialDone: false, fast: false, last: null,
});

export function saveGame(s) {
  try { save.set('game', serialize(s)); return true; } catch { return false; }
}

export function loadGame() {
  try { const g = save.get('game'); return g ? deserialize(g) : null; } catch { return null; }
}

export const clearGame = () => save.set('game', null);

export function recordResult(won, score) {
  const r = { w: 0, l: 0, best: 0, ...(save.get('record') || {}) };
  if (won) r.w++; else r.l++;
  r.best = Math.max(r.best || 0, score || 0);
  save.set('record', r);
}
