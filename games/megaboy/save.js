import { createSave } from '../../shared/core/save.js';

// progress: logic/progress.js shape. skill: adaptive enemy pace. seen: tips already shown.
export const save = createSave('megaboy', {
  progress: null, skill: 0.35, seenHelp: false, seenIntro: false, seen: [], music: true, finishes: 0, bestTime: null,
});
