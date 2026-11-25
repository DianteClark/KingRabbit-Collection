// Progress, records and the in-progress round (so leaving and coming back resumes exactly).
import { createSave } from '../../shared/core/save.js';
import { registerTrophies, award as awardShared, hasTrophy, recordPlay, bumpStat, registerDaily } from '../../shared/core/trophies.js';
import { HOLES, COURSES, holesOf, starsFor, coursePar } from './logic/holes.js';

export const GAME_ID = 'mini-golf';

// best:    { holeId: fewest strokes }
// rounds:  { courseIndex: best 9-hole total }
// round:   the round being played (see Play.js), or null
// tips:    { kind: true } once a first-time tip was shown
// coached: true once the first putt lesson is done
export const save = createSave(GAME_ID, { best: {}, rounds: {}, round: null, tips: {}, coached: false });

export const TROPHIES = [
  { id: 'first-hole', name: 'First Putt', desc: 'Sink your first ball', tier: 'bronze' },
  { id: 'par', name: 'Steady Hand', desc: 'Make par on a hole', tier: 'bronze' },
  { id: 'birdie', name: 'Birdie', desc: 'Finish a hole one under par', tier: 'bronze' },
  { id: 'eagle', name: 'Eagle Eye', desc: 'Finish a hole two under par', tier: 'silver' },
  { id: 'ace', name: 'Hole in One', desc: 'Sink the ball with your first putt', tier: 'silver' },
  { id: 'meadow', name: 'Meadow Champion', desc: 'Finish a round of Meadow Greens', tier: 'bronze' },
  { id: 'frost', name: 'Peak Bagger', desc: 'Finish a round of Frost Peak', tier: 'silver' },
  { id: 'castle', name: 'King of the Keep', desc: 'Finish a round of Castle Keep', tier: 'gold' },
  { id: 'under-par', name: 'Under Par', desc: 'Finish a 9-hole round under par', tier: 'gold' },
  { id: 'all-stars', name: 'Star Collector', desc: 'Earn 3 stars on all 27 holes', tier: 'gold' },
  { id: 'party', name: 'Party Golf', desc: 'Finish a pass-and-play round', tier: 'bronze' },
  { id: 'daily', name: 'Daily Golfer', desc: 'Finish a daily hole', tier: 'bronze' },
  { id: 'splash', name: 'Splash!', desc: 'Find the water (or the lava)', tier: 'bronze', secret: true },
  { id: 'pinball', name: 'Pinball Wizard', desc: 'Hit 4 bumpers with one putt', tier: 'silver', secret: true },
  { id: 'wormhole', name: 'Wormhole', desc: 'Sink a putt that went through a portal', tier: 'silver', secret: true },
];

let booted = false;
/** Once per launch: register trophies and the daily, count the play. */
export function bootProgress() {
  if (booted) return;
  booted = true;
  try {
    registerTrophies(GAME_ID, TROPHIES);
    registerDaily(GAME_ID, { title: 'Daily Hole', desc: 'One hole a day for everyone. Fewest strokes wins.' });
    recordPlay(GAME_ID);
  } catch { /* storage blocked: play on */ }
}

// Trophies earned together (say Birdie and Hole in One) would show their toasts on top of each other,
// so each one waits for the one before to finish. Leaving the page awards anything still waiting.
const queue = [];
let lastToast = 0;
function flush() { while (queue.length) { try { awardShared(GAME_ID, queue.shift()); } catch { /* ignore */ } } }
if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
export function award(id) {
  try {
    if (hasTrophy(GAME_ID, id) || queue.includes(id)) return false;
    const wait = Math.max(0, lastToast + 3000 - Date.now());
    lastToast = Date.now() + wait;
    if (!wait) return awardShared(GAME_ID, id);
    queue.push(id);
    setTimeout(() => { const i = queue.indexOf(id); if (i >= 0) { queue.splice(i, 1); awardShared(GAME_ID, id); } }, wait);
    return true;
  } catch { return false; }
}
export const stat = (k, n = 1) => { try { bumpStat(GAME_ID, k, n); } catch { /* ignore */ } };

export const bestFor = (id) => save.get('best')[id] ?? null;
export const starsOf = (h) => starsFor(bestFor(h.id), h.par);
export const totalStars = () => HOLES.reduce((n, h) => n + starsOf(h), 0);
export const courseStars = (ci) => holesOf(ci).reduce((n, h) => n + starsOf(h), 0);
export const courseDone = (ci) => holesOf(ci).every((h) => bestFor(h.id) != null);

/** Courses open in order: the next one opens when every hole of the one before has been holed. */
export const courseUnlocked = (ci) => ci <= 0 || courseDone(ci - 1);

/** Holes of an open course open one after another for practice. */
export function holeUnlocked(h) {
  if (!courseUnlocked(h.course)) return false;
  if (h.index === 0) return true;
  const prev = holesOf(h.course)[h.index - 1];
  return bestFor(prev.id) != null || bestFor(h.id) != null;
}

/** Record a finished hole (solo play only). Returns { prev, best, newRecord }. */
export function recordHole(h, strokes) {
  const prev = bestFor(h.id);
  const best = prev == null ? strokes : Math.min(prev, strokes);
  save.set('best', { ...save.get('best'), [h.id]: best });
  return { prev, best, newRecord: prev == null || strokes < prev };
}

export function recordRound(ci, total) {
  const rounds = save.get('rounds');
  const prev = rounds[ci] ?? null;
  if (prev == null || total < prev) save.set('rounds', { ...rounds, [ci]: total });
  return { prev, best: prev == null ? total : Math.min(prev, total), newRecord: prev == null || total < prev };
}

export const roundBest = (ci) => save.get('rounds')[ci] ?? null;

/** Trophies for a finished solo hole. */
export function holeTrophies(h, strokes) {
  award('first-hole');
  const d = strokes - h.par;
  if (d <= 0) award('par');
  if (d <= -1) award('birdie');
  if (d <= -2) award('eagle');
  if (strokes === 1) award('ace');
  if (HOLES.every((x) => starsOf(x) === 3)) award('all-stars');
}

export function roundTrophies(ci, total) {
  award(['meadow', 'frost', 'castle'][ci]);
  if (total < coursePar(ci)) award('under-par');
}

export { COURSES };
