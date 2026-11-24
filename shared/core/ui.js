import Phaser from 'phaser';
import { PALETTE, hex } from './palette.js';
import { sfx } from './sfx.js';

// BoldPixels is drawn at 16px or multiples of it, which keeps every glyph pixel-sharp.
export const FONT = 'BoldPixels';

export function text(scene, x, y, str, { size = 16, color = PALETTE.cream, origin = 0.5, align = 'center', wrap } = {}) {
  const t = scene.add.text(Math.round(x), Math.round(y), str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    align,
    wordWrap: wrap ? { width: wrap } : undefined,
    lineSpacing: 4,
  });
  if (Array.isArray(origin)) t.setOrigin(origin[0], origin[1]); else t.setOrigin(origin);
  return t;
}

/**
 * Chunky pixel button with a drop shadow that "presses" when tapped.
 * Returns a container with .setLabel(), .setEnabled() and .label.
 */
export function button(scene, x, y, w, h, label, onTap, {
  fill = PALETTE.lavender, color = PALETTE.night, border = PALETTE.night, size = 16, icon, silent = false,
} = {}) {
  const c = scene.add.container(Math.round(x), Math.round(y));
  const shadow = scene.add.rectangle(0, 4, w, h, hex(PALETTE.ink)).setOrigin(0.5);
  const face = scene.add.container(0, 0);
  const edge = scene.add.rectangle(0, 0, w, h, hex(border)).setOrigin(0.5);
  const body = scene.add.rectangle(0, 0, w - 6, h - 6, hex(fill)).setOrigin(0.5);
  const shine = scene.add.rectangle(0, -h / 2 + 5, w - 10, 2, 0xffffff, 0.35).setOrigin(0.5);
  const lbl = text(scene, icon ? 12 : 0, 0, label, { size, color });
  face.add([edge, body, shine, lbl]);
  if (icon) { icon.setPosition(-w / 2 + 24, 0); face.add(icon); lbl.setX(16); }
  c.add([shadow, face]);
  c.label = lbl;
  c.body = body;
  c.face = face;

  let enabled = true;
  c.setSize(w, h + 4);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { if (enabled) face.y = 3; });
  c.on('pointerout', () => { face.y = 0; });
  c.on('pointerup', () => {
    if (!enabled || face.y === 0) return;
    face.y = 0;
    if (!silent) sfx('tap'); // silent: the caller plays its own sound
    onTap?.();
  });
  c.setLabel = (s) => { lbl.setText(s); return c; };
  c.setEnabled = (on) => { enabled = on; c.setAlpha(on ? 1 : 0.45); return c; };
  return c;
}

/** Simple framed panel (border + fill). */
export function panel(scene, x, y, w, h, { fill = PALETTE.indigo, border = PALETTE.ink, inner = PALETTE.lavender } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(hex(border)).fillRect(x, y, w, h);
  g.fillStyle(hex(inner)).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(hex(fill)).fillRect(x + 5, y + 5, w - 10, h - 10);
  return g;
}

/** Cut named frames out of an already-loaded sheet: frames = { name: [x, y, w, h] }. */
export function addFrames(scene, textureKey, frames) {
  const tex = scene.textures.get(textureKey);
  for (const [name, [x, y, w, h]] of Object.entries(frames)) {
    if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  }
}

/** Fade the camera out, then run fn (used for every scene change). */
export function fadeTo(scene, fn, ms = 150) {
  scene.cameras.main.fadeOut(ms, 28, 22, 24);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, fn);
}
