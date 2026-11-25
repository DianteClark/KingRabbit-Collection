// Adaptive rivals (same pattern as game-night/adaptive.js). One skill number from 0 to 1 drifts
// toward the level where you finish around the middle of the podium: wins raise it, finishing
// at the back lowers it. Only how the computer drives changes (pace on straights, cornering
// speed, how often it boosts, how tidy its line is); the cars and the physics are the same.
import { save } from './save.js';

export const SKILL_ID = 'racers';
const START = 0.25;

export function getSkill(id = SKILL_ID) {
  const s = (save.get('skill') || {})[id];
  return typeof s === 'number' ? s : START;
}

function setSkill(id, v, games) {
  save.set('skill', { ...(save.get('skill') || {}), [id]: Math.max(0, Math.min(1, v)) });
  save.set('skillGames', { ...(save.get('skillGames') || {}), [id]: games });
}

export function resetSkill(id = SKILL_ID) { setSkill(id, START, 0); }

/** 1-10 for display. */
export const skillLabel = (id = SKILL_ID) => Math.round(getSkill(id) * 9) + 1;

/**
 * After a race against the computer. place 1..6. The target is about 2nd: a win nudges the
 * rivals up, 3rd is neutral-ish, the back of the pack eases them off. margin 0..1 (how far
 * ahead or behind you were) scales the step a little.
 */
export function reportRace(place, margin = 0.5, id = SKILL_ID) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 3 ? 0.08 : 0.045;
  const result = { 1: 1, 2: 0.65, 3: 0.45, 4: 0.3, 5: 0.15, 6: 0 }[place] ?? 0;
  const delta = k * (result - 0.5) * 2 * (0.7 + 0.6 * margin);
  setSkill(id, getSkill(id) + delta, games);
  return getSkill(id);
}
