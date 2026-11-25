import { createSave } from '../../shared/core/save.js';

// progress.cups[i]: your best final place in cup i (null = never finished it).
// cup: the cup in progress (null when none). best[trackId]: { lap, race, ghost, gm, gc }.
export const save = createSave('racers', {
  car: 'hatch', colour: 'red', autoGas: true,
  progress: { cups: [null, null, null] },
  cup: null,
  best: {},
  quickTrack: 'downtown', ttTrack: 'downtown',
  hints: {},
  races: 0, wins: 0,
  skill: {}, skillGames: {},
});
