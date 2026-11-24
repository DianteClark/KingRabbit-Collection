import { createSave } from '../../shared/core/save.js';

// Records are only kept for games against the computer.
export const save = createSave('game-night', {
  ttt: { w: 0, d: 0, l: 0 },
  reversi: { w: 0, d: 0, l: 0 },
  yachtBest: 0,
});

export function record(game, outcome) {
  save.update(game, (r) => ({ ...r, [outcome]: r[outcome] + 1 }));
}
