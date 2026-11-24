import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';

/** Top bar used by every Game Night screen: back button + title. */
export function header(scene, title, onBack) {
  button(scene, 34, 34, 52, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2 + 12, 34, title, { size: 32, color: PALETTE.cream });
  return t;
}

/** Go to another scene with a quick fade. */
export function go(scene, key, data) {
  fadeTo(scene, () => scene.scene.start(key, data));
}

/** Two-line title with a hard drop shadow, like the launcher's heading. */
export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/**
 * Modal panel over the board. buttons = [[label, onTap], ...]
 * Returns the container so callers can destroy it.
 */
export function modal(scene, title, lines, buttons) {
  const c = scene.add.container(0, 0).setDepth(50);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive();
  const h = 120 + lines.length * 24 + buttons.length * 64;
  const top = Math.round((HEIGHT - h) / 2);
  const box = panel(scene, 30, top, 300, h);
  c.add([dim, box]);
  c.add(text(scene, WIDTH / 2, top + 40, title, { size: 32, color: PALETTE.gold }));
  lines.forEach((l, i) => c.add(text(scene, WIDTH / 2, top + 80 + i * 24, l, { color: PALETTE.cream })));
  buttons.forEach(([label, fn], i) => {
    c.add(button(scene, WIDTH / 2, top + 80 + lines.length * 24 + 24 + i * 64, 220, 48, label, fn, {
      fill: i === 0 ? PALETTE.gold : PALETTE.lavender,
    }));
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
  return c;
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT - 60) {
  const t = text(scene, WIDTH / 2, y, msg, { color: PALETTE.gold }).setDepth(40);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
}

/** Pop a sprite in from nothing to its target scale. */
export function popIn(scene, obj, scale) {
  obj.setScale(0);
  scene.tweens.add({ targets: obj, scale, duration: 180, ease: 'Back.easeOut' });
}

/** Set the scene colour and paint the page behind the canvas the same, so phones show no bars. */
export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}
