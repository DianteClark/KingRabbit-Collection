import { createSave } from '../../shared/core/save.js';

// auto: the autosave (written as you play). slot: the save you make from the menu.
// Both are JSON strings of the logic/game.js state.
export const save = createSave('pixel-quest', {
  auto: null, slot: null, music: true, speed: 1, autoBattle: false, tips: {}, cleared: 0, bestTime: null,
});

export function writeSave(state, which = 'auto') {
  state.savedAt = Date.now();
  save.set(which, JSON.stringify(state));
}

export function readSave(which) {
  try { const s = save.get(which); return s ? JSON.parse(s) : null; } catch { return null; }
}

/** The newest of the two saves. */
export function latestSave() {
  const a = readSave('auto'); const b = readSave('slot');
  if (!a) return b; if (!b) return a;
  return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
}

export function clearSaves() { save.set('auto', null); save.set('slot', null); }
