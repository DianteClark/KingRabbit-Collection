// Adaptive enemy pace (same idea as game-night/adaptive.js): one skill number from 0 to 1.
// Falling in battle eases the enemies off a little; beating a boss with hearts to spare, or
// clearing rooms without a scratch, nudges them up. Only enemy speed, reactions, aggression and
// heart drops change (logic/tune.js) - damage, hit points and puzzles stay the same.
import { save } from './save.js';

const START = 0.35;

export function getSkill() {
  const s = save.get('skill');
  return typeof s === 'number' ? s : START;
}

function nudge(d) { save.set('skill', Math.max(0, Math.min(1, getSkill() + d))); }

export function resetSkill() { save.set('skill', START); }

/** kind: 'death' | 'boss' (hpFrac 0..1 left) | 'cleanRoom' */
export function report(kind, hpFrac = 0) {
  if (kind === 'death') nudge(-0.07);
  else if (kind === 'boss') nudge(-0.02 + 0.08 * hpFrac);
  else if (kind === 'cleanRoom') nudge(0.008);
}

/** 1-10 for display. */
export const skillLabel = () => Math.round(getSkill() * 9) + 1;
