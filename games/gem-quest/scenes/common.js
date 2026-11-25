import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import { RULES } from '../rules.js';

export { Phaser, PALETTE, hex, text, button, panel, WIDTH, HEIGHT, sfx };

// Gem colours for bars and chips: red, blue, green, yellow, skull, coin.
export const GEM_COLORS = ['#c8423e', '#6f86d6', '#6c9c50', '#e3d245', '#f9f5ef', '#f0b040'];
export const GEM_FRAMES = ['gem0', 'gem1', 'gem2', 'gem3', 'skull', 'coin', 'star'];

/** Go to another scene with a quick fade (ignores a second tap while leaving). */
export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.input.enabled = false;
  scene.events.once('shutdown', () => { scene._leaving = false; });
  fadeTo(scene, () => scene.scene.start(key, data));
}

/** Ignore taps for a moment (after a tap rebuilds the screen or closes a popup). */
export function tapCooldown(scene, ms = 250) {
  scene.input.enabled = false;
  const back = () => { if (!scene._leaving) scene.input.enabled = true; };
  scene.time.delayedCall(ms, back);
}

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  showHowTo(RULES, () => { scene.scene.resume(); tapCooldown(scene, 200); });
}

/**
 * Top bar used on every screen: Back on the left, a title, the gold ? on the right.
 * Returns the container.
 */
export function header(scene, title, onBack, { color = PALETTE.cream } = {}) {
  const c = scene.add.container(0, 0).setDepth(60);
  c.add(scene.add.rectangle(0, 0, WIDTH, 44, hex(PALETTE.ink)).setOrigin(0));
  if (onBack) c.add(button(scene, 38, 22, 64, 36, '< Back', onBack, { fill: PALETTE.lavender }));
  c.add(text(scene, WIDTH / 2, 22, title, { color }));
  c.add(button(scene, WIDTH - 26, 22, 44, 36, '?', () => openHowTo(scene), { fill: PALETTE.gold }));
  return c;
}

/** An atlas icon ('sp:4,4', 'bld:1,5', ...). */
export function icon(scene, x, y, ref, scale = 2) {
  return scene.add.image(Math.round(x), Math.round(y), 'gq', `i:${ref}`).setScale(scale);
}

/** An animated unit (hero or monster), feet at y. */
export function unit(scene, x, y, ref, scale = 4, flip = false) {
  const s = scene.add.sprite(Math.round(x), Math.round(y), 'gq', `u:${ref}:0`).setScale(scale).setOrigin(0.5, 1).setFlipX(flip);
  s.animBase = ref;
  if (scene.anims.exists(`${ref}:idle`)) s.play({ key: `${ref}:idle`, startFrame: Math.floor(Math.random() * 4) });
  return s;
}

export const unitSize = (ref) => (ref.startsWith('boss') ? 24 : 16);

/** Play attack / hit once, then go back to idle. */
export function playOnce(sprite, name) {
  if (!sprite?.active || !sprite.scene) return;
  const key = `${sprite.animBase}:${name}`;
  if (!sprite.scene.anims.exists(key)) return;
  sprite.play(key);
  sprite.once('animationcomplete', () => { if (sprite.active) sprite.play(`${sprite.animBase}:idle`); });
}

export function outlined(scene, x, y, str, { size = 16, color = PALETTE.cream, origin = 0.5, wrap, align } = {}) {
  return text(scene, x, y, str, { size, color, origin, wrap, align }).setStroke(PALETTE.ink, size >= 32 ? 6 : 4);
}

/** Number that floats up and fades. */
export function floatText(scene, x, y, str, color = PALETTE.cream, size = 32) {
  const t = outlined(scene, x, y, str, { size, color }).setDepth(70);
  scene.tweens.add({ targets: t, y: y - 32, alpha: 0, delay: 400, duration: 450, onComplete: () => t.destroy() });
  return t;
}

