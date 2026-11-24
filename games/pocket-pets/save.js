import { createSave } from '../../shared/core/save.js';

// game: the journey in progress (JSON string). skill/skillGames: the adaptive tamer level.
export const save = createSave('pocket-pets', { game: null, skill: {}, skillGames: {}, fast: false });

export const saveGame = (state) => save.set('game', JSON.stringify(state));
export function loadGame() {
  try { const s = save.get('game'); return s ? JSON.parse(s) : null; } catch { return null; }
}
export const clearGame = () => save.set('game', null);
