import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { writeSave } from '../save.js';
import { blocking } from './panels.js';

export { WIDTH, HEIGHT };

/** The journey in progress, shared by the scenes. */
export const store = { state: null, daily: null };

export function persist(which = 'auto') { if (store.state) writeSave(store.state, which); }

/** Fix an object (and a container's children) to the screen so its hit area ignores the camera. */
export function pin(o) {
  o.setScrollFactor(0);
  if (o.list) o.list.forEach(pin);
  return o;
}

export const modalOpen = (scene) => !!scene.__modal?.active;
/** Any popup (Phaser modal, HTML panel, How to Play) that should swallow taps. */
export const busyUi = (scene) => modalOpen(scene) || blocking() || !!document.getElementById('howto');

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack, { depth = 5000 } = {}) {
  const y = 26;
  const bg = scene.add.rectangle(0, 0, WIDTH, 52, hex(PALETTE.night)).setOrigin(0);
  const line = scene.add.rectangle(0, 52, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0);
  const items = [bg, line];
  if (onBack) items.push(button(scene, 30, y, 48, 40, '<', () => { if (!busyUi(scene)) onBack(); }, { size: 32, fill: PALETTE.cream }));
  const t = text(scene, WIDTH / 2, y, title, { size: title.length > 13 ? 16 : 32, color: PALETTE.cream });
  fit(t, 220);
  items.push(t);
  items.push(button(scene, WIDTH - 30, y, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold }));
  for (const o of items) pin(o).setDepth(depth + 1);
  bg.setDepth(depth); line.setDepth(depth);
  return t;
}

export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  const wasPaused = scene.scene.isPaused();
  if (!wasPaused) scene.scene.pause();
  showHowTo(RULES, () => { if (!wasPaused) scene.scene.resume(); });
}

export function go(scene, key, data) {
  if (scene.__leaving) return;
  scene.__leaving = true;
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = PALETTE.night;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = 470, color = PALETTE.gold) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 48 }).setDepth(7001).setScrollFactor(0);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.88).setDepth(7000).setScrollFactor(0);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1700, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings, or { text, color }) and buttons [[label, fn, fill?, color?]].
 * Every button closes the modal first, so nothing can fire twice.
 */
export function modal(scene, title, lines, buttons, { width = 316, wrap = 276 } = {}) {
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
  const h = Math.min(HEIGHT - 20, 72 + textH + btnH + 10);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h));
  const tt = text(scene, WIDTH / 2, top + 28, title, { size: title.length > 14 ? 16 : 32, color: PALETTE.gold });
  fit(tt, width - 24);
  c.add(tt);
  let y = top + 54;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 6; }
  let done = false;
  buttons.forEach(([label, fn, fill, color], i) => {
    c.add(button(scene, WIDTH / 2, y + 26 + i * 56, Math.min(250, width - 40), 46, label, () => {
      if (done) return;
      done = true;
      c.close();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night }));
  });
  c.close = () => { if (c.active) { c.destroy(); scene.__modalClosedAt = Date.now(); } };
  pin(c);
  scene.__modal = c;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 110 });
  return c;
}

export function hpColor(frac) { return frac > 0.5 ? '#6cbf4a' : frac > 0.2 ? '#e3b23c' : '#d84848'; }

/** Bar drawn into a Graphics object (call again to update). */
export function drawBar(g, x, y, w, h, frac, color) {
  g.clear();
  g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, w, h);
  g.fillStyle(0x3a3a3a).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(hex(color)).fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac)))), h - 2);
}

/** Fit a text object to a width by scaling it down. */
export function fit(t, w) { t.setScale(1); if (t.width > w) t.setScale(w / t.width); return t; }

export const sleep = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

export function fmtTime(ms) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

