import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';

export { PALETTE, hex, text, button, panel, WIDTH, HEIGHT, Phaser };

// Darkhold's own colours, picked from the MAS Darkness pack.
export const DARK = {
  void: '#08070d',
  navy: '#202141',
  blue: '#3b4178',
  purple: '#7c5998',
  rose: '#b9848f',
  sand: '#e3bf8f',
  bone: '#f3e4d2',
  flame: '#d88038',
  blood: '#a13d3b',
};

/** Go to another scene with a quick fade. Only the first change from a screen counts. */
export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.events.once('shutdown', () => { scene._leaving = false; });
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function setBackground(scene, color = DARK.void) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(160);
  document.body.style.background = color;
}

/** Pause the scene and show the How to play sheet. */
export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  showHowTo(RULES, () => scene.scene.resume());
}

/** Gold ? button (top right by default). */
export function helpButton(scene, x = WIDTH - 24, y = 26) {
  return button(scene, x, y, 40, 40, '?', () => openHowTo(scene), { fill: PALETTE.gold }).setDepth(60);
}

/** Back button ('<'), top left by default. */
export function backButton(scene, onTap, x = 24, y = 26) {
  return button(scene, x, y, 40, 40, '<', onTap, { fill: PALETTE.lavender }).setDepth(60);
}

/** Text with a dark outline. */
export function outlined(scene, x, y, str, { size = 16, color = PALETTE.cream, origin = 0.5, wrap, align } = {}) {
  return text(scene, x, y, str, { size, color, origin, wrap, align }).setStroke(DARK.void, size >= 32 ? 6 : 4);
}

/** Short message that pops up and fades. */
export function toast(scene, msg, y = HEIGHT / 2, color = PALETTE.gold) {
  const t = outlined(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 32 }).setDepth(400).setScrollFactor(0);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 300, onComplete: () => t.destroy() });
  return t;
}

/** An item icon (frame 'i:c,r' of the Items sheet). */
export function itemImage(scene, x, y, icon, scale = 2) {
  const img = scene.add.image(x, y, 'items', `i:${icon.spr[0]},${icon.spr[1]}`).setScale(scale);
  if (icon.tint) img.setTint(icon.tint);
  return img;
}

/** A creature sprite (frame 'c:c,r' of the Creatures sheet). */
export function creature(scene, x, y, spr, scale = 2) {
  return scene.add.image(x, y, 'cre', spr === 'king' ? 'c:king' : `c:${spr[0]},${spr[1]}`).setScale(scale);
}

/** Track open overlays so the map ignores taps while one is up. */
export function overlayOpened(scene, c) {
  scene._overlays = (scene._overlays || 0) + 1;
  c.once('destroy', () => { scene._overlays = Math.max(0, (scene._overlays || 1) - 1); scene.events.emit('overlayClosed'); });
}
export const overlayOpen = (scene) => (scene._overlays || 0) > 0;

/**
 * Modal over everything: title, wrapped body, optional art/content, buttons
 * [[label, fn(container), fill, color], ...]. Returns the container (destroy it to close).
 * The dimmed backdrop swallows taps, so nothing underneath can be hit.
 */
export function modal(scene, title, body, buttons, { width = 320, art, content, disabled = [], depth = 300, buttonH = 44 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  overlayOpened(scene, c);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive();
  const bodyText = body ? text(scene, WIDTH / 2, 0, body, { wrap: width - 36, color: PALETTE.cream }) : null;
  const artH = art ? 72 : 0;
  const bodyH = bodyText ? bodyText.height + 16 : 0;
  const contentH = content ? content.h + 12 : 0;
  const h = 62 + artH + bodyH + contentH + buttons.length * (buttonH + 10) + 6;
  const top = Math.max(8, Math.round((HEIGHT - h) / 2));
  const left = Math.round((WIDTH - width) / 2);
  c.add([dim, panel(scene, left, top, width, h, { fill: DARK.navy, inner: DARK.purple, border: PALETTE.ink })]);
  c.add(text(scene, WIDTH / 2, top + 28, title, { size: 16, color: PALETTE.gold, wrap: width - 30 }));
  let y = top + 52;
  if (art) {
    const a = art.creature ? creature(scene, WIDTH / 2, y + 32, art.creature, art.scale || 4) : itemImage(scene, WIDTH / 2, y + 32, art.icon, art.scale || 4);
    c.add(a); y += artH;
  }
  if (bodyText) { bodyText.setOrigin(0.5, 0).setPosition(WIDTH / 2, y); c.add(bodyText); y += bodyH; }
  if (content) { content.setPosition(Math.round((WIDTH - content.w) / 2), y); c.add(content); y += contentH; }
  c.buttons = buttons.map(([label, fn, fill, color], i) => {
    const b = button(scene, WIDTH / 2, y + buttonH / 2 + 2 + i * (buttonH + 10), Math.min(260, width - 40), buttonH, label, () => fn?.(c), {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    });
    if (disabled.includes(i)) b.setEnabled(false);
    c.add(b);
    return b;
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 110 });
  return c;
}

/** Info popup with a single Close button. */
export function info(scene, title, body, opts = {}) {
  const m = modal(scene, title, body, [['Close', () => m.destroy(), PALETTE.lavender]], opts);
  return m;
}

/** A horizontal bar with a label inside. Returns { set(frac, label) }. */
export function bar(scene, x, y, w, h, fill, depth = 50) {
  const bg = scene.add.rectangle(x, y, w, h, hex(PALETTE.ink)).setOrigin(0).setDepth(depth);
  const back = scene.add.rectangle(x + 2, y + 2, w - 4, h - 4, hex(DARK.navy)).setOrigin(0).setDepth(depth);
  const fg = scene.add.rectangle(x + 2, y + 2, w - 4, h - 4, hex(fill)).setOrigin(0).setDepth(depth);
  const label = outlined(scene, x + w / 2, y + h / 2, '', { size: 16 }).setDepth(depth + 1);
  return {
    set(frac, str, color) {
      fg.width = Math.max(0, Math.round((w - 4) * Math.max(0, Math.min(1, frac))));
      if (color) fg.setFillStyle(hex(color));
      label.setText(str);
    },
    objects: [bg, back, fg, label],
  };
}
