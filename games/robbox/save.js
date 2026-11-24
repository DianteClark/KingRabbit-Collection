import { createSave } from '../../shared/core/save.js';
import { LEVELS } from './logic/levels.js';
import { starsFor } from './logic/engine.js';

// best:      { levelId: fewest commands in a winning program }
// programs:  { levelId: { main, f1, f2 } as code strings } so you can leave and come back
// seenIntro: { levelId: true } once the level's "new idea" card was shown
// speed:     1, 2 or 4
export const save = createSave('robbox', {
  best: {}, programs: {}, seenIntro: {}, speed: 1, last: 0,
});

export const bestFor = (id) => save.get('best')[id] ?? null;

export function starsOf(level) {
  const b = bestFor(level.id);
  return b == null ? 0 : starsFor(b, level.target);
}

export const isSolved = (level) => bestFor(level.id) != null;

/** Levels open one after another; World 1 level 1 is always open. */
export function isUnlocked(i) {
  return i <= 0 || isSolved(LEVELS[i - 1]) || isSolved(LEVELS[i]);
}

/** Record a win. Returns { prev, best, stars, newRecord }. */
export function recordWin(level, length) {
  const prev = bestFor(level.id);
  const best = prev == null ? length : Math.min(prev, length);
  save.set('best', { ...save.get('best'), [level.id]: best });
  return { prev, best, stars: starsFor(best, level.target), runStars: starsFor(length, level.target), newRecord: prev == null || length < prev };
}

export const totalStars = () => LEVELS.reduce((n, l) => n + starsOf(l), 0);

/** The level to offer from the menu: the first one not solved yet (or the last played). */
export function nextLevelIndex() {
  const i = LEVELS.findIndex((l) => !isSolved(l));
  return i < 0 ? Math.min(save.get('last') || 0, LEVELS.length - 1) : i;
}

export function saveProgram(id, code) { save.set('programs', { ...save.get('programs'), [id]: code }); }
export const loadProgram = (id) => save.get('programs')[id] || null;
