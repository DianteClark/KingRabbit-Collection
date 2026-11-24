// Adaptive computer strength (the same pattern as Heroes Lite and Sand Tactics). One skill number
// from 0 to 1 drifts toward the level where you win about half your games. Only HOW the rivals
// play changes (how many cities they aim for, how well they choose builds and research, how
// carefully they attack); they never get extra gold, production or units.
import { save } from './save.js';

const START = 0.3;
export const SKILL_ID = 'rivals';

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

/** After a game against the computer. result: 1 win, 0 loss. margin 0..1: how decisive. */
export function reportResult(result, margin = 0.5, id = SKILL_ID) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 4 ? 0.14 : 0.08;
  const delta = k * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(id, getSkill(id) + delta, games);
}
