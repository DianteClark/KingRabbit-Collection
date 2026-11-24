// Adaptive tamer skill (same idea as Game Night's adaptive.js). One number from 0 to 1 that drifts
// toward the level where you win about half your close fights. Only HOW computer tamers decide
// (move choice, switching, potion timing, who to send next) is tuned: never their pets, levels,
// items or any dice roll.
import { save } from './save.js';
export { tune } from './logic/tune.js';

const START = 0.35;
export const SKILL_ID = 'tamers';

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
 * After a tamer battle. result: 1 win, 0 loss (your side). margin 0..1: how decisive (HP left).
 * weight: 1 for a badge leader or the champion, smaller for ordinary tamers.
 */
export function reportResult(id, result, margin = 0.5, weight = 1) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 4 ? 0.14 : 0.08;
  const delta = k * weight * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(id, getSkill(id) + delta, games);
}
