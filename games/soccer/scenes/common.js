// UI helpers shared by the Pocket Soccer screens (same look as game-night/scenes/common.js).
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';

// Pocket Soccer is a landscape game: everything is laid out for 640x360.
export const WIDTH = LANDSCAPE.WIDTH;
export const HEIGHT = LANDSCAPE.HEIGHT;
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';

/** Top bar: back button + title + gold "?" How to Play button. */
export function header(scene, title, onBack) {
  button(scene, 34, 28, 52, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, 28, title, { size: 32, color: PALETTE.cream });
  button(scene, WIDTH - 34, 28, 52, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

/** Pause the given scenes and show the How to Play sheet. */
export function openHowTo(scene, alsoPause = []) {
  if (document.getElementById('howto')) return;
  const scenes = [scene, ...alsoPause];
  scenes.forEach((s) => s.scene.pause());
  const sections = [...RULES.sections, {
    heading: 'The computer adapts to you',
    text: `The CPU teams are at level ${skillLabel()} of 10 for you right now. Win and they play better next time; lose and they ease off, scaled by the goal difference. Only how the computer plays changes (reactions, pace, passing, shooting, tackling and goalkeeping). Cup and Endless teams add their own strength on top. You can reset the level from the main menu.`,
  }];
  showHowTo({ ...RULES, sections }, () => scenes.forEach((s) => s.scene.resume()));
}

/** Change screen once: later taps during the fade are ignored (no double starts). */
export function go(scene, key, data) {
  if (scene.leaving) return;
  scene.leaving = true;
  scene.input.enabled = false;
  fadeTo(scene, () => scene.scene.start(key, data));
}

/**
 * Call at the top of every screen's create(): resets the leave guard and ignores taps for a
 * moment, so a double tap on the previous screen can't press whatever sits in the same spot here.
 */
export function freshScreen(scene, ms = 200) {
  scene.leaving = false;
  scene.input.enabled = false;
  scene.time.delayedCall(ms, () => { if (!scene.leaving) scene.input.enabled = true; });
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Modal panel. buttons = [[label, onTap, fill?, color?], ...]. Returns the container. */
export function modal(scene, title, lines, buttons, { depth = 50 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive();
  // Landscape: with three or more buttons they sit side by side to keep the panel short.
  const wide = buttons.length >= 3;
  const h = 112 + lines.length * 24 + (wide ? 60 : buttons.length * 56);
  const top = Math.max(4, Math.round((HEIGHT - h) / 2));
  const pw = wide ? 520 : 340;
  const box = panel(scene, (WIDTH - pw) / 2, top, pw, h);
  c.add([dim, box]);
  c.add(text(scene, WIDTH / 2, top + 36, title, { size: 32, color: PALETTE.gold }));
  lines.forEach((l, i) => c.add(text(scene, WIDTH / 2, top + 78 + i * 24, l, { color: PALETTE.cream })));
  buttons.forEach(([label, fn, fill, color], i) => {
    const bx = wide ? WIDTH / 2 + (i - (buttons.length - 1) / 2) * 164 : WIDTH / 2;
    const by = top + 78 + lines.length * 24 + 22 + (wide ? 0 : i * 56);
    c.add(button(scene, bx, by, wide ? 156 : 240, 46, label, fn, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    }));
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
  return c;
}

export function setBackground(scene, color) {
  freshScreen(scene);
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

/** Small kit swatch: shirt over shorts. */
export function kitChip(scene, x, y, team, s = 1) {
  const c = scene.add.container(x, y);
  c.add(scene.add.rectangle(0, 0, 18 * s, 18 * s, hex(PALETTE.ink)));
  c.add(scene.add.rectangle(0, -2 * s, 14 * s, 10 * s, hex(team.shirt)));
  c.add(scene.add.rectangle(0, 5 * s, 14 * s, 4 * s, hex(team.shorts)));
  return c;
}

/** Row of 1-5 stars (drawn as small squares so they stay crisp). */
export function starRow(scene, x, y, n, of = 5) {
  const c = scene.add.container(x, y);
  for (let i = 0; i < of; i++) {
    const on = i < n;
    c.add(scene.add.rectangle((i - (of - 1) / 2) * 14, 0, 10, 10, hex(on ? PALETTE.gold : PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink)));
  }
  return c;
}
