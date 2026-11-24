import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';
import { saveGame } from '../save.js';
import { petFrames } from '../art.js';
import { TYPE_INFO } from '../logic/types.js';

export { WIDTH, HEIGHT };

/** The journey in progress, shared by the scenes. */
export const store = { state: null };

export const LCD = { light: '#e0e9c4', mid: '#9aa57c', dark: '#252525', shade: '#c9d3ab' };

export function persist() { if (store.state) saveGame(store.state); }

/** Fix an object (and a container's children) to the screen so its hit area ignores the camera. */
export function pin(o) {
  o.setScrollFactor(0);
  if (o.list) o.list.forEach(pin);
  return o;
}

/** True while a Phaser modal from modal() is showing in this scene. */
export const modalOpen = (scene) => !!scene.__modal?.active;

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack, { y = 26, depth = 5000 } = {}) {
  const bg = scene.add.rectangle(0, 0, WIDTH, 52, hex(PALETTE.night)).setOrigin(0).setScrollFactor(0).setDepth(depth);
  const line = scene.add.rectangle(0, 52, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setScrollFactor(0).setDepth(depth);
  const items = [bg, line];
  if (onBack) items.push(button(scene, 30, y, 48, 36, '<', onBack, { size: 32, fill: PALETTE.cream }));
  const t = text(scene, WIDTH / 2, y, title, { size: title.length > 14 ? 16 : 32, color: PALETTE.cream });
  fit(t, 228);
  items.push(t);
  items.push(button(scene, WIDTH - 30, y, 48, 36, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold }));
  for (const o of items) pin(o).setDepth(depth + 1);
  bg.setDepth(depth); line.setDepth(depth);
  return t;
}

export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  const sections = [...RULES.sections];
  sections.splice(sections.length - 2, 0, {
    heading: 'The tamers adapt to you',
    text: `Computer tamers are at level ${skillLabel()} of 10 for you right now. Beat them and they play smarter next time (better move choices, switching out of bad match-ups, timing their potions); lose and they ease off. Their pets, levels and items never change, and luck is never touched.`,
  });
  showHowTo({ ...RULES, sections }, () => scene.scene.resume());
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
export function toast(scene, msg, y = HEIGHT - 190, color = PALETTE.gold) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 40 }).setDepth(7001).setScrollFactor(0);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.85).setDepth(7000).setScrollFactor(0);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1600, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings, or { text, color }) and buttons [[label, fn, fill?]].
 * Returns the container (call .close()).
 */
export function modal(scene, title, lines, buttons, { width = 316, wrap = 280 } = {}) {
  const c = scene.add.container(0, 0).setDepth(8000).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 6, 0);
  const btnH = buttons.length * 58;
  const h = Math.min(HEIGHT - 20, 76 + textH + btnH + 12);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h));
  c.add(text(scene, WIDTH / 2, top + 30, title, { size: title.length > 15 ? 16 : 32, color: PALETTE.gold }));
  let y = top + 58;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 6; }
  buttons.forEach(([label, fn, fill, color], i) => {
    c.add(button(scene, WIDTH / 2, y + 26 + i * 58, Math.min(240, width - 40), 46, label, () => { c.close(); fn?.(); }, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    }));
  });
  c.close = () => { if (c.active) c.destroy(); };
  pin(c);
  scene.__modal = c;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** A pet image. frame: mood frame index (clamped to what the species has). */
export function petImage(scene, x, y, sp, scale = 4, frame = 0) {
  const f = Math.min(frame, petFrames(sp) - 1);
  return scene.add.image(Math.round(x), Math.round(y), `pet_${sp}`, f).setScale(scale);
}

export function setPetFrame(img, sp, frame) {
  img.setTexture(`pet_${sp}`, Math.min(frame, petFrames(sp) - 1));
}

/** Small coloured type label. */
export function typeChip(scene, x, y, type, { origin = 0 } = {}) {
  const info = TYPE_INFO[type];
  const t = text(scene, 0, 0, info.name.toUpperCase(), { size: 16, color: PALETTE.cream });
  const w = t.width + 10;
  const c = scene.add.container(Math.round(x - origin * w), Math.round(y));
  const bg = scene.add.rectangle(0, 0, w, 20, hex(info.color)).setOrigin(0, 0.5).setStrokeStyle(2, hex(PALETTE.ink));
  t.setPosition(w / 2, 0);
  c.add([bg, t]);
  c.width = w;
  return c;
}

export function hpColor(frac) { return frac > 0.5 ? '#5fbf4a' : frac > 0.2 ? '#e3b23c' : '#d84848'; }

/** HP bar drawn into a Graphics object (call again to update). */
export function drawBar(g, x, y, w, h, frac, color) {
  g.clear();
  g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, w, h);
  g.fillStyle(0x3a3a3a).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(hex(color)).fillRect(x + 2, y + 2, Math.max(0, Math.round((w - 4) * Math.max(0, Math.min(1, frac)))), h - 4);
}

/** Fit a text object to a width by scaling it down. */
export function fit(t, w) { if (t.width > w) t.setScale(w / t.width); return t; }
