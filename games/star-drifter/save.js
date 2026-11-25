import { createSave } from '../../shared/core/save.js';
import { VERSION, summary, toJSON, fromJSON } from './logic/run.js';
import { START } from './logic/adaptive.js';

// run:      the run in progress as JSON (null when there is none), saved after every action
// records:  lifetime stats; skill: the adaptive enemy level per mode; unlocked: extra ships
export const save = createSave('star-drifter', {
  run: null,
  records: null,
  skill: { normal: START, cruise: START },
  unlocked: { corvid: false },
  tips: {},
  autoCrew: true,
});

export function loadRun() {
  const raw = save.get('run');
  if (!raw) return null;
  try {
    const run = fromJSON(raw);
    if (!run || run.v !== VERSION) return null;
    if (run.screen === 'dead' || run.screen === 'victory') return null;
    return run;
  } catch { return null; }
}

export function saveRun(run) {
  if (!run) return;
  try { save.set('run', toJSON(run)); } catch { /* storage full: keep playing */ }
}

export function clearRun() { save.set('run', null); }

export const getSkill = (mode) => (save.get('skill') || {})[mode] ?? START;
export function setSkill(mode, v) { save.set('skill', { ...(save.get('skill') || {}), [mode]: v }); }

export const tipSeen = (id) => !!(save.get('tips') || {})[id];
export function markTip(id) { save.set('tips', { ...(save.get('tips') || {}), [id]: true }); }

export const isUnlocked = (ship) => ship === 'wayfarer' || !!(save.get('unlocked') || {})[ship];

export function getRecords() {
  const d = save.get('records') || {};
  return {
    runs: d.runs || 0,
    wins: { normal: 0, cruise: 0, ...(d.wins || {}) },
    bestSector: { normal: 0, cruise: 0, ...(d.bestSector || {}) },
    bestScore: { normal: 0, cruise: 0, ...(d.bestScore || {}) },
    ships: d.ships || 0,
    last: d.last || null,
  };
}

/** Store a finished run. Returns { summary, newBest, unlocked }. */
export function recordRun(run) {
  const s = summary(run);
  const r = getRecords();
  r.runs += 1;
  if (s.won) r.wins[s.mode] = (r.wins[s.mode] || 0) + 1;
  const newBest = s.score > r.bestScore[s.mode];
  r.bestSector[s.mode] = Math.max(r.bestSector[s.mode], s.sector);
  r.bestScore[s.mode] = Math.max(r.bestScore[s.mode], s.score);
  r.ships += s.wins;
  r.last = s;
  save.set('records', r);
  if (!run.daily) setSkill(run.mode, run.skill);
  let unlocked = null;
  if (s.won && !isUnlocked('corvid')) { save.set('unlocked', { ...(save.get('unlocked') || {}), corvid: true }); unlocked = 'corvid'; }
  clearRun();
  return { summary: s, newBest, unlocked };
}
