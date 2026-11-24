import { createSave } from '../../shared/core/save.js';
import { reportResult } from './adaptive.js';

// records: { tableId: { w, d, l } }  (only games vs the computer count)
// best:    { tableId: number }        (high score, or lowest for 'low' tables)
export const save = createSave('game-night', { records: {}, best: {}, tab: 'board', skill: {}, skillGames: {} });

// Move v0.1 saves (ttt / reversi / yachtBest keys) into the new shape once.
(() => {
  const all = save.all();
  const records = { ...all.records };
  let changed = false;
  for (const id of ['ttt', 'reversi']) {
    if (all[id] && !records[id]) { records[id] = all[id]; changed = true; }
  }
  const best = { ...all.best };
  if (all.yachtBest && !best.yacht) { best.yacht = all.yachtBest; changed = true; }
  if (changed) { save.set('records', records); save.set('best', best); }
})();

export function getRecord(id) {
  return { w: 0, d: 0, l: 0, ...(save.get('records')[id] || {}) };
}

/** outcome: 'w' | 'd' | 'l'. Also moves the adaptive CPU level (margin 0..1 = how decisive). */
export function record(id, outcome, margin = 0.5) {
  reportResult(id, outcome === 'w' ? 1 : outcome === 'd' ? 0.5 : 0, margin);
  const records = { ...save.get('records') };
  const r = getRecord(id);
  r[outcome] += 1;
  records[id] = r;
  save.set('records', records);
}

export function getBest(id) {
  return save.get('best')[id] ?? 0;
}

/** Saves the score if it beats the old one. Returns true for a new best. lower=true for "fewest moves" style. */
export function submitBest(id, value, lower = false) {
  const old = save.get('best')[id];
  const better = old === undefined || old === 0 ? true : (lower ? value < old : value > old);
  if (!better) return false;
  save.set('best', { ...save.get('best'), [id]: value });
  return true;
}

