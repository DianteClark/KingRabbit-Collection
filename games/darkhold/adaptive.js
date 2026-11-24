// Adaptive difficulty (same idea as game-night/adaptive.js): one skill number from 0 to 1 per
// mode. Dying nudges it down, clearing floors in good shape and winning nudge it up. Only how
// alert and pushy monsters are depends on it (logic/game.js TUNE): never the map, loot or stats.
// Daily runs use a fixed middle setting so everyone plays the same dungeon the same way.
import { save } from './save.js';

const START = 0.35;

export function getSkill(mode = 'normal') {
  const s = (save.get('skill') || {})[mode];
  return typeof s === 'number' ? s : START;
}

function nudge(mode, d) {
  const all = { ...(save.get('skill') || {}) };
  all[mode] = Math.max(0, Math.min(1, getSkill(mode) + d));
  save.set('skill', all);
}

/** kind: 'death' (depth) | 'floor' (hpFrac 0..1 left after a floor) | 'win' */
export function report(mode, kind, value = 0) {
  if (mode === 'daily') return;
  if (kind === 'death') nudge(mode, value <= 3 ? -0.08 : -0.05);
  else if (kind === 'floor') nudge(mode, value > 0.6 ? 0.012 : value < 0.25 ? -0.01 : 0);
  else if (kind === 'win') nudge(mode, 0.06);
}

/** 1-10 for display. */
export const skillLabel = (mode = 'normal') => Math.round(getSkill(mode) * 9) + 1;
