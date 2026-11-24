// Adaptive computer strength (same idea as Game Night's adaptive.js). One skill number from 0 to 1
// that drifts toward the level where you win about half the time. Only HOW the computer plays is
// tuned (when it attacks, what it builds, how it fights); it never gets extra gold or troops.
import { save } from './save.js';

const START = 0.35;
export const SKILL_ID = 'enemy';

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
 * After a result against the computer. result: 1 win, 0.5 draw, 0 loss (your side).
 * margin 0..1: how decisive. weight: 1 for a whole scenario, smaller for a single battle.
 */
export function reportResult(id, result, margin = 0.5, weight = 1) {
  const games = ((save.get('skillGames') || {})[id] || 0) + (weight >= 1 ? 1 : 0);
  const k = games <= 4 ? 0.14 : 0.08;
  const delta = k * weight * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(id, getSkill(id) + delta, games);
}

/** Blend calibrated presets { easy, normal, hard } at skill s. Keys in `ints` are rounded. */
export function tune(presets, s, ints = []) {
  const { easy, normal, hard } = presets;
  const out = {};
  const keys = new Set([...Object.keys(easy), ...Object.keys(normal), ...Object.keys(hard)]);
  for (const k of keys) {
    const a = easy[k] ?? 0; const b = normal[k] ?? 0; const c = hard[k] ?? 0;
    const v = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
    out[k] = ints.includes(k) ? Math.round(v) : v;
  }
  return out;
}
