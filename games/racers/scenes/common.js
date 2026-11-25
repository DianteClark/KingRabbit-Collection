// UI helpers shared by the Tiny Town Racers screens (landscape, 640x360).
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';

export const WIDTH = LANDSCAPE.WIDTH;
export const HEIGHT = LANDSCAPE.HEIGHT;

/** Top bar: back button + title + gold "?" How to Play button. */
export function header(scene, title, onBack) {
  const back = button(scene, 34, 28, 52, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, 28, title, { size: 32, color: PALETTE.cream });
  const help = button(scene, WIDTH - 34, 28, 52, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return { title: t, back, help };
}

/** Pause the given scenes and show the How to Play sheet. */
export function openHowTo(scene, alsoPause = [], onClose) {
  if (document.getElementById('howto')) return;
  const scenes = [scene, ...alsoPause];
  scenes.forEach((s) => s.scene.pause());
  const sections = [...RULES.sections];
  sections.splice(4, 0, {
    heading: 'The rivals adapt to you',
    text: `Your rivals are driving at level ${skillLabel()} of 10 for you right now. Win and they get quicker next time; finish near the back and they ease off. Only how they drive changes (pace, cornering, boosting); their cars are the same as yours. The Moonlight and Champion Cups add a little extra. Each rival also has their own small edge: Ace is the quickest, Dot the gentlest.`,
  });
  showHowTo({ ...RULES, sections }, () => { scenes.forEach((s) => s.scene.resume()); onClose?.(); });
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

/**
 * Modal panel. buttons = [[label, onTap, fill?], ...]. Blocks every tap behind it, and each
 * button works once (the modal closes itself before running the action).
 */
export function modal(scene, title, lines, buttons, { depth = 50, onClose } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive();
  const wide = buttons.length >= 3;
  const h = 104 + lines.length * 24 + (wide ? 56 : buttons.length * 54);
  const top = Math.max(4, Math.round((HEIGHT - h) / 2));
  const pw = wide ? 540 : 360;
  const box = panel(scene, (WIDTH - pw) / 2, top, pw, h);
  c.add([dim, box]);
  c.add(text(scene, WIDTH / 2, top + 32, title, { size: 32, color: PALETTE.gold }));
  lines.forEach((l, i) => c.add(text(scene, WIDTH / 2, top + 70 + i * 24, l, { color: PALETTE.cream })));
  let used = false;
  buttons.forEach(([label, fn, fill], i) => {
    const bx = wide ? WIDTH / 2 + (i - (buttons.length - 1) / 2) * 172 : WIDTH / 2;
    const by = top + 70 + lines.length * 24 + 22 + (wide ? 0 : i * 54);
    c.add(button(scene, bx, by, wide ? 164 : 250, 44, label, () => {
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

/** Row of stat pips (1-5). */
export function statBar(scene, x, y, label, n, of = 5) {
  const c = scene.add.container(x, y);
  c.add(text(scene, 0, 0, label, { color: PALETTE.lavender, origin: [0, 0.5] }));
  for (let i = 0; i < of; i++) {
    c.add(scene.add.rectangle(76 + i * 18, 0, 14, 10, hex(i < n ? PALETTE.gold : PALETTE.indigo)).setStrokeStyle(2, hex(PALETTE.ink)));
  }
  return c;
}

/** A tappable card: a framed panel that runs fn on tap (with the same guard as buttons). */
export function card(scene, x, y, w, h, fn, { fill = PALETTE.indigo, enabled = true } = {}) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, hex(PALETTE.ink)).setOrigin(0.5);
  const inner = scene.add.rectangle(0, 0, w - 4, h - 4, hex(PALETTE.lavender)).setOrigin(0.5);
  const face = scene.add.rectangle(0, 0, w - 8, h - 8, hex(fill)).setOrigin(0.5);
  c.add([bg, inner, face]);
  c.face = face;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: enabled });
  let down = false;
  c.on('pointerdown', () => { down = true; c.y = y + 2; });
  c.on('pointerout', () => { down = false; c.y = y; });
  c.on('pointerup', () => {
    if (!down) return;
    down = false; c.y = y;
    if (enabled) { sfx('tap'); fn?.(); } else sfx('error');
  });
  if (!enabled) c.setAlpha(0.6);
  return c;
}
