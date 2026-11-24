// Shared helpers for Star Drifter scenes.
import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import { RULES } from '../rules.js';
import { saveRun } from '../save.js';
import * as P from './panels.js';

export { PALETTE, hex, text, button, panel, WIDTH, HEIGHT, sfx, Phaser };

/** Which scene shows each run screen (events, stores and rewards are sheets over the map). */
const SCREEN_SCENES = { map: 'Map', event: 'Map', store: 'Map', reward: 'Map', combat: 'Combat', dead: 'RunEnd', victory: 'RunEnd' };

/** Go to another scene with a quick fade. Double taps only count once. */
export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  P.closeAll();
  scene.events.once('shutdown', () => { scene._leaving = false; });
  fadeTo(scene, () => scene.scene.start(key, data));
}

/** Save the run and show whatever screen it is on now. */
export function route(scene, run) {
  if (scene._leaving) return;
  saveRun(run);
  go(scene, SCREEN_SCENES[run.screen] || 'Map', { run });
}

/** Ignore taps for a moment after a tap rebuilds the screen. */
export function tapCooldown(scene, ms = 250) {
  scene.input.enabled = false;
  const back = () => { scene.input.enabled = true; };
  scene.time.delayedCall(ms, back);
  scene.events.once('shutdown', back);
}

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

/** Pause the scene and show the How to play sheet. */
export function openHowTo(scene, onClose) {
  if (document.getElementById('howto')) return;
  const wasPaused = scene.scene.isPaused();
  if (!wasPaused) scene.scene.pause();
  showHowTo(RULES, () => { if (!wasPaused) scene.scene.resume(); onClose?.(); });
}

/** Gold ? button. */
export function helpButton(scene, x = WIDTH - 24, y = 22, onOpen) {
  return button(scene, x, y, 40, 36, '?', () => { onOpen?.(); openHowTo(scene); }, { fill: PALETTE.gold }).setDepth(60);
}

/** An 8px sprite from a sheet ('ts:3,5'). */
export function icon(scene, x, y, ref, scale = 2) {
  const [key, f] = ref.split(':');
  return scene.add.image(Math.round(x), Math.round(y), key, f).setScale(scale);
}

/** Text with a dark outline. */
export function outlined(scene, x, y, str, { size = 16, color = PALETTE.cream, origin = 0.5, wrap } = {}) {
  return text(scene, x, y, str, { size, color, origin, wrap }).setStroke(PALETTE.ink, size >= 32 ? 6 : 4);
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT / 2, color = PALETTE.gold, ms = 1400) {
  const t = outlined(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 24 }).setDepth(90);
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 300, onComplete: () => t.destroy() });
  return t;
}

/** Number or word that floats up and fades. */
export function floatText(scene, x, y, str, color = PALETTE.cream) {
  const t = outlined(scene, x, y, str, { color }).setDepth(70);
  scene.tweens.add({ targets: t, y: y - 24, alpha: 0, delay: 300, duration: 500, onComplete: () => t.destroy() });
  return t;
}

/** Framed box. */
export function box(scene, x, y, w, h, { fill = PALETTE.indigo, border = PALETTE.ink, inner = PALETTE.lavender } = {}) {
  return panel(scene, x, y, w, h, { fill, border, inner });
}

/** Track open canvas overlays (taps on the scene underneath are ignored while one is open). */
export function overlayOpened(scene, c) {
  scene._overlays = (scene._overlays || 0) + 1;
  c.once('destroy', () => {
    scene._overlays = Math.max(0, (scene._overlays || 1) - 1);
    scene._overlayClosedAt = scene.time.now;
  });
}

/** True while a canvas overlay or an HTML sheet is up (or just closed). */
export function blocked(scene) {
  if ((scene._overlays || 0) > 0) return true;
  if (scene._overlayClosedAt !== undefined && scene.time.now - scene._overlayClosedAt < 200) return true;
  return P.blocking() || !!document.getElementById('howto');
}

/**
 * Modal: title, wrapped body text, buttons [[label, fn, fill, color], ...]. The dim layer eats
 * every tap so nothing falls through. Returns the container (destroy it to close).
 */
export function modal(scene, title, body, buttons, { width = 320, depth = 100 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth);
  overlayOpened(scene, c);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive();
  const bodyText = body ? text(scene, WIDTH / 2, 0, body, { wrap: width - 36, color: PALETTE.cream }) : null;
  const titleText = text(scene, WIDTH / 2, 0, title, { color: PALETTE.gold, wrap: width - 30 });
  const bodyH = bodyText ? bodyText.height + 16 : 0;
  const h = 40 + titleText.height + bodyH + buttons.length * 54 + 6;
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add([dim, box(scene, left, top, width, h)]);
  titleText.setOrigin(0.5, 0).setPosition(WIDTH / 2, top + 18);
  c.add(titleText);
  let y = top + 26 + titleText.height;
  if (bodyText) { bodyText.setOrigin(0.5, 0).setPosition(WIDTH / 2, y); c.add(bodyText); y += bodyH; }
  let done = false;
  buttons.forEach(([label, fn, fill, color], i) => {
    const b = button(scene, WIDTH / 2, y + 24 + i * 54, Math.min(260, width - 40), 44, label, () => {
      if (done) return;
      done = true;
      fn?.(c);
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night });
    c.add(b);
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 100 });
  return c;
}

export function info(scene, title, body, opts = {}) {
  const m = modal(scene, title, body, [['Close', () => m.destroy(), PALETTE.lavender]], opts);
  return m;
}

/** Hull bar with a number on it. Returns { set(hull, max) }. */
export function hullBar(scene, x, y, w, h = 16, depth = 40) {
  const bg = scene.add.rectangle(x, y, w, h, hex(PALETTE.ink)).setOrigin(0, 0.5).setDepth(depth);
  const fill = scene.add.rectangle(x + 2, y, w - 4, h - 4, hex(PALETTE.leaf)).setOrigin(0, 0.5).setDepth(depth);
  const label = outlined(scene, x + w / 2, y, '').setDepth(depth + 1);
  return {
    parts: [bg, fill, label],
    set(v, max) {
      const f = Math.max(0, Math.min(1, v / max));
      fill.width = Math.max(0, (w - 4) * f);
      fill.setFillStyle(hex(f > 0.5 ? PALETTE.leaf : f > 0.25 ? PALETTE.orange : PALETTE.red));
      label.setText(`${Math.max(0, v)}/${max}`);
    },
  };
}
