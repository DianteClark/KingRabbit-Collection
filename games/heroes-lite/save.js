import { createSave } from '../../shared/core/save.js';

// game:    the adventure in progress (JSON string), so you can close the tab and carry on
// records: { scenarioId: { w, l, bestDays } }   best: { endless: days survived }
export const save = createSave('heroes-lite', {
  game: null, records: {}, best: { endless: 0 }, skill: {}, skillGames: {}, faction: 'castle', fast: false,
});

export function getRecord(id) { return { w: 0, l: 0, bestDays: 0, ...(save.get('records')[id] || {}) }; }

export function recordResult(id, won, days) {
  const r = getRecord(id);
  if (won) { r.w += 1; if (!r.bestDays || days < r.bestDays) r.bestDays = days; } else r.l += 1;
  save.set('records', { ...save.get('records'), [id]: r });
}

/** Endless mode high score (days survived). Returns true for a new best. */
export function submitEndless(days) {
  const best = save.get('best') || {};
  if ((best.endless || 0) >= days) return false;
  save.set('best', { ...best, endless: days });
  return true;
}

export const saveGame = (state) => save.set('game', JSON.stringify(state));
export function loadGame() {
  try { const s = save.get('game'); return s ? JSON.parse(s) : null; } catch { return null; }
}
export const clearGame = () => save.set('game', null);
