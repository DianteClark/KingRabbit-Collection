import { createSave } from '../../shared/core/save.js';
import { VERSION, summary } from './logic/run.js';

// run:     the run in progress (null when there is none) - saved after every step
// records: lifetime stats per mode
export const save = createSave('spire-roguelite', {
  run: null,
  records: {
    runs: 0,
    wins: { knight: 0, mage: 0, ranger: 0 },
    bestFloor: { normal: 0, endless: 0 },
    bestScore: { normal: 0, endless: 0 },
    bestLoop: 0,
    last: null,
  },
});

export function loadRun() {
  const run = save.get('run');
  if (!run || run.v !== VERSION) return null;
  if (run.screen === 'dead' || run.screen === 'victory') return null;
  return run;
}

export function saveRun(run) {
  // Never store a half-played animation log.
  if (run?.combat) run.combat.log = [];
  save.set('run', run);
}

export function clearRun() { save.set('run', null); }

export function getRecords() {
  const d = save.get('records') || {};
  return {
    runs: d.runs || 0,
    wins: { knight: 0, mage: 0, ranger: 0, ...(d.wins || {}) },
    bestFloor: { normal: 0, endless: 0, ...(d.bestFloor || {}) },
    bestScore: { normal: 0, endless: 0, ...(d.bestScore || {}) },
    bestLoop: d.bestLoop || 0,
    last: d.last || null,
  };
}

/** Store the result of a finished run. Returns { newBestScore, newBestFloor }. */
export function recordRun(run) {
  const s = summary(run);
  const r = getRecords();
  r.runs += 1;
  if (s.won) r.wins[s.hero] = (r.wins[s.hero] || 0) + 1;
  const newBestFloor = s.floor > r.bestFloor[s.mode];
  const newBestScore = s.score > r.bestScore[s.mode];
  r.bestFloor[s.mode] = Math.max(r.bestFloor[s.mode], s.floor);
  r.bestScore[s.mode] = Math.max(r.bestScore[s.mode], s.score);
  if (s.mode === 'endless') r.bestLoop = Math.max(r.bestLoop, s.loop + 1);
  r.last = s;
  save.set('records', r);
  clearRun();
  return { newBestScore, newBestFloor, summary: s };
}
