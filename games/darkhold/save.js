import { createSave } from '../../shared/core/save.js';
import { VERSION, score } from './logic/game.js';

// run:     the run in progress (null when there is none), saved after every turn
// records: lifetime results per mode ('normal', 'lantern', 'daily')
// hints:   which first-time tips have been shown
export const save = createSave('darkhold', {
  run: null,
  hints: {},
  records: null,
  skill: null,
  music: true,
  lastCls: 'knight',
  lastMode: 'normal',
});

const blankMode = () => ({ runs: 0, wins: 0, bestDepth: 0, bestScore: 0 });

export function getRecords() {
  const r = save.get('records') || {};
  return {
    normal: { ...blankMode(), ...(r.normal || {}) },
    lantern: { ...blankMode(), ...(r.lantern || {}) },
    daily: { ...blankMode(), ...(r.daily || {}) },
    winsBy: { knight: 0, rogue: 0, mage: 0, ...(r.winsBy || {}) },
    today: r.today || null, // { date, bestScore, bestDepth, won, tries }
    last: r.last || null,
  };
}

export function loadRun() {
  const run = save.get('run');
  if (!run || run.v !== VERSION || run.over) return null;
  return run;
}

export function saveRun(run) {
  try { save.set('run', run); } catch { /* storage full or blocked: keep playing */ }
}

export function clearRun() { save.set('run', null); }

const modeKey = (run) => (run.daily ? 'daily' : run.mode);

/** Store a finished (or abandoned) run once. Returns { score, newBest, records }. */
export function recordRun(run) {
  const r = getRecords();
  const k = modeKey(run);
  const s = score(run);
  const m = r[k];
  const newBest = s > m.bestScore;
  m.runs += 1;
  if (run.over === 'won') { m.wins += 1; r.winsBy[run.cls] = (r.winsBy[run.cls] || 0) + 1; }
  m.bestDepth = Math.max(m.bestDepth, run.stats.deepest);
  m.bestScore = Math.max(m.bestScore, s);
  let newDaily = false;
  if (run.daily) {
    const t = r.today && r.today.date === run.daily ? r.today : { date: run.daily, bestScore: 0, bestDepth: 0, won: false, tries: 0 };
    t.tries += 1;
    newDaily = s > t.bestScore;
    t.bestScore = Math.max(t.bestScore, s);
    t.bestDepth = Math.max(t.bestDepth, run.stats.deepest);
    t.won = t.won || run.over === 'won';
    r.today = t;
  }
  r.last = { cls: run.cls, mode: k, depth: run.stats.deepest, won: run.over === 'won', score: s, killedBy: run.killedBy };
  save.set('records', r);
  clearRun();
  return { score: s, newBest, newDaily, records: r };
}
