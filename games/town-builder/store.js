import { createSave } from '../../shared/core/save.js';

// run: the saved city (serialized). best: per-scenario results. guided: the first-minutes guide was finished once.
export const store = createSave('town-builder', { run: null, best: {}, guided: false });