/** Short message that pops up and fades. */
export function toast(scene, msg, y = HEIGHT / 2, color = PALETTE.gold, ms = 1100) {
  const t = outlined(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 32 }).setDepth(90);
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 300, onComplete: () => t.destroy() });
  return t;
}

export function box(scene, x, y, w, h, opts) { return panel(scene, x, y, w, h, opts); }

/**
 * Popup over everything. buttons: [[label, fn(close), fill, color], ...] stacked, or
 * opts.row = true to lay them side by side. opts.content: a container with .w and .h.
 * Taps never reach anything underneath, and the screen ignores taps for a moment after a button
 * so a double tap can't hit what was under the popup.
 */
export function modal(scene, title, body, buttons, { width = 316, content, row = false, art } = {}) {
  const c = scene.add.container(0, 0).setDepth(100);
  scene._modals = (scene._modals || 0) + 1;
  c.once('destroy', () => { scene._modals = Math.max(0, scene._modals - 1); });
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive();
  const bodyText = body ? text(scene, WIDTH / 2, 0, body, { wrap: width - 36 }) : null;
  const artH = art ? 76 : 0;
  const bodyH = bodyText ? bodyText.height + 14 : 0;
  const contentH = content ? content.h + 12 : 0;
  const btnH = buttons.length ? (row ? 52 : buttons.length * 52) : 0;
  const h = 58 + artH + bodyH + contentH + btnH + 8;
  const top = Math.max(4, Math.round((HEIGHT - h) / 2));
  const left = Math.round((WIDTH - width) / 2);
  c.add([dim, box(scene, left, top, width, h)]);
  c.add(text(scene, WIDTH / 2, top + 28, title, { color: PALETTE.gold, wrap: width - 30 }));
  let y = top + 50;
  if (art) { c.add(art.make(WIDTH / 2, y + 36)); y += artH; }
  if (bodyText) { bodyText.setOrigin(0.5, 0).setPosition(WIDTH / 2, y); c.add(bodyText); y += bodyH; }
  if (content) { content.setPosition(left + Math.round((width - content.w) / 2), y); c.add(content); y += contentH; }
  const close = () => { if (c.active) c.destroy(); };
  const btns = [];
  buttons.forEach(([label, fn, fill, color], i) => {
    const n = buttons.length;
    const bw = row ? Math.floor((width - 24 - (n - 1) * 8) / n) : Math.min(260, width - 40);
    const bx = row ? left + 12 + bw / 2 + i * (bw + 8) : WIDTH / 2;
    const by = row ? y + 24 : y + 24 + i * 52;
    const b = button(scene, bx, by, bw, 44, label, () => { tapCooldown(scene); fn?.(close); }, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    });
    btns.push(b);
    c.add(b);
  });
  c.buttons = btns;
  c.close = close;
  c.top = top;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

export function info(scene, title, body, opts = {}) {
  return modal(scene, title, body, [['Close', (close) => close(), PALETTE.lavender]], opts);
}

/** Horizontal bar: returns { c, set(value, max, label) }. */
export function bar(scene, x, y, w, h, color, { label = true } = {}) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, hex(PALETTE.ink)).setOrigin(0, 0.5);
  const fill = scene.add.rectangle(2, 0, w - 4, h - 4, hex(color)).setOrigin(0, 0.5);
  const t = label ? outlined(scene, w / 2, 0, '') : null;
  c.add([bg, fill]);
  if (t) c.add(t);
  return {
    c, fill, t,
    set(v, max, lbl) {
      fill.width = Math.max(0, (w - 4) * Math.max(0, Math.min(1, v / max)));
      if (t) t.setText(lbl ?? `${v}/${max}`);
    },
  };
}

/** Gem image for a board cell or a chip. */
export function gemFrame(c) { return GEM_FRAMES[c] ?? 'gem0'; }

/** Sound toggle button label helper. */
export function soundLabel(muted) { return muted ? 'Sound off' : 'Sound on'; }
