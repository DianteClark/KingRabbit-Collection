import { createSave } from '../../shared/core/save.js';

// record: your results vs the CPU in every mode. cup: the run in progress (null when none).
export const save = createSave('soccer', {
  skill: {}, skillGames: {},
  record: { w: 0, d: 0, l: 0 },
  cup: null, cupsWon: 0, cupRuns: 0,
  endless: { streak: 0 }, endlessBest: 0,
  length: 'normal', opponent: 'foxes', seenHelp: false, unfinished: null,
  beaten: {}, // team id -> true once you have beaten it (any mode), for the Grand Tour trophy
});

/** outcome 'w' | 'd' | 'l' */
export function addRecord(outcome) {
  save.update('record', (r) => ({ ...{ w: 0, d: 0, l: 0 }, ...r, [outcome]: ((r || {})[outcome] || 0) + 1 }));
}
