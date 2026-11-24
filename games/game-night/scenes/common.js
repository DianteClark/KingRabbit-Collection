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
  buttons.forEach(([label, fn, fill, color], i) => {
    c.add(button(scene, WIDTH / 2, top + 80 + lines.length * 24 + 24 + i * 64, 220, 48, label, fn, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
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

/** On-screen arrow pad. onDir('up'|'down'|'left'|'right'). Returns the container. */
export function dpad(scene, x, y, onDir, { size = 56, gap = 4 } = {}) {
  const c = scene.add.container(0, 0);
  const s = size + gap;
  const spec = [['up', 0, -s, '^'], ['down', 0, s, 'v'], ['left', -s, 0, '<'], ['right', s, 0, '>']];
  for (const [dir, dx, dy, label] of spec) {
    c.add(button(scene, x + dx, y + dy, size, size, label, () => onDir(dir), { size: 32 }));
  }
  return c;
}

/** Swipe detection inside an area. onSwipe('up'|'down'|'left'|'right'); onTap(x, y) for short taps. */
export function swipeArea(scene, rect, { onSwipe, onTap, min = 24 }) {
  let start = null;
  scene.input.on('pointerdown', (p) => {
    if (p.x >= rect.x && p.x < rect.x + rect.w && p.y >= rect.y && p.y < rect.y + rect.h) start = { x: p.x, y: p.y };
  });
  scene.input.on('pointerup', (p) => {
    if (!start) return;
    const dx = p.x - start.x; const dy = p.y - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) { onTap?.(p.x, p.y); return; }
    if (Math.abs(dx) > Math.abs(dy)) onSwipe?.(dx > 0 ? 'right' : 'left');
    else onSwipe?.(dy > 0 ? 'down' : 'up');
  });
}

/**
 * A button you hold down (for action games). Returns { isDown, wasPressed() }.
 * Uses its own pointer tracking so several can be held at once (multi-touch).
 */
export function holdButton(scene, x, y, w, h, label, { fill = PALETTE.lavender, color = PALETTE.night, size = 16 } = {}) {
  const c = scene.add.container(x, y).setDepth(60);
  const shadow = scene.add.rectangle(0, 4, w, h, hex(PALETTE.ink));
  const edge = scene.add.rectangle(0, 0, w, h, hex(PALETTE.night));
  const body = scene.add.rectangle(0, 0, w - 6, h - 6, hex(fill), 0.9);
  const lbl = text(scene, 0, 0, label, { size, color });
  const face = scene.add.container(0, 0, [edge, body, lbl]);
  c.add([shadow, face]);
  const state = { isDown: false, pressed: false, pointers: new Set() };
  const zone = scene.add.zone(x, y, w + 8, h + 12).setInteractive().setDepth(61);
  const update = () => { state.isDown = state.pointers.size > 0; face.y = state.isDown ? 3 : 0; };
  zone.on('pointerdown', (p) => { state.pointers.add(p.id); state.pressed = true; update(); });
  zone.on('pointerup', (p) => { state.pointers.delete(p.id); update(); });
  zone.on('pointerout', (p) => { state.pointers.delete(p.id); update(); });
  return {
    get isDown() { return state.isDown; },
    wasPressed() { const v = state.pressed; state.pressed = false; return v; },
    container: c,
  };
}
