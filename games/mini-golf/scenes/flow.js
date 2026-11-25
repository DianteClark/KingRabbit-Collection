// Starting rounds. A round is one saved object that Play.js keeps up to date after every putt:
//   { mode: 'round' | 'practice' | 'party' | 'daily', course, holes: [holeId], hi (hole index),
//     players: [{ name, color, scores: [strokes per hole] }], cur (player index),
//     strokes (current player's strokes on this hole), ball: [x, y] | null, day (daily only) }
import { PALETTE } from '../../../shared/core/palette.js';
import { today } from '../../../shared/core/trophies.js';
import { go, modal } from './common.js';
import { holesOf, holeById } from '../logic/holes.js';
import { save } from '../save.js';

export function newRound({ mode, course = -1, holes, players = 1 }) {
  const ids = holes || holesOf(course).map((h) => h.id);
  return {
    mode, course, holes: ids, hi: 0, cur: 0, strokes: 0, ball: null,
    players: Array.from({ length: players }, (_, i) => ({ name: players > 1 ? `Player ${i + 1}` : 'You', color: i, scores: [] })),
    day: mode === 'daily' ? today() : null,
  };
}

const busy = (r) => r && holeById(r.holes?.[r.hi]) && (r.strokes > 0 || r.hi > 0 || r.players.some((p) => p.scores.length));

/** Start a new round, asking first if it would replace a round in progress. */
export function startPlay(scene, opts) {
  const begin = () => { save.set('round', newRound(opts)); go(scene, 'Play', { resume: true }); };
  const cur = save.get('round');
  if (scene.confirming) return;
  if (!busy(cur)) { begin(); return; }
  scene.confirming = true;
  modal(scene, 'New game?', ['You have a game in progress. Starting this one ends it.'], [
    ['Start new', begin, PALETTE.gold],
    ['Keep my game', () => {}, PALETTE.lavender],
  ], { onClose: () => { scene.confirming = false; } });
}
