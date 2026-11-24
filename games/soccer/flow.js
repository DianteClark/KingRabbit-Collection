// Starting matches and applying results for the three modes (adaptive level, records, cup, endless).
import { save, addRecord } from './save.js';
import { getSkill, reportResult, marginOf } from './adaptive.js';
import { LENGTHS } from './logic/match.js';
import { PLAYER_TEAM, teamById } from './logic/teams.js';
import { advanceCup, cupSkill, endlessOpponent, endlessSkill } from './logic/cup.js';
import { clamp } from './logic/util.js';

export const halfSeconds = () => LENGTHS[save.get('length')] || LENGTHS.normal;

/** CPU skill 0..1 for this mode and opponent. */
export function matchSkill(mode, opp) {
  const base = getSkill();
  if (mode === 'cup') return cupSkill(base, opp, (save.get('cup') || {}).round || 0);
  if (mode === 'endless') return endlessSkill(base, (save.get('endless') || {}).streak || 0);
  return clamp(base + opp.strength, 0, 1);
}

/** Data for the MatchScene. */
export function matchData(mode, oppId) {
  const opp = mode === 'endless' ? endlessOpponent((save.get('endless') || {}).streak || 0) : teamById(oppId);
  return { mode, home: PLAYER_TEAM.id, away: opp.id, skill: matchSkill(mode, opp), half: halfSeconds() };
}

/** Does this match need a penalty shoot-out? */
export const needsPens = (mode, score) => mode !== 'quick' && score[0] === score[1];

/**
 * Record a finished match. score [you, them]; pens [you, them] after a shoot-out.
 * Returns { outcome, won, cup?, streak?, ended? }.
 */
/** Cup and Endless matches are marked as started, so leaving the page counts as quitting. */
export function markStarted(data) {
  if (data.mode === 'cup' || data.mode === 'endless') save.set('unfinished', { ...data });
}

/** Matches abandoned without the pause menu (closed the tab, reloaded, phone killed it). */
export function settleUnfinished() {
  const data = save.get('unfinished');
  if (!data) return null;
  const res = applyResult(data, QUIT_SCORE);
  return { data, res };
}

export const QUIT_SCORE = [0, 3];

export function applyResult(data, score, pens = null) {
  save.set('unfinished', null);
  const won = pens ? pens[0] > pens[1] : score[0] > score[1];
  const draw = !pens && score[0] === score[1];
  const outcome = draw ? 'd' : won ? 'w' : 'l';
  // A shoot-out counts as a draw for the CPU level (penalties are mostly luck).
  reportResult(pens || draw ? 0.5 : won ? 1 : 0, marginOf(score[0], score[1]));
  addRecord(outcome);
  const res = { outcome, won, draw };
  if (data.mode === 'cup') {
    const cup = advanceCup(save.get('cup'), won, score, pens);
    if (cup.champion === PLAYER_TEAM.id) save.set('cupsWon', (save.get('cupsWon') || 0) + 1);
    save.set('cup', cup);
    res.cup = cup;
  } else if (data.mode === 'endless') {
    const e = save.get('endless') || { streak: 0 };
    if (won) {
      e.streak = (e.streak || 0) + 1;
      save.set('endlessBest', Math.max(save.get('endlessBest') || 0, e.streak));
      res.streak = e.streak;
    } else {
      res.streak = e.streak || 0;
      res.ended = true;
      e.streak = 0;
    }
    save.set('endless', e);
  }
  return res;
}
