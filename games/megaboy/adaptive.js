// Adaptive enemy pace (the game-night adaptive.js pattern): one skill number from 0 to 1.
// Losing lives eases enemies off a little; clearing stages cleanly and beating bosses with
// health to spare nudges them up. Only enemy fire rate, aggression, boss rests and drop rates
// change (logic/tune.js). Stage layouts and boss HP never do.
import { save } from './save.js';

const START = 0.35;

export function getSkill() {
  const s = save.get('skill');
  return typeof s === 'number' && Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : START;
}

function nudge(d) { save.set('skill', Math.max(0, Math.min(1, getSkill() + d))); }

export function resetSkill() { save.set('skill', START); }

/** kind: 'death' | 'gameover' | 'clear' (deaths in the stage) | 'boss' (hp fraction left) */
export function report(kind, v = 0) {
  if (kind === 'death') nudge(-0.05);
  else if (kind === 'gameover') nudge(-0.06);
  else if (kind === 'clear') nudge(v === 0 ? 0.06 : v === 1 ? 0.02 : 0);
  else if (kind === 'boss') nudge(-0.02 + 0.07 * v);
}

/** 1-10 for display. */
export const skillLabel = () => Math.round(getSkill() * 9) + 1;
