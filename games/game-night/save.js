import { createSave } from '../../shared/core/save.js';
import { reportResult, skillLabel } from './adaptive.js';
import { earn, stat } from './trophies.js';
import { TABLES } from './tables.js';

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
  const level = skillLabel(id); // the level this game was played at, before it adapts
  reportResult(id, outcome === 'w' ? 1 : outcome === 'd' ? 0.5 : 0, margin);
  const records = { ...save.get('records') };
  const r = getRecord(id);
  r[outcome] += 1;
  records[id] = r;
  save.set('records', records);
  recordTrophies(id, outcome, level, records);
}

// Tables you can beat the computer at (Solitaire's "wins" are solo, so it has its own trophy).
const CPU_TABLES = TABLES.filter((t) => t.modes.includes('cpu')).map((t) => t.id);

function recordTrophies(id, outcome, level, records) {
  if (id === 'ttt' && outcome === 'd') earn('ttt-draw');
  if (outcome !== 'w') return;
  earn(`${id}-win`);
  if (id === 'solitaire') return;
  stat('wins vs CPU');
  const tables = CPU_TABLES.filter((t) => records[t]?.w > 0).length;
  if (tables >= 5) earn('five-tables');
  if (tables >= CPU_TABLES.length) earn('all-tables');
  const wins = CPU_TABLES.reduce((n, t) => n + (records[t]?.w || 0), 0);
  if (wins >= 50) earn('wins-50');
  if (wins >= 200) earn('wins-200');
  if (TABLES.find((t) => t.id === id)?.levels && level >= 8) earn('sharp');
}

/** A table was opened from the menu (for the "try every table" trophies). */
export function visitTable(id) {
  const seen = { ...(save.get('visited') || {}), [id]: true };
  save.set('visited', seen);
  const n = TABLES.filter((t) => t.scene && seen[t.id]).length;
  if (n >= 10) earn('explorer');
  if (n >= TABLES.filter((t) => t.scene).length) earn('tourist');
}

/** A 2-player game on one phone reached its end. */
export const finishedPvp = () => { earn('pvp'); stat('2-player games'); };

// High-score trophies: [trophy, score needed] per table, checked on every finished game.
const SCORE_TROPHIES = {
  blockbreaker: [['bb-5000', 5000]],
  spacerocks: [['rocks-2000', 2000], ['rocks-10000', 10000]],
  bowling: [['bowl-200', 200], ['bowl-300', 300]],
  tanks: [['tanks-10000', 10000]],
  sixball: [['six-1000', 1000], ['six-5000', 5000]],
  yacht: [['yacht-250', 250]],
  boxbox: [['box-8', 8]],
};

export function getBest(id) {
  return save.get('best')[id] ?? 0;
}

/** Saves the score if it beats the old one. Returns true for a new best. lower=true for "fewest moves" style. */
export function submitBest(id, value, lower = false) {
  for (const [trophy, need] of SCORE_TROPHIES[id] || []) if (value >= need) earn(trophy);
  const old = save.get('best')[id];
  const better = old === undefined || old === 0 ? true : (lower ? value < old : value > old);
  if (!better) return false;
  save.set('best', { ...save.get('best'), [id]: value });
  return true;
}

