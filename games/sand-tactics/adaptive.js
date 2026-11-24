// Adaptive computer strength (same pattern as Game Night and Heroes Lite). One skill number from 0 to 1
// drifts toward the level where you win about half the time. Only HOW the computer plays changes
// (risk taking, focus fire, guarding its guns, what it builds); it never gets extra funds or units.
import { save } from './save.js';

const START = 0.35;
export const SKILL_ID = 'cpu';

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

/** After a battle against the computer. result: 1 win, 0 loss (your side). margin 0..1: how decisive. */
export function reportResult(id = SKILL_ID, result = 0, margin = 0.5) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 4 ? 0.14 : 0.08;
  const delta = k * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(id, getSkill(id) + delta, games);
}
