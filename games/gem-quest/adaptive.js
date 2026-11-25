// Adaptive monster skill (the pattern from Game Night's adaptive.js). One number from 0 to 1
// drifts after every campaign or tower battle toward the level where you win about 3 fights in
// 4 (a campaign should feel winnable). Only HOW monsters pick gems changes (aim, lookahead);
// their HP, damage, skills and the gems that fall are never touched.
import { save } from './save.js';
import { aiParams } from './logic/ai.js';

export const getSkill = () => {
  const s = save.get('skill');
  return typeof s === 'number' ? s : 0.35;
};

/** 1-10 for display. */
export const skillLabel = () => Math.round(getSkill() * 9) + 1;

/** After a battle: won true/false; margin 0..1 = how decisive (HP left for a win). */
export function reportResult(won, margin = 0.5) {
  const games = (save.get('skillGames') || 0) + 1;
  const k = games <= 5 ? 0.1 : 0.05;
  // A win nudges up a little, a loss drops it three times as far: settles near 75% wins.
  const delta = won ? k * 0.5 * (0.6 + 0.8 * margin) : -k * 1.5 * (0.6 + 0.8 * margin);
  save.set('skill', Math.max(0, Math.min(1, getSkill() + delta)));
  save.set('skillGames', games);
}

export const currentAi = () => aiParams(getSkill());
