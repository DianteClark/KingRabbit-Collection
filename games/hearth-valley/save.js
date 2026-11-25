import { createSave } from '../../shared/core/save.js';

// game: the farm in progress (JSON string). music: background tunes on or off.
export const save = createSave('hearth-valley', { game: null, music: true });

export const saveGame = (state) => {
  const copy = { ...state };
  delete copy.mine; // a mine floor is never saved: you resume at the mine entrance
  if (copy.map === 'mine') { copy.map = 'woods'; copy.x = 10; copy.y = 3; copy.face = 'down'; }
  save.set('game', JSON.stringify(copy));
};
export function loadGame() {
  try { const s = save.get('game'); return s ? JSON.parse(s) : null; } catch { return null; }
}
export const clearGame = () => save.set('game', null);
