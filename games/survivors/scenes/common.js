// UI helpers shared by the Rabbit Survivors screens (landscape, 640x360). Everything tappable
// sits at least 16px inside the canvas edges.
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';

export const WIDTH = LANDSCAPE.WIDTH;
export const HEIGHT = LANDSCAPE.HEIGHT;
export const M = 16; // safe margin

/** Top bar: back button + title + gold "?" How to Play button. */
export function header(scene, title, onBack) {
  const back = button(scene, M + 26, M + 20, 52, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, M + 20, title, { size: 32, color: PALETTE.cream });
  const help = button(scene, WIDTH - M - 26, M + 20, 52, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return { title: t, back, help };
}

/** Pause the given scenes and show the How to Play sheet. */
export function openHowTo(scene, alsoPause = [], onClose) {
  if (document.getElementById('howto')) return;
  const scenes = [scene, ...alsoPause];
  scenes.forEach((s) => s.scene.pause());
  showHowTo(RULES, () => { scenes.forEach((s) => s.scene.resume()); onClose?.(); });
}

/** Change screen once: later taps during the fade are ignored (no double starts). */
export function go(scene, key, data) {
  if (scene.leaving) return;
  scene.leaving = true;
  scene.input.enabled = false;
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function freshScreen(scene, ms = 220) {
  scene.leaving = false;
  scene.input.enabled = false;
  scene.time.delayedCall(ms, () => { if (!scene.leaving) scene.input.enabled = true; });
}

export function setBackground(scene, color = PALETTE.night) {
  freshScreen(scene);
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Modal panel. buttons = [[label, onTap, fill?], ...]; each works once. */
export function modal(scene, title, lines, buttons, { depth = 50, onClose } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive();
  const h = 104 + lines.length * 24 + buttons.length * 54;
  const top = Math.max(M, Math.round((HEIGHT - h) / 2));
  const pw = 360;
  c.add([dim, panel(scene, (WIDTH - pw) / 2, top, pw, h)]);
  c.add(text(scene, WIDTH / 2, top + 32, title, { size: 32, color: PALETTE.gold }));
  lines.forEach((l, i) => c.add(text(scene, WIDTH / 2, top + 70 + i * 24, l, { color: PALETTE.cream })));
  let used = false;
  buttons.forEach(([label, fn, fill], i) => {
    const by = top + 70 + lines.length * 24 + 22 + i * 54;
    c.add(button(scene, WIDTH / 2, by, 250, 44, label, () => {
      if (used) return;
      used = true;
      c.destroy();
      onClose?.();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: PALETTE.night }));
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** A tappable card: a framed panel that runs fn on tap. */
export function card(scene, x, y, w, h, fn, { fill = PALETTE.indigo, border = PALETTE.lavender } = {}) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, hex(PALETTE.ink)).setOrigin(0.5);
  const inner = scene.add.rectangle(0, 0, w - 4, h - 4, hex(border)).setOrigin(0.5);
  const face = scene.add.rectangle(0, 0, w - 8, h - 8, hex(fill)).setOrigin(0.5);
  c.add([bg, inner, face]);
  c.face = face; c.inner = inner;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  let down = false;
  c.on('pointerdown', () => { down = true; c.y = y + 2; });
  c.on('pointerout', () => { down = false; c.y = y; });
  c.on('pointerup', () => {
    if (!down) return;
    down = false; c.y = y;
    sfx('tap'); fn?.();
  });
  return c;
}

/** Row of level pips. */
export function pips(scene, c, x, y, n, of) {
  for (let i = 0; i < of; i++) c.add(scene.add.rectangle(x + i * 12, y, 9, 7, hex(i < n ? PALETTE.gold : PALETTE.night)).setStrokeStyle(1, hex(PALETTE.ink)));
}
