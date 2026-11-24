import { createSave } from '../../shared/core/save.js';

// game: the adventure in progress (logic/game.js newState shape), null before the first start.
// skill: adaptive enemy pace (adaptive.js). seenHelp: the How to Play sheet popped up once.
export const save = createSave('hero-quest', {
  game: null, skill: 0.35, seenHelp: false, finishes: 0, bestTime: null,
});
