import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { hpLabel } from '../adaptive.js';

export { WIDTH, HEIGHT };

/** Hand-off between scenes. */
export const store = { start: null };

export const howToOpen = () => !!document.getElementById('howto');

export function openHowTo(scene, onClose) {
  if (howToOpen()) return;
  const sections = [...RULES.sections];
  sections.splice(sections.length - 2, 0, {
    heading: 'The game adapts to you',
    text: `On Normal campaign maps, enemy health is ${hpLabel()} of standard for you right now. Win and it creeps up a little; lose and it eases off (never below 88% or above 112%). Nothing else changes: same waves, same money, same towers.`,
  });
  scene.events.emit('howto', true);
  showHowTo({ ...RULES, sections }, () => { scene.events.emit('howto', false); onClose?.(); });
}

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack, { y = 24 } = {}) {
  if (onBack) button(scene, 30, y, 48, 40, '<', onBack, { size: 32, fill: PALETTE.cream });
  const t = text(scene, WIDTH / 2, y, title, { size: title.length > 12 ? 16 : 32, color: PALETTE.cream });
  button(scene, WIDTH - 30, y, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return t;
}

// Always pass data: Phaser reuses a scene's previous data when start() gets none.
export function go(scene, key, data = {}) {
  if (scene._leaving) return;
  scene._leaving = true;
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function setBackground(scene, color) {
  scene._leaving = false;
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT / 2, color = PALETTE.gold, ms = 1400, depth = 90) {
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 40 }).setDepth(depth + 1);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 12, hex(PALETTE.ink), 0.85).setDepth(depth);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: ms, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings or { text, color }) and buttons [[label, fn, fill?]].
 * opts.content(container, top) adds custom objects; opts.extra reserves height for them.
 * Taps on the dimmed area never reach the game underneath. Returns the container (call .close()).
 */
export function modal(scene, title, lines, buttons, { width = 324, extra = 0, content, wrap = 288, row = false, onClose } = {}) {
  const c = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 8, 0);
  const btnH = buttons.length ? (row ? 58 : buttons.length * 54) : 0;
  const h = Math.min(HEIGHT - 16, 66 + textH + extra + btnH + 8);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h, { fill: PALETTE.night, inner: PALETTE.sand }));
  c.add(text(scene, WIDTH / 2, top + 28, title, { size: title.length > 15 ? 16 : 32, color: PALETTE.gold }));
  let y = top + 54;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 8; }
  if (content) content(c, y);
  y += extra;
  const bw = row ? Math.floor((width - 32 - (buttons.length - 1) * 8) / buttons.length) : Math.min(260, width - 40);
  let closing = false;
  buttons.forEach(([label, fn, fill, color], i) => {
    const bx = row ? left + 16 + bw / 2 + i * (bw + 8) : WIDTH / 2;
    const by = row ? y + 26 : y + 26 + i * 54;
    const b = button(scene, bx, by, bw, 44, label, () => {
      if (closing) return; // one tap only, even if two buttons are hit at once
      closing = true;
      c.close();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night });
    fit(b.label, bw - 12);
    c.add(b);
  });
  c.close = () => { if (c.active) { c.destroy(); onClose?.(); } };
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Make a text object fit a width by scaling it down. */
export function fit(t, w) { t.setScale(1); if (t.width > w) t.setScale(w / t.width); return t; }

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
    if (moved <= 14) fn(p);
  });
  return zone;
}

/** A row of 3 small stars (filled up to n). */
export function stars(scene, x, y, n, size = 6, gap = 16) {
  const g = scene.add.graphics();
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * gap;
    drawStar(g, cx, y, size, i < n ? hex(PALETTE.gold) : hex(PALETTE.indigo));
  }
  return g;
}
export function drawStar(g, cx, cy, r, color) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  g.fillStyle(hex(PALETTE.ink)).fillPoints(pts.map((p) => ({ x: p.x + 1, y: p.y + 1 })), true);
  g.fillStyle(color).fillPoints(pts, true);
}
