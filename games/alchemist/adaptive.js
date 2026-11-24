// Adaptive customers (same idea as Game Night's adaptive.js). One number from 0 to 1 that drifts
// toward the level where you satisfy most, but not all, of your customers. It only changes how
// picky customers are (how often they want a strong potion, how specific they are, how much over
// the fair price they will pay) and how good Madame Vex's festival potions are. Prices, rent,
// ingredients and your own brewing are never touched.
import { save } from './save.js';

const START = 0.35;
export const SKILL_ID = 'customers';

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
 * After each shop day. satisfaction 0..1: share of customers who left happy.
 * Aim: about 70% happy. Above that customers get pickier, below it they relax.
 */
export function reportDay(satisfaction, customers) {
  if (!customers) return;
  const games = ((save.get('skillGames') || {})[SKILL_ID] || 0) + 1;
  const k = games <= 5 ? 0.1 : 0.05;
  const delta = k * Math.max(-1, Math.min(1, (satisfaction - 0.7) / 0.3));
  setSkill(SKILL_ID, getSkill() + delta, games);
}
