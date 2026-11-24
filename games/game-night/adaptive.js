// Adaptive CPU strength. Every table with a computer opponent keeps a skill number from 0 to 1
// that drifts toward the level where you win about half your games. Only HOW the CPU plays is
// tuned (search depth, aim, memory, reactions); dice, deals and shuffles are never touched.
import { save } from './save.js';

const START = 0.35;

export function getSkill(id) {
  const s = (save.get('skill') || {})[id];
  return typeof s === 'number' ? s : START;
}

function setSkill(id, v, games) {
  save.set('skill', { ...(save.get('skill') || {}), [id]: Math.max(0, Math.min(1, v)) });
  save.set('skillGames', { ...(save.get('skillGames') || {}), [id]: games });
}

export function resetSkill(id) { setSkill(id, START, 0); }

/** 1-10 for display. */
export const skillLabel = (id) => Math.round(getSkill(id) * 9) + 1;

/**
 * After a game against the CPU. result: 1 win, 0.5 draw, 0 loss (from your side).
 * margin 0..1: how decisive it was (a blow-out moves the level more than a squeaker).
 */
export function reportResult(id, result, margin = 0.5) {
  const games = ((save.get('skillGames') || {})[id] || 0) + 1;
  const k = games <= 4 ? 0.14 : 0.08;            // settle quickly at first, then fine-tune
  const delta = k * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(id, getSkill(id) + delta, games);
}

/**
 * Blend calibrated presets { easy, normal, hard } at skill s (0 = easy, 0.5 = normal, 1 = hard).
 * Numbers are interpolated; keys listed in `ints` are rounded.
 */
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
