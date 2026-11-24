// Adaptive CPU strength (same pattern as game-night/adaptive.js). One skill number from 0 to 1
// drifts toward the level where you win about half your matches: wins raise it, losses lower it,
// bigger goal margins move it more. Only how the CPU plays changes (reactions, pace, passing and
// shooting accuracy, tackling, goalkeeping); the ball and the rules are the same for both teams.
import { save } from './save.js';

export const SKILL_ID = 'soccer';
const START = 0.35;

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
 * result: 1 win, 0.5 draw, 0 loss (your side). margin 0..1 from the goal difference.
 * Sized from CPU-vs-CPU sims (see logic/ai.js effectiveSkill): 0.1 of skill is worth about a
 * 5-10% swing in win chance, so after three settling-in matches one result moves the CPU by
 * 0.035-0.065 (a narrow win nudges it, a thrashing a bit more). Small, steady steps.
 */
export function reportResult(result, margin = 0.5, id = SKILL_ID) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 3 ? 0.1 : 0.05;
  const delta = k * (result - 0.5) * 2 * (0.7 + 0.6 * margin);
  setSkill(id, getSkill(id) + delta, games);
}

/** Goal difference -> 0..1 margin (a three-goal win counts as a thrashing). */
export const marginOf = (a, b) => Math.min(1, Math.abs(a - b) / 3);
