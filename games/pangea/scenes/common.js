import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';

export { WIDTH, HEIGHT };

/** Hand-off between scenes. */
export const store = { start: null };

export function openHowTo(scene, onClose) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  const sections = [...RULES.sections];
  sections.splice(sections.length - 3, 0, {
    heading: 'The rivals adapt to you',
    text: `Computer rivals play at level ${skillLabel()} of 10 for you right now. Win and they play smarter next time (more cities, better builds and research, more careful attacks); lose and they ease off. They never get extra gold, production or units.`,
  });
  showHowTo({ ...RULES, sections }, () => { scene.scene.resume(); onClose?.(); });
}

export function go(scene, key, data) { fadeTo(scene, () => scene.scene.start(key, data)); }

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

export function header(scene, title, onBack) {
  if (onBack) button(scene, 30, 26, 48, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, 26, title, { size: 32, color: PALETTE.cream });
  button(scene, WIDTH - 30, 26, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT - 170, color = PALETTE.gold, ms = 1600) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 40 }).setDepth(201);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.88).setDepth(200);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: ms, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return [t, bg];
}
