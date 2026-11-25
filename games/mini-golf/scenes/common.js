import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';

export { WIDTH, HEIGHT };

export const BLUE = '#5b7fd4';
export const ORANGE = PALETTE.orange;

export function openHowTo(scene, onClose) {
  if (document.getElementById('howto') || scene.leaving) return;
  scene.scene.pause();
  scene.events.emit('howto-open');
  showHowTo(RULES, () => { scene.scene.resume(); onClose?.(); });
}

/** Top bar: back button, title, gold "?" How to Play button. Returns { title, back, help }. */
export function header(scene, title, onBack, { y = 26 } = {}) {
  const back = onBack ? button(scene, 30, y, 48, 40, '<', onBack, { size: 32, fill: PALETTE.cream }) : null;
  const t = title ? fit(text(scene, WIDTH / 2, y, title, { size: 32, color: PALETTE.cream }), WIDTH - 130) : null;
  const help = button(scene, WIDTH - 30, y, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold });
  return { title: t, back, help };
}

// Always pass data: Phaser reuses a scene's previous data when start() gets none.
export function go(scene, key, data = {}) {
  if (scene.leaving) return;
  scene.leaving = true;
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function setBackground(scene, color) {
  scene.leaving = false;
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

export function shadowTitle(scene, x, y, str, color = PALETTE.gold, shadow = PALETTE.red) {
  text(scene, x, y + 4, str, { size: 32, color: shadow });
  return text(scene, x, y, str, { size: 32, color });
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT - 170, color = PALETTE.gold, ms = 1500) {
  scene.toastObj?.destroy(); scene.toastBg?.destroy();
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 48 }).setDepth(401);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 14, hex(PALETTE.ink), 0.9)
    .setStrokeStyle(2, hex(color)).setDepth(400);
  scene.toastObj = t; scene.toastBg = bg;
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: ms, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * Modal sheet with a title, lines of text (strings or { text, color }) and buttons [[label, fn, fill?]].
 * opts.content(container, top) adds custom objects (opts.extra px tall). Returns the container (.close()).
 */
export function modal(scene, title, lines, buttons, { width = 324, extra = 0, content, wrap = 280, row = false, onClose } = {}) {
  const c = scene.add.container(0, 0).setDepth(500);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 8, 0);
  const btnH = row ? 60 : buttons.length * 56;
  const h = Math.min(HEIGHT - 16, 70 + textH + extra + btnH + 8);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h, { fill: PALETTE.night, inner: PALETTE.lavender }));
  c.add(fit(text(scene, WIDTH / 2, top + 30, title, { size: 32, color: PALETTE.gold }), width - 30));
  let y = top + 58;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 8; }
  if (content) content(c, y);
  y += extra;
  const bw = row ? Math.floor((width - 40 - (buttons.length - 1) * 10) / buttons.length) : Math.min(250, width - 40);
  let closed = false;
  buttons.forEach(([label, fn, fill, color], i) => {
    const bx = row ? left + 20 + bw / 2 + i * (bw + 10) : WIDTH / 2;
    const by = row ? y + 28 : y + 28 + i * 56;
    const b = button(scene, bx, by, bw, 46, label, () => {
      if (closed) return;
      c.close();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night });
    fit(b.label, bw - 16);
    c.add(b);
  });
  c.close = () => { if (closed) return; closed = true; if (c.active) c.destroy(); onClose?.(); };
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Make a text object fit a width by scaling it down (only ever used on 16/32px text). */
export function fit(t, w) { if (t.width > w) t.setScale(w / t.width); return t; }

/**
 * Make an interactive object fire fn on a real tap: the press must start on it and not wander off.
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

/** Three stars in a row (filled = gold, empty = dark). Returns a container. */
export function starRow(scene, x, y, n, { scale = 1, gap = 30 } = {}) {
  const c = scene.add.container(x, y);
  for (let i = 0; i < 3; i++) {
    const s = scene.add.image((i - 1) * gap * scale, 0, 'star').setScale(scale);
    if (i >= n) s.setTint(0x47416b);
    else s.setTint(hex(PALETTE.gold));
    c.add(s);
  }
  return c;
}
