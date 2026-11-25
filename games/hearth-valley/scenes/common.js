import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { award } from '../../../shared/core/trophies.js';
import { RULES } from '../rules.js';
import { saveGame } from '../save.js';
import { awards } from '../logic/game.js';
import { ATLAS } from '../art.js';

export { WIDTH, HEIGHT };
export const GAME_ID = 'hearth-valley';

/** The farm in progress, shared by the scenes. */
export const store = { state: null };

export function persist() { if (store.state) saveGame(store.state); }

/** Hand any trophies the rules earned to the shared trophy shelf (shows a toast). */
export function flushAwards() { while (awards.length) award(GAME_ID, awards.shift()); }

/** Fix an object (and a container's children) to the screen so its hit area ignores the camera. */
export function pin(o) {
  o.setScrollFactor(0);
  if (o.list) o.list.forEach(pin);
  return o;
}

export const modalOpen = (scene) => !!scene.__modal?.active;

export function img(scene, x, y, frame, scale = 2) {
  return scene.add.image(Math.round(x), Math.round(y), ATLAS, frame).setScale(scale);
}

/** Top bar: back button, title text (one or two lines), gold "?" How to Play button. */
export function header(scene, title, onBack, { depth = 5000 } = {}) {
  const bg = scene.add.rectangle(0, 0, WIDTH, 52, hex(PALETTE.night)).setOrigin(0);
  const line = scene.add.rectangle(0, 52, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0);
  const items = [bg, line];
  if (onBack) items.push(button(scene, 30, 26, 48, 40, '<', onBack, { size: 32, fill: PALETTE.cream }));
  const t = text(scene, WIDTH / 2, 26, title, { size: title.length > 14 ? 16 : 32, color: PALETTE.cream });
  fit(t, 228);
  items.push(t);
  items.push(button(scene, WIDTH - 30, 26, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold }));
  for (const o of items) pin(o).setDepth(depth + 1);
  bg.setDepth(depth); line.setDepth(depth);
  return t;
}

export function openHowTo(scene, onClose) {
  if (document.getElementById('howto')) return;
  const wasActive = scene.scene.isActive();
  if (wasActive) scene.scene.pause();
  showHowTo(RULES, () => { if (wasActive) scene.scene.resume(); onClose?.(); });
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

/** Short message that pops up and fades away. */
export function toast(scene, msg, { y = 420, color = PALETTE.cream, ms = 1700 } = {}) {
  if (!msg) return null;
  scene.__toasts = (scene.__toasts || []).filter((t) => t.active);
  // stack upward if others are still showing
  const yy = y - scene.__toasts.length * 34;
  const t = text(scene, WIDTH / 2, yy, msg, { color, wrap: WIDTH - 40 }).setDepth(7001).setScrollFactor(0);
  const bg = scene.add.rectangle(WIDTH / 2, yy, Math.min(WIDTH - 16, t.width + 24), t.height + 10, hex(PALETTE.ink), 0.85).setDepth(7000).setScrollFactor(0);
  scene.__toasts.push(t);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: ms, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings or { text, color }) and buttons [[label, fn, fill?]].
 * Buttons close the modal first. Returns the container (call .close()).
 */
export function modal(scene, title, lines, buttons, { width = 316, wrap = 280, onClose } = {}) {
  scene.__modal?.close?.();
  const c = scene.add.container(0, 0).setDepth(8000).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 6, 0);
  const btnH = buttons.length * 56;
  const h = Math.min(HEIGHT - 20, 76 + textH + btnH + 10);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h, { fill: PALETTE.night, inner: PALETTE.sand }));
  const tt = text(scene, WIDTH / 2, top + 30, title, { size: title.length > 15 ? 16 : 32, color: PALETTE.gold });
  fit(tt, width - 30);
  c.add(tt);
  let y = top + 58;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 6; }
  let closed = false;
  c.buttons = [];
  buttons.forEach(([label, fn, fill, color], i) => {
    c.buttons.push({ label, x: WIDTH / 2, y: y + 26 + i * 56 });
    c.add(button(scene, WIDTH / 2, y + 26 + i * 56, Math.min(260, width - 40), 46, label, () => {
      if (closed) return;
      c.close();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night }));
  });
  c.close = () => {
    if (closed) return;
    closed = true;
    scene.__modalClosedAt = Date.now();
    if (c.active) c.destroy();
    onClose?.();
  };
  pin(c);
  scene.__modal = c;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Fit a text object to a width by scaling it down. */
export function fit(t, w) { t.setScale(1); if (t.width > w) t.setScale(w / t.width); return t; }

export function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
