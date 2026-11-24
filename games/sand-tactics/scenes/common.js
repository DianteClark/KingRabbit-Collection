import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';

export { WIDTH, HEIGHT };

export const TEAM_COLOR = ['#5b8fd8', '#d0453f'];
export const TEAM_DARK = ['#2c4a80', '#6e2224'];

/** Hand-off between scenes. */
export const store = { start: null };

export function openHowTo(scene, onClose) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  const sections = [...RULES.sections];
  sections.splice(sections.length - 2, 0, {
    heading: 'The computer adapts to you',
    text: `The computer plays at level ${skillLabel()} of 10 for you right now. Win and it plays smarter next time (it focuses fire, guards its artillery and builds better counters); lose and it eases off. It never gets extra funds or units.`,
  });
  showHowTo({ ...RULES, sections }, () => { scene.scene.resume(); onClose?.(); });
}

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack, { y = 24 } = {}) {
  if (onBack) button(scene, 30, y, 48, 36, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, y, title, { size: title.length > 14 ? 16 : 32, color: PALETTE.cream });
  button(scene, WIDTH - 30, y, 48, 36, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

// Always pass data: Phaser reuses a scene's previous data when start() gets none (the menu would reopen its last view).
export function go(scene, key, data = {}) { fadeTo(scene, () => scene.scene.start(key, data)); }

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT - 150, color = PALETTE.gold, ms = 1400, depth = 90) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 40 }).setDepth(depth + 1);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.85).setDepth(depth);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: ms, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings or { text, color }) and buttons [[label, fn, fill?]].
 * opts.content(container, top) adds custom objects. Returns the container (call .close()).
 */
export function modal(scene, title, lines, buttons, { width = 324, extra = 0, content, wrap = 288, row = false } = {}) {
  const c = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 8, 0);
  const btnH = row ? 58 : buttons.length * 56;
  const h = Math.min(HEIGHT - 16, 72 + textH + extra + btnH + 10);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h, { fill: PALETTE.night, inner: PALETTE.sand }));
  c.add(text(scene, WIDTH / 2, top + 28, title, { size: title.length > 15 ? 16 : 32, color: PALETTE.gold }));
  let y = top + 56;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 8; }
  if (content) content(c, y);
  y += extra;
  const bw = row ? Math.floor((width - 40 - (buttons.length - 1) * 10) / buttons.length) : Math.min(250, width - 40);
  buttons.forEach(([label, fn, fill, color], i) => {
    const bx = row ? left + 20 + bw / 2 + i * (bw + 10) : WIDTH / 2;
    const by = row ? y + 26 : y + 26 + i * 56;
    c.add(button(scene, bx, by, bw, 44, label, () => { c.close(); fn?.(); }, {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    }));
  });
  c.close = () => { if (c.active) c.destroy(); };
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Make a text object fit a width by scaling it down. */
export function fit(t, w) { if (t.width > w) t.setScale(w / t.width); return t; }

export const money = (n) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Make an interactive zone fire fn on a real tap: the press must start on it and not wander off
 * (a drag that ends on it, or the release of an earlier tap, does nothing). Fires once per press.
 */
export function tapZone(zone, fn) {
  let down = null;
  zone.on('pointerdown', (p) => { down = { x: p.x, y: p.y }; });
  zone.on('pointerout', () => { down = null; });
  zone.on('pointerup', (p) => {
    if (!down) return;
    const moved = Math.hypot(p.x - down.x, p.y - down.y);
    down = null;
    if (moved <= 12) fn(p);
  });
  return zone;
}
