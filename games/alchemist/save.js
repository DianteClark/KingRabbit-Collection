import { createSave } from '../../shared/core/save.js';
import { migrate } from './logic/game.js';

// run: the shop in progress. skill/skillGames: the adaptive customer level. best: records.
export const save = createSave('alchemist', { run: null, skill: {}, skillGames: {}, music: true, best: {} });

export const saveRun = (state) => save.set('run', state);
export function loadRun() {
  try { return migrate(save.get('run')); } catch { return null; }
}
export const clearRun = () => save.set('run', null);

/** Keep a few records for the title screen. */
export function noteBest(state) {
  const b = { ...(save.get('best') || {}) };
  if (state.result?.kind === 'win') b.wins = (b.wins || 0) + 1;
  b.days = Math.max(b.days || 0, state.day);
  b.coins = Math.max(b.coins || 0, state.coins);
  save.set('best', b);
}
