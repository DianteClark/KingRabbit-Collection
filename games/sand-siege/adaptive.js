// Adaptive difficulty (same pattern as Game Night and Sand Tactics). One skill number from 0 to 1 drifts
// toward the level where you win about as often as you lose. In Sand Siege it ONLY changes enemy health,
// and gently: from 88% to 112% of normal. Waves, money, towers and enemy numbers never change.
// Only campaign maps on Normal count; Hard, Endless and the daily challenge are the same for everyone.
import { save } from './save.js';

const START = 0.5;
const ID = 'hp';

export function getSkill() {
  const s = (save.get('skill') || {})[ID];
  return typeof s === 'number' ? s : START;
}
function setSkill(v, games) {
  save.set('skill', { ...(save.get('skill') || {}), [ID]: Math.max(0, Math.min(1, v)) });
  save.set('skillGames', { ...(save.get('skillGames') || {}), [ID]: games });
}
export function resetSkill() { setSkill(START, 0); }

/** Enemy health multiplier for campaign maps on Normal. */
export const hpScale = (skill = getSkill()) => Math.round((0.88 + 0.24 * skill) * 100) / 100;
/** Shown to the player, e.g. "100%". */
export const hpLabel = () => `${Math.round(hpScale() * 100)}%`;

/** After a campaign map on Normal. result 1 = win, 0 = loss; margin 0-1 = how clear it was. */
export function reportResult(result, margin = 0.5) {
  const games = ((save.get('skillGames') || {})[ID] || 0) + 1;
  const k = games <= 4 ? 0.12 : 0.07;
  const delta = k * (result - 0.5) * 2 * (0.6 + 0.8 * margin);
  setSkill(getSkill() + delta, games);
}
