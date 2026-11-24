// Helpers shared by the menu scenes: progress load/store, the header buttons, the How to Play
// sheet (with the live enemy-pace note) and guarded scene changes.
import { PALETTE } from '../../../shared/core/palette.js';
import { button, fadeTo } from '../../../shared/core/ui.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { save } from '../save.js';
import { normalize } from '../logic/progress.js';
import { skillLabel } from '../adaptive.js';

export const loadProgress = () => normalize(save.get('progress'));
export const storeProgress = (p) => save.set('progress', p);
export const hasGame = () => !!save.get('progress');

/** The How to Play sheet, with a note on how the enemies are adapting. */
export function openHelp(onClose) {
  if (document.getElementById('howto')) return;
  const sections = [...RULES.sections];
  sections.splice(sections.length - 2, 0, {
    heading: 'Enemies adapt to you',
    text: `Enemy pace is ${skillLabel()} of 10 for you right now. Losing lives eases enemies off; clearing stages without a scratch speeds them up. Only how often they shoot, how hard they chase and how much they drop changes. Stages and boss health never do.`,
  });
  showHowTo({ ...RULES, sections }, onClose);
}

/** Change scene once: later taps during the fade are ignored. */
export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  fadeTo(scene, () => scene.scene.start(key, data));
}

/** Back (<) and help (?) buttons in the top corners. */
export function header(scene, onBack) {
  const back = button(scene, 30, 26, 48, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const help = button(scene, 610, 26, 48, 40, '?', () => openHelp(), { size: 32, fill: PALETTE.gold });
  return { back, help };
}

/** Ignore taps for a moment after a scene opens, so a tap on the last screen can't fall through. */
export function guardTaps(scene, ms = 350) {
  scene.input.enabled = false;
  scene.time.delayedCall(ms, () => { scene.input.enabled = true; });
}

/** Keyboard Escape acts like the back button. */
export function escBack(scene, fn) {
  scene.input.keyboard?.on('keydown-ESC', () => { if (!document.getElementById('howto')) fn(); });
}
