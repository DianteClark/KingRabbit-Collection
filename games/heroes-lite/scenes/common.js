import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';
import { sprite, RES_ICON, unitFrame } from '../frames.js';
import { CREATURES } from '../logic/data.js';

export { WIDTH, HEIGHT };

/** Live game shared between scenes (the adventure state plus hand-offs between scenes). */
export const store = { state: null, battleDone: null, townDone: null };

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack, { y = 26 } = {}) {
  if (onBack) button(scene, 30, y, 48, 36, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, y, title, { size: title.length > 16 ? 16 : 32, color: PALETTE.cream });
  button(scene, WIDTH - 30, y, 48, 36, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  const sections = [...RULES.sections];
  sections.splice(sections.length - 2, 0, {
    heading: 'The computer adapts to you',
    text: `The enemy is at level ${skillLabel()} of 10 for you right now. Win and it plays smarter next time (it attacks at the right moment, builds better and fights with more cunning); lose and it eases off. It never gets extra gold or troops.`,
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
export function toast(scene, msg, y = HEIGHT - 120, color = PALETTE.gold) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 40 }).setDepth(81);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.85).setDepth(80);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1500, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings, or { text, color }) and buttons [[label, fn, fill?]].
 * opts.content(container, top) can add custom objects. Returns the container (call .close()).
 */
export function modal(scene, title, lines, buttons, { width = 316, extra = 0, content, wrap = 280 } = {}) {
  const c = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  // Measure wrapped text first.
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 6, 0);
  const btnH = buttons.length * 58;
  const h = Math.min(HEIGHT - 20, 76 + textH + extra + btnH + 12);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h));
  c.add(text(scene, WIDTH / 2, top + 30, title, { size: title.length > 15 ? 16 : 32, color: PALETTE.gold }));
  let y = top + 58;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 6; }
  if (content) content(c, y);
  y += extra;
  buttons.forEach(([label, fn, fill, color], i) => {
    c.add(button(scene, WIDTH / 2, y + 26 + i * 58, Math.min(240, width - 40), 46, label, () => { c.close(); fn?.(); }, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    }));
  });
  c.close = () => { if (c.active) c.destroy(); };
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Row of resource icons + amounts. Returns { update(res) }. */
export function resourceBar(scene, y, depth = 10) {
  const keys = ['gold', 'wood', 'ore', 'gems'];
  const items = keys.map((k, i) => {
    const x = 10 + i * 88;
    const icon = sprite(scene, x + 12, y, RES_ICON[k], 2).setDepth(depth);
    const t = text(scene, x + 28, y + 1, '0', { origin: [0, 0.5], color: PALETTE.cream }).setDepth(depth);
    return { icon, t, k };
  });
  return {
    items,
    update(res) { for (const it of items) it.t.setText(`${res[it.k]}`); },
  };
}

/** Creature slot: framed square with the creature and its count. onTap(slot). */
export function creatureSlot(scene, x, y, stack, { size = 56, onTap, selected = false, color } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.ink)).fillRect(-size / 2, -size / 2, size, size);
  g.fillStyle(hex(selected ? PALETTE.gold : (color || PALETTE.indigo))).fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);
  g.fillStyle(hex(PALETTE.night)).fillRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8);
  c.add(g);
  if (stack) {
    const def = CREATURES[stack.type];
    c.add(sprite(scene, 0, -4, unitFrame(def.sprite, 'idle', 0), size >= 56 ? 3 : 2));
    const n = text(scene, size / 2 - 4, size / 2 - 2, `${stack.count}`, { origin: [1, 1], color: PALETTE.cream });
    const nb = scene.add.rectangle(size / 2 - 3, size / 2 - 3, n.width + 6, 18, hex(PALETTE.ink), 0.8).setOrigin(1, 1);
    c.add([nb, n]);
  }
  if (onTap) {
    c.setSize(size, size).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => onTap());
  }
  return c;
}

/** Simple horizontal bar. */
export function bar(scene, x, y, w, h, frac, color) {
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.ink)).fillRect(x, y, w, h);
  g.fillStyle(hex(color)).fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.min(1, frac))), h - 2);
  return g;
}

/** Make a text object fit a width by scaling it down (keeps it crisp at 16px multiples otherwise). */
export function fit(t, w) { if (t.width > w) t.setScale(w / t.width); return t; }

export const costText = (cost, n = 1) => Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `${v * n} ${k}`).join(', ') || 'free';
