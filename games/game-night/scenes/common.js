import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { TABLES } from '../tables.js';
import { down, hit, stick, hideWhilePad } from '../padkit.js';
import { skillLabel } from '../adaptive.js';

/** Top bar used by every Game Night screen: back button + title. */
export function header(scene, title, onBack) {
  button(scene, 34, 34, 52, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, 34, title, { size: 32, color: PALETTE.cream });
  const rules = RULES[scene.scene.key];
  if (rules) button(scene, WIDTH - 34, 34, 52, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

/** Pause the scene and show its How to play sheet. */
export function openHowTo(scene) {
  const rules = RULES[scene.scene.key];
  if (!rules || document.getElementById('howto')) return;
  scene.scene.pause();
  const table = TABLES.find((t) => t.scene === scene.scene.key);
  const sections = [...rules.sections];
  if (table?.levels) {
    sections.push({
      heading: 'The computer adapts to you',
      text: `The CPU is at level ${skillLabel(table.id)} of 10 for you right now. Win and it plays better next time; lose and it eases off, so games stay close. It only changes how well the computer plays - dice, deals and shuffles are always fair. Reset it from the game's menu tile.`,
    });
  }
  showHowTo({ ...rules, sections }, () => scene.scene.resume());
}

/** Go to another scene with a quick fade. */
export function go(scene, key, data) {
  // A second tap during the fade would queue a second scene start.
  if (scene.cameras.main.fadeEffect.isRunning) return;
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
  // Above everything in the scene, including hold-buttons (depth 60-61) used by the arcade games.
  const c = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.6).setOrigin(0).setInteractive();
  // Long titles wrap onto a second line instead of running past the panel.
  const head = text(scene, WIDTH / 2, 0, title, { size: 32, color: PALETTE.gold, wrap: 268 });
  const extra = Math.max(0, head.height - 40);
  const h = 120 + extra + lines.length * 24 + buttons.length * 64;
  const top = Math.round((HEIGHT - h) / 2);
  const box = panel(scene, 30, top, 300, h);
  head.setY(Math.round(top + 40 + extra / 2));
  c.add([dim, box, head]);
  lines.forEach((l, i) => c.add(text(scene, WIDTH / 2, top + 80 + extra + i * 24, l, { color: PALETTE.cream, wrap: 280 })));
  let used = false;
  buttons.forEach(([label, fn, fill, color], i) => {
    // One press per popup: a quick double tap can't fire two buttons (or one twice).
    const once = () => {
      if (used) return;
      used = true;
      // Swallow taps for a moment so a double tap doesn't land on the board underneath.
      const shield = scene.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0).setDepth(101).setInteractive();
      scene.time.delayedCall(300, () => shield.destroy());
      fn();
    };
    c.add(button(scene, WIDTH / 2, top + 80 + extra + lines.length * 24 + 24 + i * 64, 220, 48, label, once, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    }));
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
  return c;
}

/** Short message that pops up and fades away, on a dark plate so it reads on any background. */
export function toast(scene, msg, y = HEIGHT - 60) {
  // A newer message replaces one still showing in the same spot instead of printing over it.
  const live = (scene.__toasts ||= new Map());
  const old = live.get(y);
  if (old?.active) { scene.tweens.killTweensOf(old); old.destroy(); }
  const t = text(scene, WIDTH / 2, y, msg, { color: PALETTE.gold, wrap: 320 });
  const plate = scene.add.rectangle(WIDTH / 2, y, Math.ceil(t.width) + 16, Math.ceil(t.height) + 8, hex(PALETTE.ink), 0.8);
  const c = scene.add.container(0, 0, [plate, t]).setDepth(40);
  live.set(y, c);
  scene.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 300, onComplete: () => c.destroy() });
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
  scene.input.on('pointerdown', (p, over) => {
    if (over.length) { start = null; return; }   // on a button or under a popup
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
export function holdButton(scene, x, y, w, h, label, { fill = PALETTE.lavender, color = PALETTE.night, size = 16, pad = [] } = {}) {
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
  zone.padSkip = true; // the controller presses these with its own buttons (pad), not the menu frame
  if (pad.length) hideWhilePad(scene, c);
  return {
    get isDown() { return state.isDown || pad.some((n) => down(n)); },
    wasPressed() { const v = state.pressed || pad.some((n) => hit(n)); state.pressed = false; return v; },
    container: c,
  };
}

/**
 * Set a one-line HUD from parts, keeping it on screen: tighter spacing first, then the
 * trailing parts are dropped (they're the least important, e.g. "Best").
 */
export function fitLine(t, parts, maxW = 348) {
  for (let keep = parts.length; keep >= 1; keep--) {
    for (const gap of ['   ', '  ']) {
      t.setText(parts.slice(0, keep).join(gap));
      if (t.width <= maxW) return;
    }
  }
}

/**
 * An arcade table that reads the controller itself: the gold menu frame only works in its popups
 * (game-over and pause), and Start / B there go back to the menu.
 */
export function arcadePad(scene) {
  scene.padNav = 'modal';
  scene.padModalDepth = 90;
}

export { stick, hit, down, hideWhilePad };
