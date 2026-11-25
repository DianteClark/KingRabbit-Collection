import { createSave } from '../../shared/core/save.js';

// run: the colony in progress (standard or peaceful). daily: { day, run } for today's challenge.
// skill: the storyteller's adaptive setting per mode. guided: the first-minutes guide was done once.
export const store = createSave('colony', { run: null, daily: null, skill: {}, guided: false, music: true, tipPan: false, best: {} });
