import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { skillLabel } from '../adaptive.js';
import { saveRun } from '../save.js';
import { anyOpen, closeAll } from './panels.js';

export { WIDTH, HEIGHT };

/** Images made at boot for the HTML panels (data URLs). */
export const IMG = { potion: {}, el: {}, star: '', starOff: '', ingSheet: '' };

/** The shop in progress, shared by the scenes. */
export const store = { s: null };
export function persist() { if (store.s) saveRun(store.s); }

/** Short-lived lock so one tap can't fire two actions (and taps can't land on a closing popup). */
export function once(scene, ms = 300) {
  const now = scene.time.now;
  if (scene.__busyUntil && now < scene.__busyUntil) return false;
  scene.__busyUntil = now + ms;
  return true;
}

/** Top bar: back button, title, gold "?" How to Play button. */
export function header(scene, title, onBack) {
  const bg = scene.add.rectangle(0, 0, WIDTH, 52, hex(PALETTE.night)).setOrigin(0).setDepth(5000);
  scene.add.rectangle(0, 52, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0).setDepth(5000);
  bg.setInteractive(); // taps on the bar never reach the scene below it
  const back = button(scene, 30, 26, 48, 40, '<', () => { if (!anyOpen() && once(scene)) onBack(); }, { size: 32, fill: PALETTE.cream }).setDepth(5001);
  const t = text(scene, WIDTH / 2, 26, title, { size: title.length > 13 ? 16 : 32, color: PALETTE.cream }).setDepth(5001);
  const help = button(scene, WIDTH - 30, 26, 48, 40, '?', () => openHowTo(scene), { size: 32, fill: PALETTE.gold }).setDepth(5001);
  return { title: t, back, help };
}

export function openHowTo(scene) {
  if (document.getElementById('howto') || anyOpen()) return;
  const sections = [...RULES.sections];
  sections.splice(sections.length - 1, 0, {
    heading: 'The customers adapt to you',
    text: `Customers are at pickiness level ${skillLabel()} of 10 for you right now. When most customers leave happy, they start asking for stronger potions, get more specific and haggle harder, and Madame Vex brews better festival potions. If many leave unhappy, they ease off. Prices, rent and your ingredients never change.`,
  });
  scene.input.enabled = false;
  showHowTo({ ...RULES, sections }, () => { scene.time.delayedCall(200, () => { scene.input.enabled = true; }); });
}

export function go(scene, key, data = {}) {
  closeAll();
  scene.input.enabled = false;
  fadeTo(scene, () => scene.scene.start(key, data));
}

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = 470, color = PALETTE.gold) {
  scene.__toast?.forEach((o) => o.destroy());
  const t = text(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 48 }).setDepth(7001);
  const bg = scene.add.rectangle(WIDTH / 2, y, Math.min(WIDTH - 16, t.width + 24), t.height + 14, hex(PALETTE.ink), 0.88).setDepth(7000);
  scene.__toast = [t, bg];
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1700, duration: 300, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

/**
 * In-canvas modal with a title, lines and buttons [[label, fn, fill?]]. The dim layer swallows taps.
 */
export function modal(scene, title, lines, buttons, { width = 320, wrap = 284 } = {}) {
  scene.__modal?.close();
  const c = scene.add.container(0, 0).setDepth(8000);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  c.add(dim);
  const texts = lines.map((l) => {
    const o = typeof l === 'string' ? { text: l } : l;
    return text(scene, WIDTH / 2, 0, o.text, { color: o.color || PALETTE.cream, wrap, align: 'center' }).setOrigin(0.5, 0);
  });
  const textH = texts.reduce((a, t) => a + t.height + 8, 0);
  const btnH = buttons.length * 58;
  const h = Math.min(HEIGHT - 20, 72 + textH + btnH + 10);
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add(panel(scene, left, top, width, h));
  c.add(text(scene, WIDTH / 2, top + 30, title, { size: title.length > 16 ? 16 : 32, color: PALETTE.gold }));
  let y = top + 58;
  for (const t of texts) { t.setY(y); c.add(t); y += t.height + 8; }
  let done = false;
  buttons.forEach(([label, fn, fill], i) => {
    c.add(button(scene, WIDTH / 2, y + 26 + i * 58, Math.min(260, width - 40), 46, label, () => {
      if (done) return;
      done = true;
      c.close();
      fn?.();
    }, { fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender) }));
  });
  c.close = () => { if (c.active) c.destroy(); if (scene.__modal === c) scene.__modal = null; };
  scene.__modal = c;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** A row of 1-3 stars (images) starting at x. */
export function starRow(scene, x, y, n, scale = 2, max = 3) {
  const out = [];
  for (let i = 0; i < max; i++) out.push(scene.add.image(x + i * (8 * scale), y, i < n ? 'star' : 'starOff').setScale(scale));
  return out;
}

/** Coins / reputation / picks strip under the header. */
export function statBar(scene, y = 54) {
  scene.add.rectangle(0, y, WIDTH, 30, hex('#2b2238')).setOrigin(0);
  scene.add.rectangle(0, y + 30, WIDTH, 2, hex(PALETTE.ink)).setOrigin(0);
  scene.add.image(18, y + 15, 'coin').setScale(3);
  const coins = text(scene, 32, y + 15, '', { origin: [0, 0.5], color: PALETTE.gold });
  scene.add.image(128, y + 15, 'rep').setScale(3);
  const rep = text(scene, 142, y + 15, '', { origin: [0, 0.5], color: '#f5b0c0' });
  const extra = text(scene, WIDTH - 10, y + 15, '', { origin: [1, 0.5], color: PALETTE.lavender });
  return {
    update(s, more = '') {
      coins.setText(String(s.coins));
      coins.setColor(s.coins < 0 ? '#ff8070' : PALETTE.gold);
      rep.setText(`Rep ${s.rep}`);
      extra.setText(more);
    },
  };
}

/** Pulsing gold outline that points the first-time player at a button. */
export function hint(scene, target, w, h) {
  const g = scene.add.rectangle(target.x, target.y, w + 10, h + 12).setStrokeStyle(3, hex(PALETTE.gold)).setDepth((target.depth || 0) + 1);
  scene.tweens.add({ targets: g, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  return g;
}

export { closeAll };
