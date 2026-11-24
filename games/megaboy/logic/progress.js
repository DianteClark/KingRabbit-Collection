// Saved progress between stages: beaten bosses, weapons, E-tanks (and which ones were found),
// lives and the fortress. Pure functions on a plain object so they are easy to test.
import { START_LIVES, MAX_ETANKS, MAX_LIVES } from './constants.js';
import { BOSSES, ROBOT_BOSSES } from './bosses.js';
import { STAGES, ROBOT_STAGES } from './stages.js';

export function newProgress() {
  return { v: 1, beaten: [], weapons: [], etanks: 0, found: [], lives: START_LIVES, fort: 0, done: false, weakSeen: [], clears: 0, deaths: 0, time: 0 };
}

/** Repair anything missing or out of range in a loaded save. */
export function normalize(p) {
  const base = newProgress();
  if (!p || typeof p !== 'object' || p.v !== 1) return base;
  const out = { ...base, ...p };
  out.beaten = [...new Set((out.beaten || []).filter((b) => BOSSES[b]))];
  out.weapons = [...new Set((out.weapons || []).filter((w) => ROBOT_BOSSES.some((b) => BOSSES[b].weapon === w)))];
  out.etanks = Math.max(0, Math.min(MAX_ETANKS, out.etanks | 0));
  out.lives = Math.max(0, Math.min(MAX_LIVES, Number.isFinite(out.lives) ? out.lives | 0 : START_LIVES));
  out.fort = Math.max(0, Math.min(2, out.fort | 0));
  out.found = Array.isArray(out.found) ? out.found : [];
  out.weakSeen = Array.isArray(out.weakSeen) ? out.weakSeen : [];
  return out;
}

export const robotsBeaten = (p) => ROBOT_BOSSES.filter((b) => p.beaten.includes(b)).length;

/** Can this stage be picked? The six robot stages always; the fortress after all six. */
export function unlocked(p, id) {
  if (ROBOT_STAGES.includes(id)) return true;
  if (id === 'fort1') return robotsBeaten(p) === 6;
  if (id === 'fort2') return robotsBeaten(p) === 6 && p.fort >= 1;
  return false;
}

/** The fortress stage to play next (or null until all six bosses are down). */
export function fortressStage(p) {
  if (robotsBeaten(p) < 6) return null;
  return p.fort >= 1 ? 'fort2' : 'fort1';
}

/** Copy what the run gathered (E-tanks, lives, weakness discoveries) into the save. */
export function absorbRun(p, w) {
  const out = { ...p };
  out.etanks = Math.min(MAX_ETANKS, w.etanks);
  out.found = [...new Set([...p.found, ...w.found])];
  out.lives = Math.max(0, Math.min(MAX_LIVES, w.lives));
  out.deaths = (p.deaths || 0) + (w.deaths || 0);
  out.time = (p.time || 0) + (w.clock || 0);
  return out;
}

/** Stage cleared: the boss's weapon is yours. */
export function winStage(p, stageId, w) {
  const out = absorbRun(p, w);
  const boss = STAGES[stageId].boss;
  if (!out.beaten.includes(boss)) out.beaten = [...out.beaten, boss];
  const weapon = BOSSES[boss].weapon;
  if (weapon && !out.weapons.includes(weapon)) out.weapons = [...out.weapons, weapon];
  if (stageId === 'fort1') out.fort = Math.max(out.fort, 1);
  if (stageId === 'fort2') { out.fort = 2; out.done = true; }
  out.clears = (p.clears || 0) + 1;
  return out;
}

/** After a game over you continue with a fresh set of lives. */
export function afterGameOver(p) { return { ...p, lives: START_LIVES }; }

/** A friendly suggestion for the stage select: a boss weak to a weapon you have, else Foundry. */
export function suggestion(p) {
  const left = ROBOT_STAGES.filter((s) => !p.beaten.includes(STAGES[s].boss));
  if (!left.length) return fortressStage(p);
  const good = left.find((s) => p.weapons.includes(BOSSES[STAGES[s].boss].weak));
  return good || (left.includes('foundry') ? 'foundry' : left[0]);
}

export function noteWeak(p, boss) {
  if (p.weakSeen.includes(boss)) return p;
  return { ...p, weakSeen: [...p.weakSeen, boss] };
}
